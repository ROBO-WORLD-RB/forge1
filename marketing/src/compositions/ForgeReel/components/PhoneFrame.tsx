import { reel } from "../theme";

type PhoneFrameProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

/** 2.5D floating smartphone chrome — no external assets. */
export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children, style }) => {
  return (
    <div
      style={{
        width: 520,
        height: 980,
        borderRadius: 48,
        padding: 14,
        background: `linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05))`,
        border: `1px solid ${reel.glassBorder}`,
        boxShadow: `
          0 40px 100px rgba(0,0,0,0.55),
          0 0 0 1px rgba(0,242,254,0.15),
          inset 0 1px 0 rgba(255,255,255,0.25)
        `,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        transform: "perspective(1200px) rotateY(-8deg) rotateX(4deg)",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 36,
          background: reel.bg,
          overflow: "hidden",
          position: "relative",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 28,
            borderRadius: 20,
            background: "#05070a",
            zIndex: 5,
          }}
        />
        {children}
      </div>
    </div>
  );
};
