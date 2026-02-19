"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import logo from "@/app/logo.png";
import {
  COUNTRIES,
  DEFAULT_COUNTRY_ISO2,
} from "../domain/countries";
import { PRESETS } from "../domain/presets";
import type {
  CleaningReport,
  CleaningSettings,
  CleaningStats,
  DuplicateGroup,
  InjectionRule,
  NormalizedRow,
  WorkerResponse,
} from "../domain/types";
import { CountrySelect } from "./CountrySelect";
import { StatsBar } from "./StatsBar";
import { ResultsTabs, type ResultsFilter } from "./ResultsTabs";
import { parseCsv, stringifyCsv } from "../utils/csv";
import { downloadTextFile } from "../utils/download";
import { t, type Locale } from "./i18n";

const HISTORY_KEY = "phone-cleaner.history";
const THEME_KEY = "phone-cleaner.theme";
const INJECTION_KEY = "phone-cleaner.injection-settings";

const DEFAULT_INJECTION_RULES: InjectionRule[] = [
  {
    id: "rule_saudi_mobile",
    name: "سعودي موبايل",
    dialCode: "+966",
    lengthMode: "equals",
    lengthEquals: 10,
    prefixes: ["05"],
    trunkHandling: "removeLeading0",
    matchStrategy: "firstMatchWins",
    enabled: true,
  },
  {
    id: "rule_yemen_local",
    name: "يمن محلي",
    dialCode: "+967",
    lengthMode: "equals",
    lengthEquals: 9,
    prefixes: ["77", "73", "71"],
    trunkHandling: "keep",
    matchStrategy: "firstMatchWins",
    enabled: true,
  },
];

const createRuleId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

type HistoryEntry = {
  id: string;
  createdAt: number;
  stats: CleaningStats;
  settings: CleaningSettings;
  inputSample?: string;
};

type InjectionSettingsStorage = {
  useConditionalInjection?: boolean;
  ignoreUnmatched?: boolean;
  fallbackToDefault?: boolean;
  injectionRules?: InjectionRule[];
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PhoneCleanerPage() {
  const locale: Locale = "ar";
  const [input, setInput] = useState("");
  const [report, setReport] = useState<CleaningReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResultsFilter>("all");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as HistoryEntry[];
    } catch {
      return [];
    }
  });
  const [storeInput, setStoreInput] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [settings, setSettings] = useState<CleaningSettings>({
    defaultCountryIso2: DEFAULT_COUNTRY_ISO2,
    strictMode: true,
    allowMissingTrunkPrefix: true,
    stripExtraLeadingZeros: false,
    detectNameDuplicates: false,
    presetId: "saudi",
    useConditionalInjection: false,
    ignoreUnmatched: true,
    fallbackToDefault: false,
    injectionRules: DEFAULT_INJECTION_RULES,
  });

  const workerRef = useRef<Worker | null>(null);
  const inputRef = useRef(input);
  const settingsRef = useRef(settings);
  const storeInputRef = useRef(storeInput);

  const saveHistory = useCallback((newReport: CleaningReport) => {
    const entry: HistoryEntry = {
      id: `${Date.now()}`,
      createdAt: newReport.createdAt,
      stats: newReport.stats,
      settings: settingsRef.current,
      inputSample: storeInputRef.current
        ? inputRef.current.slice(0, 5000)
        : undefined,
    };

    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 5);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    storeInputRef.current = storeInput;
  }, [storeInput]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
      return;
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(INJECTION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as InjectionSettingsStorage;
      if (!parsed) return;
      setSettings((prev) => ({
        ...prev,
        useConditionalInjection:
          typeof parsed.useConditionalInjection === "boolean"
            ? parsed.useConditionalInjection
            : prev.useConditionalInjection,
        ignoreUnmatched:
          typeof parsed.ignoreUnmatched === "boolean"
            ? parsed.ignoreUnmatched
            : prev.ignoreUnmatched,
        fallbackToDefault:
          typeof parsed.fallbackToDefault === "boolean"
            ? parsed.fallbackToDefault
            : prev.fallbackToDefault,
        injectionRules: Array.isArray(parsed.injectionRules)
          ? (parsed.injectionRules as InjectionRule[])
          : prev.injectionRules,
      }));
    } catch {
      // ignore invalid local storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      useConditionalInjection: settings.useConditionalInjection,
      ignoreUnmatched: settings.ignoreUnmatched,
      fallbackToDefault: settings.fallbackToDefault,
      injectionRules: settings.injectionRules,
    };
    window.localStorage.setItem(INJECTION_KEY, JSON.stringify(payload));
  }, [
    settings.useConditionalInjection,
    settings.ignoreUnmatched,
    settings.fallbackToDefault,
    settings.injectionRules,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const worker = new Worker(
      new URL("../workers/cleaner.worker.ts", import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        setProgress({ processed: message.processed, total: message.total });
      }
      if (message.type === "done") {
        setReport(message.report);
        setIsProcessing(false);
        setProgress({
          processed: message.report.stats.total,
          total: message.report.stats.total,
        });
        setError(null);
        saveHistory(message.report);
      }
      if (message.type === "error") {
        setError(message.message);
        setIsProcessing(false);
      }
    };

    return () => {
      worker.terminate();
    };
  }, [saveHistory]);

  const presetValue = settings.presetId ?? "custom";

  const progressPercent = progress.total
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : 0;

  const normalizeDialCodeInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  };

  const updateRule = (id: string, patch: Partial<InjectionRule>) => {
    setSettings((prev) => ({
      ...prev,
      injectionRules: prev.injectionRules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule
      ),
    }));
  };

  const removeRule = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      injectionRules: prev.injectionRules.filter((rule) => rule.id !== id),
    }));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    setSettings((prev) => {
      const next = [...prev.injectionRules];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [removed] = next.splice(index, 1);
      next.splice(targetIndex, 0, removed);
      return { ...prev, injectionRules: next };
    });
  };

  const addRule = () => {
    const newRule: InjectionRule = {
      id: createRuleId(),
      name: "",
      dialCode: "",
      lengthMode: "equals",
      lengthEquals: 10,
      prefixes: [],
      trunkHandling: "keep",
      matchStrategy: "firstMatchWins",
      enabled: true,
    };
    setSettings((prev) => ({
      ...prev,
      injectionRules: [...prev.injectionRules, newRule],
    }));
  };

  const getRuleErrors = (rule: InjectionRule): string[] => {
    const errors: string[] = [];
    const dialDigits = rule.dialCode.replace(/\D/g, "");
    if (!dialDigits) {
      errors.push("أدخل كود دولة صالح.");
    }
    if (rule.lengthMode === "equals") {
      if (!rule.lengthEquals || rule.lengthEquals <= 0) {
        errors.push("حدد طولًا صحيحًا.");
      }
    } else {
      if (
        (rule.lengthMin ?? 0) <= 0 &&
        (rule.lengthMax ?? 0) <= 0
      ) {
        errors.push("حدد نطاق طول صالح.");
      }
      if (
        rule.lengthMin &&
        rule.lengthMax &&
        rule.lengthMin > rule.lengthMax
      ) {
        errors.push("النطاق غير صحيح (الحد الأدنى أكبر من الأعلى).");
      }
    }
    return errors;
  };

  const handlePresetChange = (presetId: string) => {
    if (presetId === "custom") {
      setSettings((prev) => ({ ...prev, presetId: undefined }));
      return;
    }
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setSettings((prev) => ({
      ...prev,
      presetId: preset.id,
      defaultCountryIso2: preset.default_country_iso2,
      ...preset.options,
    }));
  };

  const handleClean = () => {
    const worker = workerRef.current;
    if (!worker) return;

    setIsProcessing(true);
    setError(null);
    setReport(null);
    setProgress({ processed: 0, total: input.split(/\r?\n/).length });

    worker.postMessage({
      input,
      settings,
    });
  };

  const handleReset = () => {
    setInput("");
    setReport(null);
    setQuery("");
    setFilter("all");
    setError(null);
    setIsProcessing(false);
  };

  const handleClipboardImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text);
      }
    } catch {
      setError("تعذر الوصول إلى الحافظة.");
    }
  };

  const handleCsvUpload = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) return;

    const headerKeywords = [
      "name",
      "phone",
      "mobile",
      "number",
      "اسم",
      "هاتف",
      "جوال",
      "رقم",
    ];

    const firstRow = rows[0] ?? [];
    const hasHeader = firstRow.some((cell) =>
      headerKeywords.some((keyword) => cell.toLowerCase().includes(keyword))
    );

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const lines = dataRows.map((row) => row.join(", ")).join("\n");
    setInput(lines);
  };


  const filtered = useMemo(() => {
    if (!report) {
      return {
        cleanRows: [] as NormalizedRow[],
        invalidRows: [] as NormalizedRow[],
        duplicateGroupsByPhone: [] as DuplicateGroup[],
        duplicateGroupsByNamePhone: [] as DuplicateGroup[],
        duplicateGroupsByName: [] as DuplicateGroup[],
      };
    }

    const term = query.trim().toLowerCase();
    const matchesRow = (row: NormalizedRow) => {
      if (!term) return true;
      return (
        (row.normalized ?? "").toLowerCase().includes(term) ||
        (row.name ?? "").toLowerCase().includes(term) ||
        (row.raw ?? "").toLowerCase().includes(term)
      );
    };

    const filterGroup = (group: DuplicateGroup) => {
      if (!term) return true;
      return group.items.some(matchesRow);
    };

    return {
      cleanRows: report.unique.filter(matchesRow),
      invalidRows: report.invalid.filter(matchesRow),
      duplicateGroupsByPhone: report.duplicateGroupsByPhone.filter(filterGroup),
      duplicateGroupsByNamePhone: report.duplicateGroupsByNamePhone.filter(
        filterGroup
      ),
      duplicateGroupsByName: report.duplicateGroupsByName.filter(filterGroup),
    };
  }, [query, report]);

  const handleCopy = async (type: "phones" | "csv") => {
    if (!report) return;

    try {
      if (type === "phones") {
        const text = report.unique
          .map((row) => row.normalized)
          .filter(Boolean)
          .join("\n");
        await navigator.clipboard.writeText(text);
      } else {
        const rows = [
          ["name", "phone"],
          ...report.unique.map((row) => [row.name ?? "", row.normalized ?? ""]),
        ];
        await navigator.clipboard.writeText(stringifyCsv(rows));
      }

      setCopyState(type);
      setTimeout(() => setCopyState(null), 1500);
    } catch {
      setError("تعذر النسخ إلى الحافظة.");
    }
  };

  const ruleLabelForExport = (row: NormalizedRow) => {
    if (row.matchedRuleName) return row.matchedRuleName;
    if (row.matchedRuleId) return row.matchedRuleId;
    if (row.matchedRuleDialCode) return row.matchedRuleDialCode;
    if (settings.useConditionalInjection && row.reason === "no_rule_match") {
      return "no_rule_match";
    }
    return "";
  };

  const handleDownloadClean = () => {
    if (!report) return;
    const rows = [
      ["name", "phone"],
      ...report.unique.map((row) => [row.name ?? "", row.normalized ?? ""]),
    ];
    downloadTextFile("cleaned.csv", stringifyCsv(rows));
  };

  const handleDownloadDuplicates = () => {
    if (!report) return;
    const header = [
      "group_id",
      "canonical_phone",
      "status",
      "row_index",
      "name",
      "raw_phone",
      "normalized_phone",
      "matched_rule",
      "raw_line",
    ];

    const rows = report.duplicateGroupsByPhone.flatMap((group) =>
      group.items.map((row) => [
        group.id,
        group.canonicalPhone ?? "",
        row.isKept ? "kept" : "duplicate",
        String(row.index),
        row.name ?? "",
        row.phoneRaw ?? "",
        row.normalized ?? "",
        ruleLabelForExport(row),
        row.raw ?? "",
      ])
    );

    downloadTextFile("duplicates.csv", stringifyCsv([header, ...rows]));
  };

  const handleDownloadInvalid = () => {
    if (!report) return;
    const header = ["row_index", "raw_line", "reason", "matched_rule"];
    const rows = report.invalid.map((row) => [
      String(row.index),
      row.raw ?? "",
      row.reason ?? "",
      ruleLabelForExport(row),
    ]);
    downloadTextFile("invalid.csv", stringifyCsv([header, ...rows]));
  };

  return (
    <div className="min-h-screen text-[var(--text)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="surface-strong flex h-14 w-14 items-center justify-center rounded-xl p-1">
              <Image
                src={logo}
                alt="Phone Cleaner Logo"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            <div className="space-y-2">
              <div className="accent-pill">Phone Cleaner</div>
              <h1 className="text-3xl font-semibold text-[var(--text)]">
                {t(locale, "app_title")}
              </h1>
              <p className="max-w-2xl text-sm text-muted">
                {t(locale, "app_subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setTheme((prev) => (prev === "dark" ? "light" : "dark"))
            }
            className="btn-outline px-4 py-2 text-xs font-semibold"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark"
              ? t(locale, "theme_light")
              : t(locale, "theme_dark")}
          </button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text)]">
                {t(locale, "input_title")}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleClipboardImport}
                  className="btn-outline px-3 py-2 text-xs"
                >
                  {t(locale, "clipboard_import")}
                </button>
                <label className="btn-outline cursor-pointer px-3 py-2 text-xs">
                  {t(locale, "csv_upload")}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) =>
                      handleCsvUpload(event.target.files?.[0])
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-outline px-3 py-2 text-xs"
                >
                  {t(locale, "reset")}
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-soft">
              الصق الأرقام كما هي. يدعم: رقم فقط، أو اسم + رقم، أو CSV.
              لن يتم إرسال بياناتك لأي خادم.
            </p>

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t(locale, "input_placeholder")}
              className="input-base h-64 w-full resize-none px-4 py-3 text-sm"
            />
            <p className="mt-3 text-xs text-muted">
              {t(locale, "input_hint")}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleClean}
                disabled={isProcessing}
                className="btn-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t(locale, "run_clean")}
              </button>
              <div className="hidden h-8 w-px bg-[var(--border-strong)] lg:block" />
              {isProcessing && (
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{t(locale, "progress_label")}</span>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span>{progressPercent}%</span>
                </div>
              )}
              {error && (
                <span className="text-xs text-[var(--danger)]">{error}</span>
              )}
            </div>
          </div>

          <div className="surface-card p-6 lg:sticky lg:top-8">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">
              {t(locale, "settings_title")}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--text)]">
                  {t(locale, "preset_label")}
                </label>
                <select
                  value={presetValue}
                  onChange={(event) => handlePresetChange(event.target.value)}
                  className="input-base w-full px-4 py-3 text-sm"
                >
                  <option value="custom">{t(locale, "preset_custom")}</option>
                  {PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label_ar}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-soft">
                  يختار إعدادًا جاهزًا للدولة الافتراضية وطول الأرقام.
                </p>
              </div>

              <CountrySelect
                countries={COUNTRIES}
                value={settings.defaultCountryIso2}
                label={t(locale, "default_country")}
                placeholder="ابحث بالاسم أو الكود"
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultCountryIso2: value,
                    presetId: undefined,
                  }))
                }
              />
              <p className="text-xs text-soft">
                تُستخدم هذه الدولة عندما لا يوجد كود دولي ولا توجد قاعدة مطابقة.
              </p>

              <div className="grid gap-3">
                <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">
                      {t(locale, "strict_mode")}
                    </div>
                    <div className="text-xs text-soft">
                      يتحقق من طول الرقم حسب الدولة (أدق لكنه أكثر صرامة).
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.strictMode}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        strictMode: event.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">
                      {t(locale, "allow_missing_trunk")}
                    </div>
                    <div className="text-xs text-soft">
                      يقبل الأرقام المحلية حتى لو لم تبدأ بـ 0.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowMissingTrunkPrefix}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        allowMissingTrunkPrefix: event.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">
                      {t(locale, "strip_extra_zeros")}
                    </div>
                    <div className="text-xs text-soft">
                      يزيل الأصفار الزائدة من بداية الرقم المحلي.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.stripExtraLeadingZeros}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        stripExtraLeadingZeros: event.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">
                      {t(locale, "detect_name_duplicates")}
                    </div>
                    <div className="text-xs text-soft">
                      يعرض تكرار الاسم حتى لو اختلف الرقم.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.detectNameDuplicates}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        detectNameDuplicates: event.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">
                      {t(locale, "save_input_opt_in")}
                    </div>
                    <div className="text-xs text-soft">
                      يحفظ آخر نص محليًا لتسهيل الرجوع.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={storeInput}
                    onChange={(event) => setStoreInput(event.target.checked)}
                  />
                </label>
              </div>

              <div className="divider-line" />

                <div className="space-y-3">
                  <div>
                    <div className="section-title">
                      قواعد إضافة مفتاح الخط للأرقام بدون كود دولي
                    </div>
                    <div className="section-subtitle">
                      تطبق القواعد من الأعلى للأسفل، أول قاعدة مطابقة تفوز.
                      إذا لم يوجد + أو 00 سيتم اختبار القواعد فقط.
                    </div>
                  </div>

                <div className="grid gap-3">
                  <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        تطبيق قواعد الإضافة الشرطية بدل الدولة الافتراضية
                      </div>
                      <div className="text-xs text-soft">
                        عند تفعيله سيتم تجاهل الدولة الافتراضية للأرقام المحلية.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.useConditionalInjection}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          useConditionalInjection: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        تجاهل الأرقام غير المطابقة
                      </div>
                      <div className="text-xs text-soft">
                        إذا لم تطابق أي قاعدة سيتم وضعها ضمن \"غير صالح\".
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.ignoreUnmatched}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          ignoreUnmatched: event.target.checked,
                          fallbackToDefault: event.target.checked
                            ? false
                            : prev.fallbackToDefault,
                        }))
                      }
                    />
                  </label>
                  <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        الرجوع للدولة الافتراضية عند عدم التطابق
                      </div>
                      <div className="text-xs text-soft">
                        إن لم تنجح أي قاعدة، استخدم الدولة الافتراضية تلقائيًا.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.fallbackToDefault}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          fallbackToDefault: event.target.checked,
                          ignoreUnmatched: event.target.checked
                            ? false
                            : prev.ignoreUnmatched,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  {settings.injectionRules.map((rule, index) => {
                    const errors = getRuleErrors(rule);
                    const selectedCountry = COUNTRIES.find(
                      (country) => `+${country.dial_code}` === normalizeDialCodeInput(rule.dialCode)
                    );

                    return (
                      <div key={rule.id} className="surface-muted p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="section-title">
                            قاعدة #{index + 1}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => moveRule(index, -1)}
                              className="btn-outline px-3 py-1 text-xs"
                              disabled={index === 0}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRule(index, 1)}
                              className="btn-outline px-3 py-1 text-xs"
                              disabled={index === settings.injectionRules.length - 1}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRule(rule.id)}
                              className="btn-outline px-3 py-1 text-xs"
                            >
                              حذف
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <input
                            value={rule.name ?? ""}
                            onChange={(event) =>
                              updateRule(rule.id, { name: event.target.value })
                            }
                            placeholder="اسم القاعدة (اختياري)"
                            className="input-base px-3 py-2 text-sm"
                          />
                          <input
                            value={rule.dialCode}
                            onChange={(event) =>
                              updateRule(rule.id, {
                                dialCode: normalizeDialCodeInput(event.target.value),
                              })
                            }
                            placeholder="+966"
                            className="input-base px-3 py-2 text-sm"
                          />
                        </div>
                        <p className="mt-2 text-xs text-soft">
                          يمكنك اختيار دولة أو كتابة كود الاتصال يدويًا.
                        </p>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <CountrySelect
                            countries={COUNTRIES}
                            value={selectedCountry?.iso2 ?? ""}
                            label="اختيار دولة (يملأ كود الاتصال)"
                            onChange={(value) => {
                              const country = COUNTRIES.find(
                                (item) => item.iso2 === value
                              );
                              if (country) {
                                updateRule(rule.id, {
                                  dialCode: `+${country.dial_code}`,
                                });
                              }
                            }}
                          />
                          <div className="grid gap-2">
                            <label className="text-xs text-soft">تفعيل القاعدة</label>
                            <label className="surface-strong flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                              <span>مفعلة</span>
                              <input
                                type="checkbox"
                                checked={rule.enabled}
                                onChange={(event) =>
                                  updateRule(rule.id, { enabled: event.target.checked })
                                }
                              />
                            </label>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <div className="grid gap-2">
                            <label className="text-xs text-soft">نمط الطول</label>
                            <select
                              value={rule.lengthMode}
                              onChange={(event) =>
                                updateRule(rule.id, {
                                  lengthMode: event.target.value as "equals" | "range",
                                })
                              }
                              className="input-base px-3 py-2 text-sm"
                            >
                              <option value="equals">طول ثابت</option>
                              <option value="range">نطاق</option>
                            </select>
                          </div>
                          {rule.lengthMode === "equals" ? (
                            <div className="grid gap-2">
                              <label className="text-xs text-soft">الطول</label>
                              <input
                                type="number"
                                value={rule.lengthEquals ?? ""}
                                onChange={(event) =>
                                  updateRule(rule.id, {
                                    lengthEquals: event.target.value
                                      ? Number(event.target.value)
                                      : undefined,
                                  })
                                }
                                className="input-base px-3 py-2 text-sm"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="grid gap-2">
                                <label className="text-xs text-soft">الحد الأدنى</label>
                                <input
                                  type="number"
                                  value={rule.lengthMin ?? ""}
                                  onChange={(event) =>
                                    updateRule(rule.id, {
                                      lengthMin: event.target.value
                                        ? Number(event.target.value)
                                        : undefined,
                                    })
                                  }
                                  className="input-base px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-xs text-soft">الحد الأعلى</label>
                                <input
                                  type="number"
                                  value={rule.lengthMax ?? ""}
                                  onChange={(event) =>
                                    updateRule(rule.id, {
                                      lengthMax: event.target.value
                                        ? Number(event.target.value)
                                        : undefined,
                                    })
                                  }
                                  className="input-base px-3 py-2 text-sm"
                                />
                              </div>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-soft">
                          الطول يُحسب بعد تنظيف الأرقام وإزالة الرموز.
                        </p>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <label className="text-xs text-soft">البوادئ (مفصولة بفواصل)</label>
                            <input
                              value={rule.prefixes.join(",")}
                              onChange={(event) =>
                                updateRule(rule.id, {
                                  prefixes: event.target.value
                                    .split(",")
                                    .map((item) => item.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="05,5,7"
                              className="input-base px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs text-soft">تعامل مع بادئة 0</label>
                            <select
                              value={rule.trunkHandling}
                              onChange={(event) =>
                                updateRule(rule.id, {
                                  trunkHandling: event.target.value as
                                    | "keep"
                                    | "removeLeading0",
                                })
                              }
                              className="input-base px-3 py-2 text-sm"
                            >
                              <option value="keep">الإبقاء على 0</option>
                              <option value="removeLeading0">إزالة 0</option>
                            </select>
                          </div>
                        </div>
                        <p className="text-xs text-soft">
                          البوادئ تُختبر قبل إزالة 0. اختر إزالة 0 فقط إذا كان الرقم المحلي يبدأ بها دائمًا.
                        </p>

                        {errors.length > 0 && (
                          <div className="mt-3 text-xs text-[var(--danger)]">
                            {errors.map((err) => (
                              <div key={err}>{err}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addRule}
                  className="btn-outline px-4 py-2 text-xs font-semibold"
                >
                  إضافة قاعدة جديدة
                </button>
              </div>

              <div className="surface-strong px-4 py-3 text-xs text-muted">
                <strong className="block text-[var(--text)]">
                  {t(locale, "history_title")}
                </strong>
                {!mounted && <span>{t(locale, "history_empty")}</span>}
                {mounted && history.length === 0 && (
                  <span>{t(locale, "history_empty")}</span>
                )}
                {mounted && history.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="surface-muted flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <div>
                          <div className="text-xs text-[var(--text)]">
                            {formatDate(entry.createdAt)}
                          </div>
                          <div className="text-[11px] text-soft">
                            صالح: {entry.stats.valid} | مكرر: {entry.stats.duplicate} | غير صالح:{" "}
                            {entry.stats.invalid}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSettings((prev) => ({
                                ...prev,
                                ...entry.settings,
                                injectionRules:
                                  entry.settings.injectionRules ??
                                  prev.injectionRules,
                                useConditionalInjection:
                                  entry.settings.useConditionalInjection ??
                                  prev.useConditionalInjection,
                                ignoreUnmatched:
                                  entry.settings.ignoreUnmatched ??
                                  prev.ignoreUnmatched,
                                fallbackToDefault:
                                  entry.settings.fallbackToDefault ??
                                  prev.fallbackToDefault,
                              }));
                            }}
                            className="btn-outline px-3 py-1 text-[11px]"
                          >
                            {t(locale, "restore_settings")}
                          </button>
                          {entry.inputSample && (
                            <button
                              type="button"
                              onClick={() => setInput(entry.inputSample ?? "")}
                              className="btn-outline px-3 py-1 text-[11px]"
                            >
                              {t(locale, "restore_input")}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {report && (
          <section className="mt-8 space-y-6">
            <StatsBar stats={report.stats} />

            <div className="surface-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  {t(locale, "results_title")}
                </h2>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t(locale, "search_results")}
                  className="input-base w-full max-w-xs px-4 py-2 text-sm"
                />
              </div>
            </div>

            <ResultsTabs
              locale={locale}
              report={report}
              filter={filter}
              onFilterChange={setFilter}
              cleanRows={filtered.cleanRows}
              invalidRows={filtered.invalidRows}
              duplicateGroupsByPhone={filtered.duplicateGroupsByPhone}
              duplicateGroupsByNamePhone={filtered.duplicateGroupsByNamePhone}
              duplicateGroupsByName={filtered.duplicateGroupsByName}
              useConditionalInjection={settings.useConditionalInjection}
              onCopyPhones={() => handleCopy("phones")}
              onCopyCsv={() => handleCopy("csv")}
              onDownloadClean={handleDownloadClean}
              onDownloadDuplicates={handleDownloadDuplicates}
              onDownloadInvalid={handleDownloadInvalid}
              copyState={copyState}
            />
          </section>
        )}
      </div>
    </div>
  );
}
