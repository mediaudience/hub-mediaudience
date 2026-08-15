import { Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell";
import RequireAuth from "./components/layout/RequireAuth";
import RequireAdmin from "./components/layout/RequireAdmin";
import Login from "./pages/Login";
import AdminUsuarios from "./pages/admin/Usuarios";
import AdminClientes from "./pages/admin/Clientes";
import CtvOttResumenGeneral from "./pages/ctvott/ResumenGeneral";
import CtvOttRendimientoDiario from "./pages/ctvott/RendimientoDiario";
import ProgramaticoResumenGeneral from "./pages/programatico/ResumenGeneral";
import ProgramaticoRendimientoDiario from "./pages/programatico/RendimientoDiario";
import YoutubeResumenGeneral from "./pages/youtube/ResumenGeneral";
import YoutubeRendimientoDiario from "./pages/youtube/RendimientoDiario";
import PushNotificationResumenGeneral from "./pages/pushNotification/ResumenGeneral";
import PushNotificationRendimientoDiario from "./pages/pushNotification/RendimientoDiario";
import TiktokResumenGeneral from "./pages/tiktok/ResumenGeneral";
import TiktokRendimientoDiario from "./pages/tiktok/RendimientoDiario";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/ctv-ott/resumen-general" replace />} />

          <Route path="ctv-ott/resumen-general" element={<CtvOttResumenGeneral />} />
          <Route path="ctv-ott/rendimiento-diario" element={<CtvOttRendimientoDiario />} />

          <Route path="programatico/resumen-general" element={<ProgramaticoResumenGeneral />} />
          <Route path="programatico/rendimiento-diario" element={<ProgramaticoRendimientoDiario />} />

          <Route path="youtube/resumen-general" element={<YoutubeResumenGeneral />} />
          <Route path="youtube/rendimiento-diario" element={<YoutubeRendimientoDiario />} />

          <Route path="push-notification/resumen-general" element={<PushNotificationResumenGeneral />} />
          <Route path="push-notification/rendimiento-diario" element={<PushNotificationRendimientoDiario />} />

          <Route path="tiktok/resumen-general" element={<TiktokResumenGeneral />} />
          <Route path="tiktok/rendimiento-diario" element={<TiktokRendimientoDiario />} />

          <Route element={<RequireAdmin />}>
            <Route path="admin/usuarios" element={<AdminUsuarios />} />
            <Route path="admin/clientes" element={<AdminClientes />} />
          </Route>

          <Route path="*" element={<Navigate to="/ctv-ott/resumen-general" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
