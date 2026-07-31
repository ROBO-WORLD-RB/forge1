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
import { KineticLine } from "../../../shared/KineticLine";
import { bodyFont } from "../../../shared/fonts";

type DiffActProps = {
  markets: string[];
  marketChips: string[];
};

/** Act 5 — Built for West Africa. */
export const DiffAct: React.FC<DiffActProps> = ({ markets, marketChips }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={52} glowY={60} intensity={0.1} />
      <FilmGrain opacity={0.035} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 40,
          padding: "0 100px",
        }}
      >
        <KineticLine
          name="DiffHeadline"
          text="Built for West Africa"
          fontSize={72}
          stagger={4}
          enterFrom={6}
          maxWidth={1500}
        />
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 28,
            color: forge.muted,
            opacity: interpolate(frame, [40, 60], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Not a global template — {markets.join(" & ")} first.
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "center",
            maxWidth: 1100,
            marginTop: 12,
          }}
        >
          {marketChips.map((chip, i) => {
            const s = spring({
              frame: Math.max(0, frame - 50 - i * 8),
              fps,
              config: { damping: 13, stiffness: 170 },
            });
            return (
              <div
                key={chip}
                style={{
                  padding: "14px 28px",
                  borderRadius: 12,
                  border: `1.5px solid ${forge.orange}`,
                  background: "rgba(255,122,0,0.1)",
                  fontFamily: bodyFont,
                  fontWeight: 800,
                  fontSize: 26,
                  color: forge.white,
                  opacity: s,
                  transform: `scale(${interpolate(s, [0, 1], [0.85, 1])})`,
                }}
              >
                {chip}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
