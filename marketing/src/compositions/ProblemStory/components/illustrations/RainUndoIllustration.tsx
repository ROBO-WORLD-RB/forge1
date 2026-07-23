import { Easing, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../../../../brand";

const STROKE = 2.5;

/** Roof and wall — rain streaks, widening crack, muted leak glow. */
export const RainUndoIllustration: React.FC = () => {
  const frame = useCurrentFrame();

  const roofOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const crackWidth = interpolate(frame, [30, 80], [0, 18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  const leakGlow = interpolate(frame, [50, 90], [0, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rainLines = Array.from({ length: 14 }, (_, i) => ({
    x: 80 + i * 28,
    offset: i * 5,
  }));

  return (
    <svg
      viewBox="0 0 500 520"
      width="100%"
      height="100%"
      style={{ maxWidth: 520, maxHeight: 520 }}
      aria-hidden
    >
      {/* Roof line */}
      <path
        d="M 60 180 L 250 100 L 440 180"
        fill="none"
        stroke={forge.white}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        opacity={roofOpacity}
      />

      {/* Wall */}
      <rect
        x="100"
        y="180"
        width="300"
        height="260"
        fill="none"
        stroke={forge.muted}
        strokeWidth={STROKE}
        opacity={roofOpacity * 0.5}
      />

      {/* Crack — widens over time */}
      <path
        d={`M 248 ${190 + crackWidth * 0.3} L ${252 - crackWidth * 0.2} ${280} L ${246 + crackWidth * 0.15} ${360}`}
        fill="none"
        stroke={forge.orange}
        strokeWidth={1.5 + crackWidth * 0.08}
        strokeLinecap="round"
        opacity={interpolate(frame, [28, 45], [0, 0.85], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />

      {/* Leak glow */}
      <ellipse
        cx="250"
        cy="370"
        rx={32 + crackWidth}
        ry={18 + crackWidth * 0.5}
        fill={forge.orange}
        opacity={leakGlow * 0.25}
      />
      <path
        d="M 248 360 Q 250 390 252 420"
        fill="none"
        stroke={forge.ember}
        strokeWidth={STROKE}
        opacity={leakGlow}
        strokeLinecap="round"
      />

      {/* Rain streaks */}
      {rainLines.map(({ x, offset }) => {
        const cycle = (frame + offset) % 24;
        const y1 = interpolate(cycle, [0, 24], [120, 200], {
          extrapolateRight: "clamp",
        });
        const opacity = interpolate(cycle, [0, 4, 18, 24], [0, 0.5, 0.5, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <line
            key={x}
            x1={x}
            y1={y1}
            x2={x - 6}
            y2={y1 + 28}
            stroke={forge.muted}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={opacity * roofOpacity}
          />
        );
      })}

      {/* Ground puddle */}
      <ellipse
        cx="250"
        cy="448"
        rx={interpolate(frame, [60, 100], [0, 56], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        ry={10}
        fill={forge.orange}
        opacity={0.15}
      />
    </svg>
  );
};
