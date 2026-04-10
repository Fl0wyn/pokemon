"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "react-feather";

/** Panel slide + backdrop fade (ms) */
const DOCK_TRANSITION_MS = 160;

export type RightDockProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Extra controls next to the close button (e.g. fullscreen, copy link). */
  headerActions?: ReactNode;
  children: ReactNode;
  /**
   * When true, the panel fills the area to the right of the app sidebar (`md:left-48`, same as Sidebar `w-48`).
   * On small screens the sidebar is hidden, so the overlay stays full width.
   */
  fullScreen?: boolean;
  /** Tailwind classes for max width when `fullScreen` is false (e.g. `max-w-md`, `max-w-2xl`). */
  panelClassName?: string;
};

/**
 * Right-docked overlay panel (Notion-style). Slides in from the right with a short transition.
 */
export default function RightDock({
  open,
  onClose,
  title,
  headerActions,
  children,
  fullScreen = false,
  panelClassName = "max-w-lg md:max-w-xl",
}: RightDockProps) {
  const [rendered, setRendered] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setRendered(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideIn(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setSlideIn(false);
  }, [open]);

  useEffect(() => {
    if (!open && rendered && !slideIn) {
      closeTimerRef.current = setTimeout(() => {
        setRendered(false);
        closeTimerRef.current = null;
      }, DOCK_TRANSITION_MS + 40);
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, rendered, slideIn]);

  useEffect(() => {
    if (!rendered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rendered, onClose]);

  useEffect(() => {
    if (rendered) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [rendered]);

  if (!rendered) return null;

  return (
    <div
      className={[
        "fixed z-[100] flex justify-end",
        fullScreen
          ? "inset-y-0 right-0 left-0 md:left-48"
          : "inset-0",
      ].join(" ")}
      aria-modal="true"
      role="dialog"
      aria-labelledby="right-dock-title"
    >
      <button
        type="button"
        className={[
          "absolute inset-0 border-0 p-0 cursor-pointer bg-[var(--color-brand)]/25 backdrop-blur-[1px] transition-opacity ease-out",
          slideIn ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        style={{ transitionDuration: `${DOCK_TRANSITION_MS}ms` }}
        aria-label="Fermer le panneau"
        onClick={onClose}
      />
      <aside
        className={[
          "relative flex h-full w-full flex-col bg-card shadow-2xl border-l border-border will-change-transform",
          "transition-transform ease-out",
          fullScreen ? "max-w-none" : panelClassName,
          slideIn ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        style={{ transitionDuration: `${DOCK_TRANSITION_MS}ms` }}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div id="right-dock-title" className="min-w-0 flex-1 pt-0.5">
            {title != null ? (
              <div className="text-[15px] font-semibold text-brand leading-snug">{title}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 bg-soft text-muted hover:bg-border hover:text-brand cursor-pointer transition-colors"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      </aside>
    </div>
  );
}
