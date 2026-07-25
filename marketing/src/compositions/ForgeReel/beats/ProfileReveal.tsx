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

export const ProfileReveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 160 },
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
        <div style={{ padding: "72px 24px 24px" }}>
          <div
            style={{
              background: reel.glass,
              border: `1px solid ${reel.glassBorder}`,
              borderRadius: 22,
              padding: 22,
              transform: `translateY(${interpolate(card, [0, 1], [36, 0])}px)`,
              opacity: card,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${reel.orange}, ${reel.ember})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: uiFont,
                  fontWeight: 800,
                  fontSize: 24,
                  color: reel.white,
                }}
              >
                KM
              </div>
              <div>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 800,
                    fontSize: 24,
                    color: reel.white,
                  }}
                >
                  Kofi Mensah
                </div>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 600,
                    fontSize: 16,
                    color: reel.orange,
                    marginTop: 4,
                  }}
                >
                  Master Electrician · Accra
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {["Wiring", "Meters", "Solar"].map((tag, i) => {
                const t = spring({
                  frame: Math.max(0, frame - 20 - i * 8),
                  fps,
                  config: { damping: 14, stiffness: 180 },
                });
                return (
                  <span
                    key={tag}
                    style={{
                      fontFamily: uiFont,
                      fontWeight: 700,
                      fontSize: 14,
                      color: reel.soft,
                      background: "rgba(255,122,0,0.12)",
                      border: `1px solid rgba(255,122,0,0.35)`,
                      borderRadius: 999,
                      padding: "6px 12px",
                      opacity: t,
                      transform: `scale(${interpolate(t, [0, 1], [0.8, 1])})`,
                    }}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
