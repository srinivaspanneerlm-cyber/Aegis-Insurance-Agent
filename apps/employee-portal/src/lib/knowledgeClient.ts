import { KnowledgeClient } from "@aegis/knowledge";
import { API_URL } from "@/lib/workspace";

/**
 * One client for the whole portal.
 *
 * A module-level instance rather than one per page, so the read cache inside it
 * is actually shared — a per-page client would cache nothing useful, because
 * every navigation would build a new empty one.
 */
export const knowledgeClient = new KnowledgeClient({ baseUrl: API_URL });
