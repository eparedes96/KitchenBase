import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { matches } from "@/lib/textUtils";
import { track } from "@/lib/analytics";
import { RecipeListCard } from "@/components/recipes/RecipeListCard";
import { EmptyMyRecipesState } from "@/components/recipes/EmptyMyRecipesState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

/**
 * REC-001 — Mis Recetas (Vista Principal)
 */
export default function MyRecipesScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchRecipes = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, title, status, difficulty, prep_time_minutes, servings, is_draft, draft_step, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[recipes] fetch error", error);
      setRecipes([]);
    } else {
      setRecipes(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    track("my_recipes_screen_viewed");
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Realtime subscription so list updates after wizard finishes / deletes
  useEffect(() => {
    if (!user) return undefined;
    const channel = supabase
      .channel("my-recipes-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recipes",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchRecipes()
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        /* noop */
      }
    };
  }, [user, fetchRecipes]);

  const filtered = useMemo(() => {
    if (!query.trim()) return recipes;
    return recipes.filter((r) => matches(r.title, query));
  }, [recipes, query]);

  const handleOpen = (recipe) => {
    if (recipe.is_draft) {
      navigate(`/my-recipes/edit/${recipe.id}`);
    } else {
      navigate(`/my-recipes/${recipe.id}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const wasDraft = !!pendingDelete.is_draft;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id);
    if (!error) {
      track("recipe_deleted_from_list", { was_draft: wasDraft });
      fetchRecipes();
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[60dvh] items-center justify-center">
        <p className="text-caption text-ink-secondary">Cargando recetas…</p>
      </div>
    );
  }

  if (recipes.length === 0) {
    return <EmptyMyRecipesState onCreate={() => navigate("/my-recipes/new")} />;
  }

  return (
    <div data-testid="my-recipes-screen" className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-surface px-4 pb-3 pt-3">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en mis recetas…"
            data-testid="my-recipes-search-input"
            className="h-10 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
          />
        </label>
      </div>

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
              <li key={r.id}>
                <RecipeListCard
                  recipe={r}
                  onOpen={handleOpen}
                  onLongPressDelete={(rec) => setPendingDelete(rec)}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="h-24" />
      </div>

      <button
        type="button"
        onClick={() => navigate("/my-recipes/new")}
        aria-label="Crear receta"
        data-testid="my-recipes-fab"
        className="absolute bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white transition-transform hover:scale-105 active:scale-95"
        style={{ boxShadow: "none" }}
      >
        <Plus className="h-6 w-6" />
      </button>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Eliminar receta"
        description={`¿Eliminar “${pendingDelete?.title ?? ""}”?`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
        testId="my-recipes-confirm-delete"
      />
    </div>
  );
}
