import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { forge } from "../../../brand";
import { Atmosphere } from "../../../shared/Atmosphere";
import { FilmGrain } from "../../../shared/FilmGrain";
import { KineticLine } from "../../../shared/KineticLine";
import { bodyFont } from "../../../shared/fonts";

type HookActProps = {
  line1: string;
  line2: string;
  markets: string[];
};

/** Act 1 — continent vs WhatsApp hiring. */
export const HookAct: React.FC<HookActProps> = ({
  line1,
  line2,
  markets,
}) => {
  const frame = useCurrentFrame();
  const line2Opacity = interpolate(frame, [48, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const marketsOpacity = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={46} glowY={68} intensity={0.12} />
      <FilmGrain opacity={0.04} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 120px",
          gap: 36,
        }}
      >
        <KineticLine
          name="HookLine1"
          text={line1}
          fontSize={78}
          stagger={4}
          enterFrom={6}
          maxWidth={1600}
        />
        <div style={{ opacity: line2Opacity, width: "100%" }}>
          <KineticLine
            name="HookLine2"
            text={line2}
            fontSize={56}
            color={forge.orange}
            variant="body"
            stagger={3}
            enterFrom={0}
            maxWidth={1500}
          />
        </div>
        <div
          style={{
            opacity: marketsOpacity,
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 22,
            color: forge.muted,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: 12,
          }}
        >
          {markets.join("  ·  ")}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
