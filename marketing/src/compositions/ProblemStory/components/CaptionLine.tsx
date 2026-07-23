import { KineticLine } from "../../../shared/KineticLine";
import { forge } from "../../../brand";

type CaptionLineProps = {
  text: string;
  enterFrom?: number;
};

/** Vertical caption — smaller kinetic type below illustrations. */
export const CaptionLine: React.FC<CaptionLineProps> = ({
  text,
  enterFrom = 12,
}) => {
  return (
    <KineticLine
      name="Caption"
      text={text}
      variant="body"
      fontSize={40}
      color={forge.white}
      letterSpacing="0.03em"
      stagger={4}
      enterFrom={enterFrom}
      rise={20}
      maxWidth={880}
    />
  );
};
