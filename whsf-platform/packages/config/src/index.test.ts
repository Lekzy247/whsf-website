import { describe, expect, it } from "vitest";
import { readPublicEnvironment } from "./index";

describe("public environment", () => {
  it("supplies a safe local default", () => {
    expect(readPublicEnvironment({}).NEXT_PUBLIC_API_URL).toBe("http://localhost:8000");
  });
});
