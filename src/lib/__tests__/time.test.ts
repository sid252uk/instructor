import { describe, expect, it } from "vitest";
import { addDays, localParts, weekdayOf, zonedToUtc } from "@/lib/time";

describe("zonedToUtc", () => {
  it("uses GMT in winter", () => {
    expect(zonedToUtc("2026-01-15", "09:00", "Europe/London").toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });
  it("uses BST in summer", () => {
    expect(zonedToUtc("2026-07-15", "09:00", "Europe/London").toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });
  it("handles the day the clocks go forward", () => {
    expect(zonedToUtc("2026-03-29", "10:00", "Europe/London").toISOString()).toBe("2026-03-29T09:00:00.000Z");
  });
});

describe("date helpers", () => {
  it("reads local parts", () => {
    expect(localParts(new Date("2026-07-15T23:30:00Z"), "Europe/London")).toEqual({
      date: "2026-07-16",
      weekday: 4,
      time: "00:30",
    });
  });
  it("adds days across months", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });
  it("finds weekdays", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
  });
});
