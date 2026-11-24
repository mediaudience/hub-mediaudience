import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "../common/Card";
import { formatNumber, formatUSD, TIER_COLORS } from "../../utils/format";

// Pestaña "Resumen" del servicio Performance (compra de leads / CPA), agregada
// 2026-11-24. Debajo de las KPI genéricas (canalMetricas.js) muestra lo que un
// reporte de performance necesita y los servicios de medios no tienen:
// avance de cada campaña contra su meta/budget/vigencia (pestaña "Campañas"
// del Sheet), el embudo Impresiones -> Clics -> Conversiones y la evolución
// diaria de clics y conversiones.

const AZUL = "#58B0FF";
const VERDE = "#3FDDB0";

const suma = (rows, key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);
const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (v) => `${(v ?? 0).toFixed(2)}%`;

function fechaCorta(fecha) {
  const p = String(fecha ?? "").split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : fecha;
}

function fechaLarga(fecha) {
  const p = String(fecha ?? "").split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fecha || "—";
}

// "Hoy" en Lima (UTC-5), como YYYY-MM-DD.
function hoyLima() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function Barra({ label, valor, total, texto, color = AZUL }) {
  const p = Math.min(pct(valor, total), 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs mb-1.5">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-800 tabular-nums">
          {texto} <span className="text-gray-500">· {pct(valor, total).toFixed(1)}%</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function AvanceCampana({ meta, filas }) {
  const aprobadas = suma(filas, "convAprobadas");
  const inversion = suma(filas, "inversion");
  const cpaReal = aprobadas > 0 ? inversion / aprobadas : null;

  const hoy = hoyLima();
  const totalDias = meta.inicio && meta.fin ? diasEntre(meta.inicio, meta.fin) + 1 : 0;
  const finCorte = meta.fin && hoy > meta.fin ? meta.fin : hoy;
  const transcurridos = totalDias > 0 ? Math.max(0, Math.min(totalDias, diasEntre(meta.inicio, finCorte) + 1)) : 0;
  const proyeccion = transcurridos > 0 ? Math.round((aprobadas / transcurridos) * totalDias) : null;

  const cpaOk = cpaReal !== null && meta.cpaObjetivo > 0 && cpaReal <= meta.cpaObjetivo;

  return (
    <Card hover={false} className="p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-gray-900">{meta.campana}</h3>
          <p className="text-xs text-slate-label mt-0.5">
            {meta.eventoPagable ? `Evento pagable: ${meta.eventoPagable} · ` : ""}
            Vigencia {fechaLarga(meta.inicio)} – {fechaLarga(meta.fin)}
          </p>
        </div>
        {meta.cpaObjetivo > 0 && (
          <div className="text-right">
            <p className="label-mono text-[10px] text-gray-500">CPA real / objetivo</p>
            <p className="text-lg font-medium tabular-nums" style={{ color: cpaReal === null ? undefined : cpaOk ? TIER_COLORS.green : TIER_COLORS.red }}>
              {cpaReal === null ? "—" : formatUSD(cpaReal)}
              <span className="text-gray-500 text-sm"> / {formatUSD(meta.cpaObjetivo)}</span>
            </p>
          </div>
        )}
      </div>

      {meta.metaConversiones > 0 && (
        <Barra
          label="Conversiones aprobadas vs. meta"
          valor={aprobadas}
          total={meta.metaConversiones}
          texto={`${formatNumber(aprobadas)} de ${formatNumber(meta.metaConversiones)}`}
          color={VERDE}
        />
      )}
      {meta.budget > 0 && (
        <Barra
          label="Inversión vs. budget"
          valor={inversion}
          total={meta.budget}
          texto={`${formatUSD(inversion)} de ${formatUSD(meta.budget)}`}
        />
      )}
      {totalDias > 0 && (
        <Barra
          label="Tiempo de campaña transcurrido"
          valor={transcurridos}
          total={totalDias}
          texto={`día ${transcurridos} de ${totalDias}`}
          color="#8A93A9"
        />
      )}
      {proyeccion !== null && meta.metaConversiones > 0 && (
        <p className="text-xs text-slate-label">
          Al ritmo actual, la campaña cerraría con <b className="text-gray-800">{formatNumber(proyeccion)}</b> conversiones aprobadas
          ({pct(proyeccion, meta.metaConversiones).toFixed(0)}% de la meta).
        </p>
      )}
    </Card>
  );
}

function Embudo({ filas }) {
  const imp = suma(filas, "impresionesTotales");
  const clics = suma(filas, "clicsTotales");
  const aprob = suma(filas, "convAprobadas");
  const rev = suma(filas, "convRevision");
  const rech = suma(filas, "convRechazadas");
  const pasos = [
    { label: "Impresiones (est.)", valor: imp, nota: null, color: "#3A4360" },
    { label: "Clics", valor: clics, nota: `CTR ${fmtPct(pct(clics, imp))}`, color: AZUL },
    { label: "Conversiones aprobadas", valor: aprob, nota: `CR ${fmtPct(pct(aprob, clics))}`, color: VERDE },
  ];
  const max = Math.max(imp, clics, aprob, 1);
  return (
    <Card hover={false} className="p-5">
      <h3 className="text-lg font-medium text-gray-900 mb-1">Embudo de conversión</h3>
      <p className="text-xs text-slate-label mb-4">El ancho de cada barra usa escala logarítmica para que las conversiones se vean junto a las impresiones.</p>
      <div className="flex flex-col gap-3">
        {pasos.map((p) => (
          <div key={p.label}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-gray-600">{p.label}</span>
              <span className="tabular-nums text-gray-900 font-medium">
                {formatNumber(p.valor)}
                {p.nota && <span className="text-gray-500 font-normal"> · {p.nota}</span>}
              </span>
            </div>
            <div className="h-6 rounded bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded"
                style={{ width: `${p.valor > 0 ? Math.max(2, (Math.log10(p.valor + 1) / Math.log10(max + 1)) * 100) : 0}%`, background: p.color }}
              />
            </div>
          </div>
        ))}
      </div>
      {(rev > 0 || rech > 0) && (
        <p className="text-xs text-slate-label mt-4">
          Además: <b className="text-gray-800">{formatNumber(rev)}</b> en revisión y <b className="text-gray-800">{formatNumber(rech)}</b> rechazadas.
        </p>
      )}
    </Card>
  );
}

function TooltipDia({ active, payload, label, etiqueta }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-deep border border-line text-gray-900 text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="text-gray-500 mb-0.5">{label}</p>
      <p>
        {etiqueta}: <b>{formatNumber(payload[0].value)}</b>
      </p>
    </div>
  );
}

function kFormat(v) {
  return v >= 1000 ? `${Math.round(v / 1000)}K` : formatNumber(v);
}

function EvolucionPerformance({ filas }) {
  const porDia = useMemo(() => {
    const m = new Map();
    for (const r of filas) {
      if (!r.fecha) continue;
      const d = m.get(r.fecha) ?? { clics: 0, conversiones: 0 };
      d.clics += r.clicsTotales ?? 0;
      d.conversiones += r.convAprobadas ?? 0;
      m.set(r.fecha, d);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([f, d]) => ({ fecha: fechaCorta(f), ...d }));
  }, [filas]);

  if (porDia.length === 0) return null;
  const eje = { tick: { fontSize: 11, fill: "#8A93A9" }, axisLine: { stroke: "rgba(255,255,255,0.12)" } };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card hover={false} className="p-5">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Clics por día</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={porDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="perfClicsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AZUL} stopOpacity={0.28} />
                <stop offset="100%" stopColor={AZUL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="fecha" {...eje} minTickGap={20} />
            <YAxis tick={{ fontSize: 11, fill: "#8A93A9" }} axisLine={false} tickFormatter={kFormat} width={42} />
            <Tooltip content={<TooltipDia etiqueta="Clics" />} />
            <Area type="monotone" dataKey="clics" stroke={AZUL} strokeWidth={2.2} fill="url(#perfClicsFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card hover={false} className="p-5">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Conversiones aprobadas por día</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={porDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="fecha" {...eje} minTickGap={20} />
            <YAxis tick={{ fontSize: 11, fill: "#8A93A9" }} axisLine={false} allowDecimals={false} width={42} />
            <Tooltip content={<TooltipDia etiqueta="Conversiones" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="conversiones" fill={VERDE} radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export default function PerformanceResumen({ filas, metas }) {
  return (
    <div className="flex flex-col gap-6">
      {metas.length > 0 && (
        <div className={`grid grid-cols-1 gap-4 ${metas.length > 1 ? "xl:grid-cols-2" : ""}`}>
          {metas.map((m) => (
            <AvanceCampana
              key={`${m.cliente}|${m.campana}`}
              meta={m}
              filas={filas.filter((r) => r.campana === m.campana && (!m.cliente || r.cliente === m.cliente))}
            />
          ))}
        </div>
      )}
      <EvolucionPerformance filas={filas} />
      <Embudo filas={filas} />
    </div>
  );
}
