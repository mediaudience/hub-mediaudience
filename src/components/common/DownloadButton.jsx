// Extraído de GradientHeader.jsx para poder anclarlo también junto a Tabs
// (ChannelRendimientoGeneral.jsx) -- misma pieza, dos ubicaciones posibles.
export default function DownloadButton({ onDownload }) {
  return (
    <button
      type="button"
      onClick={onDownload}
      disabled={!onDownload}
      aria-disabled={!onDownload}
      title={onDownload ? "Descargar lo que estás viendo" : "No hay datos para descargar en esta vista"}
      className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border whitespace-nowrap ${
        onDownload
          ? "bg-white text-brand-purple border-brand-purple hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          : "bg-white/50 text-brand-purple/60 border-brand-purple/30 cursor-not-allowed"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
          stroke="#57007E"
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
