import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../../../brand";
import { bodyFont, displayFont } from "../fonts";

type KineticLineProps = {
  text: string;
  name: string;
  /** Stagger per word in frames */
  stagger?: number;
  enterFrom?: number;
  fontSize?: number;
  color?: string;
  letterSpacing?: string;
  variant?: "display" | "body";
  /** Kept for API stability; always rendered center. */
  align?: "left" | "center" | "right";
  maxWidth?: number;
  /** Soft rise distance in px */
  rise?: number;
};

/** Word-staggered kinetic type — elegant, not chaotic. */
export const KineticLine: React.FC<KineticLineProps> = ({
  text,
  name,
  stagger = 5,
  enterFrom = 8,
  fontSize = 72,
  color = forge.white,
  letterSpacing = "0.02em",
  variant = "display",
  maxWidth = 1500,
  rise = 28,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <Interactive.Div
      name={name}
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        columnGap: "0.28em",
        rowGap: "0.12em",
        fontFamily: variant === "display" ? displayFont : bodyFont,
        fontSize,
        fontWeight: variant === "body" ? 500 : undefined,
        color,
        letterSpacing,
        lineHeight: 1.12,
        maxWidth,
        textAlign: "center",
        translate: "0px -34.6px",
      }}
    >
      {words.map((word, i) => {
        const start = enterFrom + i * stagger;
        const opacity = interpolate(frame, [start, start + 16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const y = interpolate(frame, [start, start + 18], [rise, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        });

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              opacity,
              translate: `0px ${y}px`,
            }}
          >
            {word}
          </span>
        );
      })}
    </Interactive.Div>
  );
};
