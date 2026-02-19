import { describe, expect, it } from "vitest";
import { COUNTRIES } from "../countries";
import { normalizePhone } from "../normalize";
import { validateNormalized } from "../validate";

const defaultCountry = COUNTRIES.find((c) => c.iso2 === "SA");
const context = {
  countries: COUNTRIES,
  defaultCountry,
  defaultCountryIso2: "SA",
  strictMode: true,
  allowMissingTrunkPrefix: true,
  stripExtraLeadingZeros: false,
  useConditionalInjection: false,
  ignoreUnmatched: true,
  fallbackToDefault: false,
  injectionRules: [],
};

describe("normalizePhone", () => {
  it("keeps international + format", () => {
    const result = normalizePhone("+966551234567", context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe("+966551234567");
    }
  });

  it("converts 00 prefix to +", () => {
    const result = normalizePhone("00966551234567", context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe("+966551234567");
    }
  });

  it("handles local format with trunk prefix", () => {
    const result = normalizePhone("0551234567", context);
    const validated = validateNormalized(result, true);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.normalized).toBe("+966551234567");
    }
  });
});
