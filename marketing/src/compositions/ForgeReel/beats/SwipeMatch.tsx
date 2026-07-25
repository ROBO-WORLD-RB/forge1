import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhoneShell } from "../components/PhoneShell";
import { uiFont } from "../fonts";
import { reel } from "../theme";

/** Swipe-right on a worker card — interactive match beat. */
export const SwipeMatch = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 140 },
  });
  // Drag right then snap accept across the 4s beat
  const dragX = interpolate(frame, [40, 150, 200], [0, 140, 420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rot = interpolate(frame, [40, 150], [0, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stamp = interpolate(frame, [100, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finger = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 16, stiffness: 160 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: reel.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <PhoneShell>
        <div
          style={{
            height: "100%",
            padding: "80px 22px 28px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontFamily: uiFont,
              fontWeight: 700,
              fontSize: 16,
              color: reel.muted,
              marginBottom: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Nearby matches
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            {/* Back card */}
            <div
              style={{
                position: "absolute",
                inset: "0 8px auto",
                height: 420,
                borderRadius: 22,
                background: "#1a1a1a",
                border: `1px solid ${reel.glassBorder}`,
                transform: "scale(0.96) translateY(12px)",
              }}
            />
            {/* Front card */}
            <div
              style={{
                position: "absolute",
                inset: "0 0 auto",
                height: 440,
                borderRadius: 22,
                background: "#1C1C1E",
                border: `1px solid ${reel.glassBorder}`,
                padding: 22,
                transform: `translateX(${dragX}px) rotate(${rot}deg) scale(${interpolate(enter, [0, 1], [0.92, 1])})`,
                opacity: interpolate(frame, [190, 230], [1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
              }}
            >
              <div
                style={{
                  height: 180,
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${reel.navy}, #2a1a0a)`,
                  marginBottom: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: uiFont,
                  fontWeight: 800,
                  fontSize: 42,
                  color: reel.orange,
                }}
              >
                KM
              </div>
              <div
                style={{
                  fontFamily: uiFont,
                  fontWeight: 800,
                  fontSize: 26,
                  color: reel.white,
                }}
              >
                Kofi Mensah
              </div>
              <div
                style={{
                  fontFamily: uiFont,
                  fontWeight: 600,
                  fontSize: 17,
                  color: reel.ember,
                  marginTop: 6,
                }}
              >
                Master Electrician · 2.1 km
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 28,
                  left: 24,
                  border: `3px solid ${reel.green}`,
                  color: reel.green,
                  fontFamily: uiFont,
                  fontWeight: 800,
                  fontSize: 22,
                  padding: "6px 14px",
                  borderRadius: 8,
                  transform: `rotate(-12deg) scale(${interpolate(stamp, [0, 1], [0.6, 1])})`,
                  opacity: stamp,
                }}
              >
                MATCH
              </div>
            </div>
            {/* Finger cue */}
            <div
              style={{
                position: "absolute",
                right: 36,
                bottom: 80,
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: `3px solid ${reel.white}`,
                background: "rgba(255,255,255,0.2)",
                transform: `translateX(${interpolate(finger, [0, 1], [0, 110])}px)`,
                opacity: interpolate(frame, [20, 50, 150, 185], [0, 1, 1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                boxShadow: `0 0 16px rgba(255,122,0,0.5)`,
              }}
            />
          </div>
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
