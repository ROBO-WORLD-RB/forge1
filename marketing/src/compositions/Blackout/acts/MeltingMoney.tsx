import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ImpactFlash } from "../components/ImpactFlash";
import { SlamType } from "../components/SlamType";
import { displayFont, uiFont } from "../fonts";
import { blackout } from "../theme";

/** Dead freezer / dark shop — stock melting, panic type. */
export const MeltingMoney = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shopIn = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const drip = interpolate(frame, [40, 420], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panicWords = [
    { t: "STOCK", at: 60 },
    { t: "MELTING", at: 110 },
    { t: "CASH", at: 170 },
    { t: "DYING", at: 220 },
  ] as const;

  const activePanic = [...panicWords].reverse().find((w) => frame >= w.at);

  const tempShake =
    frame > 80 ? Math.sin(frame * 1.8) * interpolate(frame, [80, 200], [0, 6], {
      extrapolateRight: "clamp",
    }) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: blackout.bg, overflow: "hidden" }}>
      {/* Dark shop floor */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, #0A0A0A 0%, #111 55%, #080808 100%)`,
          opacity: interpolate(shopIn, [0, 1], [0.4, 1]),
        }}
      />

      {/* Freezer unit */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `translateY(${interpolate(shopIn, [0, 1], [60, -40])}px) translateX(${tempShake}px)`,
        }}
      >
        <div
          style={{
            width: 420,
            height: 520,
            borderRadius: 18,
            border: `3px solid ${frame > 140 ? "#2a2a2a" : "#3a3a3a"}`,
            background: `linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Glass door */}
          <div
            style={{
              position: "absolute",
              inset: 28,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: `linear-gradient(160deg, rgba(120,180,220,${0.08 * (1 - drip)}) 0%, rgba(20,20,20,0.9) 60%)`,
            }}
          />
          {/* Temperature badge */}
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 40,
              fontFamily: uiFont,
              fontWeight: 800,
              fontSize: 28,
              color: frame > 100 ? blackout.red : "#5ad4ff",
              letterSpacing: "0.04em",
            }}
          >
            {frame > 100 ? "+8°C" : "−18°C"}
          </div>
          {/* Melting drops */}
          {[0, 1, 2, 3, 4].map((i) => {
            const y = interpolate(
              (frame + i * 18) % 90,
              [0, 90],
              [120, 480],
            );
            const op = interpolate(drip, [0, 0.2, 1], [0, 0.3, 0.85]);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 80 + i * 60,
                  top: y,
                  width: 10,
                  height: 22 + i * 4,
                  borderRadius: "40% 40% 50% 50%",
                  background: `rgba(180,220,255,${op})`,
                  filter: "blur(0.5px)",
                }}
              />
            );
          })}
          {/* Currency melt labels */}
          <div
            style={{
              position: "absolute",
              bottom: 48,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: displayFont,
              fontSize: 42,
              color: blackout.orange,
              opacity: interpolate(frame, [90, 130], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `scaleY(${interpolate(drip, [0, 1], [1, 1.15])})`,
            }}
          >
            ₵ · ₦ · MELT
          </div>
        </div>
      </AbsoluteFill>

      {/* Owner stare caption */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 280,
        }}
      >
        <SlamType
          text="DARK SHOP."
          size={64}
          delay={20}
          color={blackout.white}
          shake
        />
      </AbsoluteFill>

      {/* Panic kinetic overlays */}
      {activePanic ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: 260,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 110,
              color: blackout.red,
              letterSpacing: "0.02em",
              opacity: interpolate(
                frame - activePanic.at,
                [0, 4, 40, 48],
                [0, 1, 1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
              transform: `scale(${interpolate(
                frame - activePanic.at,
                [0, 8],
                [1.4, 1],
                { extrapolateRight: "clamp" },
              )}) rotate(${Math.sin((frame - activePanic.at) * 0.4) * 1.5}deg)`,
              textShadow: `0 0 30px rgba(255,45,45,0.5)`,
            }}
          >
            {activePanic.t}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Bottom sting */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 140,
          opacity: interpolate(frame, [300, 340], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <SlamType
          text="EVERY HOUR = LOSS"
          size={40}
          variant="ui"
          color={blackout.orange}
          delay={300}
        />
      </AbsoluteFill>

      <ImpactFlash at={100} color={blackout.red} strength={0.35} />
      <ImpactFlash at={220} color={blackout.white} strength={0.25} />
    </AbsoluteFill>
  );
};
