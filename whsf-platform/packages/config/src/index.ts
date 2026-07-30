import { z } from "zod";

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8000"),
});

export function readPublicEnvironment(source: Record<string, string | undefined>) {
  return publicEnvironmentSchema.parse(source);
}
