import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ChromaticGlitch, ImpactFlash } from "../components/ImpactFlash";
import { SlamType } from "../components/SlamType";
import { displayFont, uiFont } from "../fonts";
import { blackout } from "../theme";

type Cut = {
  from: number;
  until: number;
  label: string;
  sub: string;
  accent: string;
};

const CUTS: Cut[] = [
  {
    from: 0,
    until: 120,
    label: "CALLING…",
    sub: "Neighbour's cousin's guy",
    accent: blackout.white,
  },
  {
    from: 120,
    until: 240,
    label: "WRONG GUY",
    sub: "He does generators. Not wiring.",
    accent: blackout.red,
  },
  {
    from: 240,
    until: 390,
    label: '"TOMORROW"',
    sub: "Maybe. If fuel. If traffic.",
    accent: blackout.ember,
  },
  {
    from: 390,
    until: 540,
    label: "CASH FIGHT",
    sub: "Half now. No receipt. No trust.",
    accent: blackout.red,
  },
  {
    from: 540,
    until: 720,
    label: "STILL DARK",
    sub: "The old way fails at night.",
    accent: blackout.white,
  },
];

/** Frantic old-way montage — hard cuts, red flash, slam type. */
export const ChaosCalls = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cut = CUTS.find((c) => frame >= c.from && frame < c.until) ?? CUTS[0];
  const local = frame - cut.from;

  const slam = spring({
    frame: local,
    fps,
    config: { damping: 10, stiffness: 240, mass: 0.65 },
  });

  const ringPulse =
    cut.from === 0
      ? interpolate(local % 30, [0, 15, 30], [1, 1.08, 1])
      : 1;

  const redHit =
    cut.accent === blackout.red
      ? interpolate(local, [0, 3, 14], [0.55, 0.25, 0], {
          extrapolateRight: "clamp",
        })
      : 0;

  const dialDigits = "● ● ●  ·  RINGING";

  return (
    <AbsoluteFill style={{ backgroundColor: blackout.bg, overflow: "hidden" }}>
      {/* Hard red wash on painful cuts */}
      <AbsoluteFill
        style={{
          background: blackout.red,
          opacity: redHit,
          mixBlendMode: "multiply",
        }}
      />

      {/* Scanlines */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(255,255,255,0.03) 3px,
            rgba(255,255,255,0.03) 6px
          )`,
          opacity: 0.8,
        }}
      />

      {/* OLD WAY stamp */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 160,
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: uiFont,
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: "0.32em",
            color: blackout.dim,
            textTransform: "uppercase",
          }}
        >
          The old way
        </div>
      </AbsoluteFill>

      {/* Phone / chaos glyph */}
      {cut.from === 0 ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: 120,
          }}
        >
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: "50%",
              border: `4px solid ${blackout.orange}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${ringPulse})`,
              boxShadow: `0 0 60px rgba(255,122,0,0.35)`,
            }}
          >
            <div
              style={{
                fontFamily: displayFont,
                fontSize: 72,
                color: blackout.orange,
              }}
            >
              ☎
            </div>
          </div>
          <div
            style={{
              marginTop: 36,
              fontFamily: uiFont,
              fontWeight: 700,
              fontSize: 22,
              color: blackout.muted,
              letterSpacing: "0.2em",
            }}
          >
            {dialDigits}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Slam headline */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 40px",
          transform: `scale(${interpolate(slam, [0, 1], [1.45, 1]) * ringPulse}) translateY(${cut.from === 0 ? 280 : 0}px)`,
        }}
      >
        <div
          style={{
            fontFamily: displayFont,
            fontSize: cut.label.length > 12 ? 72 : 96,
            color: cut.accent,
            textAlign: "center",
            lineHeight: 0.95,
            letterSpacing: "0.02em",
            textShadow:
              cut.accent === blackout.red
                ? `0 0 40px rgba(255,45,45,0.55)`
                : `0 6px 0 rgba(0,0,0,0.6)`,
            opacity: interpolate(local, [0, 3], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          {cut.label}
        </div>
        <div
          style={{
            marginTop: 28,
            fontFamily: uiFont,
            fontWeight: 700,
            fontSize: 28,
            color: blackout.soft,
            textAlign: "center",
            maxWidth: 820,
            opacity: interpolate(local, [10, 22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {cut.sub}
        </div>
      </AbsoluteFill>

      {/* Hard cut markers */}
      {CUTS.slice(1).map((c) =>
        frame >= c.from && frame < c.from + 10 ? (
          <ImpactFlash
            key={c.from}
            at={c.from}
            color={c.accent === blackout.red ? blackout.red : blackout.white}
            strength={0.7}
          />
        ) : null,
      )}

      {local < 12 ? <ChromaticGlitch intensity={1.2} /> : null}

      {/* Bottom ticker */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          paddingBottom: 100,
          alignItems: "center",
        }}
      >
        <SlamType
          text="NO VERIFIED. NO ESCROW. NO SHOW."
          size={26}
          variant="ui"
          color={blackout.dim}
          delay={40}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
