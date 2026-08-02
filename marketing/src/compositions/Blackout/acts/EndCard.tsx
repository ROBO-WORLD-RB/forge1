import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ImpactFlash } from "../components/ImpactFlash";
import { displayFont, uiFont } from "../fonts";
import { blackout } from "../theme";

/** End card — FORGE · tagline · URL · Intelligent Systems. */
export const EndCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const brand = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 160 },
  });
  const line = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 14, stiffness: 140 },
  });
  const url = spring({
    frame: Math.max(0, frame - 70),
    fps,
    config: { damping: 13, stiffness: 150 },
  });
  const credit = spring({
    frame: Math.max(0, frame - 140),
    fps,
    config: { damping: 14, stiffness: 130 },
  });

  const pulse = interpolate(frame % 40, [0, 20, 40], [0.96, 1, 0.96]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: blackout.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: 56,
        gap: 28,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 45%, rgba(255,122,0,0.12) 0%, transparent 70%)`,
        }}
      />

      <div
        style={{
          width: 80,
          height: 5,
          borderRadius: 999,
          background: blackout.orange,
          opacity: interpolate(line, [0, 1], [0, 1]),
          transform: `scaleX(${interpolate(line, [0, 1], [0.2, 1])})`,
        }}
      />

      <div
        style={{
          fontFamily: displayFont,
          fontSize: 128,
          color: blackout.orange,
          letterSpacing: "0.08em",
          opacity: interpolate(brand, [0, 1], [0, 1]),
          transform: `scale(${interpolate(brand, [0, 1], [1.35, 1])})`,
          textShadow: `0 0 60px rgba(255,122,0,0.4)`,
        }}
      >
        FORGE
      </div>

      <div
        style={{
          fontFamily: uiFont,
          fontWeight: 700,
          fontSize: 34,
          color: blackout.white,
          textAlign: "center",
          opacity: interpolate(frame, [40, 70], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Where work meets hands
      </div>

      <div
        style={{
          marginTop: 12,
          padding: "20px 40px",
          borderRadius: 16,
          background: blackout.orange,
          color: blackout.white,
          fontFamily: uiFont,
          fontWeight: 800,
          fontSize: 26,
          opacity: interpolate(url, [0, 1], [0, 1]),
          transform: `scale(${interpolate(url, [0, 1], [0.9, 1]) * pulse})`,
          boxShadow: `0 16px 48px rgba(255,122,0,0.35)`,
        }}
      >
        forge-9ieq.onrender.com
      </div>

      <div
        style={{
          marginTop: 48,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          opacity: interpolate(credit, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(credit, [0, 1], [24, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: uiFont,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "0.2em",
            color: blackout.dim,
            textTransform: "uppercase",
          }}
        >
          Built by
        </div>
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 44,
            color: blackout.white,
            letterSpacing: "0.04em",
          }}
        >
          Intelligent Systems
        </div>
        <div
          style={{
            fontFamily: uiFont,
            fontWeight: 700,
            fontSize: 22,
            color: blackout.orange,
            marginTop: 4,
          }}
        >
          By Africa. For Africa.
        </div>
      </div>

      <ImpactFlash at={0} color={blackout.orange} strength={0.4} />
    </AbsoluteFill>
  );
};
