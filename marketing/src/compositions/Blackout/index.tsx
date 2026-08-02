import { Composition } from "remotion";
import { VIDEO_VERTICAL_60 } from "../../brand";
import { Blackout } from "./Blackout";
import { waitForFonts } from "./fonts";
import { DURATION_FRAMES } from "./timing";

export { Blackout } from "./Blackout";
export { DURATION_FRAMES, DURATION_SECONDS } from "./timing";

export const BlackoutComposition: React.FC = () => {
  return (
    <Composition
      id="Blackout"
      component={Blackout}
      durationInFrames={DURATION_FRAMES}
      fps={VIDEO_VERTICAL_60.fps}
      width={VIDEO_VERTICAL_60.width}
      height={VIDEO_VERTICAL_60.height}
      calculateMetadata={async () => {
        await waitForFonts();
        return {};
      }}
    />
  );
};
