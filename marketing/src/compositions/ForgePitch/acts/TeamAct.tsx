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

type TeamActProps = {
  studio: string;
};

/** Act 6 — ClosingBeat-style Intelligent Systems credit. */
export const TeamAct: React.FC<TeamActProps> = ({ studio }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 130 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={50} glowY={55} intensity={0.09} />
      <FilmGrain opacity={0.035} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 56,
          gap: 28,
        }}
      >
        <div
          style={{
            width: 64,
            height: 4,
            borderRadius: 999,
            background: forge.orange,
            opacity: interpolate(enter, [0, 1], [0, 1]),
            transform: `scaleX(${interpolate(enter, [0, 1], [0.3, 1])})`,
          }}
        />
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 700,
            fontSize: 20,
            color: forge.muted,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            opacity: interpolate(frame, [10, 30], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Built by
        </div>
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 72,
            color: forge.white,
            letterSpacing: "0.04em",
            textAlign: "center",
            lineHeight: 1.1,
            opacity: interpolate(enter, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
          }}
        >
          {studio}
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 700,
            fontSize: 34,
            color: forge.orange,
            textAlign: "center",
            marginTop: 8,
            opacity: interpolate(frame, [40, 70], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          By Africa. For Africa.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
