import { addDays, localParts, weekdayOf, zonedToUtc } from "@/lib/time";

export type AvailabilityRule = { weekday: number; start_time: string; end_time: string };
export type Interval = { start: Date; end: Date };

export type SlotOptions = {
  rules: AvailabilityRule[];
  /** Existing bookings and time off; slots overlapping these are hidden. */
  busy: Interval[];
  durationMinutes: number;
  intervalMinutes: number;
  minNoticeHours: number;
  windowDays: number;
  now: Date;
  tz: string;
  /** Limit to a single local date ("YYYY-MM-DD"). */
  onlyDate?: string;
};

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Bookable lesson start times, worked out from the instructor's weekly
 * availability minus existing bookings and time off.
 */
export function generateSlots(o: SlotOptions): Date[] {
  const earliest = new Date(o.now.getTime() + o.minNoticeHours * 3600_000);
  const today = localParts(o.now, o.tz).date;
  const durationMs = o.durationMinutes * 60_000;
  const stepMs = o.intervalMinutes * 60_000;
  const seen = new Set<number>();
  const slots: Date[] = [];

  for (let i = 0; i <= o.windowDays; i++) {
    const date = addDays(today, i);
    if (o.onlyDate && date !== o.onlyDate) continue;
    const weekday = weekdayOf(date);

    for (const rule of o.rules) {
      if (rule.weekday !== weekday) continue;
      const windowStart = zonedToUtc(date, rule.start_time.slice(0, 5), o.tz).getTime();
      const windowEnd = zonedToUtc(date, rule.end_time.slice(0, 5), o.tz).getTime();

      for (let t = windowStart; t + durationMs <= windowEnd; t += stepMs) {
        const slot = { start: new Date(t), end: new Date(t + durationMs) };
        if (slot.start < earliest || seen.has(t)) continue;
        if (o.busy.some((b) => overlaps(slot, b))) continue;
        seen.add(t);
        slots.push(slot.start);
      }
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** Groups slot start times by local date for display. */
export function groupByDate(slots: Date[], tz: string): Map<string, Date[]> {
  const groups = new Map<string, Date[]>();
  for (const slot of slots) {
    const { date } = localParts(slot, tz);
    groups.set(date, [...(groups.get(date) ?? []), slot]);
  }
  return groups;
}
