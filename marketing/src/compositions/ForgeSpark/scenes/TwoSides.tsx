import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { forge } from "../../../brand";
import { FilmGrain } from "../components/FilmGrain";
import { displayFont, bodyFont } from "../fonts";

/** Beat 3: need and skill face each other across the frame. */
export const TwoSides: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneIn = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOut = interpolate(frame, [135, 165], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leftX = interpolate(frame, [0, 28], [-120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const rightX = interpolate(frame, [10, 38], [120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const dividerScale = interpolate(frame, [20, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const pullIn = interpolate(frame, [90, 140], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: forge.navy,
        opacity: sceneIn * sceneOut,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, #141414 0%, #1A1A1A 50%, #1c140c 100%)",
        }}
      />

      {/* Center tension line */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 2,
            height: 420 * dividerScale,
            background: `linear-gradient(180deg, transparent, ${forge.orange}, transparent)`,
            opacity: 0.7,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 80,
          padding: "0 120px",
        }}
      >
        <Interactive.Div
          name="Need side"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 18,
            translate: `${leftX + pullIn}px 0px`,
            opacity: interpolate(frame, [0, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "0.38em",
              textTransform: "uppercase",
              color: forge.muted,
            }}
          >
            need
          </div>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 92,
              color: forge.white,
              letterSpacing: "0.02em",
              textAlign: "right",
              lineHeight: 1,
            }}
          >
            Need it done.
          </div>
        </Interactive.Div>

        <Interactive.Div
          name="Skill side"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 18,
            translate: `${rightX - pullIn}px 0px`,
            opacity: interpolate(frame, [10, 30], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "0.38em",
              textTransform: "uppercase",
              color: forge.orange,
            }}
          >
            skill
          </div>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 92,
              color: forge.white,
              letterSpacing: "0.02em",
              textAlign: "left",
              lineHeight: 1,
            }}
          >
            Hands ready.
          </div>
        </Interactive.Div>
      </AbsoluteFill>
      <FilmGrain opacity={0.06} />
    </AbsoluteFill>
  );
};
