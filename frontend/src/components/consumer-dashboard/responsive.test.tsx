/**
 * Narrow-screen guards on the surfaces Phase 2 rewired.
 *
 * These assert the *guards*, not the layout. jsdom has no layout engine — it
 * reports every element as zero by zero — so a test claiming to measure
 * overflow there would pass whatever the CSS said, which is worse than no test.
 * No headless browser is installed in this repository, so a real measurement is
 * not available; that is recorded as a limitation rather than papered over.
 *
 * What is worth pinning is the specific decision each guard encodes: which text
 * may be clipped and which may not. A filename truncating is fine — it is
 * recognisable from its first characters. A rejection reason truncating is not:
 * it is the sentence telling somebody what to fix, and half of it is no use.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClaimsViewport } from "./ClaimsViewport";
import { DocumentsViewport } from "./DocumentsViewport";
import type { DashboardDoc } from "./types";
import type { TimelineEntry } from "@/services/api";

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark" }) }));

const LONG_REASON =
  "The registration number on the certificate is not legible in this photograph. " +
  "Please photograph it again in daylight, with the whole document flat in frame.";

const LONG_SUMMARY =
  "CLAIM opened — Windscreen damage on the Chennai–Bengaluru highway, reference " +
  "CLM-2026-000123, assessor visit scheduled";

describe("document rows on a narrow screen", () => {
  const doc: DashboardDoc = {
    id: "d1",
    name: "a-very-long-registration-certificate-filename-scan.pdf",
    size: "1.2 MB",
    type: "rc_book",
    date: "7 Aug 2026",
    status: "REJECTED",
    rejectionReason: LONG_REASON,
  };

  const props = { uploadingDoc: false, uploadSuccess: "", handleFileUpload: vi.fn() };

  it("shows the whole rejection reason rather than clipping it", () => {
    render(<DocumentsViewport uploadedFiles={[doc]} {...props} />);

    const reason = screen.getByText(new RegExp(LONG_REASON.slice(0, 40)));
    // `truncate` would cut this to one line; the reason must wrap instead.
    expect(reason.className).toMatch(/break-words/);
    expect(reason.className).not.toMatch(/\btruncate\b/);
  });

  it("still truncates the filename, which is recognisable from its start", () => {
    render(<DocumentsViewport uploadedFiles={[doc]} {...props} />);
    expect(screen.getByText(doc.name).className).toMatch(/truncate/);
  });

  it("lets the row wrap rather than forcing it wider than the screen", () => {
    // Selected from the filename outward: `.rounded-2xl.flex` also matches the
    // upload dropzone, so the first assertion was testing the wrong element.
    render(<DocumentsViewport uploadedFiles={[doc]} {...props} />);
    const row = screen.getByText(doc.name).closest(".rounded-2xl");
    expect(row?.className).toMatch(/flex-wrap/);
  });
});

describe("claim rows on a narrow screen", () => {
  const claim: TimelineEntry = {
    at: new Date().toISOString(),
    source: "work",
    kind: "OPENED",
    summary: LONG_SUMMARY,
    actorId: null,
    actorKind: "SYSTEM",
    subjectKind: "workItem",
    subjectId: "wi-1",
    deepLink: "/work/wi-1",
  };

  it("wraps a long case summary", () => {
    render(<ClaimsViewport claims={[claim]} loading={false} />);
    expect(screen.getByText(LONG_SUMMARY).className).toMatch(/break-words/);
  });

  it("wraps the status and date row rather than overflowing", () => {
    const { container } = render(<ClaimsViewport claims={[claim]} loading={false} />);
    const header = container.querySelector(".flex.flex-wrap");
    expect(header).not.toBeNull();
  });
});
