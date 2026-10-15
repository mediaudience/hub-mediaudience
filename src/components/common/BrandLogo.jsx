// Logo del layout "Signal": isotipo de radar + "mediaudience" con la "a" en
// el acento, igual que la web pública mediaudience.com. Es SVG/texto (no PNG)
// para que se vea nítido sobre fondo oscuro en cualquier tamaño. El punto
// central late y emite una onda de radar (clases brand-ping/brand-dot en
// index.css), que se apagan con prefers-reduced-motion.
export default function BrandLogo({ size = 20, showHub = false, className = "" }) {
  const icon = Math.round(size * 1.25);
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width={icon} height={icon} viewBox="0 0 28 28" aria-hidden="true" className="overflow-visible">
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="#58B0FF" strokeOpacity="0.45" strokeWidth="1.5" />
        <circle cx="14" cy="14" r="8" fill="none" stroke="#58B0FF" strokeOpacity="0.75" strokeWidth="1.5" />
        <circle className="brand-ping" cx="14" cy="14" r="3.5" fill="none" stroke="#58B0FF" strokeWidth="1.2" />
        <circle className="brand-dot" cx="14" cy="14" r="3.5" fill="#58B0FF" />
      </svg>
      <span
        className="font-display font-semibold text-gray-900 tracking-tight"
        style={{ fontSize: size }}
        aria-label="Mediaudience"
      >
        medi<span className="text-brand-purple">a</span>udience
      </span>
      {showHub && (
        <span className="label-mono text-[10px] text-gray-500 border border-line rounded-md px-1.5 py-0.5">Hub</span>
      )}
    </span>
  );
}
