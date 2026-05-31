import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { supabase } from "@/lib/supabaseClient";
import { LOCATION_LABEL } from "./locationConfig";
import { track } from "@/lib/analytics";

/**
 * MOD-002 — Editar Ingrediente de Despensa.
 *
 * Receives the enriched pantry item to edit; the ingredient itself is NOT
 * editable (it comes from the catalog) so we only edit quantity, unit,
 * location, and the is_basic flag. Includes destructive "Eliminar".
 */
export function EditPantryItemModal({
  open,
  item,
  onClose,
  onSaved,
  onDeleted,
}) {
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [availableUnits, setAvailableUnits] = useState([]);
  const [location, setLocation] = useState("pantry");
  const [isBasic, setIsBasic] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open || !item) return;
    setQuantity(
      item.quantity == null ? "" : String(item.quantity).replace(".", ","),
    );
    setUnitId(item.unit_id ?? "");
    setLocation(item.location ?? "pantry");
    setIsBasic(Boolean(item.is_basic));
    setErrorMsg("");
    setConfirmDelete(false);
  }, [open, item]);

  // Load available units for the chosen ingredient
  useEffect(() => {
    if (!open || !item) {
      setAvailableUnits([]);
      return;
    }
    (async () => {
      const baseUnitName =
        item.ingredient?.base_unit === "ml" ? "mililitro" : "gramo";
      const { data: baseRow } = await supabase
        .from("units")
        .select("id, name, symbol")
        .eq("name", baseUnitName)
        .single();

      const list = [];
      if (baseRow) list.push(baseRow);

      // Only catalog ingredients have unit_conversions; quarantine ones don't
      if (item.ingredient_id) {
        const { data: convs } = await supabase
          .from("unit_conversions")
          .select("unit_id, units!inner(id, name, symbol)")
          .eq("ingredient_id", item.ingredient_id);
        (convs || []).forEach((c) => {
          if (c.units && c.units.id !== baseRow?.id) {
            list.push({
              id: c.units.id,
              name: c.units.name,
              symbol: c.units.symbol,
            });
          }
        });
      }
      setAvailableUnits(list);
      if (!unitId) setUnitId(baseRow?.id ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.ingredient_id, item?.user_ingredient_id]);

  const canSave = (() => {
    if (isBasic) return true;
    const n = parseFloat(String(quantity).replace(",", "."));
    return Number.isFinite(n) && n > 0 && !!unitId;
  })();

  const handleSave = async () => {
    if (!item) return;
    setErrorMsg("");
    if (!isBasic) {
      const n = parseFloat(String(quantity).replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        setErrorMsg("Introduce una cantidad mayor que cero.");
        return;
      }
      if (!unitId) {
        setErrorMsg("Selecciona una unidad.");
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      quantity: isBasic ? null : parseFloat(String(quantity).replace(",", ".")),
      unit_id: isBasic ? null : unitId,
      location,
      is_basic: isBasic,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("pantry_items")
      .update(payload)
      .eq("id", item.id);
    setSubmitting(false);
    if (error) {
      setErrorMsg(
        "No se pudieron guardar los cambios. Comprueba tu conexión e inténtalo de nuevo.",
      );
      return;
    }
    track("pantry_item_edited", {
      ingredient_id: item.ingredient_id ?? null,
      user_ingredient_id: item.user_ingredient_id ?? null,
    });
    onSaved?.();
    onClose?.();
  };

  const handleDelete = async () => {
    if (!item) return;
    setDeleting(true);
    const { error } = await supabase
      .from("pantry_items")
      .delete()
      .eq("id", item.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (error) {
      setErrorMsg(
        "No se pudo eliminar. Comprueba tu conexión e inténtalo de nuevo.",
      );
      return;
    }
    track("pantry_item_deleted", {
      ingredient_id: item.ingredient_id ?? null,
      user_ingredient_id: item.user_ingredient_id ?? null,
    });
    onDeleted?.();
    onClose?.();
  };

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        testId="edit-pantry-modal"
        title={item?.ingredient?.name ?? ""}
        subtitle={item?.ingredient?.category_name ?? ""}
        footer={
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || submitting}
              data-testid="edit-pantry-save"
              className="flex h-11 w-full items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Guardando…" : "Guardar cambios"}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                data-testid="edit-pantry-cancel"
                className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-surface text-body text-ink hover:bg-brand-light hover:text-brand"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                data-testid="edit-pantry-delete"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-surface text-body text-destructive hover:bg-brand-light"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-caption font-medium text-ink-secondary">
                Cantidad
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isBasic}
                data-testid="edit-pantry-quantity"
                placeholder="0"
                className={`h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none ${
                  isBasic ? "opacity-50" : ""
                }`}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-caption font-medium text-ink-secondary">
                Unidad
              </span>
              <select
                value={unitId ?? ""}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={isBasic}
                data-testid="edit-pantry-unit"
                className={`h-11 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-brand focus:outline-none ${
                  isBasic ? "opacity-50" : ""
                }`}
              >
                {availableUnits.map((u) => (
                  <option
                    key={u.id}
                    value={u.id}
                  >{`${u.name} (${u.symbol})`}</option>
                ))}
              </select>
            </label>
          </div>

          {item?.is_quarantine && !isBasic ? (
            <p
              data-testid="edit-pantry-quarantine-unit-help"
              className="text-caption text-ink-secondary"
            >
              Unidad base. Más unidades disponibles cuando el admin valide este
              ingrediente.
            </p>
          ) : null}

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-caption font-medium text-ink-secondary">
              Ubicación
            </legend>
            <div className="flex w-full rounded-md border border-line bg-surface p-1">
              {["fridge", "pantry", "freezer"].map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  data-testid={`edit-pantry-location-${loc}`}
                  className={`flex h-9 flex-1 items-center justify-center rounded-sm text-caption font-medium transition-colors ${
                    location === loc
                      ? "bg-brand text-white"
                      : "text-ink-secondary hover:text-brand"
                  }`}
                >
                  {LOCATION_LABEL[loc]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-body text-ink">Marcar como básico</span>
              <button
                type="button"
                role="switch"
                aria-checked={isBasic}
                onClick={() => setIsBasic((v) => !v)}
                data-testid="edit-pantry-basic-toggle"
                className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                  isBasic ? "bg-brand" : "bg-line"
                }`}
              >
                <span
                  className={`h-5 w-5 transform rounded-full bg-white transition-transform ${
                    isBasic ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
            <p className="text-caption text-ink-secondary">
              Los ingredientes básicos (sal, aceite, etc.) se consideran siempre
              disponibles.
            </p>
            {isBasic ? (
              <p
                data-testid="edit-pantry-basic-note"
                className="text-caption text-ink"
              >
                Los ingredientes básicos no necesitan cantidad.
              </p>
            ) : null}
          </div>

          {errorMsg ? (
            <p
              role="alert"
              data-testid="edit-pantry-error"
              className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
            >
              {errorMsg}
            </p>
          ) : null}
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar de la despensa"
        description={`¿Eliminar ${item?.ingredient?.name ?? ""} de la despensa?`}
        confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        testId="edit-pantry-confirm-delete"
      />
    </>
  );
}
