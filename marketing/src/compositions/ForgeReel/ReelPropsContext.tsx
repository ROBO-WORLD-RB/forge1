import { createContext, useContext } from "react";
import { defaultForgeReelProps, type ForgeReelProps } from "./schema";

const ReelPropsContext = createContext<ForgeReelProps>(defaultForgeReelProps);

export const ReelPropsProvider: React.FC<{
  value: ForgeReelProps;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <ReelPropsContext.Provider value={value}>
    {children}
  </ReelPropsContext.Provider>
);

export function useReelProps(): ForgeReelProps {
  return useContext(ReelPropsContext);
}
