import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { convertToBase, loadIngredientUnits } from "@/lib/unitConversion";
import { track } from "@/lib/analytics";
import { formatQuantity } from "@/lib/textUtils";

/**
 * MOD-004 — Confirmar Cantidad Comprada.
 *
 * Opened from SHO-001 by tapping the checkbox of an UNCHECKED item.
 * Implements decision D-010 (the shopping checkbox is not a silent toggle):
 *  - The user confirms the exact bought quantity here.
 *  - On confirm, two writes happen atomically (from the user's perspective):
 *      (a) ADD that quantity to the user's pantry (creating the pantry row
 *          if missing, or incrementing the existing row).
 *      (b) Mark the shopping list item as bought (is_checked = true,
 *          bought_quantity = entered, checked_at = now()).
 *  - Quantities entered in non-base units are converted to the ingredient's
 *    base unit BEFORE any persistence (using kb_convert_to_base).
 *
 * Props:
 *  - open: boolean
 *  - item: { id, ingredient_id, name, base_unit, needed_quantity } | null
 *  - onClose(): closes without changes.
 *  - onSaved(updatedItem): notify parent of the successful confirm.
 */
export function ConfirmBoughtModal({ open, item, onClose, onSaved }) {
  const { user } = useAuth();

  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [units, setUnits] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Whenever the sheet opens for a new item, reset the form to the
  // ingredient's BASE unit pre-filled with the needed quantity.
  useEffect(() => {
    if (!open || !item) return;
    setErrorMsg("");
    setSubmitting(false);
    (async () => {
      const ing = { id: item.ingredient_id, base_unit: item.base_unit };
      const ulist = await loadIngredientUnits(ing);
      setUnits(ulist);
      const base = ulist.find(
        (u) =>
          (u.symbol === "g" && item.base_unit === "g") ||
          (u.symbol === "ml" && item.base_unit === "ml"),
      );
      setUnitId(base?.id || ulist[0]?.id || "");
      setQuantity(formatQuantity(item.needed_quantity).replace(",", "."));
    })();
  }, [open, item]);

  const parsedQuantity = useMemo(() => {
    const n = parseFloat(String(quantity).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [quantity]);

  const canSave = parsedQuantity != null && !!unitId && !submitting;

  const handleSave = async () => {
    if (!item || !user || !parsedQuantity || !unitId) return;
    setSubmitting(true);
    setErrorMsg("");

    // 1) Convert the entered quantity to the ingredient's base unit.
    const boughtBase = await convertToBase(
      item.ingredient_id,
      parsedQuantity,
      unitId,
    );
    if (boughtBase == null) {
      setSubmitting(false);
      setErrorMsg("No se pudo convertir la unidad. Prueba con la unidad base.");
      return;
    }

    // 2) Resolve the base unit row (its id is what we'll write into pantry_items).
    const baseUnitName = item.base_unit === "ml" ? "mililitro" : "gramo";
    const { data: baseUnitRow, error: baseUnitErr } = await supabase
      .from("units")
      .select("id")
      .eq("name", baseUnitName)
      .single();
    if (baseUnitErr || !baseUnitRow) {
      setSubmitting(false);
      setErrorMsg("No se pudo localizar la unidad base. Inténtalo más tarde.");
      return;
    }

    // 3) ADD to pantry. Either increment an existing catalog row or create one.
    //    We always write the *base* unit so further increments are commutative.
    const { data: existingPantry, error: pantryReadErr } = await supabase
      .from("pantry_items")
      .select("id, quantity, unit_id, is_basic")
      .eq("user_id", user.id)
      .eq("ingredient_id", item.ingredient_id)
      .maybeSingle();
    if (pantryReadErr) {
      setSubmitting(false);
      setErrorMsg("No se pudo leer tu despensa. Inténtalo más tarde.");
      return;
    }

    if (existingPantry) {
      if (existingPantry.is_basic) {
        // Basic items are conceptually "always available"; the Pantry flow
        // stores them with quantity = null. We don't override that with a
        // running total — a basic stays basic. We still mark the shopping
        // item bought (the user clearly went and bought more), but we
        // don't fight the basic semantics by re-writing its quantity.
      } else {
        // Normalize the existing pantry row to base + add the new amount.
        const existingBase = await convertToBase(
          item.ingredient_id,
          Number(existingPantry.quantity ?? 0),
          existingPantry.unit_id,
        );
        const newQty = (existingBase ?? 0) + boughtBase;
        const { error: updErr } = await supabase
          .from("pantry_items")
          .update({
            quantity: newQty,
            unit_id: baseUnitRow.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPantry.id);
        if (updErr) {
          setSubmitting(false);
          setErrorMsg(
            "No se pudo actualizar tu despensa. Inténtalo más tarde.",
          );
          return;
        }
      }
    } else {
      const { error: insErr } = await supabase.from("pantry_items").insert({
        user_id: user.id,
        ingredient_id: item.ingredient_id,
        user_ingredient_id: null,
        quantity: boughtBase,
        unit_id: baseUnitRow.id,
        location: "pantry",
        is_basic: false,
        updated_at: new Date().toISOString(),
      });
      if (insErr) {
        setSubmitting(false);
        setErrorMsg("No se pudo añadir a tu despensa. Inténtalo más tarde.");
        return;
      }
    }

    // 4) Mark the shopping_list_item as bought (we store bought_quantity in base unit).
    const checkedAt = new Date().toISOString();
    const { error: updItemErr } = await supabase
      .from("shopping_list_items")
      .update({
        is_checked: true,
        bought_quantity: boughtBase,
        checked_at: checkedAt,
      })
      .eq("id", item.id);
    if (updItemErr) {
      setSubmitting(false);
      setErrorMsg(
        "No se pudo marcar el ítem como comprado. Inténtalo más tarde.",
      );
      return;
    }

    track("shopping_item_checked", { ingredient_id: item.ingredient_id });

    setSubmitting(false);
    onSaved?.({
      ...item,
      is_checked: true,
      bought_quantity: boughtBase,
      checked_at: checkedAt,
    });
  };

  if (!item) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      testId="confirm-bought-modal"
      title={item.name}
      subtitle="Ajusta si compraste una cantidad diferente."
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            data-testid="confirm-bought-cancel"
            className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            data-testid="confirm-bought-save"
            className="flex h-11 flex-1 items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Guardando…" : "Añadir a mi despensa"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">
              Cantidad comprada
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-testid="confirm-bought-quantity"
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-brand focus:outline-none"
              placeholder="0"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">
              Unidad
            </span>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              data-testid="confirm-bought-unit"
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-brand focus:outline-none"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {`${u.name} (${u.symbol})`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="rounded-md border border-line bg-surface-secondary px-3 py-2 text-caption text-ink-secondary">
          Al confirmar, esta cantidad se añadirá a tu despensa y el ítem se
          marcará como comprado.
        </p>

        {errorMsg ? (
          <p
            role="alert"
            data-testid="confirm-bought-error"
            className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
          >
            {errorMsg}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
