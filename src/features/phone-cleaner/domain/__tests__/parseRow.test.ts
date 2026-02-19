import { describe, expect, it } from "vitest";
import { parseRow } from "../parseRow";

const hints = { csvLike: true, separatorLike: true };

describe("parseRow", () => {
  it("parses name and phone with dash separator", () => {
    const result = parseRow("Ahmed - 0551234567", 0, hints);
    expect(result.name).toBe("Ahmed");
    expect(result.phoneRaw).toContain("0551234567");
  });

  it("parses name and phone with comma", () => {
    const result = parseRow("Ahmed, 0551234567", 0, hints);
    expect(result.name).toBe("Ahmed");
    expect(result.phoneRaw).toContain("0551234567");
  });

  it("parses phone-only lines", () => {
    const result = parseRow("+966551234567", 0, hints);
    expect(result.name).toBe("");
    expect(result.phoneRaw).toContain("+966551234567");
  });
});
