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

/**
 * Beat of silence after the questions —
 * tension held, then the line that names the need.
 */
export const NeedAnswer: React.FC = () => {
  const frame = useCurrentFrame();

  // Long breath in the dark before the line appears
  const lineIn = 72;
  const opacity = interpolate(frame, [lineIn, lineIn + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const y = interpolate(frame, [lineIn, lineIn + 32], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const barWidth = interpolate(frame, [lineIn + 20, lineIn + 55], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const holdPulse = interpolate(
    frame,
    [lineIn + 60, lineIn + 120, lineIn + 180],
    [1, 0.92, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.45, 0, 0.55, 1),
    },
  );

  // Soft vignette deepen during the pause
  const veil = interpolate(frame, [0, 60], [0, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Atmosphere glowX={50} glowY={55} intensity={0.05} />

      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(0,0,0,${veil}) 100%)`,
        }}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 32,
        }}
      >
        <Interactive.Div
          name="Need answer"
          style={{
            fontFamily: displayFont,
            fontSize: 64,
            color: forge.white,
            letterSpacing: "0.08em",
            opacity: opacity * holdPulse,
            translate: `0px ${y}px`,
            textAlign: "center",
          }}
        >
          You need an answer.
        </Interactive.Div>

        <Interactive.Div
          name="Need accent"
          style={{
            width: barWidth,
            height: 3,
            backgroundColor: forge.orange,
            borderRadius: 2,
            opacity,
          }}
        />

        <Interactive.Div
          name="Need sub"
          style={{
            fontFamily: bodyFont,
            fontSize: 24,
            fontWeight: 500,
            color: forge.muted,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: interpolate(frame, [lineIn + 40, lineIn + 70], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Not another listing.
        </Interactive.Div>
      </AbsoluteFill>

      <FilmGrain opacity={0.04} />
    </AbsoluteFill>
  );
};
