import { describe, expect, it } from "vitest";
import { belongsToOrganisation } from "./index";

describe("tenant isolation", () => {
  it("rejects records from another organisation", () => {
    const record = { id: "1", organisationId: "a", createdAt: "", createdBy: "", updatedAt: "", updatedBy: "" };
    expect(belongsToOrganisation(record, "b")).toBe(false);
  });
});
