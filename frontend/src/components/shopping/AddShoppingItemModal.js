import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { normalize } from "@/lib/textUtils";
import { convertToBase, loadIngredientUnits } from "@/lib/unitConversion";
import { track } from "@/lib/analytics";

/**
 * MOD-005 — Añadir ítem manualmente a la Lista de la Compra.
 *
 * Two internal steps:
 *   step === "search" — catalog-only search; tap a result to continue.
 *   step === "form"   — quantity + unit, then "Añadir".
 *
 * IMPORTANT (per Section 1 of P5): only CATALOG ingredients can be added
 * to the shopping list because `shopping_list_items.ingredient_id` is NOT
 * nullable and the table has no `user_ingredient_id` column. This modal
 * therefore searches only `ingredients`, never `user_ingredients`. If the
 * query has no match we show a calm "Sin resultados" line — we do NOT
 * surface a "Crear ingrediente" CTA here (that belongs to MOD-001).
 *
 * Consolidation rule mirrors Section 4.2:
 *  - If an UNCHECKED row for the same ingredient already exists, add to it.
 *  - If only a CHECKED row exists, create a NEW unchecked row.
 *  - Otherwise, insert a fresh unchecked row.
 *
 * Quantity is always persisted in the ingredient's BASE unit, using the
 * server-side `kb_convert_to_base` function so the conversion logic stays
 * consistent with the semáforo engine.
 */
export function AddShoppingItemModal({ open, onClose, onSaved }) {
  const { user } = useAuth();

  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [catalogRows, setCatalogRows] = useState(null);

  const [selected, setSelected] = useState(null); // { id, name, base_unit }
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [availableUnits, setAvailableUnits] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const debounceRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("search");
      setQuery("");
      setResults([]);
      setSelected(null);
      setQuantity("");
      setUnitId("");
      setAvailableUnits([]);
      setSubmitting(false);
      setErrorMsg("");
    }
  }, [open]);

  // Load the catalog once per open
  useEffect(() => {
    if (!open || step !== "search" || catalogRows != null) return;
    (async () => {
      const { data } = await supabase
        .from("ingredients")
        .select("id, name, base_unit")
        .order("name", { ascending: true });
      setCatalogRows(data || []);
    })();
  }, [open, step, catalogRows]);

  // Debounced client-side filter
  useEffect(() => {
    if (!open || step !== "search") return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const q = query.trim();
      const src = catalogRows || [];
      if (!q) {
        setResults(src.slice(0, 20));
      } else {
        const n = normalize(q);
        setResults(src.filter((r) => normalize(r.name).includes(n)).slice(0, 20));
      }
      setSearching(false);
    }, 200);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [open, step, query, catalogRows]);

  // Load units whenever an ingredient is selected
  useEffect(() => {
    if (!selected) {
      setAvailableUnits([]);
      setUnitId("");
      return;
    }
    (async () => {
      const list = await loadIngredientUnits(selected);
      setAvailableUnits(list);
      setUnitId(list[0]?.id || "");
    })();
  }, [selected]);

  const parsedQuantity = useMemo(() => {
    const n = parseFloat(String(quantity).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [quantity]);

  const canSave = !!selected && parsedQuantity != null && !!unitId && !submitting;

  const handlePickResult = (row) => {
    setSelected({ id: row.id, name: row.name, base_unit: row.base_unit });
    setStep("form");
    setErrorMsg("");
  };

  const handleSave = async () => {
    if (!user || !selected || !parsedQuantity || !unitId) return;
    setSubmitting(true);
    setErrorMsg("");

    const baseQty = await convertToBase(selected.id, parsedQuantity, unitId);
    if (baseQty == null) {
      setSubmitting(false);
      setErrorMsg("No se pudo convertir la unidad. Prueba con la unidad base.");
      return;
    }

    // Consolidate with an existing UNCHECKED row, otherwise insert a new one.
    const { data: existingUnchecked, error: readErr } = await supabase
      .from("shopping_list_items")
      .select("id, needed_quantity")
      .eq("user_id", user.id)
      .eq("ingredient_id", selected.id)
      .eq("is_checked", false)
      .maybeSingle();
    if (readErr) {
      setSubmitting(false);
      setErrorMsg("No se pudo leer tu lista. Inténtalo más tarde.");
      return;
    }

    if (existingUnchecked) {
      const newQty = Number(existingUnchecked.needed_quantity ?? 0) + baseQty;
      const { error: updErr } = await supabase
        .from("shopping_list_items")
        .update({ needed_quantity: newQty })
        .eq("id", existingUnchecked.id);
      if (updErr) {
        setSubmitting(false);
        setErrorMsg("No se pudo actualizar tu lista. Inténtalo más tarde.");
        return;
      }
    } else {
      const { error: insErr } = await supabase.from("shopping_list_items").insert({
        user_id: user.id,
        ingredient_id: selected.id,
        needed_quantity: baseQty,
        is_checked: false,
        added_from_recipe_id: null,
      });
      if (insErr) {
        setSubmitting(false);
        setErrorMsg("No se pudo añadir el ítem. Inténtalo más tarde.");
        return;
      }
    }

    track("shopping_item_added_manual", { ingredient_id: selected.id });
    setSubmitting(false);
    onSaved?.();
    onClose?.();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      testId="add-shopping-modal"
      title={step === "form" ? selected?.name ?? "Añadir ítem" : "Añadir ítem"}
      subtitle={
        step === "form" ? "Indica cuánto necesitas comprar." : undefined
      }
      footer={
        step === "form" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              data-testid="add-shopping-cancel"
              className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              data-testid="add-shopping-save"
              className="flex h-11 flex-1 items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Añadiendo…" : "Añadir"}
            </button>
          </div>
        ) : null
      }
    >
      {step === "search" ? (
        <div className="flex flex-col gap-3">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca un ingrediente"
              autoFocus
              data-testid="add-shopping-search-input"
              className="h-11 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
          </label>

          <ul
            data-testid="add-shopping-search-results"
            className="flex flex-col rounded-md border border-line bg-surface"
          >
            {searching ? (
              <li className="px-4 py-3 text-caption text-ink-secondary">
                Buscando…
              </li>
            ) : results.length === 0 && query.trim() === "" ? (
              <li className="px-4 py-6 text-center text-caption text-ink-secondary">
                Empieza a escribir para buscar.
              </li>
            ) : results.length === 0 ? (
              <li
                data-testid="add-shopping-no-results"
                className="px-4 py-6 text-center text-caption text-ink-secondary"
              >
                Sin resultados. La lista de la compra solo admite ingredientes
                del catálogo.
              </li>
            ) : (
              results.map((r) => (
                <li
                  key={r.id}
                  className="border-b border-line last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => handlePickResult(r)}
                    data-testid={`add-shopping-result-${r.id}`}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-light"
                  >
                    <span className="truncate text-body text-ink">{r.name}</span>
                    <span className="ml-2 text-caption text-ink-secondary">
                      {r.base_unit}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {step === "form" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setStep("search");
            }}
            data-testid="add-shopping-form-back"
            className="inline-flex w-fit items-center gap-1 text-caption text-ink-secondary hover:text-brand"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cambiar ingrediente
          </button>

          <div className="flex items-end gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-caption font-medium text-ink-secondary">
                Cantidad
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                data-testid="add-shopping-quantity"
                className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-caption font-medium text-ink-secondary">
                Unidad
              </span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                data-testid="add-shopping-unit"
                className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-brand focus:outline-none"
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {`${u.name} (${u.symbol})`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {errorMsg ? (
            <p
              role="alert"
              data-testid="add-shopping-error"
              className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
            >
              {errorMsg}
            </p>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
