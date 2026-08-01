import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("defaults to a non-submitting button", () => {
    expect(Button({ children: "Continue" }).props.type).toBe("button");
  });
});
