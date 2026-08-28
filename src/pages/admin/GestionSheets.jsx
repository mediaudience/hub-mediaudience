import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";

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

export default function GestionSheets() {
  const [paises, setPaises] = useState([]);
  const [sheets, setSheets] = useState({});
  const [borradores, setBorradores] = useState({});
  const [guardando, setGuardando] = useState(null);
  const [sincronizando, setSincronizando] = useState(null);
  const [syncEstado, setSyncEstado] = useState({});
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
        mapa[fila.pais] = fila.sheet_id;
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
    return borradores[pais] ?? sheets[pais] ?? "";
  }

  function onCambiar(pais, valor) {
    setBorradores((b) => ({ ...b, [pais]: valor }));
  }

  function aplicarResultadoSync(pais, sync) {
    if (!sync) return;
    if (sync.sincronizado) {
      setSyncEstado((s) => ({
        ...s,
        [pais]: {
          ok: true,
          mensaje: `Sincronizado: ${sync.campanasServidas} filas en Campañas Servidas, ${sync.facturacion} en Facturación.`,
        },
      }));
    } else {
      setSyncEstado((s) => ({ ...s, [pais]: { ok: false, mensaje: sync.error || sync.motivo || "No se pudo sincronizar." } }));
    }
  }

  async function guardar(pais) {
    setGuardando(pais);
    setError("");
    try {
      const sheetId = valorDe(pais);
      const res = await apiFetch(`/api/admin/gestion-sheets/${pais}`, {
        method: "PUT",
        body: JSON.stringify({ sheetId }),
      });
      setSheets((s) => ({ ...s, [pais]: sheetId }));
      setBorradores((b) => {
        const copia = { ...b };
        delete copia[pais];
        return copia;
      });
      aplicarResultadoSync(pais, res.sync);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(null);
    }
  }

  async function sincronizar(pais) {
    setSincronizando(pais);
    try {
      const sync = await apiFetch(`/api/admin/gestion-sheets/${pais}/sync`, { method: "POST" });
      aplicarResultadoSync(pais, sync);
    } catch (err) {
      setSyncEstado((s) => ({ ...s, [pais]: { ok: false, mensaje: err.message } }));
    } finally {
      setSincronizando(null);
    }
  }

  return (
    <div>
      <GradientHeader title="Administración: Sheets de Gestión" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="p-6 max-w-2xl">
        <p className="text-sm text-slate-label mb-4">
          Un Sheet ID por país, con las pestañas <strong>Campañas Servidas</strong> y <strong>Facturación</strong>{" "}
          adentro -- data administrativa, no ligada a clientes ni anunciantes. Un país sin Sheet ID cargado
          simplemente no muestra datos todavía en esas 2 secciones.
        </p>

        {loading ? (
          <Spinner label="Cargando..." />
        ) : (
          <div className="flex flex-col gap-4">
            {paises.map((p) => {
              const sucio = borradores[p.codigo] !== undefined && borradores[p.codigo] !== (sheets[p.codigo] ?? "");
              const estado = syncEstado[p.codigo];
              return (
                <div key={p.codigo} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-sm font-medium text-gray-700">{p.nombre}</span>
                    <input
                      value={valorDe(p.codigo)}
                      onChange={(e) => onCambiar(p.codigo, e.target.value)}
                      placeholder="ID del Google Sheet"
                      className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                    />
                    <button
                      type="button"
                      disabled={!sucio || guardando === p.codigo}
                      onClick={() => guardar(p.codigo)}
                      className="shrink-0 bg-brand-magenta text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-brand-magenta/90 disabled:opacity-40"
                    >
                      {guardando === p.codigo ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      disabled={!sheets[p.codigo] || sincronizando === p.codigo}
                      onClick={() => sincronizar(p.codigo)}
                      className="shrink-0 bg-white text-brand-purple text-sm font-medium px-4 py-2 rounded-full border border-brand-purple hover:bg-brand-purple/5 disabled:opacity-40"
                    >
                      {sincronizando === p.codigo ? "Sincronizando..." : "Sincronizar ahora"}
                    </button>
                  </div>
                  {estado && (
                    <p className={`pl-[8.75rem] text-xs ${estado.ok ? "text-green-700" : "text-red-600"}`}>{estado.mensaje}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
