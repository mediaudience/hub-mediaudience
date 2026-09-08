// Extraído de GradientHeader.jsx para poder anclarlo también junto a Tabs
// (ChannelRendimientoGeneral.jsx) -- misma pieza, dos ubicaciones posibles.
//
// `variant`: "outline" (default) es blanco con borde morado -- pensado para
// el banner degradado de GradientHeader, donde un fondo sólido se perdería
// contra el morado/magenta de fondo. "solid" es morado sólido con letra
// blanca -- para cuando el botón vive sobre fondo blanco (junto a Tabs en
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
      className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border whitespace-nowrap ${
        onDownload
          ? esSolido
            ? "bg-brand-purple text-white border-brand-purple hover:bg-brand-purple/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            : "bg-white text-brand-purple border-brand-purple hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          : esSolido
          ? "bg-brand-purple/30 text-white/70 border-brand-purple/30 cursor-not-allowed"
          : "bg-white/50 text-brand-purple/60 border-brand-purple/30 cursor-not-allowed"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
          stroke={esSolido ? "#fff" : "#57007E"}
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
