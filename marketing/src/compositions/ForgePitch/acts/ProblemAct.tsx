import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { forge } from "../../../brand";
import { Atmosphere } from "../../../shared/Atmosphere";
import { FilmGrain } from "../../../shared/FilmGrain";
import { KineticLine } from "../../../shared/KineticLine";
import { bodyFont } from "../../../shared/fonts";
import { PipeBurstIllustration } from "../../ProblemStory/components/illustrations/PipeBurstIllustration";
import { WaitingHandsIllustration } from "../../ProblemStory/components/illustrations/WaitingHandsIllustration";
import { FPS } from "../timing";

type ProblemActProps = {
  painLines: string[];
};

/** Act 2 — marketplace pain + ProblemStory illustration accents. */
export const ProblemAct: React.FC<ProblemActProps> = ({ painLines }) => {
  const lineA = painLines[0] ?? "Ghosted. Overcharged. No-shows.";
  const lineB = painLines[1] ?? "Skilled — but invisible.";
  const half = 12 * FPS;

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Sequence from={0} durationInFrames={half + 15} name="pain-customers">
        <PainPanel
          caption={lineA}
          sub="Customers gamble on strangers."
          illustration={<PipeBurstIllustration />}
          glowX={48}
          glowY={40}
        />
      </Sequence>
      <Sequence from={half} durationInFrames={half + 30} name="pain-workers">
        <PainPanel
          caption={lineB}
          sub="Africa doesn’t lack skilled hands — it lacks a marketplace layer."
          illustration={<WaitingHandsIllustration />}
          glowX={52}
          glowY={36}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

const PainPanel: React.FC<{
  caption: string;
  sub: string;
  illustration: React.ReactNode;
  glowX: number;
  glowY: number;
}> = ({ caption, sub, illustration, glowX, glowY }) => {
  const frame = useCurrentFrame();
  const artOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const subOpacity = interpolate(frame, [36, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={glowX} glowY={glowY} intensity={0.11} />
      <FilmGrain opacity={0.04} />
      <AbsoluteFill
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: "80px 100px",
          gap: 64,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 520,
            opacity: artOpacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {illustration}
        </div>
        <div
          style={{
            flex: 1.1,
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <KineticLine
            name="PainCaption"
            text={caption}
            fontSize={58}
            stagger={3}
            enterFrom={8}
            maxWidth={820}
          />
          <div
            style={{
              opacity: subOpacity,
              fontFamily: bodyFont,
              fontWeight: 500,
              fontSize: 26,
              color: forge.muted,
              lineHeight: 1.45,
              maxWidth: 640,
            }}
          >
            {sub}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
