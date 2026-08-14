import { useState, useRef, useEffect } from "react";

export default function FilterPill({ label, options = [] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("Todos");
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
        className="flex items-center gap-2 bg-white text-brand-purple text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap shadow-sm hover:bg-white/90"
      >
        {selected === "Todos" ? label : `${label}: ${selected}`}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="#57007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-[180px] bg-white rounded-lg shadow-lg border border-slate-100 py-1 max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              setSelected("Todos");
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
                setSelected(opt);
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
