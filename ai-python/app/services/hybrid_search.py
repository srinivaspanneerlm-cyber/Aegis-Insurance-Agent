import os
import json
import math
import re
from typing import List, Dict, Any, Optional
from pathlib import Path
import google.generativeai as genai
from app.config.config import settings
from app.utils.logger import logger

_TOKEN = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> List[str]:
    """Lowercase word tokens of length >= 2 (drops punctuation and single chars)."""
    return [w for w in _TOKEN.findall((text or "").lower()) if len(w) >= 2]


class _BM25Index:
    """A small, dependency-free BM25 ranker over the chunk corpus.

    Provides real lexical relevance ranking (term-frequency saturation + inverse
    document frequency + length normalisation) for the **offline** retrieval path,
    so the engine gives quality results without an embedding API key. Built once at
    startup over ~hundreds of chunks, so the O(query_terms · postings) scoring is
    negligible.
    """

    def __init__(self, docs: List[str], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        tokenized = [_tokenize(d) for d in docs]
        self.doc_len = [len(t) for t in tokenized]
        self.N = len(docs)
        self.avgdl = (sum(self.doc_len) / self.N) if self.N else 0.0
        # inverted index: term -> list of (doc_idx, term_frequency)
        self.postings: Dict[str, List] = {}
        for i, toks in enumerate(tokenized):
            tf: Dict[str, int] = {}
            for t in toks:
                tf[t] = tf.get(t, 0) + 1
            for term, f in tf.items():
                self.postings.setdefault(term, []).append((i, f))

    def _idf(self, term: str) -> float:
        n = len(self.postings.get(term, ()))
        # +1 smoothing keeps the idf non-negative even for very common terms
        return math.log(1 + (self.N - n + 0.5) / (n + 0.5))

    def scores(self, query: str) -> List[float]:
        out = [0.0] * self.N
        for term in set(_tokenize(query)):
            postings = self.postings.get(term)
            if not postings:
                continue
            idf = self._idf(term)
            for i, f in postings:
                denom = f + self.k1 * (1 - self.b + self.b * self.doc_len[i] / (self.avgdl or 1))
                out[i] += idf * (f * (self.k1 + 1)) / denom
        return out


class SemanticChunk:
    def __init__(self, category: str, plan_name: str, section: str, content: str):
        self.category = category
        self.plan_name = plan_name
        self.section = section
        self.content = content
        self.text_for_embedding = f"Category: {category} | Plan: {plan_name} | Section: {section} | Details: {content}"
        self.embedding = None

class HybridSearchEngine:
    def __init__(self):
        self.base_dir = Path(__file__).resolve().parent.parent.parent
        self.data_dir = self.base_dir / "insurance-data"
        self.chunks: List[SemanticChunk] = []
        self.gemini_configured = False
        
        # Configure Gemini embedding SDK
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.gemini_configured = True
                logger.info("HybridSearchEngine: Gemini API embedding client configured.")
            except Exception as e:
                logger.error(f"HybridSearchEngine: Failed to configure Gemini embedding: {e}")
        
        self.initialize_chunks()

        # Index every chunk and build the offline BM25 ranker over its embedding text.
        for i, c in enumerate(self.chunks):
            c.idx = i
        self._bm25 = _BM25Index([c.text_for_embedding for c in self.chunks])

    def initialize_chunks(self):
        """
        Parses all knowledge.json files in insurance-data subdirectories and builds semantic chunks.
        """
        logger.info("HybridSearchEngine: Starting semantic chunking pipeline...")
        if not self.data_dir.exists():
            logger.error(f"HybridSearchEngine: insurance-data folder not found at {self.data_dir}")
            return

        categories = [d.name for d in self.data_dir.iterdir() if d.is_dir()]
        for cat in categories:
            knowledge_file = self.data_dir / cat / "knowledge.json"
            if not knowledge_file.exists():
                continue
            
            try:
                with open(knowledge_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                # Chunk plans
                plans = data.get("insurance_plans", [])
                for plan in plans:
                    pname = plan.get("plan_name", "Unknown Plan")
                    
                    # 1. Coverage & Premium
                    self.chunks.append(SemanticChunk(
                        cat, pname, "Coverage & Premium Cost",
                        f"Monthly premium is {plan.get('premium')}. Total cover limit is {plan.get('coverage')}."
                    ))
                    # 2. Eligibility
                    self.chunks.append(SemanticChunk(
                        cat, pname, "Eligibility & Age Limits",
                        plan.get("eligibility", "")
                    ))
                    # 3. Waiting Periods
                    self.chunks.append(SemanticChunk(
                        cat, pname, "Waiting Periods & Conditions",
                        plan.get("waiting_period", "")
                    ))
                    # 4. Exclusions
                    self.chunks.append(SemanticChunk(
                        cat, pname, "Policy Exclusions & Disclaimers",
                        plan.get("exclusions", "")
                    ))
                    # 5. Core Benefits
                    self.chunks.append(SemanticChunk(
                        cat, pname, "Policy Benefits & Inclusions",
                        " | ".join(plan.get("benefits", []))
                    ))
                    # 6. Claim Flow
                    self.chunks.append(SemanticChunk(
                        cat, pname, "Claim Processing & Payout TPA Flow",
                        plan.get("claim_process", "")
                    ))
                    # 7. Tax Savings
                    self.chunks.append(SemanticChunk(
                        cat, pname, "Tax Exemption Benefits",
                        plan.get("tax_benefits", "")
                    ))
                    # 8. Optimal Target
                    self.chunks.append(SemanticChunk(
                        cat, pname, "Best Suited Target Audience",
                        plan.get("best_for", "")
                    ))
                    # 9. Emotional Protections
                    if plan.get("emotional_protection_benefits"):
                        self.chunks.append(SemanticChunk(
                            cat, pname, "Emotional Protection Safeguards",
                            plan.get("emotional_protection_benefits", "")
                        ))

                # Chunk FAQs
                faqs = data.get("faqs", [])
                for faq in faqs:
                    self.chunks.append(SemanticChunk(
                        cat, "General FAQ", f"FAQ: {faq.get('question')}",
                        f"Answer: {faq.get('answer')}"
                    ))
                    
            except Exception as e:
                logger.error(f"HybridSearchEngine: Error chunking category '{cat}': {e}")
                
        logger.info(f"HybridSearchEngine: Semantic chunking complete. Built {len(self.chunks)} granular policy chunks.")

    def _get_embedding(self, text: str) -> Optional[List[float]]:
        """
        Retrieves a dense embedding from the Gemini API, cached in memory.
        """
        if not self.gemini_configured:
            return None
        try:
            # Using industry standard text-embedding-004
            response = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_query"
            )
            return response.get("embedding", None) or response["embedding"]
        except Exception as e:
            logger.warning(f"HybridSearchEngine: Embedding generation failed: {e}. Falling back to keyword synonym matcher.")
            return None

    def search(self, query: str, category: str, top_k: int = 5) -> List[SemanticChunk]:
        """
        Performs Hybrid Search (Semantic + BM25 keyword matching) to find the most relevant policy chunks.
        """
        logger.info(f"HybridSearchEngine: Searching for '{query}' in category '{category}'")
        
        # Filter chunks by active resolved category to ensure contextual safety
        filtered_chunks = [c for c in self.chunks if c.category == category]
        if not filtered_chunks:
            filtered_chunks = self.chunks

        query_words = set(query.lower().split())
        scored_chunks = []

        # Try to get dense vector of the query for semantic matching
        query_vector = self._get_embedding(query)

        # Offline path: precompute peak-normalised BM25 relevance over the
        # filtered set, so the semantic score is real (not just a synonym table).
        offline = not (query_vector and self.gemini_configured)
        bm25_norm: Dict[int, float] = {}
        if offline:
            raw = self._bm25.scores(query)
            peak = max((raw[c.idx] for c in filtered_chunks), default=0.0) or 1.0
            bm25_norm = {c.idx: raw[c.idx] / peak for c in filtered_chunks}

        for chunk in filtered_chunks:
            # 1) Keyword/Lexical match score (BM25 term overlap approximation)
            content_lower = chunk.content.lower()
            section_lower = chunk.section.lower()
            plan_lower = chunk.plan_name.lower()
            
            lexical_score = 0.0
            for word in query_words:
                if len(word) < 3:
                    continue
                if word in section_lower:
                    lexical_score += 2.0
                if word in plan_lower:
                    lexical_score += 1.5
                if word in content_lower:
                    lexical_score += 1.0

            # 2) Semantic match score (cosine similarity or conceptual term mapping)
            semantic_score = 0.0
            if query_vector and self.gemini_configured:
                # Lazy-load chunk embedding
                if chunk.embedding is None:
                    chunk.embedding = self._get_embedding(chunk.text_for_embedding)
                
                if chunk.embedding:
                    # Calculate cosine similarity
                    dot_product = sum(a * b for a, b in zip(query_vector, chunk.embedding))
                    mag_q = math.sqrt(sum(a * a for a in query_vector))
                    mag_c = math.sqrt(sum(b * b for b in chunk.embedding))
                    if mag_q > 0 and mag_c > 0:
                        semantic_score = dot_product / (mag_q * mag_c)
            else:
                # Offline: BM25 relevance, plus a concept-intent boost that
                # survives vocabulary mismatch (e.g. "not covered" → the
                # Exclusions section, whose text shares no words with the query).
                semantic_score = bm25_norm.get(chunk.idx, 0.0)
                concept_section = {
                    "exclusion": "exclusion", "waiting": "waiting", "benefit": "benefit",
                    "tax": "tax", "claim": "claim", "cost": "premium",
                }
                concept_map = {
                    "exclusion": ["exclude", "exclusions", "not covered", "except", "cosmetic", "injury"],
                    "waiting": ["waiting", "waiting period", "illness", "pre-existing", "disease"],
                    "benefit": ["benefit", "benefits", "include", "cashless", "hospital", "coverage", "cover"],
                    "tax": ["tax", "80d", "exemption", "save", "saving"],
                    "claim": ["claim", "reimbursement", "process", "payout", "tpa"],
                    "cost": ["cost", "premium", "rupee", "cheap", "price", "affordable"],
                }
                ql = query.lower()
                for concept, synonyms in concept_map.items():
                    if concept_section[concept] in section_lower and any(syn in ql for syn in synonyms):
                        semantic_score += 1.0

            # Combined hybrid scoring weights (0.7 * semantic + 0.3 * lexical)
            hybrid_score = (0.7 * semantic_score) + (0.3 * lexical_score)
            
            scored_chunks.append((chunk, hybrid_score))

        # Sort by score descending
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        
        # Extract top k chunks
        top_chunks = [item[0] for item in scored_chunks[:top_k]]
        
        logger.info(f"HybridSearchEngine: Retrieval complete. Selected top {len(top_chunks)} semantic chunks.")
        return top_chunks


# ── Singleton ───────────────────────────────────────────────────────────────────

_engine_singleton: Optional[HybridSearchEngine] = None


def get_hybrid_search_engine() -> HybridSearchEngine:
    """Singleton getter — builds the chunk corpus + BM25 index once and reuses it."""
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = HybridSearchEngine()
    return _engine_singleton
