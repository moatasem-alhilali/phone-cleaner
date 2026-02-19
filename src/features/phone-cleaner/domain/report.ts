import type {
  CleaningReport,
  CleaningSettings,
  InputHints,
  NormalizedRow,
} from "./types";
import { applyCountryOverride, getCountryByIso2 } from "./countries";
import { parseRow } from "./parseRow";
import {
  normalizePhone,
  type NormalizationContext,
} from "./normalize";
import { validateNormalized } from "./validate";
import { dedupeRows, ensureNameNormalized } from "./dedupe";
import { getPresetById } from "./presets";
import type { Country } from "./types";

export type ProcessingContext = {
  countries: Country[];
  settings: CleaningSettings;
};

export function analyzeInput(lines: string[]): InputHints {
  const sample = lines.slice(0, Math.min(lines.length, 50));
  let csvLikeCount = 0;
  let separatorLikeCount = 0;

  sample.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/,/.test(trimmed)) csvLikeCount += 1;
    if (/[|]/.test(trimmed) || /\s[-–—]\s/.test(trimmed)) {
      separatorLikeCount += 1;
    }
  });

  const threshold = Math.max(1, Math.floor(sample.length * 0.4));
  return {
    csvLike: csvLikeCount >= threshold,
    separatorLike: separatorLikeCount >= threshold,
  };
}

export function buildProcessingContext(
  countries: Country[],
  settings: CleaningSettings
): NormalizationContext {
  const preset = getPresetById(settings.presetId);
  const overriddenCountries = applyCountryOverride(
    countries,
    preset?.default_country_iso2,
    preset?.country_overrides
  );
  const sortedCountries = [...overriddenCountries].sort(
    (a, b) => b.dial_code.length - a.dial_code.length
  );

  const defaultIso2 =
    preset?.default_country_iso2 ?? settings.defaultCountryIso2;

  const defaultCountry = getCountryByIso2(
    sortedCountries,
    defaultIso2,
    preset?.country_overrides
  );

  return {
    countries: sortedCountries,
    defaultCountry,
    defaultCountryIso2: defaultIso2,
    strictMode: settings.strictMode,
    allowMissingTrunkPrefix: settings.allowMissingTrunkPrefix,
    stripExtraLeadingZeros: settings.stripExtraLeadingZeros,
    useConditionalInjection: settings.useConditionalInjection,
    ignoreUnmatched: settings.ignoreUnmatched,
    fallbackToDefault: settings.fallbackToDefault,
    injectionRules: settings.injectionRules,
  };
}

export function processLine(
  line: string,
  index: number,
  context: NormalizationContext,
  hints: InputHints
): NormalizedRow {
  const parsed = parseRow(line, index + 1, hints);

  if (!parsed.phoneRaw) {
    const reason = line.trim() === "" ? "empty" : "no_digits";
    return {
      ...parsed,
      status: "invalid",
      reason,
    };
  }

  const normalizedResult = normalizePhone(parsed.phoneRaw, context);
  const validated = validateNormalized(normalizedResult, context.strictMode);

  if (!validated.ok) {
    return {
      ...parsed,
      status: "invalid",
      reason: validated.reason,
      matchedRuleId: normalizedResult.ok ? normalizedResult.matchedRuleId : undefined,
      matchedRuleName: normalizedResult.ok ? normalizedResult.matchedRuleName : undefined,
      matchedRuleDialCode: normalizedResult.ok ? normalizedResult.matchedRuleDialCode : undefined,
    };
  }

  return {
    ...parsed,
    status: "valid",
    normalized: validated.normalized,
    nationalNumber: validated.nationalNumber,
    country: validated.country,
    matchedRuleId: validated.matchedRuleId,
    matchedRuleName: validated.matchedRuleName,
    matchedRuleDialCode: validated.matchedRuleDialCode,
  };
}

export function buildReport(
  rows: NormalizedRow[],
  settings: CleaningSettings,
  hints: InputHints,
  durationMs: number
): CleaningReport {
  const validRows = rows.filter((row) => row.status === "valid");
  const invalidRows = rows.filter((row) => row.status === "invalid");

  ensureNameNormalized(validRows);

  const {
    unique,
    duplicates,
    duplicateGroupsByPhone,
    duplicateGroupsByNamePhone,
    duplicateGroupsByName,
  } = dedupeRows(validRows, settings.detectNameDuplicates);

  const stats = {
    total: rows.length,
    valid: validRows.length,
    unique: unique.length,
    duplicate: duplicates.length,
    invalid: invalidRows.length,
  };

  return {
    rows,
    unique,
    duplicates,
    invalid: invalidRows,
    duplicateGroupsByPhone,
    duplicateGroupsByNamePhone,
    duplicateGroupsByName,
    stats,
    hints,
    createdAt: Date.now(),
    durationMs,
  };
}
