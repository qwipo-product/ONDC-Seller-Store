// Shared store for the seller's Order Settings values that other
// pages need to read. Backed by localStorage so a change made on the
// Order Settings page propagates to any SKU Detail / Orders page
// opened afterwards.
//
// We only persist the small handful of fields that are actually
// referenced cross-page; everything else stays local to
// order-settings.tsx.

const PROCESSING_TIME_KEY = "qwipo.orderSettings.processingTimeHours";
const BEAT_MOV_KEY = "qwipo.orderSettings.beatMov";
const NON_BEAT_MOV_KEY = "qwipo.orderSettings.nonBeatMov";
const BEAT_CUTOFF_TIME_KEY = "qwipo.orderSettings.beatCutoffTime";

/** Default if the seller has never opened Order Settings. Matches the
 *  default the page seeds. */
const DEFAULT_PROCESSING_TIME_HOURS = "24";

/** Beat orders ride the configured serviceability schedule and
 *  generally land in larger volumes — sellers set a lower MOV than
 *  the ad-hoc / non-beat orders. */
const DEFAULT_BEAT_MOV = 500;
const DEFAULT_NON_BEAT_MOV = 1000;

/** Cut-off time after which Beat orders for the next scheduled
 *  delivery cycle stop being accepted. Default agreed in the June
 *  review was 5 PM. Stored as `HH:MM` so it pairs cleanly with the
 *  `<input type="time">` UI. */
const DEFAULT_BEAT_CUTOFF_TIME = "17:00";

/** The dropdown options the seller can pick from on Order Settings —
 *  exported so any consumer can render the same surface. */
export const PROCESSING_TIME_OPTIONS = ["6", "12", "24", "48", "72"] as const;

export function getProcessingTimeHours(): string {
  try {
    const v = localStorage.getItem(PROCESSING_TIME_KEY);
    if (
      v &&
      PROCESSING_TIME_OPTIONS.includes(
        v as (typeof PROCESSING_TIME_OPTIONS)[number],
      )
    ) {
      return v;
    }
  } catch {
    /* localStorage unavailable — fall through */
  }
  return DEFAULT_PROCESSING_TIME_HOURS;
}

export function setProcessingTimeHours(hours: string) {
  try {
    localStorage.setItem(PROCESSING_TIME_KEY, hours);
  } catch {
    /* localStorage unavailable — no-op */
  }
}

/** Format hours for display. "24" → "24 hours". */
export function formatProcessingTimeLabel(hours: string): string {
  return `${hours} hour${hours === "1" ? "" : "s"}`;
}

function readNumber(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

export function getBeatMov(): number {
  return readNumber(BEAT_MOV_KEY, DEFAULT_BEAT_MOV);
}

export function setBeatMov(value: number) {
  try {
    localStorage.setItem(BEAT_MOV_KEY, String(value));
  } catch {
    /* no-op */
  }
}

export function getNonBeatMov(): number {
  return readNumber(NON_BEAT_MOV_KEY, DEFAULT_NON_BEAT_MOV);
}

export function setNonBeatMov(value: number) {
  try {
    localStorage.setItem(NON_BEAT_MOV_KEY, String(value));
  } catch {
    /* no-op */
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function getBeatCutoffTime(): string {
  try {
    const v = localStorage.getItem(BEAT_CUTOFF_TIME_KEY);
    if (v && TIME_RE.test(v)) return v;
  } catch {
    /* no-op */
  }
  return DEFAULT_BEAT_CUTOFF_TIME;
}

export function setBeatCutoffTime(time: string) {
  if (!TIME_RE.test(time)) return;
  try {
    localStorage.setItem(BEAT_CUTOFF_TIME_KEY, time);
  } catch {
    /* no-op */
  }
}
