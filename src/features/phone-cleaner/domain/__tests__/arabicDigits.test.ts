import { describe, expect, it } from "vitest";
import { extractDigits, toWesternDigits } from "../../utils/arabicDigits";

describe("arabic digit conversion", () => {
  it("converts Arabic digits to western digits", () => {
    expect(toWesternDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toWesternDigits("٩٩١٢٣")).toBe("99123");
  });

  it("extracts digits from mixed text", () => {
    expect(extractDigits("أحمد ٠٥٥-١٢٣-٤٥٦٧")).toBe("0551234567");
  });
});
