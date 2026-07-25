import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { reel } from "../theme";

export const GlitchCut = () => {
  const frame = useCurrentFrame();
  const shake = Math.sin(frame * 3.1) * interpolate(frame, [0, 30], [16, 2], {
    extrapolateRight: "clamp",
  });
  const wipe = interpolate(frame, [15, 60], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      <AbsoluteFill
        style={{
          transform: `translateX(${shake}px)`,
          clipPath: `inset(0 ${wipe}% 0 0)`,
          background: `repeating-linear-gradient(
            0deg,
            ${reel.bg},
            ${reel.bg} 3px,
            #1a1a1a 3px,
            #1a1a1a 6px
          )`,
        }}
      />
      <AbsoluteFill
        style={{
          background: reel.orange,
          opacity: interpolate(frame, [40, 60], [0, 0.55], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
