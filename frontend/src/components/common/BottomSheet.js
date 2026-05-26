import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * BottomSheet — mobile-first sheet that slides in from the bottom.
 * On wide viewports the MobileFrame already constrains content to ~430px,
 * so a single layout works on phone and desktop preview.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - title: ReactNode (rendered in Playfair Display)
 *   - subtitle?: ReactNode (rendered in ink-secondary)
 *   - children: body
 *   - footer?: ReactNode (sticky bottom area for action buttons)
 *   - testId?: string
 */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  testId,
}) {
  const sheetRef = useRef(null);

  // Lock body scroll while the sheet is open
  useEffect(() => {
    if (!open) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-testid={testId}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-fade-in"
      />

      {/* Sheet — constrained to the same mobile width as the app */}
      <div
        ref={sheetRef}
        className="relative z-10 flex w-full max-w-mobile flex-col rounded-t-lg border border-line bg-surface"
        style={{
          maxHeight: "min(90dvh, 720px)",
          paddingBottom: "env(safe-area-inset-bottom)",
          animation: "sheet-up 220ms ease-out",
        }}
      >
        {/* Grabber */}
        <div className="flex items-center justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3">
          <div className="flex flex-1 flex-col gap-1">
            <h2 className="font-serif text-display leading-tight text-ink">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-caption text-ink-secondary">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            data-testid={testId ? `${testId}-close` : undefined}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-brand-light hover:text-brand"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="h-[0.5px] w-full bg-line" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        {footer ? (
          <div className="border-t border-line bg-surface px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes sheet-up {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
