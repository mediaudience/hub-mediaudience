import { Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell";
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

        <Route path="*" element={<Navigate to="/ctv-ott/resumen-general" replace />} />
      </Route>
    </Routes>
  );
}
