import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ADMIN_NAV_GROUP, GESTION_NAV_GROUP } from "../../navConfig";
import useNavGroups from "../../hooks/useNavGroups";

function GroupArrow({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar({ open, onNavigate }) {
  const location = useLocation();
  const { groups } = useNavGroups();
  const activeGroupId = groups.find((g) =>
    g.items.some((i) => location.pathname.startsWith(i.path))
  )?.id;
  const [openGroups, setOpenGroups] = useState(() =>
    activeGroupId ? { [activeGroupId]: true } : {}
  );

  const toggleGroup = (id) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 w-[245px] bg-white border-r border-slate-100 overflow-y-auto transition-transform duration-200 z-40 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="w-[245px]">
        <nav className="px-2 pt-4 pb-6">
          {/* Acceso suelto, no colapsable -- es un solo destino (no una
              categoría con sub-secciones como los grupos de abajo), pedido
              por Jose el 2026-08-27 para volver a la Home sin depender del
              logo del Navbar. */}
          <NavLink
            to="/"
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2.5 mb-2 rounded-lg text-sm font-bold text-brand-magenta transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-magenta ${
                isActive ? "bg-brand-magenta/10" : ""
              }`
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 11.5L12 4l8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 10v9a1 1 0 001 1h4v-6h2v6h4a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            Página Principal
          </NavLink>

          {groups.map((group) => {
            const open = !!openGroups[group.id];
            const isAdminGroup = group.id === ADMIN_NAV_GROUP.id;
            const isCampanasGroup = group.id === "campanas";
            const isGestionGroup = group.id === GESTION_NAV_GROUP.id;
            return (
              <div
                key={group.id}
                className={isAdminGroup || isGestionGroup ? "mb-1 mt-3 pt-3 border-t border-slate-100" : "mb-1"}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-magenta ${
                    isAdminGroup || isCampanasGroup || isGestionGroup ? "text-brand-magenta" : "text-slate-label"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isAdminGroup && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    {isCampanasGroup && (
                      // Blanco de tiro / bullseye -- alude a "targetear" una
                      // campaña, y retoma el mismo motivo de círculos
                      // concéntricos que ya usa GradientHeader.jsx como marca.
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      </svg>
                    )}
                    {isGestionGroup && (
                      // Clipboard con check -- gestión/seguimiento interno del negocio.
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="2" />
                        <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="2" />
                        <path d="M9 12.5l2 2 4-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {group.label}
                  </span>
                  <GroupArrow open={open} />
                </button>
                {open && (
                  <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `mx-1 px-3 py-2 rounded-full text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-magenta ${
                            isActive
                              ? "bg-brand-magenta text-white font-medium"
                              : "text-gray-600 hover:bg-slate-50"
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
