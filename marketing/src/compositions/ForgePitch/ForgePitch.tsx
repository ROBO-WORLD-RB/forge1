import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { forge } from "../../brand";
import { CompanyLockup } from "../../shared/CompanyLockup";
import { AskAct } from "./acts/AskAct";
import { DiffAct } from "./acts/DiffAct";
import { HookAct } from "./acts/HookAct";
import { ProblemAct } from "./acts/ProblemAct";
import { ProductAct } from "./acts/ProductAct";
import { SolutionAct } from "./acts/SolutionAct";
import { TeamAct } from "./acts/TeamAct";
import type { ForgePitchProps } from "./schema";
import { fadeAct, sceneDurations } from "./timing";

/**
 * ForgePitch — horizontal investor narrative (~2:10).
 * Content comes from inputProps / stories JSON.
 */
export const ForgePitch: React.FC<ForgePitchProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sceneDurations.hook}>
          <HookAct
            line1={props.hookLine1}
            line2={props.hookLine2}
            markets={props.markets}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeAct} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.problem}>
          <ProblemAct painLines={props.painLines} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeAct} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.solution}>
          <SolutionAct
            loopSteps={props.loopSteps}
            tagline={props.tagline}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeAct} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.product}>
          <ProductAct
            featureLabels={props.featureLabels}
            url={props.url}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeAct} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.diff}>
          <DiffAct
            markets={props.markets}
            marketChips={props.marketChips}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeAct} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.team}>
          <TeamAct studio={props.studio} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={fadeAct} />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.ask}>
          <AskAct
            askAmount={props.askAmount}
            askUse={props.askUse}
            url={props.url}
            contactEmail={props.contactEmail}
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <CompanyLockup />
    </AbsoluteFill>
  );
};
