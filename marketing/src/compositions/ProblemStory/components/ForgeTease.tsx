import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { Atmosphere } from "../../../shared/Atmosphere";
import { FilmGrain } from "../../../shared/FilmGrain";
import { bodyFont, displayFont } from "../../../shared/fonts";
import { forge } from "../../../brand";

/** End beat: FORGE wordmark + tagline — light tease, not full brand reveal. */
export const ForgeTease: React.FC = () => {
  const frame = useCurrentFrame();

  const wordOpacity = interpolate(frame, [12, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const wordY = interpolate(frame, [12, 44], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const wordTrack = interpolate(frame, [12, 48], [0.24, 0.16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  const barWidth = interpolate(frame, [36, 68], [0, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const tagOpacity = interpolate(frame, [52, 82], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const tagY = interpolate(frame, [52, 82], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const marketOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowRise = interpolate(frame, [0, 60], [0.08, 0.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={50} glowY={55} intensity={glowRise} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
          paddingLeft: 80,
          paddingRight: 80,
        }}
      >
        <Interactive.Div
          name="FORGE wordmark"
          style={{
            fontFamily: displayFont,
            fontSize: 112,
            color: forge.white,
            letterSpacing: `${wordTrack}em`,
            lineHeight: 1,
            textAlign: "center",
            opacity: wordOpacity,
            translate: `0px ${wordY}px`,
            paddingLeft: `${wordTrack}em`,
          }}
        >
          FORGE
        </Interactive.Div>

        <Interactive.Div
          name="Tease accent"
          style={{
            width: barWidth,
            height: 4,
            backgroundColor: forge.orange,
            borderRadius: 2,
          }}
        />

        <Interactive.Div
          name="Tease tagline"
          style={{
            fontFamily: bodyFont,
            fontSize: 38,
            fontWeight: 600,
            color: forge.white,
            letterSpacing: "0.04em",
            textAlign: "center",
            opacity: tagOpacity,
            translate: `0px ${tagY}px`,
            marginTop: 8,
          }}
        >
          Where work meets hands.
        </Interactive.Div>

        <Interactive.Div
          name="Markets"
          style={{
            fontFamily: bodyFont,
            fontSize: 22,
            fontWeight: 500,
            color: forge.muted,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            textAlign: "center",
            opacity: marketOpacity,
            marginTop: 16,
          }}
        >
          Ghana · Nigeria · Togo
        </Interactive.Div>
      </AbsoluteFill>

      <FilmGrain opacity={0.045} />
    </AbsoluteFill>
  );
};
