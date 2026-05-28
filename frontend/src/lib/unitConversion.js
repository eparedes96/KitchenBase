import { supabase } from "@/lib/supabaseClient";

/**
 * Tiny helper around the Postgres function `kb_convert_to_base`. Returns the
 * quantity expressed in the ingredient's base unit (g or ml), or null if no
 * conversion path exists.
 *
 * NOTE: this client-side helper does NOT make the frontend the source of
 * truth for unit conversion. It calls the existing server-side function,
 * which is also the function the semáforo engine uses. Keeping a single
 * source of truth avoids drift between recipe-availability decisions and
 * shopping-list / pantry writes.
 */
export async function convertToBase(ingredientId, quantity, unitId) {
  if (!ingredientId || !unitId || quantity == null) return null;
  const { data, error } = await supabase.rpc("kb_convert_to_base", {
    p_ingredient_id: ingredientId,
    p_quantity: quantity,
    p_unit_id: unitId,
  });
  if (error) return null;
  if (data == null) return null;
  return Number(data);
}

/**
 * Builds the list of units the user is allowed to choose from when entering
 * a quantity for a catalog ingredient. Always includes the base unit, then
 * appends any other units that have a row in `unit_conversions` for that
 * ingredient.
 */
export async function loadIngredientUnits(ingredient) {
  if (!ingredient) return [];
  const baseUnitName = ingredient.base_unit === "ml" ? "mililitro" : "gramo";
  const { data: baseRow } = await supabase
    .from("units")
    .select("id, name, symbol")
    .eq("name", baseUnitName)
    .single();
  const list = [];
  if (baseRow) list.push(baseRow);

  const { data: convs } = await supabase
    .from("unit_conversions")
    .select("unit_id, units!inner(id, name, symbol)")
    .eq("ingredient_id", ingredient.id);
  (convs || []).forEach((c) => {
    if (c.units && c.units.id !== baseRow?.id) {
      list.push({ id: c.units.id, name: c.units.name, symbol: c.units.symbol });
    }
  });
  return list;
}
