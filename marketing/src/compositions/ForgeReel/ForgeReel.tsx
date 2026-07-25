import type { ComponentType } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BookTap } from "./beats/BookTap";
import { ChatReply } from "./beats/ChatReply";
import { ChatSlam } from "./beats/ChatSlam";
import { ClosingBeat } from "./beats/ClosingBeat";
import { CtaBeat } from "./beats/CtaBeat";
import { EscrowLock } from "./beats/EscrowLock";
import { GlitchCut } from "./beats/GlitchCut";
import { MeetForge } from "./beats/MeetForge";
import { ProfileReveal } from "./beats/ProfileReveal";
import { SearchType } from "./beats/SearchType";
import { StarsPop } from "./beats/StarsPop";
import { SwipeMatch } from "./beats/SwipeMatch";
import { TradesFlash } from "./beats/TradesFlash";
import { VerifiedSnap } from "./beats/VerifiedSnap";
import { KineticCaption } from "./components/KineticCaption";
import { beatTimeline } from "./timing";
import { reel } from "./theme";

const BEAT_COMPONENTS: Record<string, ComponentType> = {
  chatSlam: ChatSlam,
  captionPain: () => (
    <KineticCaption
      text="Ghosted. Overcharged. No-shows."
      accent="white"
      size={56}
      variant="ui"
    />
  ),
  glitch: GlitchCut,
  meetForge: MeetForge,
  searchType: SearchType,
  swipeMatch: SwipeMatch,
  profileReveal: ProfileReveal,
  verifiedSnap: VerifiedSnap,
  starsPop: StarsPop,
  escrowLock: EscrowLock,
  bookTap: BookTap,
  chatReply: ChatReply,
  tradesFlash: TradesFlash,
  cta: CtaBeat,
  closing: ClosingBeat,
};

/**
 * ForgeReel — kinetic vertical ad.
 * Every beat = 4s. Punchy story, interactive UI, brand type/color.
 */
export const ForgeReel = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      {beatTimeline.map((beat) => {
        const Comp = BEAT_COMPONENTS[beat.id];
        if (!Comp) return null;
        return (
          <Sequence
            key={beat.id}
            from={beat.from}
            durationInFrames={beat.duration}
            name={beat.id}
          >
            <Comp />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
