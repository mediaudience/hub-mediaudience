import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/common/AuthLayout";

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
    <AuthLayout>

        <h1 className="text-gray-900 font-display font-medium text-[30px] leading-tight tracking-tight mb-2">Elige tu nueva contraseña</h1>

        {!token ? (
          <>
            <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
              Este enlace no es válido. Pedí uno nuevo desde la pantalla de inicio de sesión.
            </p>
            <Link to="/olvide-password" className="text-sm font-bold text-brand-purple hover:underline">
              Pedir un enlace nuevo
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="passwordNueva" className="block label-mono text-gray-500 mb-2">
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
                className="w-full h-12 rounded-md bg-surface border border-line px-4 text-[15px] text-gray-900 focus:outline-none focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/20"
              />
            </div>
            <div>
              <label htmlFor="passwordConfirmar" className="block label-mono text-gray-500 mb-2">
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
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
    </AuthLayout>
  );
}
