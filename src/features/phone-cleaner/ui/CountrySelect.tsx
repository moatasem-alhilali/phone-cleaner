"use client";

import { useMemo, useState } from "react";
import type { Country } from "../domain/types";

function flagEmoji(iso2: string): string {
  const code = iso2.toUpperCase();
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  );
}

type CountrySelectProps = {
  countries: Country[];
  value: string;
  label: string;
  placeholder?: string;
  onChange: (iso2: string) => void;
};

export function CountrySelect({
  countries,
  value,
  label,
  placeholder,
  onChange,
}: CountrySelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = countries.find((country) => country.iso2 === value);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return countries;
    return countries.filter((country) => {
      const dial = country.dial_code;
      return (
        country.name_ar.toLowerCase().includes(term) ||
        country.name_en.toLowerCase().includes(term) ||
        country.iso2.toLowerCase().includes(term) ||
        dial.includes(term.replace(/\+/g, ""))
      );
    });
  }, [countries, query]);

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right text-sm shadow-sm transition hover:border-slate-300"
      >
        <span className="flex items-center gap-2 text-slate-900">
          <span className="text-lg">{selected ? flagEmoji(selected.iso2) : "🌍"}</span>
          <span>{selected ? selected.name_ar : "—"}</span>
          {selected && (
            <span className="text-xs text-slate-500">+{selected.dial_code}</span>
          )}
        </span>
        <span className="text-xs text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder ?? "ابحث عن دولة"}
            aria-label={placeholder ?? "ابحث عن دولة"}
            className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <ul className="max-h-64 overflow-auto" role="listbox">
            {filtered.map((country) => (
              <li key={country.iso2}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(country.iso2);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{flagEmoji(country.iso2)}</span>
                    <span>{country.name_ar}</span>
                  </span>
                  <span className="text-xs text-slate-400">+{country.dial_code}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-slate-400">
                لا توجد نتائج
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
