"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@aegis/utils";
import { buttonVariants } from "../variants";
import { Spinner } from "./Spinner";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner and marks the control busy, without disabling it. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    loading = false,
    leadingIcon,
    trailingIcon,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      // Defaults to "button". A button inside a form with no type submits it,
      // which is a real and very confusing bug to chase.
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled === true || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <Spinner size="sm" aria-hidden="true" /> : leadingIcon}
      {children}
      {loading ? null : trailingIcon}
    </button>
  );
});
