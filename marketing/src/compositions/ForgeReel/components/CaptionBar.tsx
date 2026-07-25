import { interpolate, useCurrentFrame } from "remotion";
import { displayFont, uiFont } from "../fonts";
import { reel } from "../theme";

type CaptionBarProps = {
  text: string;
  /** Local scene frame when caption starts fading in */
  enterFrom?: number;
  holdUntil?: number;
  exitBy?: number;
  bottom?: number | string;
};

export const CaptionBar: React.FC<CaptionBarProps> = ({
  text,
  enterFrom = 20,
  holdUntil = 200,
  exitBy = 280,
  bottom = "12%",
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [enterFrom, enterFrom + 24, holdUntil, exitBy],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const y = interpolate(frame, [enterFrom, enterFrom + 28], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "6%",
        right: "6%",
        bottom,
        opacity,
        transform: `translateY(${y}px)`,
        textAlign: "center",
        zIndex: 20,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: uiFont,
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1.35,
          color: reel.white,
          textShadow: `0 0 24px rgba(0, 242, 254, 0.35)`,
          letterSpacing: "0.01em",
        }}
      >
        {text}
      </p>
      <div
        style={{
          margin: "14px auto 0",
          width: 48,
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${reel.cyan}, transparent)`,
          fontFamily: displayFont,
        }}
      />
    </div>
  );
};
