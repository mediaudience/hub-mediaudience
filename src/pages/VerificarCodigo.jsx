import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/common/AuthLayout";

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
    <AuthLayout>

          <span className="inline-block mb-5 label-mono text-[11px] text-semaphore-orange border border-semaphore-orange/40 rounded-md px-2.5 py-1.5">
            Sesión expirada por inactividad
          </span>
          <h1 className="text-gray-900 font-display font-medium text-[30px] leading-tight tracking-tight mb-2">Revisa tu correo</h1>
          <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
            Te enviamos un código de 4 dígitos a <strong className="text-gray-900 font-medium">{email}</strong>. Vence en 5 minutos.
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="codigo" className="block label-mono text-gray-500 mb-2">
                Código
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
                className="w-full h-16 rounded-md bg-surface border border-line px-4 font-mono text-[28px] tracking-[0.6em] text-center text-gray-900 focus:outline-none focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/20"
              />
            </div>

            <button
              type="button"
              onClick={handleReenviar}
              disabled={espera > 0}
              className="text-sm text-brand-purple text-left disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {espera > 0 ? `Reenviar código en ${espera}s` : "Reenviar código"}
            </button>

            {error && (
              <div role="alert" className="rounded-md border border-semaphore-red/30 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || codigo.length !== 4}
              className="w-full mt-2 h-12 rounded-md bg-brand-purple text-on-accent font-mono font-medium text-sm px-4 hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              {enviando ? "Verificando..." : "Verificar y entrar →"}
            </button>
          </form>
    </AuthLayout>
  );
}
