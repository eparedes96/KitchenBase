/**
 * Recipe nutrition calculator.
 *
 * Inputs:
 *   - servings: integer (>= 1)
 *   - recipeIngredients: array of rows joined with their ingredient + unit.
 *
 * Returns per-serving totals for kcal, protein, carbs, fat, fiber, computed
 * from the catalog ingredients only. Ingredients sourced from
 * `user_ingredients` (quarantined) are excluded because we have no nutrition
 * data for them yet; the caller should treat the result as "partial".
 *
 * Unit handling:
 *   - The ingredient's `base_unit` is either 'g' or 'ml' (per spec).
 *   - The recipe_ingredient stores `quantity` + a `unit_id`.
 *   - If the chosen unit is the base unit (e.g. 'gramo' or 'mililitro'),
 *     conversion factor is 1.
 *   - Otherwise, look up `unit_conversions(ingredient_id, unit_id) -> to_base_factor`.
 *   - quantity_in_base = quantity * factor
 *   - per_100_factor   = quantity_in_base / 100
 *
 * Returns:
 *   { kcal_per_serving, protein_per_serving, carbs_per_serving,
 *     fat_per_serving, fiber_per_serving }
 *
 * `recipeIngredients[i]` shape (what we expect):
 *   {
 *     quantity: number,
 *     unit:      { id, name },       // optional, only if catalog ingredient
 *     unit_to_base_factor?: number,  // pre-resolved by caller (preferred)
 *     ingredient?: {                 // catalog ingredient
 *       base_unit: 'g' | 'ml',
 *       kcal_per_100: number|null,
 *       protein_per_100: number|null,
 *       carbs_per_100: number|null,
 *       fat_per_100: number|null,
 *       fiber_per_100: number|null,
 *     },
 *     user_ingredient_id?: string,   // if present -> exclude from totals
 *   }
 */
export function computeNutritionPerServing(servings, recipeIngredients) {
  const safeServings = Math.max(1, Number(servings) || 1);
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let anyCounted = false;

  for (const ri of recipeIngredients || []) {
    if (ri.user_ingredient_id || !ri.ingredient) continue;
    const qty = Number(ri.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const factor = Number(ri.unit_to_base_factor);
    const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
    const qtyBase = qty * f;
    const per100 = qtyBase / 100;

    const ing = ri.ingredient;
    if (ing.kcal_per_100 != null)
      totals.kcal += per100 * Number(ing.kcal_per_100);
    if (ing.protein_per_100 != null)
      totals.protein += per100 * Number(ing.protein_per_100);
    if (ing.carbs_per_100 != null)
      totals.carbs += per100 * Number(ing.carbs_per_100);
    if (ing.fat_per_100 != null) totals.fat += per100 * Number(ing.fat_per_100);
    if (ing.fiber_per_100 != null)
      totals.fiber += per100 * Number(ing.fiber_per_100);
    anyCounted = true;
  }

  if (!anyCounted) {
    return {
      kcal_per_serving: null,
      protein_per_serving: null,
      carbs_per_serving: null,
      fat_per_serving: null,
      fiber_per_serving: null,
    };
  }

  const round2 = (x) => Math.round((x / safeServings) * 100) / 100;

  return {
    kcal_per_serving: round2(totals.kcal),
    protein_per_serving: round2(totals.protein),
    carbs_per_serving: round2(totals.carbs),
    fat_per_serving: round2(totals.fat),
    fiber_per_serving: round2(totals.fiber),
  };
}
