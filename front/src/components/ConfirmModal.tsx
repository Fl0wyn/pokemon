"use client";

import type { ReactNode } from "react";
import { useEffect, useId } from "react";

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  /** Disables closing and secondary actions while the confirm action runs */
  pending?: boolean;
  /** Label on the confirm button while `pending` (defaults to a generic “in progress” string) */
  pendingConfirmLabel?: string;
};

export default function ConfirmModal({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel = "Annuler",
  onConfirm,
  pending = false,
  pendingConfirmLabel = "En cours…",
}: ConfirmModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pending]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 border-0 bg-black/45 p-0 cursor-pointer"
        aria-label="Fermer la boîte de dialogue"
        disabled={pending}
        onClick={() => {
          if (!pending) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 id={titleId} className="m-0 text-base font-bold text-brand">
          {title}
        </h2>
        {children ? <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!pending) onClose();
            }}
            className={[
              "rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
              pending
                ? "cursor-not-allowed border-border bg-soft text-muted opacity-60"
                : "cursor-pointer border-border bg-card text-brand hover:bg-soft",
            ].join(" ")}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onConfirm()}
            className={[
              "rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors",
              pending
                ? "cursor-not-allowed border-border bg-soft text-muted opacity-60"
                : "cursor-pointer border-[var(--color-brand)] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]",
            ].join(" ")}
          >
            {pending ? pendingConfirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
