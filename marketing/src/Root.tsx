import "./index.css";
import { BrandIntroComposition } from "./BrandIntro";
import { HelloForgeComposition } from "./HelloForge";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <HelloForgeComposition />
      <BrandIntroComposition />
    </>
  );
};
