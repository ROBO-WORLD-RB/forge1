import { z } from "zod";

/** Investor pitch slide content — driven by stories/*.json */
export const forgePitchSchema = z.object({
  id: z.string().default("pitch-investor"),
  type: z.literal("pitch").default("pitch"),
  hookLine1: z.string().default("Skilled work runs the continent."),
  hookLine2: z.string().default("Hiring still runs on WhatsApp."),
  painLines: z
    .array(z.string())
    .default(["Ghosted. Overcharged. No-shows.", "Skilled — but invisible."]),
  loopSteps: z
    .array(z.string())
    .default(["Discover", "Hire", "Work", "Pay", "Review"]),
  tagline: z.string().default("Where work meets hands"),
  markets: z.array(z.string()).default(["Ghana", "Nigeria"]),
  url: z.string().default("forge-9ieq.onrender.com"),
  studio: z.string().default("Intelligent Systems"),
  askAmount: z.string().default("[YOUR AMOUNT]"),
  askUse: z.string().default("[YOUR USE OF FUNDS]"),
  contactEmail: z.string().default("[YOUR EMAIL]"),
  featureLabels: z
    .array(z.string())
    .default([
      "Search",
      "Post projects",
      "Apply & book",
      "Chat",
      "Escrow & wallet",
      "Verification",
    ]),
  marketChips: z
    .array(z.string())
    .default(["GHS", "NGN", "PWA", "Paystack", "Supabase"]),
});

export type ForgePitchProps = z.infer<typeof forgePitchSchema>;

export const defaultForgePitchProps: ForgePitchProps = forgePitchSchema.parse(
  {},
);
