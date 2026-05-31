import { Plus, X } from "lucide-react";
import { WizardFooter } from "./WizardFooter";

/**
 * Step 5 — Pasos de elaboración.
 *
 * `steps` is a list of strings (instructions). Held in component state until
 * the user presses "Guardar receta".
 */
export function Step5Steps({
  steps,
  setSteps,
  errorMsg,
  busy,
  onBack,
  onSave,
}) {
  const list = steps && steps.length > 0 ? steps : [""];
  const hasNonEmpty = list.some((s) => (s || "").trim().length > 0);

  const updateAt = (i, value) => {
    const next = [...list];
    next[i] = value;
    setSteps(next);
  };
  const addStep = () => setSteps([...list, ""]);
  const removeAt = (i) => {
    const next = list.filter((_, idx) => idx !== i);
    setSteps(next.length > 0 ? next : [""]);
  };

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col gap-4 px-5 py-6">
        <p className="text-caption uppercase tracking-[0.18em] text-ink-secondary">
          5. Pasos de elaboración
        </p>
        <h1 className="font-serif text-display-lg text-ink">
          Pasos de elaboración
        </h1>

        <ul className="flex flex-col gap-3" data-testid="wizard-step5-list">
          {list.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-3 w-7 flex-shrink-0 text-right font-serif text-title text-ink-secondary">
                {i + 1}.
              </span>
              <textarea
                value={s}
                onChange={(e) => updateAt(i, e.target.value)}
                placeholder="Describe el paso…"
                rows={3}
                data-testid={`wizard-step5-textarea-${i}`}
                className="min-h-[80px] flex-1 rounded-md border border-line bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Quitar paso ${i + 1}`}
                data-testid={`wizard-step5-remove-${i}`}
                disabled={list.length === 1}
                className="mt-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-brand-light hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addStep}
          data-testid="wizard-step5-add"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-body text-ink transition-colors hover:bg-brand-light hover:text-brand"
        >
          <Plus className="h-4 w-4" />
          Añadir paso
        </button>

        {errorMsg ? (
          <p
            role="alert"
            data-testid="wizard-step5-error"
            className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
          >
            {errorMsg}
          </p>
        ) : null}
      </section>

      <WizardFooter
        onBack={onBack}
        onNext={onSave}
        busy={busy}
        nextDisabled={!hasNonEmpty}
        nextLabel="Guardar receta"
        nextTestId="wizard-step5-save"
        backTestId="wizard-step5-back"
      />
    </div>
  );
}
