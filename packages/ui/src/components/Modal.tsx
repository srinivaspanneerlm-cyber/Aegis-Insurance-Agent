"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@aegis/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** `alertdialog` for a decision the customer must answer before continuing. */
  role?: "dialog" | "alertdialog";
  size?: "sm" | "md" | "lg";
  /** Off for a choice that must be made deliberately, not dismissed by accident. */
  dismissOnBackdrop?: boolean;
}

const sizes = {
  sm: "max-w-[400px]",
  md: "max-w-[560px]",
  lg: "max-w-[760px]",
} as const;

/**
 * A modal that behaves for keyboard and screen-reader users.
 *
 * Most of this file is focus management, and that is the point — a `div` with a
 * dark background is easy, but it leaves the keyboard behind the overlay,
 * tabbing through a page the user cannot see. Three things make it real:
 * focus moves in on open, is trapped while open, and returns to whatever opened
 * it on close.
 *
 * Rendered through a portal so no ancestor's `overflow` or stacking context can
 * clip it — the most common reason a modal appears half-cut on mobile.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  role = "dialog",
  size = "md",
  dismissOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const focusablesIn = useCallback((container: HTMLElement): HTMLElement[] => {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
  }, []);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      const [first] = focusablesIn(panel);
      (first ?? panel).focus();
    }

    // The page behind must not scroll under the overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = focusablesIn(panelRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;

      // Wrap at both ends, so focus can never leave the dialog.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Returning focus is what lets someone carry on from where they were
      // rather than restart at the top of the page.
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, focusablesIn]);

  if (!open || typeof document === "undefined") return null;

  const titleId = "aegis-modal-title";
  const descriptionId = "aegis-modal-description";

  return createPortal(
    <div
      className="z-modal fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="animate-fade-in bg-overlay/80 absolute inset-0 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "animate-scale-in rounded-panel relative w-full p-6 sm:p-7",
          "glass glass-sheen shadow-overlay outline-none",
          sizes[size]
        )}
      >
        <h2 id={titleId} className="text-h3 text-content font-bold">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="text-body-sm text-content-muted mt-2">
            {description}
          </p>
        ) : null}

        {children ? <div className="mt-5">{children}</div> : null}
        {footer ? <div className="mt-7 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
