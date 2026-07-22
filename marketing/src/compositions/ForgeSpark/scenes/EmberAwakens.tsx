import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../../../brand";
import { Ember } from "../components/Ember";
import { FilmGrain } from "../components/FilmGrain";
import { bodyFont } from "../fonts";

/** Cold open: darkness, one ember — curiosity before brand. */
export const EmberAwakens: React.FC = () => {
  const frame = useCurrentFrame();

  const vignette = interpolate(frame, [0, 40], [0.55, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const whisper = interpolate(frame, [36, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const whisperOut = interpolate(frame, [72, 88], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      {/* Heat wash rising from bottom */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255,122,0,${0.12 * vignette}) 0%, transparent 70%)`,
        }}
      />
      <Ember />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 120,
          opacity: whisper * whisperOut,
        }}
      >
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: forge.muted,
          }}
        >
          something needs doing
        </div>
      </AbsoluteFill>
      <FilmGrain opacity={0.09} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at center, transparent 20%, rgba(0,0,0,${vignette}) 100%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
