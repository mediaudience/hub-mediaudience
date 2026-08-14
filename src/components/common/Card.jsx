export default function Card({ children, className = "", accent = false, hover = true }) {
  return (
    <div
      className={`bg-white border border-brand-purple/20 rounded-[14px] shadow-sm ${
        hover ? "transition-shadow duration-200 hover:shadow-md" : ""
      } ${accent ? "border-t-[3px] border-t-brand-magenta" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
