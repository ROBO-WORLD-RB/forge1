import { AbsoluteFill, Img, useCurrentFrame } from "remotion";

const GRAIN_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>`,
)}`;

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
        overflow: "hidden",
      }}
    >
      <Img
        src={GRAIN_SVG}
        style={{
          position: "absolute",
          width: "200%",
          height: "200%",
          left: `${-offsetX}px`,
          top: `${-offsetY}px`,
          objectFit: "cover",
        }}
      />
    </AbsoluteFill>
  );
};
