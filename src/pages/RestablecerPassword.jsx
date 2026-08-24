import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import mediaudienceLogo from "../assets/brand/mediaudience-logo.png";

export default function RestablecerPassword() {
  const { restablecerPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (passwordNueva.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (passwordNueva !== passwordConfirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await restablecerPassword(token, passwordNueva);
      navigate("/login", { state: { passwordRestablecida: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-8 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <img src={mediaudienceLogo} alt="Mediaudience" className="h-16 w-auto" />
        </div>

        <h1 className="text-[#3a4752] text-2xl font-bold mb-2">Elegí tu nueva contraseña</h1>

        {!token ? (
          <>
            <p className="text-slate-label text-sm mb-8 leading-relaxed">
              Este enlace no es válido. Pedí uno nuevo desde la pantalla de inicio de sesión.
            </p>
            <Link to="/olvide-password" className="text-sm font-bold text-brand-purple hover:underline">
              Pedir un enlace nuevo
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="passwordNueva" className="block text-sm font-bold text-gray-700 mb-1.5">
                Contraseña nueva
              </label>
              <input
                id="passwordNueva"
                name="passwordNueva"
                type="password"
                required
                autoComplete="new-password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                className="w-full rounded-lg bg-[#e8f0fe] border border-transparent px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>
            <div>
              <label htmlFor="passwordConfirmar" className="block text-sm font-bold text-gray-700 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                id="passwordConfirmar"
                name="passwordConfirmar"
                type="password"
                required
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
              disabled={loading}
              className="w-full mt-2 rounded-full bg-brand-purple text-white font-bold text-sm py-2.5 px-4 hover:bg-brand-purple/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
