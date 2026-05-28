import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

/**
 * Returns the design-token color class for a given semaphore status.
 * Tokens come from tailwind.config.js (semaphore.green/yellow/orange).
 */
export const SEMAPHORE_COLOR = {
  green:  { bg: "bg-semaphore-green",  text: "text-semaphore-green",  border: "border-semaphore-green"  },
  yellow: { bg: "bg-semaphore-yellow", text: "text-semaphore-yellow", border: "border-semaphore-yellow" },
  orange: { bg: "bg-semaphore-orange", text: "text-semaphore-orange", border: "border-semaphore-orange" },
};

export const SEMAPHORE_LABEL = {
  green:  "Puedes cocinar esto ahora",
  yellow: "Solo te faltan ingredientes secundarios",
  orange: "Te falta algún ingrediente clave",
};

export const SEMAPHORE_ICON = {
  green:  CheckCircle2,
  yellow: AlertCircle,
  orange: AlertTriangle,
};

/**
 * SemaphoreDot — small circular indicator (used on list cards).
 * Renders an accessible visual dot using the semaphore tokens.
 */
export function SemaphoreDot({ status, size = "md", testId }) {
  const tokens = SEMAPHORE_COLOR[status] || SEMAPHORE_COLOR.orange;
  const px = size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  return (
    <span
      aria-label={`Semáforo ${status}`}
      data-testid={testId}
      data-semaphore={status}
      className={`inline-block flex-shrink-0 rounded-full ${tokens.bg} ${px}`}
    />
  );
}

/**
 * SemaphoreStripe — a left side stripe on a list card.
 */
export function SemaphoreStripe({ status }) {
  const tokens = SEMAPHORE_COLOR[status] || SEMAPHORE_COLOR.orange;
  return (
    <span
      aria-hidden="true"
      data-semaphore={status}
      className={`absolute left-0 top-0 h-full w-1 ${tokens.bg}`}
    />
  );
}

/**
 * SemaphoreBanner — large block used on LIB-002 detail. Includes an icon
 * + label + Spanish explanatory text.
 */
export function SemaphoreBanner({ status, approximate }) {
  const tokens = SEMAPHORE_COLOR[status] || SEMAPHORE_COLOR.orange;
  const Icon = SEMAPHORE_ICON[status] || AlertTriangle;
  const label = SEMAPHORE_LABEL[status] || "";
  return (
    <section
      data-testid="semaphore-banner"
      data-semaphore={status}
      className={`flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 ${tokens.border}`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tokens.bg}`}
      >
        <Icon className="h-4 w-4 text-white" strokeWidth={2.25} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p data-testid="semaphore-banner-label" className="text-body font-semibold text-ink">
          {label}
        </p>
        {approximate ? (
          <p
            data-testid="semaphore-banner-approximate"
            className="text-caption text-ink-secondary"
          >
            Cálculo aproximado — esta receta usa ingredientes pendientes de validar.
          </p>
        ) : null}
      </div>
    </section>
  );
}
