import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaptionBar } from "../components/CaptionBar";
import { CyanBeam } from "../components/CyanBeam";
import { PhoneFrame } from "../components/PhoneFrame";
import { WorkerCard } from "../components/WorkerCard";
import { reel } from "../theme";

/** Scene 2 — Phone + worker card (local frames 0–1080). */
export const DigitalEngine: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneIn = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  const translateY = interpolate(phoneIn, [0, 1], [420, 0]);
  const phoneOpacity = interpolate(phoneIn, [0, 0.2, 1], [0, 1, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 40%, rgba(0,242,254,0.1), transparent 60%)`,
        }}
      />
      <CyanBeam duration={36} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 80,
        }}
      >
        <div
          style={{
            transform: `translateY(${translateY}px)`,
            opacity: phoneOpacity,
          }}
        >
          <PhoneFrame>
            <WorkerCard />
          </PhoneFrame>
        </div>
      </AbsoluteFill>
      <CaptionBar
        text="Meet FORGE. Real pros, verified skills, escrow-backed payments."
        enterFrom={80}
        holdUntil={900}
        exitBy={1020}
        bottom="6%"
      />
    </AbsoluteFill>
  );
};
