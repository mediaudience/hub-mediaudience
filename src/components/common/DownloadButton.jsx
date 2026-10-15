// Extraído de GradientHeader.jsx para poder anclarlo también junto a Tabs
// (ChannelRendimientoGeneral.jsx) -- misma pieza, dos ubicaciones posibles.
//
// `variant`: "outline" (default) es blanco con borde morado -- pensado para
// el banner degradado de GradientHeader, donde un fondo sólido se perdería
// contra el morado/magenta de fondo. "solid" usa el mismo degradado
// morado-a-magenta del banner de GradientHeader, con letra blanca -- para
// cuando el botón vive sobre fondo blanco (junto a Tabs en
// ChannelRendimientoGeneral.jsx), donde el outline quedaba muy apagado.
export default function DownloadButton({ onDownload, variant = "outline" }) {
  const esSolido = variant === "solid";
  return (
    <button
      type="button"
      onClick={onDownload}
      disabled={!onDownload}
      aria-disabled={!onDownload}
      title={onDownload ? "Descargar lo que estás viendo" : "No hay datos para descargar en esta vista"}
      className={`flex items-center gap-2 text-sm font-medium h-10 px-4 rounded-md border whitespace-nowrap font-mono text-[13px] ${
        onDownload
          ? esSolido
            ? "bg-brand-purple text-on-accent border-transparent hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            : "bg-transparent text-brand-purple border-brand-purple/50 hover:bg-brand-purple/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          : esSolido
          ? "bg-brand-purple text-on-accent/70 border-transparent opacity-40 cursor-not-allowed"
          : "bg-transparent text-brand-purple/60 border-brand-purple/30 cursor-not-allowed"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
          stroke={esSolido ? "#040B17" : "#58B0FF"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={onDownload ? "1" : "0.6"}
        />
      </svg>
      Descargar
    </button>
  );
}
