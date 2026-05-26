/**
 * Locale-aware string utilities for KitchenBase.
 *
 * normalize() lowercases and removes diacritics so that searches behave
 * as expected for Spanish vocabulary ("platano" matches "Plátano",
 * "limon" matches "Limón", etc.).
 */
export function normalize(value) {
  if (value == null) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Accent- and case-insensitive `contains` check.
 */
export function matches(haystack, needle) {
  if (!needle) return true;
  return normalize(haystack).includes(normalize(needle));
}

/**
 * Format a numeric quantity for display.
 * Trims trailing zeros, uses Spanish decimal separator (comma).
 */
export function formatQuantity(value) {
  if (value == null) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  // Up to 3 decimals; trim trailing zeros
  const rounded = Math.round(n * 1000) / 1000;
  let s = rounded.toString();
  if (s.includes(".")) {
    s = s.replace(/\.?0+$/, "");
  }
  return s.replace(".", ",");
}
