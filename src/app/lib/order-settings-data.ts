// Shared store for the seller's Order Settings values that other
// pages need to read. Backed by localStorage so a change made on the
// Order Settings page propagates to any SKU Detail / Orders page
// opened afterwards.
//
// We only persist the small handful of fields that are actually
// referenced cross-page; everything else stays local to
// order-settings.tsx.

const PROCESSING_TIME_KEY = "qwipo.orderSettings.processingTimeHours";
const ORDER_MIN_KEY = "qwipo.orderSettings.orderMin";
const ORDER_MAX_KEY = "qwipo.orderSettings.orderMax";
const ORDER_NONBEAT_KEY = "qwipo.orderSettings.orderNonBeatMov";
const BEAT_CUTOFF_TIME_KEY = "qwipo.orderSettings.beatCutoffTime";

/** Default if the seller has never opened Order Settings. Matches the
 *  default the page seeds. */
const DEFAULT_PROCESSING_TIME_HOURS = "24";

/** Single Minimum Order Value floor — orders below this aren't
 *  accepted. The optional Maximum cap is a per-order ceiling; a
 *  value of 0 means no cap. */
const DEFAULT_ORDER_MIN = 2500;
const DEFAULT_ORDER_MAX = 5000;

/** Minimum Order Value floor applied specifically to non-beat
 *  (off-route / ad-hoc) orders — those placed outside the seller's
 *  regular beat schedule. Kept separate from the standard Minimum so
 *  sellers can require a higher basket for off-route deliveries. */
const DEFAULT_ORDER_NONBEAT = 5000;

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

export function getOrderValueMin(): number {
  return readNumber(ORDER_MIN_KEY, DEFAULT_ORDER_MIN);
}

export function setOrderValueMin(value: number) {
  try {
    localStorage.setItem(ORDER_MIN_KEY, String(value));
  } catch {
    /* no-op */
  }
}

export function getOrderValueMax(): number {
  return readNumber(ORDER_MAX_KEY, DEFAULT_ORDER_MAX);
}

export function setOrderValueMax(value: number) {
  try {
    localStorage.setItem(ORDER_MAX_KEY, String(value));
  } catch {
    /* no-op */
  }
}

export function getOrderValueNonBeat(): number {
  return readNumber(ORDER_NONBEAT_KEY, DEFAULT_ORDER_NONBEAT);
}

export function setOrderValueNonBeat(value: number) {
  try {
    localStorage.setItem(ORDER_NONBEAT_KEY, String(value));
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
