import { Composition } from "remotion";
import { VIDEO } from "../../brand";
import { waitForFonts } from "../../shared/fonts";
import { ForgePitch } from "./ForgePitch";
import { defaultForgePitchProps, forgePitchSchema } from "./schema";
import { DURATION_FRAMES } from "./timing";

export { ForgePitch } from "./ForgePitch";
export { DURATION_FRAMES, DURATION_SECONDS } from "./timing";
export {
  defaultForgePitchProps,
  forgePitchSchema,
  type ForgePitchProps,
} from "./schema";

export const ForgePitchComposition: React.FC = () => {
  return (
    <Composition
      id="ForgePitch"
      component={ForgePitch}
      durationInFrames={DURATION_FRAMES}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      schema={forgePitchSchema}
      defaultProps={defaultForgePitchProps}
      calculateMetadata={async () => {
        await waitForFonts();
        return {};
      }}
    />
  );
};
