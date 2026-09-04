import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { reel } from "../theme";

/** Fast hard wipe — keep under 1s so Meet FORGE hits immediately. */
export const GlitchCut = () => {
  const frame = useCurrentFrame();
  const shake = Math.sin(frame * 4.2) * interpolate(frame, [0, 24], [14, 2], {
    extrapolateRight: "clamp",
  });
  const wipe = interpolate(frame, [4, 40], [0, 100], {
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
          opacity: interpolate(frame, [28, 48], [0, 0.5], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
