import type { Country, InvalidReason, NormalizationOptions } from "./types";
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
