import { Check, Square } from "lucide-react";
import { formatQuantity } from "@/lib/textUtils";

/**
 * ShoppingListItem — a single row in SHO-001.
 *
 * Visual states:
 *   - Unchecked: normal weight, regular ink color.
 *   - Checked:  struck-through, muted, slightly grayed background.
 *
 * Per decision D-010 the checkbox does NOT silently toggle. The parent
 * routes the click through MOD-004 (Confirmar Cantidad Comprada) for
 * unchecked rows. Clicking an already-checked row un-checks it directly
 * (because un-checking is reversing a previous bought confirmation; no
 * pantry write happens here — it's just bookkeeping on the list).
 *
 * Props:
 *   - item: { id, name, base_unit, needed_quantity, bought_quantity, is_checked }
 *   - onCheckClick(item): user tapped an UNCHECKED checkbox — open MOD-004.
 *   - onUncheck(item): user tapped a CHECKED checkbox — clear is_checked + bought_quantity.
 */
export function ShoppingListItem({ item, onCheckClick, onUncheck }) {
  const handleClick = () => {
    if (item.is_checked) {
      onUncheck?.(item);
    } else {
      onCheckClick?.(item);
    }
  };

  const displayQty = formatQuantity(item.needed_quantity);
  const displayUnit = item.base_unit || "";

  return (
    <li
      data-testid={`shopping-item-${item.id}`}
      data-checked={item.is_checked ? "true" : "false"}
      className={`border-b border-line last:border-b-0 ${
        item.is_checked ? "bg-surface-secondary" : "bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={handleClick}
        data-testid={`shopping-item-toggle-${item.id}`}
        aria-pressed={item.is_checked}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-light/40 focus:outline-none focus-visible:bg-brand-light"
      >
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border ${
            item.is_checked
              ? "border-brand bg-brand text-white"
              : "border-line bg-surface text-ink-secondary"
          }`}
        >
          {item.is_checked ? (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <Square className="h-3.5 w-3.5" strokeWidth={0} />
          )}
        </span>

        <span
          className={`flex min-w-0 flex-1 flex-col gap-0.5 ${
            item.is_checked ? "line-through text-ink-secondary" : "text-ink"
          }`}
        >
          <span className="truncate text-body">{item.name}</span>
          <span className="text-caption text-ink-secondary">
            {displayQty} {displayUnit}
            {item.is_checked && item.bought_quantity != null ? (
              <>
                {" "}
                <span className="text-ink-secondary">
                  · comprado {formatQuantity(item.bought_quantity)} {displayUnit}
                </span>
              </>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}
