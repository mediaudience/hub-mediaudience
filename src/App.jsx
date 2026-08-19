import { Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell";
import RequireAuth from "./components/layout/RequireAuth";
import RequireAdmin from "./components/layout/RequireAdmin";
import RequireSuperAdmin from "./components/layout/RequireSuperAdmin";
import Login from "./pages/Login";
import AdminUsuarios from "./pages/admin/Usuarios";
import AdminClientes from "./pages/admin/Clientes";
import AdminServicios from "./pages/admin/Servicios";
import CanalResumenGeneral from "./pages/CanalResumenGeneral";
import CanalRendimientoDiario from "./pages/CanalRendimientoDiario";
import EmptyState from "./components/common/EmptyState";
import { useAuth } from "./context/AuthContext";

const STAFF_ROLES = ["super_admin", "admin"];

// A dónde mandar / e ír-no-encontrado: el primer canal contratado del
// usuario. El catálogo de canales es dinámico (Admin > Servicios puede sumar
// más), así que ya no hay un canal "por defecto" fijo como antes (ctv-ott).
function RedirigirPorDefecto() {
  const { user } = useAuth();
  const primerCanal = user?.canalesContratados?.[0];
  if (primerCanal) return <Navigate to={`/${primerCanal}/resumen-general`} replace />;
  if (STAFF_ROLES.includes(user?.rol)) return <Navigate to="/admin/usuarios" replace />;
  return <EmptyState message="Todavía no tienes ningún servicio asignado. Contacta a tu administrador." />;
}

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<RedirigirPorDefecto />} />

          <Route path=":canal/resumen-general" element={<CanalResumenGeneral />} />
          <Route path=":canal/rendimiento-diario" element={<CanalRendimientoDiario />} />

          <Route element={<RequireAdmin />}>
            <Route path="admin/usuarios" element={<AdminUsuarios />} />
            <Route path="admin/clientes" element={<AdminClientes />} />

            <Route element={<RequireSuperAdmin />}>
              <Route path="admin/servicios" element={<AdminServicios />} />
            </Route>
          </Route>

          <Route path="*" element={<RedirigirPorDefecto />} />
        </Route>
      </Route>
    </Routes>
  );
}
