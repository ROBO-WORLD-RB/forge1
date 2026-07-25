import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CaptionBar } from "../components/CaptionBar";
import { ChatBubble } from "../components/ChatBubble";
import { GlitchWipe } from "../components/GlitchWipe";
import { RedParticles } from "../components/RedParticles";
import { reel } from "../theme";

/** Scene 1 — WhatsApp friction (local frames 0–720). */
export const Friction: React.FC = () => {
  const frame = useCurrentFrame();

  // Mid-scene tease: slight opacity dip around frame 360
  const midDip = interpolate(
    frame,
    [340, 360, 390, 420],
    [1, 0.55, 0.7, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      <RedParticles />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 120,
        }}
      >
        <GlitchWipe start={640} duration={80}>
          <div style={{ opacity: midDip, width: "100%", display: "flex", justifyContent: "center" }}>
            <ChatBubble enterDelay={20} />
          </div>
        </GlitchWipe>
      </AbsoluteFill>
      <CaptionBar
        text="Stop gambling on random WhatsApp referrals."
        enterFrom={80}
        holdUntil={520}
        exitBy={620}
        bottom="14%"
      />
    </AbsoluteFill>
  );
};
