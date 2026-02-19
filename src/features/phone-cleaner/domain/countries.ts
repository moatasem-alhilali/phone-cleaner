import type { Country } from "./types";
import countriesData from "./countries.json";

export const COUNTRIES: Country[] = countriesData as Country[];

export const DEFAULT_COUNTRY_ISO2 = "SA";

export const GENERIC_MIN_LENGTH = 7;
export const GENERIC_MAX_LENGTH = 15;

export function getCountryByIso2(
  countries: Country[],
  iso2: string,
  override?: Partial<Country>
): Country | undefined {
  const base = countries.find((country) => country.iso2 === iso2.toUpperCase());
  if (!base) return undefined;
  if (!override) return base;
  return { ...base, ...override };
}

export function sortCountriesByDialCode(countries: Country[]): Country[] {
  return [...countries].sort(
    (a, b) => b.dial_code.length - a.dial_code.length
  );
}

export function resolveCountryByDialCode(
  countries: Country[],
  digits: string,
  override?: Partial<Country>
): Country | undefined {
  const match = countries.find((country) => digits.startsWith(country.dial_code));
  if (!match) return undefined;
  if (!override || override.iso2 !== match.iso2) return match;
  return { ...match, ...override };
}

export function applyCountryOverride(
  countries: Country[],
  iso2?: string,
  override?: Partial<Country>
): Country[] {
  if (!iso2 || !override) return countries;
  return countries.map((country) =>
    country.iso2 === iso2 ? { ...country, ...override } : country
  );
}
