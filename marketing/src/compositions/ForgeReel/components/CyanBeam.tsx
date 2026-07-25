import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { reel } from "../theme";

type CyanBeamProps = {
  /** Local frame for beam expand */
  duration?: number;
};

export const CyanBeam: React.FC<CyanBeamProps> = ({ duration = 36 }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, duration], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 10, duration, duration + 40], [0, 1, 0.85, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: `${width}%`,
          height: 6,
          borderRadius: 999,
          background: `linear-gradient(90deg, transparent, ${reel.cyan}, ${reel.white}, ${reel.cyan}, transparent)`,
          boxShadow: `0 0 40px ${reel.cyan}, 0 0 80px ${reel.cyan}`,
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};
