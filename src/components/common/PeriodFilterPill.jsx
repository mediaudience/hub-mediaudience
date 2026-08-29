import { useState, useRef, useEffect } from "react";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const PRESETS = ["Hoy", "Ayer", "Últimos 7 días", "Últimos 30 días", "Este mes", "Mes anterior"];

function pad(n) {
  return String(n).padStart(2, "0");
}
function diaObjISO(day) {
  return day ? `${day.year}-${pad(day.month + 1)}-${pad(day.day)}` : null;
}
function aDay(fechaJs) {
  return { year: fechaJs.getFullYear(), month: fechaJs.getMonth(), day: fechaJs.getDate() };
}
function sumarDias(fecha, delta) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + delta);
  return d;
}

// Cada preset calcula un rango real -- a diferencia del PeriodPicker viejo
// (src/components/common/PeriodPicker.jsx), donde elegir "Hoy"/"Este mes"
// etc. no hacía nada salvo cambiar el texto del botón, sin tocar las fechas
// seleccionadas. Acá cada opción sí produce un rango real de inicio/fin.
function rangoPreset(nombre) {
  const hoy = new Date();
  switch (nombre) {
    case "Hoy":
      return { inicio: aDay(hoy), fin: aDay(hoy) };
    case "Ayer": {
      const ayer = sumarDias(hoy, -1);
      return { inicio: aDay(ayer), fin: aDay(ayer) };
    }
    case "Últimos 7 días":
      return { inicio: aDay(sumarDias(hoy, -6)), fin: aDay(hoy) };
    case "Últimos 30 días":
      return { inicio: aDay(sumarDias(hoy, -29)), fin: aDay(hoy) };
    case "Este mes": {
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      return {
        inicio: { year: hoy.getFullYear(), month: hoy.getMonth(), day: 1 },
        fin: { year: hoy.getFullYear(), month: hoy.getMonth(), day: ultimoDia },
      };
    }
    case "Mes anterior": {
      const ref = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimoDia = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      return {
        inicio: { year: ref.getFullYear(), month: ref.getMonth(), day: 1 },
        fin: { year: ref.getFullYear(), month: ref.getMonth(), day: ultimoDia },
      };
    }
    default:
      return null;
  }
}

// Para que el padre (ej. CampanasServidas.jsx) pueda arrancar/resetear con
// el mismo rango "Este mes" que ofrece el menú, sin duplicar el cálculo.
export function estePeriodoISO(nombrePreset) {
  const rango = rangoPreset(nombrePreset);
  return { inicio: diaObjISO(rango.inicio), fin: diaObjISO(rango.fin) };
}

function ultimoDiaDeClave(clave) {
  const [y, m] = clave.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function daysGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Lunes = 0
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

// Filtro de periodo estilo GA4: el botón siempre muestra solo `label` (igual
// que FilterPill con hideValueInLabel -- ver CampanasServidas.jsx, pedido
// por Jose 2026-08-29 para que no se descuadren los filtros a 2 filas), pero
// al abrirlo da 3 formas de elegir rango: presets con fecha real (no solo
// texto), los meses concretos que ya tienen data (`meses`, opcional), o un
// calendario de rango manual ("Personalizado"). `onChange` siempre recibe
// `{ inicio, fin }` en ISO, o `null` para "Todos" -- el padre no necesita
// saber por cuál de las 3 formas se eligió.
export default function PeriodFilterPill({ label = "Periodo", meses = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState("menu"); // 'menu' | 'personalizado'
  const today = new Date();
  const [leftView, setLeftView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [rightView, setRightView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [startDay, setStartDay] = useState(null);
  const [endDay, setEndDay] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setModo("menu");
      }
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

  const cerrar = () => {
    setOpen(false);
    setModo("menu");
  };

  const elegirPreset = (nombre) => {
    const rango = rangoPreset(nombre);
    onChange?.({ inicio: diaObjISO(rango.inicio), fin: diaObjISO(rango.fin) });
    cerrar();
  };

  const elegirMes = (clave) => {
    onChange?.({ inicio: `${clave}-01`, fin: `${clave}-${pad(ultimoDiaDeClave(clave))}` });
    cerrar();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 bg-white text-brand-purple text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap shadow-sm hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
      >
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="#57007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-20 mt-1 right-0 bg-white rounded-xl shadow-xl border border-slate-100 p-3 ${
            modo === "menu" ? "w-64 max-h-80 overflow-y-auto" : "w-[92vw] max-w-[480px]"
          }`}
        >
          {modo === "menu" ? (
            <div className="py-1">
              <button
                type="button"
                onClick={() => { onChange?.(null); cerrar(); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-slate-50 rounded"
              >
                Todos
              </button>
              {PRESETS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => elegirPreset(opt)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-slate-50 rounded"
                >
                  {opt}
                </button>
              ))}
              {meses.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-slate-label border-t border-slate-100 mt-1">
                    Meses con data
                  </p>
                  {meses.map((m) => (
                    <button
                      key={m.clave}
                      type="button"
                      onClick={() => elegirMes(m.clave)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-slate-50 rounded"
                    >
                      {m.label}
                    </button>
                  ))}
                </>
              )}
              <button
                type="button"
                onClick={() => setModo("personalizado")}
                className="w-full text-left px-3 py-2 text-sm text-brand-purple font-medium hover:bg-slate-50 rounded border-t border-slate-100 mt-1 pt-2"
              >
                Personalizado…
              </button>
            </div>
          ) : (
            <div>
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
              <div className="flex justify-between mt-4">
                <button type="button" onClick={() => setModo("menu")} className="text-sm text-brand-purple font-medium px-3 py-2">
                  Volver
                </button>
                <button
                  type="button"
                  disabled={!startDay || !endDay}
                  onClick={() => {
                    onChange?.({ inicio: diaObjISO(startDay), fin: diaObjISO(endDay) });
                    cerrar();
                  }}
                  className="bg-brand-purple text-white text-sm font-medium px-6 py-2 rounded-full hover:bg-brand-purple/90 disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
