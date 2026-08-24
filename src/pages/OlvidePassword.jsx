import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginIllustration from "../components/common/LoginIllustration";
import LoginBackgroundPattern from "../components/common/LoginBackgroundPattern";
import mediaudienceLogo from "../assets/brand/mediaudience-logo.png";

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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[35%_65%] bg-white">
      <div className="flex items-center justify-center px-8 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <img src={mediaudienceLogo} alt="Mediaudience" className="h-16 w-auto" />
          </div>

          <h1 className="text-[#3a4752] text-2xl font-bold mb-2">¿Has olvidado tu contraseña?</h1>

          {enviado ? (
            <>
              <p className="text-slate-label text-sm mb-8 leading-relaxed">
                Si <strong>{email}</strong> tiene una cuenta en el panel, te mandamos un enlace para elegir una
                contraseña nueva. Revisa tu correo (y la carpeta de spam, por las dudas).
              </p>
              <Link to="/login" className="text-sm font-bold text-brand-purple hover:underline">
                Volver a iniciar sesión
              </Link>
            </>
          ) : (
            <>
              <p className="text-slate-label text-sm mb-8 leading-relaxed">
                Escribe tu email y te mandamos un enlace para restablecerla.
              </p>
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1.5">
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
                  disabled={loading}
                  className="w-full mt-2 rounded-full bg-brand-purple text-white font-bold text-sm py-2.5 px-4 hover:bg-brand-purple/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>

                <Link to="/login" className="text-sm text-brand-purple hover:underline text-center mt-1">
                  Volver a iniciar sesión
                </Link>
              </form>
            </>
          )}
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
