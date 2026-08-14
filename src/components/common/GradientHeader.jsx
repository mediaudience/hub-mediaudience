import { useState } from "react";
import PeriodPicker from "./PeriodPicker";
import FilterPill from "./FilterPill";

export default function GradientHeader({ title, filters = [], onApplyPeriod, onClearFilters }) {
  const [resetKey, setResetKey] = useState(0);

  const handleClearFilters = () => {
    setResetKey((k) => k + 1);
    onClearFilters?.();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-purple to-brand-magenta px-6 py-6 mb-6">
      <svg
        className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none"
        width="220"
        height="220"
        viewBox="0 0 220 220"
        fill="none"
      >
        <circle cx="60" cy="110" r="90" stroke="white" strokeWidth="2" />
        <circle cx="60" cy="110" r="60" stroke="white" strokeWidth="2" />
        <circle cx="60" cy="110" r="32" stroke="white" strokeWidth="2" />
        <circle cx="60" cy="110" r="10" fill="white" />
      </svg>

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-white font-bold text-2xl md:text-3xl">{title}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker onApply={onApplyPeriod} />
          {filters.map((f) => (
            <FilterPill key={f.label} label={f.label} options={f.options} resetKey={resetKey} />
          ))}
          <button
            type="button"
            onClick={handleClearFilters}
            className="bg-white text-brand-purple text-sm font-medium px-4 py-2 rounded-full border border-brand-purple whitespace-nowrap hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Borrar Filtros
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Próximamente"
            className="flex items-center gap-2 bg-white/50 text-brand-purple/60 text-sm font-medium px-4 py-2 rounded-full border border-brand-purple/30 whitespace-nowrap cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="#57007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
            </svg>
            Descargar
          </button>
        </div>
      </div>
    </div>
  );
}
