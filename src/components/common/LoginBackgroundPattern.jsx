const PURPLE = "#57007E";
const MAGENTA = "#C4216F";

function MiniBars({ x, y, color, scale = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity="0.12">
      <rect x="0" y="10" width="6" height="14" rx="1.5" fill={color} />
      <rect x="9" y="4" width="6" height="20" rx="1.5" fill={color} />
      <rect x="18" y="14" width="6" height="10" rx="1.5" fill={color} />
    </g>
  );
}

const DOTS = [
  [220, 260, 4, PURPLE],
  [520, 180, 5, MAGENTA],
  [140, 400, 3, MAGENTA],
  [630, 340, 4, PURPLE],
  [300, 560, 3, PURPLE],
  [700, 230, 3, MAGENTA],
  [70, 500, 5, PURPLE],
  [470, 460, 3, MAGENTA],
  [260, 130, 4, PURPLE],
  [560, 600, 3, MAGENTA],
  [610, 460, 4, PURPLE],
  [340, 320, 3, MAGENTA],
];

// Capa decorativa de fondo para el panel derecho del login: grilla de puntos +
// anillos concéntricos en las esquinas (mismo motivo que Sidebar/GradientHeader)
// + mini-glifos de barras dispersos, todo en muy baja opacidad. Se monta detrás
// de LoginIllustration para que el panel celeste no se vea vacío alrededor.
export default function LoginBackgroundPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="loginDotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill={PURPLE} opacity="0.12" />
        </pattern>
      </defs>

      <rect width="800" height="800" fill="url(#loginDotGrid)" />

      <g stroke={PURPLE} strokeWidth="2" opacity="0.06" fill="none">
        <circle cx="30" cy="30" r="130" />
        <circle cx="30" cy="30" r="88" />
        <circle cx="30" cy="30" r="50" />
      </g>
      <g stroke={MAGENTA} strokeWidth="2" opacity="0.06" fill="none">
        <circle cx="770" cy="770" r="150" />
        <circle cx="770" cy="770" r="104" />
        <circle cx="770" cy="770" r="60" />
      </g>

      <MiniBars x={110} y={140} color={PURPLE} />
      <MiniBars x={640} y={110} color={MAGENTA} scale={0.8} />
      <MiniBars x={90} y={600} color={MAGENTA} scale={0.9} />
      <MiniBars x={690} y={560} color={PURPLE} />
      <MiniBars x={380} y={70} color={PURPLE} scale={0.7} />
      <MiniBars x={420} y={690} color={MAGENTA} scale={0.85} />

      {DOTS.map(([cx, cy, r, color], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity="0.14" />
      ))}
    </svg>
  );
}
