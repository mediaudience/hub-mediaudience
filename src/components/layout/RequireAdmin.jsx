import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Se monta dentro de <RequireAuth /> (ya garantiza `user` no nulo) para
// bloquear las rutas /admin/* a quien no sea Admin o Super Admin.
export default function RequireAdmin() {
  const { user } = useAuth();

  if (user?.rol !== "super_admin" && user?.rol !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
