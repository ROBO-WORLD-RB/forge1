import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { reel } from "../theme";

type GlitchWipeProps = {
  /** Local frame when glitch starts */
  start: number;
  duration?: number;
  children: React.ReactNode;
};

/** Violent shake + opacity flicker + horizontal wipe erase. */
export const GlitchWipe: React.FC<GlitchWipeProps> = ({
  start,
  duration = 80,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = frame - start;

  if (t < 0) {
    return <>{children}</>;
  }

  const progress = interpolate(t, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shakeX =
    Math.sin(t * 1.7) * interpolate(progress, [0, 0.4, 1], [0, 22, 8]);
  const shakeY =
    Math.cos(t * 2.3) * interpolate(progress, [0, 0.4, 1], [0, 14, 6]);
  const flicker = interpolate(
    t % 6,
    [0, 2, 4, 6],
    [1, 0.35, 0.85, 0.2],
  );
  const opacity = interpolate(progress, [0, 0.55, 1], [1, flicker, 0], {
    extrapolateRight: "clamp",
  });
  const wipe = interpolate(progress, [0.35, 1], [0, 110], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translate(${shakeX}px, ${shakeY}px) skewX(${shakeX * 0.15}deg)`,
        clipPath: `inset(0 ${wipe}% 0 0)`,
      }}
    >
      {children}
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, transparent, ${reel.cyan}55, transparent)`,
          opacity: interpolate(progress, [0.2, 0.6, 1], [0, 0.7, 0]),
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
