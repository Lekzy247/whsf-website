import { describe, expect, it } from "vitest";
import { can } from "./index";

describe("can", () => {
  it("denies absent sessions and ungranted permissions", () => {
    expect(can(null, "programme:read")).toBe(false);
    expect(can({ id: "1", organisationId: "o", permissions: [] }, "programme:read")).toBe(false);
  });
});
