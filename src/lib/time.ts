// Time zone helpers. Availability is set in the instructor's local time
// (Europe/London for now) and stored bookings are UTC, so every conversion
// has to respect British Summer Time.

export const DEFAULT_TZ = "Europe/London";

function partsIn(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  return parts;
}

/** Minutes the zone is ahead of UTC at the given instant (London: 0 or 60). */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Converts a local wall-clock date ("2026-10-02") and time ("09:30") to a UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = tzOffsetMinutes(new Date(guess), tz);
  let t = guess - first * 60000;
  const second = tzOffsetMinutes(new Date(t), tz);
  if (second !== first) t = guess - second * 60000;
  return new Date(t);
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local calendar date, weekday (0 = Sunday) and HH:MM time of an instant. */
export function localParts(date: Date, tz: string) {
  const p = partsIn(date, tz);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAYS[p.weekday],
    time: `${p.hour}:${p.minute}`,
  };
}

/** Adds whole days to a "YYYY-MM-DD" date string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" date string. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatDateTime(date: Date | string, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDate(date: string, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(zonedToUtc(date, "12:00", tz));
}

export function formatTime(date: Date | string, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
