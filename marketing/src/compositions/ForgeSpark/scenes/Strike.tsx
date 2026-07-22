import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { forge } from "../../../brand";
import { FilmGrain } from "../components/FilmGrain";
import { Sparks } from "../components/Sparks";
import { displayFont } from "../fonts";

const LETTERS = ["F", "O", "R", "G", "E"] as const;

/** Beat 5: hammer-strike energy — letters forged from heat. */
export const Strike: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOut = interpolate(frame, [165, 195], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const impactFlash = interpolate(frame, [0, 6, 22], [0, 0.85, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heatWash = interpolate(frame, [0, 40], [0.55, 0.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shake = interpolate(frame, [0, 4, 10, 18], [0, 14, -8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: forge.navy,
        opacity: sceneIn * sceneOut,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 55%, rgba(255,122,0,${heatWash}) 0%, #1A1A1A 55%, #0a0a0a 100%)`,
        }}
      />

      <Sparks burstAt={2} count={48} originX={960} originY={520} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          translate: `${shake}px 0px`,
          display: "flex",
          flexDirection: "row",
          gap: 8,
        }}
      >
        {LETTERS.map((letter, i) => {
          const letterSpring = spring({
            frame: frame - (8 + i * 5),
            fps,
            config: { damping: 14, stiffness: 180, mass: 0.7 },
          });
          const y = interpolate(letterSpring, [0, 1], [80, 0]);
          const opacity = interpolate(letterSpring, [0, 0.2, 1], [0, 1, 1]);
          const glow = interpolate(frame, [20 + i * 5, 50 + i * 5], [1, 0.25], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <Interactive.Div
              key={letter}
              name={`Forge letter ${letter}`}
              style={{
                fontFamily: displayFont,
                fontSize: 220,
                color: forge.white,
                letterSpacing: "0.02em",
                lineHeight: 1,
                opacity,
                translate: `0px ${y}px`,
                scale: interpolate(letterSpring, [0, 1], [0.7, 1], {
                  easing: Easing.bezier(0.34, 1.56, 0.64, 1),
                }),
                textShadow: `
                  0 0 ${30 * glow}px rgba(255,122,0,${0.9 * glow}),
                  0 0 ${80 * glow}px rgba(255,122,0,${0.45 * glow})
                `,
              }}
            >
              {letter}
            </Interactive.Div>
          );
        })}
      </AbsoluteFill>

      {/* Hot underline strike */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 260,
        }}
      >
        <div
          style={{
            width: interpolate(frame, [40, 70], [0, 420], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            height: 8,
            backgroundColor: forge.orange,
            boxShadow: `0 0 24px ${forge.orange}`,
            borderRadius: 4,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          backgroundColor: "#fff5e6",
          opacity: impactFlash,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <FilmGrain opacity={0.08} />
    </AbsoluteFill>
  );
};
