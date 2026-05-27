import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Difficulty label mapping for UI (Spanish).
 */
const DIFFICULTY_LABEL = {
  easy:   "Fácil",
  medium: "Media",
  hard:   "Difícil",
};

/**
 * RecipeListCard — single row used in REC-001.
 *
 * Props:
 *   - recipe: { id, title, is_draft, draft_step, status, difficulty,
 *              prep_time_minutes, servings }
 *   - onOpen(recipe)
 *   - onLongPressDelete(recipe)
 */
export function RecipeListCard({ recipe, onOpen, onLongPressDelete }) {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  const startPress = () => {
    firedRef.current = false;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPressDelete?.(recipe);
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
    onOpen?.(recipe);
  };

  const subtitle = recipe.is_draft
    ? `En borrador · paso ${recipe.draft_step ?? 1} de 5`
    : [
        recipe.prep_time_minutes ? `${recipe.prep_time_minutes} min` : null,
        DIFFICULTY_LABEL[recipe.difficulty] ?? null,
        recipe.servings ? `${recipe.servings} raciones` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  const pill = recipe.is_draft
    ? { label: "Borrador", className: "bg-brand-light text-brand" }
    : recipe.status === "proposed"
    ? { label: "Propuesta", className: "border border-line text-ink-secondary" }
    : { label: "Privada",  className: "border border-line text-ink-secondary" };

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
        onLongPressDelete?.(recipe);
      }}
      data-testid={`recipe-card-${recipe.id}`}
      className={`flex w-full items-center gap-3 border-b border-line bg-surface px-4 py-4 text-left transition-colors ${
        pressing ? "bg-brand-light" : "hover:bg-surface-secondary"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-body font-medium text-ink">
          {recipe.title}
        </span>
        <span className="truncate text-caption text-ink-secondary">
          {subtitle || " "}
        </span>
      </div>
      <span
        className={`inline-flex h-6 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide ${pill.className}`}
      >
        {pill.label}
      </span>
      <ChevronRight className="h-4 w-4 text-ink-secondary" />
    </button>
  );
}
