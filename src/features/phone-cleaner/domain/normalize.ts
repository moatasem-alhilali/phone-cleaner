import type {
  Country,
  InjectionRule,
  InvalidReason,
  NormalizationOptions,
} from "./types";
import { extractDigits, toWesternDigits } from "../utils/arabicDigits";
import {
  GENERIC_MAX_LENGTH,
  GENERIC_MIN_LENGTH,
  resolveCountryByDialCode,
} from "./countries";

export type NormalizationSuccess = {
  ok: true;
  normalized: string;
  nationalNumber: string;
  country?: Country;
  isInternational: boolean;
  matchedRuleId?: string;
  matchedRuleName?: string;
  matchedRuleDialCode?: string;
};

export type NormalizationFailure = {
  ok: false;
  reason: InvalidReason;
};

export type NormalizationResult = NormalizationSuccess | NormalizationFailure;

export type NormalizationContext = NormalizationOptions & {
  countries: Country[];
  defaultCountry?: Country;
};

export type InjectionMatchResult =
  | {
      matched: true;
      ruleId: string;
      ruleName?: string;
      dialCodeDigits: string;
      nationalNumber: string;
      normalizedE164: string;
    }
  | { matched: false };

function sanitizeRaw(input: string): string {
  const western = toWesternDigits(input ?? "");
  const onlyDigitsAndPlus = western.replace(/[^\d+]/g, "");
  const hasPlus = onlyDigitsAndPlus.startsWith("+");
  const withoutExtraPlus = onlyDigitsAndPlus.replace(/\+/g, "");
  return hasPlus ? `+${withoutExtraPlus}` : withoutExtraPlus;
}

export function normalizePhone(
  rawPhone: string,
  context: NormalizationContext
): NormalizationResult {
  const sanitized = sanitizeRaw(rawPhone);

  if (!sanitized) {
    return { ok: false, reason: "no_digits" };
  }

  if (sanitized.startsWith("00")) {
    const digits = sanitized.slice(2);
    if (!digits) return { ok: false, reason: "no_digits" };
    return normalizeInternational(`+${digits}`, context.countries);
  }

  if (sanitized.startsWith("+")) {
    return normalizeInternational(sanitized, context.countries);
  }

  if (context.useConditionalInjection) {
    const localDigits = extractDigits(sanitized);
    if (!localDigits) return { ok: false, reason: "no_digits" };
    const injection = applyConditionalInjection(
      localDigits,
      context.injectionRules
    );
    if (injection.matched) {
      const combinedDigits = `${injection.dialCodeDigits}${injection.nationalNumber}`;
      const country = resolveCountryByDialCode(context.countries, combinedDigits);
      return {
        ok: true,
        normalized: injection.normalizedE164,
        nationalNumber: injection.nationalNumber,
        country,
        isInternational: false,
        matchedRuleId: injection.ruleId,
        matchedRuleName: injection.ruleName,
        matchedRuleDialCode: `+${injection.dialCodeDigits}`,
      };
    }

    if (context.fallbackToDefault || !context.ignoreUnmatched) {
      return normalizeLocal(sanitized, context);
    }

    return { ok: false, reason: "no_rule_match" };
  }

  return normalizeLocal(sanitized, context);
}

function normalizeInternational(
  value: string,
  countries: Country[]
): NormalizationResult {
  const digits = value.replace(/^\+/, "");
  if (!digits) return { ok: false, reason: "no_digits" };

  const country = resolveCountryByDialCode(countries, digits);
  const nationalNumber = country
    ? digits.slice(country.dial_code.length)
    : digits;

  if (!nationalNumber) return { ok: false, reason: "invalid_prefix" };

  return {
    ok: true,
    normalized: `+${digits}`,
    nationalNumber,
    country,
    isInternational: true,
  };
}

function normalizeLocal(
  value: string,
  context: NormalizationContext
): NormalizationResult {
  const defaultCountry = context.defaultCountry;
  if (!defaultCountry) return { ok: false, reason: "ambiguous" };

  let digits = extractDigits(value);
  if (!digits) return { ok: false, reason: "no_digits" };

  const trunk = defaultCountry.trunk_prefix;
  if (trunk) {
    if (digits.startsWith(trunk)) {
      digits = digits.slice(trunk.length);
    } else if (!context.allowMissingTrunkPrefix) {
      return { ok: false, reason: "invalid_prefix" };
    }
  }

  if (context.stripExtraLeadingZeros) {
    digits = digits.replace(/^0+/, "");
  }

  if (!digits) return { ok: false, reason: "invalid_prefix" };

  return {
    ok: true,
    normalized: `+${defaultCountry.dial_code}${digits}`,
    nationalNumber: digits,
    country: defaultCountry,
    isInternational: false,
  };
}

function normalizeRuleDialCode(rule: InjectionRule): string {
  const digits = extractDigits(rule.dialCode);
  return digits;
}

function matchLength(rule: InjectionRule, length: number): boolean {
  if (rule.lengthMode === "equals") {
    if (typeof rule.lengthEquals !== "number") return false;
    return length === rule.lengthEquals;
  }

  if (typeof rule.lengthMin !== "number" && typeof rule.lengthMax !== "number") {
    return false;
  }

  const min = rule.lengthMin ?? 0;
  const max = rule.lengthMax ?? Number.MAX_SAFE_INTEGER;
  return length >= min && length <= max;
}

function matchPrefixes(rule: InjectionRule, digits: string): boolean {
  if (rule.prefixes.length === 0) return true;
  return rule.prefixes.some((prefix) => {
    const normalized = extractDigits(prefix);
    if (!normalized) return false;
    return digits.startsWith(normalized);
  });
}

export function applyConditionalInjection(
  localDigits: string,
  rules: InjectionRule[]
): InjectionMatchResult {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    const dialDigits = normalizeRuleDialCode(rule);
    if (!dialDigits) continue;

    if (!matchLength(rule, localDigits.length)) continue;
    if (!matchPrefixes(rule, localDigits)) continue;

    let nationalNumber = localDigits;
    if (rule.trunkHandling === "removeLeading0" && nationalNumber.startsWith("0")) {
      nationalNumber = nationalNumber.slice(1);
    }

    if (!nationalNumber) continue;

    return {
      matched: true,
      ruleId: rule.id,
      ruleName: rule.name,
      dialCodeDigits: dialDigits,
      nationalNumber,
      normalizedE164: `+${dialDigits}${nationalNumber}`,
    };
  }

  return { matched: false };
}

export function validateLength(
  normalized: NormalizationSuccess,
  strictMode: boolean
): NormalizationResult {
  const totalDigits = normalized.normalized.replace(/^\+/, "").length;
  const nationalLength = normalized.nationalNumber.length;

  const min = normalized.country?.national_number_length_min;
  const max = normalized.country?.national_number_length_max;

  if (min && nationalLength < min) {
    if (!strictMode && totalDigits >= GENERIC_MIN_LENGTH) {
      return normalized;
    }
    return { ok: false, reason: "too_short" };
  }

  if (max && nationalLength > max) {
    if (!strictMode && totalDigits <= GENERIC_MAX_LENGTH) {
      return normalized;
    }
    return { ok: false, reason: "too_long" };
  }

  if (!min && totalDigits < GENERIC_MIN_LENGTH) {
    return { ok: false, reason: "too_short" };
  }

  if (!max && totalDigits > GENERIC_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  return normalized;
}
