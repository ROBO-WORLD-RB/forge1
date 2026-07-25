import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhoneShell } from "../components/PhoneShell";
import { uiFont } from "../fonts";
import { reel } from "../theme";

const QUERY = "Electrician · Accra";

/** Interactive typing in the FORGE search bar. */
export const SearchType = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const up = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const typed = Math.min(
    QUERY.length,
    Math.floor(interpolate(frame, [12, 70], [0, QUERY.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })),
  );
  const caretOn = Math.floor(frame / 8) % 2 === 0;
  const btn = spring({
    frame: Math.max(0, frame - 72),
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: reel.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          transform: `translateY(${interpolate(up, [0, 1], [420, 0])}px)`,
          opacity: interpolate(up, [0, 0.2, 1], [0, 1, 1]),
        }}
      >
        <PhoneShell>
          <div style={{ padding: "88px 24px 24px" }}>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 28,
                color: reel.white,
                marginBottom: 22,
              }}
            >
              What do you need?
            </div>
            <div
              style={{
                background: reel.glass,
                border: `1.5px solid ${frame > 70 ? reel.orange : reel.glassBorder}`,
                borderRadius: 16,
                padding: "18px 20px",
                fontFamily: uiFont,
                fontWeight: 600,
                fontSize: 22,
                color: typed ? reel.white : reel.dim,
                minHeight: 64,
                display: "flex",
                alignItems: "center",
                boxShadow:
                  frame > 70 ? `0 0 0 2px rgba(255,122,0,0.25)` : "none",
              }}
            >
              {QUERY.slice(0, typed)}
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 24,
                  marginLeft: 2,
                  background: reel.orange,
                  opacity: caretOn && typed < QUERY.length ? 1 : 0,
                }}
              />
              {typed === 0 ? "Search a trade…" : null}
            </div>
            <div
              style={{
                marginTop: 18,
                transform: `scale(${interpolate(btn, [0, 1], [0.9, 1])})`,
                opacity: btn,
                background: reel.orange,
                borderRadius: 14,
                padding: "16px 0",
                textAlign: "center",
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 20,
                color: reel.white,
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
