import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { bodyFont } from "./fonts";

/**
 * Persistent top-center parent brand —
 * light, readable on the dark plate; sits above atmosphere/grain.
 */
export const CompanyLockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  // Softly yield before the closing end card so it doesn't double-brand.
  const exitStart = durationInFrames - 220;
  const exit = interpolate(frame, [exitStart, exitStart + 28], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 100,
      }}
    >
      <Interactive.Div
        name="Company"
        style={{
          position: "absolute",
          top: 44,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: bodyFont,
          fontSize: 26,
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.92)",
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          textAlign: "center",
          // Trailing tracking can clip the last glyph; pad the right edge.
          paddingLeft: "0.24em",
          opacity: enter * exit,
          textShadow: "0 1px 12px rgba(0, 0, 0, 0.55)",
        }}
      >
        INTELLIGENT SYSTEMS
      </Interactive.Div>
    </AbsoluteFill>
  );
};
