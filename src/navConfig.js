export const NAV_GROUPS = [
  {
    id: "ctv-ott",
    label: "CTV - OTT",
    items: [
      { label: "Resumen General", path: "/ctv-ott/resumen-general" },
      { label: "Rendimiento Diario", path: "/ctv-ott/rendimiento-diario" },
    ],
  },
  {
    id: "programatico",
    label: "Programático",
    items: [
      { label: "Resumen General", path: "/programatico/resumen-general" },
      { label: "Rendimiento Diario", path: "/programatico/rendimiento-diario" },
    ],
  },
  {
    id: "youtube",
    label: "Youtube",
    items: [
      { label: "Resumen General", path: "/youtube/resumen-general" },
      { label: "Rendimiento Diario", path: "/youtube/rendimiento-diario" },
    ],
  },
  {
    id: "push-notification",
    label: "Push Notification",
    items: [
      { label: "Resumen General", path: "/push-notification/resumen-general" },
      { label: "Rendimiento Diario", path: "/push-notification/rendimiento-diario" },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    items: [
      { label: "Resumen General", path: "/tiktok/resumen-general" },
      { label: "Rendimiento Diario", path: "/tiktok/rendimiento-diario" },
    ],
  },
];

// Solo visible para rol admin -- Sidebar lo agrega aparte de NAV_GROUPS.
export const ADMIN_NAV_GROUP = {
  id: "admin",
  label: "Administración",
  items: [
    { label: "Usuarios", path: "/admin/usuarios" },
    { label: "Clientes", path: "/admin/clientes" },
  ],
};
