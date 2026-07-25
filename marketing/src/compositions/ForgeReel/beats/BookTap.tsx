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

/** Book Jerry Justice — active profile + tap Book Now. */
export const BookTap = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 140 },
  });
  const btn = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 14, stiffness: 140 },
  });
  const tap = spring({
    frame: Math.max(0, frame - 90),
    fps,
    config: { damping: 16, stiffness: 210 },
  });
  const press = interpolate(frame, [90, 105, 130], [1, 0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ripple = interpolate(frame, [100, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const confirmed = frame > 150;

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
            display: "flex",
            flexDirection: "column",
            padding: "64px 22px 40px",
            background: "#1A1A1C",
          }}
        >
          <div
            style={{
              fontFamily: uiFont,
              fontWeight: 700,
              fontSize: 13,
              color: reel.muted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 14,
              opacity: interpolate(frame, [0, 12], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            Confirm booking
          </div>

          {/* Active profile — Jerry Justice */}
          <div
            style={{
              background: "#2A2A2E",
              border: `1px solid ${reel.glassBorder}`,
              borderRadius: 22,
              padding: 20,
              transform: `translateY(${interpolate(card, [0, 1], [28, 0])}px)`,
              opacity: card,
              boxShadow: confirmed
                ? `0 0 0 2px ${reel.green}`
                : `0 0 0 1px rgba(255,122,0,0.25)`,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, #1a3a4a, ${reel.orange})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: uiFont,
                  fontWeight: 800,
                  fontSize: 26,
                  color: reel.white,
                  flexShrink: 0,
                }}
              >
                JJ
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontFamily: uiFont,
                      fontWeight: 800,
                      fontSize: 22,
                      color: reel.white,
                    }}
                  >
                    Jerry Justice
                  </div>
                  <div
                    style={{
                      fontFamily: uiFont,
                      fontWeight: 700,
                      fontSize: 11,
                      color: "#04120a",
                      background: reel.green,
                      borderRadius: 999,
                      padding: "3px 8px",
                    }}
                  >
                    Verified
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 600,
                    fontSize: 15,
                    color: reel.orange,
                    marginTop: 4,
                  }}
                >
                  Master Plumber · Accra
                </div>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 600,
                    fontSize: 13,
                    color: reel.muted,
                    marginTop: 6,
                  }}
                >
                  ★ 4.9 · 86 jobs · 1.4 km away
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: `1px solid ${reel.glassBorder}`,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 600,
                    fontSize: 12,
                    color: reel.dim,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Job
                </div>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 700,
                    fontSize: 15,
                    color: reel.soft,
                    marginTop: 4,
                  }}
                >
                  Burst pipe fix
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 600,
                    fontSize: 12,
                    color: reel.dim,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Escrow
                </div>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 800,
                    fontSize: 15,
                    color: reel.green,
                    marginTop: 4,
                  }}
                >
                  GHS 180 locked
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 160 * ripple,
                height: 160 * ripple,
                marginLeft: -80 * ripple,
                marginTop: -80 * ripple,
                borderRadius: "50%",
                border: `2px solid ${reel.orange}`,
                opacity: 1 - ripple,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                transform: `scale(${interpolate(btn, [0, 1], [0.9, 1]) * press})`,
                opacity: btn,
                background: confirmed ? reel.green : reel.orange,
                borderRadius: 18,
                padding: "20px 0",
                textAlign: "center",
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 24,
                color: reel.white,
                boxShadow: confirmed
                  ? "0 8px 28px rgba(0,166,81,0.4)"
                  : "0 8px 28px rgba(255,122,0,0.4)",
              }}
            >
              {confirmed ? "Booked · Jerry Justice" : "Book Now"}
            </div>
            <div
              style={{
                position: "absolute",
                right: 48,
                bottom: 8,
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: `3px solid ${reel.white}`,
                background: "rgba(255,255,255,0.25)",
                transform: `translate(${interpolate(tap, [0, 1], [48, 0])}px, ${interpolate(tap, [0, 1], [48, 0])}px) scale(${interpolate(tap, [0, 1], [0.5, 1])})`,
                opacity: interpolate(frame, [55, 90, 130, 160], [0, 1, 1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            />
          </div>
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
