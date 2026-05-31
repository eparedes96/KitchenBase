import { WizardFooter } from "./WizardFooter";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Fácil" },
  { value: "medium", label: "Media" },
  { value: "hard", label: "Difícil" },
];

export function Step2Difficulty({
  difficulty,
  setDifficulty,
  prepTime,
  setPrepTime,
  errorMsg,
  busy,
  onBack,
  onNext,
}) {
  const time = parseInt(prepTime, 10);
  const valid = !!difficulty && Number.isFinite(time) && time > 0;
  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col gap-4 px-5 py-6">
        <p className="text-caption uppercase tracking-[0.18em] text-ink-secondary">
          2. Dificultad y tiempo
        </p>
        <h1 className="font-serif text-display-lg text-ink">
          ¿Cómo de complicado es?
        </h1>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-caption font-medium text-ink-secondary">
            Dificultad
          </legend>
          <div
            className="flex w-full rounded-md border border-line bg-surface p-1"
            data-testid="wizard-step2-difficulty"
          >
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                data-testid={`wizard-step2-difficulty-${opt.value}`}
                className={`flex h-9 flex-1 items-center justify-center rounded-sm text-caption font-medium transition-colors ${
                  difficulty === opt.value
                    ? "bg-brand text-white"
                    : "text-ink-secondary hover:text-brand"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-medium text-ink-secondary">
            Tiempo estimado
          </span>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              data-testid="wizard-step2-time"
              placeholder="30"
              className="h-12 w-full rounded-md border border-line bg-surface pl-3 pr-12 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-caption text-ink-secondary">
              min
            </span>
          </div>
        </label>

        {errorMsg ? (
          <p
            role="alert"
            data-testid="wizard-step2-error"
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
        nextDisabled={!valid}
        nextTestId="wizard-step2-next"
        backTestId="wizard-step2-back"
      />
    </div>
  );
}
