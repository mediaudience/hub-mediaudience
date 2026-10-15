import { useState } from "react";
import PeriodPicker from "./PeriodPicker";
import PeriodFilterPill from "./PeriodFilterPill";
import FilterPill from "./FilterPill";
import DownloadButton from "./DownloadButton";

// `filters`: [{ label, options, value, onChange }] -- el padre (la página del
// canal) es quien guarda cuál está elegido y filtra sus propias filas/datos;
// este componente solo se encarga de mostrar los pills. "Borrar Filtros"
// limpia todo eso a través de `onClearFilters`, que el padre implementa
// reseteando su propio estado (no hay estado local de filtro acá) -- salvo
// PeriodPicker/PeriodFilterPill, que siguen siendo dueños de su propio
// calendario; se los remonta con `key` para que también se vean limpios
// visualmente.
// `periodFilter`: { label, onChange } -- filtro de periodo estilo GA4
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

  // Layout "Signal": ya no es un banner degradado -- título sobre el fondo y
  // los filtros en una barra de superficie debajo. Se mantiene el nombre del
  // componente para no tocar las páginas que lo usan.
  const hayControles = filters.length > 0 || periodFilter || showDownload;
  return (
    <div className="mb-6 flex flex-col gap-4">
      <h1 className={`font-display font-medium text-gray-900 text-[28px] md:text-[34px] leading-tight tracking-tight ${noWrap ? "shrink-0" : ""}`}>
        {title}
      </h1>

      {hayControles && (
      <div
        className={`flex items-center justify-between gap-3 bg-surface border border-line rounded-md p-2.5 ${noWrap ? "flex-nowrap" : "flex-wrap"}`}
      >
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
                <PeriodFilterPill key={periodoResetKey} label={periodFilter.label} onChange={periodFilter.onChange} />
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
                className="h-10 bg-transparent text-gray-500 text-sm font-medium px-3.5 rounded-md border border-transparent whitespace-nowrap hover:text-gray-900 hover:border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
              >
                Borrar Filtros
              </button>
            </>
          )}
          {showDownload && <DownloadButton onDownload={onDownload} />}
        </div>
      </div>
      )}
    </div>
  );
}
