import { describe, expect, it } from "vitest";
import { serviceHealthSchema } from "./index";

describe("serviceHealthSchema", () => {
  it("accepts a valid service response", () => {
    const parsed = serviceHealthSchema.parse({
      service: "api",
      status: "ok",
      version: "0.1.0",
      timestamp: "2026-07-30T12:00:00Z",
    });
    expect(parsed.status).toBe("ok");
  });
});
