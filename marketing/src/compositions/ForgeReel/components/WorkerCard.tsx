import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { uiFont } from "../fonts";
import { reel } from "../theme";

export const WorkerCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badge = spring({
    frame: Math.max(0, frame - 200),
    fps,
    config: { damping: 12, stiffness: 140 },
  });

  const escrow = spring({
    frame: Math.max(0, frame - 320),
    fps,
    config: { damping: 16, stiffness: 100 },
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "72px 28px 36px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        background: `radial-gradient(ellipse at 50% 0%, rgba(0,242,254,0.12), transparent 55%), ${reel.bg}`,
      }}
    >
      <div
        style={{
          fontFamily: uiFont,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: reel.cyan,
          textTransform: "uppercase",
        }}
      >
        FORGE Pro
      </div>

      <div
        style={{
          background: reel.glass,
          border: `1px solid ${reel.glassBorder}`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 24,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${reel.orange}, ${reel.cyan})`,
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
            KM
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 700,
                fontSize: 22,
                color: reel.white,
                lineHeight: 1.25,
              }}
            >
              Kofi Mensah
            </div>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 500,
                fontSize: 16,
                color: reel.muted,
                marginTop: 4,
              }}
            >
              Master Electrician
            </div>
          </div>
        </div>

        {/* Verified badge */}
        <div
          style={{
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.55)",
            transform: `scale(${interpolate(badge, [0, 1], [0.4, 1])})`,
            opacity: badge,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill={reel.green} />
            <path
              d="M7 12.5l3.2 3.2L17 8.5"
              stroke="#04120a"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontFamily: uiFont,
              fontWeight: 700,
              fontSize: 14,
              color: reel.green,
            }}
          >
            Verified
          </span>
        </div>

        {/* Stars — one every 10 frames from frame 240 */}
        <div style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => {
            const appear = 240 + i * 10;
            const s = spring({
              frame: Math.max(0, frame - appear),
              fps,
              config: { damping: 11, stiffness: 160 },
            });
            return (
              <span
                key={i}
                style={{
                  fontSize: 28,
                  color: reel.gold,
                  transform: `scale(${interpolate(s, [0, 1], [0, 1])})`,
                  opacity: s,
                  textShadow: `0 0 12px ${reel.gold}`,
                  display: "inline-block",
                }}
              >
                ★
              </span>
            );
          })}
        </div>

        {/* Escrow callout */}
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 16,
            background: "rgba(0, 242, 254, 0.08)",
            border: `1px solid rgba(0, 242, 254, 0.45)`,
            boxShadow: `0 0 28px rgba(0, 242, 254, 0.2)`,
            transform: `translateY(${interpolate(escrow, [0, 1], [16, 0])}px)`,
            opacity: escrow,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2l8 3v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V5l8-3z"
              stroke={reel.cyan}
              strokeWidth="1.6"
              fill="rgba(0,242,254,0.15)"
            />
          </svg>
          <span
            style={{
              fontFamily: uiFont,
              fontWeight: 600,
              fontSize: 15,
              color: reel.white,
              lineHeight: 1.3,
            }}
          >
            Paystack Escrow Protected
          </span>
        </div>
      </div>
    </div>
  );
};
