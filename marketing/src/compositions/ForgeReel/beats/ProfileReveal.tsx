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

const PROS = [
  {
    initials: "KM",
    name: "Kofi Mensah",
    role: "Master Electrician · Accra",
    tags: ["Wiring", "Meters", "Solar"],
    gradient: `linear-gradient(135deg, ${reel.orange}, ${reel.ember})`,
  },
  {
    initials: "JJ",
    name: "Jerry Justice",
    role: "Master Plumber · Accra",
    tags: ["Pipes", "Leak Fix", "Installs"],
    gradient: `linear-gradient(135deg, #1a3a4a, ${reel.orange})`,
  },
] as const;

export const ProfileReveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: reel.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <PhoneShell>
        <div style={{ padding: "64px 22px 24px" }}>
          <div
            style={{
              fontFamily: uiFont,
              fontWeight: 700,
              fontSize: 14,
              color: reel.muted,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 16,
              opacity: interpolate(frame, [0, 12], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            Top pros near you
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {PROS.map((pro, i) => {
              const card = spring({
                frame: Math.max(0, frame - i * 36),
                fps,
                config: { damping: 12, stiffness: 160 },
              });
              return (
                <div
                  key={pro.name}
                  style={{
                    background: reel.glass,
                    border: `1px solid ${reel.glassBorder}`,
                    borderRadius: 22,
                    padding: 20,
                    transform: `translateY(${interpolate(card, [0, 1], [36, 0])}px)`,
                    opacity: card,
                  }}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: pro.gradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: uiFont,
                        fontWeight: 800,
                        fontSize: 22,
                        color: reel.white,
                        flexShrink: 0,
                      }}
                    >
                      {pro.initials}
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: uiFont,
                          fontWeight: 800,
                          fontSize: 22,
                          color: reel.white,
                        }}
                      >
                        {pro.name}
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
                        {pro.role}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {pro.tags.map((tag, ti) => {
                      const t = spring({
                        frame: Math.max(0, frame - 28 - i * 36 - ti * 8),
                        fps,
                        config: { damping: 14, stiffness: 180 },
                      });
                      return (
                        <span
                          key={tag}
                          style={{
                            fontFamily: uiFont,
                            fontWeight: 700,
                            fontSize: 13,
                            color: reel.soft,
                            background: "rgba(255,122,0,0.12)",
                            border: `1px solid rgba(255,122,0,0.35)`,
                            borderRadius: 999,
                            padding: "5px 11px",
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
              );
            })}
          </div>
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
