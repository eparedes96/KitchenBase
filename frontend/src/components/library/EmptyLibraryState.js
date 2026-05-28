import { BookOpen, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Centered empty-state for LIB-001 when the user has no recipes in their
 * library yet.
 */
export function EmptyLibraryState() {
  const navigate = useNavigate();
  return (
    <div
      data-testid="library-empty-state"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center animate-fade-in"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand">
        <BookOpen className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h2 className="font-serif text-display text-ink">
        Tu biblioteca está vacía
      </h2>
      <p className="max-w-[280px] text-body text-ink-secondary">
        Añade tus recetas favoritas para que aparezcan aquí con su semáforo.
      </p>
      <div className="mt-2 flex w-full max-w-[280px] flex-col gap-2">
        <button
          type="button"
          onClick={() => navigate("/my-recipes/new")}
          data-testid="library-empty-create-cta"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848]"
        >
          Añade tu primera receta
        </button>
        <button
          type="button"
          onClick={() => navigate("/discover")}
          data-testid="library-empty-discover-cta"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-body text-ink transition-colors hover:bg-brand-light hover:text-brand"
        >
          <Compass className="h-4 w-4" />
          Explora el catálogo
        </button>
      </div>
    </div>
  );
}
