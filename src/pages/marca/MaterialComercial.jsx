import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import Tabs from "../../components/common/Tabs";
import { useAuth } from "../../context/AuthContext";
import { CATEGORIAS_MARCA, PAIS_GLOBAL, MARCA_MAX_MB } from "../../../shared/marca";
import {
  CAMPOS_PRESENTACION,
  LAMINAS_FIJAS,
  PRODUCTOS_PRESENTACION,
  SECCIONES_PRESENTACION,
} from "../../../shared/presentaciones";

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

// Gestor de presentaciones (solo Super Admin): por país, qué productos lleva
// la presentación comercial, en qué orden y con qué datos (cifras, telcos,
// casos). "Guardar y generar" arma el .pptx en el server y lo publica en
// Material Comercial del país, reemplazando la versión anterior.

// Los datos viajan como arrays; en pantalla, listas y cifras se editan como
// texto (un ítem por línea, columnas separadas por "|").
function aTexto(campo, v) {
  if (campo.tipo === "lista") return (v || []).join("\n");
  if (campo.tipo === "kpis" || campo.tipo === "filas") return (v || []).map((f) => f.join(" | ")).join("\n");
  if (campo.tipo === "kpi") return v || ["", ""];
  return v ?? "";
}

function deTexto(campo, v) {
  const lineas = (t) => String(t).split("\n").map((l) => l.trim()).filter(Boolean);
  if (campo.tipo === "lista") return lineas(v);
  if (campo.tipo === "kpis" || campo.tipo === "filas") return lineas(v).map((l) => l.split("|").map((c) => c.trim()));
  return v;
}

function CampoDato({ campo, valor, onChange }) {
  const id = `campo-${campo.clave}`;
  const ayuda = {
    lista: "Uno por línea.",
    kpis: "Uno por línea: cifra | texto. Ej: +24M | dispositivos en Perú",
    filas: `Una fila por línea: ${(campo.columnas || []).join(" | ")}`,
  }[campo.tipo];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-gray-900">
        {campo.etiqueta}
        {campo.pais && <span className="label-mono text-[9.5px] text-brand-purple ml-2">propio del país</span>}
      </label>
      {campo.tipo === "kpi" ? (
        <div className="flex gap-2">
          <input id={id} className={`${inputClass} max-w-[8rem]`} placeholder="Cifra" value={valor[0]}
            onChange={(e) => onChange([e.target.value, valor[1]])} />
          <input aria-label={`${campo.etiqueta} · texto`} className={inputClass} placeholder="Texto" value={valor[1]}
            onChange={(e) => onChange([valor[0], e.target.value])} />
        </div>
      ) : campo.tipo === "texto" ? (
        <input id={id} className={inputClass} value={valor} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <textarea id={id} className={`${inputClass} font-mono text-[13px]`} value={valor}
          rows={Math.min(8, Math.max(2, String(valor).split("\n").length + 1))}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {ayuda && <p className="text-xs text-gray-500">{ayuda}</p>}
    </div>
  );
}

function GestorPresentaciones({ paisInicial, onVerVista }) {
  const [paises, setPaises] = useState([]);
  const [pais, setPais] = useState(paisInicial || "PE");
  // `orden` tiene los 8 productos del catálogo en el orden de la presentación;
  // `incluidos`, los que van. Marcar o desmarcar no mueve nada: el orden solo
  // cambia con las flechas.
  const [orden, setOrden] = useState(PRODUCTOS_PRESENTACION.map((p) => p.clave));
  const [incluidos, setIncluidos] = useState([]);
  const [form, setForm] = useState({});
  const [info, setInfo] = useState(null);
  const [trabajo, setTrabajo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState("portada");

  const cargarPaises = () => apiFetch("/api/presentaciones").then((r) => setPaises(r.paises));

  useEffect(() => {
    cargarPaises().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setCargando(true);
    setAviso("");
    setError("");
    apiFetch(`/api/presentaciones/${pais}`)
      .then((r) => {
        setOrden([...r.productos, ...PRODUCTOS_PRESENTACION.map((p) => p.clave).filter((c) => !r.productos.includes(c))]);
        setIncluidos(r.productos);
        setForm(Object.fromEntries(CAMPOS_PRESENTACION.map((c) => [c.clave, aTexto(c, r.datos[c.clave])])));
        setInfo(r);
        setTrabajo(r.trabajo);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [pais]);

  // Mientras genera, se consulta el estado cada 3 s.
  useEffect(() => {
    if (trabajo?.estado !== "generando") return;
    const t = setInterval(async () => {
      try {
        const r = await apiFetch(`/api/presentaciones/${pais}/estado`);
        setTrabajo(r.trabajo);
        if (r.trabajo?.estado !== "generando") cargarPaises();
      } catch (err) {
        setError(err.message);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [trabajo?.estado, pais]);

  const productos = orden.filter((c) => incluidos.includes(c));
  const datos = () => Object.fromEntries(CAMPOS_PRESENTACION.map((c) => [c.clave, deTexto(c, form[c.clave])]));
  const laminas =
    LAMINAS_FIJAS + productos.reduce((n, p) => n + (PRODUCTOS_PRESENTACION.find((x) => x.clave === p)?.laminas || 0), 0);

  function alternar(clave) {
    setIncluidos((ps) => (ps.includes(clave) ? ps.filter((p) => p !== clave) : [...ps, clave]));
  }

  function mover(clave, paso) {
    setOrden((ps) => {
      const i = ps.indexOf(clave);
      const j = i + paso;
      if (j < 0 || j >= ps.length) return ps;
      const nuevo = [...ps];
      [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
      return nuevo;
    });
  }

  async function guardar(generar) {
    setGuardando(true);
    setAviso("");
    setError("");
    try {
      const body = JSON.stringify({ productos, datos: datos() });
      if (generar) {
        const r = await apiFetch(`/api/presentaciones/${pais}/generar`, { method: "POST", body });
        setTrabajo(r.trabajo);
      } else {
        const r = await apiFetch(`/api/presentaciones/${pais}`, { method: "PUT", body });
        setInfo(r);
        setAviso("Datos guardados.");
      }
      cargarPaises();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const nombrePais = paises.find((p) => p.codigo === pais)?.nombre || pais;
  const generando = trabajo?.estado === "generando";
  const ordenados = orden.map((c) => PRODUCTOS_PRESENTACION.find((p) => p.clave === c)).filter(Boolean);
  // Portada y datos generales arriba; después cada producto, en el orden de la lista.
  const secciones = [
    ...SECCIONES_PRESENTACION.filter((s) => s.clave === "portada" || s.clave === "general"),
    ...ordenados,
  ];

  function verDatos(clave) {
    setAbierta(clave);
    // En pantallas angostas los datos quedan debajo de la lista.
    requestAnimationFrame(() =>
      document.getElementById(`seccion-${clave}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-6" hover={false}>
        <h2 className="font-display font-semibold text-xl text-gray-900 mb-1">Gestor de presentaciones</h2>
        <p className="text-sm text-slate-label max-w-3xl">
          Elige el país, marca los productos y su orden, y revisa los datos. Al generar se arma un borrador que ves en
          Vista previa; desde ahí lo descargas o lo publicas en Material Comercial. Un dato vacío no sale en la
          presentación (si falta el caso o la cifra de un país, ese bloque se omite).
        </p>
        <div role="tablist" aria-label="País" className="flex flex-wrap gap-2 mt-5">
          {paises.map((p) => (
            <button key={p.codigo} type="button" role="tab" aria-selected={p.codigo === pais}
              onClick={() => setPais(p.codigo)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border transition-colors ${
                p.codigo === pais
                  ? "bg-brand-purple/10 border-brand-purple/60 text-gray-900"
                  : "border-line text-gray-600 hover:text-gray-900 hover:border-brand-purple/35"
              }`}>
              {p.nombre}
              <span className={`label-mono text-[9.5px] ${p.guardado ? "text-brand-purple" : "text-gray-400"}`}>
                {p.generando ? "generando" : p.guardado ? `${p.productos} productos` : "sin armar"}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {cargando ? (
        <Spinner label="Cargando datos del país..." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start">
          <Card className="p-5" hover={false}>
            <h3 className="label-mono text-[10.5px] text-gray-500 mb-3">Siempre van</h3>
            <ul className="flex flex-col gap-1.5 mb-5">
              {[
                { clave: "portada", nombre: "Portada", detalle: "Logo grande, frase y slogan" },
                { clave: "general", nombre: "Datos generales", detalle: "Quiénes somos, full funnel y contacto" },
              ].map((f) => (
                <li key={f.clave}>
                  <button type="button" onClick={() => verDatos(f.clave)}
                    className={`w-full text-left rounded-md border bg-ink-deep px-3 py-2 hover:border-brand-purple ${
                      abierta === f.clave ? "border-brand-purple" : "border-brand-purple/40"
                    }`}>
                    <span className="block text-sm text-gray-900">{f.nombre}</span>
                    <span className="block text-xs text-gray-500">{f.detalle}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="label-mono text-[10.5px] text-gray-500">Productos de {nombrePais}</h3>
              <span className="font-mono text-[11px] text-brand-purple">{laminas} láminas</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {ordenados.map((p) => {
                const activo = incluidos.includes(p.clave);
                const n = productos.indexOf(p.clave);
                const i = orden.indexOf(p.clave);
                const viendo = abierta === p.clave;
                return (
                  <li key={p.clave}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                      viendo ? "border-brand-purple" : activo ? "border-brand-purple/40" : "border-line"
                    } ${activo ? "bg-ink-deep" : ""}`}>
                    <input id={`prod-${p.clave}`} type="checkbox" checked={activo} onChange={() => alternar(p.clave)}
                      aria-label={`Incluir ${p.nombre}`} className="accent-brand-purple" />
                    <button type="button" onClick={() => verDatos(p.clave)} title="Ver sus datos"
                      className={`flex-1 text-left text-sm hover:text-brand-purple ${activo ? "text-gray-900" : "text-gray-500"}`}>
                      <span className="font-mono text-[11px] text-brand-purple mr-2 inline-block w-5">
                        {activo ? String(n + 1).padStart(2, "0") : "—"}
                      </span>
                      {p.nombre}
                    </button>
                    <span className="flex gap-1">
                      <button type="button" aria-label={`Subir ${p.nombre}`} disabled={i === 0} onClick={() => mover(p.clave, -1)}
                        className="px-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30">↑</button>
                      <button type="button" aria-label={`Bajar ${p.nombre}`} disabled={i === orden.length - 1}
                        onClick={() => mover(p.clave, 1)} className="px-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30">↓</button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              El casillero incluye o saca el producto; las flechas cambian el orden. Toca el nombre para ver sus datos.
              Además de los productos, siempre van portada, quiénes somos, objetivo, full funnel, clientes y cierre.
            </p>
          </Card>

          <Card className="p-5" hover={false}>
            <h3 className="label-mono text-[10.5px] text-gray-500 mb-3">Datos de {nombrePais}</h3>
            <div className="flex flex-col gap-2">
              {secciones.map((sec) => (
                <section key={sec.clave} id={`seccion-${sec.clave}`}
                  className={`rounded-md border ${abierta === sec.clave ? "border-brand-purple/50" : "border-line"}`}>
                  <button type="button" aria-expanded={abierta === sec.clave}
                    onClick={() => setAbierta(abierta === sec.clave ? "" : sec.clave)}
                    className="w-full flex justify-between items-center px-4 py-3 text-left text-sm font-medium text-gray-900">
                    <span>
                      {sec.nombre}
                      {sec.laminas && !incluidos.includes(sec.clave) && (
                        <span className="label-mono text-[9.5px] text-gray-400 ml-2">no incluido</span>
                      )}
                    </span>
                    <span className="text-gray-500">{abierta === sec.clave ? "−" : "+"}</span>
                  </button>
                  {abierta === sec.clave && (
                    <div className="flex flex-col gap-4 px-4 pb-4">
                      {CAMPOS_PRESENTACION.some((c) => c.seccion === sec.clave) ? (
                        CAMPOS_PRESENTACION.filter((c) => c.seccion === sec.clave).map((c) => (
                          <CampoDato key={c.clave} campo={c} valor={form[c.clave]}
                            onChange={(v) => setForm((f) => ({ ...f, [c.clave]: v }))} />
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">
                          Este producto no tiene datos para editar: sus {sec.laminas} láminas son iguales para todos los países.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-line">
              <button type="button" disabled={guardando || generando} onClick={() => guardar(true)}
                className="bg-brand-magenta text-on-accent text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-magenta/90 disabled:opacity-50">
                {generando ? "Generando..." : "Guardar y generar vista previa"}
              </button>
              <button type="button" disabled={guardando || generando} onClick={() => guardar(false)}
                className="text-sm px-4 py-2 rounded-md border border-line text-gray-900 hover:border-brand-purple/35 disabled:opacity-50">
                Solo guardar
              </button>
              <span role="status" className="text-sm text-gray-600">
                {generando && `${trabajo.fase || "Generando"}... tarda cerca de un minuto.`}
                {!generando && aviso}
                {!generando && trabajo?.estado === "error" && <span className="text-red-600">{trabajo.error}</span>}
                {!generando && trabajo?.estado === "listo" && (
                  <>
                    Borrador listo. Revísalo antes de publicarlo.{" "}
                    <button type="button" onClick={() => onVerVista(pais)} className="text-brand-purple font-medium hover:underline">
                      Ver vista previa →
                    </button>
                  </>
                )}
              </span>
            </div>
            {info?.updated_at && (
              <p className="text-xs text-gray-500 mt-3">
                Última edición: {formatoFecha(info.updated_at)}
                {info.actualizado_por_nombre ? ` · ${info.actualizado_por_nombre}` : ""}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}


// Modo presentación: las láminas a pantalla completa, una por vez. Avanza con
// clic, flechas o barra espaciadora; Esc sale. Por ahora usa las imágenes de la
// vista previa (los videos se ven como cuadro fijo; se mejora después).
function VideoLamina({ src, v, todos }) {
  const ref = useRef(null);
  const [andando, setAndando] = useState(false);
  const [volumen, setVolumen] = useState(0.8);
  const cambiarVolumen = (x) => {
    setVolumen(x);
    if (ref.current) {
      ref.current.volume = x;
      ref.current.muted = x === 0;
    }
  };
  const play = () => ref.current?.play().then(() => setAndando(true)).catch(() => {});
  useEffect(() => {
    if (todos > 0) play();
  }, [todos]);
  return (
    <div className="absolute" style={{ left: `${v.x * 100}%`, top: `${v.y * 100}%`, width: `${v.w * 100}%`, height: `${v.h * 100}%` }}
      onClick={(e) => {
        e.stopPropagation();
        if (andando) {
          ref.current?.pause();
          setAndando(false);
        } else play();
      }}>
      <video ref={ref} src={src} loop playsInline preload="auto" className="w-full h-full object-cover" />
      {v.audio && (
        // Control de volumen (solo en los videos que traen sonido).
        <div onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-white">
          <button type="button" aria-label={volumen === 0 ? "Activar sonido" : "Silenciar"} className="text-base leading-none"
            onClick={() => cambiarVolumen(volumen === 0 ? 0.8 : 0)}>
            {volumen === 0 ? "🔇" : "🔊"}
          </button>
          <input type="range" min="0" max="1" step="0.05" value={volumen} aria-label="Volumen"
            onChange={(e) => cambiarVolumen(Number(e.target.value))} className="w-20 accent-[#58b0ff]" />
        </div>
      )}
      {!andando && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-14 h-14 rounded-full bg-[#58b0ff]/90 text-[#040b17] flex items-center justify-center text-2xl shadow-lg">▶</span>
        </span>
      )}
    </div>
  );
}

function Presentador({ total, src, base, onCerrar }) {
  const ref = useRef(null);
  const [n, setN] = useState(1);
  // Videos de cada lámina con su posición (fracciones de la lámina). Arrancan con su botón ▶ o con
  // "Reproducir videos" (todos los de la lámina); `todos` es un contador que cada video escucha.
  const [videos, setVideos] = useState({});
  const [todos, setTodos] = useState(0);
  useEffect(() => setTodos(0), [n]);
  useEffect(() => {
    fetch(`${base}/videos.json`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : {}))
      .then(setVideos)
      .catch(() => {});
  }, [base]);
  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    const salir = () => !document.fullscreenElement && onCerrar();
    const tecla = (e) => {
      if (["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"].includes(e.key)) setN((x) => Math.min(total, x + 1));
      if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) setN((x) => Math.max(1, x - 1));
      if (e.key === "Home") setN(1);
      if (e.key === "End") setN(total);
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("fullscreenchange", salir);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("fullscreenchange", salir);
      window.removeEventListener("keydown", tecla);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [total]);
  // Precarga la siguiente lámina para que el cambio sea instantáneo.
  useEffect(() => {
    if (n < total) new Image().src = src(n + 1);
  }, [n]);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Modo presentación"
      onClick={(e) => (e.clientX < window.innerWidth / 4 ? setN((x) => Math.max(1, x - 1)) : setN((x) => Math.min(total, x + 1)))}
      className="fixed inset-0 z-[60] bg-black flex items-center justify-center cursor-pointer select-none group">
      {/* Caja 16:9 que entra en la pantalla: la lámina de fondo y los videos encima, en su lugar. */}
      <div className="relative" style={{ width: "min(100vw, calc(100vh * 16 / 9))", aspectRatio: "16 / 9" }}>
        <img src={src(n)} alt={`Lámina ${n}`} className="absolute inset-0 w-full h-full object-contain" />
        {(videos[String(n)] || []).map((v, i) => (
          <VideoLamina key={`${n}-${i}`} src={`${base}/video/${v.v}`} v={v} todos={todos} />
        ))}
        {n === 1 && (
          // Portada: el isotipo late y emite la onda de radar, igual que el logo del hub (brand-dot /
          // brand-ping en index.css). Posición = la del isotipo en Deck.portada_logo (logo de 8,4"
          // centrado a 2,05" del borde superior en una lámina de 13,333" × 7,5").
          <svg viewBox="0 0 28 28" aria-hidden="true" className="absolute overflow-visible pointer-events-none"
            style={{ left: "19.38%", top: "28.92%", width: "9.35%", height: "16.62%" }}>
            <circle cx="14" cy="14" r="4.2" fill="#0a0e17" />
            <circle className="brand-ping" cx="14" cy="14" r="3.5" fill="none" stroke="#58B0FF" strokeWidth="1.2" />
            <circle className="brand-dot" cx="14" cy="14" r="3.5" fill="#58B0FF" />
          </svg>
        )}
      </div>
      {(videos[String(n)] || []).length > 0 && (
        <button type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTodos((t) => t + 1);
          }}
          className="absolute top-4 right-4 inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full bg-[#58b0ff] text-[#040b17] shadow-lg hover:opacity-90">
          ▶ Reproducir videos
        </button>
      )}
      <div className="absolute bottom-3 right-4 font-mono text-xs text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
        {n} / {total} · Esc para salir
      </div>
    </div>
  );
}

// Vista previa (solo Super Admin): el borrador que armó el Gestor, lámina por
// lámina, con Descargar y Publicar; y la presentación publicada del país.
function VistaPresentaciones({ paisInicial, onCambiarPais, onEditar }) {
  const [paises, setPaises] = useState([]);
  const [pais, setPais] = useState(paisInicial || "PE");
  const [vista, setVista] = useState(null);
  const [tipo, setTipo] = useState("borrador");
  const [grande, setGrande] = useState(null);
  const [presentando, setPresentando] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/presentaciones").then((r) => setPaises(r.paises)).catch((err) => setError(err.message));
  }, []);

  async function cargar(codigo = pais) {
    const r = await apiFetch(`/api/presentaciones/${codigo}/vista`);
    setVista(r);
    setTipo(r.borrador ? "borrador" : "publicada");
    return r;
  }

  useEffect(() => {
    setCargando(true);
    setAviso("");
    setError("");
    setConfirmar(false);
    cargar(pais)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [pais]);

  // Si el borrador todavía se está generando, se espera y se recarga.
  useEffect(() => {
    if (vista?.trabajo?.estado !== "generando") return;
    const t = setInterval(() => cargar().catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [vista?.trabajo?.estado, pais]);

  function elegir(codigo) {
    setPais(codigo);
    onCambiarPais(codigo);
  }

  async function publicar() {
    setPublicando(true);
    setError("");
    try {
      await apiFetch(`/api/presentaciones/${pais}/publicar`, { method: "POST" });
      await cargar();
      setTipo("publicada");
      setConfirmar(false);
      setAviso("Publicada. Ya está en Línea gráfica › " + (paises.find((p) => p.codigo === pais)?.nombre || pais) + " › Presentaciones comerciales.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublicando(false);
    }
  }

  const nombrePais = paises.find((p) => p.codigo === pais)?.nombre || pais;
  const meta = vista?.[tipo];
  const laminas = meta?.laminas || 0;
  const version = encodeURIComponent(meta?.at || "");
  const src = (n) => `/api/presentaciones/${pais}/vista/${tipo}/${n}?v=${version}`;
  const fecha = (iso) =>
    new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });

  // El visor se abre en pantalla completa (si el navegador lo permite) para leer bien los textos.
  const visorRef = useRef(null);
  const abierto = !!grande;
  useEffect(() => {
    if (!abierto) return;
    visorRef.current?.requestFullscreen?.().catch(() => {});
    const salir = () => !document.fullscreenElement && setGrande(null);
    document.addEventListener("fullscreenchange", salir);
    return () => {
      document.removeEventListener("fullscreenchange", salir);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [abierto]);

  useEffect(() => {
    if (!grande) return;
    const tecla = (e) => {
      if (e.key === "Escape") setGrande(null);
      if (e.key === "ArrowRight") setGrande((n) => Math.min(laminas, n + 1));
      if (e.key === "ArrowLeft") setGrande((n) => Math.max(1, n - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [grande, laminas]);

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-6" hover={false}>
        <h2 className="font-display font-semibold text-xl text-gray-900 mb-1">Vista previa</h2>
        <p className="text-sm text-slate-label max-w-3xl">
          Acá ves lámina por lámina lo que generó el Gestor. Si está bien, lo publicas y reemplaza a la presentación
          del país en Línea gráfica. La presentación publicada siempre se descarga desde acá o desde Línea gráfica ›
          país › Presentaciones comerciales.
        </p>
        <div role="tablist" aria-label="País" className="flex flex-wrap gap-2 mt-5">
          {paises.map((p) => (
            <button key={p.codigo} type="button" role="tab" aria-selected={p.codigo === pais} onClick={() => elegir(p.codigo)}
              className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                p.codigo === pais
                  ? "bg-brand-purple/10 border-brand-purple/60 text-gray-900"
                  : "border-line text-gray-600 hover:text-gray-900 hover:border-brand-purple/35"
              }`}>
              {p.nombre}
            </button>
          ))}
        </div>
      </Card>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {aviso && <div role="status" className="rounded-lg border border-brand-purple/40 px-4 py-3 text-sm text-gray-900">{aviso}</div>}

      {cargando ? (
        <Spinner label="Cargando vista previa..." />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["borrador", "Borrador", vista?.borrador],
              ["publicada", "Publicada", vista?.publicada],
            ].map(([clave, titulo, m]) => (
              <Card key={clave} hover={false}
                className={`p-5 ${tipo === clave ? "ring-1 ring-brand-purple" : ""}`}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <h3 className="font-display font-semibold text-gray-900 flex items-center gap-3">
                    {titulo}
                    {m?.laminas ? (
                      <button type="button" onClick={() => setPresentando({ tipo: clave, total: m.laminas, at: m.at })}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-brand-purple/15 text-brand-purple border border-brand-purple/50 hover:bg-brand-purple/25">
                        ▶ Presentar
                      </button>
                    ) : null}
                    {m?.laminas ? (
                      <a href={`/api/presentaciones/${pais}/vista/${clave}/offline`}
                        title="ZIP con las láminas, los videos y un archivo presentar.html que se abre sin internet"
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-line text-gray-900 hover:border-brand-purple/50">
                        ⬇ Para presentar sin internet
                      </a>
                    ) : null}
                  </h3>
                  {m?.laminas ? (
                    <button type="button" onClick={() => setTipo(clave)} className="text-xs text-brand-purple hover:underline">
                      {tipo === clave ? "Viendo" : "Ver láminas"}
                    </button>
                  ) : null}
                </div>
                {clave === "borrador" ? (
                  vista?.trabajo?.estado === "generando" ? (
                    <p className="text-sm text-gray-600">{vista.trabajo.fase || "Generando"}... esta página se actualiza sola.</p>
                  ) : m ? (
                    <>
                      <p className="text-sm text-gray-600 mb-4">
                        {m.laminas} láminas · generado {fecha(m.at)}
                        {m.por ? ` por ${m.por}` : ""}. Todavía no está en Línea gráfica.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {confirmar ? (
                          <>
                            <button type="button" disabled={publicando} onClick={publicar}
                              className="bg-brand-magenta text-on-accent text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-magenta/90 disabled:opacity-50">
                              {publicando ? "Publicando..." : `Sí, reemplazar la de ${nombrePais}`}
                            </button>
                            <button type="button" onClick={() => setConfirmar(false)}
                              className="text-sm px-4 py-2 rounded-md border border-line text-gray-900">
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => setConfirmar(true)}
                              className="bg-brand-magenta text-on-accent text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-magenta/90">
                              Publicar en Línea gráfica
                            </button>
                            <a href={`/api/presentaciones/${pais}/borrador/descargar`}
                              className="text-sm px-4 py-2 rounded-md border border-line text-gray-900 hover:border-brand-purple/35">
                              Descargar borrador (.pptx)
                            </a>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      No hay borrador.{" "}
                      <button type="button" onClick={() => onEditar(pais)} className="text-brand-purple hover:underline">
                        Genéralo desde el Gestor
                      </button>
                      .
                    </p>
                  )
                ) : m ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      {m.archivo.nombre} · {formatoTamano(m.archivo.tamano)} · publicada {formatoFecha(m.archivo.created_at)}
                      {!m.laminas && ". Se publicó antes del gestor: sus láminas no se pueden ver acá, solo descargar."}
                    </p>
                    <a href={`/api/marca/archivos/${m.archivo.id}/descargar`}
                      className="inline-block bg-brand-magenta text-on-accent text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-magenta/90">
                      Descargar presentación publicada (.pptx)
                    </a>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">{nombrePais} todavía no tiene presentación publicada.</p>
                )}
              </Card>
            ))}
          </div>

          {laminas > 0 ? (
            <section>
              <h3 className="label-mono text-[10.5px] text-gray-500 mb-3">
                {tipo === "borrador" ? "Borrador" : "Publicada"} · {nombrePais} · {laminas} láminas
              </h3>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: laminas }, (_, i) => i + 1).map((n) => (
                  <figure key={n} className="m-0">
                    <button type="button" onClick={() => setGrande(n)} aria-label={`Ver lámina ${n} en grande`}
                      className="block w-full rounded-md overflow-hidden border border-line hover:border-brand-purple/60 bg-ink-deep aspect-video">
                      <img src={src(n)} alt={`Lámina ${n}`} loading="lazy" className="w-full h-full object-contain" />
                    </button>
                    <figcaption className="font-mono text-[11px] text-gray-500 mt-1.5">{String(n).padStart(2, "0")}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {presentando && (
        <Presentador
          total={presentando.total}
          base={`/api/presentaciones/${pais}/vista/${presentando.tipo}`}
          src={(k) => `/api/presentaciones/${pais}/vista/${presentando.tipo}/${k}?v=${encodeURIComponent(presentando.at || "")}`}
          onCerrar={() => setPresentando(null)}
        />
      )}

      {grande && (
        <div ref={visorRef} role="dialog" aria-modal="true" aria-label={`Lámina ${grande}`} onClick={() => setGrande(null)}
          className="fixed inset-0 z-50 bg-[#06090f] flex flex-col items-center justify-center p-3">
          <img src={src(grande)} alt={`Lámina ${grande}`} onClick={(e) => e.stopPropagation()}
            className="w-full h-full max-h-[calc(100vh-4.5rem)] object-contain rounded-md" />
          <div className="flex items-center gap-4 mt-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={grande === 1} onClick={() => setGrande(grande - 1)}
              className="px-3 py-1.5 rounded-md border border-white/30 disabled:opacity-30">← Anterior</button>
            <span className="font-mono">{grande} / {laminas}</span>
            <button type="button" disabled={grande === laminas} onClick={() => setGrande(grande + 1)}
              className="px-3 py-1.5 rounded-md border border-white/30 disabled:opacity-30">Siguiente →</button>
            <button type="button" onClick={() => setGrande(null)} className="px-3 py-1.5 rounded-md border border-white/30">Cerrar (Esc)</button>
          </div>
        </div>
      )}
    </div>
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
    ...(esSuperAdmin
      ? [
          { key: "gestor", label: "Gestor de presentaciones", icon: "megaphone" },
          { key: "vista", label: "Vista previa", icon: "eye" },
        ]
      : []),
  ];
  // País que se ve en Gestor y Vista previa (se comparte al pasar de una a otra).
  const [paisPres, setPaisPres] = useState("PE");
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

  // Al volver del gestor se recarga: puede haber publicado una presentación.
  useEffect(() => {
    if (seccion === "linea" && !loading) cargar().catch((err) => setError(err.message));
  }, [seccion]);

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
        <GestorPresentaciones
          paisInicial={paisPres}
          onVerVista={(p) => {
            setPaisPres(p);
            setSeccion("vista");
          }}
        />
      ) : seccion === "vista" && esSuperAdmin ? (
        <VistaPresentaciones
          paisInicial={paisPres}
          onCambiarPais={setPaisPres}
          onEditar={(p) => {
            setPaisPres(p);
            setSeccion("gestor");
          }}
        />
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
