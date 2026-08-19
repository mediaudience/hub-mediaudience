import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Se monta dentro de <RequireAuth /> -- bloquea rutas exclusivas de Super
// Admin (hoy solo Admin > Servicios: crear canales nuevos).
export default function RequireSuperAdmin() {
  const { user } = useAuth();

  if (user?.rol !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
