export default function EmptyState({ message = "Selecciona un periodo para ver la información", action }) {
  return (
    <div className="relative flex flex-col items-center justify-center py-16 min-h-[280px]">
      <svg
        className="absolute top-2 right-4 opacity-90"
        width="72"
        height="72"
        viewBox="0 0 100 100"
        fill="none"
      >
        <path d="M78 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#C4216F" />
        <ellipse cx="45" cy="62" rx="18" ry="7" fill="#57007E" opacity="0.15" />
        <circle cx="45" cy="45" r="16" fill="#EEF5F9" stroke="#57007E" strokeWidth="2" />
        <circle cx="40" cy="41" r="2.2" fill="#57007E" />
        <path d="M33 50c4 3 15 3 19 0" stroke="#57007E" strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="37" y="58" width="16" height="14" rx="6" fill="#EEF5F9" stroke="#57007E" strokeWidth="2" />
        <rect x="41.5" y="70" width="7" height="6" rx="2" fill="#C4216F" />
      </svg>

      <svg width="120" height="90" viewBox="0 0 120 90" fill="none" className="text-gray-200">
        <rect x="10" y="45" width="14" height="35" rx="2" fill="currentColor" />
        <rect x="34" y="30" width="14" height="50" rx="2" fill="currentColor" />
        <rect x="58" y="55" width="14" height="25" rx="2" fill="currentColor" />
        <rect x="82" y="15" width="14" height="65" rx="2" fill="currentColor" />
        <line x1="4" y1="80" x2="112" y2="80" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className="mt-4 text-sm text-slate-label text-center max-w-xs">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
