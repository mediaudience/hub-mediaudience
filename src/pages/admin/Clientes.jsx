import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { useAuth } from "../../context/AuthContext";

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

function CanalesChips({ canales, canalLabel }) {
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
          {canalLabel[c.canal] ?? c.canal}
        </span>
      ))}
    </div>
  );
}

// El catálogo de servicios (`canales`) es dinámico -- viene de useAuth(), que
// lo trae de /api/canal -- así que estos helpers ya no pueden ser constantes
// de módulo como cuando salían del NAV_GROUPS estático.
function canalesVacios(canales) {
  return Object.fromEntries(canales.map((c) => [c.slug, { contratado: false, sheetId: "" }]));
}

function canalesArrayToForm(canalesArray, canales) {
  const map = canalesVacios(canales);
  for (const c of canalesArray ?? []) map[c.canal] = { contratado: true, sheetId: c.sheetId || "" };
  return map;
}

function canalesFormToArray(canalesForm) {
  return Object.entries(canalesForm)
    .filter(([, v]) => v.contratado)
    .map(([canal, v]) => ({ canal, sheetId: v.sheetId || null }));
}

// Países de operación de Mediaudience Latam -- mantener en sync con la lista
// gemela PAISES en server/adminRoutes.js.
const PAISES = [
  { codigo: "PE", nombre: "Perú" },
  { codigo: "EC", nombre: "Ecuador" },
  { codigo: "CL", nombre: "Chile" },
  { codigo: "MX", nombre: "México" },
  { codigo: "CO", nombre: "Colombia" },
];

// El nombre completo del cliente siempre lleva el prefijo del país (ej.
// PE_Alicorp) -- al editar, se le quita el prefijo para mostrar solo la parte
// que el admin realmente escribió, y se lo compone de nuevo al guardar.
function nombreSinPrefijo(cliente) {
  if (!cliente.pais) return cliente.nombre;
  const prefijo = `${cliente.pais}_`;
  return cliente.nombre.startsWith(prefijo) ? cliente.nombre.slice(prefijo.length) : cliente.nombre;
}

function componerNombre(pais, nombreLimpio) {
  const limpio = nombreLimpio.trim();
  return pais ? `${pais}_${limpio}` : limpio;
}

export default function AdminClientes() {
  const { canales } = useAuth();
  const canalLabel = Object.fromEntries(canales.map((c) => [c.slug, c.nombre]));
  const [clientes, setClientes] = useState([]);
  const [anunciantesDisponibles, setAnunciantesDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nuevoAnunciante, setNuevoAnunciante] = useState("");

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

  // Un anunciante nuevo (una marca que todavía no aparece en ningún dato
  // sincronizado) se puede crear aquí mismo -- no depende de que ya haya
  // corrido un sync con esa columna "Anunciante", solo de escribir el nombre
  // tal como va a aparecer en el Sheet real del cliente.
  function agregarAnunciante() {
    const nombre = nuevoAnunciante.trim();
    if (!nombre || form.anunciantes.includes(nombre)) return;
    setForm((f) => ({ ...f, anunciantes: [...f.anunciantes, nombre] }));
    setNuevoAnunciante("");
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
        nombre: componerNombre(form.pais, form.nombre),
        pais: form.pais || null,
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

  // Los ya asociados al cliente pueden no venir del sync todavía (recién
  // creados a mano acá mismo) -- se muestran igual, unidos a los que sí
  // aparecen ya en datos sincronizados.
  const anunciantesParaMostrar = form
    ? [...new Set([...anunciantesDisponibles, ...form.anunciantes])].sort()
    : [];

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
            onClick={() => {
              setNuevoAnunciante("");
              setForm({ id: null, nombre: "", pais: "", canales: canalesVacios(canales), anunciantes: [], activo: true });
            }}
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
                        <CanalesChips canales={c.canales} canalLabel={canalLabel} />
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
                          onClick={() => {
                            setNuevoAnunciante("");
                            setForm({
                              id: c.id,
                              nombre: nombreSinPrefijo(c),
                              pais: c.pais || "",
                              canales: canalesArrayToForm(c.canales, canales),
                              anunciantes: c.anunciantes,
                              activo: c.activo,
                            });
                          }}
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">País</label>
              <select
                required={!form.id}
                value={form.pais}
                onChange={(e) => setForm((f) => ({ ...f, pais: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              >
                <option value="" disabled={!form.id}>
                  {form.id ? "Sin país asignado" : "Selecciona un país"}
                </option>
                {PAISES.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre} ({p.codigo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Alicorp"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
              {form.nombre.trim() && (
                <p className="mt-1.5 text-xs text-slate-label">
                  Se guardará como <span className="font-mono font-medium text-brand-purple">{componerNombre(form.pais, form.nombre)}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Servicios contratados</label>
              <div className="flex flex-col gap-2.5 border border-slate-200 rounded-lg p-3">
                {canales.length === 0 && (
                  <span className="text-sm text-slate-label">No hay servicios en el catálogo todavía.</span>
                )}
                {canales.map((c) => {
                  const canal = form.canales[c.slug];
                  return (
                    <div key={c.slug} className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={canal.contratado}
                          onChange={() => toggleCanalContratado(c.slug)}
                          className="accent-brand-magenta"
                        />
                        {c.nombre}
                      </label>
                      {canal.contratado && (
                        <input
                          value={canal.sheetId}
                          onChange={(e) => setCanalSheetId(c.slug, e.target.value)}
                          placeholder={`ID del Sheet de ${c.nombre}`}
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
              <div className="flex gap-2 mb-2">
                <input
                  value={nuevoAnunciante}
                  onChange={(e) => setNuevoAnunciante(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarAnunciante();
                    }
                  }}
                  placeholder="Nombre del anunciante (ej. Mayonesa Alacena)"
                  className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                />
                <button
                  type="button"
                  onClick={agregarAnunciante}
                  className="shrink-0 bg-brand-purple/10 text-brand-purple text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-purple/20"
                >
                  + Agregar
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 flex flex-col gap-1.5">
                {anunciantesParaMostrar.length === 0 && (
                  <span className="text-sm text-slate-label">
                    Todavía no hay anunciantes asociados -- agrega el primero arriba.
                  </span>
                )}
                {anunciantesParaMostrar.map((a) => (
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
              <p className="mt-1.5 text-xs text-slate-label">
                Si el anunciante todavía no aparece en los datos sincronizados, escríbelo arriba y agrégalo -- queda
                asociado a este cliente igual, sin esperar al próximo sync.
              </p>
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
