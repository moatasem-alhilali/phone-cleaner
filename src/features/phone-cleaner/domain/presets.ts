import type { Preset } from "./types";

export const PRESETS: Preset[] = [
  {
    id: "saudi",
    label_ar: "الإعداد السعودي",
    label_en: "Saudi preset",
    description_ar: "يفرض طول 9 أرقام مع بادئة محلية 0.",
    default_country_iso2: "SA",
    country_overrides: {
      trunk_prefix: "0",
      national_number_length_min: 9,
      national_number_length_max: 9,
    },
  },
  {
    id: "yemen",
    label_ar: "الإعداد اليمني",
    label_en: "Yemen preset",
    description_ar: "يفرض طول 9 أرقام مع بادئة محلية 0.",
    default_country_iso2: "YE",
    country_overrides: {
      trunk_prefix: "0",
      national_number_length_min: 9,
      national_number_length_max: 9,
    },
  },
  {
    id: "uae",
    label_ar: "الإعداد الإماراتي",
    label_en: "UAE preset",
    description_ar: "يفرض طول 9 أرقام مع بادئة محلية 0.",
    default_country_iso2: "AE",
    country_overrides: {
      trunk_prefix: "0",
      national_number_length_min: 9,
      national_number_length_max: 9,
    },
  },
  {
    id: "egypt",
    label_ar: "الإعداد المصري",
    label_en: "Egypt preset",
    description_ar: "يفرض طول 10 أرقام مع بادئة محلية 0.",
    default_country_iso2: "EG",
    country_overrides: {
      trunk_prefix: "0",
      national_number_length_min: 10,
      national_number_length_max: 10,
    },
  },
];

export function getPresetById(presetId?: string): Preset | undefined {
  if (!presetId) return undefined;
  return PRESETS.find((preset) => preset.id === presetId);
}
