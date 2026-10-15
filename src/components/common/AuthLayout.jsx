import BrandLogo from "./BrandLogo";

// Marco común de las pantallas sin sesión (login, código de reingreso,
// olvidé/restablecer/crear contraseña) en el layout "Signal": panel de marca
// a la izquierda (solo en pantallas anchas) y el formulario a la derecha.
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] bg-bg-app">
      <div
        className="hidden lg:flex flex-col justify-between gap-12 px-16 py-12 bg-ink-deep border-r border-line"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        <BrandLogo size={22} showHub />
        <div className="flex flex-col gap-5 max-w-[480px]">
          <span className="label-mono text-xs text-brand-purple">Insights · clientes y equipo</span>
          <p className="font-display font-medium text-[52px] leading-[1.05] tracking-[-0.03em] text-gray-900">
            El rendimiento de tus campañas, <span className="text-brand-purple">en un solo lugar</span>
          </p>
          <p className="text-[17px] leading-relaxed text-gray-500">
            Connected TV, Mobile Push, Programmatic, YouTube y TikTok, actualizados cada día desde tus reportes.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 label-mono text-[11px] text-gray-400">
          <span>Perú</span>
          <span>Ecuador</span>
          <span>México</span>
          <span>Chile</span>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <BrandLogo size={20} showHub />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
