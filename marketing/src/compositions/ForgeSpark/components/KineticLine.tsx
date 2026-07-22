import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { bodyFont, displayFont } from "../fonts";
import { forge } from "../../../brand";

type KineticLineProps = {
  text: string;
  name: string;
  /** Stagger per character in frames */
  stagger?: number;
  enterFrom?: number;
  fontSize?: number;
  color?: string;
  letterSpacing?: string;
  variant?: "display" | "body";
  align?: "left" | "center" | "right";
};

/** Character-staggered kinetic type — trailer energy without emoji spam. */
export const KineticLine: React.FC<KineticLineProps> = ({
  text,
  name,
  stagger = 2,
  enterFrom = 0,
  fontSize = 96,
  color = forge.white,
  letterSpacing = "0.04em",
  variant = "display",
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const chars = text.split("");

  return (
    <Interactive.Div
      name={name}
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent:
          align === "left"
            ? "flex-start"
            : align === "right"
              ? "flex-end"
              : "center",
        fontFamily: variant === "display" ? displayFont : bodyFont,
        fontSize,
        color,
        letterSpacing,
        lineHeight: 1.05,
        maxWidth: 1600,
      }}
    >
      {chars.map((char, i) => {
        const start = enterFrom + i * stagger;
        const opacity = interpolate(frame, [start, start + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const y = interpolate(frame, [start, start + 12], [48, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        });
        const blur = interpolate(frame, [start, start + 10], [8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <span
            key={`${char}-${i}`}
            style={{
              display: "inline-block",
              opacity,
              translate: `0px ${y}px`,
              filter: `blur(${blur}px)`,
              whiteSpace: char === " " ? "pre" : undefined,
              minWidth: char === " " ? "0.28em" : undefined,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </Interactive.Div>
  );
};
