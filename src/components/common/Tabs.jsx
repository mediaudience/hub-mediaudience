function MegaphoneIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10v4a1 1 0 001 1h2l8 4V5l-8 4H4a1 1 0 00-1 1z"
        fill={active ? "#57007E" : "#94a3b8"}
      />
      <path d="M18 9a4 4 0 010 6" stroke={active ? "#57007E" : "#94a3b8"} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClipIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 8V6a3 3 0 016 0v9a2 2 0 01-4 0V8"
        stroke={active ? "#57007E" : "#94a3b8"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ICONS = { megaphone: MegaphoneIcon, clip: ClipIcon };

// `actions`: nodo opcional que se ancla al extremo derecho de la barra de
// pestañas (ej. el botón Descargar en ChannelRendimientoGeneral.jsx) -- así
// no compite por espacio con los filtros de GradientHeader más arriba.
export default function Tabs({ tabs, active, onChange, actions }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white rounded-t-xl px-5">
      <div className="flex items-center gap-6 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.icon] || MegaphoneIcon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative flex items-center gap-2 py-3 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-purple ${
                isActive ? "text-brand-purple" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon active={isActive} />
              {tab.label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-[3px] bg-blue-500 rounded-t" />
              )}
            </button>
          );
        })}
      </div>
      {actions && <div className="shrink-0 py-2">{actions}</div>}
    </div>
  );
}
