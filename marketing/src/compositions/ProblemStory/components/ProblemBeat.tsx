import { AbsoluteFill } from "remotion";
import { Atmosphere } from "../../../shared/Atmosphere";
import { FilmGrain } from "../../../shared/FilmGrain";
import { forge } from "../../../brand";
import { CaptionLine } from "./CaptionLine";

type ProblemBeatProps = {
  caption: string;
  illustration: React.ReactNode;
  glowX?: number;
  glowY?: number;
  intensity?: number;
};

/** Shell: illustration upper 55–60%, caption below, shared atmosphere. */
export const ProblemBeat: React.FC<ProblemBeatProps> = ({
  caption,
  illustration,
  glowX = 50,
  glowY = 38,
  intensity = 0.11,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={glowX} glowY={glowY} intensity={intensity} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 140,
          paddingLeft: 80,
          paddingRight: 80,
          gap: 48,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "58%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {illustration}
        </div>

        <div style={{ width: "100%", paddingBottom: 120 }}>
          <CaptionLine text={caption} />
        </div>
      </AbsoluteFill>

      <FilmGrain opacity={0.04} />
    </AbsoluteFill>
  );
};
