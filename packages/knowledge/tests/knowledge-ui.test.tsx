/**
 * The knowledge workspace components.
 *
 * These test what the UI is *for*, not that it renders. The properties worth
 * pinning are the ones that would quietly cause harm if they regressed:
 *
 *  - Guidance that is no longer in force says so, in the list as well as the
 *    detail — an advisor must not quote an expired circular.
 *  - Where a memory came from is as visible as what it says, so an inference is
 *    never repeated back to a customer as fact.
 *  - Loading, empty and error are three distinct states, because collapsing
 *    them makes a slow request look like an empty knowledge base.
 *  - Search says it matches words rather than meaning.
 */
import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KnowledgeCard } from "../src/components/KnowledgeCard";
import { KnowledgeList } from "../src/components/KnowledgeList";
import { KnowledgeSearchBar } from "../src/components/KnowledgeSearchBar";
import { KnowledgeFilters } from "../src/components/KnowledgeFilters";
import { VersionHistory } from "../src/components/VersionHistory";
import { MemoryCard } from "../src/components/MemoryCard";
import { MemoryTimeline } from "../src/components/MemoryTimeline";
import { BookmarkButton } from "../src/components/BookmarkButton";
import { SearchPanel } from "../src/components/SearchPanel";
import { KnowledgePreview } from "../src/components/KnowledgePreview";
import { effectiveState, tagsOf, timeAgo } from "../src/lib/types";
import type { KnowledgeArticle, MemoryFact, SearchResult } from "../src/lib/types";

const article = (over: Partial<KnowledgeArticle> = {}): KnowledgeArticle => ({
  id: "a1",
  slug: "free-look-period",
  title: "IRDAI free look period",
  category: "REGULATION",
  summary: "A policyholder may return a policy within fifteen days.",
  status: "APPROVED",
  classification: "INTERNAL",
  version: 3,
  tags: "irdai,free-look",
  sourceRef: "IRDAI/HLT/REG/2024-25",
  effectiveFrom: null,
  effectiveTo: null,
  reviewDueAt: null,
  publishedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  viewCount: 12,
  ...over,
});

const fact = (over: Partial<MemoryFact> = {}): MemoryFact => ({
  id: "m1",
  kind: "PREFERENCE",
  key: "contact.preferred_channel",
  value: "phone",
  confidence: 1,
  source: "CUSTOMER_STATED",
  sourceRef: null,
  createdAt: new Date().toISOString(),
  expiresAt: null,
  ...over,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

describe("presentation helpers", () => {
  test("expired guidance is reported as no longer in force", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(effectiveState({ effectiveFrom: null, effectiveTo: past }).state).toBe("EXPIRED");
  });

  test("guidance that has not started yet is distinguished from expired", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(effectiveState({ effectiveFrom: future, effectiveTo: null }).state).toBe("NOT_YET");
  });

  test("tags survive the comma-separated column the backend still stores", () => {
    expect(tagsOf({ tags: "irdai, free-look ,," })).toEqual(["irdai", "free-look"]);
  });

  test("a missing date reads as an em dash, never as Invalid Date", () => {
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo("not-a-date")).toBe("—");
  });
});

// ── KnowledgeCard ────────────────────────────────────────────────────────────

describe("KnowledgeCard", () => {
  test("an expired circular says so on the card, not only on the detail page", () => {
    // An advisor scanning a list has to see this before they quote it.
    render(
      <KnowledgeCard
        article={article({ effectiveTo: new Date(Date.now() - 1000).toISOString() })}
      />
    );
    expect(screen.getByText(/no longer in force/i)).toBeInTheDocument();
  });

  test("governance badges can be hidden for a customer-facing surface", () => {
    const { rerender } = render(<KnowledgeCard article={article()} />);
    expect(screen.getByText("Internal")).toBeInTheDocument();

    rerender(<KnowledgeCard article={article()} showGovernance={false} />);
    expect(screen.queryByText("Internal")).not.toBeInTheDocument();
  });

  test("the title is the link, not the whole card", async () => {
    // A card-sized target swallows the bookmark control and gives a screen
    // reader one enormous unnamed link.
    const onOpen = vi.fn();
    render(<KnowledgeCard article={article()} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button", { name: /IRDAI free look period/i }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("the source reference is shown so a citation can be checked", () => {
    render(<KnowledgeCard article={article()} />);
    expect(screen.getByText(/IRDAI\/HLT\/REG\/2024-25/)).toBeInTheDocument();
  });
});

// ── BookmarkButton ───────────────────────────────────────────────────────────

describe("BookmarkButton", () => {
  test("its label names the article, so fifteen of them are distinguishable", () => {
    render(
      <BookmarkButton id="a1" title="Free look period" bookmarked={false} onToggle={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /bookmark free look period/i })).toBeInTheDocument();
  });

  test("state is announced through aria-pressed, not only drawn", () => {
    render(<BookmarkButton id="a1" title="X" bookmarked onToggle={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  test("it says bookmarks are device-only rather than implying a sync", () => {
    render(<BookmarkButton id="a1" title="X" bookmarked={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      expect.stringMatching(/this device only/i)
    );
  });
});

// ── KnowledgeList ────────────────────────────────────────────────────────────

describe("KnowledgeList", () => {
  test("loading, empty and error are three different states", () => {
    const { rerender } = render(<KnowledgeList articles={[]} loading />);
    expect(screen.getByText(/loading knowledge/i)).toBeInTheDocument();

    rerender(<KnowledgeList articles={[]} error="Could not reach Aegis." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not reach Aegis.");

    rerender(<KnowledgeList articles={[]} />);
    expect(screen.getByText(/no guidance matches/i)).toBeInTheDocument();
  });

  test("paging announces the page politely and disables the ends", async () => {
    const onPage = vi.fn();
    render(
      <KnowledgeList articles={[article()]} page={0} pageCount={3} total={30} onPage={onPage} />
    );

    const nav = screen.getByRole("navigation", { name: /knowledge pages/i });
    expect(within(nav).getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(within(nav).getByText(/page 1 of 3/i)).toBeInTheDocument();

    await userEvent.click(within(nav).getByRole("button", { name: /next/i }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  test("paging is hidden when there is only one page", () => {
    render(<KnowledgeList articles={[article()]} page={0} pageCount={1} onPage={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: /knowledge pages/i })).not.toBeInTheDocument();
  });
});

// ── Search ───────────────────────────────────────────────────────────────────

describe("KnowledgeSearchBar", () => {
  test("it says search matches words rather than meaning", () => {
    render(<KnowledgeSearchBar value="" onChange={vi.fn()} method="LEXICAL" />);
    expect(screen.getByText(/matches words, not meaning/i)).toBeInTheDocument();
  });

  test("the hint changes when the method does", () => {
    render(<KnowledgeSearchBar value="" onChange={vi.fn()} method="SEMANTIC" />);
    expect(screen.getByText(/understands meaning/i)).toBeInTheDocument();
  });

  test("it is a real search form that submits on Enter", async () => {
    const onSubmit = vi.fn();
    render(<KnowledgeSearchBar value="motor" onChange={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByRole("search")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("motor");
  });
});

describe("SearchPanel", () => {
  const result = (over: Partial<SearchResult> = {}): SearchResult => ({
    hits: [],
    method: "LEXICAL",
    note: null,
    took: 4,
    ...over,
  });

  test("an untouched panel invites a search rather than showing an empty state", () => {
    render(<SearchPanel term="" onTermChange={vi.fn()} result={null} />);
    expect(screen.getByText(/type to search guidance/i)).toBeInTheDocument();
  });

  test("a fruitless search shows the server's own explanation", () => {
    // The note is asserted distinctly from the search bar's own hint, which
    // also mentions matching words — two elements matching one query is a test
    // that passes for the wrong reason.
    render(
      <SearchPanel
        term="cooling off"
        onTermChange={vi.fn()}
        result={result({
          note: 'Nothing matched "cool, off". Try the exact term used in the circular.',
        })}
      />
    );
    expect(screen.getByText(/try the exact term used in the circular/i)).toBeInTheDocument();
  });

  test("an expired hit is flagged in the result list, not only after opening it", () => {
    render(
      <SearchPanel
        term="free look"
        onTermChange={vi.fn()}
        result={result({
          hits: [
            {
              id: "h1",
              slug: "s",
              title: "Superseded circular",
              category: "REGULATION",
              summary: "…",
              score: 3,
              excerpt: "the free look period is fifteen days",
              matchedTerms: ["free", "look"],
              sourceRef: "IRDAI/1",
              effectiveFrom: null,
              effectiveTo: new Date(Date.now() - 1000).toISOString(),
            },
          ],
        })}
      />
    );
    expect(screen.getByText(/no longer in force/i)).toBeInTheDocument();
  });

  test("the result count is announced politely", () => {
    render(<SearchPanel term="motor" onTermChange={vi.fn()} result={result({ hits: [] })} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("0 results");
  });
});

// ── Filters ──────────────────────────────────────────────────────────────────

describe("KnowledgeFilters", () => {
  const values = { category: "", status: "", tag: "", classification: "", updatedSince: "" };

  test("every control has a visible label, not a placeholder", () => {
    render(<KnowledgeFilters values={values} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Approval status")).toBeInTheDocument();
    expect(screen.getByLabelText("Visibility")).toBeInTheDocument();
    expect(screen.getByLabelText("Updated since")).toBeInTheDocument();
  });

  test("governance filters are hidden from a reader who cannot see drafts", () => {
    render(<KnowledgeFilters values={values} onChange={vi.fn()} showGovernance={false} />);
    expect(screen.queryByLabelText("Approval status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
  });

  test("it admits which filters only narrow what is already loaded", () => {
    render(
      <KnowledgeFilters
        values={{ ...values, classification: "PUBLIC" }}
        onChange={vi.fn()}
        serverFiltered={["category", "status"]}
      />
    );
    expect(screen.getByText(/narrows the articles already loaded/i)).toBeInTheDocument();
  });

  test("clearing reports how many filters are active", async () => {
    const onChange = vi.fn();
    render(
      <KnowledgeFilters
        values={{ ...values, category: "REGULATION", status: "DRAFT" }}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /clear 2 filters/i }));
    expect(onChange).toHaveBeenCalledWith(values);
  });
});

// ── Version history ──────────────────────────────────────────────────────────

describe("VersionHistory", () => {
  test("versions and reviews are one interleaved story", () => {
    render(
      <VersionHistory
        history={{
          articleId: "a1",
          currentVersion: 2,
          versions: [
            {
              id: "v1",
              version: 1,
              title: "First wording",
              summary: "…",
              changeNote: "Rewritten after the 2026 circular.",
              authoredById: "u1",
              createdAt: new Date(Date.now() - 7200_000).toISOString(),
            },
          ],
          reviews: [
            {
              id: "r1",
              decision: "APPROVED",
              reviewerId: "u2",
              notes: null,
              createdAt: new Date(Date.now() - 3600_000).toISOString(),
            },
          ],
        }}
      />
    );

    const items = screen.getAllByRole("listitem");
    // Newest first: the approval came after the version it approved.
    expect(items[0]).toHaveTextContent("APPROVED");
    expect(items[1]).toHaveTextContent("Version 1");
    expect(screen.getByText(/rewritten after the 2026 circular/i)).toBeInTheDocument();
  });

  test("a version with no reason says so rather than leaving a blank", () => {
    render(
      <VersionHistory
        history={{
          articleId: "a1",
          currentVersion: 2,
          versions: [
            {
              id: "v1",
              version: 1,
              title: "First wording",
              summary: "…",
              changeNote: null,
              authoredById: null,
              createdAt: new Date().toISOString(),
            },
          ],
          reviews: [],
        }}
      />
    );
    expect(screen.getByText(/no reason recorded/i)).toBeInTheDocument();
  });

  test("a first version is described, not shown as empty", () => {
    render(
      <VersionHistory history={{ articleId: "a1", currentVersion: 1, versions: [], reviews: [] }} />
    );
    expect(screen.getByText(/this is the first version/i)).toBeInTheDocument();
  });
});

// ── Memory ───────────────────────────────────────────────────────────────────

describe("MemoryCard", () => {
  test("an inference is labelled differently from something the customer said", () => {
    const { rerender } = render(<MemoryCard fact={fact({ source: "CUSTOMER_STATED" })} />);
    expect(screen.getByText(/they told us/i)).toBeInTheDocument();

    rerender(<MemoryCard fact={fact({ source: "AI_INFERRED", confidence: 0.6 })} />);
    expect(screen.getByText(/aegis inferred/i)).toBeInTheDocument();
  });

  test("confidence is words first, number second", () => {
    render(<MemoryCard fact={fact({ confidence: 0.6 })} />);
    expect(screen.getByText(/uncertain/i)).toBeInTheDocument();
    expect(screen.getByText(/\(60%\)/)).toBeInTheDocument();
  });

  test("the key is shown so an advisor can name the fact they are challenged on", () => {
    render(<MemoryCard fact={fact()} />);
    expect(screen.getByText("contact.preferred_channel")).toBeInTheDocument();
  });

  test("a superseded fact is marked as replaced rather than hidden", () => {
    render(<MemoryCard fact={fact({ current: false })} />);
    expect(screen.getByText(/replaced/i)).toBeInTheDocument();
  });

  test("a boolean value reads as Yes rather than as true", () => {
    render(<MemoryCard fact={fact({ value: true })} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });
});

describe("MemoryTimeline", () => {
  test("superseded values stay visible, with the current one marked", () => {
    render(
      <MemoryTimeline
        forKey="contact.preferred_channel"
        entries={[
          fact({ id: "m2", value: "phone", current: true }),
          fact({ id: "m1", value: "email", current: false }),
        ]}
      />
    );

    expect(screen.getByText("phone")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  test("an empty history is explained", () => {
    render(<MemoryTimeline entries={[]} />);
    expect(screen.getByText(/nothing recorded yet/i)).toBeInTheDocument();
  });
});

// ── The AI Knowledge Viewer ──────────────────────────────────────────────────

describe("KnowledgePreview", () => {
  test("it raises an alert when the guidance is no longer in force", () => {
    // The failure this component exists to prevent: an assistant citing a
    // circular that expired last month.
    render(
      <KnowledgePreview
        article={article({ effectiveTo: new Date(Date.now() - 1000).toISOString() })}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/check before relying on this/i);
  });

  test("it always shows source, version and last updated", () => {
    render(<KnowledgePreview article={article()} />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText(/IRDAI\/HLT\/REG\/2024-25/)).toBeInTheDocument();
    expect(screen.getByText(/version 3/i)).toBeInTheDocument();
    expect(screen.getByText("Last updated")).toBeInTheDocument();
  });

  test("guidance with no traceable source says so rather than showing a blank", () => {
    render(<KnowledgePreview article={article({ sourceRef: null })} />);
    expect(screen.getByText(/no source recorded/i)).toBeInTheDocument();
  });

  test("confidence is shown when the assistant supplied one", () => {
    render(<KnowledgePreview article={article()} confidence={0.42} />);
    expect(screen.getByText(/uncertain/i)).toBeInTheDocument();
    expect(screen.getByText(/\(42%\)/)).toBeInTheDocument();
  });

  test("related documents are listed when there are any", () => {
    render(
      <KnowledgePreview
        article={article()}
        relatedDocuments={[{ id: "d1", label: "Circular PDF", href: "/documents/d1" }]}
      />
    );
    expect(screen.getByRole("link", { name: /circular pdf/i })).toHaveAttribute(
      "href",
      "/documents/d1"
    );
  });
});
