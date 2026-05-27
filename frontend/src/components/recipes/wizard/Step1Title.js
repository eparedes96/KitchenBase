import { WizardFooter } from "./WizardFooter";

export function Step1Title({
  title,
  setTitle,
  errorMsg,
  busy,
  onNext,
}) {
  const trimmed = (title || "").trim();
  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col gap-4 px-5 py-6">
        <p className="text-caption uppercase tracking-[0.18em] text-ink-secondary">
          1. Empecemos
        </p>
        <h1 className="font-serif text-display-lg text-ink">
          Nombre del plato
        </h1>
        <label className="mt-2 flex flex-col gap-1.5">
          <span className="text-caption font-medium text-ink-secondary">
            Título
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="wizard-step1-title"
            placeholder="Ej. Pollo al curry con arroz"
            autoFocus
            className="h-12 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
          />
          <span className="text-caption text-ink-secondary">
            Dale un nombre que reconozcas de un vistazo.
          </span>
        </label>
        {errorMsg ? (
          <p
            role="alert"
            data-testid="wizard-step1-error"
            className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
          >
            {errorMsg}
          </p>
        ) : null}
      </section>
      <WizardFooter
        hideBack
        onNext={onNext}
        busy={busy}
        nextDisabled={trimmed.length === 0}
        nextTestId="wizard-step1-next"
      />
    </div>
  );
}
