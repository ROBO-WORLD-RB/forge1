import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CaptionBar } from "../components/CaptionBar";
import { CtaPill } from "../components/CtaPill";
import { ForgeEmblem } from "../components/ForgeEmblem";
import { PhoneFrame } from "../components/PhoneFrame";
import { WorkerCard } from "../components/WorkerCard";
import { displayFont } from "../fonts";
import { reel } from "../theme";

/** Scene 3 — Brand resolve + CTA (local frames 0–900). */
export const LogoResolve: React.FC = () => {
  const frame = useCurrentFrame();

  const phoneScale = interpolate(frame, [0, 120], [1, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneBlur = interpolate(frame, [0, 120], [0, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneOpacity = interpolate(frame, [0, 100, 160], [1, 0.35, 0.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneY = interpolate(frame, [0, 120], [0, -40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [180, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, rgba(255,107,0,0.18), transparent 55%)`,
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: phoneOpacity,
          filter: `blur(${phoneBlur}px)`,
          transform: `translateY(${phoneY}px) scale(${phoneScale})`,
          zIndex: 1,
        }}
      >
        <PhoneFrame>
          <WorkerCard />
        </PhoneFrame>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          zIndex: 2,
          paddingBottom: 40,
        }}
      >
        <ForgeEmblem enterDelay={80} />
        <p
          style={{
            margin: 0,
            marginTop: 8,
            fontFamily: displayFont,
            fontSize: 32,
            fontWeight: 600,
            color: reel.muted,
            letterSpacing: "0.04em",
            opacity: taglineOpacity,
          }}
        >
          Where Work Meets Hands.
        </p>
        <div style={{ marginTop: 36 }}>
          <CtaPill enterAt={260} />
        </div>
      </AbsoluteFill>

      <CaptionBar
        text="FORGE. Where work meets hands. Get started at forge.app."
        enterFrom={220}
        holdUntil={820}
        exitBy={880}
        bottom="8%"
      />
    </AbsoluteFill>
  );
};
