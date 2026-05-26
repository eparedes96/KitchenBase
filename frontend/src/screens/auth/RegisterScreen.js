import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChefHat, Eye, EyeOff } from "lucide-react";
import { MobileFrame } from "@/components/common/MobileFrame";
import { useAuth } from "@/context/AuthContext";

function translateSignUpError(error) {
  if (!error) return "";
  const code = (error.code || error.error_code || "").toLowerCase();
  const msg = (error.message || "").toLowerCase();
  if (code.includes("email_address_invalid") || msg.includes("email address") && msg.includes("invalid"))
    return "El email no es válido o no está permitido por el servidor.";
  if (code.includes("user_already_exists") || msg.includes("already") || msg.includes("registered"))
    return "Este email ya está registrado. Inicia sesión.";
  if (code.includes("weak_password") || (msg.includes("password") && msg.includes("short")))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (code.includes("over_email_send_rate_limit") || msg.includes("rate limit"))
    return "Demasiados intentos. Espera unos minutos antes de volver a probar.";
  if (msg.includes("invalid email")) return "El email no es válido.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Sin conexión. Revisa tu red.";
  return "No se pudo crear la cuenta. Inténtalo de nuevo.";
}

export default function RegisterScreen() {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email || !password) {
      setError("Rellena todos los campos.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const { data, error: err } = await signUp({
      email: email.trim(),
      password,
    });

    if (err) {
      setSubmitting(false);
      setError(translateSignUpError(err));
      return;
    }

    // If Supabase auto-confirms (email confirmations disabled), a session is
    // returned and we can go straight to Home. Otherwise we try password sign-in
    // (Supabase auto-confirm projects also return null session in some configs),
    // and fall back to showing a confirmation message.
    if (data?.session) {
      setSubmitting(false);
      navigate("/", { replace: true });
      return;
    }

    const { data: signInData, error: signInErr } = await signIn({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (signInData?.session) {
      navigate("/", { replace: true });
      return;
    }

    // Email confirmation flow is enabled in the Supabase project.
    setInfo(
      signInErr
        ? "Hemos enviado un email de confirmación. Confírmalo para entrar."
        : "Cuenta creada. Revisa tu email para confirmarla."
    );
  };

  return (
    <MobileFrame>
      <section
        data-testid="register-screen"
        className="flex flex-1 flex-col px-6 py-8"
      >
        <div className="flex items-center gap-3 pb-6">
          <Link
            to="/welcome"
            data-testid="register-back"
            className="text-caption text-ink-secondary hover:text-brand"
          >
            ← Volver
          </Link>
        </div>

        <header className="flex flex-col items-start gap-2 pb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">
            <ChefHat className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-display text-ink">Crea tu cuenta</h1>
          <p className="text-body text-ink-secondary">
            Empieza a organizar tu cocina en minutos.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          data-testid="register-form"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              data-testid="register-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="h-12 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">
              Contraseña (mínimo 6 caracteres)
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                data-testid="register-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-md border border-line bg-surface px-3 pr-11 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-secondary hover:text-brand"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-ink-secondary">
              Confirma la contraseña
            </span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={6}
              data-testid="register-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite tu contraseña"
              className="h-12 w-full rounded-md border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-secondary focus:border-brand focus:outline-none"
            />
          </label>

          {error ? (
            <p
              role="alert"
              data-testid="register-error"
              className="rounded-md border border-line bg-brand-light px-3 py-2 text-caption text-ink"
            >
              {error}
            </p>
          ) : null}

          {info ? (
            <p
              role="status"
              data-testid="register-info"
              className="rounded-md border border-line bg-surface-secondary px-3 py-2 text-caption text-ink"
            >
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            data-testid="register-submit"
            className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-brand text-body font-semibold text-white transition-colors hover:bg-[#B86848] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-auto pt-8 text-center text-caption text-ink-secondary">
          ¿Ya tienes cuenta?{" "}
          <Link
            to="/login"
            data-testid="register-go-login"
            className="font-semibold text-brand hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </section>
    </MobileFrame>
  );
}
