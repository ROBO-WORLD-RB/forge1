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

/** Night city → power cut → total blackout. */
export const PowerDies = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cutAt = 210;
  const isDark = frame >= cutAt;
  const windowGlow = isDark
    ? 0
    : interpolate(frame % 40, [0, 20, 40], [0.55, 1, 0.55]);

  const cityEnter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 90 },
  });

  const titleIn = spring({
    frame: Math.max(0, frame - 36),
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  const blackoutSlam = spring({
    frame: Math.max(0, frame - cutAt),
    fps,
    config: { damping: 10, stiffness: 260, mass: 0.6 },
  });

  const flicker =
    frame > cutAt - 24 && frame < cutAt
      ? Math.floor(frame / 3) % 2 === 0
        ? 0.15
        : 1
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: blackout.bg, overflow: "hidden" }}>
      {/* Night sky gradient */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 80% at 50% 20%, ${blackout.cityBlue} 0%, ${blackout.bg} 70%)`,
          opacity: isDark ? 0.35 : 1 * flicker,
        }}
      />

      {/* City silhouette */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          opacity: interpolate(cityEnter, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(cityEnter, [0, 1], [80, 0])}px)`,
        }}
      >
        <svg
          width="1080"
          height="720"
          viewBox="0 0 1080 720"
          style={{ display: "block" }}
        >
          <path
            d="M0 720 L0 420 L80 420 L80 280 L140 280 L140 380 L200 380 L200 180 L280 180 L280 320 L340 320 L340 140 L420 140 L420 300 L480 300 L480 220 L560 220 L560 360 L620 360 L620 160 L700 160 L700 400 L760 400 L760 240 L840 240 L840 380 L900 380 L900 200 L980 200 L980 420 L1080 420 L1080 720 Z"
            fill="#0B0B0B"
          />
          {/* Windows */}
          {[
            [100, 320],
            [220, 220],
            [260, 260],
            [360, 180],
            [390, 220],
            [500, 260],
            [640, 200],
            [670, 240],
            [780, 280],
            [920, 240],
            [950, 280],
          ].map(([x, y], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={14}
              height={18}
              rx={1}
              fill={
                isDark
                  ? "#111"
                  : i % 3 === 0
                    ? blackout.ember
                    : `rgba(255,220,140,${0.35 + windowGlow * 0.45})`
              }
              opacity={isDark ? 0.2 : flicker}
            />
          ))}
        </svg>
      </AbsoluteFill>

      {/* Location line */}
      {!isDark ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: 220,
            opacity: interpolate(titleIn, [0, 1], [0, 1]),
            transform: `scale(${interpolate(titleIn, [0, 1], [0.92, 1])})`,
          }}
        >
          <div
            style={{
              fontFamily: uiFont,
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "0.28em",
              color: blackout.dim,
              textTransform: "uppercase",
              marginBottom: 28,
            }}
          >
            Accra · Lagos · Night
          </div>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 96,
              color: blackout.white,
              letterSpacing: "0.04em",
              lineHeight: 0.9,
              textAlign: "center",
            }}
          >
            THE GRID
            <br />
            HOLDS…
          </div>
        </AbsoluteFill>
      ) : null}

      {/* BLACKOUT slam */}
      {isDark ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: blackout.bg,
          }}
        >
          <div
            style={{
              transform: `scale(${interpolate(blackoutSlam, [0, 1], [2.2, 1])})`,
              opacity: interpolate(blackoutSlam, [0, 1], [0, 1]),
            }}
          >
            <SlamType
              text="BLACKOUT"
              size={120}
              color={blackout.white}
              shake
            />
          </div>
          <div
            style={{
              marginTop: 36,
              opacity: interpolate(frame, [cutAt + 30, cutAt + 60], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <SlamType
              text="WHOLE BLOCK. DEAD."
              size={36}
              variant="ui"
              color={blackout.orange}
              delay={cutAt + 20}
            />
          </div>
        </AbsoluteFill>
      ) : null}

      {frame >= cutAt && frame < cutAt + 16 ? (
        <ChromaticGlitch intensity={1.6} />
      ) : null}
      <ImpactFlash at={cutAt} color={blackout.white} strength={0.85} />
      {frame >= cutAt && frame < cutAt + 8 ? (
        <ImpactFlash at={cutAt + 3} color={blackout.orange} strength={0.4} />
      ) : null}
    </AbsoluteFill>
  );
};
