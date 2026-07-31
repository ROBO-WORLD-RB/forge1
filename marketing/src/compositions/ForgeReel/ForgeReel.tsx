import type { ComponentType } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
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
import { ReelPropsProvider, useReelProps } from "./ReelPropsContext";
import type { ForgeReelProps } from "./schema";
import { beatTimeline, REEL_AUDIO } from "./timing";
import { reel } from "./theme";

const CaptionPain = () => {
  const { painCaption } = useReelProps();
  return (
    <KineticCaption
      text={painCaption}
      accent="white"
      size={56}
      variant="ui"
    />
  );
};

const BEAT_COMPONENTS: Record<string, ComponentType> = {
  chatSlam: ChatSlam,
  captionPain: CaptionPain,
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
 * Copy/names driven by inputProps (stories JSON).
 */
export const ForgeReel: React.FC<ForgeReelProps> = (props) => {
  return (
    <ReelPropsProvider value={props}>
      <AbsoluteFill style={{ backgroundColor: reel.bg }}>
        <Audio src={staticFile(REEL_AUDIO)} />
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
    </ReelPropsProvider>
  );
};
