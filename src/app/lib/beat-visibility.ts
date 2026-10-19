// Beat-Day Visibility Window — a seller-level control over how far in
// advance the Buyer App offers that seller's beat-day delivery option
// (the low-MOV option). Raised by Morris in the Daily Product Sync on
// 15 Oct 2026: sellers were getting beat orders days before the beat
// and want to restrict them to a shorter window.
//
// It does NOT change the retailer's beat schedule — only when the
// beat-day option becomes orderable. Next-Day Delivery is untouched.
//
// Buyer App rule:
//   daysAhead = calendar days from today to the retailer's next beat day
//   show the beat-day option iff daysAhead <= the seller's window
//
// Storage: one localStorage key per seller, kept off the seller record
// (same as logistics-settings) because demo-mode login re-seeds every
// seeded seller from SEED_SELLERS and would wipe the value.

const STORAGE_PREFIX = "qwipo.beatVisibilityDays.";

/** 7 = every beat day in the coming week, i.e. no restriction. Sellers
 *  with nothing saved read as 7 — today's behaviour. */
export const DEFAULT_BEAT_VISIBILITY_DAYS = 7;

export const BEAT_VISIBILITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Only the next day" },
  { value: 2, label: "Up to 2 days ahead" },
  { value: 3, label: "Up to 3 days ahead" },
  { value: 4, label: "Up to 4 days ahead" },
  { value: 5, label: "Up to 5 days ahead" },
  { value: 6, label: "Up to 6 days ahead" },
  { value: 7, label: "Up to 7 days ahead (no restriction)" },
];

export function getBeatVisibilityDays(sellerId: string): number {
  try {
    const v = Number(localStorage.getItem(`${STORAGE_PREFIX}${sellerId}`));
    if (Number.isInteger(v) && v >= 1 && v <= 7) return v;
  } catch {
    /* localStorage unavailable — fall through */
  }
  return DEFAULT_BEAT_VISIBILITY_DAYS;
}

export function setBeatVisibilityDays(sellerId: string, days: number) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${sellerId}`, String(days));
  } catch {
    /* no-op */
  }
}

export function beatVisibilityLabel(days: number): string {
  return (
    BEAT_VISIBILITY_OPTIONS.find((o) => o.value === days)?.label ??
    `Up to ${days} days ahead`
  );
}

/** True iff a beat `daysAhead` calendar days from today should show the
 *  beat-day option under a `windowDays` setting. */
export function isBeatOptionVisible(
  daysAhead: number,
  windowDays: number,
): boolean {
  return daysAhead >= 1 && daysAhead <= windowDays;
}
