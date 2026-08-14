import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NAV_GROUPS } from "../../navConfig";

function ChevronDown({ className }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-magenta"
      >
        Nombre Usuario
        <ChevronDown className={`text-slate-label transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-20 left-2 right-2 mt-1 bg-white rounded-lg shadow-lg border border-slate-100 py-1"
        >
          <button
            type="button"
            role="menuitem"
            disabled
            aria-disabled="true"
            title="Próximamente"
            className="w-full text-left px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

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

export default function Sidebar({ collapsed }) {
  const location = useLocation();
  const activeGroupId = NAV_GROUPS.find((g) =>
    g.items.some((i) => location.pathname.startsWith(i.path))
  )?.id;
  const [openGroups, setOpenGroups] = useState(() =>
    activeGroupId ? { [activeGroupId]: true } : {}
  );

  const toggleGroup = (id) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 bg-white border-r border-slate-100 overflow-y-auto transition-all duration-200 z-30 ${
        collapsed ? "w-0 -translate-x-full" : "w-[245px]"
      }`}
    >
      <div className="w-[245px]">
        <div className="relative h-28 overflow-hidden">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 245 112"
            preserveAspectRatio="none"
          >
            <rect width="245" height="112" fill="#57007E" />
            <polygon points="0,112 60,40 120,90 245,20 245,112" fill="#7a1aa6" opacity="0.7" />
            <polygon points="0,112 90,70 180,112" fill="#c4216f" opacity="0.5" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow">
              <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="19" stroke="#57007E" strokeWidth="2" opacity="0.35" />
                <circle cx="20" cy="20" r="12" stroke="#57007E" strokeWidth="2" opacity="0.6" />
                <circle cx="20" cy="20" r="5" fill="#57007E" />
              </svg>
            </div>
          </div>
        </div>

        <UserMenu />

        <nav className="px-2 pb-6">
          {NAV_GROUPS.map((group) => {
            const open = !!openGroups[group.id];
            return (
              <div key={group.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-label hover:bg-slate-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-magenta"
                >
                  <span>{group.label}</span>
                  <GroupArrow open={open} />
                </button>
                {open && (
                  <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
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
