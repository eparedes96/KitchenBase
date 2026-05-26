/**
 * MobileFrame — centers the app on wide viewports so the mobile-first
 * design stays at its native 375–430px width on desktop preview.
 */
export function MobileFrame({ children }) {
  return (
    <div className="min-h-[100dvh] w-full bg-surface-secondary flex justify-center">
      <div className="w-full max-w-mobile min-h-[100dvh] bg-surface relative flex flex-col border-x border-line">
        {children}
      </div>
    </div>
  );
}
