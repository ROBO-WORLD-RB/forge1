import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { RedParticles } from "../components/RedParticles";
import { uiFont } from "../fonts";
import { reel } from "../theme";

const MSGS = [
  { who: "Ama", text: "Anyone know a plumber?? Mine ghosted 😤", delay: 0 },
  { who: "Kojo", text: "He took deposit and vanished…", delay: 18 },
  { who: "Efua", text: "WhatsApp groups are useless for this", delay: 36 },
];

/** Frantic WhatsApp pile-up — stakes in under 1.5s. */
export const ChatSlam = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: reel.bg }}>
      <RedParticles />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 36,
          gap: 14,
          flexDirection: "column",
        }}
      >
        {MSGS.map((m, i) => {
          const local = Math.max(0, frame - m.delay);
          const pop = spring({
            frame: local,
            fps,
            config: { damping: 12, stiffness: 200 },
          });
          return (
            <div
              key={m.who}
              style={{
                width: "90%",
                maxWidth: 820,
                transform: `translateY(${interpolate(pop, [0, 1], [40, 0])}px) scale(${interpolate(pop, [0, 1], [0.92, 1])}) rotate(${(i - 1) * 1.2}deg)`,
                opacity: interpolate(pop, [0, 0.2, 1], [0, 1, 1]),
                background: reel.bubble,
                borderRadius: 20,
                padding: "18px 22px",
                border: `1px solid rgba(255,77,79,${0.25 + i * 0.08})`,
              }}
            >
              <div
                style={{
                  fontFamily: uiFont,
                  fontSize: 13,
                  fontWeight: 700,
                  color: reel.orange,
                  marginBottom: 6,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {m.who} · WhatsApp
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: uiFont,
                  fontSize: 28,
                  fontWeight: 700,
                  color: reel.white,
                  lineHeight: 1.25,
                }}
              >
                {m.text}
              </p>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
