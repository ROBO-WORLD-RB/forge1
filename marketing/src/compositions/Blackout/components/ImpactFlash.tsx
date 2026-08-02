import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { blackout } from "../theme";

type ImpactFlashProps = {
  /** Frame (local) when flash peaks */
  at?: number;
  color?: string;
  strength?: number;
};

/** Single-frame impact hit — white/orange/red burst. */
export const ImpactFlash = ({
  at = 0,
  color = blackout.white,
  strength = 0.7,
}: ImpactFlashProps) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  const opacity = interpolate(t, [0, 2, 10], [strength, strength * 0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: color,
        opacity,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};

/** RGB split glitch bars for hardcore cuts. */
export const ChromaticGlitch = ({ intensity = 1 }: { intensity?: number }) => {
  const frame = useCurrentFrame();
  const amp = intensity * (6 + Math.sin(frame * 2.4) * 4);
  const show = frame % 7 < 2 || (frame > 0 && frame < 8);

  if (!show) return null;

  return (
    <>
      <AbsoluteFill
        style={{
          borderLeft: `${2 + amp * 0.3}px solid rgba(0, 200, 255, 0.55)`,
          transform: `translateX(${-amp}px)`,
          mixBlendMode: "screen",
          opacity: 0.55,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          borderRight: `${2 + amp * 0.3}px solid rgba(255, 40, 40, 0.55)`,
          transform: `translateX(${amp}px)`,
          mixBlendMode: "screen",
          opacity: 0.55,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.04) 2px,
            rgba(255,255,255,0.04) 4px
          )`,
          opacity: 0.6 * intensity,
          pointerEvents: "none",
        }}
      />
    </>
  );
};
