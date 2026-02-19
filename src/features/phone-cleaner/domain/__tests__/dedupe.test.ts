import { describe, expect, it } from "vitest";
import type { NormalizedRow } from "../types";
import { dedupeRows, ensureNameNormalized } from "../dedupe";

describe("dedupeRows", () => {
  it("groups duplicates by phone and name", () => {
    const rows: NormalizedRow[] = [
      {
        index: 1,
        raw: "Ahmed - 0551234567",
        name: "Ahmed",
        phoneRaw: "0551234567",
        normalized: "+966551234567",
        nationalNumber: "551234567",
        status: "valid",
      },
      {
        index: 2,
        raw: "Ahmed - +966551234567",
        name: "Ahmed",
        phoneRaw: "+966551234567",
        normalized: "+966551234567",
        nationalNumber: "551234567",
        status: "valid",
      },
    ];

    ensureNameNormalized(rows);
    const results = dedupeRows(rows, true);

    expect(results.unique.length).toBe(1);
    expect(results.duplicates.length).toBe(1);
    expect(results.duplicateGroupsByPhone.length).toBe(1);
    expect(results.duplicateGroupsByNamePhone.length).toBe(1);
  });
});
