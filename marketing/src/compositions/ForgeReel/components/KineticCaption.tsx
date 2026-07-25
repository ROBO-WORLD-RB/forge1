import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, uiFont } from "../fonts";
import { reel } from "../theme";

type KineticCaptionProps = {
  text: string;
  accent?: "orange" | "white" | "ember";
  size?: number;
  variant?: "display" | "ui";
};

/** Full-bleed punch caption — snaps in, exits clean. */
export const KineticCaption = ({
  text,
  accent = "white",
  size = 52,
  variant = "display",
}: KineticCaptionProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180 },
  });
  const exitStart = Math.max(durationInFrames - 14, 1);
  const opacity = interpolate(
    frame,
    [0, 6, exitStart, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const color =
    accent === "orange"
      ? reel.orange
      : accent === "ember"
        ? reel.ember
        : reel.white;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 56px",
        backgroundColor: reel.bg,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: variant === "display" ? displayFont : uiFont,
          fontSize: size,
          fontWeight: variant === "ui" ? 800 : 400,
          lineHeight: 1.12,
          textAlign: "center",
          color,
          letterSpacing: variant === "display" ? "0.01em" : "-0.01em",
          WebkitFontSmoothing: "antialiased",
          textRendering: "geometricPrecision",
          opacity,
          transform: `scale(${interpolate(enter, [0, 1], [0.94, 1])}) translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
        }}
      >
        {text}
      </p>
    </AbsoluteFill>
  );
};
