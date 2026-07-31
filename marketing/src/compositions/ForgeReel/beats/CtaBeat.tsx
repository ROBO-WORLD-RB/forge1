import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, uiFont } from "../fonts";
import { useReelProps } from "../ReelPropsContext";
import { reel } from "../theme";

export const CtaBeat = () => {
  const { ctaUrl } = useReelProps();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 150 },
  });
  const pulse = interpolate(frame % 32, [0, 16, 32], [0.92, 1, 0.92]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: reel.bg,
        justifyContent: "center",
        alignItems: "center",
        gap: 28,
        padding: 48,
      }}
    >
      <div
        style={{
          fontFamily: displayFont,
          fontSize: 72,
          color: reel.orange,
          letterSpacing: "0.06em",
          opacity: interpolate(enter, [0, 1], [0, 1]),
        }}
      >
        FORGE
      </div>
      <div
        style={{
          fontFamily: uiFont,
          fontWeight: 700,
          fontSize: 32,
          color: reel.white,
          textAlign: "center",
          opacity: interpolate(frame, [12, 28], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Where Work Meets Hands.
      </div>
      <div
        style={{
          transform: `scale(${interpolate(enter, [0, 1], [0.9, 1]) * pulse})`,
          opacity: enter,
          marginTop: 8,
          padding: "18px 36px",
          borderRadius: 16,
          background: reel.orange,
          color: reel.white,
          fontFamily: uiFont,
          fontWeight: 800,
          fontSize: 24,
        }}
      >
        {ctaUrl}
      </div>
    </AbsoluteFill>
  );
};
