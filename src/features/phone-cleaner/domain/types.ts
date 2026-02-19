export type InvalidReason =
  | "empty"
  | "no_digits"
  | "too_short"
  | "too_long"
  | "invalid_prefix"
  | "ambiguous";

export type RowStatus = "valid" | "invalid" | "duplicate";

export type Country = {
  iso2: string;
  name_en: string;
  name_ar: string;
  dial_code: string;
  trunk_prefix?: string;
  national_number_length_min?: number;
  national_number_length_max?: number;
};

export type Preset = {
  id: string;
  label_ar: string;
  label_en: string;
  description_ar: string;
  default_country_iso2: string;
  country_overrides?: Partial<Country>;
  options?: Partial<NormalizationOptions>;
};

export type NormalizationOptions = {
  defaultCountryIso2: string;
  strictMode: boolean;
  allowMissingTrunkPrefix: boolean;
  stripExtraLeadingZeros: boolean;
};

export type CleaningSettings = NormalizationOptions & {
  detectNameDuplicates: boolean;
  presetId?: string;
};

export type ParsedRow = {
  index: number;
  raw: string;
  name: string;
  phoneRaw: string;
};

export type NormalizedRow = ParsedRow & {
  status: RowStatus;
  reason?: InvalidReason;
  normalized?: string;
  nationalNumber?: string;
  country?: Country;
  nameNormalized?: string;
  isKept?: boolean;
};

export type DuplicateGroup = {
  id: string;
  key: string;
  canonicalPhone?: string;
  items: NormalizedRow[];
  keptIndex: number;
};

export type CleaningStats = {
  total: number;
  valid: number;
  unique: number;
  duplicate: number;
  invalid: number;
};

export type CleaningReport = {
  rows: NormalizedRow[];
  unique: NormalizedRow[];
  duplicates: NormalizedRow[];
  invalid: NormalizedRow[];
  duplicateGroupsByPhone: DuplicateGroup[];
  duplicateGroupsByNamePhone: DuplicateGroup[];
  duplicateGroupsByName: DuplicateGroup[];
  stats: CleaningStats;
  hints: InputHints;
  createdAt: number;
  durationMs: number;
};

export type InputHints = {
  csvLike: boolean;
  separatorLike: boolean;
};

export type WorkerRequest = {
  input: string;
  settings: CleaningSettings;
};

export type WorkerProgressMessage = {
  type: "progress";
  processed: number;
  total: number;
};

export type WorkerDoneMessage = {
  type: "done";
  report: CleaningReport;
};

export type WorkerErrorMessage = {
  type: "error";
  message: string;
};

export type WorkerResponse =
  | WorkerProgressMessage
  | WorkerDoneMessage
  | WorkerErrorMessage;
