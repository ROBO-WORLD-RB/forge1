import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { uiFont } from "../fonts";
import { reel } from "../theme";

type ChatBubbleProps = {
  /** Local scene frame */
  enterDelay?: number;
};

export const ChatBubble: React.FC<ChatBubbleProps> = ({ enterDelay = 20 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - enterDelay);

  const pop = spring({
    frame: local,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const pulse = interpolate(frame % 40, [0, 20, 40], [0.65, 1, 0.65]);

  return (
    <div
      style={{
        transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})`,
        opacity: interpolate(pop, [0, 0.15, 1], [0, 1, 1]),
        width: "86%",
        maxWidth: 820,
      }}
    >
      <div
        style={{
          background: reel.glass,
          border: `1px solid ${reel.glassBorder}`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderRadius: 28,
          padding: "28px 32px 32px",
          boxShadow: `0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,59,74,0.15)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: `2px solid ${reel.red}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 ${18 * pulse}px rgba(255, 59, 74, ${0.55 * pulse})`,
              transform: `scale(${0.92 + pulse * 0.08})`,
            }}
          >
            <span
              style={{
                color: reel.red,
                fontSize: 26,
                fontWeight: 800,
                fontFamily: uiFont,
                lineHeight: 1,
              }}
            >
              !
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: uiFont,
              fontSize: 34,
              fontWeight: 600,
              lineHeight: 1.35,
              color: reel.white,
            }}
          >
            Anyone have a reliable electrician in Accra?
          </p>
        </div>
      </div>
      {/* Tail */}
      <div
        style={{
          width: 0,
          height: 0,
          marginLeft: 48,
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderTop: `18px solid ${reel.glassBorder}`,
          opacity: 0.9,
        }}
      />
    </div>
  );
};
