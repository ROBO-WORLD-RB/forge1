import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont } from "../fonts";
import { reel } from "../theme";

type ForgeEmblemProps = {
  enterDelay?: number;
};

export const ForgeEmblem: React.FC<ForgeEmblemProps> = ({ enterDelay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: Math.max(0, frame - enterDelay),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const glow = interpolate(frame % 90, [0, 45, 90], [0.55, 1, 0.55]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `scale(${interpolate(enter, [0, 1], [0.55, 1])})`,
        opacity: interpolate(enter, [0, 0.2, 1], [0, 1, 1]),
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255, 107, 0, ${0.35 * glow}) 0%, transparent 68%)`,
          filter: "blur(8px)",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          fontFamily: displayFont,
          fontWeight: 900,
          fontSize: 120,
          letterSpacing: "0.06em",
          color: reel.white,
          textShadow: `
            0 0 1px ${reel.cyan},
            0 0 2px ${reel.cyan},
            1px 0 0 ${reel.cyan},
            -1px 0 0 ${reel.cyan},
            0 1px 0 ${reel.cyan},
            0 -1px 0 ${reel.cyan},
            0 0 40px rgba(255, 107, 0, 0.55)
          `,
          lineHeight: 1,
        }}
      >
        FORGE
      </div>
    </div>
  );
};
