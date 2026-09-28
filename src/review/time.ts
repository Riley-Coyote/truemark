/**
 * Times in the review layer are real: a note is a message between Riley and the client,
 * so it carries the moment it was written (Supabase stamps the same clock).
 */
import { useEffect, useState } from "react";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Dates read as the site writes them ("25 Sep 2026"), whatever the browser's locale data says.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");
const dayMonth = { format: (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}` };
const dayMonthYear = { format: (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
const clock = { format: (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}` };

export function ago(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  if (diff < 45_000) return "just now";
  if (diff < 90_000) return "1 min ago";
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`;
  if (diff < DAY) {
    const hours = Math.round(diff / HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const date = new Date(then);
  return date.getFullYear() === new Date(now).getFullYear() ? dayMonth.format(date) : dayMonthYear.format(date);
}

/** "27 Sep 2026, 14:05" — for tooltips and the brief. */
export function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${dayMonthYear.format(date)}, ${clock.format(date)}`;
}

/** Re-renders every half minute so "2 min ago" stays true. */
export function useNow(interval = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}
