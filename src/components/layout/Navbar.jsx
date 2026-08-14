export default function Navbar({ onToggleSidebar }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-brand-purple flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Colapsar menú"
          className="text-white/90 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="19" stroke="white" strokeWidth="2" opacity="0.35" />
            <circle cx="20" cy="20" r="12" stroke="white" strokeWidth="2" opacity="0.6" />
            <circle cx="20" cy="20" r="5" fill="white" />
          </svg>
          <span className="text-white font-semibold text-lg tracking-tight lowercase">
            mediaudience
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-label="Perfil"
        className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" fill="#57007E" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" fill="#57007E" />
        </svg>
      </button>
    </header>
  );
}
