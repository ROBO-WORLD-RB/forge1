import { AbsoluteFill, Sequence } from "remotion";
import { DigitalEngine } from "./scenes/DigitalEngine";
import { Friction } from "./scenes/Friction";
import { LogoResolve } from "./scenes/LogoResolve";
import { reel } from "./theme";
import { scenes } from "./timing";

/**
 * ForgeReel — 45s vertical neon ad:
 * WhatsApp friction → verified worker phone → FORGE logo / CTA.
 */
export const ForgeReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      <Sequence
        from={scenes.friction.from}
        durationInFrames={scenes.friction.duration}
        name="Friction"
      >
        <Friction />
      </Sequence>
      <Sequence
        from={scenes.digital.from}
        durationInFrames={scenes.digital.duration}
        name="DigitalEngine"
      >
        <DigitalEngine />
      </Sequence>
      <Sequence
        from={scenes.resolve.from}
        durationInFrames={scenes.resolve.duration}
        name="LogoResolve"
      >
        <LogoResolve />
      </Sequence>
    </AbsoluteFill>
  );
};
