const PURPLE = "#57007E";
const PURPLE_MID = "#7A1AA6";
const MAGENTA = "#C4216F";
const BG = "#EEF5F9";

function ChannelBadge({ x, y, color, children }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r="21" fill={color} />
      {children}
    </g>
  );
}

// Ilustración a medida para el login: un mini-dashboard (barras + tendencia +
// donut, el mismo lenguaje visual que ComboBarChart/DonutWithTable) conectado
// por líneas punteadas a los 5 canales del panel y a los dos extremos del
// tagline "Conectamos marcas, Conectamos audiencias".
export default function LoginIllustration() {
  return (
    <svg
      viewBox="0 0 440 440"
      fill="none"
      className="w-full h-auto"
      role="img"
      aria-label="Ilustración: panel de métricas conectando marcas y audiencias a través de sus canales"
    >
      {/* fondo */}
      <circle cx="220" cy="230" r="205" fill={PURPLE} opacity="0.06" />
      <circle cx="280" cy="170" r="150" fill={MAGENTA} opacity="0.06" />

      {/* líneas punteadas de conexión */}
      <g stroke={PURPLE} strokeOpacity="0.3" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round">
        <path d="M78 130 Q 112 150 150 166" fill="none" />
        <path d="M362 108 Q 330 148 292 166" fill="none" />
        <path d="M362 372 Q 330 336 292 322" fill="none" />
        <path d="M78 376 Q 112 338 150 322" fill="none" />
        <path d="M76 240 L112 240" fill="none" />
        <path d="M372 236 L328 240" fill="none" />
      </g>

      {/* endpoint: "marca" -- ícono de etiqueta */}
      <g>
        <circle cx="56" cy="240" r="22" fill="white" stroke={PURPLE} strokeWidth="2" />
        <path
          d="M48 231h7l9 9-9 9h-7z"
          fill="none"
          stroke={PURPLE}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="52" cy="235" r="1.6" fill={PURPLE} />
      </g>

      {/* endpoint: "audiencia" -- grupo de círculos */}
      <g>
        <circle cx="384" cy="228" r="11" fill={MAGENTA} opacity="0.85" />
        <circle cx="399" cy="238" r="11" fill={PURPLE} opacity="0.85" />
        <circle cx="384" cy="248" r="11" fill={PURPLE_MID} opacity="0.85" />
      </g>

      {/* tarjeta del dashboard, con "sombra" */}
      <rect x="118" y="152" width="216" height="190" rx="20" fill={PURPLE} opacity="0.08" />
      <rect x="112" y="146" width="216" height="190" rx="20" fill="white" stroke="#E7E1EC" strokeWidth="1.5" />

      {/* barra superior tipo browser chrome */}
      <rect x="112" y="146" width="216" height="34" rx="20" fill={PURPLE} />
      <rect x="112" y="163" width="216" height="17" fill={PURPLE} />
      <circle cx="130" cy="163" r="3.5" fill={MAGENTA} />
      <circle cx="142" cy="163" r="3.5" fill="white" opacity="0.6" />
      <circle cx="154" cy="163" r="3.5" fill="white" opacity="0.35" />

      {/* mini donut */}
      <circle cx="280" cy="206" r="20" fill="none" stroke={BG} strokeWidth="9" />
      <circle
        cx="280"
        cy="206"
        r="20"
        fill="none"
        stroke={PURPLE}
        strokeWidth="9"
        strokeDasharray="70 126"
        strokeLinecap="round"
        transform="rotate(-90 280 206)"
      />
      <circle
        cx="280"
        cy="206"
        r="20"
        fill="none"
        stroke={MAGENTA}
        strokeWidth="9"
        strokeDasharray="35 126"
        strokeDashoffset="-70"
        strokeLinecap="round"
        transform="rotate(-90 280 206)"
      />

      {/* barras + línea de tendencia */}
      <g>
        <rect x="140" y="270" width="14" height="30" rx="3" fill={PURPLE} />
        <rect x="162" y="254" width="14" height="46" rx="3" fill={MAGENTA} />
        <rect x="184" y="236" width="14" height="64" rx="3" fill={PURPLE} />
        <rect x="206" y="220" width="14" height="80" rx="3" fill={MAGENTA} />
      </g>
      <path
        d="M147 270 L169 254 L191 236 L213 220"
        stroke={MAGENTA}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {[
        [147, 270],
        [169, 254],
        [191, 236],
        [213, 220],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="3" fill={MAGENTA} />
      ))}

      {/* barra de KPI */}
      <rect x="130" y="306" width="180" height="14" rx="7" fill="#F3EEF7" />
      <rect x="130" y="306" width="126" height="14" rx="7" fill={PURPLE} opacity="0.85" />

      {/* badges de canales */}
      <ChannelBadge x={78} y={110} color={MAGENTA}>
        <path
          d="M0 -9c-5 0-8 4-8 9v3l-3 4h22l-3-4v-3c0-5-3-9-8-9z"
          fill="white"
        />
        <path d="M-3 8a3 3 0 0 0 6 0" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </ChannelBadge>

      <ChannelBadge x={362} y={108} color={PURPLE}>
        <path d="M-5 -8 L9 0 L-5 8 Z" fill="white" />
      </ChannelBadge>

      <ChannelBadge x={362} y={372} color={PURPLE_MID}>
        <path
          d="M-4 8V-6l10-2v8"
          stroke="white"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="-4" cy="8" r="3.2" fill="white" />
        <circle cx="6" cy="6" r="3.2" fill="white" />
      </ChannelBadge>

      <ChannelBadge x={78} y={376} color={PURPLE}>
        <circle cx="-6" cy="-4" r="2.6" fill="white" />
        <circle cx="6" cy="-6" r="2.6" fill="white" />
        <circle cx="0" cy="6" r="2.6" fill="white" />
        <path d="M-6 -4 L0 6 L6 -6" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </ChannelBadge>
    </svg>
  );
}
