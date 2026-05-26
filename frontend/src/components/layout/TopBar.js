import { Link, useLocation } from "react-router-dom";
import { Settings, ChefHat } from "lucide-react";

/**
 * TopBar — persistent on protected screens.
 * Left: KitchenBase mark → routes to Home ("/").
 * Right: settings icon → routes to /settings.
 */
export function TopBar() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isSettings = pathname === "/settings";

  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4"
    >
      <Link
        to="/"
        aria-label="Inicio"
        data-testid="topbar-home-button"
        className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${
          isHome ? "text-brand" : "text-ink"
        } hover:bg-brand-light`}
      >
        <ChefHat className="h-5 w-5" strokeWidth={2} />
        <span className="font-serif text-title leading-none">KitchenBase</span>
      </Link>

      <Link
        to="/settings"
        aria-label="Ajustes"
        data-testid="topbar-settings-button"
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          isSettings ? "bg-brand-light text-brand" : "text-ink-secondary"
        } hover:bg-brand-light hover:text-brand`}
      >
        <Settings className="h-5 w-5" strokeWidth={1.75} />
      </Link>
    </header>
  );
}
