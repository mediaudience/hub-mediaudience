import { Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell";
import RequireAuth from "./components/layout/RequireAuth";
import RequireAdmin from "./components/layout/RequireAdmin";
import RequireSuperAdmin from "./components/layout/RequireSuperAdmin";
import RequireInterno from "./components/layout/RequireInterno";
import Login from "./pages/Login";
import OlvidePassword from "./pages/OlvidePassword";
import RestablecerPassword from "./pages/RestablecerPassword";
import AdminUsuarios from "./pages/admin/Usuarios";
import AdminClientes from "./pages/admin/Clientes";
import AdminServicios from "./pages/admin/Servicios";
import AdminPaises from "./pages/admin/Paises";
import AdminActividad from "./pages/admin/Actividad";
import AdminEtapasProspeccion from "./pages/admin/EtapasProspeccion";
import EnDesarrollo from "./pages/gestion/EnDesarrollo";
import Prospeccion from "./pages/gestion/Prospeccion";
import CanalRendimientoGeneral from "./pages/CanalRendimientoGeneral";
import Home from "./pages/Home";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="olvide-password" element={<OlvidePassword />} />
      <Route path="restablecer-password" element={<RestablecerPassword />} />

      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />

          <Route path=":canal/rendimiento-general" element={<CanalRendimientoGeneral />} />

          <Route element={<RequireInterno />}>
            <Route path="gestion/prospeccion" element={<Prospeccion />} />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="admin/usuarios" element={<AdminUsuarios />} />
            <Route path="admin/clientes" element={<AdminClientes />} />

            <Route path="gestion/metas-comerciales" element={<EnDesarrollo titulo="Metas Comerciales" />} />
            <Route path="gestion/campanas-servidas" element={<EnDesarrollo titulo="Campañas Servidas" />} />
            <Route path="gestion/facturacion" element={<EnDesarrollo titulo="Facturación" />} />

            <Route element={<RequireSuperAdmin />}>
              <Route path="admin/servicios" element={<AdminServicios />} />
              <Route path="admin/paises" element={<AdminPaises />} />
              <Route path="admin/etapas-prospeccion" element={<AdminEtapasProspeccion />} />
              <Route path="admin/actividad" element={<AdminActividad />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
