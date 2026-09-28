/**
 * Formatting for the app kit. Dates render in UTC so sample data reads the same
 * in every time zone; months are spelled by hand ("Sep", never "Sept").
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "25 Sep 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "25 Sep" */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "25 Sep 2026, 16:40 UTC" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(iso)}, ${hh}:${mm} UTC`;
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "$7,204.00" */
export const formatMoney = (value: number): string => currency.format(value);

/** Splits "$7,204.00" into "$7,204" and ".00" so a figure can quiet its cents. */
export function splitMoney(value: number): [string, string] {
  const text = currency.format(value);
  const dot = text.lastIndexOf(".");
  return dot === -1 ? [text, ""] : [text.slice(0, dot), text.slice(dot)];
}

/** "1,204" */
export const formatCount = (value: number): string => whole.format(value);

/** Axis money: "$0", "$500", "$1k", "$2.5k". */
export function formatAxisMoney(value: number): string {
  if (value === 0) return "$0";
  if (Math.abs(value) < 1000) return `$${whole.format(value)}`;
  const k = value / 1000;
  return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

const MINUS = "−";

/** Relative change as text, with a true minus sign: "+4.2%", "−4.4%", "0.0%". */
export function formatChange(current: number, previous: number): { text: string; direction: "up" | "down" | "flat" } {
  if (previous === 0) return { text: current === 0 ? "0.0%" : "New", direction: current === 0 ? "flat" : "up" };
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return { text: "0.0%", direction: "flat" };
  return {
    text: `${rounded > 0 ? "+" : MINUS}${oneDecimal.format(Math.abs(rounded))}%`,
    direction: rounded > 0 ? "up" : "down",
  };
}

/** Absolute change for counts: "+2", "−3", "0". */
export function formatDifference(current: number, previous: number): { text: string; direction: "up" | "down" | "flat" } {
  const diff = current - previous;
  if (diff === 0) return { text: "0", direction: "flat" };
  return { text: `${diff > 0 ? "+" : MINUS}${whole.format(Math.abs(diff))}`, direction: diff > 0 ? "up" : "down" };
}

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/** Initial capital for a status word: "quarantine" → "Quarantine". */
export const sentenceCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
