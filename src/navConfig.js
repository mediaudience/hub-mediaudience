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
    { label: "Clientes", path: "/admin/clientes" },
    { label: "Usuarios", path: "/admin/usuarios" },
    { label: "Servicios", path: "/admin/servicios", superAdminOnly: true },
    { label: "Países", path: "/admin/paises", superAdminOnly: true },
    { label: "Etapas de Prospección", path: "/admin/etapas-prospeccion", superAdminOnly: true },
    { label: "Actividad", path: "/admin/actividad", superAdminOnly: true },
    { label: "Sheets de Gestión", path: "/admin/gestion-sheets" },
  ],
};

// Visible para Admin/Super Admin (los 4 items) y además para usuario_interno
// pero SOLO en los items marcados `internoVisible` -- Prospección es la
// herramienta de trabajo diaria del equipo comercial, las otras 3 secciones
// siguen siendo gestión interna del negocio que un usuario_interno no
// necesita ver. Las 3 sin desarrollar todavía usan
// src/pages/gestion/EnDesarrollo.jsx, solo reservan su lugar en el Sidebar.
export const GESTION_NAV_GROUP = {
  id: "gestion",
  label: "Gestión",
  items: [
    { label: "Metas Comerciales", path: "/gestion/metas-comerciales" },
    { label: "Prospección", path: "/gestion/prospeccion", internoVisible: true },
    { label: "Campañas Servidas", path: "/gestion/campanas-servidas" },
    { label: "Facturación", path: "/gestion/facturacion" },
  ],
};
