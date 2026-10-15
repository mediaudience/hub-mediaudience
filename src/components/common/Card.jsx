export default function Card({ children, className = "", accent = false, hover = true }) {
  return (
    <div
      className={`bg-surface border border-line rounded-md ${
        hover ? "transition-colors duration-200 hover:border-brand-purple/35" : ""
      } ${accent ? "border-t-2 border-t-brand-purple" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
