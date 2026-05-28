import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MoreVertical,
  Clock,
  Gauge,
  Users,
  KeyRound,
  Pencil,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { formatQuantity } from "@/lib/textUtils";
import { track } from "@/lib/analytics";

/**
 * REC-003 — Detalle de Receta Propia.
 *
 * IMPORTANT: this screen does NOT compute or display the semáforo.
 * Per decision D-008, the traffic-light operates on the Library, not on
 * My Recipes. Do not call compute_recipe_status here.
 *
 * If the requested recipe is a draft, redirect to the wizard's edit route
 * so the user resumes editing instead of viewing.
 */
const DIFFICULTY_LABEL = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      data-testid="recipe-detail-toast"
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md border border-line bg-surface px-4 py-2 text-caption text-ink animate-fade-in"
    >
      {message}
    </div>
  );
}

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
      data-testid="recipe-nutrition"
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
          data-testid="recipe-nutrition-unavailable"
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

function IngredientsList({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-caption text-ink-secondary">No hay ingredientes.</p>
    );
  }
  return (
    <ul
      data-testid="recipe-ingredients"
      className="flex flex-col rounded-lg border border-line bg-surface"
    >
      {rows.map((r, idx) => (
        <li
          key={r.id}
          data-testid={`recipe-ingredient-row-${idx}`}
          className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
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
                  data-testid={`recipe-ingredient-pending-${idx}`}
                  title="Pendiente de validar por el equipo"
                  className="inline-flex h-5 items-center rounded-full bg-brand-light px-2 text-[10px] font-semibold uppercase tracking-wide text-brand"
                >
                  Pendiente
                </span>
              ) : null}
              {r.is_key ? (
                <span
                  data-testid={`recipe-ingredient-key-${idx}`}
                  className="text-[10px] uppercase tracking-wide text-ink-secondary"
                >
                  · Clave
                </span>
              ) : null}
            </div>
            <span className="text-caption text-ink-secondary">
              {formatQuantity(r.quantity)} {r.unit_symbol ?? ""}
            </span>
            {r.notes ? (
              <span className="text-caption text-ink-secondary">{r.notes}</span>
            ) : null}
          </div>
        </li>
      ))}
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
      data-testid="recipe-steps"
      className="flex flex-col gap-3"
    >
      {steps.map((s, idx) => (
        <li
          key={s.id ?? idx}
          data-testid={`recipe-step-${idx}`}
          className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3"
        >
          <span className="font-serif text-title text-brand">{idx + 1}.</span>
          <p className="whitespace-pre-line text-body text-ink">{s.instruction}</p>
        </li>
      ))}
    </ol>
  );
}

function OptionsMenu({ open, onClose, onEdit, onDelete, anchorRef }) {
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !anchorRef.current?.contains(e.target)) {
        onClose();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);
  if (!open) return null;
  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid="recipe-options-menu"
      className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-md border border-line bg-surface animate-fade-in"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onEdit}
        data-testid="recipe-options-edit"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-body text-ink hover:bg-brand-light hover:text-brand"
      >
        <Pencil className="h-4 w-4" />
        Editar receta
      </button>
      <div className="h-[0.5px] bg-line" />
      <button
        type="button"
        role="menuitem"
        onClick={onDelete}
        data-testid="recipe-options-delete"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-body text-destructive hover:bg-brand-light"
      >
        <Trash2 className="h-4 w-4" />
        Eliminar receta
      </button>
    </div>
  );
}

export default function RecipeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [inLibrary, setInLibrary] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPropose, setConfirmPropose] = useState(false);

  const [librarySubmitting, setLibrarySubmitting] = useState(false);
  const [proposeSubmitting, setProposeSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3000);
  }, []);

  // Track screen view once recipe is loaded
  const viewTrackedRef = useRef(false);
  useEffect(() => {
    if (!recipe || viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    track("recipe_detail_viewed", {
      is_in_library: inLibrary,
      has_pending_ingredients: !!recipe.has_pending_ingredients,
    });
  }, [recipe, inLibrary]);

  // ----------------- Data loading -----------------
  const loadEverything = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    setNotFound(false);

    const { data: r, error: rErr } = await supabase
      .from("recipes")
      .select(
        "id, user_id, title, difficulty, prep_time_minutes, servings, status, has_pending_ingredients, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving, is_draft, created_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (rErr || !r) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Drafts go to the wizard for resume
    if (r.is_draft) {
      navigate(`/my-recipes/edit/${id}`, { replace: true });
      return;
    }

    setRecipe(r);

    const [ingsRes, stepsRes, libRes] = await Promise.all([
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
      supabase
        .from("library")
        .select("id")
        .eq("user_id", user.id)
        .eq("recipe_id", id)
        .maybeSingle(),
    ]);

    setIngredients(
      (ingsRes.data || []).map((row) => ({
        id: row.id,
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
    setInLibrary(!!libRes.data);
    setLoading(false);
  }, [id, user, navigate]);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  // ----------------- Actions -----------------
  const handleToggleLibrary = async () => {
    if (!recipe || !user) return;
    setLibrarySubmitting(true);
    if (inLibrary) {
      // remove from library
      const { error } = await supabase
        .from("library")
        .delete()
        .eq("user_id", user.id)
        .eq("recipe_id", recipe.id);
      setLibrarySubmitting(false);
      if (error) {
        showToast("No se pudo quitar de la biblioteca.");
        return;
      }
      setInLibrary(false);
      showToast("Quitada de tu biblioteca.");
      return;
    }
    const { error } = await supabase
      .from("library")
      .insert({ user_id: user.id, recipe_id: recipe.id });
    setLibrarySubmitting(false);
    if (error) {
      // 23505 if it was already there — treat as success
      if (error.code === "23505") {
        setInLibrary(true);
        showToast("Ya estaba en tu biblioteca.");
        return;
      }
      showToast("No se pudo añadir a la biblioteca.");
      return;
    }
    setInLibrary(true);
    track("recipe_added_to_library", { recipe_id: recipe.id });
    showToast("Añadida a tu biblioteca.");
  };

  const handleProposeConfirm = async () => {
    if (!recipe) return;
    setConfirmPropose(false);
    setProposeSubmitting(true);
    const { error } = await supabase
      .from("recipes")
      .update({ status: "proposed" })
      .eq("id", recipe.id);
    setProposeSubmitting(false);
    if (error) {
      showToast("No se pudo proponer la receta.");
      return;
    }
    setRecipe((prev) => (prev ? { ...prev, status: "proposed" } : prev));
    track("recipe_proposed_to_catalog", { recipe_id: recipe.id });
    showToast("Receta propuesta al catálogo. Un administrador la revisará.");
  };

  const handleEdit = () => {
    setMenuOpen(false);
    navigate(`/my-recipes/edit/${id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!recipe) return;
    setDeleting(true);
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipe.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (error) {
      showToast("No se pudo eliminar la receta.");
      return;
    }
    track("recipe_deleted", { recipe_id: recipe.id });
    navigate("/my-recipes", { replace: true });
  };

  // ----------------- Render -----------------
  if (loading) return <FullScreenLoader />;

  if (notFound || !recipe) {
    return (
      <section
        data-testid="recipe-detail-not-found"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="font-serif text-display text-ink">No se encontró la receta</h2>
        <p className="max-w-[280px] text-body text-ink-secondary">
          Es posible que se haya eliminado o que no tengas acceso.
        </p>
        <Link
          to="/my-recipes"
          data-testid="recipe-not-found-back"
          className="mt-2 flex h-11 items-center justify-center rounded-md bg-brand px-5 text-body font-semibold text-white transition-colors hover:bg-[#B86848]"
        >
          Volver a Mis Recetas
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
        testId="recipe-meta-time"
      >{`${recipe.prep_time_minutes} min`}</MetadataChip>
    );
  }
  meta.push(
    <MetadataChip
      key="difficulty"
      Icon={Gauge}
      testId="recipe-meta-difficulty"
    >
      {DIFFICULTY_LABEL[recipe.difficulty] ?? recipe.difficulty}
    </MetadataChip>
  );
  meta.push(
    <MetadataChip
      key="servings"
      Icon={Users}
      testId="recipe-meta-servings"
    >{`${recipe.servings} raciones`}</MetadataChip>
  );

  const isProposed = recipe.status === "proposed";
  const isPublic = recipe.status === "public";
  const canPropose =
    !recipe.has_pending_ingredients && recipe.status === "private";

  return (
    <div
      data-testid="recipe-detail-screen"
      className="flex flex-col gap-5 px-5 pb-24 pt-3 animate-fade-in"
    >
      {/* Screen-level toolbar (back + three-dots) */}
      <div className="flex items-center justify-between">
        <Link
          to="/my-recipes"
          data-testid="recipe-detail-back"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption text-ink-secondary hover:bg-brand-light hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" />
          Mis Recetas
        </Link>
        <div className="relative">
          <button
            ref={menuAnchorRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Más opciones"
            data-testid="recipe-detail-menu-button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-brand-light hover:text-brand"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          <OptionsMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onEdit={handleEdit}
            onDelete={() => {
              setMenuOpen(false);
              setConfirmDelete(true);
            }}
            anchorRef={menuAnchorRef}
          />
        </div>
      </div>

      {/* Hero */}
      <header className="flex flex-col gap-3">
        <h1
          data-testid="recipe-detail-title"
          className="font-serif text-display-lg text-ink"
        >
          {recipe.title}
        </h1>
        <div
          data-testid="recipe-detail-meta"
          className="flex flex-wrap items-center gap-2"
        >
          {meta}
        </div>
      </header>

      {/* Nutrition */}
      <NutritionCard recipe={recipe} />

      {/* Ingredients */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-title text-ink">Ingredientes</h2>
        <IngredientsList rows={ingredients} />
      </section>

      {/* Steps */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-title text-ink">Preparación</h2>
        <StepsList steps={steps} />
      </section>

      {/* Actions */}
      <section className="flex flex-col gap-3 pt-2" data-testid="recipe-detail-actions">
        <button
          type="button"
          onClick={handleToggleLibrary}
          disabled={librarySubmitting}
          data-testid="recipe-library-toggle"
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-md text-body font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            inLibrary
              ? "border border-line bg-surface text-ink hover:bg-brand-light hover:text-brand"
              : "bg-brand text-white hover:bg-[#B86848]"
          }`}
        >
          {inLibrary ? (
            <>
              <BookmarkCheck className="h-4 w-4" />
              En mi biblioteca
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4" />
              {librarySubmitting ? "Añadiendo…" : "Añadir a mi biblioteca"}
            </>
          )}
        </button>

        {recipe.has_pending_ingredients ? (
          <p
            data-testid="recipe-propose-blocked"
            className="rounded-md border border-line bg-surface-secondary px-3 py-2 text-caption text-ink-secondary"
          >
            Esta receta usa ingredientes pendientes de validar. No se puede
            proponer al catálogo hasta que se validen.
          </p>
        ) : isPublic ? (
          <button
            type="button"
            disabled
            data-testid="recipe-propose-public"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-body text-ink-secondary"
          >
            <CheckCircle2 className="h-4 w-4" />
            Publicada en el catálogo
          </button>
        ) : isProposed ? (
          <button
            type="button"
            disabled
            data-testid="recipe-propose-proposed"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-body text-ink-secondary"
          >
            <CheckCircle2 className="h-4 w-4" />
            Propuesta enviada
          </button>
        ) : canPropose ? (
          <button
            type="button"
            onClick={() => setConfirmPropose(true)}
            disabled={proposeSubmitting}
            data-testid="recipe-propose-button"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-body text-ink transition-colors hover:bg-brand-light hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {proposeSubmitting ? "Proponiendo…" : "Proponer al catálogo"}
          </button>
        ) : null}
      </section>

      <Toast message={toast} />

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar receta"
        description="¿Eliminar esta receta? Esta acción no se puede deshacer."
        confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(false)}
        testId="recipe-confirm-delete"
      />

      <ConfirmDialog
        open={confirmPropose}
        title="Proponer al catálogo"
        description="Tu receta se enviará a revisión. Un administrador decidirá si pasa a ser pública. Mientras tanto seguirás teniéndola como privada."
        confirmLabel="Proponer"
        cancelLabel="Cancelar"
        onConfirm={handleProposeConfirm}
        onCancel={() => setConfirmPropose(false)}
        testId="recipe-confirm-propose"
      />
    </div>
  );
}
