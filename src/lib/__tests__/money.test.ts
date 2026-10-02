import { describe, expect, it } from "vitest";
import { cancellationOutcome, formatGBP, lessonPrice, parsePounds } from "@/lib/money";

describe("money", () => {
  it("formats pounds", () => {
    expect(formatGBP(4250)).toBe("£42.50");
  });
  it("parses pounds", () => {
    expect(parsePounds("£35.5")).toBe(3550);
    expect(parsePounds("abc")).toBeNull();
  });
  it("prices lessons from the hourly rate", () => {
    expect(lessonPrice(4000, 90)).toBe(6000);
  });
});

describe("cancellationOutcome", () => {
  const start = new Date("2026-10-10T10:00:00Z");
  const terms = { noticeHours: 48, policy: "full" as const, fixedPence: null, percent: null };

  it("charges nothing with enough notice", () => {
    expect(cancellationOutcome(start, new Date("2026-10-07T10:00:00Z"), 4000, terms)).toEqual({ late: false, feePence: 0 });
  });
  it("charges the full price when late", () => {
    expect(cancellationOutcome(start, new Date("2026-10-09T10:00:00Z"), 4000, terms)).toEqual({ late: true, feePence: 4000 });
  });
  it("charges a percentage", () => {
    const outcome = cancellationOutcome(start, new Date("2026-10-09T10:00:00Z"), 4000, { ...terms, policy: "percent", percent: 50 });
    expect(outcome.feePence).toBe(2000);
  });
  it("caps a fixed fee at the lesson price", () => {
    const outcome = cancellationOutcome(start, new Date("2026-10-09T10:00:00Z"), 3000, { ...terms, policy: "fixed", fixedPence: 5000 });
    expect(outcome.feePence).toBe(3000);
  });
});
