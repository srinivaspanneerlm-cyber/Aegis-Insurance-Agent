import { cva } from "class-variance-authority";

/**
 * Every variant definition in the system, deliberately outside any client
 * boundary.
 *
 * A `cva` definition is pure data — it maps props to class names and touches no
 * browser API. Keeping these in the same file as the components that use them
 * put them behind `"use client"`, and a server component calling
 * `buttonVariants()` then failed at *prerender* with "attempted to call a
 * client function from the server". That is a build-time error on a page nobody
 * visits often, which is the worst kind: easy to ship, awkward to trace.
 *
 * Splitting them here means a server component can style a link like a button
 * without pulling React state across the wire, and the class strings stay
 * shared with the interactive components rather than being retyped.
 */

/**
 * Sizes map onto the `control` spacing tokens, whose smallest step is 44px:
 * the minimum comfortable touch target, and not negotiable for a product whose
 * users include people with tremor and reduced dexterity.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-control focus-ring font-semibold",
    "duration-fast ease-enter transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    // Held separately from `disabled` because a loading button is not disabled
    // — it is working, and it must keep announcing that to assistive tech.
    "aria-busy:cursor-progress",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg hover:bg-brand-hover",
        secondary: "bg-surface-raised text-content border-line hover:border-line-strong border",
        ghost: "text-content-secondary hover:bg-surface-sunken hover:text-content bg-transparent",
        danger: "bg-danger text-status-fg hover:opacity-90",
        link: "text-brand h-auto bg-transparent p-0 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-control-sm text-body-sm px-3",
        md: "h-control text-body-sm px-5",
        lg: "h-control-lg text-body px-7",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

/**
 * `glass` is a first-class variant rather than a one-off, because glass is the
 * platform's signature material and hand-rolled versions drift immediately. It
 * is also expensive to composite, so one definition means one place to tune it.
 */
export const cardVariants = cva("rounded-card", {
  variants: {
    variant: {
      plain: "bg-surface border-line border",
      raised: "bg-surface border-line shadow-raised border",
      floating: "bg-surface-raised border-line shadow-floating border",
      glass: "glass glass-sheen rounded-panel",
      outline: "border-line border bg-transparent",
    },
    padding: {
      none: "p-0",
      sm: "p-4",
      md: "p-gutter",
      lg: "p-8",
    },
    interactive: {
      true: "duration-base ease-enter focus-ring transition-transform hover:-translate-y-0.5",
      false: "",
    },
  },
  defaultVariants: { variant: "raised", padding: "md", interactive: false },
});
