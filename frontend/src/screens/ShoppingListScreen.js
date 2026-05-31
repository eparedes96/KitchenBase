import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Share2, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";
import { formatQuantity } from "@/lib/textUtils";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ShoppingListItem } from "@/components/shopping/ShoppingListItem";
import { EmptyShoppingListState } from "@/components/shopping/EmptyShoppingListState";
import { ConfirmBoughtModal } from "@/components/shopping/ConfirmBoughtModal";
import { AddShoppingItemModal } from "@/components/shopping/AddShoppingItemModal";

/**
 * SHO-001 — Lista de la Compra (Vista Principal).
 *
 * Mobile-first list designed for one-handed use in a supermarket.
 *  - Unchecked items appear first, in normal style.
 *  - Checked items move to the bottom with a struck-through / muted style.
 *  - Tapping a checkbox routes through MOD-004 (Confirmar Cantidad Comprada).
 *  - Manual add opens MOD-005.
 *  - Share opens the native share sheet (Web Share API), with a clipboard
 *    fallback when the API is unavailable.
 *  - "Vaciar lista" performs a user-initiated bulk delete with explicit
 *    confirmation.
 *
 * The shopping list operates on the global catalog only: there are no
 * semáforo colors here — those belong to the recipe-availability
 * domain (Library), not to the shopping flow.
 */
function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      data-testid="shopping-list-toast"
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md border border-line bg-surface px-4 py-2 text-caption text-ink animate-fade-in"
    >
      {message}
    </div>
  );
}

export default function ShoppingListScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(false);
  const [items, setItems] = useState([]);
  const [pendingItem, setPendingItem] = useState(null); // MOD-004
  const [addOpen, setAddOpen] = useState(false); // MOD-005
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(null);

  const viewTrackedRef = useRef(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 2500);
  }, []);

  // ---------------- Data loading ----------------
  const fetchItems = useCallback(
    async ({ silent = false } = {}) => {
      if (!user) return;
      if (!silent) setLoading(true);
      setErrorState(false);
      const { data, error } = await supabase
        .from("shopping_list_items")
        .select(
          "id, ingredient_id, needed_quantity, bought_quantity, is_checked, added_from_recipe_id, added_at, checked_at, ingredients(name, base_unit)",
        )
        .eq("user_id", user.id);
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[shopping] read failed", error);
        setErrorState(true);
        if (!silent) setLoading(false);
        return;
      }
      const mapped = (data || []).map((row) => ({
        id: row.id,
        ingredient_id: row.ingredient_id,
        name: row.ingredients?.name ?? "Ingrediente desconocido",
        base_unit: row.ingredients?.base_unit ?? "g",
        needed_quantity: Number(row.needed_quantity),
        bought_quantity:
          row.bought_quantity != null ? Number(row.bought_quantity) : null,
        is_checked: !!row.is_checked,
        added_from_recipe_id: row.added_from_recipe_id,
        added_at: row.added_at,
        checked_at: row.checked_at,
      }));
      setItems(mapped);
      if (!silent) setLoading(false);

      if (!viewTrackedRef.current) {
        viewTrackedRef.current = true;
        track("shopping_list_viewed", { item_count: mapped.length });
      }
    },
    [user],
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ---------------- Sort: unchecked first, alphabetical; checked at bottom ----------------
  const { unchecked, checked } = useMemo(() => {
    const u = [];
    const c = [];
    for (const it of items) {
      (it.is_checked ? c : u).push(it);
    }
    const byName = (a, b) =>
      (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });
    u.sort(byName);
    // Recently checked first within the checked group.
    c.sort((a, b) => {
      const ta = a.checked_at ? Date.parse(a.checked_at) : 0;
      const tb = b.checked_at ? Date.parse(b.checked_at) : 0;
      return tb - ta;
    });
    return { unchecked: u, checked: c };
  }, [items]);

  // ---------------- Handlers ----------------
  const handleCheckClick = (item) => {
    setPendingItem(item);
  };

  const handleUncheck = async (item) => {
    // Direct un-check: revert is_checked + bought_quantity. No pantry write
    // here — the original add to pantry is preserved (the user already
    // brought the food home; we don't try to claw it back).
    const { error } = await supabase
      .from("shopping_list_items")
      .update({ is_checked: false, bought_quantity: null, checked_at: null })
      .eq("id", item.id);
    if (error) {
      showToast("No se pudo actualizar el ítem.");
      return;
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              is_checked: false,
              bought_quantity: null,
              checked_at: null,
            }
          : it,
      ),
    );
  };

  const handleBoughtSaved = (updatedItem) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === updatedItem.id ? { ...it, ...updatedItem } : it,
      ),
    );
    setPendingItem(null);
    showToast("Añadido a tu despensa.");
  };

  const handleManualAdded = async () => {
    setAddOpen(false);
    await fetchItems({ silent: true });
    showToast("Ítem añadido a tu lista.");
  };

  const handleShare = async () => {
    if (items.length === 0) {
      showToast("La lista está vacía.");
      return;
    }
    const lines = ["Lista de la compra (KitchenBase)", ""];
    if (unchecked.length > 0) {
      for (const it of unchecked) {
        lines.push(
          `- ${formatQuantity(it.needed_quantity)} ${it.base_unit} ${it.name}`,
        );
      }
    }
    if (checked.length > 0) {
      lines.push("");
      lines.push("Ya comprado:");
      for (const it of checked) {
        lines.push(
          `[x] ${formatQuantity(it.needed_quantity)} ${it.base_unit} ${it.name}`,
        );
      }
    }
    const text = lines.join("\n");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Lista de la compra", text });
      } catch (err) {
        // User cancelled or share failed; no need to alert.
      }
      return;
    }
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Lista copiada al portapapeles.");
      } catch (err) {
        showToast("No se pudo copiar la lista.");
      }
      return;
    }
    showToast("Tu navegador no permite compartir esta lista.");
  };

  const handleClearConfirm = async () => {
    const beforeCount = items.length;
    setConfirmClear(false);
    if (!user || beforeCount === 0) return;
    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      showToast("No se pudo vaciar la lista.");
      return;
    }
    track("shopping_list_cleared", { cleared_count: beforeCount });
    setItems([]);
    showToast("Lista vaciada.");
  };

  // ---------------- Render ----------------
  if (loading) return <FullScreenLoader />;

  if (errorState) {
    return (
      <section
        data-testid="shopping-list-error"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="font-serif text-display text-ink">
          No se pudo cargar tu lista
        </h2>
        <p className="max-w-[280px] text-body text-ink-secondary">
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <button
          type="button"
          onClick={() => fetchItems()}
          data-testid="shopping-list-retry"
          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 text-body font-semibold text-white transition-colors hover:bg-[#B86848]"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col" data-testid="shopping-list-screen">
        <ShoppingListHeader
          onShare={handleShare}
          onClear={() => setConfirmClear(true)}
          itemCount={0}
        />
        <EmptyShoppingListState />
        <FloatingAddButton onClick={() => setAddOpen(true)} />
        <AddShoppingItemModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={handleManualAdded}
        />
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div data-testid="shopping-list-screen" className="flex h-full flex-col">
      <ShoppingListHeader
        onShare={handleShare}
        onClear={() => setConfirmClear(true)}
        itemCount={items.length}
      />

      <div className="flex-1 overflow-y-auto">
        {unchecked.length > 0 ? (
          <ul data-testid="shopping-list-unchecked" className="flex flex-col">
            {unchecked.map((it) => (
              <ShoppingListItem
                key={it.id}
                item={it}
                onCheckClick={handleCheckClick}
                onUncheck={handleUncheck}
              />
            ))}
          </ul>
        ) : null}

        {checked.length > 0 ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[10px] uppercase tracking-wide text-ink-secondary">
                Ya comprado ({checked.length})
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>
            <ul data-testid="shopping-list-checked" className="flex flex-col">
              {checked.map((it) => (
                <ShoppingListItem
                  key={it.id}
                  item={it}
                  onCheckClick={handleCheckClick}
                  onUncheck={handleUncheck}
                />
              ))}
            </ul>
          </>
        ) : null}

        <div className="h-24" />
      </div>

      <FloatingAddButton onClick={() => setAddOpen(true)} />

      <ConfirmBoughtModal
        open={!!pendingItem}
        item={pendingItem}
        onClose={() => setPendingItem(null)}
        onSaved={handleBoughtSaved}
      />

      <AddShoppingItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={handleManualAdded}
      />

      <ConfirmDialog
        open={confirmClear}
        title="¿Vaciar toda la lista?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Vaciar lista"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleClearConfirm}
        onCancel={() => setConfirmClear(false)}
        testId="shopping-list-clear-confirm"
      />

      <Toast message={toast} />
    </div>
  );
}

// -------------------- Sub-components --------------------
function ShoppingListHeader({ onShare, onClear, itemCount }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="font-serif text-display text-ink">Lista de la Compra</h1>
        {itemCount > 0 ? (
          <span className="text-caption text-ink-secondary">
            {itemCount} {itemCount === 1 ? "ítem" : "ítems"}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onShare}
          aria-label="Compartir lista"
          data-testid="shopping-list-share"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:bg-brand-light hover:text-brand"
        >
          <Share2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={itemCount === 0}
          aria-label="Vaciar lista"
          data-testid="shopping-list-clear"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:bg-brand-light hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function FloatingAddButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="shopping-list-add-fab"
      aria-label="Añadir ítem"
      className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-[#B86848]"
    >
      <Plus className="h-6 w-6" strokeWidth={2.25} />
    </button>
  );
}
