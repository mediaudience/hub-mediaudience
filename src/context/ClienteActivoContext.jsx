import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const ClienteActivoContext = createContext(null);

const STORAGE_PREFIX = "mediaudience.clienteActivo.";

// Selector de "Cliente activo" que vive en el menú de la cuenta (Navbar), no
// dentro de cada canal -- así el usuario elige una sola vez a qué cliente
// quiere ver y esa elección aplica en todos los servicios que navegue. Un
// valor `null` significa "todos los clientes visibles" (única opción real
// para Admin/Super Admin o un usuario_interno sin cliente elegido todavía).
export function ClienteActivoProvider({ children }) {
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [clienteActivo, setClienteActivoState] = useState(null);

  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;

  useEffect(() => {
    if (!user) {
      setClientes([]);
      setClienteActivoState(null);
      return;
    }
    let cancelado = false;
    fetch("/api/canal/clientes-visibles", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { clientes: [] }))
      .then((data) => {
        if (cancelado) return;
        const lista = data?.clientes ?? [];
        setClientes(lista);
        const guardado = storageKey ? localStorage.getItem(storageKey) : null;
        setClienteActivoState(guardado && lista.some((c) => c.nombre === guardado) ? guardado : null);
      })
      .catch(() => {
        if (!cancelado) setClientes([]);
      });
    return () => {
      cancelado = true;
    };
  }, [user, storageKey]);

  const setClienteActivo = useCallback(
    (nombre) => {
      setClienteActivoState(nombre);
      if (!storageKey) return;
      if (nombre) localStorage.setItem(storageKey, nombre);
      else localStorage.removeItem(storageKey);
    },
    [storageKey]
  );

  // Canales contratados por el cliente activo -- null cuando la elección es
  // "Todos los clientes" (el Sidebar sigue usando canalesContratados del
  // usuario en ese caso, sin cambios respecto a como funcionaba antes).
  const canalesDelClienteActivo = clienteActivo
    ? clientes.find((c) => c.nombre === clienteActivo)?.canales ?? []
    : null;

  return (
    <ClienteActivoContext.Provider value={{ clientes, clienteActivo, setClienteActivo, canalesDelClienteActivo }}>
      {children}
    </ClienteActivoContext.Provider>
  );
}

export function useClienteActivo() {
  const ctx = useContext(ClienteActivoContext);
  if (!ctx) throw new Error("useClienteActivo debe usarse dentro de ClienteActivoProvider");
  return ctx;
}
