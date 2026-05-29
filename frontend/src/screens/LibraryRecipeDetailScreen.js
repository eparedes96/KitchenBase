import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Gauge,
  Users,
  KeyRound,
  ShoppingCart,
  Utensils,
  AlertTriangle,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";
import { SemaphoreBanner } from "@/components/library/SemaphoreIndicator";
import { ConfirmCookedModal } from "@/components/cooking/ConfirmCookedModal";
import { formatQuantity } from "@/lib/textUtils";
import { convertToBase } from "@/lib/unitConversion";
import { track } from "@/lib/analytics";

/**
 * LIB-002 — Detalle de receta (Biblioteca).
 *
 * STRICT: the semáforo (status + missing ingredients) is computed by the
 * server-side function `compute_recipe_status`. We DO NOT compute color or
 * read `pantry_items` directly here — that's the engine's job (D-008).
 *
 * Missing-ingredient highlighting is driven exclusively by the RPC's
 * `missing_ingredients` JSON array. We match recipe_ingredients rows to
 * missing entries via either `ingredient_id` (catalog) or
 * `user_ingredient_id` (quarantine).
 *
 * The two CTAs ("Añadir a la Lista de la Compra" and "He cocinado esto")
 * are rendered as disabled "Próximamente" buttons. Their flows are
 * out of scope for P4.
 */
const DIFFICULTY_LABEL = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

function MetadataChip({ Icon, children, testId }) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-caption text-ink-secondary"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {children}
    </span>
  );
}

function NutritionCard({ recipe }) {
  const values = [
    { label: "kcal", value: recipe.kcal_per_serving },
    { label: "Proteína", value: recipe.protein_per_serving, unit: "g" },
    { label: "Carbs", value: recipe.carbs_per_serving, unit: "g" },
    { label: "Grasa", value: recipe.fat_per_serving, unit: "g" },
    { label: "Fibra", value: recipe.fiber_per_serving, unit: "g" },
  ];
  const allNull = values.every((v) => v.value == null);
  return (
    <section
      data-testid="library-recipe-nutrition"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3"
    >
      <header className="flex items-center justify-between">
        <h3 className="font-serif text-title text-ink">Estimación por ración</h3>
        {recipe.has_pending_ingredients ? (
          <span
            title="Algunos ingredientes están pendientes de validar"
            className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand"
          >
            Aproximada
          </span>
        ) : null}
      </header>

      {allNull ? (
        <p
          data-testid="library-recipe-nutrition-unavailable"
          className="text-caption text-ink-secondary"
        >
          Estimación no disponible.
        </p>
      ) : (
        <ul className="grid grid-cols-5 gap-1">
          {values.map((v) => (
            <li
              key={v.label}
              className="flex flex-col items-center gap-0.5 rounded-md bg-surface-secondary px-1 py-2"
            >
              <span className="text-[10px] uppercase tracking-wide text-ink-secondary">
                {v.label}
              </span>
              <span className="text-body font-semibold text-ink">
                {v.value == null ? "—" : `${formatQuantity(v.value)}${v.unit ?? ""}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Returns a "Falta X g/ml" string when missing_quantity is known, otherwise
 * just "Falta". Quantities come from the RPC already converted to the
 * ingredient's base unit (g/ml).
 */
function formatMissingLabel(missingEntry) {
  if (!missingEntry) return null;
  if (missingEntry.reason === "not_in_pantry") {
    return "No lo tienes en la despensa";
  }
  if (missingEntry.reason === "unit_conversion_unavailable") {
    return "Falta (no se pudo comparar cantidad)";
  }
  if (
    missingEntry.missing_quantity != null &&
    Number.isFinite(Number(missingEntry.missing_quantity))
  ) {
    const qty = formatQuantity(missingEntry.missing_quantity);
    const unit = missingEntry.base_unit || "";
    return `Te faltan ${qty} ${unit}`.trim();
  }
  return "Falta";
}

function IngredientsList({ rows, missingMap }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-caption text-ink-secondary">No hay ingredientes.</p>
    );
  }
  return (
    <ul
      data-testid="library-recipe-ingredients"
      className="flex flex-col rounded-lg border border-line bg-surface"
    >
      {rows.map((r, idx) => {
        const key = r.ingredient_id || r.user_ingredient_id;
        const missing = key ? missingMap.get(key) : null;
        const isMissing = !!missing;
        const missingIsKey = isMissing && !!missing.is_key;
        // Use semaphore tokens so the row visually mirrors the banner status.
        const accentBg = missingIsKey
          ? "bg-semaphore-orange"
          : isMissing
            ? "bg-semaphore-yellow"
            : "bg-brand-light";
        const accentText = isMissing ? "text-white" : "text-brand";
        const rowBg = missingIsKey
          ? "bg-[#FFF5EE]"
          : isMissing
            ? "bg-[#FEFAE8]"
            : "bg-surface";
        return (
          <li
            key={r.id}
            data-testid={`library-recipe-ingredient-row-${idx}`}
            data-missing={isMissing ? (missingIsKey ? "key" : "non-key") : "no"}
            className={`flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0 ${rowBg}`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${accentBg} ${accentText}`}
            >
              {r.is_key ? (
                <KeyRound className="h-4 w-4" strokeWidth={2} />
              ) : (
                <span className="text-caption font-semibold">{idx + 1}</span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-body text-ink">{r.name}</span>
                {r.is_pending ? (
                  <span
                    data-testid={`library-recipe-ingredient-pending-${idx}`}
                    title="Pendiente de validar por el equipo"
                    className="inline-flex h-5 items-center rounded-full bg-brand-light px-2 text-[10px] font-semibold uppercase tracking-wide text-brand"
                  >
                    Pendiente
                  </span>
                ) : null}
                {r.is_key ? (
                  <span
                    data-testid={`library-recipe-ingredient-key-${idx}`}
                    className="text-[10px] uppercase tracking-wide text-ink-secondary"
                  >
                    · Clave
                  </span>
                ) : null}
                {isMissing ? (
                  <span
                    data-testid={`library-recipe-ingredient-missing-${idx}`}
                    className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide ${
                      missingIsKey
                        ? "bg-semaphore-orange text-white"
                        : "bg-semaphore-yellow text-white"
                    }`}
                  >
                    Te falta
                  </span>
                ) : null}
              </div>
              <span className="text-caption text-ink-secondary">
                {formatQuantity(r.quantity)} {r.unit_symbol ?? ""}
              </span>
              {isMissing ? (
                <span
                  data-testid={`library-recipe-ingredient-missing-detail-${idx}`}
                  className={`text-caption font-medium ${
                    missingIsKey ? "text-semaphore-orange" : "text-ink"
                  }`}
                >
                  {formatMissingLabel(missing)}
                </span>
              ) : null}
              {r.notes ? (
                <span className="text-caption text-ink-secondary">{r.notes}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StepsList({ steps }) {
  if (!steps || steps.length === 0) {
    return (
      <p className="text-caption text-ink-secondary">
        Aún no hay pasos descritos para esta receta.
      </p>
    );
  }
  return (
    <ol
      data-testid="library-recipe-steps"
      className="flex flex-col gap-3"
    >
      {steps.map((s, idx) => (
        <li
          key={s.id ?? idx}
          data-testid={`library-recipe-step-${idx}`}
          className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3"
        >
          <span className="font-serif text-title text-brand">{idx + 1}.</span>
          <p className="whitespace-pre-line text-body text-ink">{s.instruction}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Bottom-of-screen actions on LIB-002.
 *
 * - "Añadir lo que falta a la Lista de la Compra" is shown ONLY when the
 *   recipe has missing ingredients (per Section 4.1 of P5). It writes the
 *   missing CATALOG entries to the user's shopping list, applying the
 *   consolidation rule (Section 4.2): sum into an existing UNCHECKED row,
 *   never touch CHECKED rows.
 *
 * - Quarantine ingredients (`user_ingredient_id` set / `is_pending = true`)
 *   are SKIPPED because `shopping_list_items.ingredient_id` is NOT
 *   nullable. A calm explanatory caption is rendered when any were
 *   skipped (Section 4.3).
 *
 * - "He cocinado esto" is ALWAYS visible (does not depend on the semáforo
 *   color — you can cook a green recipe). Tapping it opens MOD-003 to
 *   preview the discount, let the user adjust, and on confirm subtracts
 *   from the pantry + records a cooking_history row (P6).
 */
function RecipeActions({ recipe, missingIngredients, recipeIngredients, onCooked }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const recipeId = recipe?.id;

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(null);
  const [skippedCaption, setSkippedCaption] = useState("");
  const [lastAdded, setLastAdded] = useState(0);
  const [cookOpen, setCookOpen] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3500);
  }, []);

  // Catalog vs quarantine partition based on the engine's response shape.
  const catalogMissing = (missingIngredients || []).filter(
    (m) => m && m.ingredient_id && !m.is_pending && !m.user_ingredient_id
  );
  const pendingMissing = (missingIngredients || []).filter(
    (m) => m && (m.is_pending || m.user_ingredient_id)
  );

  const hasMissing = (missingIngredients || []).length > 0;

  /**
   * Resolve the quantity (in base unit) to push to the shopping list for a
   * given missing-ingredient entry. The engine already provides this when
   * `reason === 'insufficient_quantity'`. For `not_in_pantry` we read the
   * recipe's required quantity for this ingredient and convert via the
   * server-side kb_convert_to_base function.
   */
  const resolveBaseQty = async (mi) => {
    if (mi.missing_quantity != null) {
      const n = Number(mi.missing_quantity);
      return Number.isFinite(n) ? n : null;
    }
    const ri = (recipeIngredients || []).find(
      (r) => r.ingredient_id === mi.ingredient_id
    );
    if (!ri) return null;
    const base = await convertToBase(ri.ingredient_id, ri.quantity, ri.unit_id);
    return base != null ? Number(base) : null;
  };

  const handleAddMissingToList = async () => {
    if (!user || !recipeId || submitting) return;
    setSubmitting(true);
    setSkippedCaption("");
    setLastAdded(0);

    let added = 0;
    let skippedUnresolved = 0;

    for (const mi of catalogMissing) {
      const baseQty = await resolveBaseQty(mi);
      if (baseQty == null || baseQty <= 0) {
        skippedUnresolved += 1;
        continue;
      }
      // Consolidate with an existing UNCHECKED row, otherwise insert fresh.
      const { data: existing, error: readErr } = await supabase
        .from("shopping_list_items")
        .select("id, needed_quantity")
        .eq("user_id", user.id)
        .eq("ingredient_id", mi.ingredient_id)
        .eq("is_checked", false)
        .maybeSingle();
      if (readErr) {
        // eslint-disable-next-line no-console
        console.error("[lib-detail] shopping read failed", readErr);
        continue;
      }
      if (existing) {
        const newQty = Number(existing.needed_quantity ?? 0) + baseQty;
        const { error: updErr } = await supabase
          .from("shopping_list_items")
          .update({ needed_quantity: newQty })
          .eq("id", existing.id);
        if (!updErr) added += 1;
      } else {
        const { error: insErr } = await supabase
          .from("shopping_list_items")
          .insert({
            user_id: user.id,
            ingredient_id: mi.ingredient_id,
            needed_quantity: baseQty,
            is_checked: false,
            added_from_recipe_id: recipeId,
          });
        if (!insErr) added += 1;
      }
    }

    track("missing_ingredients_added_to_list", {
      recipe_id: recipeId,
      added_count: added,
      skipped_pending_count: pendingMissing.length,
    });

    setLastAdded(added);

    if (added === 0 && pendingMissing.length > 0) {
      setSkippedCaption(
        "Algunos ingredientes pendientes de validar no se pueden añadir a la lista todavía."
      );
    } else if (added > 0 && pendingMissing.length > 0) {
      setSkippedCaption(
        "Algunos ingredientes pendientes de validar no se pueden añadir a la lista todavía."
      );
      showToast("Añadido a tu lista de la compra");
    } else if (added > 0) {
      showToast("Añadido a tu lista de la compra");
    } else if (skippedUnresolved > 0) {
      showToast("No se pudo calcular la cantidad para algunos ingredientes.");
    }

    setSubmitting(false);
  };

  return (
    <section
      data-testid="library-recipe-actions"
      className="flex flex-col gap-2 pt-2"
    >
      {hasMissing ? (
        <button
          type="button"
          onClick={handleAddMissingToList}
          disabled={submitting}
          data-testid="library-recipe-shopping-cta"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShoppingCart className="h-4 w-4" />
          {submitting
            ? "Añadiendo…"
            : "Añadir lo que falta a la Lista de la Compra"}
        </button>
      ) : null}

      {/* "He cocinado esto" — opens MOD-003 to preview the discount and confirm. */}
      <button
        type="button"
        onClick={() => {
          track("cooking_modal_opened", { recipe_id: recipeId });
          setCookOpen(true);
        }}
        data-testid="library-recipe-cook-cta"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-brand bg-surface text-body font-semibold text-brand transition-colors hover:bg-brand-light"
      >
        <Utensils className="h-4 w-4" />
        He cocinado esto
      </button>

      {skippedCaption ? (
        <p
          data-testid="library-recipe-skipped-pending-caption"
          className="text-caption text-ink-secondary"
        >
          {skippedCaption}
        </p>
      ) : null}

      {lastAdded > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-brand-light px-3 py-2">
          <span className="flex items-center gap-2 text-caption text-ink">
            <Check className="h-4 w-4 text-brand" />
            {lastAdded === 1
              ? "1 ingrediente añadido."
              : `${lastAdded} ingredientes añadidos.`}
          </span>
          <button
            type="button"
            onClick={() => navigate("/shopping-list")}
            data-testid="library-recipe-go-to-list"
            className="flex h-8 items-center justify-center rounded-md bg-brand px-3 text-caption font-semibold text-white transition-colors hover:bg-[#B86848]"
          >
            Ver lista
          </button>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          data-testid="library-recipe-shopping-toast"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md border border-line bg-surface px-4 py-2 text-caption text-ink animate-fade-in"
        >
          {toast}
        </div>
      ) : null}

      <ConfirmCookedModal
        open={cookOpen}
        recipe={recipe}
        ingredients={recipeIngredients}
        onClose={() => setCookOpen(false)}
        onConfirmed={({ discountedCount, removedCount, servingsMade }) => {
          setCookOpen(false);
          const parts = [];
          if (discountedCount > 0) {
            parts.push(
              discountedCount === 1
                ? "1 ingrediente descontado"
                : `${discountedCount} ingredientes descontados`
            );
          }
          const msg = parts.length
            ? `Hecho. Hemos actualizado tu despensa (${parts.join(", ")}).`
            : "Hecho. Hemos registrado el cocinado.";
          showToast(msg);
          // Let the parent know so it can refresh the engine-computed
          // status (the semáforo recomputes on the next read; the parent
          // chooses what to do here, e.g. re-fetch this detail screen).
          onCooked?.({ discountedCount, removedCount, servingsMade });
        }}
      />
    </section>
  );
}

export default function LibraryRecipeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [status, setStatus] = useState(null); // 'green' | 'yellow' | 'orange'
  const [missingIngredients, setMissingIngredients] = useState([]);

  // ----------------- Data loading -----------------
  const loadEverything = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    setNotFound(false);

    // Verify recipe is in the user's library BEFORE loading anything else.
    // Direct URL access to a recipe not in the library should return notFound.
    const { data: lib, error: libErr } = await supabase
      .from("library")
      .select("id")
      .eq("user_id", user.id)
      .eq("recipe_id", id)
      .maybeSingle();
    if (libErr || !lib) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { data: r, error: rErr } = await supabase
      .from("recipes")
      .select(
        "id, user_id, title, difficulty, prep_time_minutes, servings, status, has_pending_ingredients, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving, is_draft"
      )
      .eq("id", id)
      .maybeSingle();

    if (rErr || !r) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Drafts must never appear in the library (the engine excludes them),
    // but defend defensively anyway.
    if (r.is_draft) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setRecipe(r);

    // Fire ingredients + steps + semaphore RPC in parallel.
    const [ingsRes, stepsRes, statusRes] = await Promise.all([
      supabase
        .from("recipe_ingredients")
        .select(
          "id, ingredient_id, user_ingredient_id, quantity, unit_id, is_key, notes, sort_order, ingredients(name), user_ingredients(name), units(name, symbol)"
        )
        .eq("recipe_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("recipe_steps")
        .select("id, step_number, instruction")
        .eq("recipe_id", id)
        .order("step_number", { ascending: true }),
      supabase.rpc("compute_recipe_status", {
        p_recipe_id: id,
        p_user_id: user.id,
      }),
    ]);

    setIngredients(
      (ingsRes.data || []).map((row) => ({
        id: row.id,
        ingredient_id: row.ingredient_id,
        user_ingredient_id: row.user_ingredient_id,
        name:
          row.ingredients?.name ??
          row.user_ingredients?.name ??
          "Ingrediente desconocido",
        quantity: Number(row.quantity),
        unit_id: row.unit_id,
        unit_name: row.units?.name ?? null,
        unit_symbol: row.units?.symbol ?? null,
        is_key: !!row.is_key,
        is_pending: !!row.user_ingredient_id,
        notes: row.notes,
        sort_order: row.sort_order,
      }))
    );
    setSteps(stepsRes.data || []);

    if (statusRes.error) {
      // eslint-disable-next-line no-console
      console.error("[library-detail] compute_recipe_status error", statusRes.error);
      // Default to orange on RPC failure so the user is never misled into
      // thinking they can cook the recipe.
      setStatus("orange");
      setMissingIngredients([]);
    } else {
      const row = Array.isArray(statusRes.data) ? statusRes.data[0] : null;
      const rawStatus = row?.status;
      // Same defensive normalization as LIB-001: unknown -> orange.
      setStatus(
        rawStatus === "green" || rawStatus === "yellow" || rawStatus === "orange"
          ? rawStatus
          : "orange"
      );
      setMissingIngredients(
        Array.isArray(row?.missing_ingredients) ? row.missing_ingredients : []
      );
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  // ----------------- Derived state -----------------
  // Build a map (catalog ingredient_id OR quarantine user_ingredient_id) -> missing entry
  const missingMap = useMemo(() => {
    const m = new Map();
    for (const mi of missingIngredients || []) {
      const key = mi.ingredient_id || mi.user_ingredient_id;
      if (key) m.set(key, mi);
    }
    return m;
  }, [missingIngredients]);

  // ----------------- Render -----------------
  if (loading) return <FullScreenLoader />;

  if (notFound || !recipe) {
    return (
      <section
        data-testid="library-recipe-not-found"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="font-serif text-display text-ink">
          No se encontró la receta
        </h2>
        <p className="max-w-[280px] text-body text-ink-secondary">
          Es posible que la hayas quitado de tu biblioteca o que no tengas
          acceso.
        </p>
        <Link
          to="/library"
          data-testid="library-recipe-not-found-back"
          className="mt-2 flex h-11 items-center justify-center rounded-md bg-brand px-5 text-body font-semibold text-white transition-colors hover:bg-[#B86848]"
        >
          Volver a la Biblioteca
        </Link>
      </section>
    );
  }

  const meta = [];
  if (recipe.prep_time_minutes) {
    meta.push(
      <MetadataChip
        key="time"
        Icon={Clock}
        testId="library-recipe-meta-time"
      >{`${recipe.prep_time_minutes} min`}</MetadataChip>
    );
  }
  meta.push(
    <MetadataChip
      key="difficulty"
      Icon={Gauge}
      testId="library-recipe-meta-difficulty"
    >
      {DIFFICULTY_LABEL[recipe.difficulty] ?? recipe.difficulty}
    </MetadataChip>
  );
  meta.push(
    <MetadataChip
      key="servings"
      Icon={Users}
      testId="library-recipe-meta-servings"
    >{`${recipe.servings} raciones`}</MetadataChip>
  );

  return (
    <div
      data-testid="library-recipe-detail-screen"
      data-semaphore={status}
      className="flex flex-col gap-5 px-5 pb-24 pt-3 animate-fade-in"
    >
      {/* Back link */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/library")}
          data-testid="library-recipe-back"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption text-ink-secondary hover:bg-brand-light hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" />
          Biblioteca
        </button>
      </div>

      {/* Hero */}
      <header className="flex flex-col gap-3">
        <h1
          data-testid="library-recipe-title"
          className="font-serif text-display-lg text-ink"
        >
          {recipe.title}
        </h1>
        <div
          data-testid="library-recipe-meta"
          className="flex flex-wrap items-center gap-2"
        >
          {meta}
        </div>
      </header>

      {/* Semaphore banner — RPC-driven */}
      <SemaphoreBanner
        status={status}
        approximate={!!recipe.has_pending_ingredients}
      />

      {/* Nutrition */}
      <NutritionCard recipe={recipe} />

      {/* Ingredients */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-title text-ink">Ingredientes</h2>
        <IngredientsList rows={ingredients} missingMap={missingMap} />
      </section>

      {/* Steps */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-title text-ink">Preparación</h2>
        <StepsList steps={steps} />
      </section>

      {/* Actions: shopping CTA enabled when there are missing ingredients;
          "He cocinado esto" opens MOD-003 to subtract from pantry + record history. */}
      <RecipeActions
        recipe={recipe}
        missingIngredients={missingIngredients}
        recipeIngredients={ingredients}
        onCooked={() => {
          // After a successful cook, re-fetch everything: pantry has been
          // discounted so the engine will recompute the semáforo (the
          // banner may flip from green to yellow/orange — that is the
          // loop closing).
          loadEverything();
        }}
      />
    </div>
  );
}
