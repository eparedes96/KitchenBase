import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Mail, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  const handleSignOut = async () => {
    setError("");
    setSigningOut(true);
    const { error: err } = await signOut();
    setSigningOut(false);
    if (err) {
      setError("No se pudo cerrar sesión. Inténtalo de nuevo.");
      return;
    }
    navigate("/welcome", { replace: true });
  };

  return (
    <section
      data-testid="settings-screen"
      className="flex flex-col gap-6 px-5 py-6 animate-fade-in"
    >
      <header className="flex flex-col gap-1">
        <p className="text-caption uppercase tracking-[0.18em] text-ink-secondary">
          Ajustes
        </p>
        <h1 className="font-serif text-display text-ink">Tu cuenta</h1>
      </header>

      <div className="rounded-lg border border-line bg-surface">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-brand">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-ink-secondary">Usuario</span>
            <span
              data-testid="settings-user-email"
              className="truncate text-body text-ink"
            >
              {user?.email ?? "—"}
            </span>
          </div>
        </div>
        <div className="h-[0.5px] bg-line" />
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-brand">
            <Mail className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-ink-secondary">Método de acceso</span>
            <span className="text-body text-ink">Email y contraseña</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          data-testid="sign-out-button"
          className="flex w-full items-center justify-between px-4 py-4 text-left text-body text-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <LogOut className="h-4 w-4 text-brand" />
            {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </span>
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          data-testid="settings-error"
          className="text-caption text-destructive"
        >
          {error}
        </p>
      ) : null}

      <p className="pt-4 text-center text-caption text-ink-secondary">
        KitchenBase · v0.1 · esqueleto fundacional
      </p>
    </section>
  );
}
