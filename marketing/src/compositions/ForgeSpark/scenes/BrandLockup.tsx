import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { forge } from "../../../brand";
import { FilmGrain } from "../components/FilmGrain";
import { displayFont, bodyFont } from "../fonts";

/** Beat 6: calm after the strike — FORGE lockup + one-line punchline. */
export const BrandLockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.9 },
  });

  const wordOpacity = interpolate(enter, [0, 1], [0, 1]);
  const wordY = interpolate(enter, [0, 1], [36, 0]);
  const barWidth = interpolate(frame, [18, 48], [0, 160], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const punchOpacity = interpolate(frame, [36, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const punchY = interpolate(frame, [36, 58], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const emberBreath = interpolate(frame % 48, [0, 24, 48], [0.35, 0.55, 0.35]);
  const marketTag = interpolate(frame, [70, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% 60%, rgba(255,122,0,${0.14 * emberBreath}) 0%, transparent 60%),
            linear-gradient(180deg, #121212 0%, #1A1A1A 50%, #15110c 100%)
          `,
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <Interactive.Div
          name="FORGE lockup"
          style={{
            fontFamily: displayFont,
            fontSize: 168,
            color: forge.white,
            letterSpacing: "0.18em",
            lineHeight: 1,
            opacity: wordOpacity,
            translate: `0px ${wordY}px`,
            paddingLeft: "0.18em",
          }}
        >
          FORGE
        </Interactive.Div>

        <Interactive.Div
          name="Lockup accent"
          style={{
            width: barWidth,
            height: 6,
            backgroundColor: forge.orange,
            borderRadius: 3,
            boxShadow: `0 0 18px rgba(255,122,0,0.55)`,
          }}
        />

        <Interactive.Div
          name="Punchline"
          style={{
            fontFamily: bodyFont,
            fontSize: 44,
            fontWeight: 600,
            color: forge.white,
            letterSpacing: "0.04em",
            opacity: punchOpacity,
            translate: `0px ${punchY}px`,
            marginTop: 8,
          }}
        >
          Where work meets hands.
        </Interactive.Div>

        <Interactive.Div
          name="Market tag"
          style={{
            fontFamily: bodyFont,
            fontSize: 26,
            fontWeight: 500,
            color: forge.muted,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: marketTag,
            marginTop: 12,
          }}
        >
          Ghana · Nigeria
        </Interactive.Div>
      </AbsoluteFill>

      <FilmGrain opacity={0.05} />
    </AbsoluteFill>
  );
};
