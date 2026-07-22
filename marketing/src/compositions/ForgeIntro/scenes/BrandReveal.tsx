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
import { bodyFont, displayFont } from "../fonts";

/** Final beat: FORGE arrives as the answer — elegant, not explosive. */
export const BrandReveal: React.FC = () => {
  const frame = useCurrentFrame();

  const answerOpacity = interpolate(frame, [8, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  const wordOpacity = interpolate(frame, [28, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const wordY = interpolate(frame, [28, 62], [32, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const wordTrack = interpolate(frame, [28, 66], [0.28, 0.18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  const barWidth = interpolate(frame, [52, 88], [0, 168], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const punchOpacity = interpolate(frame, [78, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const punchY = interpolate(frame, [78, 110], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const marketOpacity = interpolate(frame, [140, 175], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowRise = interpolate(frame, [0, 80], [0.06, 0.16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill>
      <Atmosphere glowX={50} glowY={58} intensity={glowRise} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 26,
        }}
      >
        <Interactive.Div
          name="Answer label"
          style={{
            fontFamily: bodyFont,
            fontSize: 22,
            fontWeight: 600,
            color: forge.orange,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            opacity: answerOpacity,
            marginBottom: 8,
          }}
        >
          The answer is
        </Interactive.Div>

        <Interactive.Div
          name="FORGE lockup"
          style={{
            fontFamily: displayFont,
            fontSize: 168,
            color: forge.white,
            letterSpacing: `${wordTrack}em`,
            lineHeight: 1,
            opacity: wordOpacity,
            translate: `0px ${wordY}px`,
            paddingLeft: `${wordTrack}em`,
          }}
        >
          FORGE
        </Interactive.Div>

        <Interactive.Div
          name="Lockup accent"
          style={{
            width: barWidth,
            height: 5,
            backgroundColor: forge.orange,
            borderRadius: 3,
          }}
        />

        <Interactive.Div
          name="Punchline"
          style={{
            fontFamily: bodyFont,
            fontSize: 42,
            fontWeight: 600,
            color: forge.white,
            letterSpacing: "0.04em",
            opacity: punchOpacity,
            translate: `0px ${punchY}px`,
            marginTop: 10,
          }}
        >
          Where work meets hands.
        </Interactive.Div>

        <Interactive.Div
          name="Market tag"
          style={{
            fontFamily: bodyFont,
            fontSize: 24,
            fontWeight: 500,
            color: forge.muted,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: marketOpacity,
            marginTop: 18,
          }}
        >
          Ghana · Nigeria
        </Interactive.Div>
      </AbsoluteFill>

      <FilmGrain opacity={0.045} />
    </AbsoluteFill>
  );
};
