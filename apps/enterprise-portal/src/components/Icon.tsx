import type { SVGProps } from "react";

/**
 * The icon set, as inline SVG.
 *
 * No icon library, and that is a decision rather than an omission. A package
 * would add a dependency and a bundle to every page for perhaps twenty glyphs,
 * and this is the one application that has to be quick on a village 3G
 * connection — the workspace layout says so in as many words. Inline paths cost
 * nothing to fetch and are tree-shaken to only the ones a page uses.
 *
 * Every icon is `aria-hidden`: they sit beside text that already says the same
 * thing, and announcing them twice makes a screen reader worse, not better. An
 * icon that ever stands alone must be given a label at the call site.
 */

export type IconName = keyof typeof PATHS;

const PATHS = {
  shield: "M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3Z",
  car: "M5 17h14M6.5 17v2h-3v-2M20.5 17v2h-3v-2M4 13l1.4-4.2A2 2 0 0 1 7.3 7.4h9.4a2 2 0 0 1 1.9 1.4L20 13M4 13h16v4H4v-4Zm3 2h.01M17 15h.01",
  heart: "M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7c0 4.9-7 9.3-7 9.3Z",
  home: "M4 11 12 4l8 7M6 10v9h12v-9M10 19v-5h4v5",
  plane: "M10 20l1.5-5.5L4 11l1-2 7 2.5L18 4l2 1-4.5 7.5L18 20l-2 1-3.5-6.5L10 20Z",
  briefcase: "M4 8h16v11H4V8Zm5 0V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 13h16",
  users:
    "M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a5 5 0 0 1 10 0M16 11a3 3 0 1 0 0-6M15 20a5 5 0 0 1 6-4.6",
  building:
    "M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 21V10h3a2 2 0 0 1 2 2v9M3 21h18M8 7h2M8 11h2M8 15h2",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  refresh: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  lock: "M6 11h12v9H6v-9Zm3 0V8a3 3 0 0 1 6 0v3M12 15v2",
  check: "M5 13l4 4L19 7",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  mail: "M4 6h16v12H4V6Zm0 1 8 6 8-6",
  phone:
    "M6 3h3l2 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4 5.2 2 2 0 0 1 6 3Z",
  pin: "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3.5 2",
  book: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm12 3h2v13H8",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5.5-5.5 2 2-5.5 5.5-2Z",
  eye: "M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  scales: "M12 4v16M7 20h10M5 8h14M5 8 3 14h4L5 8Zm14 0-2 6h4l-2-6Z",
  translate: "M4 6h9M8 4v2c0 4-1.6 7-4 9M7 11c1.2 2.4 3 4.2 5 5M13 20l4-9 4 9M14.5 17h5",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  layers: "M12 3 3 8l9 5 9-5-9-5Zm-9 8 9 5 9-5M3 16l9 5 9-5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  bank: "M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18",
  stethoscope:
    "M6 4v5a4 4 0 0 0 8 0V4M6 4H4m2 0h1m7 0h2m-2 0h-1m-4 9v2a5 5 0 0 0 10 0v-2m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  landmark: "M4 9 12 4l8 5M6 9v9M10 9v9M14 9v9M18 9v9M3 21h18M3 9h18",
} as const;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Pixel size for both dimensions. */
  size?: number;
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
