import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginIllustration from "../components/common/LoginIllustration";
import LoginBackgroundPattern from "../components/common/LoginBackgroundPattern";
import mediaudienceLogo from "../assets/brand/mediaudience-logo.png";

function BrandMark() {
  return <img src={mediaudienceLogo} alt="Mediaudience" className="h-16 w-auto" />;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
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
              <BrandMark />
            </div>

            <h1 className="text-[#3a4752] text-2xl font-bold mb-2">Insights - Mediaudience</h1>
            <p className="text-slate-label text-sm mb-8 leading-relaxed">
              ⭐ Conectamos marcas, Conectamos audiencias ⭐
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

              <div>
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-[#e8f0fe] border border-transparent px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                />
              </div>

              <span
                title="Próximamente"
                aria-disabled="true"
                className="text-sm text-brand-purple cursor-not-allowed select-none -mt-1"
              >
                ¿Has olvidado tu contraseña?
              </span>

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
                {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
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
