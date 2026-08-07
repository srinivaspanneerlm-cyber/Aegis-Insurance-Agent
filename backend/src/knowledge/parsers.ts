/**
 * Turning an internal file into text a knowledge article can be built from.
 *
 * Only plain text and markdown are implemented. PDF and DOCX are declared as
 * supported formats nowhere — `supports` lists what actually works, and
 * `parse` refuses anything else with a reason naming what is missing.
 *
 * The temptation here is a PDF parser that returns whatever bytes it can
 * salvage. That produces an article full of ligature artefacts and page
 * furniture which somebody approves without reading closely, and the platform
 * then quotes to a customer. Refusing is better than a bad extraction that
 * looks like a good one.
 *
 * Deliberately separate from the Sprint 8 document pipeline: that decides
 * whether a *customer's* document is genuine and treats it as untrusted input.
 * This reads a compliance officer's own circular. Same shape, entirely
 * different trust model, and sharing an implementation would mean weakening one
 * of them.
 */
import type { DocumentParserInterface } from "./contracts";

const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/x-markdown", ""]);

/** Splits markdown or plain text on headings, so a long circular becomes parts. */
function sectionise(text: string): Array<{ heading: string; body: string }> {
  const lines = text.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let heading = "";
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (heading || body) sections.push({ heading: heading || "Introduction", body });
    buffer = [];
  };

  for (const line of lines) {
    // Markdown headings, and the numbered-clause style regulators actually use
    // ("3.2 Free look period"), which a markdown-only splitter would miss
    // entirely on the documents this platform cares most about.
    const markdown = /^#{1,3}\s+(.*)$/.exec(line);
    const numbered = /^(\d+(?:\.\d+)*)\s+([A-Z][^.]{3,80})$/.exec(line.trim());

    if (markdown) {
      flush();
      heading = markdown[1]?.trim() ?? "";
    } else if (numbered) {
      flush();
      heading = `${numbered[1]} ${numbered[2]}`.trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections.filter((s) => s.body.length > 0);
}

export const textParser: DocumentParserInterface = {
  available: true,
  supports: ["text/plain", "text/markdown"],

  async parse(input) {
    const mime = input.mimeType ?? "";
    const isText = TEXT_TYPES.has(mime) || /\.(txt|md|markdown)$/i.test(input.filename);

    if (!isText) {
      return {
        ok: false,
        text: null,
        title: null,
        sections: [],
        reason: `No parser is configured for ${mime || "that file type"}. Only plain text and markdown are read. A PDF or DOCX parser must be registered before those can be turned into knowledge — a partial extraction that looks complete is worse than none, because somebody approves it.`,
      };
    }

    const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : "");
    if (!text.trim()) {
      return { ok: false, text: null, title: null, sections: [], reason: "That file is empty." };
    }

    const sections = sectionise(text);
    // The title is the first heading, or the filename with its extension off —
    // never invented.
    const firstHeading = sections.find((s) => s.heading !== "Introduction")?.heading ?? null;
    const title = firstHeading ?? input.filename.replace(/\.[^.]+$/, "");

    return { ok: true, text, title, sections };
  },
};

let parserImpl: DocumentParserInterface = textParser;

export const documentParser = (): DocumentParserInterface => parserImpl;

export function registerDocumentParser(parser: DocumentParserInterface): void {
  parserImpl = parser;
}

export function resetDocumentParser(): void {
  parserImpl = textParser;
}
