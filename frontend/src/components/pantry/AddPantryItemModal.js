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
 *   step === "search"  -> catalog + own-quarantine search + option to create new
 *   step === "create"  -> mini form to propose a new (quarantined) ingredient
 *   step === "form"    -> quantity / unit / location / basic toggle
 *
 * Implements decision D-029: pantry_items can now reference either a catalog
 * ingredient (ingredient_id) or a quarantined user_ingredient (user_ingredient_id).
 */
export function AddPantryItemModal({ open, onClose, onSaved }) {
  const { user } = useAuth();

  // Shared state
  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Selected source. Shape:
  //   { kind: 'catalog' | 'quarantine',
  //     id: string,
  //     name: string,
  //     base_unit: 'g' | 'ml',
  //     category_name?: string }
  const [selected, setSelected] = useState(null);

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

  const debounceRef = useRef(null);

  // Reset everything when the modal opens/closes
  useEffect(() => {
    if (open) {
      setStep("search");
      setQuery("");
      setResults([]);
      setSelected(null);
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
    }
  }, [open]);

  // ----- Sources loaded once per open -----
  const [catalogRows, setCatalogRows] = useState(null);    // catalog ingredients
  const [quarantineRows, setQuarantineRows] = useState(null); // user's quarantine

  useEffect(() => {
    if (!open || step !== "search") return;
    // Catalog ingredients (RLS allows authenticated SELECT)
    if (catalogRows == null) {
      (async () => {
        const { data } = await supabase
          .from("ingredients")
          .select(
            "id, name, base_unit, category_id, ingredient_categories!inner(name)"
          )
          .order("name", { ascending: true });
        setCatalogRows(data || []);
      })();
    }
    // User's own quarantine ingredients (status = pending)
    if (quarantineRows == null && user) {
      (async () => {
        const { data } = await supabase
          .from("user_ingredients")
          .select("id, name, base_unit, status")
          .eq("created_by", user.id)
          .eq("status", "pending")
          .order("name", { ascending: true });
        setQuarantineRows(data || []);
      })();
    }
  }, [open, step, user, catalogRows, quarantineRows]);

  // Merged "search items" list: catalog rows + quarantine rows uniformly shaped
  const mergedItems = useMemo(() => {
    const arr = [];
    (catalogRows || []).forEach((r) => {
      arr.push({
        _kind: "catalog",
        id: r.id,
        name: r.name,
        base_unit: r.base_unit,
        category_name: r.ingredient_categories?.name ?? "",
      });
    });
    (quarantineRows || []).forEach((r) => {
      arr.push({
        _kind: "quarantine",
        id: r.id,
        name: r.name,
        base_unit: r.base_unit,
        category_name: "Pendiente de validación",
      });
    });
    arr.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return arr;
  }, [catalogRows, quarantineRows]);

  // Debounced client-side filter
  useEffect(() => {
    if (!open || step !== "search") return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const q = query.trim();
      if (!q) {
        setResults(mergedItems.slice(0, 20));
      } else {
        const n = normalize(q);
        setResults(
          mergedItems.filter((r) => normalize(r.name).includes(n)).slice(0, 20)
        );
      }
      setSearching(false);
    }, 200);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [open, query, step, mergedItems]);

  // Load categories when entering create sub-step
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

  // Whenever `selected` changes, recompute available units
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
      if (baseRow) list.push(baseRow);

      // Only catalog ingredients have unit_conversions. Quarantine ones don't.
      if (selected.kind === "catalog") {
        const { data: convs } = await supabase
          .from("unit_conversions")
          .select("unit_id, units!inner(id, name, symbol)")
          .eq("ingredient_id", selected.id);
        (convs || []).forEach((c) => {
          if (c.units && c.units.id !== baseRow?.id) {
            list.push({
              id: c.units.id,
              name: c.units.name,
              symbol: c.units.symbol,
            });
          }
        });
      }
      setAvailableUnits(list);
      setUnitId(baseRow?.id ?? "");
    })();
  }, [selected]);

  // Detect a duplicate match against catalog or own quarantine.
  //
  // This implements decision D-031: when the input matches an existing
  // ingredient (catalog OR own quarantine) we block the "Crear nuevo"
  // button and surface the matching row at the top of the list.
  //
  // Comparison: accent-insensitive + case-insensitive + trim-insensitive
  // (same normalization used elsewhere in the search UI). Catalog match
  // wins over quarantine match when both are possible.
  const duplicateMatch = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    const n = normalize(q);
    const catalog = (catalogRows || []).find((r) => normalize(r.name) === n);
    if (catalog) {
      return {
        kind: "catalog",
        row: {
          _kind: "catalog",
          id: catalog.id,
          name: catalog.name,
          base_unit: catalog.base_unit,
          category_name: catalog.ingredient_categories?.name ?? "",
        },
      };
    }
    const quar = (quarantineRows || []).find((r) => normalize(r.name) === n);
    if (quar) {
      return {
        kind: "quarantine",
        row: {
          _kind: "quarantine",
          id: quar.id,
          name: quar.name,
          base_unit: quar.base_unit,
          category_name: "Pendiente de validación",
        },
      };
    }
    return null;
  }, [query, catalogRows, quarantineRows]);

  // Fire blocked-creation analytics ONCE per unique match transition.
  const lastBlockKeyRef = useRef("");
  useEffect(() => {
    const key = duplicateMatch
      ? `${duplicateMatch.kind}:${duplicateMatch.row.id}`
      : "";
    if (key && key !== lastBlockKeyRef.current) {
      lastBlockKeyRef.current = key;
      if (duplicateMatch.kind === "catalog") {
        track("ingredient_creation_blocked_catalog_match", {
          via: "frontend_button_suppressed",
        });
      } else {
        track("ingredient_creation_blocked_quarantine_match", {
          via: "frontend_button_suppressed",
        });
      }
    } else if (!key) {
      lastBlockKeyRef.current = "";
    }
  }, [duplicateMatch]);

  // Reorder visible results to put the matched row first, dedupe by id.
  const orderedResults = useMemo(() => {
    if (!duplicateMatch) return results;
    const matchId = duplicateMatch.row.id;
    const matchKind = duplicateMatch.kind;
    const top = duplicateMatch.row;
    const rest = (results || []).filter(
      (r) => !(r.id === matchId && r._kind === matchKind)
    );
    return [top, ...rest];
  }, [results, duplicateMatch]);

  // -------- handlers --------
  const handlePickResult = (row) => {
    setSelected({
      kind: row._kind, // 'catalog' | 'quarantine'
      id: row.id,
      name: row.name,
      base_unit: row.base_unit,
      category_name: row.category_name,
    });
    setStep("form");
    setErrorMsg("");
  };

  const handleCreateNewClick = () => {
    setCreateName(query.trim());
    setStep("create");
  };

  const handleCreateSubmit = async () => {
    setErrorMsg("");
    const trimmedName = createName.trim();
    if (!trimmedName) {
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

    // Defensive re-check against catalog + quarantine right before INSERT.
    // Guards against race conditions and the (theoretical) case where the
    // user reaches this step despite the suppressed button.
    const dupKey = trimmedName.toLowerCase();

    // 1) Catalog match (server-side comparison is lower(trim(name)), so we
    //    use case-insensitive ilike with the trimmed value).
    const { data: catalogHit } = await supabase
      .from("ingredients")
      .select("id, name")
      .ilike("name", trimmedName)
      .limit(20);
    const catalogDup = (catalogHit || []).find(
      (r) => (r.name || "").trim().toLowerCase() === dupKey
    );
    if (catalogDup) {
      setSubmitting(false);
      setErrorMsg(
        "Este ingrediente ya está en el catálogo. Selecciónalo de la búsqueda."
      );
      track("ingredient_creation_blocked_catalog_match", {
        via: "frontend_save_check",
      });
      return;
    }

    // 2) Own quarantine match
    const { data: quarHit } = await supabase
      .from("user_ingredients")
      .select("id, name")
      .eq("created_by", user.id)
      .ilike("name", trimmedName)
      .limit(20);
    const quarDup = (quarHit || []).find(
      (r) => (r.name || "").trim().toLowerCase() === dupKey
    );
    if (quarDup) {
      setSubmitting(false);
      setErrorMsg(
        "Ya tienes este ingrediente pendiente de validar. Selecciónalo de la búsqueda."
      );
      track("ingredient_creation_blocked_quarantine_match", {
        via: "frontend_save_check",
      });
      return;
    }

    const { data, error } = await supabase
      .from("user_ingredients")
      .insert({
        created_by: user.id,
        name: trimmedName,
        base_unit: createBaseUnit,
        status: "pending",
      })
      .select("id, name, base_unit")
      .single();
    setSubmitting(false);
    if (error || !data) {
      // Backend trigger raises code 23505 with a deterministic message.
      // Translate to a friendly Spanish error and fire the right analytic.
      if (error?.code === "23505") {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("global catalog")) {
          setErrorMsg(
            "Este ingrediente ya está en el catálogo. Selecciónalo de la búsqueda."
          );
          track("ingredient_creation_blocked_catalog_match", {
            via: "backend_trigger",
          });
        } else if (
          msg.includes("pending ingredient") ||
          msg.includes("you already have")
        ) {
          setErrorMsg(
            "Ya tienes este ingrediente pendiente de validar. Selecciónalo de la búsqueda."
          );
          track("ingredient_creation_blocked_quarantine_match", {
            via: "backend_trigger",
          });
        } else {
          setErrorMsg("Este ingrediente ya existe. Selecciónalo de la búsqueda.");
        }
        return;
      }
      setErrorMsg(
        "No se pudo proponer el ingrediente. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }
    track("user_ingredient_created_in_pantry_flow", {
      proposed_name: trimmedName,
    });

    // Refresh quarantineRows cache so the new item appears in subsequent searches
    setQuarantineRows((prev) => [
      ...(prev || []),
      { id: data.id, name: data.name, base_unit: data.base_unit, status: "pending" },
    ]);

    // Continue to the form step with this quarantine ingredient selected
    const cat = categories.find((c) => c.id === createCategoryId);
    setSelected({
      kind: "quarantine",
      id: data.id,
      name: data.name,
      base_unit: data.base_unit,
      category_name: cat?.name ?? "Pendiente de validación",
    });
    setStep("form");
  };

  const handleSave = async () => {
    setErrorMsg("");
    if (!selected) {
      setErrorMsg("Selecciona un ingrediente.");
      return;
    }
    if (!isBasic) {
      const n = parseFloat(String(quantity).replace(",", "."));
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
      ingredient_id: selected.kind === "catalog" ? selected.id : null,
      user_ingredient_id: selected.kind === "quarantine" ? selected.id : null,
      location,
      is_basic: isBasic,
      quantity: isBasic ? null : parseFloat(String(quantity).replace(",", ".")),
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
    if (selected.kind === "quarantine") {
      track("pantry_item_added_quarantine", { is_basic: isBasic });
    } else {
      track("pantry_item_added", {
        ingredient_id: selected.id,
        is_basic: isBasic,
        location,
      });
    }
    onSaved?.();
    onClose?.();
  };

  const canSave = (() => {
    if (!selected) return false;
    if (isBasic) return true;
    const n = parseFloat(String(quantity).replace(",", "."));
    return Number.isFinite(n) && n > 0 && !!unitId;
  })();

  const isQuarantineSelected = selected?.kind === "quarantine";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      testId="add-pantry-modal"
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
              <li className="px-4 py-3 text-caption text-ink-secondary">Buscando…</li>
            ) : (orderedResults || []).length === 0 && query.trim() === "" ? (
              <li className="px-4 py-6 text-center text-caption text-ink-secondary">
                Empieza a escribir para buscar.
              </li>
            ) : (
              (orderedResults || []).map((r) => {
                const isMatched =
                  duplicateMatch &&
                  duplicateMatch.row.id === r.id &&
                  duplicateMatch.kind === r._kind;
                return (
                  <li
                    key={`${r._kind}-${r.id}`}
                    className="border-b border-line last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => handlePickResult(r)}
                      data-testid={`add-pantry-result-${r.id}`}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-light ${
                        isMatched ? "bg-brand-light" : ""
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body text-ink">{r.name}</span>
                        <span className="truncate text-caption text-ink-secondary">
                          {r.category_name}
                        </span>
                      </span>
                      {r._kind === "quarantine" ? (
                        <span
                          data-testid={`add-pantry-result-pending-pill-${r.id}`}
                          className="ml-2 inline-flex h-5 flex-shrink-0 items-center rounded-full bg-brand-light px-2 text-[10px] font-semibold uppercase tracking-wide text-brand"
                        >
                          Pendiente
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}

            {query.trim() && !duplicateMatch ? (
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

          {duplicateMatch ? (
            <p
              data-testid="add-pantry-duplicate-helper"
              className="text-caption text-ink-secondary"
            >
              Este ingrediente ya existe. Selecciónalo de la lista.
            </p>
          ) : null}
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
            Tu ingrediente será revisado por el equipo. Mientras tanto, puedes
            añadirlo a tu despensa y usarlo en tus recetas privadas.
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
        </div>
      ) : null}

      {/* -------- FORM STEP -------- */}
      {step === "form" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setStep("search");
            }}
            data-testid="add-pantry-form-back"
            className="inline-flex w-fit items-center gap-1 text-caption text-ink-secondary hover:text-brand"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cambiar ingrediente
          </button>

          {isQuarantineSelected ? (
            <p
              data-testid="add-pantry-form-pending-banner"
              className="flex items-start gap-2 rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
            >
              <span className="mt-0.5 inline-flex h-4 items-center rounded-full bg-brand px-1.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                Pendiente
              </span>
              <span>
                Este ingrediente espera validación. Puedes añadirlo a tu despensa
                mientras tanto.
              </span>
            </p>
          ) : null}

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

          {isQuarantineSelected && !isBasic ? (
            <p
              data-testid="add-pantry-quarantine-unit-help"
              className="text-caption text-ink-secondary"
            >
              Unidad base. Más unidades disponibles cuando el admin valide este
              ingrediente.
            </p>
          ) : null}

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
