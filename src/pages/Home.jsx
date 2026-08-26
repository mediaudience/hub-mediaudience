import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useNavGroups from "../hooks/useNavGroups";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";

// Descripción corta por grupo para la guía de "qué vas a encontrar" -- se
// muestra solo para los grupos que useNavGroups ya filtró según el rol
// (Gestión/Administración), Campañas tiene su propia sección de accesos
// rápidos más arriba y no se repite acá.
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-purple to-brand-magenta px-6 py-8 sm:px-10 sm:py-10 mb-8">
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <svg className="absolute -right-8 -top-8 opacity-20" width="220" height="220" viewBox="0 0 220 220" fill="none">
            <circle cx="110" cy="110" r="90" stroke="white" strokeWidth="2" />
            <circle cx="110" cy="110" r="60" stroke="white" strokeWidth="2" />
            <circle cx="110" cy="110" r="32" stroke="white" strokeWidth="2" />
            <circle cx="110" cy="110" r="10" fill="white" />
          </svg>
        </div>
        <div className="relative flex flex-col items-start gap-3">
          <h1 className="text-white font-bold text-2xl md:text-3xl">
            {primerNombre ? `Hola, ${primerNombre}` : "Bienvenido"}
          </h1>
          <p className="text-white/80 text-sm max-w-xl">
            Este es el Hub de Mediaudience. Elige una sección del menú para empezar, o usa los accesos de acá abajo.
          </p>
        </div>
      </div>

      {sinNadaQueMostrar && (
        <EmptyState message="Todavía no tienes ningún servicio asignado. Contacta a tu administrador." />
      )}

      {campanasGroup.items.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-label mb-3">Tus servicios</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campanasGroup.items.map((item) => (
              <Link key={item.path} to={item.path} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta rounded-[14px]">
                <Card accent className="p-5 h-full flex flex-col justify-between">
                  <span className="font-bold text-brand-purple">{item.label}</span>
                  <span className="text-sm text-gray-500 mt-2">Ver rendimiento general →</span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {otrosGrupos.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-label mb-3">Qué más vas a encontrar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {otrosGrupos.map((group) => (
              <Card key={group.id} className="p-5">
                <span className="font-bold text-brand-magenta block mb-1">{group.label}</span>
                {GROUP_DESCRIPTIONS[group.id] && (
                  <p className="text-sm text-gray-500 mb-3">{GROUP_DESCRIPTIONS[group.id]}</p>
                )}
                <ul className="text-sm text-gray-600 space-y-1">
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <Link to={item.path} className="hover:text-brand-magenta hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta rounded">
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
