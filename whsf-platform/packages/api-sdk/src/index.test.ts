import { describe, expect, it, vi } from "vitest";
import { WhsfApiClient } from "./index";

describe("WhsfApiClient", () => {
  it("validates health responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        service: "api",
        status: "ok",
        version: "0.1.0",
        timestamp: "2026-07-30T12:00:00Z",
      })),
    );
    const client = new WhsfApiClient({ baseUrl: "https://api.example.org/", fetcher });
    await expect(client.health()).resolves.toMatchObject({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith("https://api.example.org/health", undefined);
  });
});
