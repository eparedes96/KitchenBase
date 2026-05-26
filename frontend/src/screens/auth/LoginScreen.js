import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChefHat, Eye, EyeOff } from "lucide-react";
import { MobileFrame } from "@/components/common/MobileFrame";
import { useAuth } from "@/context/AuthContext";

/**
 * Maps Supabase error codes/messages to Spanish copy.
 */
function translateAuthError(error) {
  if (!error) return "";
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (msg.includes("email not confirmed")) return "Tu email aún no está confirmado.";
  if (msg.includes("too many")) return "Demasiados intentos. Espera unos minutos.";
  if (msg.includes("network") || msg.includes("fetch")) return "Sin conexión. Revisa tu red.";
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

export default function LoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Rellena email y contraseña.");
      return;
    }

    setSubmitting(true);
    const { error: err } = await signIn({ email: email.trim(), password });
    setSubmitting(false);

    if (err) {
      setError(translateAuthError(err));
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <MobileFrame>
      <section
        data-testid="login-screen"
        className="flex flex-1 flex-col px-6 py-8"
      >
        <div className="flex items-center gap-3 pb-6">
          <Link
            to="/welcome"
            data-testid="login-back"
            className="text-caption text-ink-secondary hover:text-brand"
          >
            ← Volver
          </Link>
        </div>

        <header className="flex flex-col items-start gap-2 pb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">
            <ChefHat className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-display text-ink">Bienvenido de nuevo</h1>
          <p className="text-body text-ink-secondary">
            Accede a tu cuenta para continuar.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          data-testid="login-form"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              data-testid="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="h-12 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">Contraseña</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                data-testid="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-md border border-line bg-surface px-3 pr-11 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-secondary hover:text-brand"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {error ? (
            <p
              role="alert"
              data-testid="login-error"
              className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            data-testid="login-submit"
            className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-auto pt-8 text-center text-caption text-ink-secondary">
          ¿Aún no tienes cuenta?{" "}
          <Link
            to="/register"
            data-testid="login-go-register"
            className="font-semibold text-brand hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </section>
    </MobileFrame>
  );
}
