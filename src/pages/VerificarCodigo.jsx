import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import LoginIllustration from "../components/common/LoginIllustration";
import LoginBackgroundPattern from "../components/common/LoginBackgroundPattern";
import mediaudienceLogo from "../assets/brand/mediaudience-logo.png";

const REENVIO_ESPERA_SEGUNDOS = 30;

export default function VerificarCodigo({ email }) {
  const { solicitarCodigo, verificarCodigo } = useAuth();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);

  // El primer código ya lo mandó /login (ver AuthContext.jsx) -- este efecto
  // solo arranca la cuenta regresiva para habilitar "Reenviar código".
  useEffect(() => {
    setEspera(REENVIO_ESPERA_SEGUNDOS);
  }, [email]);

  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  async function handleReenviar() {
    setError("");
    try {
      await solicitarCodigo(email);
      setEspera(REENVIO_ESPERA_SEGUNDOS);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await verificarCodigo(email, codigo);
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

          <h1 className="text-[#3a4752] text-2xl font-bold mb-2">Sesión expirada por inactividad</h1>
          <p className="text-slate-label text-sm mb-8 leading-relaxed">
            Te enviamos un código a <strong>{email}</strong>. Ingrésalo para volver a entrar.
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="codigo" className="block text-sm font-bold text-gray-700 mb-1.5">
                Código de 4 dígitos
              </label>
              <input
                id="codigo"
                name="codigo"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                required
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-lg bg-[#e8f0fe] border border-transparent px-4 py-2 text-2xl tracking-[0.5em] text-center font-semibold focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>

            <button
              type="button"
              onClick={handleReenviar}
              disabled={espera > 0}
              className="text-sm text-brand-purple text-left disabled:text-slate-label disabled:cursor-not-allowed"
            >
              {espera > 0 ? `Reenviar código en ${espera}s` : "Reenviar código"}
            </button>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || codigo.length !== 4}
              className="w-full mt-2 rounded-full bg-brand-purple text-white font-bold text-sm py-2.5 px-4 hover:bg-brand-purple/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              {enviando ? "Verificando..." : "Ingresar"}
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
