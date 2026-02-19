export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeName(value: string): string {
  return collapseSpaces(value).toLowerCase();
}
