import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { forge } from "../../brand";
import { CompanyLockup } from "../../shared/CompanyLockup";
import { fadeBeat, sceneDurations } from "./timing";
import { ForgeTease } from "./components/ForgeTease";
import { ProblemBeat } from "./components/ProblemBeat";
import { PipeBurstIllustration } from "./components/illustrations/PipeBurstIllustration";
import { RainUndoIllustration } from "./components/illustrations/RainUndoIllustration";
import { TrustCrossroadsIllustration } from "./components/illustrations/TrustCrossroadsIllustration";
import { WaitingHandsIllustration } from "./components/illustrations/WaitingHandsIllustration";

/**
 * ProblemStory — vertical problem narrative for TikTok/Reels.
 * Shows the problems FORGE solves; ends with a light wordmark tease.
 *
 * Audio slot (deferred v1):
 * import { Audio } from "@remotion/media";
 * import { staticFile } from "remotion";
 * <Audio src={staticFile("audio/problem-story-bed.wav")} volume={0.4} />
 */
export const ProblemStory: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sceneDurations.pipe}>
          <ProblemBeat
            caption="2 a.m. The pipe bursts."
            illustration={<PipeBurstIllustration />}
            glowX={48}
            glowY={36}
            intensity={0.13}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeBeat} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.rain}>
          <ProblemBeat
            caption="The rains undo what you fixed."
            illustration={<RainUndoIllustration />}
            glowX={50}
            glowY={34}
            intensity={0.11}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeBeat} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.trust}>
          <ProblemBeat
            caption="Who can you really trust?"
            illustration={<TrustCrossroadsIllustration />}
            glowX={52}
            glowY={32}
            intensity={0.1}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeBeat} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.hands}>
          <ProblemBeat
            caption="Skilled hands. Nowhere to go."
            illustration={<WaitingHandsIllustration />}
            glowX={50}
            glowY={38}
            intensity={0.11}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeBeat} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.tease}>
          <ForgeTease />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <CompanyLockup />
    </AbsoluteFill>
  );
};
