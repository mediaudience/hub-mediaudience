import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import mediaudienceLogoBlanco from "../../assets/brand/mediaudience-logo-blanco.png";

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
  const navigate = useNavigate();

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
        className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 text-brand-purple font-bold text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.nombre}</p>
            <p className="text-xs text-slate-label truncate">{user?.email}</p>
            {user?.rol && (
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-purple/10 text-brand-purple">
                {ROL_LABEL[user.rol] ?? user.rol}
              </span>
            )}
          </div>

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
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-brand-purple flex items-center justify-between px-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
          aria-expanded={sidebarOpen}
          className="text-white/90 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <img src={mediaudienceLogoBlanco} alt="Mediaudience" className="h-10 w-auto" />
      </div>

      <AccountMenu />
    </header>
  );
}
