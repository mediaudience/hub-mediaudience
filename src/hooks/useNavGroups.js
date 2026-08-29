import { ADMIN_NAV_GROUP, GESTION_NAV_GROUP } from "../navConfig";
import { useAuth } from "../context/AuthContext";
import { useClienteActivo } from "../context/ClienteActivoContext";
import { perfilPuedeVer } from "../../shared/perfilesInterno";

// Misma lógica de armado de grupos que usa el Sidebar -- factorizada acá
// para que Home.jsx (accesos rápidos + guía según perfil) no duplique el
// criterio de qué ve cada rol y quede desincronizada si ese criterio cambia.
export default function useNavGroups() {
  const { user, canales } = useAuth();
  const { clienteActivo, canalesDelClienteActivo } = useClienteActivo();
  const esStaff = user?.rol === "super_admin" || user?.rol === "admin";
  const esInterno = user?.rol === "usuario_interno";
  const canalesContratados = clienteActivo ? canalesDelClienteActivo : user?.canalesContratados ?? [];

  // Dentro de usuario_interno, el perfil (Manager/Ejecutivo Comercial/
  // Operaciones/Administrativo) decide si la sección "Campañas" (dashboards
  // por servicio) le corresponde -- Administrativo, por ejemplo, no la ve.
  const campanasItems =
    esInterno && !perfilPuedeVer(user.perfil, "campanas")
      ? []
      : canales
          .filter((c) => canalesContratados.includes(c.slug))
          .map((c) => ({ label: c.nombre, path: `/${c.slug}/rendimiento-general` }));
  const campanasGroup = { id: "campanas", label: "Campañas", items: campanasItems };

  const adminGroup = {
    ...ADMIN_NAV_GROUP,
    items: ADMIN_NAV_GROUP.items.filter((i) => !i.superAdminOnly || user?.rol === "super_admin"),
  };

  const gestionItems = esStaff
    ? GESTION_NAV_GROUP.items
    : esInterno
    ? GESTION_NAV_GROUP.items.filter((i) => perfilPuedeVer(user.perfil, i.seccionInterno))
    : [];
  const gestionGroup = { ...GESTION_NAV_GROUP, items: gestionItems };

  const groups = [
    ...(campanasItems.length > 0 ? [campanasGroup] : []),
    ...(gestionItems.length > 0 ? [gestionGroup] : []),
    ...(esStaff ? [adminGroup] : []),
  ];

  return { groups, campanasGroup, gestionGroup, adminGroup, esStaff, canalesContratados };
}
