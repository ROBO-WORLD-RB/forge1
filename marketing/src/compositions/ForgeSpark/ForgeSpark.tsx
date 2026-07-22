import { AbsoluteFill, Sequence } from "remotion";
import { forge } from "../../brand";
import { FilmGrain } from "./components/FilmGrain";
import { BrandLockup } from "./scenes/BrandLockup";
import { EmberAwakens } from "./scenes/EmberAwakens";
import { Looking } from "./scenes/Looking";
import { MatchDraw } from "./scenes/MatchDraw";
import { Strike } from "./scenes/Strike";
import { TwoSides } from "./scenes/TwoSides";
import { scenes } from "./timing";

/**
 * ForgeSpark — trailer-style cold open for FORGE.
 * Curiosity first (ember → need → skill → match), brand last.
 */
export const ForgeSpark: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Sequence
        name="Ember awakens"
        from={scenes.ember.from}
        durationInFrames={scenes.ember.duration}
      >
        <EmberAwakens />
      </Sequence>

      <Sequence
        name="Looking for hands"
        from={scenes.looking.from}
        durationInFrames={scenes.looking.duration}
      >
        <Looking />
      </Sequence>

      <Sequence
        name="Two sides"
        from={scenes.handsReady.from}
        durationInFrames={scenes.handsReady.duration}
      >
        <TwoSides />
      </Sequence>

      <Sequence
        name="Match draw"
        from={scenes.matchDraw.from}
        durationInFrames={scenes.matchDraw.duration}
      >
        <MatchDraw />
      </Sequence>

      <Sequence
        name="Strike"
        from={scenes.strike.from}
        durationInFrames={scenes.strike.duration}
      >
        <Strike />
      </Sequence>

      <Sequence
        name="Brand lockup"
        from={scenes.lockup.from}
        durationInFrames={scenes.lockup.duration}
      >
        <BrandLockup />
      </Sequence>

      {/* Persistent grain veil for continuity across cuts */}
      <Sequence name="Grain veil" from={0} durationInFrames={scenes.lockup.from}>
        <FilmGrain opacity={0.03} />
      </Sequence>
    </AbsoluteFill>
  );
};
