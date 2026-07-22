import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { forge } from "../../brand";
import {
  fadeBrand,
  fadeEnd,
  fadeHold,
  fadeSoft,
  sceneDurations,
} from "./timing";
import { CompanyLockup } from "./components/CompanyLockup";
import { BrandReveal } from "./scenes/BrandReveal";
import { EndCard } from "./scenes/EndCard";
import { NeedAnswer } from "./scenes/NeedAnswer";
import { Question } from "./scenes/Question";

/**
 * ForgeIntro — questions that need an answer, then FORGE, then a quiet close.
 * Curiosity first, brand last. No fireworks. Soft transitions only.
 */
export const ForgeIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sceneDurations.q1}>
          <Question
            line="Who do you call when the pipe bursts?"
            whisper="2 a.m. Water on the floor. No name in your phone."
            layout="center"
            glowX={48}
            glowY={74}
            intensity={0.14}
            fontSize={76}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={fadeSoft}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.q2}>
          <Question
            line="Who rebuilds what the rains undo?"
            layout="center"
            glowX={50}
            glowY={60}
            intensity={0.1}
            fontSize={80}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={fadeSoft}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.q3}>
          <Question
            line="How do you find someone you can trust?"
            whisper="Not a stranger. Not a gamble."
            layout="center"
            glowX={55}
            glowY={50}
            intensity={0.09}
            fontSize={72}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={fadeSoft}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.q4}>
          <Question
            line="And who is still looking for work worth doing?"
            layout="center"
            glowX={50}
            glowY={68}
            intensity={0.11}
            fontSize={70}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={fadeSoft}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.q5}>
          <Question
            line="Where do skilled hands and real work meet?"
            layout="low"
            glowX={50}
            glowY={40}
            intensity={0.08}
            fontSize={68}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={fadeHold}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.need}>
          <NeedAnswer />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={fadeBrand}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.brand}>
          <BrandReveal />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={fadeEnd}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDurations.end}>
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* After TransitionSeries so opaque scene plates cannot bury the lockup. */}
      <CompanyLockup />
    </AbsoluteFill>
  );
};
