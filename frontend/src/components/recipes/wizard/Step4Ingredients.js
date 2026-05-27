import { useState } from "react";
import { Plus, X, KeyRound } from "lucide-react";
import { WizardFooter } from "./WizardFooter";
import { AddRecipeIngredientModal } from "./AddRecipeIngredientModal";
import { formatQuantity } from "@/lib/textUtils";

/**
 * Step 4 — Ingredients.
 *
 * `ingredients` is a list of objects in component state already mirrored
 * to recipe_ingredients in the database via the props handlers.
 *
 * Each ingredient row shape:
 *   {
 *     id?: string (recipe_ingredients.id once persisted),
 *     ingredient_id?: string,
 *     user_ingredient_id?: string,
 *     ingredient_name: string,
 *     category_name?: string,
 *     ingredient_base_unit: 'g' | 'ml',
 *     quantity: number,
 *     unit_id: string,
 *     unit_symbol: string,
 *     unit_to_base_factor: number,
 *     is_key: boolean,
 *   }
 */
export function Step4Ingredients({
  ingredients,
  onAddIngredient,
  onToggleKey,
  onRemoveIngredient,
  errorMsg,
  busy,
  onBack,
  onNext,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const hasAtLeastOne = (ingredients || []).length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col gap-4 px-5 py-6">
        <p className="text-caption uppercase tracking-[0.18em] text-ink-secondary">
          4. Ingredientes
        </p>
        <h1 className="font-serif text-display-lg text-ink">
          Ingredientes
        </h1>

        {hasAtLeastOne ? (
          <ul
            data-testid="wizard-step4-list"
            className="flex flex-col rounded-lg border border-line bg-surface"
          >
            {ingredients.map((ing, idx) => (
              <li
                key={ing.id ?? `${ing.ingredient_id ?? ing.user_ingredient_id}-${idx}`}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                data-testid={`wizard-step4-row-${idx}`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
                  <KeyRound className={`h-4 w-4 ${ing.is_key ? "" : "opacity-30"}`} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body text-ink">
                    {ing.ingredient_name}
                    {ing.user_ingredient_id ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-secondary">
                        (pendiente)
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-caption text-ink-secondary">
                    {formatQuantity(ing.quantity)} {ing.unit_symbol}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ing.is_key}
                  onClick={() => onToggleKey?.(ing, !ing.is_key)}
                  data-testid={`wizard-step4-toggle-key-${idx}`}
                  title={ing.is_key ? "Ingrediente clave" : "Marcar como clave"}
                  className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                    ing.is_key ? "bg-brand" : "bg-line"
                  }`}
                >
                  <span
                    className={`h-5 w-5 transform rounded-full bg-white transition-transform ${
                      ing.is_key ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveIngredient?.(ing)}
                  aria-label={`Quitar ${ing.ingredient_name}`}
                  data-testid={`wizard-step4-remove-${idx}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-secondary hover:bg-brand-light hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-6 text-center">
            <p className="text-caption text-ink-secondary">
              Aún no has añadido ingredientes.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          data-testid="wizard-step4-add"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-body text-ink transition-colors hover:bg-brand-light hover:text-brand"
        >
          <Plus className="h-4 w-4" />
          Añadir ingrediente
        </button>

        {errorMsg ? (
          <p role="alert" data-testid="wizard-step4-error" className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink">
            {errorMsg}
          </p>
        ) : null}
      </section>

      <WizardFooter
        onBack={onBack}
        onNext={onNext}
        busy={busy}
        nextDisabled={!hasAtLeastOne}
        nextTestId="wizard-step4-next"
        backTestId="wizard-step4-back"
      />

      <AddRecipeIngredientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={(payload) => onAddIngredient?.(payload)}
      />
    </div>
  );
}
