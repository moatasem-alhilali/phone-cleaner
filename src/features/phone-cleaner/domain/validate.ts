import type { NormalizationResult } from "./normalize";
import { validateLength } from "./normalize";

export function validateNormalized(
  result: NormalizationResult,
  strictMode: boolean
): NormalizationResult {
  if (!result.ok) return result;

  if (strictMode && !result.country) {
    return { ok: false, reason: "ambiguous" };
  }

  return validateLength(result, strictMode);
}
