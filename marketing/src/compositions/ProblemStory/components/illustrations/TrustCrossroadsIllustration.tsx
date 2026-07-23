import { Easing, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../../../../brand";

const STROKE = 2.5;

/** Two paths cross — empty contact list, trust in question. */
export const TrustCrossroadsIllustration: React.FC = () => {
  const frame = useCurrentFrame();

  const figureOpacity = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const phoneOpacity = interpolate(frame, [24, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const questionPulse = interpolate(
    frame % 60,
    [0, 30, 60],
    [0.6, 1, 0.6],
    { easing: Easing.bezier(0.45, 0, 0.55, 1) },
  );

  const pathDraw = interpolate(frame, [10, 50], [0, 1], {
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
      {/* Crossroads paths */}
      <line
        x1="80"
        y1="380"
        x2="420"
        y2="380"
        stroke={forge.muted}
        strokeWidth={STROKE}
        opacity={0.25 * pathDraw}
        strokeDasharray="8 8"
      />
      <line
        x1="250"
        y1="420"
        x2="250"
        y2="120"
        stroke={forge.muted}
        strokeWidth={STROKE}
        opacity={0.25 * pathDraw}
        strokeDasharray="8 8"
      />

      {/* Figure left — walking right */}
      <g opacity={figureOpacity} transform="translate(100, 200)">
        <circle cx="30" cy="20" r="16" fill="none" stroke={forge.white} strokeWidth={STROKE} />
        <path
          d="M 30 36 L 30 90 M 30 55 L 10 75 M 30 55 L 50 75 M 30 90 L 15 130 M 30 90 L 45 130"
          fill="none"
          stroke={forge.white}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Figure right — walking left */}
      <g opacity={figureOpacity} transform="translate(320, 200) scale(-1, 1)">
        <circle cx="30" cy="20" r="16" fill="none" stroke={forge.white} strokeWidth={STROKE} />
        <path
          d="M 30 36 L 30 90 M 30 55 L 10 75 M 30 55 L 50 75 M 30 90 L 15 130 M 30 90 L 45 130"
          fill="none"
          stroke={forge.white}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Phone / empty contact list */}
      <g opacity={phoneOpacity} transform="translate(175, 80)">
        <rect
          x="0"
          y="0"
          width="150"
          height="240"
          rx="16"
          fill="none"
          stroke={forge.white}
          strokeWidth={STROKE}
        />
        <rect
          x="55"
          y="12"
          width="40"
          height="6"
          rx="3"
          fill={forge.muted}
          opacity={0.4}
        />

        {/* Empty rows */}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(20, ${52 + i * 48})`}>
            <circle cx="12" cy="12" r="10" fill="none" stroke={forge.muted} strokeWidth={1.5} opacity={0.35} />
            <line x1="32" y1="8" x2="110" y2="8" stroke={forge.muted} strokeWidth={2} opacity={0.2} />
            <line x1="32" y1="18" x2="80" y2="18" stroke={forge.muted} strokeWidth={1.5} opacity={0.15} />
          </g>
        ))}

        {/* Question mark */}
        <text
          x="75"
          y="200"
          textAnchor="middle"
          fill={forge.orange}
          fontSize="48"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          opacity={questionPulse}
        >
          ?
        </text>
      </g>
    </svg>
  );
};
