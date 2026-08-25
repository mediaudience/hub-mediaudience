import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import Tabs from "../../components/common/Tabs";
import KPICard from "../../components/common/KPICard";
import ComboBarChart from "../../components/common/ComboBarChart";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency, formatNumber } from "../../utils/format";

async function apiFetch(url, options) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Ocurrió un error");
  return data;
}

const TIPO_ACTIVIDAD_LABEL = { llamada: "Llamada", correo: "Correo", whatsapp: "WhatsApp", reunion: "Reunión", nota: "Nota" };

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function prospectoVacio(user, esStaff) {
  return {
    id: null,
    nombre: "",
    pais: esStaff ? "" : user?.pais ?? "",
    etapa: "nuevo",
    contactoNombre: "",
    contactoEmail: "",
    contactoTelefono: "",
    valorEstimado: "",
    proximaAccionFecha: "",
    proximaAccionNota: "",
    responsableUserId: user?.id ?? null,
    responsableNombre: user?.nombre ?? "",
    convertidoClienteId: null,
  };
}

// Historial de actividades de un prospecto (llamada/correo/whatsapp/reunión/
// nota) -- registro manual, ver Contexto del plan sobre por qué no es
// automático todavía. Componente aparte para no mezclar sus propios hooks de
// carga con los del formulario del prospecto.
function ActividadesPanel({ prospectoId }) {
  const [actividades, setActividades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState("llamada");
  const [detalle, setDetalle] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      const res = await apiFetch(`/api/prospeccion/prospectos/${prospectoId}/actividades`);
      setActividades(res.actividades);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectoId]);

  async function agregar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      await apiFetch(`/api/prospeccion/prospectos/${prospectoId}/actividades`, {
        method: "POST",
        body: JSON.stringify({ tipo, detalle }),
      });
      setDetalle("");
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-brand-purple mb-2">Actividades</h3>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <form onSubmit={agregar} className="flex flex-col sm:flex-row gap-2 mb-3">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
        >
          {Object.entries(TIPO_ACTIVIDAD_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="Nota (ej. resultado de la llamada)"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
        />
        <button
          type="submit"
          disabled={guardando}
          className="bg-brand-magenta text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-brand-magenta/90 disabled:opacity-60 whitespace-nowrap"
        >
          Agregar
        </button>
      </form>

      {cargando ? (
        <Spinner label="Cargando actividades..." />
      ) : actividades.length === 0 ? (
        <p className="text-sm text-slate-label">Todavía no hay actividades registradas.</p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {actividades.map((a) => (
            <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800">{TIPO_ACTIVIDAD_LABEL[a.tipo] ?? a.tipo}</span>
                <span className="text-xs text-slate-label whitespace-nowrap">
                  {new Date(`${a.createdAt.replace(" ", "T")}Z`).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              {a.detalle && <p className="text-gray-600 mt-0.5">{a.detalle}</p>}
              <p className="text-xs text-slate-label mt-0.5">{a.actorNombre}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Prospeccion() {
  const { user } = useAuth();
  const esStaff = user?.rol === "super_admin" || user?.rol === "admin";

  const [etapas, setEtapas] = useState([]);
  const [prospectos, setProspectos] = useState([]);
  const [paises, setPaises] = useState([]);
  const [internos, setInternos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("tablero");
  const [reporte, setReporte] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const [etapasRes, prospectosRes] = await Promise.all([
        apiFetch("/api/prospeccion/etapas"),
        apiFetch("/api/prospeccion/prospectos"),
      ]);
      setEtapas(etapasRes.etapas);
      setProspectos(prospectosRes.prospectos);
      if (esStaff) {
        const [paisesRes, usuariosRes] = await Promise.all([
          apiFetch("/api/admin/paises"),
          apiFetch("/api/admin/usuarios"),
        ]);
        setPaises(paisesRes.paises);
        setInternos(usuariosRes.usuarios.filter((u) => u.rol === "usuario_interno"));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (vista !== "reporte" || reporte) return;
    apiFetch("/api/prospeccion/reporte")
      .then(setReporte)
      .catch((err) => setError(err.message));
  }, [vista, reporte]);

  async function moverEtapa(prospecto, etapa) {
    setError("");
    try {
      await apiFetch(`/api/prospeccion/prospectos/${prospecto.id}`, { method: "PUT", body: JSON.stringify({ etapa }) });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const body = {
        nombre: form.nombre,
        pais: form.pais,
        contactoNombre: form.contactoNombre,
        contactoEmail: form.contactoEmail,
        contactoTelefono: form.contactoTelefono,
        valorEstimado: form.valorEstimado === "" ? null : Number(form.valorEstimado),
        proximaAccionFecha: form.proximaAccionFecha || null,
        proximaAccionNota: form.proximaAccionNota,
        responsableUserId: form.responsableUserId,
      };
      if (form.id) {
        await apiFetch(`/api/prospeccion/prospectos/${form.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/prospeccion/prospectos", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(null);
      setSeleccionado(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function convertir(p) {
    if (!window.confirm(`¿Crear el cliente real "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    setError("");
    try {
      await apiFetch(`/api/prospeccion/prospectos/${p.id}/convertir`, { method: "POST" });
      await cargar();
      setSeleccionado(null);
    } catch (err) {
      setError(err.message);
    }
  }

  const tareasPendientes = prospectos
    .filter((p) => p.proximaAccionFecha && p.proximaAccionFecha <= hoyISO())
    .sort((a, b) => a.proximaAccionFecha.localeCompare(b.proximaAccionFecha));

  const abrirEdicion = (p) => {
    setSeleccionado(p);
    setForm({ ...p, valorEstimado: p.valorEstimado ?? "" });
  };

  const abrirNuevo = () => {
    const vacio = prospectoVacio(user, esStaff);
    setSeleccionado(vacio);
    setForm(vacio);
  };

  const paisesDeResponsable = form ? internos.filter((u) => u.pais === form.pais) : [];
  const etapaSeleccionada = seleccionado ? etapas.find((e) => e.codigo === seleccionado.etapa) : null;

  if (loading) return <Spinner label="Cargando prospección..." />;

  return (
    <div>
      <GradientHeader title="Gestión: Prospección" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {seleccionado ? (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-brand-purple">{form.id ? form.nombre : "Nuevo prospecto"}</h2>
            <button
              type="button"
              onClick={() => {
                setSeleccionado(null);
                setForm(null);
              }}
              className="text-sm text-slate-label hover:underline"
            >
              ← Volver al tablero
            </button>
          </div>

          <form onSubmit={guardar} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">País</label>
              {esStaff ? (
                <select
                  required
                  value={form.pais}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                >
                  <option value="">Selecciona un país</option>
                  {paises.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre} ({p.codigo})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  disabled
                  value={form.pais}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-gray-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre {form.pais && <span className="text-xs text-slate-label">(prefijo {form.pais}_)</span>}
              </label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder={form.pais ? `${form.pais}_NombreProspecto` : "Elige un país primero"}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contacto</label>
              <input
                value={form.contactoNombre ?? ""}
                onChange={(e) => setForm({ ...form, contactoNombre: e.target.value })}
                placeholder="Nombre del contacto"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email / Teléfono</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={form.contactoEmail ?? ""}
                  onChange={(e) => setForm({ ...form, contactoEmail: e.target.value })}
                  placeholder="Email"
                  className="w-1/2 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                />
                <input
                  value={form.contactoTelefono ?? ""}
                  onChange={(e) => setForm({ ...form, contactoTelefono: e.target.value })}
                  placeholder="Teléfono"
                  className="w-1/2 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor estimado (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.valorEstimado}
                onChange={(e) => setForm({ ...form, valorEstimado: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsable</label>
              {esStaff ? (
                <select
                  value={form.responsableUserId ?? ""}
                  onChange={(e) => setForm({ ...form, responsableUserId: Number(e.target.value) || null })}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                >
                  <option value="">Sin asignar</option>
                  {paisesDeResponsable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  disabled
                  value={form.responsableNombre ?? ""}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-gray-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Próxima acción</label>
              <input
                type="date"
                value={form.proximaAccionFecha ?? ""}
                onChange={(e) => setForm({ ...form, proximaAccionFecha: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota de la próxima acción</label>
              <input
                value={form.proximaAccionNota ?? ""}
                onChange={(e) => setForm({ ...form, proximaAccionNota: e.target.value })}
                placeholder="Ej. Llamar para cerrar propuesta"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={guardando}
                className="bg-brand-magenta text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-brand-magenta/90 disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              {form.id && etapaSeleccionada?.tipo === "ganada" && esStaff && !form.convertidoClienteId && (
                <button
                  type="button"
                  onClick={() => convertir(form)}
                  className="bg-green-600 text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-green-700"
                >
                  Convertir a Cliente
                </button>
              )}
              {form.convertidoClienteId && (
                <span className="text-sm text-green-700 font-medium">Ya convertido a cliente #{form.convertidoClienteId}</span>
              )}
            </div>
          </form>

          {form.id && <ActividadesPanel prospectoId={form.id} />}
        </Card>
      ) : (
        <>
          <Tabs
            tabs={[
              { key: "tablero", label: "Tablero" },
              { key: "reporte", label: "Reportes" },
            ]}
            active={vista}
            onChange={setVista}
          />

          <div className="pt-4">
            {vista === "tablero" ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-label">
                    {prospectos.length} prospecto{prospectos.length !== 1 ? "s" : ""} activo{prospectos.length !== 1 ? "s" : ""}
                  </h2>
                  <button
                    type="button"
                    onClick={abrirNuevo}
                    className="bg-brand-magenta text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-brand-magenta/90"
                  >
                    + Nuevo prospecto
                  </button>
                </div>

                {tareasPendientes.length > 0 && (
                  <Card className="p-4 mb-4">
                    <h3 className="text-sm font-bold text-brand-magenta mb-2">
                      Tareas de hoy / atrasadas ({tareasPendientes.length})
                    </h3>
                    <ul className="flex flex-col gap-1">
                      {tareasPendientes.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => abrirEdicion(p)}
                            className="text-sm text-left w-full hover:bg-slate-50 rounded-md px-2 py-1.5 flex items-center justify-between gap-2"
                          >
                            <span className="text-gray-800">{p.nombre}</span>
                            <span className="text-xs text-slate-label whitespace-nowrap">
                              {p.proximaAccionNota || "Sin nota"} · {p.proximaAccionFecha}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {prospectos.length === 0 ? (
                  <EmptyState message="Todavía no hay prospectos cargados." />
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {etapas.map((etapa) => {
                      const items = prospectos.filter((p) => p.etapa === etapa.codigo);
                      const valorTotal = items.reduce((s, p) => s + (p.valorEstimado ?? 0), 0);
                      return (
                        <div key={etapa.codigo} className="w-72 shrink-0">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <h3 className="text-sm font-bold text-gray-800">{etapa.nombre}</h3>
                            <span className="text-xs text-slate-label">{items.length}</span>
                          </div>
                          <p className="text-xs text-slate-label px-1 mb-2">{formatCurrency(valorTotal)}</p>
                          <div className="flex flex-col gap-2">
                            {items.map((p) => (
                              <Card key={p.id} className="p-3">
                                <button type="button" onClick={() => abrirEdicion(p)} className="text-left w-full">
                                  <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                                  <p className="text-xs text-slate-label mt-0.5">{p.responsableNombre ?? "Sin responsable"}</p>
                                  {p.valorEstimado != null && (
                                    <p className="text-xs text-brand-purple font-medium mt-0.5">{formatCurrency(p.valorEstimado)}</p>
                                  )}
                                  {p.proximaAccionFecha && (
                                    <p className={`text-xs mt-0.5 ${p.proximaAccionFecha <= hoyISO() ? "text-red-600 font-medium" : "text-slate-label"}`}>
                                      Próx. acción: {p.proximaAccionFecha}
                                    </p>
                                  )}
                                </button>
                                <select
                                  value={p.etapa}
                                  onChange={(e) => moverEtapa(p, e.target.value)}
                                  className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                                >
                                  {etapas.map((e) => (
                                    <option key={e.codigo} value={e.codigo}>
                                      Mover a: {e.nombre}
                                    </option>
                                  ))}
                                </select>
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <ReportePanel reporte={reporte} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReportePanel({ reporte }) {
  if (!reporte) return <Spinner label="Cargando reporte..." />;

  const abiertos = reporte.porEtapa.filter((e) => e.tipo === "abierta");
  const ganado = reporte.porEtapa.find((e) => e.tipo === "ganada");
  const pipelineAbierto = abiertos.reduce((s, e) => s + e.valor, 0);
  const mesActual = new Date().toISOString().slice(0, 7);
  const ganadoEsteMes = reporte.ganadoPorMes.find((m) => m.mes === mesActual)?.valor ?? 0;

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-6">
        <KPICard label="Pipeline abierto" value={formatCurrency(pipelineAbierto)} />
        <KPICard label="Tasa de conversión" value={`${reporte.tasaConversion}%`} />
        <KPICard label="Ganado este mes" value={formatCurrency(ganadoEsteMes)} />
        <KPICard label="Prospectos ganados (total)" value={formatNumber(ganado?.cantidad ?? 0)} />
      </div>

      <Card className="p-6 mb-4">
        <h3 className="text-sm font-bold text-brand-purple mb-3">Embudo por etapa</h3>
        <ComboBarChart
          data={reporte.porEtapa.map((e) => ({ etapa: e.nombre, cantidad: e.cantidad }))}
          xKey="etapa"
          series={[{ key: "cantidad", label: "Prospectos", color: "#57007E" }]}
        />
      </Card>

      {reporte.ganadoPorMes.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-bold text-brand-purple mb-3">Ganado por mes (últimos 6 meses)</h3>
          <ComboBarChart
            data={reporte.ganadoPorMes.map((m) => ({ mes: m.mes, valor: m.valor }))}
            xKey="mes"
            series={[{ key: "valor", label: "Valor ganado (USD)", color: "#57007E" }]}
          />
        </Card>
      )}
    </div>
  );
}
