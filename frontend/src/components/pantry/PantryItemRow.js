import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { LOCATION_ICONS, LOCATION_LABEL, CATEGORY_FALLBACK_ICON } from "./locationConfig";
import { formatQuantity } from "@/lib/textUtils";

/**
 * PantryItemRow — single row with swipe-left to reveal a destructive delete,
 * and tap-to-edit affordance.
 *
 * Props:
 *  - item: enriched pantry_item ({ id, ingredient: { name, category }, unit?, quantity, location, is_basic })
 *  - viewMode: "location" | "category"
 *  - onEdit, onDelete
 */
export function PantryItemRow({ item, viewMode, onEdit, onDelete }) {
  const [translateX, setTranslateX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startRef = useRef({ x: 0, time: 0 });
  const movedRef = useRef(false);
  const REVEAL_W = 88;
  const THRESHOLD = 40;

  const Icon =
    viewMode === "location"
      ? CATEGORY_FALLBACK_ICON
      : LOCATION_ICONS[item.location] || CATEGORY_FALLBACK_ICON;

  const handleTouchStart = (e) => {
    const t = e.touches?.[0] ?? e;
    startRef.current = { x: t.clientX, time: Date.now() };
    movedRef.current = false;
  };

  const handleTouchMove = (e) => {
    const t = e.touches?.[0] ?? e;
    const dx = t.clientX - startRef.current.x;
    if (Math.abs(dx) > 4) movedRef.current = true;
    // Allow only swipe-left to reveal.
    if (dx < 0) {
      setTranslateX(Math.max(dx, -REVEAL_W));
    } else if (revealed) {
      // allow swiping back to close from revealed state
      setTranslateX(Math.min(-REVEAL_W + dx, 0));
    }
  };

  const handleTouchEnd = () => {
    if (translateX < -THRESHOLD) {
      setTranslateX(-REVEAL_W);
      setRevealed(true);
    } else {
      setTranslateX(0);
      setRevealed(false);
    }
  };

  const handleRowClick = () => {
    if (movedRef.current) return; // ignore taps that were drags
    if (revealed) {
      setRevealed(false);
      setTranslateX(0);
      return;
    }
    onEdit?.(item);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete?.(item);
    setRevealed(false);
    setTranslateX(0);
  };

  const qtyLabel = (() => {
    if (item.is_basic) return null;
    if (item.quantity == null) return null;
    const sym = item.unit?.symbol ?? item.ingredient?.base_unit ?? "";
    return `${formatQuantity(item.quantity)} ${sym}`.trim();
  })();

  return (
    <li
      className="relative overflow-hidden bg-surface"
      data-testid="pantry-item-row"
    >
      {/* Hidden destructive action revealed on swipe-left */}
      <button
        type="button"
        onClick={handleDeleteClick}
        aria-label={`Eliminar ${item.ingredient?.name ?? ""}`}
        data-testid={`pantry-row-delete-${item.id}`}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-destructive text-white"
      >
        <div className="flex flex-col items-center gap-1">
          <Trash2 className="h-4 w-4" />
          <span className="text-[11px] font-semibold">Eliminar</span>
        </div>
      </button>

      {/* The actual interactive row, sliding over the destructive bg */}
      <button
        type="button"
        onClick={handleRowClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={(e) => {
          if (e.buttons === 1) handleTouchMove(e);
        }}
        onMouseUp={handleTouchEnd}
        onMouseLeave={() => {
          if (revealed) return;
          setTranslateX(0);
        }}
        data-testid={`pantry-row-${item.id}`}
        className="relative flex w-full items-center gap-3 border-b border-line bg-surface px-4 py-3 text-left transition-transform duration-200"
        style={{ transform: `translateX(${translateX}px)` }}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate text-body text-ink">
              {item.ingredient?.name}
            </span>
            {item.is_basic ? (
              <span
                data-testid="pantry-row-basic-pill"
                className="inline-flex h-5 items-center rounded-full bg-brand-light px-2 text-[10px] font-semibold uppercase tracking-wide text-brand"
              >
                Básico
              </span>
            ) : null}
          </div>
          <span className="truncate text-caption text-ink-secondary">
            {viewMode === "location"
              ? item.ingredient?.category_name ?? "—"
              : LOCATION_LABEL[item.location] ?? "—"}
            {qtyLabel ? <> · {qtyLabel}</> : null}
          </span>
        </div>
      </button>
    </li>
  );
}
