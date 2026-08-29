import { useState } from "react";
import PeriodPicker from "./PeriodPicker";
import PeriodFilterPill from "./PeriodFilterPill";
import FilterPill from "./FilterPill";

// `filters`: [{ label, options, value, onChange }] -- el padre (la página del
// canal) es quien guarda cuál está elegido y filtra sus propias filas/datos;
// este componente solo se encarga de mostrar los pills. "Borrar Filtros"
// limpia todo eso a través de `onClearFilters`, que el padre implementa
// reseteando su propio estado (no hay estado local de filtro acá) -- salvo
// PeriodPicker/PeriodFilterPill, que siguen siendo dueños de su propio
// calendario; se los remonta con `key` para que también se vean limpios
// visualmente.
// `periodFilter`: { label, meses, onChange } -- filtro de periodo estilo GA4
// (CampanasServidas.jsx), independiente de `showPeriodPicker`/PeriodPicker
// (que siguen usando los 5 canales de campaña sin tocar).
export default function GradientHeader({
  title,
  filters = [],
  onApplyPeriod,
  onClearFilters,
  onDownload,
  showDownload = true,
  noWrap = false,
  showPeriodPicker = true,
  periodoInicial,
  periodFilter,
}) {
  const [periodoResetKey, setPeriodoResetKey] = useState(0);

  const handleClearFilters = () => {
    setPeriodoResetKey((k) => k + 1);
    onClearFilters?.();
  };

  return (
    <div className="relative rounded-2xl bg-gradient-to-r from-brand-purple to-brand-magenta px-4 py-5 sm:px-6 sm:py-6 mb-6">
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <svg
          className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-20"
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
      </div>

      <div
        className={`relative flex items-center justify-between gap-4 ${noWrap ? "flex-nowrap" : "flex-wrap"}`}
      >
        <h1 className={`text-white font-bold text-2xl md:text-3xl ${noWrap ? "shrink-0" : ""}`}>{title}</h1>

        <div className="flex flex-wrap items-center gap-2">
          {(filters.length > 0 || periodFilter) && (
            <>
              {showPeriodPicker && (
                <PeriodPicker
                  key={periodoResetKey}
                  onApply={onApplyPeriod}
                  initialStartDay={periodoInicial?.startDay}
                  initialEndDay={periodoInicial?.endDay}
                />
              )}
              {periodFilter && (
                <PeriodFilterPill
                  key={periodoResetKey}
                  label={periodFilter.label}
                  meses={periodFilter.meses}
                  onChange={periodFilter.onChange}
                />
              )}
              {filters.map((f) => (
                <FilterPill
                  key={f.label}
                  label={f.label}
                  options={f.options}
                  value={f.value}
                  onChange={f.onChange}
                  hideValueInLabel={f.hideValueInLabel}
                />
              ))}
              <button
                type="button"
                onClick={handleClearFilters}
                className="bg-white text-brand-purple text-sm font-medium px-4 py-2 rounded-full border border-brand-purple whitespace-nowrap hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Borrar Filtros
              </button>
            </>
          )}
          {showDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={!onDownload}
              aria-disabled={!onDownload}
              title={onDownload ? "Descargar lo que estás viendo" : "No hay datos para descargar en esta vista"}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border whitespace-nowrap ${
                onDownload
                  ? "bg-white text-brand-purple border-brand-purple hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  : "bg-white/50 text-brand-purple/60 border-brand-purple/30 cursor-not-allowed"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="#57007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={onDownload ? "1" : "0.6"} />
              </svg>
              Descargar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
