// Shared store for the seller's Store Settings values that other
// pages need to read — the working-week (which day-of-week is closed)
// and the distributor's fixed-holiday calendar.
//
// Persisted to localStorage so a change made on the Store Settings
// page survives a reload and is visible to downstream consumers
// (delivery-date prediction, orders list, etc.).

const WEEK_OFF_KEY = "qwipo.storeSettings.weekOff";
const HOLIDAYS_KEY = "qwipo.storeSettings.holidays";
const SHOP_HOURS_KEY = "qwipo.storeSettings.shopHours";

export type WeekDay =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export const WEEK_DAY_ORDER: WeekDay[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

const WEEK_DAY_SET = new Set<WeekDay>(WEEK_DAY_ORDER);

export interface FixedHoliday {
  id: string;
  name: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
}

export interface ShopHours {
  /** `HH:mm`, 24-hour. */
  open: string;
  /** `HH:mm`, 24-hour. */
  close: string;
}

const DEFAULT_WEEK_OFF: WeekDay[] = ["sun"];

const DEFAULT_SHOP_HOURS: ShopHours = { open: "09:00", close: "20:00" };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Same seed list the old store-settings.tsx hardcoded — moved here so
// the holiday calendar starts populated rather than empty on first
// load. Sellers can add / remove from here.
const DEFAULT_HOLIDAYS: FixedHoliday[] = [
  { id: "h-1", name: "Republic Day", date: "2026-01-26" },
  { id: "h-2", name: "Holi", date: "2026-03-25" },
  { id: "h-3", name: "Independence Day", date: "2026-08-15" },
  { id: "h-4", name: "Gandhi Jayanti", date: "2026-10-02" },
  { id: "h-5", name: "Diwali", date: "2026-10-21" },
  { id: "h-6", name: "Christmas", date: "2026-12-25" },
];

const _listeners = new Set<() => void>();

const notify = () => {
  for (const cb of _listeners) cb();
};

function readWeekOff(): WeekDay[] {
  try {
    const raw = localStorage.getItem(WEEK_OFF_KEY);
    if (!raw) return [...DEFAULT_WEEK_OFF];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_WEEK_OFF];
    const filtered = parsed.filter(
      (d): d is WeekDay => typeof d === "string" && WEEK_DAY_SET.has(d as WeekDay),
    );
    return filtered.length > 0 ? filtered : [...DEFAULT_WEEK_OFF];
  } catch {
    return [...DEFAULT_WEEK_OFF];
  }
}

function readHolidays(): FixedHoliday[] {
  try {
    const raw = localStorage.getItem(HOLIDAYS_KEY);
    if (!raw) return [...DEFAULT_HOLIDAYS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_HOLIDAYS];
    return parsed
      .filter(
        (h): h is FixedHoliday =>
          h &&
          typeof h.id === "string" &&
          typeof h.name === "string" &&
          typeof h.date === "string",
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [...DEFAULT_HOLIDAYS];
  }
}

export function getWeekOff(): WeekDay[] {
  return readWeekOff();
}

export function setWeekOff(next: WeekDay[]): void {
  try {
    const deduped = Array.from(new Set(next)).filter((d) =>
      WEEK_DAY_SET.has(d),
    );
    localStorage.setItem(WEEK_OFF_KEY, JSON.stringify(deduped));
    notify();
  } catch {
    /* localStorage unavailable — no-op */
  }
}

function readShopHours(): ShopHours {
  try {
    const raw = localStorage.getItem(SHOP_HOURS_KEY);
    if (!raw) return { ...DEFAULT_SHOP_HOURS };
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.open === "string" &&
      TIME_RE.test(parsed.open) &&
      typeof parsed.close === "string" &&
      TIME_RE.test(parsed.close)
    ) {
      return { open: parsed.open, close: parsed.close };
    }
    return { ...DEFAULT_SHOP_HOURS };
  } catch {
    return { ...DEFAULT_SHOP_HOURS };
  }
}

export function getHolidays(): FixedHoliday[] {
  return readHolidays();
}

export function getShopHours(): ShopHours {
  return readShopHours();
}

export function setShopHours(next: ShopHours): void {
  try {
    if (!TIME_RE.test(next.open) || !TIME_RE.test(next.close)) return;
    localStorage.setItem(SHOP_HOURS_KEY, JSON.stringify(next));
    notify();
  } catch {
    /* localStorage unavailable — no-op */
  }
}

export function setHolidays(next: FixedHoliday[]): void {
  try {
    const sorted = [...next].sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem(HOLIDAYS_KEY, JSON.stringify(sorted));
    notify();
  } catch {
    /* localStorage unavailable — no-op */
  }
}

export function subscribeToStoreSettings(cb: () => void): () => void {
  _listeners.add(cb);
  return () => {
    _listeners.delete(cb);
  };
}

/** Convenience — returns YYYY-MM-DD set of holiday dates for quick
 *  lookups inside delivery-date math. */
export function getHolidayDateSet(): Set<string> {
  return new Set(readHolidays().map((h) => h.date));
}

const JS_DAY_TO_WEEK_DAY: WeekDay[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/** Map a JS `Date.getDay()` (0=Sun … 6=Sat) to our WeekDay key. */
export function jsDayToWeekDay(jsDay: number): WeekDay {
  return JS_DAY_TO_WEEK_DAY[jsDay] ?? "mon";
}
