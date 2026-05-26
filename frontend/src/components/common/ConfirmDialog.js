import { createPortal } from "react-dom";
import { useEffect } from "react";

/**
 * ConfirmDialog — minimal modal confirmation prompt.
 *
 * Props:
 *  - open: boolean
 *  - title: string
 *  - description?: string
 *  - confirmLabel?: string (default "Confirmar")
 *  - cancelLabel?: string (default "Cancelar")
 *  - destructive?: boolean (red confirm button)
 *  - onConfirm: () => void
 *  - onCancel: () => void
 *  - testId?: string
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
  testId,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      data-testid={testId}
      className="fixed inset-0 z-[60] flex items-center justify-center px-5"
    >
      <button
        type="button"
        aria-label="Cancelar"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative z-10 w-full max-w-[340px] rounded-lg border border-line bg-surface p-5 animate-fade-in">
        <h3 className="font-serif text-title text-ink">{title}</h3>
        {description ? (
          <p className="mt-1.5 text-caption text-ink-secondary">{description}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            data-testid={testId ? `${testId}-confirm` : undefined}
            className={`flex h-11 w-full items-center justify-center rounded-md text-body font-semibold transition-colors ${
              destructive
                ? "bg-destructive text-white hover:bg-[#B91C1C]"
                : "bg-brand text-white hover:bg-[#B86848]"
            }`}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid={testId ? `${testId}-cancel` : undefined}
            className="flex h-11 w-full items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
