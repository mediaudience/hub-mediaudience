import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import Tabs from "../../components/common/Tabs";

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

const SECCIONES = [
  { key: "campanas_servidas", label: "Campañas Servidas", icon: "megaphone" },
  { key: "facturacion", label: "Facturación", icon: "clip" },
];

export default function GestionSheets() {
  const [seccion, setSeccion] = useState(SECCIONES[0].key);
  const [paises, setPaises] = useState([]);
  const [sheets, setSheets] = useState({});
  const [borradores, setBorradores] = useState({});
  const [guardando, setGuardando] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [resPaises, resSheets] = await Promise.all([
        apiFetch("/api/admin/paises"),
        apiFetch("/api/admin/gestion-sheets"),
      ]);
      setPaises(resPaises.paises.filter((p) => p.activo));
      const mapa = {};
      for (const fila of resSheets.sheets) {
        mapa[`${fila.seccion}:${fila.pais}`] = fila.sheet_id;
      }
      setSheets(mapa);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function valorDe(pais) {
    const clave = `${seccion}:${pais}`;
    return borradores[clave] ?? sheets[clave] ?? "";
  }

  function onCambiar(pais, valor) {
    setBorradores((b) => ({ ...b, [`${seccion}:${pais}`]: valor }));
  }

  async function guardar(pais) {
    const clave = `${seccion}:${pais}`;
    setGuardando(clave);
    setError("");
    try {
      const sheetId = valorDe(pais);
      await apiFetch(`/api/admin/gestion-sheets/${seccion}/${pais}`, {
        method: "PUT",
        body: JSON.stringify({ sheetId }),
      });
      setSheets((s) => ({ ...s, [clave]: sheetId }));
      setBorradores((b) => {
        const copia = { ...b };
        delete copia[clave];
        return copia;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(null);
    }
  }

  const seccionActual = SECCIONES.find((s) => s.key === seccion);

  return (
    <div>
      <GradientHeader title="Administración: Sheets de Gestión" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="mb-4 overflow-hidden">
        <Tabs tabs={SECCIONES} active={seccion} onChange={setSeccion} />
        <div className="p-6">
          <p className="text-sm text-slate-label mb-4">
            Sheet ID de {seccionActual?.label} por país -- data administrativa, no ligada a clientes ni anunciantes.
            Un país sin Sheet ID cargado simplemente no muestra datos todavía en esa sección.
          </p>

          {loading ? (
            <Spinner label="Cargando..." />
          ) : (
            <div className="flex flex-col gap-3">
              {paises.map((p) => {
                const clave = `${seccion}:${p.codigo}`;
                const sucio = borradores[clave] !== undefined && borradores[clave] !== (sheets[clave] ?? "");
                return (
                  <div key={p.codigo} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-sm font-medium text-gray-700">{p.nombre}</span>
                    <input
                      value={valorDe(p.codigo)}
                      onChange={(e) => onCambiar(p.codigo, e.target.value)}
                      placeholder="ID del Google Sheet"
                      className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                    />
                    <button
                      type="button"
                      disabled={!sucio || guardando === clave}
                      onClick={() => guardar(p.codigo)}
                      className="shrink-0 bg-brand-magenta text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-brand-magenta/90 disabled:opacity-40"
                    >
                      {guardando === clave ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
