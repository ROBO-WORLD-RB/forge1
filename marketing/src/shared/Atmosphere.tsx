import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../brand";

type AtmosphereProps = {
  /** Horizontal focus of the warm glow, 0–100 */
  glowX?: number;
  /** Vertical focus of the warm glow, 0–100 */
  glowY?: number;
  /** Peak orange presence (kept soft — never firework) */
  intensity?: number;
};

/** Quiet industrial dusk — breath of warmth, no particles. */
export const Atmosphere: React.FC<AtmosphereProps> = ({
  glowX = 50,
  glowY = 70,
  intensity = 0.12,
}) => {
  const frame = useCurrentFrame();
  const breath = interpolate(frame % 90, [0, 45, 90], [0.85, 1, 0.85], {
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(
            ellipse 75% 55% at ${glowX}% ${glowY}%,
            rgba(255, 122, 0, ${intensity * breath}) 0%,
            transparent 62%
          ),
          linear-gradient(180deg, #121212 0%, ${forge.navy} 48%, #14110c 100%)
        `,
      }}
    />
  );
};
