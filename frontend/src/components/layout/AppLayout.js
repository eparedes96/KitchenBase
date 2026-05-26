import { Outlet } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { MobileFrame } from "@/components/common/MobileFrame";

/**
 * AppLayout — wraps every authenticated screen with TopBar + BottomTabBar.
 * Renders the matched child route inside the scrollable content area.
 */
export function AppLayout() {
  return (
    <MobileFrame>
      <TopBar />
      <main
        data-testid="app-main"
        className="flex-1 overflow-y-auto bg-surface-secondary"
      >
        <Outlet />
      </main>
      <BottomTabBar />
    </MobileFrame>
  );
}
