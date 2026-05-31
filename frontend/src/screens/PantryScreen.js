import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { matches } from "@/lib/textUtils";
import { track } from "@/lib/analytics";
import {
  LOCATION_LABEL,
  LOCATION_ORDER,
} from "@/components/pantry/locationConfig";
import { PantryItemRow } from "@/components/pantry/PantryItemRow";
import { EmptyPantryState } from "@/components/pantry/EmptyPantryState";
import { AddPantryItemModal } from "@/components/pantry/AddPantryItemModal";
import { EditPantryItemModal } from "@/components/pantry/EditPantryItemModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

/**
 * PAN-001 — Despensa (Vista Principal).
 *
 * Loads pantry_items joined with ingredients (and units) for the current
 * user, supports grouping by location or category, client-side filtering,
 * realtime updates, and opens add/edit modals.
 */
export default function PantryScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("location"); // 'location' | 'category'

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const [collapsedGroups, setCollapsedGroups] = useState({});

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("pantry_items")
      .select(
        "id, ingredient_id, user_ingredient_id, quantity, unit_id, location, is_basic, updated_at, ingredients(id, name, base_unit, category_id, ingredient_categories(id, name, sort_order)), user_ingredients(id, name, base_unit), units(id, name, symbol)",
      )
      .eq("user_id", user.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[pantry] fetch error", error);
      setItems([]);
      setLoading(false);
      return;
    }
    const flat = (data || []).map((row) => {
      const isQuarantine = !!row.user_ingredients;
      const src = row.ingredients ?? row.user_ingredients ?? {};
      return {
        id: row.id,
        ingredient_id: row.ingredient_id,
        user_ingredient_id: row.user_ingredient_id,
        is_quarantine: isQuarantine,
        quantity: row.quantity,
        unit_id: row.unit_id,
        location: row.location,
        is_basic: row.is_basic,
        updated_at: row.updated_at,
        ingredient: {
          id: src.id,
          name: src.name,
          base_unit: src.base_unit,
          category_id: row.ingredients?.category_id ?? null,
          category_name:
            row.ingredients?.ingredient_categories?.name ??
            (isQuarantine ? "Pendiente de validación" : null),
          category_sort:
            row.ingredients?.ingredient_categories?.sort_order ?? null,
        },
        unit: row.units
          ? { id: row.units.id, name: row.units.name, symbol: row.units.symbol }
          : null,
      };
    });
    flat.sort((a, b) =>
      (a.ingredient.name || "").localeCompare(b.ingredient.name || "", "es"),
    );
    setItems(flat);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    track("pantry_screen_viewed");
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime subscription so updates from elsewhere (other tabs) reflect here
  useEffect(() => {
    if (!user) return undefined;
    const channel = supabase
      .channel("pantry-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pantry_items",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchItems(),
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        /* noop */
      }
    };
  }, [user, fetchItems]);

  // Apply text search filter
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((it) => matches(it.ingredient?.name, query));
  }, [items, query]);

  // Group items by current view mode
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of filteredItems) {
      let key;
      let label;
      let sortKey;
      if (viewMode === "location") {
        key = it.location;
        label = LOCATION_LABEL[it.location];
        sortKey = LOCATION_ORDER.indexOf(it.location);
      } else if (it.is_quarantine) {
        // Quarantine ingredients have no real category; group them together
        key = "__quarantine__";
        label = "Pendientes de validación";
        sortKey = Number.MAX_SAFE_INTEGER;
      } else {
        key = it.ingredient.category_id;
        label = it.ingredient.category_name ?? "Sin categoría";
        sortKey = it.ingredient.category_sort ?? Number.MAX_SAFE_INTEGER;
      }
      if (!map.has(key)) {
        map.set(key, { key, label, sortKey, items: [] });
      }
      map.get(key).items.push(it);
    }
    // Sort items within group: basics first, then alphabetical
    for (const g of map.values()) {
      g.items.sort((a, b) => {
        if (a.is_basic && !b.is_basic) return -1;
        if (!a.is_basic && b.is_basic) return 1;
        return a.ingredient.name.localeCompare(b.ingredient.name, "es");
      });
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.sortKey === b.sortKey) return a.label.localeCompare(b.label, "es");
      return a.sortKey - b.sortKey;
    });
    return arr;
  }, [filteredItems, viewMode]);

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    track("pantry_view_mode_toggled", { mode });
  };

  // ---------- render ----------
  if (loading) {
    return (
      <div className="flex h-full min-h-[60dvh] items-center justify-center">
        <p className="text-caption text-ink-secondary">Cargando despensa…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <EmptyPantryState onAdd={() => setAddOpen(true)} />
        <AddPantryItemModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={fetchItems}
        />
      </>
    );
  }

  return (
    <div data-testid="pantry-screen" className="flex h-full flex-col">
      {/* Sticky search + segmented control */}
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-surface px-4 pb-3 pt-3">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en mi despensa…"
            data-testid="pantry-search-input"
            className="h-10 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
          />
        </label>
        <div
          role="tablist"
          data-testid="pantry-view-mode"
          className="flex w-full rounded-md border border-line bg-surface p-1"
        >
          {[
            { v: "location", label: "Por ubicación" },
            { v: "category", label: "Por categoría" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="tab"
              aria-selected={viewMode === opt.v}
              onClick={() => handleViewModeChange(opt.v)}
              data-testid={`pantry-view-${opt.v}`}
              className={`flex h-8 flex-1 items-center justify-center rounded-sm text-caption font-medium transition-colors ${
                viewMode === opt.v
                  ? "bg-brand text-white"
                  : "text-ink-secondary hover:text-brand"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped list */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex h-full min-h-[50dvh] items-center justify-center px-6 text-center">
            <p className="text-body text-ink-secondary">
              Sin resultados para “{query}”.
            </p>
          </div>
        ) : (
          groups.map((g) => {
            const collapsed = !!collapsedGroups[g.key];
            return (
              <section key={g.key} data-testid={`pantry-group-${g.key}`}>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.key)}
                  data-testid={`pantry-group-toggle-${g.key}`}
                  className="flex w-full items-center justify-between bg-surface-secondary px-4 py-2 text-left"
                >
                  <span className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                    {g.label}
                    <span className="ml-2 text-ink">({g.items.length})</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-ink-secondary transition-transform ${
                      collapsed ? "-rotate-90" : ""
                    }`}
                  />
                </button>
                {!collapsed ? (
                  <ul className="flex flex-col">
                    {g.items.map((it) => (
                      <PantryItemRow
                        key={it.id}
                        item={it}
                        viewMode={viewMode}
                        onEdit={(x) => setEditItem(x)}
                        onDelete={(x) => setDeleteItem(x)}
                      />
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })
        )}
        {/* spacer so FAB never covers the last row */}
        <div className="h-24" />
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Añadir ingrediente"
        data-testid="pantry-fab-add"
        className="absolute bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white transition-transform hover:scale-105 active:scale-95"
        style={{ boxShadow: "none" }}
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddPantryItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={fetchItems}
      />
      <EditPantryItemModal
        open={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSaved={fetchItems}
        onDeleted={fetchItems}
      />
      <ConfirmDialog
        open={!!deleteItem}
        title="Eliminar de la despensa"
        description={`¿Eliminar ${deleteItem?.ingredient?.name ?? ""} de la despensa?`}
        confirmLabel="Eliminar"
        destructive
        onCancel={() => setDeleteItem(null)}
        onConfirm={async () => {
          if (!deleteItem) return;
          await supabase.from("pantry_items").delete().eq("id", deleteItem.id);
          track("pantry_item_deleted", {
            ingredient_id: deleteItem.ingredient_id ?? null,
            user_ingredient_id: deleteItem.user_ingredient_id ?? null,
          });
          setDeleteItem(null);
          fetchItems();
        }}
        testId="pantry-row-confirm-delete"
      />
    </div>
  );
}
