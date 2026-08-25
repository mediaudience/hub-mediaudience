import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Se monta dentro de <RequireAuth /> (ya garantiza `user` no nulo) para
// bloquear rutas a usuario_externo (cuentas de cliente) -- deja pasar a
// super_admin/admin/usuario_interno. Usado por Gestión > Prospección, que a
// diferencia del resto de Gestión sí es visible para usuario_interno.
export default function RequireInterno() {
  const { user } = useAuth();

  if (user?.rol === "usuario_externo") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
