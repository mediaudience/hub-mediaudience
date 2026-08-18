import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import LoginIllustration from "../components/common/LoginIllustration";
import LoginBackgroundPattern from "../components/common/LoginBackgroundPattern";
import mediaudienceLogo from "../assets/brand/mediaudience-logo.png";

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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[35%_65%] bg-white">
      <div className="flex items-center justify-center px-8 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <img src={mediaudienceLogo} alt="Mediaudience" className="h-16 w-auto" />
          </div>

          <h1 className="text-[#3a4752] text-2xl font-bold mb-2">Crea tu contraseña</h1>
          <p className="text-slate-label text-sm mb-8 leading-relaxed">
            Por seguridad, antes de continuar debes reemplazar la contraseña temporal.
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="passwordActual" className="block text-sm font-bold text-gray-700 mb-1.5">
                Contraseña temporal
              </label>
              <input
                id="passwordActual"
                type="password"
                required
                autoComplete="current-password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                className="w-full rounded-lg bg-[#e8f0fe] border border-transparent px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>

            <div>
              <label htmlFor="passwordNueva" className="block text-sm font-bold text-gray-700 mb-1.5">
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
                className="w-full rounded-lg bg-[#e8f0fe] border border-transparent px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
              <p className="text-xs text-slate-label mt-1">Mínimo 8 caracteres.</p>
            </div>

            <div>
              <label htmlFor="passwordConfirmar" className="block text-sm font-bold text-gray-700 mb-1.5">
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
                className="w-full rounded-lg bg-[#e8f0fe] border border-transparent px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full mt-2 rounded-full bg-brand-purple text-white font-bold text-sm py-2.5 px-4 hover:bg-brand-purple/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              {enviando ? "Guardando..." : "Guardar y continuar"}
            </button>

            <button type="button" onClick={logout} className="text-sm text-slate-label text-left">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex relative items-center justify-center bg-bg-app p-10 overflow-hidden">
        <LoginBackgroundPattern />
        <div className="relative w-full max-w-xl">
          <LoginIllustration />
        </div>
      </div>
    </div>
  );
}
