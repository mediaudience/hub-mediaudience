import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { NAV_GROUPS } from "../../navConfig";

const CANAL_LABEL = Object.fromEntries(NAV_GROUPS.map((g) => [g.id, g.label]));

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

const MAX_CHIPS_VISIBLES = 3;

function AnunciantesChips({ anunciantes }) {
  if (anunciantes.length === 0) return <span className="text-slate-label">—</span>;

  const visibles = anunciantes.slice(0, MAX_CHIPS_VISIBLES);
  const restantes = anunciantes.length - visibles.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibles.map((a) => (
        <span key={a} className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-purple/10 text-brand-purple">
          {a}
        </span>
      ))}
      {restantes > 0 && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-label">
          +{restantes} más
        </span>
      )}
    </div>
  );
}

function CanalesChips({ canales }) {
  if (canales.length === 0) return <span className="text-slate-label">Sin servicios contratados</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {canales.map((c) => (
        <span
          key={c.canal}
          title={c.sheetId ? `Sheet: ${c.sheetId}` : "Falta configurar el Sheet ID"}
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            c.sheetId ? "bg-brand-purple/10 text-brand-purple" : "bg-semaphore-orange/10 text-semaphore-orange"
          }`}
        >
          {CANAL_LABEL[c.canal] ?? c.canal}
        </span>
      ))}
    </div>
  );
}

const EMPTY_CANALES = Object.fromEntries(NAV_GROUPS.map((g) => [g.id, { contratado: false, sheetId: "" }]));

function canalesArrayToForm(canalesArray) {
  const map = { ...EMPTY_CANALES };
  for (const g of NAV_GROUPS) map[g.id] = { contratado: false, sheetId: "" };
  for (const c of canalesArray ?? []) map[c.canal] = { contratado: true, sheetId: c.sheetId || "" };
  return map;
}

function canalesFormToArray(canalesForm) {
  return Object.entries(canalesForm)
    .filter(([, v]) => v.contratado)
    .map(([canal, v]) => ({ canal, sheetId: v.sheetId || null }));
}

const EMPTY_FORM = { id: null, nombre: "", canales: EMPTY_CANALES, anunciantes: [], activo: true };

export default function AdminClientes() {
  const [clientes, setClientes] = useState([]);
  const [anunciantesDisponibles, setAnunciantesDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const [clientesRes, anunciantesRes] = await Promise.all([
        apiFetch("/api/admin/clientes"),
        apiFetch("/api/admin/anunciantes-disponibles"),
      ]);
      setClientes(clientesRes.clientes);
      setAnunciantesDisponibles(anunciantesRes.anunciantes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function toggleAnunciante(a) {
    setForm((f) => ({
      ...f,
      anunciantes: f.anunciantes.includes(a) ? f.anunciantes.filter((x) => x !== a) : [...f.anunciantes, a],
    }));
  }

  function toggleCanalContratado(canal) {
    setForm((f) => ({
      ...f,
      canales: { ...f.canales, [canal]: { ...f.canales[canal], contratado: !f.canales[canal].contratado } },
    }));
  }

  function setCanalSheetId(canal, sheetId) {
    setForm((f) => ({ ...f, canales: { ...f.canales, [canal]: { ...f.canales[canal], sheetId } } }));
  }

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        nombre: form.nombre,
        canales: canalesFormToArray(form.canales),
        anunciantes: form.anunciantes,
        activo: form.activo,
      };
      if (form.id) {
        await apiFetch(`/api/admin/clientes/${form.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/admin/clientes", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(c) {
    if (c.activo && !window.confirm(`¿Desactivar a ${c.nombre}? Sus usuarios no podrán iniciar sesión mientras esté inactivo.`)) {
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/clientes/${c.id}`, { method: "PUT", body: JSON.stringify({ activo: !c.activo }) });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <GradientHeader title="Administración: Clientes" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!form && (
        <>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="mb-4 bg-brand-magenta text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-brand-magenta/90"
          >
            + Nuevo Cliente
          </button>

          {loading ? (
            <Spinner label="Cargando clientes..." />
          ) : clientes.length === 0 ? (
            <EmptyState message="No hay clientes creados todavía. Usa '+ Nuevo Cliente' para dar de alta el primero." />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-brand-purple text-white text-left">
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Anunciantes</th>
                    <th className="px-4 py-3 font-semibold">Servicios contratados</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-2.5 text-gray-800">{c.nombre}</td>
                      <td className="px-4 py-2.5">
                        <AnunciantesChips anunciantes={c.anunciantes} />
                      </td>
                      <td className="px-4 py-2.5">
                        <CanalesChips canales={c.canales} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {c.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              id: c.id,
                              nombre: c.nombre,
                              canales: canalesArrayToForm(c.canales),
                              anunciantes: c.anunciantes,
                              activo: c.activo,
                            })
                          }
                          className="text-brand-purple hover:underline text-sm font-medium mr-3"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActivo(c)}
                          className="text-brand-purple hover:underline text-sm font-medium"
                        >
                          {c.activo ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {form && (
        <Card className="p-6 max-w-xl">
          <h2 className="text-lg font-bold text-brand-purple mb-4">
            {form.id ? "Editar Cliente" : "Nuevo Cliente"}
          </h2>
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Servicios contratados</label>
              <div className="flex flex-col gap-2.5 border border-slate-200 rounded-lg p-3">
                {NAV_GROUPS.map((g) => {
                  const canal = form.canales[g.id];
                  return (
                    <div key={g.id} className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={canal.contratado}
                          onChange={() => toggleCanalContratado(g.id)}
                          className="accent-brand-magenta"
                        />
                        {g.label}
                      </label>
                      {canal.contratado && (
                        <input
                          value={canal.sheetId}
                          onChange={(e) => setCanalSheetId(g.id, e.target.value)}
                          placeholder={`ID del Sheet de ${g.label}`}
                          className="ml-6 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Anunciantes de este cliente</label>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 flex flex-col gap-1.5">
                {anunciantesDisponibles.length === 0 && (
                  <span className="text-sm text-slate-label">
                    No hay anunciantes en los datos sincronizados todavía.
                  </span>
                )}
                {anunciantesDisponibles.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.anunciantes.includes(a)}
                      onChange={() => toggleAnunciante(a)}
                      className="accent-brand-magenta"
                    />
                    {a}
                  </label>
                ))}
              </div>
            </div>

            {form.id && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="accent-brand-magenta"
                />
                Cliente activo
              </label>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-magenta text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-brand-magenta/90 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="text-sm font-medium text-gray-600 px-5 py-2.5 rounded-full hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
