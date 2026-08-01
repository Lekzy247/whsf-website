import { z } from "zod";

export const serviceHealthSchema = z.object({
  service: z.string().min(1),
  status: z.enum(["ok", "degraded"]),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type ServiceHealth = z.infer<typeof serviceHealthSchema>;

export const programmeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  region: z.string().min(2).max(120),
  status: z.enum(["planned", "active", "paused", "completed"]),
  peopleReached: z.number().int().nonnegative(),
});

export type Programme = z.infer<typeof programmeSchema>;

export const navigationItems = [
  { href: "/programmes", label: "Programmes" },
  { href: "/impact", label: "Impact" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About WHSF" },
] as const;
