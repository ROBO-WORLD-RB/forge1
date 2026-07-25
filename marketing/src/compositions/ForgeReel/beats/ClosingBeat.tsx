import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, uiFont } from "../fonts";
import { reel } from "../theme";

/** End card — INTELLIGENT SYSTEMS top-center, FORGE top-right. */
export const ClosingBeat = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 130 },
  });
  const forgeIn = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 14, stiffness: 150 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      {/* FORGE — top right */}
      <div
        style={{
          position: "absolute",
          top: 56,
          right: 48,
          fontFamily: displayFont,
          fontSize: 52,
          letterSpacing: "0.08em",
          color: reel.orange,
          opacity: interpolate(forgeIn, [0, 1], [0, 1]),
          transform: `translateX(${interpolate(forgeIn, [0, 1], [24, 0])}px)`,
        }}
      >
        FORGE
      </div>

      {/* INTELLIGENT SYSTEMS — center top, bold */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 40,
          right: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            width: 72,
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
            fontSize: 16,
            color: reel.muted,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: interpolate(frame, [8, 28], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Built by
        </div>
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 72,
            fontWeight: 400,
            color: reel.white,
            letterSpacing: "0.06em",
            textAlign: "center",
            lineHeight: 1.05,
            textTransform: "uppercase",
            opacity: interpolate(enter, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`,
          }}
        >
          Intelligent
          <br />
          Systems
        </div>
      </div>

      {/* Tagline — lower center */}
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          bottom: 160,
          fontFamily: uiFont,
          fontWeight: 700,
          fontSize: 30,
          color: reel.orange,
          textAlign: "center",
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
