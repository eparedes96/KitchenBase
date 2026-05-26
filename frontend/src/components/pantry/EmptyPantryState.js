import { Plus } from "lucide-react";

/**
 * Centered empty-state shown when the user has no pantry items at all.
 */
export function EmptyPantryState({ onAdd }) {
  return (
    <div
      data-testid="pantry-empty-state"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center animate-fade-in"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand">
        <Plus className="h-6 w-6" strokeWidth={2} />
      </div>
      <h2 className="font-serif text-display text-ink">
        Tu despensa está vacía
      </h2>
      <p className="max-w-[280px] text-body text-ink-secondary">
        Empieza añadiendo lo que tienes en tu cocina
      </p>
      <button
        type="button"
        onClick={onAdd}
        data-testid="pantry-empty-add-first"
        className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 text-body font-semibold text-white transition-colors hover:bg-[#B86848]"
      >
        Añadir mi primer ingrediente
      </button>
    </div>
  );
}
