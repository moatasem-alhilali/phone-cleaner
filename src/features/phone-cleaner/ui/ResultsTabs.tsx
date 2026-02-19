import type {
  CleaningReport,
  DuplicateGroup,
  NormalizedRow,
} from "../domain/types";
import type { Locale } from "./i18n";
import { t } from "./i18n";

export type ResultsFilter = "all" | "valid" | "duplicate" | "invalid";

type ResultsTabsProps = {
  locale: Locale;
  report: CleaningReport;
  filter: ResultsFilter;
  onFilterChange: (filter: ResultsFilter) => void;
  cleanRows: NormalizedRow[];
  invalidRows: NormalizedRow[];
  duplicateGroupsByPhone: DuplicateGroup[];
  duplicateGroupsByNamePhone: DuplicateGroup[];
  duplicateGroupsByName: DuplicateGroup[];
  useConditionalInjection: boolean;
  onCopyPhones: () => void;
  onCopyCsv: () => void;
  onDownloadClean: () => void;
  onDownloadDuplicates: () => void;
  onDownloadInvalid: () => void;
  copyState: string | null;
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const colorMap: Record<string, string> = {
    success: "chip chip-success",
    warning: "chip chip-warning",
    danger: "chip chip-danger",
    neutral: "chip",
  };
  return (
    <span className={colorMap[tone] ?? colorMap.neutral}>{label}</span>
  );
}

function reasonLabel(locale: Locale, reason?: string): string {
  if (!reason) return "";
  return t(locale, `reason_${reason}`);
}

function ruleLabel(row: NormalizedRow, useConditionalInjection: boolean): string {
  if (row.matchedRuleName) return row.matchedRuleName;
  if (row.matchedRuleDialCode) return row.matchedRuleDialCode;
  if (useConditionalInjection) {
    if (row.reason === "no_rule_match") return "بدون قاعدة";
    if (row.status === "valid") return "افتراضي";
  }
  return "—";
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-soft">{text}</div>;
}

export function ResultsTabs({
  locale,
  report,
  filter,
  onFilterChange,
  cleanRows,
  invalidRows,
  duplicateGroupsByPhone,
  duplicateGroupsByNamePhone,
  duplicateGroupsByName,
  useConditionalInjection,
  onCopyPhones,
  onCopyCsv,
  onDownloadClean,
  onDownloadDuplicates,
  onDownloadInvalid,
  copyState,
}: ResultsTabsProps) {
  return (
    <section className="surface-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === "all"
                ? "bg-[var(--text)] text-[var(--surface-strong)]"
                : "bg-[var(--surface-muted)] text-muted"
            }`}
          >
            {t(locale, "filter_all")}
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("valid")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === "valid"
                ? "bg-[var(--success)] text-white"
                : "bg-[var(--success-soft)] text-[var(--success)]"
            }`}
          >
            {t(locale, "filter_valid")}
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("duplicate")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === "duplicate"
                ? "bg-[var(--warning)] text-white"
                : "bg-[var(--warning-soft)] text-[var(--warning)]"
            }`}
          >
            {t(locale, "filter_duplicates")}
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("invalid")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === "invalid"
                ? "bg-[var(--danger)] text-white"
                : "bg-[var(--danger-soft)] text-[var(--danger)]"
            }`}
          >
            {t(locale, "filter_invalid")}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={onCopyPhones}
            className="btn-outline px-3 py-2"
          >
            {copyState === "phones" ? "✓" : t(locale, "copy_phones")}
          </button>
          <button
            type="button"
            onClick={onCopyCsv}
            className="btn-outline px-3 py-2"
          >
            {copyState === "csv" ? "✓" : t(locale, "copy_csv")}
          </button>
          <button
            type="button"
            onClick={onDownloadClean}
            className="btn-outline px-3 py-2"
          >
            {t(locale, "download_clean")}
          </button>
          <button
            type="button"
            onClick={onDownloadDuplicates}
            className="btn-outline px-3 py-2"
          >
            {t(locale, "download_duplicates")}
          </button>
          <button
            type="button"
            onClick={onDownloadInvalid}
            className="btn-outline px-3 py-2"
          >
            {t(locale, "download_invalid")}
          </button>
        </div>
      </div>

      {(filter === "all" || filter === "valid") && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
            {t(locale, "clean_results")} ({report.unique.length})
          </h3>
          {cleanRows.length === 0 ? (
            <EmptyState text="لا توجد نتائج." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2 text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="text-right">#</th>
                    <th className="text-right">الاسم</th>
                    <th className="text-left">الهاتف</th>
                    <th className="text-right">القاعدة</th>
                  </tr>
                </thead>
                <tbody>
                  {cleanRows.map((row) => (
                    <tr key={`clean-${row.index}`} className="surface-muted">
                      <td className="rounded-r-xl px-3 py-2 text-xs text-muted">
                        {row.index}
                      </td>
                      <td className="px-3 py-2 text-[var(--text)]">
                        {row.name || "—"}
                      </td>
                      <td className="rounded-l-xl px-3 py-2 font-mono text-left text-[var(--text)]">
                        {row.normalized}
                      </td>
                      <td className="px-3 py-2 text-xs text-soft">
                        {ruleLabel(row, useConditionalInjection)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(filter === "all" || filter === "duplicate") && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
            {t(locale, "duplicate_by_phone")} ({report.duplicateGroupsByPhone.length})
          </h3>
          {duplicateGroupsByPhone.length === 0 ? (
            <EmptyState text="لا توجد مكررات." />
          ) : (
            <div className="space-y-4">
              {duplicateGroupsByPhone.map((group) => (
                <div
                  key={group.id}
                  className="surface-muted p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge label={group.key} tone="warning" />
                      <span className="text-xs text-muted">
                        {group.items.length} عنصر
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((row) => (
                      <div
                        key={`dup-${row.index}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-strong)] px-3 py-2 text-xs"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-muted">#{row.index}</span>
                            <span className="text-[var(--text)]">
                              {row.name || "—"}
                            </span>
                            <span className="font-mono text-muted" dir="ltr">
                              {row.normalized}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-soft">
                            <span>خام: {row.phoneRaw || "—"}</span>
                            <span className="truncate">السطر: {row.raw || "—"}</span>
                            <span>قاعدة: {ruleLabel(row, useConditionalInjection)}</span>
                          </div>
                        </div>
                        <span className="text-soft">
                          {row.isKept ? t(locale, "kept") : t(locale, "removed")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {duplicateGroupsByNamePhone.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 text-xs font-semibold text-muted">
                {t(locale, "duplicate_by_name_phone")} ({
                  report.duplicateGroupsByNamePhone.length
                })
              </h4>
              <div className="space-y-3">
                {duplicateGroupsByNamePhone.map((group) => (
                  <div
                    key={group.id}
                    className="surface-muted p-3"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                      <span>{group.key.split("__")[1] ?? "—"}</span>
                      <span className="font-mono text-soft" dir="ltr">
                        {group.key.split("__")[0] ?? ""}
                      </span>
                      <span className="text-soft">{group.items.length} عنصر</span>
                    </div>
                    <div className="space-y-1">
                      {group.items.map((row) => (
                        <div
                          key={`name-phone-${row.index}`}
                          className="flex items-center justify-between rounded-lg bg-[var(--surface-strong)] px-3 py-2 text-xs"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[var(--text)]">
                              {row.name || "—"}
                            </span>
                            <span className="text-[10px] text-soft">
                              قاعدة: {ruleLabel(row, useConditionalInjection)}
                            </span>
                          </div>
                          <span className="font-mono text-soft" dir="ltr">
                            {row.normalized}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {duplicateGroupsByName.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 text-xs font-semibold text-muted">
                {t(locale, "duplicate_by_name")} ({
                  report.duplicateGroupsByName.length
                })
              </h4>
              <div className="space-y-3">
                {duplicateGroupsByName.map((group) => (
                  <div
                    key={group.id}
                    className="surface-muted p-3"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                      <span>{group.key}</span>
                      <span className="text-soft">{group.items.length} عنصر</span>
                    </div>
                    <div className="space-y-1">
                      {group.items.map((row) => (
                        <div
                          key={`name-${row.index}`}
                          className="flex items-center justify-between rounded-lg bg-[var(--surface-strong)] px-3 py-2 text-xs"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[var(--text)]">
                              {row.name || "—"}
                            </span>
                            <span className="text-[10px] text-soft">
                              قاعدة: {ruleLabel(row, useConditionalInjection)}
                            </span>
                          </div>
                          <span className="font-mono text-soft" dir="ltr">
                            {row.normalized}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(filter === "all" || filter === "invalid") && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
            {t(locale, "invalid")} ({report.invalid.length})
          </h3>
          {invalidRows.length === 0 ? (
            <EmptyState text="لا توجد عناصر غير صالحة." />
          ) : (
            <div className="space-y-2">
              {invalidRows.map((row) => (
                <div
                  key={`invalid-${row.index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--danger)]">#{row.index}</span>
                    <span className="text-[var(--danger)]">{row.raw || "—"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[var(--danger)]">
                    <span>{reasonLabel(locale, row.reason)}</span>
                    <span>قاعدة: {ruleLabel(row, useConditionalInjection)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
