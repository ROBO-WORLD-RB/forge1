import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../../../brand";

/** Single living ember — the curiosity hook before any copy. */
export const Ember: React.FC = () => {
  const frame = useCurrentFrame();

  const pulse = interpolate(frame % 36, [0, 18, 36], [0.75, 1.15, 0.75], {
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const enter = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exit = interpolate(frame, [70, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: enter * exit,
      }}
    >
      <div
        style={{
          width: 18 * pulse,
          height: 18 * pulse,
          borderRadius: "50%",
          backgroundColor: forge.orange,
          boxShadow: `
            0 0 ${20 * pulse}px ${forge.orange},
            0 0 ${60 * pulse}px rgba(255, 122, 0, 0.55),
            0 0 ${140 * pulse}px rgba(255, 122, 0, 0.25)
          `,
        }}
      />
      {/* Heat halo */}
      <div
        style={{
          position: "absolute",
          width: 320 * pulse,
          height: 320 * pulse,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,122,0,0.22) 0%, rgba(255,122,0,0) 68%)",
          opacity: 0.85,
        }}
      />
    </AbsoluteFill>
  );
};
