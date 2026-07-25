import type { CSSProperties, ReactNode } from "react";
import { reel } from "../theme";

type PhoneShellProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export const PhoneShell = ({ children, style }: PhoneShellProps) => (
  <div
    style={{
      width: 480,
      height: 900,
      borderRadius: 44,
      padding: 11,
      background: "linear-gradient(160deg, #2a2a2a, #0a0a0a)",
      border: `1px solid ${reel.glassBorder}`,
      boxShadow: "0 28px 70px rgba(0,0,0,0.65)",
      ...style,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 34,
        background: reel.screen,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 110,
          height: 26,
          borderRadius: 16,
          background: "#050505",
          zIndex: 4,
        }}
      />
      {children}
    </div>
  </div>
);
