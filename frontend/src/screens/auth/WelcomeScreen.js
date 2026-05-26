import { Link } from "react-router-dom";
import { ChefHat } from "lucide-react";
import { MobileFrame } from "@/components/common/MobileFrame";

export default function WelcomeScreen() {
  return (
    <MobileFrame>
      <section
        data-testid="welcome-screen"
        className="flex flex-1 flex-col px-6 py-10"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand">
            <ChefHat className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="font-serif text-display-lg text-ink">KitchenBase</h1>
            <p className="max-w-[300px] text-body text-ink-secondary">
              Tu despensa, tus recetas y tu lista de la compra,
              <br />
              en un solo lugar.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-2">
          <Link
            to="/register"
            data-testid="welcome-register-cta"
            className="flex h-12 w-full items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848]"
          >
            Crear cuenta
          </Link>
          <Link
            to="/login"
            data-testid="welcome-login-cta"
            className="flex h-12 w-full items-center justify-center rounded-md border border-line bg-surface text-body font-semibold text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            Iniciar sesión
          </Link>
          <p className="pt-2 text-center text-caption text-ink-secondary">
            Al continuar aceptas usar KitchenBase de forma responsable.
          </p>
        </div>
      </section>
    </MobileFrame>
  );
}
