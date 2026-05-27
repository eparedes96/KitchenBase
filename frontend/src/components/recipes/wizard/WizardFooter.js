/**
 * WizardFooter — reusable footer with Anterior + Siguiente (or custom Next label).
 */
export function WizardFooter({
  onBack,
  onNext,
  nextLabel = "Siguiente",
  nextDisabled = false,
  busy = false,
  hideBack = false,
  nextTestId = "wizard-next",
  backTestId = "wizard-back",
}) {
  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 border-t border-line bg-surface px-5 py-3">
      <div className="flex items-center gap-3">
        {!hideBack ? (
          <button
            type="button"
            onClick={onBack}
            data-testid={backTestId}
            className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
          >
            Anterior
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || busy}
          data-testid={nextTestId}
          className="flex h-11 flex-[2] items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Guardando…" : nextLabel}
        </button>
      </div>
    </div>
  );
}
