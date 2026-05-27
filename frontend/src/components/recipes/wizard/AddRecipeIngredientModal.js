import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, ArrowLeft } from "lucide-react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { normalize } from "@/lib/textUtils";

/**
 * AddRecipeIngredientModal — used inside the recipe wizard (Step 4).
 *
 * Differences vs MOD-001:
 *   - No "ubicación" field.
 *   - No "marcar como básico" toggle.
 *   - Has an "is_key" toggle (defaults to ingredient.is_key_default).
 *   - Quarantined user_ingredients ARE allowed (returned with user_ingredient_id
 *     instead of ingredient_id). It is the caller's responsibility to insert
 *     into recipe_ingredients with the correct foreign key.
 *
 * onAdd receives:
 *   {
 *     mode: 'catalog' | 'quarantine',
 *     ingredient_id?: string,           // when mode === 'catalog'
 *     user_ingredient_id?: string,      // when mode === 'quarantine'
 *     ingredient_name: string,          // display name (always)
 *     ingredient_base_unit: 'g' | 'ml',
 *     quantity: number,
 *     unit_id: string | null,           // null only if no units available (shouldn't happen)
 *     unit_name?: string,
 *     unit_symbol?: string,
 *     unit_to_base_factor: number,      // 1 for base unit, else from unit_conversions
 *     category_name?: string,           // for catalog only
 *     is_key: boolean,
 *   }
 */
export function AddRecipeIngredientModal({ open, onClose, onAdd }) {
  const { user } = useAuth();

  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [allCatalog, setAllCatalog] = useState(null);
  const [results, setResults] = useState([]);

  // Selected source
  const [selected, setSelected] = useState(null);
  //  selected shape:
  //    { kind: 'catalog', id, name, base_unit, category_name }
  //    { kind: 'quarantine', id, name, base_unit, category_name }

  // Form
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [availableUnits, setAvailableUnits] = useState([]);
  const [isKey, setIsKey] = useState(false);

  // Create new ingredient sub-step
  const [createName, setCreateName] = useState("");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createBaseUnit, setCreateBaseUnit] = useState("g");
  const [categories, setCategories] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const debounceRef = useRef(null);

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    setStep("search");
    setQuery("");
    setResults([]);
    setSelected(null);
    setQuantity("");
    setUnitId("");
    setAvailableUnits([]);
    setIsKey(false);
    setCreateName("");
    setCreateCategoryId("");
    setCreateBaseUnit("g");
    setSubmitting(false);
    setErrorMsg("");
  }, [open]);

  // Load catalog once when entering search
  useEffect(() => {
    if (!open || step !== "search" || allCatalog) return;
    (async () => {
      const { data } = await supabase
        .from("ingredients")
        .select(
          "id, name, base_unit, is_key_default, category_id, ingredient_categories!inner(name)"
        )
        .order("name", { ascending: true });
      setAllCatalog(data || []);
    })();
  }, [open, step, allCatalog]);

  // Debounced client-side filter
  useEffect(() => {
    if (!open || step !== "search") return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const source = allCatalog ?? [];
      const q = query.trim();
      if (!q) {
        setResults(source.slice(0, 20));
      } else {
        const n = normalize(q);
        setResults(source.filter((r) => normalize(r.name).includes(n)).slice(0, 20));
      }
      setSearching(false);
    }, 200);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [open, step, query, allCatalog]);

  // Load categories when entering create step
  useEffect(() => {
    if (step !== "create" || categories.length > 0) return;
    (async () => {
      const { data } = await supabase
        .from("ingredient_categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      setCategories(data || []);
    })();
  }, [step, categories.length]);

  // Load available units whenever selected changes
  useEffect(() => {
    if (!selected) {
      setAvailableUnits([]);
      setUnitId("");
      return;
    }
    (async () => {
      const baseUnitName = selected.base_unit === "ml" ? "mililitro" : "gramo";
      const { data: baseRow } = await supabase
        .from("units")
        .select("id, name, symbol")
        .eq("name", baseUnitName)
        .single();

      const list = [];
      if (baseRow) list.push({ ...baseRow, factor: 1 });

      if (selected.kind === "catalog") {
        const { data: convs } = await supabase
          .from("unit_conversions")
          .select("to_base_factor, units!inner(id, name, symbol)")
          .eq("ingredient_id", selected.id);
        (convs || []).forEach((c) => {
          if (c.units && c.units.id !== baseRow?.id) {
            list.push({
              id: c.units.id,
              name: c.units.name,
              symbol: c.units.symbol,
              factor: Number(c.to_base_factor),
            });
          }
        });
      }
      setAvailableUnits(list);
      setUnitId(baseRow?.id ?? "");
    })();
  }, [selected]);

  const exactMatchExists = useMemo(() => {
    if (!query.trim()) return true;
    const n = normalize(query);
    return (results || []).some((r) => normalize(r.name) === n);
  }, [results, query]);

  const handlePick = (row) => {
    setSelected({
      kind: "catalog",
      id: row.id,
      name: row.name,
      base_unit: row.base_unit,
      category_name: row.ingredient_categories?.name,
      is_key_default: row.is_key_default,
    });
    setIsKey(Boolean(row.is_key_default));
    setStep("form");
    setErrorMsg("");
  };

  const handleCreateClick = () => {
    setCreateName(query.trim());
    setStep("create");
    setErrorMsg("");
  };

  const handleCreateSubmit = async () => {
    setErrorMsg("");
    if (!createName.trim()) {
      setErrorMsg("Indica un nombre para el ingrediente.");
      return;
    }
    if (!createCategoryId) {
      setErrorMsg("Selecciona una categoría.");
      return;
    }
    if (!createBaseUnit) {
      setErrorMsg("Selecciona una unidad base.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("user_ingredients")
      .insert({
        created_by: user.id,
        name: createName.trim(),
        base_unit: createBaseUnit,
        status: "pending",
      })
      .select("id, name, base_unit")
      .single();
    setSubmitting(false);
    if (error || !data) {
      setErrorMsg(
        "No se pudo proponer el ingrediente. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }
    // Resolve the chosen category name for display purposes
    const cat = categories.find((c) => c.id === createCategoryId);
    setSelected({
      kind: "quarantine",
      id: data.id,
      name: data.name,
      base_unit: data.base_unit,
      category_name: cat?.name ?? "Sin categoría",
      is_key_default: false,
    });
    setIsKey(false);
    setStep("form");
  };

  const handleSave = () => {
    setErrorMsg("");
    if (!selected) {
      setErrorMsg("Selecciona un ingrediente.");
      return;
    }
    const n = parseFloat(String(quantity).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setErrorMsg("Introduce una cantidad mayor que cero.");
      return;
    }
    if (!unitId) {
      setErrorMsg("Selecciona una unidad.");
      return;
    }
    const unitRow = availableUnits.find((u) => u.id === unitId);
    onAdd?.({
      mode: selected.kind,
      ingredient_id: selected.kind === "catalog" ? selected.id : undefined,
      user_ingredient_id:
        selected.kind === "quarantine" ? selected.id : undefined,
      ingredient_name: selected.name,
      ingredient_base_unit: selected.base_unit,
      category_name: selected.category_name,
      quantity: n,
      unit_id: unitId,
      unit_name: unitRow?.name,
      unit_symbol: unitRow?.symbol,
      unit_to_base_factor: unitRow?.factor ?? 1,
      is_key: isKey,
    });
    onClose?.();
  };

  const canSave = (() => {
    if (!selected) return false;
    const n = parseFloat(String(quantity).replace(",", "."));
    return Number.isFinite(n) && n > 0 && !!unitId;
  })();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      testId="add-recipe-ingredient-modal"
      title={
        step === "create"
          ? "Crear ingrediente nuevo"
          : step === "form"
          ? selected?.name ?? "Añadir ingrediente"
          : "Añadir ingrediente"
      }
      subtitle={step === "form" ? selected?.category_name : undefined}
      footer={
        step === "form" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              data-testid="add-recipe-ing-cancel"
              className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              data-testid="add-recipe-ing-save"
              className="flex h-11 flex-1 items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Añadir
            </button>
          </div>
        ) : step === "create" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("search")}
              data-testid="add-recipe-ing-create-cancel"
              className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={submitting}
              data-testid="add-recipe-ing-create-submit"
              className="flex h-11 flex-1 items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Proponiendo…" : "Crear y continuar"}
            </button>
          </div>
        ) : null
      }
    >
      {/* SEARCH STEP */}
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
              data-testid="add-recipe-ing-search"
              className="h-11 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
          </label>
          <ul
            data-testid="add-recipe-ing-results"
            className="flex flex-col rounded-md border border-line bg-surface"
          >
            {searching ? (
              <li className="px-4 py-3 text-caption text-ink-secondary">Buscando…</li>
            ) : (results || []).length === 0 && query.trim() === "" ? (
              <li className="px-4 py-6 text-center text-caption text-ink-secondary">
                Empieza a escribir para buscar.
              </li>
            ) : (
              (results || []).map((r) => (
                <li key={r.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => handlePick(r)}
                    data-testid={`add-recipe-ing-result-${r.id}`}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-light"
                  >
                    <span className="flex flex-col">
                      <span className="text-body text-ink">{r.name}</span>
                      <span className="text-caption text-ink-secondary">
                        {r.ingredient_categories?.name ?? ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
            {query.trim() && !exactMatchExists ? (
              <li className="border-t border-line">
                <button
                  type="button"
                  onClick={handleCreateClick}
                  data-testid="add-recipe-ing-create-new"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-body text-brand transition-colors hover:bg-brand-light"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-light">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col">
                    <span>Crear ingrediente nuevo</span>
                    <span className="text-caption text-ink-secondary">“{query.trim()}”</span>
                  </span>
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* CREATE STEP */}
      {step === "create" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep("search")}
            data-testid="add-recipe-ing-create-back"
            className="inline-flex w-fit items-center gap-1 text-caption text-ink-secondary hover:text-brand"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a la búsqueda
          </button>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">Nombre</span>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              data-testid="add-recipe-ing-create-name"
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">Categoría</span>
            <select
              value={createCategoryId}
              onChange={(e) => setCreateCategoryId(e.target.value)}
              data-testid="add-recipe-ing-create-category"
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-brand focus:outline-none"
            >
              <option value="">Selecciona una categoría…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-caption font-medium text-ink-secondary">Unidad base</legend>
            <div className="flex w-full rounded-md border border-line bg-surface p-1">
              {[
                { v: "g", label: "Gramos (g)" },
                { v: "ml", label: "Mililitros (ml)" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setCreateBaseUnit(opt.v)}
                  data-testid={`add-recipe-ing-create-baseunit-${opt.v}`}
                  className={`flex h-9 flex-1 items-center justify-center rounded-sm text-caption font-medium transition-colors ${
                    createBaseUnit === opt.v
                      ? "bg-brand text-white"
                      : "text-ink-secondary hover:text-brand"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="rounded-md border border-line bg-surface-secondary px-3 py-2 text-caption text-ink-secondary">
            Tu ingrediente será revisado por el equipo. Mientras tanto, puedes usarlo en esta receta.
          </p>

          {errorMsg ? (
            <p role="alert" data-testid="add-recipe-ing-create-error" className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink">
              {errorMsg}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* FORM STEP */}
      {step === "form" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setStep("search");
            }}
            data-testid="add-recipe-ing-form-back"
            className="inline-flex w-fit items-center gap-1 text-caption text-ink-secondary hover:text-brand"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cambiar ingrediente
          </button>

          <div className="flex items-end gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-caption font-medium text-ink-secondary">Cantidad</span>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="add-recipe-ing-quantity"
                placeholder="0"
                className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-caption font-medium text-ink-secondary">Unidad</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                data-testid="add-recipe-ing-unit"
                className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-brand focus:outline-none"
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>{`${u.name} (${u.symbol})`}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-3">
            <label className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-body text-ink">Marcar como clave</span>
                <span className="text-caption text-ink-secondary">
                  Marca como clave si el plato no funciona sin este ingrediente.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isKey}
                onClick={() => setIsKey((v) => !v)}
                data-testid="add-recipe-ing-iskey"
                className={`flex h-6 w-11 flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  isKey ? "bg-brand" : "bg-line"
                }`}
              >
                <span
                  className={`h-5 w-5 transform rounded-full bg-white transition-transform ${
                    isKey ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>

          {errorMsg ? (
            <p role="alert" data-testid="add-recipe-ing-error" className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink">
              {errorMsg}
            </p>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
