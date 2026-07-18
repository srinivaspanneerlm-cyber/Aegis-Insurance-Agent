import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  AmbientBackground,
  ambientVariants,
  type AmbientVariant,
} from "./AmbientBackground";

// Control the theme returned to the component under test.
const themeRef = { current: "dark" as "dark" | "light" };
vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: themeRef.current }),
}));

afterEach(cleanup);

const variants: AmbientVariant[] = ["home", "about", "contact"];

describe("AmbientBackground", () => {
  for (const variant of variants) {
    for (const theme of ["dark", "light"] as const) {
      it(`renders the ${theme} ${variant} layer verbatim`, () => {
        themeRef.current = theme;
        const { container } = render(<AmbientBackground variant={variant} />);
        const divs = Array.from(container.querySelectorAll("div"));
        const layer = ambientVariants[variant][theme];

        // A full-bleed radial div first, then one div per configured blob.
        expect(divs).toHaveLength(1 + layer.blobs.length);
        expect(divs[0].className).toBe(
          `absolute top-0 left-0 w-full h-full ${layer.radial}`,
        );
        layer.blobs.forEach((blob, i) => {
          expect(divs[i + 1].className).toBe(blob);
        });
      });
    }
  }

  it("swaps blob count and tint between dark and light", () => {
    // Dark variants carry two blobs; light carries one — the original behaviour.
    expect(ambientVariants.home.dark.blobs).toHaveLength(2);
    expect(ambientVariants.home.light.blobs).toHaveLength(1);
    expect(ambientVariants.contact.dark.radial).toContain("168,85,247");
  });
});
