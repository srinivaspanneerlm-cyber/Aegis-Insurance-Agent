import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind class names, resolving conflicts in favour of the last one.
 *
 * Without the merge step, `cn("p-2", "p-4")` emits both and the winner is
 * decided by stylesheet order — which means a component's `className` override
 * works or does not depending on how Tailwind happened to sort that build. Every
 * component in `@aegis/ui` accepts a `className`, so this is what makes that
 * promise true.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
