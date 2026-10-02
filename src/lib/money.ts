export type LateFeePolicy = "none" | "full" | "fixed" | "percent";

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

/** Parses "35", "35.5" or "£35.50" into pence. Returns null when invalid. */
export function parsePounds(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function lessonPrice(hourlyRatePence: number, durationMinutes: number): number {
  return Math.round((hourlyRatePence * durationMinutes) / 60);
}

export type CancellationTerms = {
  noticeHours: number;
  policy: LateFeePolicy;
  fixedPence: number | null;
  percent: number | null;
};

/**
 * Works out whether a cancellation is late and what fee applies. Instructors
 * cancelling never incur a fee; that is decided by the caller.
 */
export function cancellationOutcome(startsAt: Date, now: Date, priceP: number, terms: CancellationTerms) {
  const late = startsAt.getTime() - now.getTime() < terms.noticeHours * 3600_000;
  if (!late) return { late: false, feePence: 0 };
  switch (terms.policy) {
    case "none":
      return { late: true, feePence: 0 };
    case "full":
      return { late: true, feePence: priceP };
    case "fixed":
      return { late: true, feePence: Math.min(terms.fixedPence ?? 0, priceP) };
    case "percent":
      return { late: true, feePence: Math.round((priceP * (terms.percent ?? 0)) / 100) };
  }
}

export function describeLateFee(terms: CancellationTerms): string {
  const notice = `${terms.noticeHours} hours`;
  switch (terms.policy) {
    case "none":
      return `Please cancel at least ${notice} before your lesson. There is no charge for late cancellations.`;
    case "full":
      return `Cancellations with less than ${notice} notice are charged the full lesson price.`;
    case "fixed":
      return `Cancellations with less than ${notice} notice are charged ${formatGBP(terms.fixedPence ?? 0)}.`;
    case "percent":
      return `Cancellations with less than ${notice} notice are charged ${terms.percent ?? 0}% of the lesson price.`;
  }
}
