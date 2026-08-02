import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, uiFont } from "../fonts";
import { blackout } from "../theme";

type SlamTypeProps = {
  text: string;
  color?: string;
  size?: number;
  delay?: number;
  variant?: "display" | "ui";
  shake?: boolean;
  align?: "center" | "left";
};

/** Aggressive spring slam — overshoot + optional micro-shake. */
export const SlamType = ({
  text,
  color = blackout.white,
  size = 72,
  delay = 0,
  variant = "display",
  shake = false,
  align = "center",
}: SlamTypeProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const enter = spring({
    frame: local,
    fps,
    config: { damping: 11, stiffness: 220, mass: 0.7 },
  });
  const scale = interpolate(enter, [0, 1], [1.55, 1]);
  const y = interpolate(enter, [0, 1], [48, 0]);
  const opacity = interpolate(local, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const jitter =
    shake && local < 18
      ? Math.sin(local * 3.8) * interpolate(local, [0, 18], [10, 0])
      : 0;

  return (
    <div
      style={{
        fontFamily: variant === "display" ? displayFont : uiFont,
        fontWeight: variant === "ui" ? 800 : 400,
        fontSize: size,
        lineHeight: 0.95,
        letterSpacing: variant === "display" ? "0.02em" : "-0.02em",
        color,
        textAlign: align,
        textTransform: "uppercase",
        opacity,
        transform: `translate(${jitter}px, ${y}px) scale(${scale})`,
        WebkitFontSmoothing: "antialiased",
        textRendering: "geometricPrecision",
        textShadow:
          color === blackout.orange
            ? `0 0 40px rgba(255,122,0,0.45)`
            : `0 4px 0 rgba(0,0,0,0.55)`,
      }}
    >
      {text}
    </div>
  );
};

type FullSlamProps = SlamTypeProps & {
  sub?: string;
  bg?: string;
};

/** Full-bleed slam caption beat helper. */
export const FullSlam = ({
  text,
  sub,
  bg = blackout.bg,
  ...rest
}: FullSlamProps) => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [0, 4, 10], [0.55, 0.12, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 48px",
        gap: 20,
      }}
    >
      <SlamType text={text} shake {...rest} />
      {sub ? (
        <SlamType
          text={sub}
          size={34}
          delay={8}
          variant="ui"
          color={blackout.muted}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background: blackout.white,
          opacity: flash,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
