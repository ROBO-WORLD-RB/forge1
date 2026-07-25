import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, uiFont } from "../fonts";
import { reel } from "../theme";

/** End card — studio credit. */
export const ClosingBeat = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 130 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: reel.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: 56,
        gap: 28,
      }}
    >
      <div
        style={{
          width: 64,
          height: 4,
          borderRadius: 999,
          background: reel.orange,
          opacity: interpolate(enter, [0, 1], [0, 1]),
          transform: `scaleX(${interpolate(enter, [0, 1], [0.3, 1])})`,
        }}
      />
      <div
        style={{
          fontFamily: uiFont,
          fontWeight: 700,
          fontSize: 18,
          color: reel.muted,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          opacity: interpolate(frame, [10, 30], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Built by
      </div>
      <div
        style={{
          fontFamily: displayFont,
          fontSize: 56,
          color: reel.white,
          letterSpacing: "0.04em",
          textAlign: "center",
          lineHeight: 1.1,
          opacity: interpolate(enter, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
        }}
      >
        Intelligent Systems
      </div>
      <div
        style={{
          fontFamily: uiFont,
          fontWeight: 700,
          fontSize: 28,
          color: reel.orange,
          textAlign: "center",
          marginTop: 8,
          opacity: interpolate(frame, [40, 70], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        By Africa. For Africa.
      </div>
    </AbsoluteFill>
  );
};
