"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type HistoryEntry = {
  id: string;
  createdAt: number;
  stats: CleaningStats;
  settings: CleaningSettings;
  inputSample?: string;
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

  const [settings, setSettings] = useState<CleaningSettings>({
    defaultCountryIso2: DEFAULT_COUNTRY_ISO2,
    strictMode: true,
    allowMissingTrunkPrefix: true,
    stripExtraLeadingZeros: false,
    detectNameDuplicates: false,
    presetId: "saudi",
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
        row.raw ?? "",
      ])
    );

    downloadTextFile("duplicates.csv", stringifyCsv([header, ...rows]));
  };

  const handleDownloadInvalid = () => {
    if (!report) return;
    const header = ["row_index", "raw_line", "reason"];
    const rows = report.invalid.map((row) => [
      String(row.index),
      row.raw ?? "",
      row.reason ?? "",
    ]);
    downloadTextFile("invalid.csv", stringifyCsv([header, ...rows]));
  };

  return (
    <div className="min-h-screen bg-[#f7f2e8] text-slate-900">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.12),_transparent_55%)]" />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
            Phone Cleaner
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t(locale, "app_title")}
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            {t(locale, "app_subtitle")}
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                {t(locale, "input_title")}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleClipboardImport}
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-300"
                >
                  {t(locale, "clipboard_import")}
                </button>
                <label className="cursor-pointer rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-300">
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
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-300"
                >
                  {t(locale, "reset")}
                </button>
              </div>
            </div>

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t(locale, "input_placeholder")}
              className="h-64 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
            />
            <p className="mt-3 text-xs text-slate-500">
              {t(locale, "input_hint")}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleClean}
                disabled={isProcessing}
                className="rounded-full bg-teal-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-400"
              >
                {t(locale, "run_clean")}
              </button>
              {isProcessing && (
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{t(locale, "progress_label")}</span>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-teal-600"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span>{progressPercent}%</span>
                </div>
              )}
              {error && (
                <span className="text-xs text-rose-600">{error}</span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">
              {t(locale, "settings_title")}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {t(locale, "preset_label")}
                </label>
                <select
                  value={presetValue}
                  onChange={(event) => handlePresetChange(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="custom">{t(locale, "preset_custom")}</option>
                  {PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label_ar}
                    </option>
                  ))}
                </select>
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

              <div className="grid gap-3">
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <span>{t(locale, "strict_mode")}</span>
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

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <span>{t(locale, "allow_missing_trunk")}</span>
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

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <span>{t(locale, "strip_extra_zeros")}</span>
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

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <span>{t(locale, "detect_name_duplicates")}</span>
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

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <span>{t(locale, "save_input_opt_in")}</span>
                  <input
                    type="checkbox"
                    checked={storeInput}
                    onChange={(event) => setStoreInput(event.target.checked)}
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                <strong className="block text-slate-600">
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
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div>
                          <div className="text-xs text-slate-600">
                            {formatDate(entry.createdAt)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            صالح: {entry.stats.valid} | مكرر: {entry.stats.duplicate} | غير صالح:{" "}
                            {entry.stats.invalid}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSettings(entry.settings);
                            }}
                            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-500"
                          >
                            {t(locale, "restore_settings")}
                          </button>
                          {entry.inputSample && (
                            <button
                              type="button"
                              onClick={() => setInput(entry.inputSample ?? "")}
                              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-500"
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

            <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-700">
                  {t(locale, "results_title")}
                </h2>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t(locale, "search_results")}
                  className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
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
