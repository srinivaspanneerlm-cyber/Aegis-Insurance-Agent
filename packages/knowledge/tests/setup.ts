import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Every test starts from an empty document. Without this a component left
// mounted by one test is found by the next one's query, and the failure shows
// up somewhere unrelated.
afterEach(() => cleanup());
