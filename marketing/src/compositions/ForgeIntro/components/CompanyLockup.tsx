import { AbsoluteFill, Interactive } from "remotion";
import { forge } from "../../../brand";
import { bodyFont } from "../fonts";

/**
 * Persistent top-center parent brand —
 * elegant, small enough not to compete with the questions.
 */
export const CompanyLockup: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <Interactive.Div
        name="Company"
        style={{
          position: "absolute",
          top: 48,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: bodyFont,
          fontSize: 18,
          fontWeight: 600,
          color: forge.muted,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        INTELLIGENT SYSTEMS
      </Interactive.Div>
    </AbsoluteFill>
  );
};
