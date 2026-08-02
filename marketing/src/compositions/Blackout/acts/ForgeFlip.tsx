import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhoneShell } from "../../ForgeReel/components/PhoneShell";
import { ChromaticGlitch, ImpactFlash } from "../components/ImpactFlash";
import { SlamType } from "../components/SlamType";
import { displayFont, uiFont } from "../fonts";
import { blackout } from "../theme";

/** Orange wipe into FORGE brand. */
const FlipWipe = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wipe = interpolate(frame, [0, 36], [0, 100], {
    extrapolateRight: "clamp",
  });
  const brand = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 11, stiffness: 200 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: blackout.bg }}>
      <AbsoluteFill
        style={{
          background: blackout.orange,
          clipPath: `inset(0 ${100 - wipe}% 0 0)`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: interpolate(brand, [0, 1], [0, 1]),
          transform: `scale(${interpolate(brand, [0, 1], [1.6, 1])})`,
        }}
      >
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 140,
            color: frame < 40 ? blackout.bg : blackout.orange,
            letterSpacing: "0.08em",
            textShadow:
              frame >= 40 ? `0 0 50px rgba(255,122,0,0.5)` : "none",
          }}
        >
          FORGE
        </div>
      </AbsoluteFill>
      <ImpactFlash at={18} color={blackout.white} strength={0.6} />
      {frame < 28 ? <ChromaticGlitch intensity={1.4} /> : null}
    </AbsoluteFill>
  );
};

/** Type search queries on phone. */
const SearchBeat = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const queries = ["electrician near me", "AC tech Accra"];
  const qIndex = frame < 150 ? 0 : 1;
  const query = queries[qIndex];
  const typeStart = qIndex === 0 ? 20 : 160;
  const typed = Math.min(
    query.length,
    Math.floor(
      interpolate(frame, [typeStart, typeStart + 70], [0, query.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const up = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 140 },
  });
  const caret = Math.floor(frame / 8) % 2 === 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: blackout.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 160,
        }}
      >
        <SlamType text="FIND HELP. NOW." size={52} color={blackout.white} />
      </AbsoluteFill>
      <div
        style={{
          transform: `translateY(${interpolate(up, [0, 1], [380, 80])}px)`,
          opacity: interpolate(up, [0, 0.2, 1], [0, 1, 1]),
        }}
      >
        <PhoneShell>
          <div style={{ padding: "96px 28px 28px" }}>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 26,
                color: blackout.white,
                marginBottom: 20,
              }}
            >
              What do you need?
            </div>
            <div
              style={{
                background: blackout.glass,
                border: `2px solid ${typed === query.length ? blackout.orange : blackout.glassBorder}`,
                borderRadius: 16,
                padding: "18px 20px",
                fontFamily: uiFont,
                fontWeight: 600,
                fontSize: 22,
                color: typed ? blackout.white : blackout.dim,
                minHeight: 64,
                display: "flex",
                alignItems: "center",
                boxShadow:
                  typed === query.length
                    ? `0 0 0 3px rgba(255,122,0,0.25)`
                    : "none",
              }}
            >
              {query.slice(0, typed)}
              <span
                style={{
                  width: 2,
                  height: 24,
                  marginLeft: 2,
                  background: blackout.orange,
                  opacity: caret && typed < query.length ? 1 : 0,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 18,
                background: blackout.orange,
                borderRadius: 14,
                padding: "16px 0",
                textAlign: "center",
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 20,
                color: blackout.white,
                opacity: interpolate(frame, [90, 110], [0.4, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `scale(${interpolate(
                  spring({
                    frame: Math.max(0, frame - 100),
                    fps,
                    config: { damping: 12, stiffness: 200 },
                  }),
                  [0, 1],
                  [0.92, 1],
                )})`,
              }}
            >
              Find pros
            </div>
          </div>
        </PhoneShell>
      </div>
    </AbsoluteFill>
  );
};

/** Verified pro card slam. */
const VerifiedBeat = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180 },
  });
  const badge = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 10, stiffness: 260 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: blackout.bg,
        justifyContent: "center",
        alignItems: "center",
        gap: 36,
      }}
    >
      <SlamType text="VERIFIED PRO" size={56} color={blackout.orange} shake />
      <div
        style={{
          width: 720,
          borderRadius: 24,
          border: `2px solid ${blackout.glassBorder}`,
          background: blackout.screen,
          padding: 36,
          transform: `scale(${interpolate(enter, [0, 1], [0.85, 1])}) translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.55)`,
        }}
      >
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              background: `linear-gradient(145deg, ${blackout.orange}, #8B4000)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: displayFont,
              fontSize: 40,
              color: blackout.white,
            }}
          >
            KO
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 32,
                color: blackout.white,
              }}
            >
              Kwame Osei
            </div>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 600,
                fontSize: 20,
                color: blackout.muted,
                marginTop: 6,
              }}
            >
              Electrician · Accra · 12 min away
            </div>
          </div>
          <div
            style={{
              transform: `scale(${interpolate(badge, [0, 1], [2.2, 1])})`,
              opacity: badge,
              background: blackout.green,
              color: blackout.white,
              fontFamily: uiFont,
              fontWeight: 800,
              fontSize: 16,
              padding: "10px 14px",
              borderRadius: 10,
              letterSpacing: "0.06em",
            }}
          >
            ✓ ID
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 12,
          }}
        >
          {["4.9 ★", "87 jobs", "Same-day"].map((chip, i) => (
            <div
              key={chip}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "14px 8px",
                borderRadius: 12,
                background: blackout.glass,
                border: `1px solid ${blackout.glassBorder}`,
                fontFamily: uiFont,
                fontWeight: 700,
                fontSize: 18,
                color: i === 0 ? blackout.ember : blackout.white,
                opacity: interpolate(frame, [50 + i * 12, 70 + i * 12], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
      <ImpactFlash at={40} color={blackout.green} strength={0.35} />
    </AbsoluteFill>
  );
};

/** Escrow lock + book CTA. */
const EscrowBookBeat = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 160 },
  });
  const locked = frame >= 70;
  const lockSpring = spring({
    frame: Math.max(0, frame - 70),
    fps,
    config: { damping: 12, stiffness: 220 },
  });
  const book = spring({
    frame: Math.max(0, frame - 130),
    fps,
    config: { damping: 11, stiffness: 200 },
  });
  const tap = frame >= 160 && frame < 190;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: blackout.bg,
        justifyContent: "center",
        alignItems: "center",
        gap: 28,
        padding: 48,
      }}
    >
      <SlamType text="ESCROW. BOOK." size={56} color={blackout.white} />
      <div
        style={{
          width: 700,
          borderRadius: 22,
          background: blackout.screen,
          border: `2px solid ${locked ? blackout.green : blackout.glassBorder}`,
          padding: 32,
          transform: `scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 26,
                color: blackout.white,
              }}
            >
              Paystack Escrow
            </div>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 600,
                fontSize: 18,
                color: locked ? blackout.green : blackout.muted,
                marginTop: 6,
              }}
            >
              {locked ? "Funds locked until job done" : "Protect your payment"}
            </div>
          </div>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: locked ? blackout.green : "#2a2a2a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              transform: `scale(${interpolate(lockSpring, [0, 1], [1.4, 1])})`,
            }}
          >
            {locked ? "🔒" : "○"}
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            background: blackout.orange,
            borderRadius: 16,
            padding: "22px 0",
            textAlign: "center",
            fontFamily: uiFont,
            fontWeight: 800,
            fontSize: 28,
            color: blackout.white,
            opacity: book,
            transform: `scale(${interpolate(book, [0, 1], [0.85, 1]) * (tap ? 0.94 : 1)})`,
            boxShadow: tap
              ? `0 0 0 8px rgba(255,122,0,0.35)`
              : `0 12px 40px rgba(255,122,0,0.35)`,
          }}
        >
          BOOK NOW
        </div>
      </div>
      <ImpactFlash at={70} color={blackout.green} strength={0.4} />
      <ImpactFlash at={160} color={blackout.orange} strength={0.5} />
    </AbsoluteFill>
  );
};

/**
 * Flip act — wipe to FORGE, search, verified, escrow/book.
 * Local timeline: 0–90 wipe · 90–360 search · 360–540 verified · 540–840 escrow
 */
export const ForgeFlip = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: blackout.bg }}>
      <Sequence from={0} durationInFrames={90} name="flipWipe">
        <FlipWipe />
      </Sequence>
      <Sequence from={90} durationInFrames={270} name="search">
        <SearchBeat />
      </Sequence>
      <Sequence from={360} durationInFrames={180} name="verified">
        <VerifiedBeat />
      </Sequence>
      <Sequence from={540} durationInFrames={300} name="escrowBook">
        <EscrowBookBeat />
      </Sequence>
    </AbsoluteFill>
  );
};
