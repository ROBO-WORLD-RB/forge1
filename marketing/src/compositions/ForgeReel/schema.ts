import { z } from "zod";

export const reelWorkerSchema = z.object({
  name: z.string(),
  trade: z.string(),
  city: z.string(),
  rating: z.number().optional(),
  tags: z.array(z.string()).optional(),
  initials: z.string().optional(),
});

/** Story-driven props for ForgeReel — fields that matter for copy/names. */
export const forgeReelSchema = z.object({
  id: z.string().default("forge-reel"),
  type: z.literal("reel").default("reel"),
  audience: z.enum(["worker", "customer"]).default("customer"),
  painCaption: z.string().default("Ghosted. Overcharged. No-shows."),
  searchQuery: z.string().default("Electrician · Accra"),
  workers: z
    .array(reelWorkerSchema)
    .default([
      {
        name: "Kofi Mensah",
        trade: "Master Electrician",
        city: "Accra",
        rating: 4.9,
        tags: ["Wiring", "Meters", "Solar"],
        initials: "KM",
      },
      {
        name: "Jerry Justice",
        trade: "Master Plumber",
        city: "Accra",
        rating: 5.0,
        tags: ["Pipes", "Leak Fix", "Installs"],
        initials: "JJ",
      },
    ]),
  bookWorker: z.string().default("Jerry Justice"),
  chatLine: z.string().default("On my way — 25 mins."),
  tradesChips: z
    .array(z.string())
    .default(["Electrician", "Plumber", "Carpenter", "Painter", "Welder"]),
  ctaUrl: z.string().default("forge-9ieq.onrender.com"),
  jobLabel: z.string().default("Burst pipe fix"),
  escrowLabel: z.string().default("GHS 180 locked"),
});

export type ReelWorker = z.infer<typeof reelWorkerSchema>;
export type ForgeReelProps = z.infer<typeof forgeReelSchema>;

export const defaultForgeReelProps: ForgeReelProps = forgeReelSchema.parse({});

/** Initials from a full name when JSON omits them. */
export function workerInitials(worker: ReelWorker): string {
  if (worker.initials) return worker.initials.slice(0, 3).toUpperCase();
  return worker.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function workerRole(worker: ReelWorker): string {
  return `${worker.trade} · ${worker.city}`;
}
