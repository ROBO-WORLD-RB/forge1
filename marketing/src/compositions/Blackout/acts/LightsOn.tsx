import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ChromaticGlitch, ImpactFlash } from "../components/ImpactFlash";
import { SlamType } from "../components/SlamType";
import { displayFont, uiFont } from "../fonts";
import { blackout } from "../theme";

/** Lights slam ON — shop alive — worker Paid. Protected. */
export const LightsOn = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slamAt = 48;
  const lit = frame >= slamAt;

  const surge = spring({
    frame: Math.max(0, frame - slamAt),
    fps,
    config: { damping: 9, stiffness: 280, mass: 0.55 },
  });

  const shopGlow = lit
    ? interpolate(surge, [0, 1], [0, 1])
    : interpolate(frame, [0, slamAt], [0.05, 0.12], {
        extrapolateRight: "clamp",
      });

  const paidIn = spring({
    frame: Math.max(0, frame - 220),
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: blackout.bg, overflow: "hidden" }}>
      {/* Ambient before / after */}
      <AbsoluteFill
        style={{
          background: lit
            ? `radial-gradient(ellipse 100% 70% at 50% 40%, rgba(255,180,60,${0.35 * shopGlow}) 0%, ${blackout.bg} 65%)`
            : blackout.bg,
        }}
      />

      {/* Shop interior silhouette */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: interpolate(frame, [0, 30], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            width: 780,
            height: 620,
            borderRadius: 12,
            border: `3px solid ${lit ? "rgba(255,200,100,0.35)" : "#222"}`,
            background: lit
              ? `linear-gradient(180deg, #2a2218 0%, #1a140e 100%)`
              : `#0c0c0c`,
            boxShadow: lit
              ? `0 0 120px rgba(255,122,0,${0.45 * shopGlow}), inset 0 0 80px rgba(255,200,80,0.12)`
              : "none",
            position: "relative",
            overflow: "hidden",
            transform: `scale(${interpolate(surge, [0, 1], [0.98, 1])})`,
          }}
        >
          {/* Ceiling lights */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 36,
                left: 80 + i * 160,
                width: 100,
                height: 14,
                borderRadius: 8,
                background: lit ? blackout.spark : "#1a1a1a",
                boxShadow: lit
                  ? `0 20px 60px rgba(255,220,120,${0.7 * shopGlow})`
                  : "none",
                opacity: lit ? shopGlow : 0.4,
              }}
            />
          ))}
          {/* Freezer revived */}
          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: 80,
              width: 220,
              height: 280,
              borderRadius: 10,
              border: `2px solid ${lit ? "#4a6a80" : "#222"}`,
              background: lit
                ? `linear-gradient(180deg, rgba(100,180,220,0.25), #151515)`
                : "#111",
              boxShadow: lit ? `0 0 40px rgba(100,180,220,0.25)` : "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 20,
                color: lit ? "#5ad4ff" : "#333",
              }}
            >
              {lit ? "−18°C" : "OFF"}
            </div>
          </div>
          {/* Counter / alive shop marks */}
          <div
            style={{
              position: "absolute",
              bottom: 80,
              right: 80,
              width: 280,
              height: 120,
              borderRadius: 10,
              background: lit ? "#2a241c" : "#141414",
              border: `1px solid ${lit ? "rgba(255,180,80,0.3)" : "#222"}`,
            }}
          />
          {lit ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at 50% 20%, rgba(255,240,180,${0.2 * shopGlow}), transparent 55%)`,
                pointerEvents: "none",
              }}
            />
          ) : null}
        </div>
      </AbsoluteFill>

      {/* Pre-slam caption */}
      {!lit ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: 200,
          }}
        >
          <SlamType text="ONE TAP…" size={64} color={blackout.dim} />
        </AbsoluteFill>
      ) : null}

      {/* LIGHTS ON slam */}
      {lit ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: 180,
          }}
        >
          <div
            style={{
              transform: `scale(${interpolate(surge, [0, 1], [1.8, 1])})`,
              opacity: interpolate(surge, [0, 1], [0, 1]),
            }}
          >
            <SlamType
              text="LIGHTS ON"
              size={100}
              color={blackout.orange}
              shake
            />
          </div>
          <div
            style={{
              marginTop: 20,
              opacity: interpolate(frame, [slamAt + 40, slamAt + 70], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <SlamType
              text="SHOP ALIVE."
              size={40}
              variant="ui"
              color={blackout.white}
              delay={slamAt + 30}
            />
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Worker paid moment */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 160,
          opacity: interpolate(paidIn, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(paidIn, [0, 1], [40, 0])}px)`,
        }}
      >
        <div
          style={{
            width: 720,
            borderRadius: 20,
            background: "rgba(0,0,0,0.72)",
            border: `2px solid ${blackout.green}`,
            padding: "28px 36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: `0 0 40px rgba(0,166,81,0.25)`,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 700,
                fontSize: 18,
                color: blackout.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Worker payout
            </div>
            <div
              style={{
                fontFamily: displayFont,
                fontSize: 48,
                color: blackout.white,
                marginTop: 6,
              }}
            >
              PAID. PROTECTED.
            </div>
          </div>
          <div
            style={{
              fontFamily: uiFont,
              fontWeight: 800,
              fontSize: 22,
              color: blackout.bg,
              background: blackout.green,
              padding: "14px 18px",
              borderRadius: 12,
            }}
          >
            ✓ DONE
          </div>
        </div>
      </AbsoluteFill>

      <ImpactFlash at={slamAt} color={blackout.white} strength={0.9} />
      <ImpactFlash at={slamAt + 4} color={blackout.orange} strength={0.55} />
      {frame >= slamAt && frame < slamAt + 20 ? (
        <ChromaticGlitch intensity={1.5} />
      ) : null}
      <ImpactFlash at={220} color={blackout.green} strength={0.35} />
    </AbsoluteFill>
  );
};
