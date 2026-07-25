import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { reel } from "../theme";

/** Fixed seed positions — no Math.random at render time. */
const PARTICLES = [
  { x: 8, y: 12, size: 5, period: 90, phase: 0 },
  { x: 22, y: 28, size: 4, period: 110, phase: 12 },
  { x: 78, y: 18, size: 6, period: 100, phase: 24 },
  { x: 92, y: 40, size: 3, period: 80, phase: 6 },
  { x: 15, y: 55, size: 5, period: 120, phase: 30 },
  { x: 48, y: 8, size: 4, period: 95, phase: 18 },
  { x: 65, y: 62, size: 5, period: 105, phase: 40 },
  { x: 35, y: 78, size: 3, period: 85, phase: 8 },
  { x: 88, y: 72, size: 6, period: 115, phase: 22 },
  { x: 55, y: 88, size: 4, period: 98, phase: 35 },
] as const;

export const RedParticles = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {PARTICLES.map((p, i) => {
        const t = (frame + p.phase) % p.period;
        const drift = interpolate(t, [0, p.period / 2, p.period], [0, -28, 0]);
        const opacity = interpolate(
          t,
          [0, p.period * 0.2, p.period * 0.5, p.period * 0.8, p.period],
          [0.15, 0.45, 0.35, 0.5, 0.15],
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: reel.red,
              boxShadow: `0 0 ${p.size * 2}px ${reel.red}`,
              opacity,
              transform: `translateY(${drift}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
