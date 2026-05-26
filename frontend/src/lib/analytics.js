/**
 * Thin, fail-safe wrapper around posthog.capture().
 *
 * - Works only when window.posthog exists (loaded from public/index.html).
 * - Never throws; swallows errors so analytics can never break the UI.
 * - Strips out any unexpected PII from the payload (best-effort).
 */
const PII_KEYS = new Set(["email", "password", "phone", "name", "full_name"]);

function sanitize(properties) {
  if (!properties || typeof properties !== "object") return undefined;
  const out = {};
  for (const [k, v] of Object.entries(properties)) {
    if (PII_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function track(eventName, properties) {
  try {
    if (typeof window === "undefined") return;
    const ph = window.posthog;
    if (!ph || typeof ph.capture !== "function") return;
    ph.capture(eventName, sanitize(properties));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[analytics] capture failed:", err);
  }
}
