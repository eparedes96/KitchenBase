/**
 * ComingSoon — placeholder shown by every screen until its real flow is built.
 * Spanish copy. Uses Playfair Display for the screen name.
 */
export function ComingSoon({ title, description }) {
  return (
    <section
      data-testid="coming-soon"
      className="flex h-full min-h-[calc(100dvh-128px)] w-full flex-col items-center justify-center gap-3 px-8 text-center animate-fade-in"
    >
      <p className="text-caption uppercase tracking-[0.18em] text-ink-secondary">
        Próximamente
      </p>
      <h1
        data-testid="coming-soon-title"
        className="font-serif text-display-lg text-ink"
      >
        {title}
      </h1>
      {description ? (
        <p className="max-w-[280px] text-body text-ink-secondary">{description}</p>
      ) : (
        <p className="max-w-[280px] text-body text-ink-secondary">
          Estamos cocinando esta pantalla. Vuelve pronto.
        </p>
      )}
      <div className="mt-4 h-[1px] w-10 bg-line" />
    </section>
  );
}
