import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, ArrowLeft } from "lucide-react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { normalize } from "@/lib/textUtils";
import { LOCATION_LABEL } from "./locationConfig";
import { track } from "@/lib/analytics";

/**
 * MOD-001 — Añadir Ingrediente a Despensa.
 *
 * Three internal steps:
 *   step === "search"  -> catalog search + option to create new ingredient
 *   step === "create"  -> mini form to propose a new (quarantined) ingredient
 *   step === "form"    -> quantity / unit / location / basic toggle
 */
export function AddPantryItemModal({ open, onClose, onSaved }) {
  const { user } = useAuth();

  // Shared state
  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);

  // Form state
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [availableUnits, setAvailableUnits] = useState([]);
  const [location, setLocation] = useState("pantry");
  const [isBasic, setIsBasic] = useState(false);

  // Create-new-ingredient sub-step state
  const [createName, setCreateName] = useState("");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createBaseUnit, setCreateBaseUnit] = useState("g");
  const [categories, setCategories] = useState([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const debounceRef = useRef(null);

  // Reset everything when the modal opens/closes
  useEffect(() => {
    if (open) {
      setStep("search");
      setQuery("");
      setResults([]);
      setSelectedIngredient(null);
      setQuantity("");
      setUnitId("");
      setAvailableUnits([]);
      setLocation("pantry");
      setIsBasic(false);
      setCreateName("");
      setCreateCategoryId("");
      setCreateBaseUnit("g");
      setSubmitting(false);
      setErrorMsg("");
      setInfoMsg("");
    }
  }, [open]);

  // Catalog search (debounced, client-side filter for accent-insensitivity)
  const [allCatalog, setAllCatalog] = useState(null);

  useEffect(() => {
    if (!open || step !== "search" || allCatalog) return;
    (async () => {
      const { data } = await supabase
        .from("ingredients")
        .select("id, name, base_unit, category_id, ingredient_categories!inner(name)")
        .order("name", { ascending: true });
      setAllCatalog(data || []);
    })();
  }, [open, step, allCatalog]);

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
        const filtered = source.filter((row) =>
          normalize(row.name).includes(n)
        );
        setResults(filtered.slice(0, 20));
      }
      setSearching(false);
    }, 200);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [open, query, step, allCatalog]);

  // Load categories when entering the "create" sub-step
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

  // When an ingredient is picked, load its available units (base + conversions)
  useEffect(() => {
    if (!selectedIngredient) {
      setAvailableUnits([]);
      setUnitId("");
      return;
    }
    (async () => {
      // Base unit: find the 'gramo' or 'mililitro' unit row
      const baseUnitName = selectedIngredient.base_unit === "g" ? "gramo" : "mililitro";
      const { data: baseRow } = await supabase
        .from("units")
        .select("id, name, symbol")
        .eq("name", baseUnitName)
        .single();

      const { data: convs } = await supabase
        .from("unit_conversions")
        .select("unit_id, units!inner(id, name, symbol)")
        .eq("ingredient_id", selectedIngredient.id);

      const list = [];
      if (baseRow) list.push(baseRow);
      (convs || []).forEach((c) => {
        if (c.units && c.units.id !== baseRow?.id) {
          list.push({ id: c.units.id, name: c.units.name, symbol: c.units.symbol });
        }
      });
      setAvailableUnits(list);
      setUnitId(baseRow?.id ?? "");
    })();
  }, [selectedIngredient]);

  const exactMatchExists = useMemo(() => {
    if (!query.trim()) return true;
    const n = normalize(query);
    return (results || []).some((r) => normalize(r.name) === n);
  }, [results, query]);

  // -------- handlers --------
  const handlePickIngredient = (ing) => {
    setSelectedIngredient(ing);
    setStep("form");
    setErrorMsg("");
  };

  const handleCreateNewClick = () => {
    setCreateName(query.trim());
    setStep("create");
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
    const { error } = await supabase.from("user_ingredients").insert({
      created_by: user.id,
      name: createName.trim(),
      base_unit: createBaseUnit,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      setErrorMsg(
        "No se pudo proponer el ingrediente. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }
    track("user_ingredient_created_in_pantry_flow", {
      proposed_name: createName.trim(),
    });
    setInfoMsg(
      `Tu ingrediente “${createName.trim()}” está pendiente de validación. Por ahora no puede añadirse a la despensa, pero podrás usarlo en tus recetas.`
    );
    // After a moment, close the modal so the user can continue.
    setTimeout(() => {
      onClose?.();
    }, 1800);
  };

  const handleSave = async () => {
    setErrorMsg("");
    if (!selectedIngredient) {
      setErrorMsg("Selecciona un ingrediente.");
      return;
    }
    if (!isBasic) {
      const n = parseFloat(quantity.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        setErrorMsg("Introduce una cantidad mayor que cero.");
        return;
      }
      if (!unitId) {
        setErrorMsg("Selecciona una unidad.");
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      user_id: user.id,
      ingredient_id: selectedIngredient.id,
      location,
      is_basic: isBasic,
      quantity: isBasic ? null : parseFloat(quantity.replace(",", ".")),
      unit_id: isBasic ? null : unitId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("pantry_items").insert(payload);
    setSubmitting(false);
    if (error) {
      setErrorMsg(
        "No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }
    track("pantry_item_added", {
      ingredient_id: selectedIngredient.id,
      is_basic: isBasic,
      location,
    });
    onSaved?.();
    onClose?.();
  };

  // -------- render helpers --------
  const canSave = (() => {
    if (!selectedIngredient) return false;
    if (isBasic) return true;
    const n = parseFloat(quantity.replace(",", "."));
    return Number.isFinite(n) && n > 0 && !!unitId;
  })();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      testId="add-pantry-modal"
      title={
        step === "create"
          ? "Crear ingrediente nuevo"
          : step === "form"
          ? selectedIngredient?.name ?? "Añadir ingrediente"
          : "Añadir ingrediente"
      }
      subtitle={
        step === "form"
          ? selectedIngredient?.ingredient_categories?.name
          : undefined
      }
      footer={
        step === "form" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              data-testid="add-pantry-cancel"
              className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || submitting}
              data-testid="add-pantry-save"
              className="flex h-11 flex-1 items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        ) : step === "create" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("search")}
              data-testid="add-pantry-create-cancel"
              className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={submitting}
              data-testid="add-pantry-create-submit"
              className="flex h-11 flex-1 items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Proponiendo…" : "Crear y continuar"}
            </button>
          </div>
        ) : null
      }
    >
      {/* -------- SEARCH STEP -------- */}
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
              data-testid="add-pantry-search-input"
              className="h-11 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
          </label>

          <ul
            data-testid="add-pantry-search-results"
            className="flex flex-col rounded-md border border-line bg-surface"
          >
            {searching ? (
              <li className="px-4 py-3 text-caption text-ink-secondary">
                Buscando…
              </li>
            ) : (results || []).length === 0 && query.trim() === "" ? (
              <li className="px-4 py-6 text-center text-caption text-ink-secondary">
                Empieza a escribir para buscar.
              </li>
            ) : (
              (results || []).map((r) => (
                <li key={r.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => handlePickIngredient(r)}
                    data-testid={`add-pantry-result-${r.id}`}
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
                  onClick={handleCreateNewClick}
                  data-testid="add-pantry-create-new"
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

      {/* -------- CREATE STEP -------- */}
      {step === "create" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep("search")}
            data-testid="add-pantry-create-back"
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
              data-testid="add-pantry-create-name"
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">Categoría</span>
            <select
              value={createCategoryId}
              onChange={(e) => setCreateCategoryId(e.target.value)}
              data-testid="add-pantry-create-category"
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-brand focus:outline-none"
            >
              <option value="">Selecciona una categoría…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-caption font-medium text-ink-secondary">
              Unidad base
            </legend>
            <div className="flex w-full rounded-md border border-line bg-surface p-1">
              {[
                { v: "g", label: "Gramos (g)" },
                { v: "ml", label: "Mililitros (ml)" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setCreateBaseUnit(opt.v)}
                  data-testid={`add-pantry-create-baseunit-${opt.v}`}
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
            Tu ingrediente será revisado por el equipo. Mientras tanto, podrás
            usarlo en tus recetas privadas.
          </p>

          {errorMsg ? (
            <p
              role="alert"
              data-testid="add-pantry-create-error"
              className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
            >
              {errorMsg}
            </p>
          ) : null}

          {infoMsg ? (
            <p
              role="status"
              data-testid="add-pantry-create-info"
              className="rounded-md border border-line bg-surface-secondary px-3 py-2 text-caption text-ink"
            >
              {infoMsg}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* -------- FORM STEP -------- */}
      {step === "form" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setSelectedIngredient(null);
              setStep("search");
            }}
            data-testid="add-pantry-form-back"
            className="inline-flex w-fit items-center gap-1 text-caption text-ink-secondary hover:text-brand"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cambiar ingrediente
          </button>

          <div className="flex items-end gap-3">
            <label className={`flex flex-1 flex-col gap-1.5 ${isBasic ? "opacity-50" : ""}`}>
              <span className="text-caption font-medium text-ink-secondary">Cantidad</span>
              <input
                type="text"
                inputMode="decimal"
                value={isBasic ? "" : quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isBasic}
                data-testid="add-pantry-quantity"
                placeholder="0"
                aria-disabled={isBasic}
                className={`h-11 w-full rounded-md border border-line px-3 text-body placeholder:text-ink-secondary focus:border-brand focus:outline-none ${
                  isBasic
                    ? "cursor-not-allowed bg-surface-secondary text-ink-secondary"
                    : "bg-surface text-ink"
                }`}
              />
            </label>
            <label className={`flex flex-1 flex-col gap-1.5 ${isBasic ? "opacity-50" : ""}`}>
              <span className="text-caption font-medium text-ink-secondary">Unidad</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={isBasic}
                data-testid="add-pantry-unit"
                aria-disabled={isBasic}
                className={`h-11 w-full rounded-md border border-line px-3 text-body focus:border-brand focus:outline-none ${
                  isBasic
                    ? "cursor-not-allowed bg-surface-secondary text-ink-secondary"
                    : "bg-surface text-ink"
                }`}
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>{`${u.name} (${u.symbol})`}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-caption font-medium text-ink-secondary">Ubicación</legend>
            <div className="flex w-full rounded-md border border-line bg-surface p-1">
              {["fridge", "pantry", "freezer"].map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  data-testid={`add-pantry-location-${loc}`}
                  className={`flex h-9 flex-1 items-center justify-center rounded-sm text-caption font-medium transition-colors ${
                    location === loc
                      ? "bg-brand text-white"
                      : "text-ink-secondary hover:text-brand"
                  }`}
                >
                  {LOCATION_LABEL[loc]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-body text-ink">Marcar como básico</span>
              <button
                type="button"
                role="switch"
                aria-checked={isBasic}
                onClick={() => setIsBasic((v) => !v)}
                data-testid="add-pantry-basic-toggle"
                className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                  isBasic ? "bg-brand" : "bg-line"
                }`}
              >
                <span
                  className={`h-5 w-5 transform rounded-full bg-white transition-transform ${
                    isBasic ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
            <p className="text-caption text-ink-secondary">
              Los ingredientes básicos (sal, aceite, etc.) se consideran siempre
              disponibles.
            </p>
            {isBasic ? (
              <p
                data-testid="add-pantry-basic-note"
                className="text-caption text-ink"
              >
                Los ingredientes básicos no necesitan cantidad.
              </p>
            ) : null}
          </div>

          {errorMsg ? (
            <p
              role="alert"
              data-testid="add-pantry-error"
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
