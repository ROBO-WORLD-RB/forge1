import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { uiFont } from "../fonts";
import { reel } from "../theme";

type CtaPillProps = {
  enterAt?: number;
};

export const CtaPill: React.FC<CtaPillProps> = ({ enterAt = 90 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, frame - enterAt),
    fps,
    config: { damping: 14, stiffness: 110 },
  });
  const pulse = interpolate(frame % 50, [0, 25, 50], [0.7, 1, 0.7]);

  return (
    <div
      style={{
        transform: `scale(${interpolate(enter, [0, 1], [0.85, 1])}) translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
        opacity: enter,
        padding: "18px 36px",
        borderRadius: 999,
        border: `2px solid ${reel.cyan}`,
        background: "rgba(0, 242, 254, 0.12)",
        boxShadow: `0 0 ${28 * pulse}px rgba(0, 242, 254, ${0.45 * pulse}), inset 0 0 20px rgba(0, 242, 254, 0.1)`,
        fontFamily: uiFont,
        fontWeight: 700,
        fontSize: 24,
        color: reel.white,
        letterSpacing: "0.02em",
        textAlign: "center",
      }}
    >
      Visit forge.app — Open Web App
    </div>
  );
};
