import { NavLink } from "react-router-dom";
import {
  Archive,
  NotebookPen,
  Bookmark,
  ShoppingBasket,
  Compass,
} from "lucide-react";

/**
 * BottomTabBar — five persistent tabs (Spanish labels).
 * Active state uses brand terracotta for icon + label.
 */
const TABS = [
  { to: "/pantry", label: "Despensa", testId: "tab-pantry", Icon: Archive },
  {
    to: "/my-recipes",
    label: "Mis Recetas",
    testId: "tab-my-recipes",
    Icon: NotebookPen,
  },
  {
    to: "/library",
    label: "Biblioteca",
    testId: "tab-library",
    Icon: Bookmark,
  },
  {
    to: "/shopping-list",
    label: "Lista de la Compra",
    testId: "tab-shopping-list",
    Icon: ShoppingBasket,
  },
  {
    to: "/discover",
    label: "Descubrir",
    testId: "tab-discover",
    Icon: Compass,
  },
];

export function BottomTabBar() {
  return (
    <nav
      data-testid="bottom-tab-bar"
      className="sticky bottom-0 z-30 flex h-16 w-full items-stretch border-t border-line bg-surface pb-safe-bottom"
      aria-label="Navegación principal"
    >
      {TABS.map(({ to, label, Icon, testId }) => (
        <NavLink
          key={to}
          to={to}
          data-testid={testId}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none transition-colors ${
              isActive ? "text-brand" : "text-ink-secondary"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span className="px-1 text-center tracking-tight">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
