import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { forge } from "../../../brand";
import { Atmosphere } from "../../../shared/Atmosphere";
import { FilmGrain } from "../../../shared/FilmGrain";
import { bodyFont, displayFont } from "../../../shared/fonts";

type SolutionActProps = {
  loopSteps: string[];
  tagline: string;
};

/** Act 3 — Discover → Hire → Work → Pay → Review + tagline. */
export const SolutionAct: React.FC<SolutionActProps> = ({
  loopSteps,
  tagline,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = spring({
    frame: Math.max(0, frame - 90),
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const tagOpacity = interpolate(frame, [140, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={50} glowY={55} intensity={0.1} />
      <FilmGrain opacity={0.035} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 48,
          padding: "0 80px",
        }}
      >
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 700,
            fontSize: 18,
            color: forge.muted,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            opacity: interpolate(frame, [0, 16], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          The loop
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: 18,
            maxWidth: 1600,
          }}
        >
          {loopSteps.map((step, i) => {
            const s = spring({
              frame: Math.max(0, frame - 12 - i * 14),
              fps,
              config: { damping: 13, stiffness: 160 },
            });
            return (
              <div
                key={step}
                style={{ display: "flex", alignItems: "center", gap: 18 }}
              >
                <div
                  style={{
                    padding: "18px 32px",
                    borderRadius: 14,
                    border: `1.5px solid ${forge.orange}`,
                    background: "rgba(255,122,0,0.1)",
                    fontFamily: bodyFont,
                    fontWeight: 700,
                    fontSize: 32,
                    color: forge.white,
                    opacity: s,
                    transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
                  }}
                >
                  {step}
                </div>
                {i < loopSteps.length - 1 ? (
                  <div
                    style={{
                      fontFamily: displayFont,
                      fontSize: 36,
                      color: forge.orange,
                      opacity: s,
                    }}
                  >
                    →
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div
          style={{
            opacity: brand,
            transform: `scale(${interpolate(brand, [0, 1], [0.94, 1])})`,
            textAlign: "center",
            marginTop: 20,
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 96,
              color: forge.orange,
              letterSpacing: "0.08em",
            }}
          >
            FORGE
          </div>
          <div
            style={{
              opacity: tagOpacity,
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: 34,
              color: forge.white,
              marginTop: 16,
            }}
          >
            {tagline}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
