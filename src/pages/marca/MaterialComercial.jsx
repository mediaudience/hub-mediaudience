import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import Tabs from "../../components/common/Tabs";
import { useAuth } from "../../context/AuthContext";
import { CATEGORIAS_MARCA, PAIS_GLOBAL, MARCA_MAX_MB } from "../../../shared/marca";

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

// XHR y no fetch: fetch no informa progreso de subida, y una presentación
// de 40 MB sin barra parece colgada.
function subirArchivo(file, { pais, categoria, descripcion }, onProgress) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ pais, categoria });
    if (descripcion) params.set("descripcion", descripcion);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/marca/archivos?${params}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Nombre-Archivo", encodeURIComponent(file.name));
    xhr.setRequestHeader("X-Tipo-Archivo", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // respuesta no-JSON (ej. 413 de nginx)
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.error || (xhr.status === 413 ? `Supera el máximo de ${MARCA_MAX_MB} MB` : "No se pudo subir")));
    };
    xhr.onerror = () => reject(new Error("Se cortó la conexión al subir"));
    xhr.send(file);
  });
}

function formatoTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatoFecha(iso) {
  // created_at viene en UTC de SQLite ("2026-10-24 15:30:00").
  return new Date(`${iso.replace(" ", "T")}Z`).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Piezas pensadas para fondo claro (logos "-claro", "-mono-negro"): sobre la
// tarjeta oscura no se verían, así que su miniatura va sobre Paper.
function fondoClaro(a) {
  return a.inline && /(-claro|mono-negro)/i.test(a.nombre) && !/fondo-videollamada/i.test(a.nombre);
}

function extension(nombre) {
  const m = nombre.match(/\.([a-z0-9]{1,5})$/i);
  return m ? m[1].toUpperCase() : "ARCHIVO";
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta";

function FormSubida({ paises, paisActual, onSubido, onCerrar }) {
  const [archivos, setArchivos] = useState([]);
  const [pais, setPais] = useState(paisActual);
  const [categoria, setCategoria] = useState(CATEGORIAS_MARCA[0].codigo);
  const [descripcion, setDescripcion] = useState("");
  const [progreso, setProgreso] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => setPais(paisActual), [paisActual]);

  async function enviar(e) {
    e.preventDefault();
    if (archivos.length === 0) return;
    const grande = archivos.find((f) => f.size > MARCA_MAX_MB * 1024 * 1024);
    if (grande) {
      setError(`"${grande.name}" supera el máximo de ${MARCA_MAX_MB} MB.`);
      return;
    }
    setError("");
    try {
      for (const [i, f] of archivos.entries()) {
        await subirArchivo(f, { pais, categoria, descripcion: descripcion.trim() }, (p) =>
          setProgreso({ i, total: archivos.length, nombre: f.name, p })
        );
      }
      setArchivos([]);
      setDescripcion("");
      if (inputRef.current) inputRef.current.value = "";
      onSubido(pais);
    } catch (err) {
      setError(err.message);
      onSubido(null);
    } finally {
      setProgreso(null);
    }
  }

  return (
    <Card className="p-6 mb-6" hover={false}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="label-mono text-[10.5px] text-gray-500">Subir material</h2>
        <button type="button" onClick={onCerrar} className="text-xs text-gray-500 hover:text-gray-900">
          Cerrar
        </button>
      </div>
      <p className="text-sm text-slate-label mb-4">
        Solo Admin y Super Admin pueden subir o borrar. Máximo {MARCA_MAX_MB} MB por archivo.
      </p>
      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={enviar} className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="mc-archivos" className="block text-sm font-medium text-gray-700 mb-1.5">
            Archivos
          </label>
          <input
            id="mc-archivos"
            ref={inputRef}
            type="file"
            multiple
            required
            onChange={(e) => setArchivos([...e.target.files])}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-900 hover:file:bg-gray-200"
          />
        </div>
        <div>
          <label htmlFor="mc-pais" className="block text-sm font-medium text-gray-700 mb-1.5">
            País
          </label>
          <select id="mc-pais" value={pais} onChange={(e) => setPais(e.target.value)} className={inputClass}>
            {paises.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mc-categoria" className="block text-sm font-medium text-gray-700 mb-1.5">
            Categoría
          </label>
          <select id="mc-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputClass}>
            {CATEGORIAS_MARCA.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="mc-desc" className="block text-sm font-medium text-gray-700 mb-1.5">
            Descripción <span className="text-slate-label font-normal">(opcional)</span>
          </label>
          <input
            id="mc-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={300}
            placeholder="Ej. Versión 2026 para clientes de retail"
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={!!progreso || archivos.length === 0}
            className="bg-brand-magenta text-on-accent text-sm font-medium px-5 py-2.5 rounded-md hover:bg-brand-magenta/90 disabled:opacity-60"
          >
            {progreso ? "Subiendo..." : archivos.length > 1 ? `Subir ${archivos.length} archivos` : "Subir"}
          </button>
          {progreso && (
            <div className="flex-1 min-w-[200px]" role="status" aria-live="polite">
              <div className="flex justify-between text-xs text-slate-label mb-1">
                <span className="truncate">
                  {progreso.total > 1 && `${progreso.i + 1}/${progreso.total} · `}
                  {progreso.nombre}
                </span>
                <span className="font-mono">{Math.round(progreso.p * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full bg-brand-purple transition-[width]" style={{ width: `${progreso.p * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </form>
    </Card>
  );
}

// Vista previa en grande: imagen o PDF dentro del hub; el resto (ZIP, PPT...)
// muestra la ficha con su descarga, porque el navegador no puede abrirlos.
function VistaPrevia({ a, esStaff, onBorrar, onCerrar }) {
  useEffect(() => {
    const alTeclear = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);
  const url = `/api/marca/archivos/${a.id}/ver?v=${a.tamano}`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${a.nombre}`}
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-5xl max-h-full flex flex-col rounded-md border border-line bg-surface overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{a.nombre}</p>
            <p className="label-mono text-[10px] text-gray-500">
              {formatoTamano(a.tamano)} · {formatoFecha(a.created_at)}
              {a.subido_por_nombre && ` · ${a.subido_por_nombre}`}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-gray-500 hover:text-gray-900 text-xl leading-none px-2">
            ×
          </button>
        </div>
        <div className={`flex-1 min-h-0 flex items-center justify-center ${fondoClaro(a) ? "bg-[#E9EDF6]" : "bg-ink-deep"}`}>
          {a.inline ? (
            <img src={url} alt={a.nombre} className="max-w-full max-h-[70vh] object-contain" />
          ) : a.vista ? (
            <iframe src={url} title={a.nombre} className="w-full h-[70vh] bg-white" />
          ) : (
            <div className="py-16 text-center">
              <p className="font-mono text-2xl tracking-widest text-brand-purple">{extension(a.nombre)}</p>
              <p className="mt-2 text-sm text-slate-label">Este tipo de archivo no se puede ver en el navegador. Descárgalo para abrirlo.</p>
            </div>
          )}
        </div>
        {a.descripcion && <p className="px-4 pt-3 text-sm text-gray-700">{a.descripcion}</p>}
        <div className="flex items-center gap-3 px-4 py-3">
          <a
            href={`/api/marca/archivos/${a.id}/descargar`}
            className="bg-brand-magenta text-on-accent text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-magenta/90"
          >
            Descargar
          </a>
          {esStaff && (
            <button type="button" onClick={() => onBorrar(a)} className="text-sm text-gray-500 hover:text-red-600">
              Borrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaArchivo({ a, esStaff, onBorrar, onVer, paisNombre }) {
  return (
    <div className="flex flex-col rounded-md border border-line bg-ink-deep overflow-hidden">
      <button
        type="button"
        onClick={() => onVer(a)}
        aria-label={`Vista previa de ${a.nombre}`}
        className={`aspect-[16/9] flex items-center justify-center overflow-hidden hover:opacity-90 ${
          fondoClaro(a) ? "bg-[#E9EDF6]" : "bg-surface-2"
        }`}
      >
        {a.inline ? (
          <img src={`/api/marca/archivos/${a.id}/ver?v=${a.tamano}`} alt="" loading="lazy" className="w-full h-full object-contain" />
        ) : (
          <span className="font-mono text-sm tracking-widest text-brand-purple">{extension(a.nombre)}</span>
        )}
      </button>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-medium text-gray-900 break-words">{a.nombre}</p>
        {a.descripcion && <p className="text-xs text-gray-600">{a.descripcion}</p>}
        <p className="label-mono text-[10px] text-gray-500 mt-auto pt-1">
          {paisNombre && <span className="text-brand-purple">{paisNombre} · </span>}
          {formatoTamano(a.tamano)} · {formatoFecha(a.created_at)}
        </p>
        <div className="flex items-center gap-3 pt-2">
          <a
            href={`/api/marca/archivos/${a.id}/descargar`}
            className="bg-brand-magenta text-on-accent text-xs font-medium px-3.5 py-2 rounded-md hover:bg-brand-magenta/90"
          >
            Descargar
          </a>
          <button type="button" onClick={() => onVer(a)} className="text-xs font-medium text-brand-purple hover:underline">
            Vista previa
          </button>
          {esStaff && (
            <button type="button" onClick={() => onBorrar(a)} className="ml-auto text-xs text-gray-500 hover:text-red-600">
              Borrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Gestor de presentaciones (solo Super Admin): catálogo de productos y armado
// de la presentación comercial por país. Por ahora reserva su lugar mientras
// se construye; la base de Perú ya se genera fuera del hub.
function GestorPresentaciones() {
  const pasos = [
    ["Catálogo de productos", "Cada producto (CTV, Mobile Push, programática, gaming o un formato de partner) con sus láminas en estilo Signal."],
    ["Producto nuevo desde la PPT del partner", "Subes la presentación del partner y el hub arma un borrador del producto en nuestra plantilla para que lo revises."],
    ["Armar la presentación", "Eliges país, productos y orden, y descargas un .pptx editable con portada, casos y cierre de ese país."],
  ];
  return (
    <Card className="p-6" hover={false}>
      <p className="label-mono text-[10.5px] text-brand-purple mb-2">En construcción</p>
      <h2 className="font-display font-semibold text-xl text-gray-900 mb-1">Gestor de presentaciones</h2>
      <p className="text-sm text-slate-label mb-5 max-w-2xl">
        Acá vas a armar las presentaciones comerciales de cada país sin rehacerlas a mano. Solo lo ve el Super Admin.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {pasos.map(([t, d], i) => (
          <div key={t} className="rounded-md border border-line bg-ink-deep p-4">
            <p className="label-mono text-[10px] text-brand-purple mb-2">{String(i + 1).padStart(2, "0")}</p>
            <p className="font-display font-semibold text-gray-900 mb-1">{t}</p>
            <p className="text-sm text-gray-600">{d}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function MaterialComercial() {
  const { user } = useAuth();
  const esStaff = user?.rol === "super_admin" || user?.rol === "admin";
  const esSuperAdmin = user?.rol === "super_admin";
  // Pestañas internas, igual que en Campañas: "Línea gráfica" es el
  // repositorio; "Gestor de presentaciones" solo para Super Admin.
  const [seccion, setSeccion] = useState("linea");
  const secciones = [
    { key: "linea", label: "Línea gráfica", icon: "clip" },
    ...(esSuperAdmin ? [{ key: "gestor", label: "Gestor de presentaciones", icon: "megaphone" }] : []),
  ];
  const [paises, setPaises] = useState([]);
  const [archivos, setArchivos] = useState([]);
  // País elegido ("" = todos, que es como arranca la página).
  const [tab, setTab] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  // Filtro por categoría dentro del país elegido ("" = todas).
  const [categoria, setCategoria] = useState("");
  const [viendo, setViendo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    const res = await apiFetch("/api/marca/archivos");
    setArchivos(res.archivos);
  }

  useEffect(() => {
    Promise.all([apiFetch("/api/marca/paises"), apiFetch("/api/marca/archivos")])
      .then(([p, a]) => {
        setPaises(p.paises);
        setArchivos(a.archivos);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user?.pais]);

  const conteo = useMemo(() => {
    const c = {};
    for (const a of archivos) c[a.pais] = (c[a.pais] || 0) + 1;
    return c;
  }, [archivos]);

  const gruposDelPais = useMemo(
    () =>
      CATEGORIAS_MARCA.map((cat) => ({
        ...cat,
        items: archivos.filter((a) => (!tab || a.pais === tab) && a.categoria === cat.codigo),
      })).filter((g) => g.items.length > 0),
    [archivos, tab]
  );
  const totalDelPais = gruposDelPais.reduce((n, g) => n + g.items.length, 0);
  const grupos = categoria ? gruposDelPais.filter((g) => g.codigo === categoria) : gruposDelPais;

  function elegirPais(codigo) {
    setTab(codigo);
    setCategoria("");
  }

  async function borrar(a) {
    if (!window.confirm(`¿Borrar "${a.nombre}"? Nadie podrá volver a descargarlo.`)) return;
    setError("");
    try {
      await apiFetch(`/api/marca/archivos/${a.id}`, { method: "DELETE" });
      setViendo(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onSubido(pais) {
    if (pais) {
      elegirPais(pais);
      setSubiendo(false);
    }
    await cargar().catch((err) => setError(err.message));
  }

  return (
    <div>
      <div className="mb-6">
        <p className="label-mono text-[10.5px] text-brand-purple mb-2">Línea gráfica · Signal</p>
        <h1 className="font-display font-medium text-gray-900 text-[28px] md:text-[34px] leading-tight tracking-tight">
          Material Comercial
        </h1>
        <p className="mt-2 text-sm text-slate-label max-w-2xl">
          Logos, presentaciones, plantillas y piezas de la marca, ordenados por país. En Global está lo que sirve para
          todos.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6">
        <Tabs tabs={secciones} active={seccion} onChange={setSeccion} />
      </div>

      {seccion === "gestor" && esSuperAdmin ? (
        <GestorPresentaciones />
      ) : loading ? (
        <Spinner label="Cargando material..." />
      ) : (
        <>
          {/* Plegado por defecto: abierto, sus selectores de País/Categoría se
              confundían con los filtros de la lista (2026-10-24). */}
          {esStaff &&
            (subiendo ? (
              <FormSubida
                paises={paises}
                paisActual={tab || PAIS_GLOBAL.codigo}
                onSubido={onSubido}
                onCerrar={() => setSubiendo(false)}
              />
            ) : (
              <div className="mb-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSubiendo(true)}
                  className="bg-brand-magenta text-on-accent text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-magenta/90"
                >
                  + Subir material
                </button>
              </div>
            ))}

          <div role="tablist" aria-label="País" className="flex flex-wrap gap-2 mb-5">
            {[{ codigo: "", nombre: "Todos" }, ...paises].map((p) => {
              const activo = p.codigo === tab;
              return (
                <button
                  key={p.codigo || "todos"}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => elegirPais(p.codigo)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border transition-colors ${
                    activo
                      ? "bg-brand-purple/10 border-brand-purple/60 text-gray-900"
                      : "border-line text-gray-600 hover:text-gray-900 hover:border-brand-purple/35"
                  }`}
                >
                  {p.nombre}
                  <span className={`font-mono text-[11px] ${activo ? "text-brand-purple" : "text-gray-400"}`}>
                    {p.codigo ? conteo[p.codigo] || 0 : archivos.length}
                  </span>
                </button>
              );
            })}
          </div>

          {gruposDelPais.length > 0 && (
            <div role="group" aria-label="Categoría" className="flex flex-wrap items-center gap-1.5 mb-6">
              <span className="label-mono text-[10px] text-gray-500 mr-1">Categoría</span>
              {[{ codigo: "", nombre: "Todas", n: totalDelPais }, ...gruposDelPais.map((g) => ({ ...g, n: g.items.length }))].map(
                (c) => {
                  const activa = c.codigo === categoria;
                  return (
                    <button
                      key={c.codigo || "todas"}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => setCategoria(c.codigo)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        activa
                          ? "bg-brand-purple text-on-accent border-brand-purple font-medium"
                          : "border-line text-gray-600 hover:text-gray-900 hover:border-brand-purple/35"
                      }`}
                    >
                      {c.nombre}
                      <span className={`font-mono text-[10px] ${activa ? "text-on-accent/70" : "text-gray-400"}`}>{c.n}</span>
                    </button>
                  );
                }
              )}
            </div>
          )}

          {grupos.length === 0 ? (
            <Card hover={false}>
              <EmptyState
                message={
                  esStaff
                    ? "Todavía no hay material con este filtro. Súbelo con «+ Subir material»."
                    : "Todavía no hay material con este filtro."
                }
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {grupos.map((g) => (
                <section key={g.codigo}>
                  <h2 className="label-mono text-[10.5px] text-gray-500 mb-3">
                    {g.nombre} <span className="text-gray-400">· {g.items.length}</span>
                  </h2>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                    {g.items.map((a) => (
                      <TarjetaArchivo
                        key={a.id}
                        a={a}
                        esStaff={esStaff}
                        onBorrar={borrar}
                        onVer={setViendo}
                        paisNombre={tab ? null : paises.find((x) => x.codigo === a.pais)?.nombre}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {viendo && <VistaPrevia a={viendo} esStaff={esStaff} onBorrar={borrar} onCerrar={() => setViendo(null)} />}
    </div>
  );
}
