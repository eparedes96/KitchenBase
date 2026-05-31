import { ShoppingCart, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Centered empty-state for SHO-001 when the user has no items in the
 * shopping list yet. Per the Screen Map, the primary call-to-action sends
 * the user to the Library so they can let the engine compute missing
 * ingredients for them.
 */
export function EmptyShoppingListState() {
  const navigate = useNavigate();
  return (
    <div
      data-testid="shopping-list-empty-state"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center animate-fade-in"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand">
        <ShoppingCart className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h2 className="font-serif text-display text-ink">Tu lista está vacía</h2>
      <p className="max-w-[280px] text-body text-ink-secondary">
        Cuando a una receta le falten ingredientes, podrás añadirlos aquí
        automáticamente.
      </p>
      <button
        type="button"
        onClick={() => navigate("/library")}
        data-testid="shopping-list-empty-go-library"
        className="mt-2 flex h-11 w-full max-w-[280px] items-center justify-center gap-2 rounded-md border border-line bg-surface text-body text-ink transition-colors hover:bg-brand-light hover:text-brand"
      >
        <BookOpen className="h-4 w-4" />
        Ir a mi Biblioteca
      </button>
    </div>
  );
}
