import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const AuthContext = createContext(null);

// Cada cuánto se revisa con el servidor si la sesión sigue viva -- el límite
// real de inactividad/duración lo decide el backend (server/middleware.js),
// esto solo detecta a tiempo cuando ya expiró para mostrar la pantalla de
// código en vez de esperar a que falle una acción cualquiera del usuario.
const INTERVALO_CHEQUEO_MS = 1000 * 60 * 5;

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [correoSesionExpirada, setCorreoSesionExpirada] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = await parseJsonSafe(res);
    if (res.ok) {
      setUser(data?.user ?? null);
      return;
    }
    if (data?.code === "SESSION_EXPIRED" && userRef.current) {
      setCorreoSesionExpirada(userRef.current.email);
    }
    setUser(null);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(refresh, INTERVALO_CHEQUEO_MS);
    return () => clearInterval(id);
  }, [user, refresh]);

  // Detecta SESSION_EXPIRED en cualquier llamada a la API (no solo el chequeo
  // periódico de /me), para que la pantalla de código aparezca al instante en
  // vez de esperar hasta el próximo sondeo.
  useEffect(() => {
    const fetchOriginal = window.fetch;
    window.fetch = async (...args) => {
      const res = await fetchOriginal(...args);
      if (res.status === 401 && userRef.current) {
        res
          .clone()
          .json()
          .then((data) => {
            if (data?.code === "SESSION_EXPIRED") {
              setCorreoSesionExpirada(userRef.current.email);
              setUser(null);
            }
          })
          .catch(() => {});
      }
      return res;
    };
    return () => {
      window.fetch = fetchOriginal;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new Error(data?.error || "No se pudo iniciar sesión");
    }
    setCorreoSesionExpirada(null);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setCorreoSesionExpirada(null);
    setUser(null);
  }, []);

  const solicitarCodigo = useCallback(async (email) => {
    const res = await fetch("/api/auth/otp/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data?.error || "No se pudo enviar el código");
  }, []);

  const verificarCodigo = useCallback(async (email, codigo) => {
    const res = await fetch("/api/auth/otp/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, codigo }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data?.error || "Código inválido o vencido");
    setCorreoSesionExpirada(null);
    setUser(data.user);
  }, []);

  const cambiarPassword = useCallback(async (passwordActual, passwordNueva) => {
    const res = await fetch("/api/auth/cambiar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ passwordActual, passwordNueva }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data?.error || "No se pudo cambiar la contraseña");
    setUser((u) => (u ? { ...u, debeCambiarPassword: false } : u));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        correoSesionExpirada,
        login,
        logout,
        refresh,
        solicitarCodigo,
        verificarCodigo,
        cambiarPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
