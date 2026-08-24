import { useState, useRef, useEffect } from "react";

// Controlado por el padre (value/onChange) -- aplica de inmediato al elegir
// una opción, sin paso de "Aplicar" aparte (ver ChannelRendimientoGeneral.jsx
// para cómo se usa el valor elegido para filtrar filas de verdad).
export default function FilterPill({ label, options = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const seleccionado = value ?? null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 bg-white text-brand-purple text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap shadow-sm hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
      >
        {seleccionado === null ? label : `${label}: ${seleccionado}`}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="#57007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-[180px] max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-slate-100 py-1 max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange?.(null);
              setOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
          >
            Todos
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange?.(opt);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
