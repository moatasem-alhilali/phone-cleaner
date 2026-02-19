import type { CleaningStats } from "../domain/types";

const statCardClass =
  "flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm";

export function StatsBar({ stats }: { stats: CleaningStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className={statCardClass}>
        <span className="text-xs text-slate-400">إجمالي الصفوف</span>
        <span className="text-lg font-semibold text-slate-900">{stats.total}</span>
      </div>
      <div className={statCardClass}>
        <span className="text-xs text-slate-400">صالح</span>
        <span className="text-lg font-semibold text-emerald-700">
          {stats.valid}
        </span>
      </div>
      <div className={statCardClass}>
        <span className="text-xs text-slate-400">فريد</span>
        <span className="text-lg font-semibold text-slate-900">
          {stats.unique}
        </span>
      </div>
      <div className={statCardClass}>
        <span className="text-xs text-slate-400">مكرر</span>
        <span className="text-lg font-semibold text-amber-700">
          {stats.duplicate}
        </span>
      </div>
      <div className={statCardClass}>
        <span className="text-xs text-slate-400">غير صالح</span>
        <span className="text-lg font-semibold text-rose-700">
          {stats.invalid}
        </span>
      </div>
    </div>
  );
}
