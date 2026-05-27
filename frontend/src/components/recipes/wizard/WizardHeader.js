import { X } from "lucide-react";

/**
 * Header that replaces TopBar inside the recipe wizard (REC-002).
 *
 * Props:
 *   - currentStep: 1..5
 *   - totalSteps: number
 *   - onClose: () => void
 */
export function WizardHeader({ currentStep, totalSteps, onClose }) {
  const pct = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
  return (
    <header
      data-testid="wizard-header"
      className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-3"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar asistente"
        data-testid="wizard-close"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-brand-light hover:text-brand"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex flex-1 flex-col gap-1.5">
        <span
          data-testid="wizard-progress-label"
          className="text-center text-caption font-medium text-ink-secondary"
        >
          Paso {currentStep} de {totalSteps}
        </span>
        <div className="h-1 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${pct}%` }}
            data-testid="wizard-progress-bar"
          />
        </div>
      </div>
      <div className="w-9" aria-hidden="true" />
    </header>
  );
}
