import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { forge } from "../../../brand";
import { FilmGrain } from "../components/FilmGrain";
import { KineticLine } from "../components/KineticLine";
import { bodyFont } from "../fonts";

/** Beat 2: the customer's need — bold kinetic question. */
export const Looking: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneIn = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.55, 0, 1, 0.45),
  });
  const barWidth = interpolate(frame, [28, 55], [0, 220], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const cameraDrift = interpolate(frame, [0, 150], [0, -18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
            "linear-gradient(115deg, #121212 0%, #1A1A1A 45%, #24180f 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          translate: `0px ${cameraDrift}px`,
          gap: 28,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Interactive.Div
          name="Looking label"
          style={{
            fontFamily: bodyFont,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            color: forge.orange,
            opacity: interpolate(frame, [4, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          customer
        </Interactive.Div>
        <KineticLine
          name="Looking headline"
          text="Looking for hands?"
          fontSize={118}
          stagger={1.6}
          enterFrom={8}
        />
        <Interactive.Div
          name="Looking accent"
          style={{
            width: barWidth,
            height: 5,
            backgroundColor: forge.orange,
            marginTop: 8,
          }}
        />
      </AbsoluteFill>
      <FilmGrain opacity={0.06} />
    </AbsoluteFill>
  );
};
