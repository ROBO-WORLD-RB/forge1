import {
  AbsoluteFill,
  Composition,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { forge, VIDEO } from "./brand";

const DURATION_FRAMES = 90;

export const HelloForge: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const scale = interpolate(frame, [0, 24], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const barWidth = interpolate(frame, [18, 48], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: forge.navy,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Interactive.Div
        name="HelloForge mark"
        style={{
          opacity,
          scale,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <Interactive.Div
          name="Brand wordmark"
          style={{
            color: forge.white,
            fontSize: 120,
            fontWeight: 800,
            letterSpacing: "0.12em",
            lineHeight: 1,
          }}
        >
          FORGE
        </Interactive.Div>
        <Interactive.Div
          name="Accent bar"
          style={{
            width: barWidth,
            height: 6,
            backgroundColor: forge.orange,
            borderRadius: 3,
          }}
        />
        <Interactive.Div
          name="Hello line"
          style={{
            color: forge.muted,
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "0.04em",
            opacity: interpolate(frame, [28, 50], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Marketplace motion
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const HelloForgeComposition = () => {
  return (
    <Composition
      id="HelloForge"
      component={HelloForge}
      durationInFrames={DURATION_FRAMES}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};
