import { describe, expect, it } from "vitest";
import { navigationItems } from "@whsf/shared";

describe("public platform", () => {
  it("keeps a route back to WHSF information", () => {
    expect(navigationItems.some((item) => item.href === "/about")).toBe(true);
  });
});
