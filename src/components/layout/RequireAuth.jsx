import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Spinner from "../common/Spinner";
import VerificarCodigo from "../../pages/VerificarCodigo";
import CambiarPassword from "../../pages/CambiarPassword";

export default function RequireAuth() {
  const { user, loading, correoSesionExpirada } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Verificando sesión..." />
      </div>
    );
  }

  if (correoSesionExpirada) {
    return <VerificarCodigo email={correoSesionExpirada} />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.debeCambiarPassword) {
    return <CambiarPassword />;
  }

  return <Outlet />;
}
