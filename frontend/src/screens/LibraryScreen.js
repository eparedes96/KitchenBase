import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { matches } from "@/lib/textUtils";
import { track } from "@/lib/analytics";
import { LibraryRecipeCard } from "@/components/library/LibraryRecipeCard";
import { EmptyLibraryState } from "@/components/library/EmptyLibraryState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";

/**
 * LIB-001 — Biblioteca (Vista Principal).
 *
 * The semáforo (status + missing ingredients) is computed by the server-side
 * function `compute_library_status`. We DO NOT compute color client-side or
 * read pantry_items for availability here — that's the engine's job (per D-008).
 *
 * Ordering:
 *   1) by semaphore color: green -> yellow -> orange
 *   2) within each color, alphabetical by recipe_title (Spanish locale)
 */
const STATUS_ORDER = { green: 0, yellow: 1, orange: 2 };

export default function LibraryScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(false);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);

  const fetchLibrary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorState(false);

    // 1) Engine-computed semaphore for the whole library
    const { data: statusRows, error: statusErr } = await supabase.rpc(
      "compute_library_status",
      { p_user_id: user.id }
    );
    if (statusErr) {
      // eslint-disable-next-line no-console
      console.error("[library] compute_library_status error", statusErr);
      setErrorState(true);
      setLoading(false);
      return;
    }
    const list = statusRows || [];

    // 2) Enrich with metadata from recipes for the cards (time/difficulty/pending)
    const recipeIds = list.map((r) => r.recipe_id);
    let meta = {};
    if (recipeIds.length > 0) {
      const { data: metaRows, error: metaErr } = await supabase
        .from("recipes")
        .select("id, prep_time_minutes, difficulty, has_pending_ingredients")
        .in("id", recipeIds);
      if (!metaErr && metaRows) {
        meta = Object.fromEntries(metaRows.map((m) => [m.id, m]));
      }
    }

    const enriched = list.map((r) => ({
      recipe_id: r.recipe_id,
      recipe_title: r.recipe_title,
      status: r.status,
      missing_count: Array.isArray(r.missing_ingredients)
        ? r.missing_ingredients.length
        : 0,
      prep_time_minutes: meta[r.recipe_id]?.prep_time_minutes ?? null,
      difficulty: meta[r.recipe_id]?.difficulty ?? null,
      has_pending_ingredients:
        !!meta[r.recipe_id]?.has_pending_ingredients,
    }));

    // 3) Stable order: green -> yellow -> orange, alphabetical within
    enriched.sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 99;
      const sb = STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return (a.recipe_title || "").localeCompare(b.recipe_title || "", "es", {
        sensitivity: "base",
      });
    });

    setRows(enriched);
    setLoading(false);

    track("library_viewed", {
      recipe_count: enriched.length,
      green_count: enriched.filter((r) => r.status === "green").length,
      yellow_count: enriched.filter((r) => r.status === "yellow").length,
      orange_count: enriched.filter((r) => r.status === "orange").length,
    });
  }, [user]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    return rows.filter((r) => matches(r.recipe_title, query));
  }, [rows, query]);

  const handleOpen = (row) => {
    track("library_recipe_opened", {
      recipe_id: row.recipe_id,
      status: row.status,
    });
    navigate(`/library/${row.recipe_id}`);
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemove || !user) return;
    const id = pendingRemove.recipe_id;
    setPendingRemove(null);
    const { error } = await supabase
      .from("library")
      .delete()
      .eq("user_id", user.id)
      .eq("recipe_id", id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[library] remove failed", error);
      return;
    }
    track("library_recipe_removed", { recipe_id: id });
    setRows((prev) => prev.filter((r) => r.recipe_id !== id));
  };

  // ---------- render ----------
  if (loading) return <FullScreenLoader />;

  if (errorState) {
    return (
      <section
        data-testid="library-error"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="font-serif text-display text-ink">
          No se pudo cargar tu biblioteca
        </h2>
        <p className="max-w-[280px] text-body text-ink-secondary">
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <button
          type="button"
          onClick={fetchLibrary}
          data-testid="library-retry"
          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 text-body font-semibold text-white transition-colors hover:bg-[#B86848]"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </section>
    );
  }

  if (rows.length === 0) {
    return <EmptyLibraryState />;
  }

  return (
    <div data-testid="library-screen" className="flex h-full flex-col">
      {/* Sticky search */}
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-surface px-4 pb-3 pt-3">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar receta"
            data-testid="library-search-input"
            className="h-10 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
          />
        </label>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[40dvh] items-center justify-center px-6 text-center">
            <p className="text-body text-ink-secondary">
              Sin resultados para “{query}”.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((r) => (
              <li key={r.recipe_id}>
                <LibraryRecipeCard
                  row={r}
                  onOpen={handleOpen}
                  onLongPressRemove={(row) => setPendingRemove(row)}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="h-12" />
      </div>

      <ConfirmDialog
        open={!!pendingRemove}
        title="Quitar de la biblioteca"
        description={`¿Quitar “${pendingRemove?.recipe_title ?? ""}” de tu biblioteca? La receta seguirá en Mis Recetas.`}
        confirmLabel="Quitar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleConfirmRemove}
        onCancel={() => setPendingRemove(null)}
        testId="library-confirm-remove"
      />
    </div>
  );
}
