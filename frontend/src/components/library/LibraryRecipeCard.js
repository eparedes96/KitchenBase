import { useEffect, useRef, useState } from "react";
import { ChevronRight, Clock, Gauge } from "lucide-react";
import { SemaphoreDot, SemaphoreStripe } from "./SemaphoreIndicator";

const DIFFICULTY_LABEL = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

/**
 * Singular/plural Spanish phrasing for the missing-count line.
 */
function missingCountLabel(n) {
  if (n === 1) return "Falta 1 ingrediente";
  return `Faltan ${n} ingredientes`;
}

/**
 * LibraryRecipeCard — a single row in LIB-001.
 *
 * Props:
 *   - row: { recipe_id, recipe_title, status, missing_count, prep_time_minutes,
 *           difficulty, has_pending_ingredients }
 *   - onOpen(row), onLongPressRemove(row)
 */
export function LibraryRecipeCard({ row, onOpen, onLongPressRemove }) {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  const startPress = () => {
    firedRef.current = false;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPressRemove?.(row);
    }, 500);
  };
  const cancelPress = () => {
    setPressing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => cancelPress(), []);

  const handleClick = () => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    onOpen?.(row);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onContextMenu={(e) => {
        e.preventDefault();
        firedRef.current = true;
        onLongPressRemove?.(row);
      }}
      data-testid={`library-card-${row.recipe_id}`}
      data-semaphore={row.status}
      className={`relative flex w-full items-stretch gap-3 overflow-hidden border-b border-line bg-surface pl-4 pr-3 py-4 text-left transition-colors ${
        pressing ? "bg-brand-light" : "hover:bg-surface-secondary"
      }`}
    >
      <SemaphoreStripe status={row.status} />

      <div className="flex min-w-0 flex-1 flex-col gap-1 pl-2">
        <div className="flex items-center gap-2">
          <SemaphoreDot status={row.status} testId={`library-card-dot-${row.recipe_id}`} />
          <span className="truncate font-serif text-title text-ink">
            {row.recipe_title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-ink-secondary">
          {row.prep_time_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
              {`${row.prep_time_minutes} min`}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Gauge className="h-3.5 w-3.5" strokeWidth={1.75} />
            {DIFFICULTY_LABEL[row.difficulty] ?? "—"}
          </span>
          {row.has_pending_ingredients ? (
            <span
              data-testid={`library-card-approx-${row.recipe_id}`}
              className="inline-flex h-5 items-center rounded-full bg-brand-light px-2 text-[10px] font-semibold uppercase tracking-wide text-brand"
              title="Cálculo aproximado: usa ingredientes pendientes de validar"
            >
              Aproximada
            </span>
          ) : null}
        </div>

        {row.status !== "green" && row.missing_count > 0 ? (
          <span
            data-testid={`library-card-missing-${row.recipe_id}`}
            className="text-caption font-medium text-ink"
          >
            {missingCountLabel(row.missing_count)}
          </span>
        ) : null}
      </div>

      <ChevronRight className="my-auto h-4 w-4 flex-shrink-0 text-ink-secondary" />
    </button>
  );
}
