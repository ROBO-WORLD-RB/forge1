import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { forge } from "../../../brand";
import { Atmosphere } from "../components/Atmosphere";
import { FilmGrain } from "../components/FilmGrain";
import { KineticLine } from "../components/KineticLine";
import { bodyFont } from "../fonts";

export type QuestionLayout = "center" | "low";

type QuestionProps = {
  line: string;
  /** Optional quieter second line */
  whisper?: string;
  layout?: QuestionLayout;
  glowX?: number;
  glowY?: number;
  intensity?: number;
  fontSize?: number;
};

/** One unanswered question — a single thought on a quiet frame. */
export const Question: React.FC<QuestionProps> = ({
  line,
  whisper,
  layout = "center",
  glowX = 50,
  glowY = 72,
  intensity = 0.1,
  fontSize = 78,
}) => {
  const frame = useCurrentFrame();

  const markOpacity = interpolate(frame, [4, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const markWidth = interpolate(frame, [4, 28], [0, 56], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const whisperStart = 8 + line.split(" ").length * 5 + 18;
  const whisperOpacity = interpolate(
    frame,
    [whisperStart, whisperStart + 20],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.45, 0, 0.55, 1),
    },
  );
  const whisperY = interpolate(
    frame,
    [whisperStart, whisperStart + 22],
    [14, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    },
  );

  return (
    <AbsoluteFill>
      <Atmosphere glowX={glowX} glowY={glowY} intensity={intensity} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: layout === "low" ? "flex-end" : "center",
          alignItems: "center",
          paddingLeft: 120,
          paddingRight: 120,
          paddingBottom: layout === "low" ? 160 : 0,
          gap: 28,
        }}
      >
        <Interactive.Div
          name="Question mark"
          style={{
            width: markWidth,
            height: 4,
            backgroundColor: forge.orange,
            borderRadius: 2,
            opacity: markOpacity,
            alignSelf: "center",
          }}
        />

        <KineticLine
          name="Question"
          text={line}
          align="center"
          fontSize={fontSize}
          stagger={5}
          enterFrom={10}
          rise={24}
        />

        {whisper ? (
          <Interactive.Div
            name="Whisper"
            style={{
              fontFamily: bodyFont,
              fontSize: 28,
              fontWeight: 500,
              color: forge.muted,
              letterSpacing: "0.06em",
              opacity: whisperOpacity,
              translate: `0px ${whisperY}px`,
              maxWidth: 900,
              textAlign: "center",
            }}
          >
            {whisper}
          </Interactive.Div>
        ) : null}
      </AbsoluteFill>

      <FilmGrain opacity={0.035} />
    </AbsoluteFill>
  );
};
