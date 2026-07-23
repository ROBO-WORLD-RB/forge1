import { Easing, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../../../../brand";

const STROKE = 2.5;

/** Skilled hands, open toolbox — idle pulse on empty work space. */
export const WaitingHandsIllustration: React.FC = () => {
  const frame = useCurrentFrame();

  const toolboxOpacity = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const handOpacity = interpolate(frame, [20, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const emptyPulse = interpolate(
    frame % 70,
    [0, 35, 70],
    [0.15, 0.35, 0.15],
    { easing: Easing.bezier(0.45, 0, 0.55, 1) },
  );

  const phoneOpacity = interpolate(frame, [35, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg
      viewBox="0 0 500 520"
      width="100%"
      height="100%"
      style={{ maxWidth: 520, maxHeight: 520 }}
      aria-hidden
    >
      {/* Empty space pulse — nowhere to go */}
      <rect
        x="120"
        y="100"
        width="260"
        height="160"
        rx="8"
        fill={forge.orange}
        opacity={emptyPulse}
        stroke={forge.muted}
        strokeWidth={1}
        strokeDasharray="6 6"
      />
      <text
        x="250"
        y="188"
        textAnchor="middle"
        fill={forge.muted}
        fontSize="16"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.12em"
        opacity={emptyPulse * 2}
      >
        NO JOBS
      </text>

      {/* Toolbox */}
      <g opacity={toolboxOpacity} transform="translate(140, 280)">
        <rect
          x="0"
          y="40"
          width="220"
          height="120"
          rx="8"
          fill="none"
          stroke={forge.white}
          strokeWidth={STROKE}
        />
        <path
          d="M 0 40 L 20 10 L 200 10 L 220 40"
          fill="none"
          stroke={forge.white}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
        <rect
          x="90"
          y="0"
          width="40"
          height="14"
          rx="4"
          fill="none"
          stroke={forge.white}
          strokeWidth={STROKE}
        />

        {/* Tools inside */}
        <line x1="40" y1="90" x2="100" y2="90" stroke={forge.orange} strokeWidth={STROKE} strokeLinecap="round" />
        <path
          d="M 130 70 L 130 110 M 120 80 L 140 80"
          fill="none"
          stroke={forge.muted}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <circle cx="175" cy="95" r="14" fill="none" stroke={forge.white} strokeWidth={STROKE} />
      </g>

      {/* Hand outline — resting, idle */}
      <g opacity={handOpacity} transform="translate(60, 320)">
        <path
          d="M 40 80 Q 20 60 30 40 Q 35 25 50 30 Q 55 15 65 25 Q 75 10 85 28 Q 95 18 100 35 Q 115 30 110 50 Q 120 55 115 70 Q 125 85 105 95 L 70 110 Q 45 105 40 80 Z"
          fill="none"
          stroke={forge.white}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
      </g>

      {/* Empty phone feed */}
      <g opacity={phoneOpacity} transform="translate(320, 300)">
        <rect
          x="0"
          y="0"
          width="100"
          height="160"
          rx="12"
          fill="none"
          stroke={forge.muted}
          strokeWidth={STROKE}
          opacity={0.6}
        />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x="14"
            y={24 + i * 44}
            width="72"
            height="28"
            rx="4"
            fill="none"
            stroke={forge.muted}
            strokeWidth={1.5}
            opacity={0.25}
            strokeDasharray="4 4"
          />
        ))}
      </g>
    </svg>
  );
};
