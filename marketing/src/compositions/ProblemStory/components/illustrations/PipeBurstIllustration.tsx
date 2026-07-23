import { Easing, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../../../../brand";

const STROKE = 2.5;
const PIPE_PATH =
  "M 120 420 L 120 280 Q 120 240 160 240 L 340 240 Q 380 240 380 200 L 380 120";

/** Kitchen pipe burst — draw-on pipe, dripping water, 2:00 clock. */
export const PipeBurstIllustration: React.FC = () => {
  const frame = useCurrentFrame();

  const drawProgress = interpolate(frame, [0, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const pathLength = 520;
  const dashOffset = pathLength * (1 - drawProgress);

  const burstOpacity = interpolate(frame, [40, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const clockOpacity = interpolate(frame, [20, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const drops = [0, 14, 28] as const;

  return (
    <svg
      viewBox="0 0 500 520"
      width="100%"
      height="100%"
      style={{ maxWidth: 520, maxHeight: 520 }}
      aria-hidden
    >
      {/* Wall / floor context */}
      <line
        x1="60"
        y1="420"
        x2="440"
        y2="420"
        stroke={forge.muted}
        strokeWidth={STROKE}
        opacity={0.35}
      />
      <rect
        x="80"
        y="80"
        width="340"
        height="340"
        fill="none"
        stroke={forge.muted}
        strokeWidth={1.5}
        opacity={0.15}
        rx={4}
      />

      {/* Pipe */}
      <path
        d={PIPE_PATH}
        fill="none"
        stroke={forge.white}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
      />

      {/* Burst joint */}
      <circle
        cx="380"
        cy="120"
        r={18}
        fill="none"
        stroke={forge.orange}
        strokeWidth={STROKE}
        opacity={burstOpacity}
      />
      <path
        d="M 368 108 L 392 132 M 392 108 L 368 132"
        stroke={forge.orange}
        strokeWidth={STROKE}
        strokeLinecap="round"
        opacity={burstOpacity * 0.8}
      />

      {/* Water drops */}
      {drops.map((offset, i) => {
        const cycle = (frame + offset) % 36;
        const y = interpolate(cycle, [0, 36], [130, 220], {
          extrapolateRight: "clamp",
        });
        const opacity = interpolate(cycle, [0, 8, 28, 36], [0, 0.9, 0.9, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <ellipse
            key={i}
            cx={380 + (i - 1) * 10}
            cy={y}
            rx={5}
            ry={8}
            fill={forge.cyan}
            opacity={opacity * burstOpacity}
          />
        );
      })}

      {/* Puddle */}
      <ellipse
        cx="380"
        cy="418"
        rx={interpolate(frame, [55, 90], [0, 48], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        ry={8}
        fill={forge.cyan}
        opacity={0.25}
      />

      {/* Clock — 2:00 */}
      <g opacity={clockOpacity}>
        <circle
          cx="160"
          cy="160"
          r="42"
          fill="none"
          stroke={forge.muted}
          strokeWidth={STROKE}
        />
        <line
          x1="160"
          y1="160"
          x2="160"
          y2="132"
          stroke={forge.white}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <line
          x1="160"
          y1="160"
          x2="182"
          y2="160"
          stroke={forge.orange}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <text
          x="160"
          y="228"
          textAnchor="middle"
          fill={forge.muted}
          fontSize="18"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.08em"
        >
          2:00
        </text>
      </g>
    </svg>
  );
};
