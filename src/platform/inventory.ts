/** Null is an unknown count/date, always last regardless of sort direction. */
export function compareNullable(a: string | number | null, b: string | number | null, direction: "asc" | "desc") {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return order * (direction === "asc" ? 1 : -1);
}

/** Sum recorded counts. An entirely untracked inventory is not zero stock. */
export function sumTracked(values: (number | null)[]): number | null {
  const tracked = values.filter((value): value is number => value !== null);
  return values.length && !tracked.length ? null : tracked.reduce((sum, value) => sum + value, 0);
}
