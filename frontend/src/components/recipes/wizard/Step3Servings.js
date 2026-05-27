import { Minus, Plus } from "lucide-react";
import { WizardFooter } from "./WizardFooter";

export function Step3Servings({
  servings,
  setServings,
  errorMsg,
  busy,
  onBack,
  onNext,
}) {
  const value = Number.isFinite(servings) && servings > 0 ? servings : 4;
  const inc = () => setServings(Math.min(20, value + 1));
  const dec = () => setServings(Math.max(1, value - 1));

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col gap-4 px-5 py-6">
        <p className="text-caption uppercase tracking-[0.18em] text-ink-secondary">
          3. Raciones
        </p>
        <h1 className="font-serif text-display-lg text-ink">
          ¿Para cuántas personas?
        </h1>

        <div className="flex flex-col items-center gap-2">
          <span className="text-caption font-medium text-ink-secondary">
            Número de raciones
          </span>
          <div
            className="flex items-center gap-4 rounded-lg border border-line bg-surface px-3 py-3"
            data-testid="wizard-step3-stepper"
          >
            <button
              type="button"
              onClick={dec}
              aria-label="Quitar una ración"
              data-testid="wizard-step3-dec"
              disabled={value <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-brand-light hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span
              data-testid="wizard-step3-value"
              className="font-serif text-display text-ink min-w-[3ch] text-center"
            >
              {value}
            </span>
            <button
              type="button"
              onClick={inc}
              aria-label="Añadir una ración"
              data-testid="wizard-step3-inc"
              disabled={value >= 20}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-brand-light hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="text-center text-caption text-ink-secondary">
          Las cantidades de ingredientes que añadirás se ajustan a este número.
        </p>

        {errorMsg ? (
          <p
            role="alert"
            data-testid="wizard-step3-error"
            className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
          >
            {errorMsg}
          </p>
        ) : null}
      </section>
      <WizardFooter
        onBack={onBack}
        onNext={onNext}
        busy={busy}
        nextDisabled={!Number.isFinite(value) || value < 1}
        nextTestId="wizard-step3-next"
        backTestId="wizard-step3-back"
      />
    </div>
  );
}
