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

// Traduce el resultado de un sync (ver server/adminRoutes.js) a un mensaje
// corto para mostrar en el banner -- prioriza mostrar errores (ej. Sheet
// todavía no compartido con la cuenta de servicio) porque son lo único que
// requiere que Raiza haga algo antes de que la data aparezca.
function resumenSync(sync) {
  if (!sync) return null;
  if (sync.errores.length > 0) {
    return { tipo: "error", texto: `Se guardó, pero el sync falló: ${sync.errores.join("; ")}` };
  }
  if (sync.sincronizados.length > 0) {
    return {
      tipo: "ok",
      texto: `Datos sincronizados ahora mismo (${sync.sincronizados.length} servicio${
        sync.sincronizados.length === 1 ? "" : "s"
      }).`,
    };
  }
  return null;
}

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

// TikTok no trae un Sheet -- se conecta vía OAuth de su Marketing API, y el
// mismo campo que en los demás canales guarda el Sheet ID guarda acá el
// advertiser_id de la cuenta de ese cliente dentro del Business Center de
// Mediaudience (ver [[project_mediaudience_tiktok_api]]). Un solo campo de
// texto en la base para los 5 canales, solo cambia cómo se lo llama en la UI.
function nombreIdentificadorCanal(canalSlug) {
  return canalSlug === "tiktok" ? "ID de la cuenta de anunciante" : "ID del Sheet";
}

function CanalesChips({ canales, canalLabel }) {
  if (canales.length === 0) return <span className="text-slate-label">Sin servicios contratados</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {canales.map((c) => {
        const nombreId = nombreIdentificadorCanal(c.canal);
        return (
          <span
            key={c.canal}
            title={c.sheetId ? `${nombreId}: ${c.sheetId}` : `Falta configurar el ${nombreId.toLowerCase()}`}
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              c.sheetId ? "bg-brand-purple/10 text-brand-purple" : "bg-semaphore-orange/10 text-semaphore-orange"
            }`}
          >
            {canalLabel[c.canal] ?? c.canal}
          </span>
        );
      })}
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

// Menu de acciones por fila -- mismo patron que Admin > Usuarios: un solo
// control igual en todas las filas en vez de varios links de texto sueltos.
function AccionesMenuCliente({ cliente: c, abierto, onToggle, onEditar, onToggleActivo, onSincronizar, sincronizando }) {
  const sinSheet = c.canales.every((canal) => !canal.sheetId);
  return (
    <div className="relative inline-block text-left" data-acciones-menu>
      <button
        type="button"
        onClick={() => onToggle(c.id)}
        aria-haspopup="true"
        aria-expanded={abierto}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-brand-purple hover:text-brand-purple"
      >
        Acciones
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierto && (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left">
          <button
            type="button"
            onClick={onEditar}
            className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onToggleActivo}
            className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
          >
            {c.activo ? "Desactivar" : "Activar"}
          </button>
          <button
            type="button"
            disabled={sincronizando || sinSheet}
            onClick={onSincronizar}
            title={
              sinSheet
                ? "Este cliente no tiene ningún Sheet ID configurado"
                : "Vuelve a leer los Sheets de este cliente ahora mismo, sin esperar al cron diario"
            }
            className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
          >
            {sincronizando ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminClientes() {
  const { canales } = useAuth();
  const canalLabel = Object.fromEntries(canales.map((c) => [c.slug, c.nombre]));
  const [clientes, setClientes] = useState([]);
  const [anunciantesDisponibles, setAnunciantesDisponibles] = useState([]);
  const [paises, setPaises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nuevoAnunciante, setNuevoAnunciante] = useState("");
  const [editandoAnunciante, setEditandoAnunciante] = useState(null);
  const [valorEditado, setValorEditado] = useState("");
  const [syncInfo, setSyncInfo] = useState(null);
  const [sincronizandoId, setSincronizandoId] = useState(null);
  const [sincronizandoCanal, setSincronizandoCanal] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(null);

  useEffect(() => {
    if (menuAbierto === null) return;
    function cerrarSiEsAfuera(e) {
      if (!e.target.closest("[data-acciones-menu]")) setMenuAbierto(null);
    }
    document.addEventListener("click", cerrarSiEsAfuera);
    return () => document.removeEventListener("click", cerrarSiEsAfuera);
  }, [menuAbierto]);

  async function cargar() {
    setLoading(true);
    try {
      const [clientesRes, anunciantesRes, paisesRes] = await Promise.all([
        apiFetch("/api/admin/clientes"),
        apiFetch("/api/admin/anunciantes-disponibles"),
        apiFetch("/api/admin/paises"),
      ]);
      setClientes(clientesRes.clientes);
      setAnunciantesDisponibles(anunciantesRes.anunciantes);
      setPaises(paisesRes.paises.filter((p) => p.activo));
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

  function iniciarEdicionAnunciante(a) {
    setEditandoAnunciante(a);
    setValorEditado(a);
  }

  // Renombrar/eliminar un anunciante YA guardado (ver anunciantesPersistidos)
  // pega directo al backend en vez de esperar al "Guardar" general del
  // cliente -- necesita cascadear a usuario_anunciantes (restricciones por
  // usuario), algo que el guardado normal del cliente no puede inferir de un
  // simple diff de arrays.
  async function guardarEdicionAnunciante(actual) {
    const nuevo = valorEditado.trim();
    if (!nuevo || nuevo === actual) {
      setEditandoAnunciante(null);
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/clientes/${form.id}/anunciantes/${encodeURIComponent(actual)}`, {
        method: "PUT",
        body: JSON.stringify({ nombre: nuevo }),
      });
      setForm((f) => ({ ...f, anunciantes: f.anunciantes.map((x) => (x === actual ? nuevo : x)) }));
      setEditandoAnunciante(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminarAnunciante(a) {
    if (
      !window.confirm(
        `¿Eliminar el anunciante "${a}" de este cliente? También se le quitará a cualquier usuario que lo tuviera marcado como restricción.`
      )
    ) {
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/clientes/${form.id}/anunciantes/${encodeURIComponent(a)}`, { method: "DELETE" });
      setForm((f) => ({ ...f, anunciantes: f.anunciantes.filter((x) => x !== a) }));
      await cargar();
    } catch (err) {
      setError(err.message);
    }
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
    setSyncInfo(null);
    try {
      const body = {
        nombre: componerNombre(form.pais, form.nombre),
        pais: form.pais || null,
        canales: canalesFormToArray(form.canales),
        anunciantes: form.anunciantes,
        activo: form.activo,
      };
      const respuesta = form.id
        ? await apiFetch(`/api/admin/clientes/${form.id}`, { method: "PUT", body: JSON.stringify(body) })
        : await apiFetch("/api/admin/clientes", { method: "POST", body: JSON.stringify(body) });
      setForm(null);
      setSyncInfo(resumenSync(respuesta.sync));
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Botón "Sincronizar ahora" por fila -- para cuando el Sheet de un cliente
  // ya existente se actualizó y no se quiere esperar al cron diario.
  async function sincronizarAhora(c) {
    setError("");
    setSyncInfo(null);
    setSincronizandoId(c.id);
    try {
      const respuesta = await apiFetch(`/api/admin/clientes/${c.id}/sync`, { method: "POST" });
      setSyncInfo(resumenSync(respuesta.sync) ?? { tipo: "info", texto: `${c.nombre} no tiene servicios con Sheet ID configurado todavía.` });
    } catch (err) {
      setError(err.message);
    } finally {
      setSincronizandoId(null);
    }
  }

  // Botón "Sincronizar" por servicio, dentro del formulario de edición --
  // junto al Sheet ID de cada canal, para forzar el re-sync de un servicio
  // puntual (ej. el Sheet externo cambió) sin tocar los demás del cliente.
  // Solo tiene sentido sobre un Sheet ID ya guardado (form.id existente) --
  // uno recién tipeado en el formulario todavía no vive en la base.
  async function sincronizarCanal(canalSlug, canalNombre) {
    setError("");
    setSyncInfo(null);
    setSincronizandoCanal(canalSlug);
    try {
      const respuesta = await apiFetch(`/api/admin/clientes/${form.id}/canales/${canalSlug}/sync`, { method: "POST" });
      setSyncInfo(resumenSync(respuesta.sync) ?? { tipo: "info", texto: `${canalNombre} no tiene datos para sincronizar.` });
    } catch (err) {
      setError(err.message);
    } finally {
      setSincronizandoCanal(null);
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

  // Editar/Eliminar solo tienen sentido sobre un anunciante que YA existe en
  // `cliente_anunciantes` para este cliente (las rutas nuevas pegan directo
  // por cliente+anunciante) -- uno recién tipeado en "+ Agregar" pero sin
  // guardar todavía, o uno que viene del catálogo global pero aún no está
  // asociado a este cliente, no tiene nada que renombrar/eliminar en el
  // servidor hasta el primer "Guardar".
  const anunciantesPersistidos = form?.id ? clientes.find((c) => c.id === form.id)?.anunciantes ?? [] : [];

  // El botón "Sincronizar" junto a un Sheet ID solo tiene sentido si ESE
  // servicio ya está guardado en la base con un Sheet ID -- uno recién
  // tipeado en el formulario (o cambiado) todavía no existe ahí hasta el
  // próximo "Guardar", que de todos modos ya dispara el sync automático.
  const canalesPersistidosConSheet = form?.id
    ? new Set(
        (clientes.find((c) => c.id === form.id)?.canales ?? [])
          .filter((c) => c.sheetId)
          .map((c) => c.canal)
      )
    : new Set();

  return (
    <div>
      <GradientHeader title="Administración: Clientes" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {syncInfo && (
        <div
          role="status"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            syncInfo.tipo === "error"
              ? "bg-semaphore-orange/10 text-semaphore-orange"
              : syncInfo.tipo === "ok"
              ? "bg-green-50 text-green-700"
              : "bg-slate-100 text-slate-label"
          }`}
        >
          {syncInfo.texto}
        </div>
      )}

      {!form && (
        <>
          <button
            type="button"
            onClick={() => {
              setNuevoAnunciante("");
              setEditandoAnunciante(null);
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
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
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
                      <td className="px-4 py-2.5 text-right">
                        <AccionesMenuCliente
                          cliente={c}
                          abierto={menuAbierto === c.id}
                          onToggle={(id) => setMenuAbierto((prev) => (prev === id ? null : id))}
                          onEditar={() => {
                            setMenuAbierto(null);
                            setNuevoAnunciante("");
                            setEditandoAnunciante(null);
                            setForm({
                              id: c.id,
                              nombre: nombreSinPrefijo(c),
                              pais: c.pais || "",
                              canales: canalesArrayToForm(c.canales, canales),
                              anunciantes: c.anunciantes,
                              activo: c.activo,
                            });
                          }}
                          onToggleActivo={() => {
                            setMenuAbierto(null);
                            toggleActivo(c);
                          }}
                          onSincronizar={() => {
                            setMenuAbierto(null);
                            sincronizarAhora(c);
                          }}
                          sincronizando={sincronizandoId === c.id}
                        />
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
                {paises.map((p) => (
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
                        <div className="ml-6 flex items-center gap-2">
                          <input
                            value={canal.sheetId}
                            onChange={(e) => setCanalSheetId(c.slug, e.target.value)}
                            placeholder={`${nombreIdentificadorCanal(c.slug)} de ${c.nombre}`}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                          />
                          {canalesPersistidosConSheet.has(c.slug) && (
                            <button
                              type="button"
                              disabled={sincronizandoCanal === c.slug}
                              onClick={() => sincronizarCanal(c.slug, c.nombre)}
                              title={`Vuelve a leer los datos de ${c.nombre} ahora mismo, sin esperar al cron diario`}
                              className="shrink-0 text-brand-purple hover:underline text-xs font-medium disabled:text-slate-label disabled:no-underline disabled:cursor-not-allowed"
                            >
                              {sincronizandoCanal === c.slug ? "Sincronizando..." : "Sincronizar"}
                            </button>
                          )}
                        </div>
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
                  <div key={a} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.anunciantes.includes(a)}
                      onChange={() => toggleAnunciante(a)}
                      className="accent-brand-magenta"
                    />
                    {editandoAnunciante === a ? (
                      <>
                        <input
                          autoFocus
                          value={valorEditado}
                          onChange={(e) => setValorEditado(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              guardarEdicionAnunciante(a);
                            }
                            if (e.key === "Escape") setEditandoAnunciante(null);
                          }}
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                        />
                        <button
                          type="button"
                          onClick={() => guardarEdicionAnunciante(a)}
                          className="text-xs font-medium text-brand-purple hover:underline shrink-0"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditandoAnunciante(null)}
                          className="text-xs text-slate-label hover:underline shrink-0"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span onClick={() => toggleAnunciante(a)} className="flex-1 cursor-pointer">
                          {a}
                        </span>
                        {anunciantesPersistidos.includes(a) && (
                          <>
                            <button
                              type="button"
                              onClick={() => iniciarEdicionAnunciante(a)}
                              className="text-xs font-medium text-brand-purple hover:underline shrink-0"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarAnunciante(a)}
                              className="text-xs font-medium text-red-600 hover:underline shrink-0"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
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
