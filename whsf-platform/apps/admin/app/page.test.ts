import { describe, expect, it } from "vitest";
import { can } from "@whsf/auth-sdk";
describe("operations authorization", () => {
  it("fails closed", () => expect(can(null, "identity:manage")).toBe(false));
});
