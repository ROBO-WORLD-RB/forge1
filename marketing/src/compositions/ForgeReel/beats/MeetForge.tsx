import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { KineticCaption } from "../components/KineticCaption";
import { reel } from "../theme";

export const MeetForge = () => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, 16], [0, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: `${width}%`,
            height: 6,
            borderRadius: 999,
            background: `linear-gradient(90deg, transparent, ${reel.orange}, ${reel.ember}, transparent)`,
            marginBottom: 48,
          }}
        />
      </AbsoluteFill>
      <KineticCaption text="Meet FORGE." accent="orange" size={84} />
    </AbsoluteFill>
  );
};
