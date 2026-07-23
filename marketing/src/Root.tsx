import "./index.css";
import { BrandIntroComposition } from "./BrandIntro";
import { ForgeIntroComposition } from "./compositions/ForgeIntro";
import { HelloForgeComposition } from "./HelloForge";
import { ProblemStoryComposition } from "./compositions/ProblemStory";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ForgeIntroComposition />
      <ProblemStoryComposition />
      <HelloForgeComposition />
      <BrandIntroComposition />
    </>
  );
};
