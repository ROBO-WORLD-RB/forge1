import type { ComponentType } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ChaosCalls } from "./acts/ChaosCalls";
import { EndCard } from "./acts/EndCard";
import { ForgeFlip } from "./acts/ForgeFlip";
import { LightsOn } from "./acts/LightsOn";
import { MeltingMoney } from "./acts/MeltingMoney";
import { PowerDies } from "./acts/PowerDies";
import { actTimeline } from "./timing";
import { blackout } from "./theme";

const ACT_COMPONENTS: Record<string, ComponentType> = {
  powerDies: PowerDies,
  meltingMoney: MeltingMoney,
  chaosCalls: ChaosCalls,
  forgeFlip: ForgeFlip,
  lightsOn: LightsOn,
  endCard: EndCard,
};

/**
 * BLACKOUT — hardcore 60s vertical trailer.
 * Night outage → melting stock → chaos calls → FORGE → lights on → end card.
 */
export const Blackout: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: blackout.bg }}>
      {actTimeline.map((act) => {
        const Comp = ACT_COMPONENTS[act.id];
        if (!Comp) return null;
        return (
          <Sequence
            key={act.id}
            from={act.from}
            durationInFrames={act.duration}
            name={act.id}
          >
            <Comp />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
