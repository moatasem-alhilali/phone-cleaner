import { describe, expect, it } from "vitest";
import { applyConditionalInjection } from "../normalize";
import type { InjectionRule } from "../types";

const rules: InjectionRule[] = [
  {
    id: "saudi",
    name: "Saudi",
    dialCode: "+966",
    lengthMode: "equals",
    lengthEquals: 10,
    prefixes: ["05"],
    trunkHandling: "removeLeading0",
    matchStrategy: "firstMatchWins",
    enabled: true,
  },
  {
    id: "yemen",
    name: "Yemen",
    dialCode: "+967",
    lengthMode: "equals",
    lengthEquals: 9,
    prefixes: ["77", "73", "71"],
    trunkHandling: "keep",
    matchStrategy: "firstMatchWins",
    enabled: true,
  },
];

describe("applyConditionalInjection", () => {
  it("matches Saudi mobile rule and removes trunk", () => {
    const result = applyConditionalInjection("0551234567", rules);
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.normalizedE164).toBe("+966551234567");
      expect(result.ruleId).toBe("saudi");
    }
  });

  it("matches Yemen prefixes", () => {
    const result = applyConditionalInjection("777123456", rules);
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.normalizedE164).toBe("+967777123456");
      expect(result.ruleId).toBe("yemen");
    }
  });

  it("returns unmatched for other prefixes", () => {
    const result = applyConditionalInjection("1234567", rules);
    expect(result.matched).toBe(false);
  });
});
