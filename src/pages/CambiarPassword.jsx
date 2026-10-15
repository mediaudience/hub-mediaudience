import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/common/AuthLayout";

export default function CambiarPassword() {
  const { cambiarPassword, logout } = useAuth();
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (passwordNueva !== passwordConfirmar) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setEnviando(true);
    try {
      await cambiarPassword(passwordActual, passwordNueva);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>

          <h1 className="text-gray-900 font-display font-medium text-[30px] leading-tight tracking-tight mb-2">Crea tu contraseña</h1>
          <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
            Por seguridad, antes de continuar debes reemplazar la contraseña temporal.
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="passwordActual" className="block label-mono text-gray-500 mb-2">
                Contraseña temporal
              </label>
              <input
                id="passwordActual"
                type="password"
                required
                autoComplete="current-password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                className="w-full h-12 rounded-md bg-surface border border-line px-4 text-[15px] text-gray-900 focus:outline-none focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/20"
              />
            </div>

            <div>
              <label htmlFor="passwordNueva" className="block label-mono text-gray-500 mb-2">
                Contraseña nueva
              </label>
              <input
                id="passwordNueva"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                className="w-full h-12 rounded-md bg-surface border border-line px-4 text-[15px] text-gray-900 focus:outline-none focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/20"
              />
              <p className="text-xs text-slate-label mt-1">Mínimo 8 caracteres.</p>
            </div>

            <div>
              <label htmlFor="passwordConfirmar" className="block label-mono text-gray-500 mb-2">
                Confirmar contraseña nueva
              </label>
              <input
                id="passwordConfirmar"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordConfirmar}
                onChange={(e) => setPasswordConfirmar(e.target.value)}
                className="w-full h-12 rounded-md bg-surface border border-line px-4 text-[15px] text-gray-900 focus:outline-none focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/20"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-md border border-semaphore-red/30 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full mt-2 h-12 rounded-md bg-brand-purple text-on-accent font-mono font-medium text-sm px-4 hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              {enviando ? "Guardando..." : "Guardar y continuar"}
            </button>

            <button type="button" onClick={logout} className="text-sm text-slate-label text-left">
              Cerrar sesión
            </button>
          </form>
    </AuthLayout>
  );
}
