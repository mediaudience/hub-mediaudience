import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useClienteActivo } from "../../context/ClienteActivoContext";
import BrandLogo from "../common/BrandLogo";

const ROL_LABEL = {
  super_admin: "Super Admin",
  admin: "Admin",
  usuario_interno: "Usuario Interno",
  usuario_externo: "Usuario Externo",
};

function getInitials(nombre) {
  const parts = nombre?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { user, logout } = useAuth();
  const { clientes, clienteActivo, setClienteActivo } = useClienteActivo();
  const navigate = useNavigate();

  const clientesPorPais = [];
  for (const c of clientes) {
    const grupo = c.paisNombre ?? "Sin país";
    const ultimo = clientesPorPais[clientesPorPais.length - 1];
    if (ultimo && ultimo[0] === grupo) ultimo[1].push(c);
    else clientesPorPais.push([grupo, [c]]);
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const initials = getInitials(user?.nombre);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Cuenta"
        className="w-9 h-9 rounded-md bg-surface-2 border border-brand-purple/40 flex items-center justify-center shrink-0 text-brand-purple font-display font-semibold text-xs hover:border-brand-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 bg-surface rounded-md shadow-lg border border-line py-1 z-50"
        >
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.nombre}</p>
            <p className="text-xs text-slate-label truncate">{user?.email}</p>
            {user?.rol && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded-md label-mono text-[10px] border border-brand-purple/40 bg-brand-purple/10 text-brand-purple">
                {ROL_LABEL[user.rol] ?? user.rol}
              </span>
            )}
          </div>

          {clientes.length > 1 && (
            <div className="px-4 py-3 border-b border-line">
              <p className="text-xs font-medium text-slate-label mb-1.5">Cliente</p>
              <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={clienteActivo === null}
                  onClick={() => setClienteActivo(null)}
                  className={`text-left px-2 py-1.5 rounded-md text-sm shrink-0 ${
                    clienteActivo === null ? "bg-brand-purple/10 text-brand-purple font-medium" : "text-gray-700 hover:bg-slate-50"
                  }`}
                >
                  Todos los clientes
                </button>
                {clientesPorPais.map(([pais, lista]) => (
                  <div key={pais} className="flex flex-col gap-0.5">
                    <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-label/70 shrink-0">
                      {pais}
                    </p>
                    {lista.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={clienteActivo === c.nombre}
                        onClick={() => setClienteActivo(c.nombre)}
                        className={`text-left px-2 py-1.5 rounded-md text-sm truncate shrink-0 ${
                          clienteActivo === c.nombre ? "bg-brand-purple/10 text-brand-purple font-medium" : "text-gray-700 hover:bg-slate-50"
                        }`}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(user?.rol === "super_admin" || user?.rol === "admin") && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate("/admin/usuarios");
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
            >
              Administración
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar({ onToggleSidebar, sidebarOpen }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-ink-deep/95 backdrop-blur border-b border-line flex items-center justify-between px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
          aria-expanded={sidebarOpen}
          className="text-gray-500 hover:text-gray-900 p-1.5 rounded-md hover:bg-surface-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <BrandLogo size={18} showHub className="ml-2" />
      </div>

      <AccountMenu />
    </header>
  );
}
