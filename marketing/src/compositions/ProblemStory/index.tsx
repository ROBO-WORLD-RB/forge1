import { Composition } from "remotion";
import { VIDEO_VERTICAL } from "../../brand";
import { waitForFonts } from "../../shared/fonts";
import { ProblemStory } from "./ProblemStory";
import { DURATION_FRAMES } from "./timing";

export { ProblemStory } from "./ProblemStory";
export { DURATION_FRAMES, DURATION_SECONDS } from "./timing";

export const ProblemStoryComposition: React.FC = () => {
  return (
    <Composition
      id="ProblemStory"
      component={ProblemStory}
      durationInFrames={DURATION_FRAMES}
      fps={VIDEO_VERTICAL.fps}
      width={VIDEO_VERTICAL.width}
      height={VIDEO_VERTICAL.height}
      calculateMetadata={async () => {
        await waitForFonts();
        return {};
      }}
    />
  );
};
