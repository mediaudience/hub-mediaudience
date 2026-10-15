import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useNavGroups from "../hooks/useNavGroups";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";

// Descripción corta por grupo para la guía de "qué vas a encontrar" -- se
// muestra solo para los grupos que useNavGroups ya filtró según el rol
// (Gestión/Administración), Campañas tiene su propia sección de accesos
// rápidos más arriba y no se repite acá.
const ROL_LABEL = {
  super_admin: "Super Admin",
  admin: "Admin",
  usuario_interno: "Equipo",
  usuario_externo: "Cliente",
};

const GROUP_DESCRIPTIONS = {
  gestion: "Herramientas comerciales del equipo.",
  admin: "Gestión de clientes, usuarios y configuración general del panel.",
};

export default function Home() {
  const { user } = useAuth();
  const { campanasGroup, groups } = useNavGroups();
  const otrosGrupos = groups.filter((g) => g.id !== "campanas");
  const primerNombre = user?.nombre?.split(" ")[0];
  const sinNadaQueMostrar = campanasGroup.items.length === 0 && otrosGrupos.length === 0;

  return (
    <div>
      <div className="flex flex-col gap-3 mb-12 pt-2">
        <span className="label-mono text-brand-purple">{ROL_LABEL[user?.rol] ?? "Hub"} · Mediaudience Latam</span>
        <h1 className="font-display font-medium text-gray-900 text-[36px] md:text-[44px] leading-tight tracking-tight">
          {primerNombre ? `Hola, ${primerNombre}` : "Bienvenido"}
        </h1>
        <p className="text-gray-500 text-base max-w-xl leading-relaxed">
          Elige un servicio para ver su rendimiento, o usa el menú para ir a otra sección.
        </p>
      </div>

      {sinNadaQueMostrar && (
        <EmptyState message="Todavía no tienes ningún servicio asignado. Contacta a tu administrador." />
      )}

      {campanasGroup.items.length > 0 && (
        <div className="mb-8">
          <h2 className="label-mono text-gray-500 mb-4">01 · Tus servicios</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {campanasGroup.items.map((item) => (
              <Link key={item.path} to={item.path} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple rounded-md">
                <Card className="p-6 h-full flex flex-col justify-between gap-6">
                  <span className="font-display font-medium text-[22px] text-gray-900">{item.label}</span>
                  <span className="font-mono text-[12.5px] text-brand-purple">Ver rendimiento general →</span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {otrosGrupos.length > 0 && (
        <div>
          <h2 className="label-mono text-gray-500 mb-4">02 · Qué más vas a encontrar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {otrosGrupos.map((group) => (
              <Card key={group.id} className="p-5">
                <span className="label-mono text-brand-purple block mb-2">{group.label}</span>
                {GROUP_DESCRIPTIONS[group.id] && (
                  <p className="text-sm text-gray-500 mb-3">{GROUP_DESCRIPTIONS[group.id]}</p>
                )}
                <ul className="text-sm text-gray-600 space-y-1">
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <Link to={item.path} className="hover:text-brand-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple rounded">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
