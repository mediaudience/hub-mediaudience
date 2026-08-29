import { useState, useRef, useEffect } from "react";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const AUTO_OPTIONS = [
  "Personalizado", "Hoy", "Ayer", "Últimos 7 días", "Últimos 30 días", "Este mes", "Mes anterior",
];

function daysGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: startOffset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function Calendar({ label, year, month, onNav, selectedDay, onSelectDay }) {
  const cells = daysGrid(year, month);
  return (
    <div className="w-56">
      <p className="text-xs font-semibold text-slate-label mb-2">{label}</p>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => onNav(-1)} className="p-1 text-brand-purple hover:bg-slate-50 rounded">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-800">{MONTHS[month]} {year}</span>
        <button type="button" onClick={() => onNav(1)} className="p-1 text-brand-purple hover:bg-slate-50 rounded">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[11px] font-semibold text-slate-label">{w}</span>
        ))}
        {cells.map((d, i) => {
          const isSelected =
            d && selectedDay && selectedDay.year === year && selectedDay.month === month && selectedDay.day === d;
          return (
            <button
              key={i}
              type="button"
              disabled={!d}
              onClick={() => d && onSelectDay({ year, month, day: d })}
              className={`text-xs h-7 w-7 mx-auto rounded-full transition-colors ${
                !d ? "" : isSelected ? "bg-brand-purple text-white font-semibold" : "text-gray-700 hover:bg-slate-100"
              }`}
            >
              {d || ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PeriodPicker({ onApply, initialStartDay = null, initialEndDay = null }) {
  const [open, setOpen] = useState(false);
  const [autoPeriod, setAutoPeriod] = useState(initialStartDay ? "Este mes" : "Personalizado");
  const [autoOpen, setAutoOpen] = useState(false);
  const today = new Date();
  const [leftView, setLeftView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [rightView, setRightView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [startDay, setStartDay] = useState(initialStartDay);
  const [endDay, setEndDay] = useState(initialEndDay);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const navMonth = (setView) => (delta) =>
    setView((v) => {
      let month = v.month + delta;
      let year = v.year;
      if (month < 0) { month = 11; year -= 1; }
      if (month > 11) { month = 0; year += 1; }
      return { year, month };
    });

  const label = startDay && endDay
    ? `${startDay.day}/${startDay.month + 1} - ${endDay.day}/${endDay.month + 1}/${endDay.year}`
    : "Periodo";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 bg-white text-brand-purple text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap shadow-sm hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="#57007E" strokeWidth="1.8" />
          <path d="M3 9h18M8 3v4M16 3v4" stroke="#57007E" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="#57007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed left-1/2 top-20 -translate-x-1/2 sm:absolute sm:left-auto sm:top-full sm:translate-x-0 sm:right-0 sm:mt-2 z-30 bg-white rounded-xl shadow-xl border border-slate-100 p-4 w-[92vw] max-w-[520px]">
          <div className="relative mb-4">
            <button
              type="button"
              onClick={() => setAutoOpen((o) => !o)}
              className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-gray-700"
            >
              {autoPeriod}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#57007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {autoOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-slate-100 py-1">
                {AUTO_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setAutoPeriod(opt); setAutoOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-slate-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center max-h-[60vh] overflow-y-auto sm:max-h-none sm:overflow-visible">
            <Calendar
              label="Fecha de inicio"
              year={leftView.year}
              month={leftView.month}
              onNav={navMonth(setLeftView)}
              selectedDay={startDay}
              onSelectDay={setStartDay}
            />
            <Calendar
              label="Fecha de finalización"
              year={rightView.year}
              month={rightView.month}
              onNav={navMonth(setRightView)}
              selectedDay={endDay}
              onSelectDay={setEndDay}
            />
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={() => {
                onApply?.({ startDay, endDay });
                setOpen(false);
              }}
              className="bg-brand-purple text-white text-sm font-medium px-6 py-2 rounded-full hover:bg-brand-purple/90"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
