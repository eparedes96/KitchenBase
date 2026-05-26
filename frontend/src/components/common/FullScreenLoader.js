/**
 * FullScreenLoader — minimal centered loader using design tokens.
 * No spinners with shadows; subtle pulse only.
 */
export function FullScreenLoader() {
  return (
    <div
      data-testid="fullscreen-loader"
      className="min-h-[100dvh] w-full flex items-center justify-center bg-surface-secondary"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
        <p className="text-caption text-ink-secondary">Cargando…</p>
      </div>
    </div>
  );
}
