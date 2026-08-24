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
  const [canales, setCanales] = useState([]);
  const [loading, setLoading] = useState(true);
  // Email pendiente de código OTP tras un /login con contraseña correcta pero
  // requiere_otp=1 (sesión anterior cerrada por inactividad, ver
  // server/middleware.js) -- null cuando no hay ningún reingreso a mitad de camino.
  const [otpPendiente, setOtpPendiente] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;

  // Catálogo de servicios activos (slug + nombre) -- alimenta Sidebar/rutas y
  // los checkboxes de Admin > Clientes, que ya no traen una lista hardcodeada.
  const refrescarCanales = useCallback(async () => {
    const res = await fetch("/api/canal", { credentials: "include" });
    const data = await parseJsonSafe(res);
    setCanales(res.ok ? data?.canales ?? [] : []);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.ok) {
      const data = await parseJsonSafe(res);
      setUser(data?.user ?? null);
      await refrescarCanales();
      return;
    }
    setUser(null);
    setCanales([]);
  }, [refrescarCanales]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(refresh, INTERVALO_CHEQUEO_MS);
    return () => clearInterval(id);
  }, [user, refresh]);

  // Detecta una sesión cortada por inactividad en cualquier llamada a la API
  // (no solo el chequeo periódico de /me), para reflejar el logout al
  // instante en vez de esperar hasta el próximo sondeo.
  useEffect(() => {
    const fetchOriginal = window.fetch;
    window.fetch = async (...args) => {
      const res = await fetchOriginal(...args);
      if (res.status === 401 && userRef.current) {
        setUser(null);
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
    if (data?.requiereOtp) {
      setOtpPendiente(data.email);
      return { requiereOtp: true };
    }
    setOtpPendiente(null);
    setUser(data.user);
    await refrescarCanales();
    return { requiereOtp: false };
  }, [refrescarCanales]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setOtpPendiente(null);
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
    setOtpPendiente(null);
    setUser(data.user);
    await refrescarCanales();
  }, [refrescarCanales]);

  const solicitarRecuperacion = useCallback(async (email) => {
    const res = await fetch("/api/auth/olvide-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data?.error || "No se pudo procesar la solicitud");
  }, []);

  const restablecerPassword = useCallback(async (token, passwordNueva) => {
    const res = await fetch("/api/auth/restablecer-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, passwordNueva }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data?.error || "No se pudo restablecer la contraseña");
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
        canales,
        refrescarCanales,
        loading,
        otpPendiente,
        login,
        logout,
        refresh,
        solicitarCodigo,
        verificarCodigo,
        cambiarPassword,
        solicitarRecuperacion,
        restablecerPassword,
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
