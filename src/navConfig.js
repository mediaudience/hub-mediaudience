// Los grupos de navegación por canal (CTV-OTT, Programático, etc.) ya no
// viven acá -- se arman en Sidebar.jsx a partir de `useAuth().canales`
// (catálogo dinámico servido por /api/canal, ver server/dataRoutes.js), así
// un servicio nuevo creado por un Super Admin aparece sin tocar código.

// Solo visible para rol admin -- Sidebar lo agrega aparte de los canales.
// "Servicios" además requiere super_admin (ver superAdminOnly en Sidebar.jsx).
export const ADMIN_NAV_GROUP = {
  id: "admin",
  label: "Administración",
  items: [
    { label: "Usuarios", path: "/admin/usuarios" },
    { label: "Clientes", path: "/admin/clientes" },
    { label: "Servicios", path: "/admin/servicios", superAdminOnly: true },
  ],
};
