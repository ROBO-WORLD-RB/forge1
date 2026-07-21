import {
  AbsoluteFill,
  Composition,
  Easing,
  Interactive,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { forge, VIDEO } from "./brand";

const DURATION_FRAMES = 150;

const Wordmark: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Interactive.Div
      name="Wordmark"
      style={{
        color: forge.white,
        fontSize: 140,
        fontWeight: 800,
        letterSpacing: "0.14em",
        opacity: interpolate(frame, [0, 18], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate: interpolate(frame, [0, 22], ["0px 24px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      FORGE
    </Interactive.Div>
  );
};

const Tagline: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Interactive.Div
      name="Tagline"
      style={{
        color: forge.orange,
        fontSize: 40,
        fontWeight: 600,
        letterSpacing: "0.06em",
        marginTop: 32,
        opacity: interpolate(frame, [0, 16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      Hire skilled hands. Get it done.
    </Interactive.Div>
  );
};

export const BrandIntro: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: forge.navy,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Sequence name="Wordmark" from={0} durationInFrames={DURATION_FRAMES}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <Wordmark />
        </AbsoluteFill>
      </Sequence>
      <Sequence name="Tagline" from={36} durationInFrames={DURATION_FRAMES - 36}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            paddingTop: 180,
          }}
        >
          <Tagline />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export const BrandIntroComposition = () => {
  return (
    <Composition
      id="BrandIntro"
      component={BrandIntro}
      durationInFrames={DURATION_FRAMES}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};
