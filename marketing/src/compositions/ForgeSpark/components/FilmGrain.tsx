import { AbsoluteFill, useCurrentFrame } from "remotion";

/** Subtle animated grain — industrial film texture, not noise for noise's sake. */
export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const offsetX = (frame * 17) % 120;
  const offsetY = (frame * 11) % 120;

  return (
    <AbsoluteFill
      style={{
        opacity,
        pointerEvents: "none",
        mixBlendMode: "overlay",
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>`,
        )}")`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        backgroundSize: "160px 160px",
      }}
    />
  );
};
