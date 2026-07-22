import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { forge } from "../../../brand";
import { FilmGrain } from "../components/FilmGrain";
import { Sparks } from "../components/Sparks";
import { displayFont, bodyFont } from "../fonts";

/** Beat 4: a spark draws the connection — the marketplace metaphor. */
export const MatchDraw: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOut = interpolate(frame, [150, 180], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pathProgress = interpolate(frame, [8, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const pathLength = 920;
  const dashOffset = pathLength * (1 - pathProgress);

  const nodePulse = interpolate(frame % 24, [0, 12, 24], [0.85, 1.2, 0.85]);
  const matchPop = interpolate(frame, [78, 98], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const matchScale = interpolate(frame, [78, 100], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const flash = interpolate(frame, [72, 78, 95], [0, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leftX = 500;
  const rightX = 1420;
  const midY = 540;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: forge.navy,
        opacity: sceneIn * sceneOut,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, #2a1a0c 0%, #1A1A1A 55%, #0e0e0e 100%)",
        }}
      />

      {/* Connection path */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="sparkPath" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={forge.orange} stopOpacity="0.2" />
            <stop offset="50%" stopColor={forge.orange} stopOpacity="1" />
            <stop offset="100%" stopColor={forge.ember} stopOpacity="0.35" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <line
          x1={leftX}
          y1={midY}
          x2={rightX}
          y2={midY}
          stroke="url(#sparkPath)"
          strokeWidth={4}
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          filter="url(#glow)"
        />
      </svg>

      {/* Endpoint nodes */}
      {[leftX, rightX].map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: midY,
            width: 22 * nodePulse,
            height: 22 * nodePulse,
            borderRadius: "50%",
            backgroundColor: i === 0 ? forge.white : forge.orange,
            translate: "-50% -50%",
            boxShadow:
              i === 0
                ? "0 0 24px rgba(255,255,255,0.45)"
                : `0 0 28px ${forge.orange}`,
            opacity: interpolate(frame, [0, 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      ))}

      {/* Traveling spark head */}
      <div
        style={{
          position: "absolute",
          left: leftX + (rightX - leftX) * pathProgress,
          top: midY,
          width: 14,
          height: 14,
          borderRadius: "50%",
          backgroundColor: forge.spark,
          translate: "-50% -50%",
          boxShadow: `0 0 30px ${forge.orange}, 0 0 60px ${forge.orange}`,
          opacity: pathProgress > 0 && pathProgress < 1 ? 1 : 0,
        }}
      />

      <Interactive.Div
        name="Match word"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 320,
          display: "flex",
          justifyContent: "center",
          opacity: matchPop,
          scale: matchScale,
          fontFamily: displayFont,
          fontSize: 140,
          color: forge.orange,
          letterSpacing: "0.28em",
          textShadow: `0 0 40px rgba(255,122,0,0.65)`,
        }}
      >
        MATCH
      </Interactive.Div>

      <Interactive.Div
        name="Match sub"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 200,
          display: "flex",
          justifyContent: "center",
          fontFamily: bodyFont,
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: forge.muted,
          opacity: interpolate(frame, [95, 115], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        work finds skill
      </Interactive.Div>

      {frame >= 72 ? <Sparks burstAt={74} count={36} /> : null}

      <AbsoluteFill
        style={{
          backgroundColor: forge.orange,
          opacity: flash,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <FilmGrain opacity={0.07} />
    </AbsoluteFill>
  );
};
