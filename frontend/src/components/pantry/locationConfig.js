import { Refrigerator, Archive, Snowflake, Tag } from "lucide-react";

/** Location keys to Spanish labels (UI text only). */
export const LOCATION_LABEL = {
  fridge: "Nevera",
  pantry: "Despensa",
  freezer: "Congelador",
};

export const LOCATION_ORDER = ["fridge", "pantry", "freezer"];

export const LOCATION_ICONS = {
  fridge: Refrigerator,
  pantry: Archive,
  freezer: Snowflake,
};

export const CATEGORY_FALLBACK_ICON = Tag;
