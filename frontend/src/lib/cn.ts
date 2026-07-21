import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with Tailwind conflict resolution. `clsx` handles
 * conditional/array/object inputs; `twMerge` ensures a later utility wins over
 * an earlier conflicting one (e.g. a caller's `px-8` overrides a default
 * `px-4`), which is what makes the `className` prop on our primitives safe.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
