import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont } from "../fonts";
import { reel } from "../theme";

export const LogoSlam = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 190 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: reel.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255,122,0,0.35), transparent 65%)`,
        }}
      />
      <div
        style={{
          fontFamily: displayFont,
          fontSize: 148,
          letterSpacing: "0.06em",
          color: reel.white,
          transform: `scale(${interpolate(slam, [0, 1], [1.45, 1])})`,
          opacity: interpolate(slam, [0, 0.12, 1], [0, 1, 1]),
          zIndex: 1,
        }}
      >
        FORGE
      </div>
    </AbsoluteFill>
  );
};
