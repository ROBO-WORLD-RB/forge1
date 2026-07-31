import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { forge } from "../../../brand";
import { Atmosphere } from "../../../shared/Atmosphere";
import { FilmGrain } from "../../../shared/FilmGrain";
import { bodyFont, displayFont } from "../../../shared/fonts";

type ProductActProps = {
  featureLabels: string[];
  url: string;
};

/**
 * Act 4 — labeled feature beats.
 * Placeholder panels stand in for screen recordings (drop clips later).
 */
export const ProductAct: React.FC<ProductActProps> = ({
  featureLabels,
  url,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={50} glowY={30} intensity={0.08} />
      <FilmGrain opacity={0.03} />
      <AbsoluteFill
        style={{
          padding: "72px 88px",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div
            style={{
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: 18,
              color: forge.muted,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 14], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            Product
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: 20,
              color: forge.orange,
              opacity: interpolate(frame, [20, 40], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {url}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            gap: 22,
            flex: 1,
          }}
        >
          {featureLabels.slice(0, 6).map((label, i) => {
            const s = spring({
              frame: Math.max(0, frame - 8 - i * 10),
              fps,
              config: { damping: 14, stiffness: 140 },
            });
            return (
              <div
                key={label}
                style={{
                  borderRadius: 18,
                  border: `1px solid rgba(255,255,255,0.16)`,
                  background:
                    "linear-gradient(160deg, #1C1C1E 0%, #141414 100%)",
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  opacity: s,
                  transform: `translateY(${interpolate(s, [0, 1], [28, 0])}px)`,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontFamily: bodyFont,
                    fontWeight: 800,
                    fontSize: 22,
                    color: forge.white,
                  }}
                >
                  {label}
                </div>
                {/* Screen-recording placeholder region */}
                <div
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    border: `1.5px dashed rgba(255,122,0,0.45)`,
                    background: `
                      repeating-linear-gradient(
                        -45deg,
                        rgba(255,122,0,0.04),
                        rgba(255,122,0,0.04) 12px,
                        transparent 12px,
                        transparent 24px
                      ),
                      #0E0E0E
                    `,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 160,
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      fontFamily: bodyFont,
                      fontWeight: 600,
                      fontSize: 15,
                      color: "rgba(255,255,255,0.45)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: displayFont,
                        fontSize: 28,
                        color: forge.orange,
                        letterSpacing: "0.12em",
                        marginBottom: 8,
                      }}
                    >
                      UI
                    </div>
                    Drop screen recording
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
