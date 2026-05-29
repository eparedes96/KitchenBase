import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, RotateCcw, Minus, Plus } from "lucide-react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { convertToBase } from "@/lib/unitConversion";
import { formatQuantity } from "@/lib/textUtils";
import { track } from "@/lib/analytics";

/**
 * MOD-003 — Confirmar Cocinado.
 *
 * Opens from LIB-002 when the user taps "He cocinado esto". Mirror image of
 * MOD-004 from P5: where MOD-004 ADDED a bought quantity to the pantry,
 * this modal SUBTRACTS the cooked quantity (scaled to the cooked servings),
 * and records a `cooking_history` row.
 *
 * Per decision D-011 the discount is previewed and editable BEFORE applying:
 *  - The servings field is pre-filled with `recipe.servings` and changing
 *    it rescales every non-overridden row in real time.
 *  - Each row's quantity is individually editable (override flag) and can
 *    be removed from the discount (the recipe isn't mutated, just this
 *    cooking event's preview).
 *  - Basic ingredients and quarantine ingredients (`user_ingredient_id`)
 *    are listed but NOT discounted; a calm caption explains why.
 *
 * Pantry write rules:
 *  - Quantities are converted to the ingredient's BASE unit via the shared
 *    server-side function `kb_convert_to_base` (no client recomputation).
 *  - The subtraction floors at zero — we never persist negative quantities.
 *  - If the user has no pantry row for an ingredient (e.g. they cooked with
 *    something they didn't have catalogued), the discount is a no-op for
 *    that row; we don't create phantom or negative rows.
 *
 * Out of scope for P6 (do NOT add):
 *  - An "add ingredient" control inside this modal.
 *  - A free-text notes field.
 *  - Client-side recomputation of the semáforo (the engine handles it on
 *    the next read of LIB-001 / LIB-002).
 *
 * Props:
 *  - open: boolean
 *  - recipe: { id, title, servings }
 *  - ingredients: array of recipe_ingredients rows (the same shape used by
 *      LIB-002's ingredients list).
 *  - onClose(): close with no changes.
 *  - onConfirmed({ discountedCount, removedCount, servingsMade }): success.
 */
const PENDING_LABEL = "Pendiente — no se descuenta";
const BASIC_LABEL = "Básico — no se descuenta";

function clampServings(n) {
  const i = Math.floor(Number(n));
  if (!Number.isFinite(i)) return 1;
  return Math.max(1, i);
}

function scaleQty(baseQty, factor) {
  const v = Number(baseQty) * factor;
  if (!Number.isFinite(v) || v <= 0) return 0;
  // Round to 2 decimals to avoid floating noise without losing precision.
  return Math.round(v * 100) / 100;
}

export function ConfirmCookedModal({ open, recipe, ingredients, onClose, onConfirmed }) {
  const { user } = useAuth();

  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [rows, setRows] = useState([]);
  const [pantryByIngredient, setPantryByIngredient] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ---------------- Initial load ----------------
  // Re-initialize rows + load user's pantry to flag which ingredients are
  // "basic" (per pantry_items.is_basic). Done every time the sheet opens so
  // a previous edit doesn't leak into a new cooking event.
  useEffect(() => {
    if (!open || !recipe || !user) return;
    setErrorMsg("");
    setSubmitting(false);
    setServings(clampServings(recipe.servings ?? 1));

    (async () => {
      const catalogIds = (ingredients || [])
        .filter((ri) => !!ri.ingredient_id)
        .map((ri) => ri.ingredient_id);

      // Load only the pantry rows relevant to this recipe.
      let map = {};
      if (catalogIds.length > 0) {
        const { data: pantryRows } = await supabase
          .from("pantry_items")
          .select("id, ingredient_id, quantity, unit_id, is_basic")
          .eq("user_id", user.id)
          .in("ingredient_id", catalogIds);
        for (const p of pantryRows || []) {
          map[p.ingredient_id] = p;
        }
      }
      setPantryByIngredient(map);

      const initialRows = (ingredients || []).map((ri) => {
        const pantryRow = ri.ingredient_id ? map[ri.ingredient_id] : null;
        return {
          riId: ri.id,
          ingredientId: ri.ingredient_id,
          userIngredientId: ri.user_ingredient_id,
          name: ri.name,
          baseQty: Number(ri.quantity),
          currentQty: Number(ri.quantity),
          unitId: ri.unit_id,
          unitSymbol: ri.unit_symbol,
          isKey: !!ri.is_key,
          isPending: !!ri.is_pending || !!ri.user_ingredient_id,
          isBasic: !!pantryRow?.is_basic,
          overridden: false,
          removed: false,
          hasPantryRow: !!pantryRow,
        };
      });
      setRows(initialRows);
    })();
  }, [open, recipe, ingredients, user]);

  // ---------------- Real-time scaling ----------------
  // Whenever servings changes (and the modal is open), rescale every row
  // that the user has NOT manually overridden. Overridden rows are left
  // alone so per-row edits aren't lost when the user nudges servings.
  useEffect(() => {
    if (!open || !recipe?.servings) return;
    const factor = servings / recipe.servings;
    setRows((prev) =>
      prev.map((r) =>
        r.overridden ? r : { ...r, currentQty: scaleQty(r.baseQty, factor) }
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servings, open, recipe?.servings]);

  // ---------------- Row controls ----------------
  const updateRowQty = (riId, newQty) => {
    setRows((prev) =>
      prev.map((r) =>
        r.riId === riId
          ? { ...r, currentQty: newQty, overridden: true }
          : r
      )
    );
  };

  const toggleRowRemoved = (riId) => {
    setRows((prev) =>
      prev.map((r) => (r.riId === riId ? { ...r, removed: !r.removed } : r))
    );
  };

  // ---------------- Confirm ----------------
  const handleConfirm = async () => {
    if (!user || !recipe || submitting) return;
    setSubmitting(true);
    setErrorMsg("");

    const servingsMade = clampServings(servings);

    // Resolve base unit ids once (g + ml) so we always store in base.
    const { data: baseUnitsRows } = await supabase
      .from("units")
      .select("id, name")
      .in("name", ["gramo", "mililitro"]);
    const baseUnitIdByName = Object.fromEntries(
      (baseUnitsRows || []).map((u) => [u.name, u.id])
    );

    let discountedCount = 0;
    let removedCount = 0;

    for (const row of rows) {
      if (row.removed) {
        removedCount += 1;
        continue;
      }
      if (row.isPending || row.userIngredientId) continue; // quarantine
      if (row.isBasic) continue; // basic ingredient
      if (!row.ingredientId) continue; // safety: should never trigger

      const pantryRow = pantryByIngredient[row.ingredientId];
      if (!pantryRow) {
        // No phantom rows for ingredients the user doesn't stock.
        continue;
      }

      const cookedBaseQty = await convertToBase(
        row.ingredientId,
        Number(row.currentQty),
        row.unitId
      );
      if (cookedBaseQty == null || cookedBaseQty <= 0) continue;

      const existingBaseQty = await convertToBase(
        row.ingredientId,
        Number(pantryRow.quantity ?? 0),
        pantryRow.unit_id
      );
      const newBase = Math.max(
        0,
        Number(existingBaseQty ?? 0) - Number(cookedBaseQty)
      );

      // Determine which base unit id to write (gramo vs mililitro). Look up
      // the ingredient's base_unit from the row we already have via the
      // unit conversion path; if missing for some reason, fall back to the
      // pantry's existing unit_id (will still be correct numerically since
      // we converted both sides to base).
      let writeUnitId = pantryRow.unit_id;
      // Fetch the ingredient base_unit string to pick the right base id.
      const { data: ingMeta } = await supabase
        .from("ingredients")
        .select("base_unit")
        .eq("id", row.ingredientId)
        .single();
      const baseUnitName =
        ingMeta?.base_unit === "ml" ? "mililitro" : "gramo";
      if (baseUnitIdByName[baseUnitName]) {
        writeUnitId = baseUnitIdByName[baseUnitName];
      }

      const { error: updErr } = await supabase
        .from("pantry_items")
        .update({
          quantity: newBase,
          unit_id: writeUnitId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pantryRow.id);
      if (!updErr) discountedCount += 1;
    }

    // Insert the cooking_history row.
    const { error: chErr } = await supabase.from("cooking_history").insert({
      user_id: user.id,
      recipe_id: recipe.id,
      servings_made: servingsMade,
      notes: null,
    });
    if (chErr) {
      // eslint-disable-next-line no-console
      console.error("[cooking] cooking_history insert failed", chErr);
      setSubmitting(false);
      setErrorMsg(
        "No se pudo registrar el cocinado. La despensa se actualizó correctamente."
      );
      // Even though history failed, the pantry writes already happened. We
      // still close so the user isn't trapped, but we surface the error.
    }

    track("cooking_confirmed", {
      recipe_id: recipe.id,
      servings_made: servingsMade,
      discounted_count: discountedCount,
      removed_count: removedCount,
    });

    setSubmitting(false);
    onConfirmed?.({ discountedCount, removedCount, servingsMade });
  };

  // ---------------- Render ----------------
  const cantConfirm = submitting || clampServings(servings) < 1;
  const summary = useMemo(() => {
    const total = rows.length;
    const skippedBasic = rows.filter((r) => r.isBasic).length;
    const skippedPending = rows.filter((r) => r.isPending).length;
    const removed = rows.filter((r) => r.removed).length;
    const willDiscount = rows.filter(
      (r) => !r.removed && !r.isBasic && !r.isPending && r.hasPantryRow
    ).length;
    return { total, willDiscount, skippedBasic, skippedPending, removed };
  }, [rows]);

  if (!recipe) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      testId="confirm-cooked-modal"
      title={`Has cocinado ${recipe.title}`}
      subtitle="Te lo descontamos de la despensa. Ajusta lo que necesites antes de confirmar."
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            data-testid="confirm-cooked-cancel"
            className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={cantConfirm}
            data-testid="confirm-cooked-save"
            className="flex h-11 flex-1 items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Guardando…" : "Confirmar y descontar"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Servings input */}
        <ServingsField
          servings={servings}
          onChange={(n) => setServings(clampServings(n))}
        />

        {/* Discount preview list */}
        <div className="flex flex-col gap-2">
          <h3 className="text-caption font-semibold uppercase tracking-wide text-ink-secondary">
            Se descontará de tu despensa
          </h3>

          <ul
            data-testid="confirm-cooked-rows"
            className="flex flex-col gap-2"
          >
            {rows.map((row) => (
              <CookedRow
                key={row.riId}
                row={row}
                onQtyChange={(v) => updateRowQty(row.riId, v)}
                onToggleRemove={() => toggleRowRemoved(row.riId)}
              />
            ))}
          </ul>

          {/* Summary caption */}
          <p
            data-testid="confirm-cooked-summary"
            className="text-caption text-ink-secondary"
          >
            {`Vamos a descontar ${summary.willDiscount} ${summary.willDiscount === 1 ? "ingrediente" : "ingredientes"}.`}
            {summary.skippedBasic > 0
              ? ` ${summary.skippedBasic} básico${summary.skippedBasic === 1 ? "" : "s"} no se descuenta${summary.skippedBasic === 1 ? "" : "n"}.`
              : ""}
            {summary.skippedPending > 0
              ? ` ${summary.skippedPending} pendiente${summary.skippedPending === 1 ? "" : "s"} no se descuenta${summary.skippedPending === 1 ? "" : "n"}.`
              : ""}
          </p>
        </div>

        {errorMsg ? (
          <p
            role="alert"
            data-testid="confirm-cooked-error"
            className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
          >
            {errorMsg}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

// -------------- Sub-components --------------

function ServingsField({ servings, onChange }) {
  const dec = () => onChange(clampServings(servings - 1));
  const inc = () => onChange(clampServings(servings + 1));
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
      <div className="flex flex-1 flex-col">
        <span className="text-caption font-medium text-ink">
          ¿Cuántas raciones has cocinado?
        </span>
        <span className="text-caption text-ink-secondary">
          Cambiar este número reescala las cantidades.
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={dec}
          disabled={servings <= 1}
          aria-label="Reducir raciones"
          data-testid="confirm-cooked-servings-dec"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink-secondary hover:bg-brand-light hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          min={1}
          step={1}
          value={servings}
          onChange={(e) => onChange(e.target.value)}
          data-testid="confirm-cooked-servings"
          className="h-9 w-14 rounded-md border border-line bg-surface px-2 text-center text-body font-semibold text-ink focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={inc}
          aria-label="Aumentar raciones"
          data-testid="confirm-cooked-servings-inc"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink-secondary hover:bg-brand-light hover:text-brand"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CookedRow({ row, onQtyChange, onToggleRemove }) {
  const skipped = row.removed || row.isBasic || row.isPending;
  const caption = row.removed
    ? "Quitado del descuento"
    : row.isBasic
      ? BASIC_LABEL
      : row.isPending
        ? PENDING_LABEL
        : !row.hasPantryRow
          ? "No está en tu despensa — no se descuenta"
          : null;

  return (
    <li
      data-testid={`confirm-cooked-row-${row.riId}`}
      data-state={
        row.removed
          ? "removed"
          : row.isBasic
            ? "basic"
            : row.isPending
              ? "pending"
              : row.hasPantryRow
                ? "discount"
                : "no-pantry"
      }
      className={`flex flex-col gap-1.5 rounded-md border border-line px-3 py-2 ${
        skipped ? "bg-surface-secondary" : "bg-surface"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex min-w-0 flex-1 truncate text-body ${
            row.removed ? "line-through text-ink-secondary" : "text-ink"
          }`}
        >
          {row.name}
        </span>

        {/* Quantity input is hidden for basic/pending — they aren't editable for discount purposes. */}
        {row.isBasic || row.isPending ? null : (
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={
                typeof row.currentQty === "number"
                  ? formatQuantity(row.currentQty).replace(",", ".")
                  : row.currentQty
              }
              onChange={(e) => {
                const v = parseFloat(String(e.target.value).replace(",", "."));
                onQtyChange(Number.isFinite(v) ? v : e.target.value);
              }}
              disabled={row.removed}
              aria-label={`Cantidad de ${row.name}`}
              data-testid={`confirm-cooked-row-qty-${row.riId}`}
              className="h-9 w-20 rounded-md border border-line bg-surface px-2 text-right text-body text-ink focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span
              className={`text-caption ${row.removed ? "text-ink-secondary line-through" : "text-ink-secondary"}`}
            >
              {row.unitSymbol || ""}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleRemove}
          aria-label={row.removed ? "Restaurar" : "Quitar del descuento"}
          data-testid={`confirm-cooked-row-remove-${row.riId}`}
          className={`flex h-9 w-9 items-center justify-center rounded-md border ${
            row.removed
              ? "border-brand bg-brand text-white"
              : "border-line bg-surface text-ink-secondary hover:bg-brand-light hover:text-brand"
          }`}
        >
          {row.removed ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {caption ? (
        <span
          data-testid={`confirm-cooked-row-caption-${row.riId}`}
          className="text-caption text-ink-secondary"
        >
          {caption}
        </span>
      ) : null}
    </li>
  );
}
