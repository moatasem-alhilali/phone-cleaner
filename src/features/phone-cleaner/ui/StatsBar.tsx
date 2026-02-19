import type { CleaningStats } from "../domain/types";

const statCardClass = "surface-strong flex flex-col gap-1 px-4 py-3";

export function StatsBar({ stats }: { stats: CleaningStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className={statCardClass}>
        <span className="text-xs text-muted">إجمالي الصفوف</span>
        <span className="text-lg font-semibold text-[var(--text)]">
          {stats.total}
        </span>
      </div>
      <div className={statCardClass}>
        <span className="text-xs text-muted">صالح</span>
        <span className="text-lg font-semibold text-[var(--success)]">
          {stats.valid}
        </span>
      </div>
      <div className={statCardClass}>
        <span className="text-xs text-muted">فريد</span>
        <span className="text-lg font-semibold text-[var(--text)]">
          {stats.unique}
        </span>
      </div>
      <div className={statCardClass}>
        <span className="text-xs text-muted">مكرر</span>
        <span className="text-lg font-semibold text-[var(--warning)]">
          {stats.duplicate}
        </span>
      </div>
      <div className={statCardClass}>
        <span className="text-xs text-muted">غير صالح</span>
        <span className="text-lg font-semibold text-[var(--danger)]">
          {stats.invalid}
        </span>
      </div>
    </div>
  );
}
