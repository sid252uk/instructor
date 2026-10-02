import { describe, expect, it } from "vitest";
import { generateSlots } from "@/lib/slots";

const tz = "Europe/London";
// Friday 2 Oct 2026, 08:00 BST
const now = new Date("2026-10-02T07:00:00Z");
const mondayMorning = [{ weekday: 1, start_time: "09:00:00", end_time: "12:00:00" }];

const base = {
  rules: mondayMorning,
  busy: [],
  durationMinutes: 60,
  intervalMinutes: 30,
  minNoticeHours: 24,
  windowDays: 7,
  now,
  tz,
};

describe("generateSlots", () => {
  it("fills the availability window in steps", () => {
    const slots = generateSlots(base).map((d) => d.toISOString());
    expect(slots).toEqual([
      "2026-10-05T08:00:00.000Z",
      "2026-10-05T08:30:00.000Z",
      "2026-10-05T09:00:00.000Z",
      "2026-10-05T09:30:00.000Z",
      "2026-10-05T10:00:00.000Z",
    ]);
  });

  it("skips slots that clash with bookings", () => {
    const busy = [{ start: new Date("2026-10-05T09:00:00Z"), end: new Date("2026-10-05T10:00:00Z") }];
    const slots = generateSlots({ ...base, busy }).map((d) => d.toISOString());
    expect(slots).toEqual(["2026-10-05T08:00:00.000Z", "2026-10-05T10:00:00.000Z"]);
  });

  it("respects minimum notice", () => {
    const slots = generateSlots({ ...base, now: new Date("2026-10-04T08:30:00Z") });
    expect(slots[0].toISOString()).toBe("2026-10-05T08:30:00.000Z");
  });

  it("fits longer lessons only where they end inside the window", () => {
    const slots = generateSlots({ ...base, durationMinutes: 120 }).map((d) => d.toISOString());
    expect(slots).toEqual(["2026-10-05T08:00:00.000Z", "2026-10-05T08:30:00.000Z", "2026-10-05T09:00:00.000Z"]);
  });

  it("stops at the booking window", () => {
    expect(generateSlots({ ...base, windowDays: 2 })).toEqual([]);
  });
});
