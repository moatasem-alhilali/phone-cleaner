import type { DuplicateGroup, NormalizedRow } from "./types";
import { normalizeName } from "../utils/strings";

export type DedupedResults = {
  unique: NormalizedRow[];
  duplicates: NormalizedRow[];
  duplicateGroupsByPhone: DuplicateGroup[];
  duplicateGroupsByNamePhone: DuplicateGroup[];
  duplicateGroupsByName: DuplicateGroup[];
};

function buildGroups(
  rows: NormalizedRow[],
  keyFn: (row: NormalizedRow) => string | undefined
): DuplicateGroup[] {
  const map = new Map<string, NormalizedRow[]>();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  });

  return [...map.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items], index) => {
      const kept = items.reduce((best, current) =>
        current.index < best.index ? current : best
      );
      return {
        id: `group_${index + 1}`,
        key,
        canonicalPhone: items[0]?.normalized,
        items,
        keptIndex: kept.index,
      };
    });
}

export function dedupeRows(
  rows: NormalizedRow[],
  detectNameDuplicates: boolean
): DedupedResults {
  const byPhone = new Map<string, NormalizedRow[]>();

  rows.forEach((row) => {
    if (!row.normalized) return;
    const list = byPhone.get(row.normalized) ?? [];
    list.push(row);
    byPhone.set(row.normalized, list);
  });

  const unique: NormalizedRow[] = [];
  const duplicates: NormalizedRow[] = [];
  const duplicateGroupsByPhone: DuplicateGroup[] = [];

  [...byPhone.entries()].forEach(([phone, items], groupIndex) => {
    items.sort((a, b) => a.index - b.index);
    const [first, ...rest] = items;
    if (first) {
      first.status = "valid";
      first.isKept = true;
      unique.push(first);
    }

    if (items.length > 1) {
      duplicateGroupsByPhone.push({
        id: `phone_${groupIndex + 1}`,
        key: phone,
        canonicalPhone: phone,
        items,
        keptIndex: first?.index ?? 0,
      });
    }

    rest.forEach((row) => {
      row.status = "duplicate";
      row.isKept = false;
      duplicates.push(row);
    });
  });

  const duplicateGroupsByNamePhone = buildGroups(rows, (row) => {
    if (!row.normalized) return undefined;
    const normalizedName = row.nameNormalized?.trim();
    if (!normalizedName) return undefined;
    return `${row.normalized}__${normalizedName}`;
  });

  const duplicateGroupsByName = detectNameDuplicates
    ? buildGroups(rows, (row) => {
        const normalizedName = row.nameNormalized?.trim();
        if (!normalizedName) return undefined;
        return normalizedName;
      })
    : [];

  return {
    unique,
    duplicates,
    duplicateGroupsByPhone,
    duplicateGroupsByNamePhone,
    duplicateGroupsByName,
  };
}

export function ensureNameNormalized(rows: NormalizedRow[]): void {
  rows.forEach((row) => {
    row.nameNormalized = row.name ? normalizeName(row.name) : "";
  });
}
