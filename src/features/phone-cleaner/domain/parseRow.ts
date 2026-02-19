import type { InputHints, ParsedRow } from "./types";
import { extractDigits, toWesternDigits } from "../utils/arabicDigits";
import { collapseSpaces } from "../utils/strings";

const SEPARATOR_REGEX = /[|,;]+/;
const DASH_SEPARATOR_REGEX = /\s[-–—]\s/;
const PHONE_LIKE_REGEX = /(\+|00)?\d[\d\s()./_-]{4,}\d/g;

function pickPhoneIndex(parts: string[]): number {
  let bestIndex = 0;
  let bestScore = 0;
  parts.forEach((part, index) => {
    const score = extractDigits(part).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function splitWithOriginal(
  raw: string,
  normalized: string,
  regex: RegExp
): { rawParts: string[]; normalizedParts: string[] } {
  const rawParts = raw.split(regex).map((part) => collapseSpaces(part));
  const normalizedParts = normalized
    .split(regex)
    .map((part) => collapseSpaces(part));
  return { rawParts, normalizedParts };
}

export function parseRow(
  line: string,
  index: number,
  hints?: InputHints
): ParsedRow {
  const raw = line ?? "";
  const trimmedRaw = raw.trim();
  const normalizedLine = toWesternDigits(trimmedRaw);

  if (!trimmedRaw) {
    return { index, raw, name: "", phoneRaw: "" };
  }

  const separatorLike = hints?.separatorLike ?? false;
  const csvLike = hints?.csvLike ?? false;

  if (separatorLike || csvLike || SEPARATOR_REGEX.test(normalizedLine)) {
    const { rawParts, normalizedParts } = splitWithOriginal(
      trimmedRaw,
      normalizedLine,
      SEPARATOR_REGEX
    );
    if (normalizedParts.length >= 2) {
      const phoneIndex = pickPhoneIndex(normalizedParts);
      const phoneRaw = rawParts[phoneIndex] ?? normalizedParts[phoneIndex] ?? "";
      const nameParts = rawParts.filter((_, idx) => idx !== phoneIndex);
      const name = collapseSpaces(nameParts.join(" "));
      return { index, raw, name, phoneRaw };
    }
  }

  if (DASH_SEPARATOR_REGEX.test(normalizedLine)) {
    const { rawParts, normalizedParts } = splitWithOriginal(
      trimmedRaw,
      normalizedLine,
      DASH_SEPARATOR_REGEX
    );
    if (normalizedParts.length >= 2) {
      const phoneIndex = pickPhoneIndex(normalizedParts);
      const phoneRaw = rawParts[phoneIndex] ?? normalizedParts[phoneIndex] ?? "";
      const nameParts = rawParts.filter((_, idx) => idx !== phoneIndex);
      const name = collapseSpaces(nameParts.join(" "));
      return { index, raw, name, phoneRaw };
    }
  }

  const matches = [...normalizedLine.matchAll(PHONE_LIKE_REGEX)];
  if (matches.length > 0) {
    const bestMatch = matches.reduce((best, current) => {
      const currentDigits = extractDigits(current[0]).length;
      const bestDigits = extractDigits(best[0]).length;
      return currentDigits > bestDigits ? current : best;
    }, matches[0]);

    const matchText = bestMatch[0];
    const startIndex = bestMatch.index ?? 0;
    const endIndex = startIndex + matchText.length;
    const phoneRaw = trimmedRaw.slice(startIndex, endIndex).trim();
    const nameRaw =
      trimmedRaw.slice(0, startIndex) + trimmedRaw.slice(endIndex);
    const name = collapseSpaces(nameRaw.replace(/^[,\-|]+|[,\-|]+$/g, ""));

    return { index, raw, name, phoneRaw };
  }

  const digits = extractDigits(normalizedLine);
  if (digits.length > 0) {
    return { index, raw, name: "", phoneRaw: trimmedRaw };
  }

  return { index, raw, name: collapseSpaces(trimmedRaw), phoneRaw: "" };
}
