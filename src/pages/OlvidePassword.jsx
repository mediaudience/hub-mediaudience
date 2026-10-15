import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/common/AuthLayout";

export default function OlvidePassword() {
  const { solicitarRecuperacion } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await solicitarRecuperacion(email);
      setEnviado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>

          <h1 className="text-gray-900 font-display font-medium text-[30px] leading-tight tracking-tight mb-2">¿Has olvidado tu contraseña?</h1>

          {enviado ? (
            <>
              <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
                Si <strong>{email}</strong> tiene una cuenta en el panel, te mandamos un enlace para elegir una
                contraseña nueva. Revisa tu correo (y la carpeta de spam, por las dudas).
              </p>
              <Link to="/login" className="text-sm font-bold text-brand-purple hover:underline">
                Volver a iniciar sesión
              </Link>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
                Escribe tu email y te mandamos un enlace para restablecerla.
              </p>
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className="block label-mono text-gray-500 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  disabled={loading}
                  className="w-full mt-2 h-12 rounded-md bg-brand-purple text-on-accent font-mono font-medium text-sm px-4 hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>

                <Link to="/login" className="text-sm text-brand-purple hover:underline text-center mt-1">
                  Volver a iniciar sesión
                </Link>
              </form>
            </>
          )}
    </AuthLayout>
  );
}
