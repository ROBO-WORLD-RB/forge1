import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { forge } from "../../../brand";
import { Atmosphere } from "../../../shared/Atmosphere";
import { FilmGrain } from "../../../shared/FilmGrain";
import { bodyFont } from "../../../shared/fonts";

/**
 * Closing plate — quiet credit after FORGE lands.
 * No fireworks; just a held breath of meaning.
 */
export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();

  const lineOpacity = interpolate(frame, [10, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const lineY = interpolate(frame, [10, 46], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const barWidth = interpolate(frame, [36, 72], [0, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const subOpacity = interpolate(frame, [58, 92], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const subY = interpolate(frame, [58, 96], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const hold = interpolate(frame, [120, 200], [1, 0.97], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Atmosphere glowX={50} glowY={52} intensity={0.07} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          opacity: hold,
        }}
      >
        <Interactive.Div
          name="End credit"
          style={{
            fontFamily: bodyFont,
            fontSize: 36,
            fontWeight: 600,
            color: forge.white,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            textAlign: "center",
            opacity: lineOpacity,
            translate: `0px ${lineY}px`,
            maxWidth: 1400,
            lineHeight: 1.35,
          }}
        >
          Built by Intelligent Systems
        </Interactive.Div>

        <Interactive.Div
          name="End accent"
          style={{
            width: barWidth,
            height: 3,
            backgroundColor: forge.orange,
            borderRadius: 2,
            opacity: lineOpacity,
          }}
        />

        <Interactive.Div
          name="End tagline"
          style={{
            fontFamily: bodyFont,
            fontSize: 30,
            fontWeight: 500,
            color: "rgba(255, 255, 255, 0.94)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            textAlign: "center",
            opacity: subOpacity,
            translate: `0px ${subY}px`,
          }}
        >
          By Africa & For Africa
        </Interactive.Div>
      </AbsoluteFill>

      <FilmGrain opacity={0.04} />
    </AbsoluteFill>
  );
};
