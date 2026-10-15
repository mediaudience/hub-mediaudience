import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import VerificarCodigo from "./VerificarCodigo";
import AuthLayout from "../components/common/AuthLayout";

export default function Login() {
  const { login, otpPendiente, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/";

  // Cubre tanto el login directo como el que se completa un paso después, al
  // verificar el código OTP (VerificarCodigo llama a un método de contexto
  // distinto que también termina fijando `user`).
  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (otpPendiente) {
    return <VerificarCodigo email={otpPendiente} />;
  }

  return (
    <AuthLayout>

            <h1 className="text-gray-900 font-display font-medium text-[30px] leading-tight tracking-tight mb-2">Ingresar</h1>
            <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
              Usa el correo con el que te invitamos al hub.
            </p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="block label-mono text-gray-500 mb-2">
                  Correo
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

              <div>
                <label htmlFor="password" className="block label-mono text-gray-500 mb-2">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-md bg-surface border border-line px-4 text-[15px] text-gray-900 focus:outline-none focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/20"
                />
              </div>

              <Link to="/olvide-password" className="text-sm text-brand-purple hover:underline -mt-1 self-start">
                ¿Has olvidado tu contraseña?
              </Link>

              {location.state?.passwordRestablecida && (
                <div className="rounded-md border border-semaphore-green/30 bg-green-50 px-3.5 py-2.5 text-sm text-green-700">
                  Tu contraseña quedó actualizada. Ya puedes iniciar sesión.
                </div>
              )}

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
                {loading ? "Ingresando..." : "Ingresar →"}
              </button>
            </form>

            <div className="mt-6 flex gap-3 items-start rounded-md border border-line bg-surface px-4 py-3.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="shrink-0 mt-0.5 text-gray-500">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <p className="text-[13px] leading-relaxed text-gray-500">
                Si tu sesión se cierra por inactividad, te enviaremos un código a tu correo para volver a entrar.
              </p>
            </div>
    </AuthLayout>
  );
}
