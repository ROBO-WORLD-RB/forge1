import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { forge } from "../../../brand";

type Spark = {
  angle: number;
  speed: number;
  size: number;
  delay: number;
  hueShift: number;
};

const SPARKS: Spark[] = Array.from({ length: 48 }, (_, i) => ({
  angle: (i / 48) * Math.PI * 2 + (i % 5) * 0.17,
  speed: 180 + (i % 7) * 55 + (i % 3) * 40,
  size: 2 + (i % 4) * 1.6,
  delay: (i % 8) * 1.5,
  hueShift: i % 3,
}));

type SparksProps = {
  /** Local frame when the burst should peak (usually 0 at sequence start). */
  burstAt?: number;
  count?: number;
  originX?: number;
  originY?: number;
};

/** Radial spark burst — forge metaphor for the moment of matching. */
export const Sparks: React.FC<SparksProps> = ({
  burstAt = 0,
  count = 48,
  originX = 960,
  originY = 540,
}) => {
  const frame = useCurrentFrame();
  const sparks = SPARKS.slice(0, count);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {sparks.map((spark, i) => {
        const local = frame - burstAt - spark.delay;
        const life = interpolate(local, [0, 28], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const fade = interpolate(local, [8, 36], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const dist = spark.speed * life;
        const x = originX + Math.cos(spark.angle) * dist;
        const y = originY + Math.sin(spark.angle) * dist - life * 40;
        const color =
          spark.hueShift === 0
            ? forge.orange
            : spark.hueShift === 1
              ? forge.ember
              : forge.spark;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: spark.size,
              height: spark.size * (1.8 + life * 2.2),
              borderRadius: spark.size,
              backgroundColor: color,
              opacity: fade * (local < 0 ? 0 : 1),
              boxShadow: `0 0 ${6 + spark.size * 2}px ${color}`,
              rotate: `${(spark.angle * 180) / Math.PI + 90}deg`,
              translate: "-50% -50%",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
