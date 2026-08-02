"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  FileText,
  FolderOpen,
  ImageIcon,
  Paperclip,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import {
  ATTACHMENT_SOURCES,
  type AttachmentSource,
  type AttachmentSourceId,
} from "@/lib/documents/attachmentSources";
import type { DocumentLocale } from "@/types/documents";

interface AttachmentMenuProps {
  onSelect: (source: AttachmentSource) => void;
  disabled?: boolean;
  locale?: DocumentLocale;
  className?: string;
}

const SOURCE_ICON: Record<AttachmentSourceId, LucideIcon> = {
  documents: FileText,
  images: ImageIcon,
  videos: Video,
  camera: Camera,
  browse: FolderOpen,
};

/**
 * The paperclip beside the composer.
 *
 * A real `menu`/`menuitem` widget rather than a styled dropdown: arrow keys
 * move between sources, Escape closes and hands focus back to the trigger, and
 * a click anywhere outside dismisses it. It opens *upward* because the composer
 * sits at the bottom of the viewport.
 */
export function AttachmentMenu({
  onSelect,
  disabled = false,
  locale = "en",
  className,
}: AttachmentMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuId = useId();

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Dismiss on any interaction outside the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Focus follows the active item so the reader's cursor and the highlight
  // never disagree.
  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const openMenu = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(ATTACHMENT_SOURCES.length - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      openMenu(0);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const last = ATTACHMENT_SOURCES.length - 1;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // the advisor page also listens for Escape
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i === last ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i === 0 ? last : i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(last);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const choose = (source: AttachmentSource) => {
    close();
    onSelect(source);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Attach a file"
        onClick={() => (open ? close(false) : openMenu(0))}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl border transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "active:scale-95 touch-manipulation",
          open
            ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
            : "border-white/10 bg-slate-950/65 text-slate-400 hover:border-white/20 hover:bg-white/5 hover:text-white",
        )}
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.18 }} className="block">
          <Paperclip className="h-4 w-4" aria-hidden />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Attachment sources"
            onKeyDown={handleMenuKeyDown}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={cn(
              "absolute bottom-full left-0 z-50 mb-2 w-60 origin-bottom-left overflow-hidden",
              "rounded-2xl border border-white/10 bg-slate-900/85 p-1.5 shadow-2xl backdrop-blur-2xl",
            )}
          >
            {ATTACHMENT_SOURCES.map((source, i) => {
              const Icon = SOURCE_ICON[source.id];
              return (
                <button
                  key={source.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={i === activeIndex ? 0 : -1}
                  onClick={() => choose(source)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none",
                    i === activeIndex ? "bg-white/8" : "hover:bg-white/5",
                  )}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/5">
                    <Icon className="h-3.5 w-3.5 text-slate-300" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold text-slate-100">
                      {localise(source.label, locale)}
                    </span>
                    <span className="block truncate text-[10px] font-medium text-slate-500">
                      {localise(source.hint, locale)}
                    </span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
