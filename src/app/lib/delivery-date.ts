// Delivery-date prediction. The engine the June review agreed on:
//
//   cut-off  →  Sunday / week-off skip  →  distributor-holiday skip
//   →  match the customer's serviceability beat days  (Beat orders only)
//   →  land on the actual next working delivery day.
//
// Both Beat and Standard orders honor cut-off + week-off + holidays.
// Beat orders additionally require the day to match a day the
// customer's beat is configured for; Standard orders take the first
// available working day after the cut-off check.

import type { DeliveryDay } from "./customers-data";
import {
  findBeatForCustomer,
  type CustomerLocationKey,
} from "./serviceability-data";
import {
  getHolidayDateSet,
  getWeekOff,
  jsDayToWeekDay,
  type WeekDay,
} from "./store-settings-data";
import { getBeatCutoffTime } from "./order-settings-data";

export type DerivedOrderType = "beat" | "standard";

export interface PredictDeliveryArgs {
  /** ISO 8601 timestamp (or a `YYYY-MM-DD` date — treated as midnight
   *  local) when the order was placed. */
  placedAt: string;
  customer: CustomerLocationKey;
  orderType: DerivedOrderType;
  /** Override the cut-off + week-off + holidays from the persisted
   *  settings — useful for tests / what-if previews. */
  beatCutoffTime?: string;
  weekOff?: WeekDay[];
  holidayDates?: Set<string>;
}

export interface PredictDeliveryResult {
  /** ISO `YYYY-MM-DD` of the predicted delivery day. */
  deliveryDate: string;
  /** True iff cut-off pushed the candidate window forward by one day. */
  rolledOverCutoff: boolean;
  /** Human-readable explanation for tooltips / detail-page surfacing. */
  reason: string;
}

const WEEKDAY_TO_DELIVERY_DAY: Record<WeekDay, DeliveryDay> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}

function parsePlacedAt(s: string): Date {
  // Trust an ISO datetime, fall back to YYYY-MM-DD as midnight local.
  if (/T/.test(s)) return new Date(s);
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1, 0, 0, 0);
}

/**
 * Predict the next working delivery date for an order.
 *
 *   1. Cut-off — Beat orders placed at/after `beatCutoffTime` roll
 *      one calendar day forward before we start the search.
 *   2. Walk forward one day at a time. Skip the date if:
 *        - the weekday is in week-off (default ["sun"]), OR
 *        - the date is in the distributor's holiday list, OR
 *        - the order is "beat" AND the weekday isn't in the
 *          customer's beat.deliveryDays.
 *   3. Return the first surviving date.
 *
 * Returns null if no customer beat exists for a "beat" order — the
 * caller decides whether to fall back to a "standard" computation or
 * surface an empty state.
 */
export function predictExpectedDeliveryDate(
  args: PredictDeliveryArgs,
): PredictDeliveryResult | null {
  const placed = parsePlacedAt(args.placedAt);
  const cutoffTime = args.beatCutoffTime ?? getBeatCutoffTime();
  const weekOff = new Set(args.weekOff ?? getWeekOff());
  const holidayDates = args.holidayDates ?? getHolidayDateSet();

  // Beat orders need a beat to anchor the search. Without one, we
  // can't promise a delivery day — caller has to fall back.
  let allowedDays: Set<DeliveryDay> | null = null;
  if (args.orderType === "beat") {
    const beat = findBeatForCustomer(args.customer);
    if (!beat || beat.deliveryDays.length === 0) return null;
    // Beat "Next Day" is express — treat as "any working day matches".
    // Otherwise, restrict to the explicitly configured weekdays.
    if (!beat.deliveryDays.includes("Next Day")) {
      allowedDays = new Set(beat.deliveryDays);
    }
  }

  // Cut-off — push start by 1 day for beat orders placed late, so we
  // skip the would-have-been-tomorrow delivery.
  const [cutH, cutM] = cutoffTime.split(":").map(Number);
  const cutoffOnPlacedDay = new Date(
    placed.getFullYear(),
    placed.getMonth(),
    placed.getDate(),
    cutH ?? 17,
    cutM ?? 0,
    0,
  );
  const placedTooLate =
    args.orderType === "beat" && placed.getTime() >= cutoffOnPlacedDay.getTime();
  const rolledOverCutoff = placedTooLate;
  const searchStart = placedTooLate ? addDays(placed, 2) : addDays(placed, 1);
  const startIso = toIsoDate(searchStart);

  // Walk forward, capped at 60 days — guards against a misconfigured
  // beat (e.g. every weekday in week-off) silently looping.
  let cursor = new Date(searchStart.getTime());
  for (let i = 0; i < 60; i++) {
    const iso = toIsoDate(cursor);
    const wd = jsDayToWeekDay(cursor.getDay());
    const deliveryDayName = WEEKDAY_TO_DELIVERY_DAY[wd];

    const isWeekOff = weekOff.has(wd);
    const isHoliday = holidayDates.has(iso);
    const isBeatDay = allowedDays ? allowedDays.has(deliveryDayName) : true;

    if (!isWeekOff && !isHoliday && isBeatDay) {
      const skipNotes: string[] = [];
      if (rolledOverCutoff) {
        skipNotes.push(
          `placed at/after ${cutoffTime} → rolled past next-day cycle`,
        );
      }
      if (toIsoDate(searchStart) !== iso) {
        const skippedDays = Math.round(
          (cursor.getTime() - searchStart.getTime()) / (24 * 60 * 60 * 1000),
        );
        skipNotes.push(
          `skipped ${skippedDays} ${skippedDays === 1 ? "day" : "days"} (week-off/holiday/beat-day)`,
        );
      }
      const reason =
        skipNotes.length > 0
          ? `${deliveryDayName} (${skipNotes.join("; ")})`
          : `${deliveryDayName} — next working day after order placement`;
      return { deliveryDate: iso, rolledOverCutoff, reason };
    }
    cursor = addDays(cursor, 1);
  }

  // No match in 60 days — fall back to the raw search start so the
  // order still has a date attached. Real systems should treat this
  // as a configuration warning.
  return {
    deliveryDate: startIso,
    rolledOverCutoff,
    reason:
      "No matching delivery day found in the next 60 days — falling back to the search start. Check the customer's serviceability beat days and the holiday calendar.",
  };
}

/** Convenience — just the ISO date, or null. */
export function predictDeliveryDateOnly(
  args: PredictDeliveryArgs,
): string | null {
  return predictExpectedDeliveryDate(args)?.deliveryDate ?? null;
}
