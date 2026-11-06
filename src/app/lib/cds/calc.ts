// Cross Dock Store (CDS) — pure helpers shared by the engine and the UI.

import type {
  CdsOrder,
  CdsOrderLine,
  CdsOrderStatus,
  CdsState,
  Shipment,
  ShipmentStage,
} from "./types";

/** Units expected at the CDS: confirmed, or what the rider actually picked. */
export function pickupQty(l: CdsOrderLine): number {
  return l.pickedQty ?? l.confirmedQty;
}

export function goodQty(l: CdsOrderLine): number {
  if (l.receivedQty === undefined) return pickupQty(l);
  return Math.max(0, Math.min(l.receivedQty, pickupQty(l)) - (l.damagedQty ?? 0));
}

export function isPartialPickup(o: CdsOrder): boolean {
  return o.lines.some((l) => l.pickedQty !== undefined && l.pickedQty < l.confirmedQty);
}

export function isPartiallyCancelled(o: CdsOrder): boolean {
  return o.lines.some((l) => (l.cancelledQty ?? 0) > 0);
}

/** Billable value — confirmed qty before inward, good received qty after. */
export function orderValue(o: CdsOrder): number {
  return o.lines.reduce((s, l) => s + l.price * goodQty(l), 0);
}

export function orderedValue(o: CdsOrder): number {
  return o.lines.reduce((s, l) => s + l.price * l.orderedQty, 0);
}

export function orderUnits(o: CdsOrder): number {
  return o.lines.reduce((s, l) => s + goodQty(l), 0);
}

export function confirmedUnits(o: CdsOrder): number {
  return o.lines.reduce((s, l) => s + l.confirmedQty, 0);
}

export function isModified(o: CdsOrder): boolean {
  return o.lines.some((l) => l.confirmedQty + (l.cancelledQty ?? 0) !== l.orderedQty);
}

export const RECEIVED_STATUSES: CdsOrderStatus[] = ["Received", "Received Short", "Sorting"];

export const CANCELLABLE: CdsOrderStatus[] = [
  "Confirmed",
  "Pickup Requested",
  "Picked Up",
  "In Transit to CDS",
  "Received",
  "Received Short",
  "Sorting",
  "Ready for Dispatch",
];

/** Pipeline stages shown on the Dashboard and as Orders tabs. */
export const PIPELINE: { key: string; label: string; statuses: CdsOrderStatus[]; hint: string }[] = [
  { key: "awaiting", label: "Awaiting Pickup", statuses: ["Confirmed", "Pickup Requested"], hint: "Confirmed by seller, pickup not done" },
  { key: "inbound", label: "Inbound to CDS", statuses: ["Picked Up", "In Transit to CDS"], hint: "With LBNP rider, on the way to CDS" },
  { key: "atcds", label: "At CDS · Sorting", statuses: ["Received", "Received Short", "Sorting"], hint: "Received, being sorted per retailer" },
  { key: "ready", label: "Ready for Dispatch", statuses: ["Ready for Dispatch"], hint: "Packed in retailer crate" },
  { key: "outbound", label: "Out for Delivery", statuses: ["Out for Delivery", "Transferred to CDS"], hint: "With LBNP rider or in CDS transfer" },
  { key: "delivered", label: "Delivered", statuses: ["Delivered"], hint: "OTP verified at retailer" },
  { key: "exceptions", label: "Exceptions", statuses: ["Delivery Failed", "Returned to Seller", "Cancelled"], hint: "Failed, returned or cancelled" },
];

export function pipelineKey(status: CdsOrderStatus): string {
  return PIPELINE.find((p) => p.statuses.includes(status))?.key ?? "awaiting";
}

export function shipmentOrders(s: CdsState, sh: Shipment): CdsOrder[] {
  return sh.orderIds
    .map((id) => s.orders.find((o) => o.id === id))
    .filter((o): o is CdsOrder => !!o && o.status !== "Cancelled");
}

export function shipmentStage(s: CdsState, sh: Shipment): ShipmentStage {
  if (sh.status !== "Open") return sh.status as ShipmentStage;
  const orders = shipmentOrders(s, sh);
  if (orders.length === 0) return "Cancelled";
  if (orders.some((o) => !RECEIVED_STATUSES.includes(o.status))) return "Awaiting Orders";
  const anySorted = orders.some((o) => o.lines.some((l) => (l.sortedQty ?? 0) > 0));
  return anySorted ? "Sorting" : "To Sort";
}

export function shipmentValue(s: CdsState, sh: Shipment): number {
  return shipmentOrders(s, sh).reduce((sum, o) => sum + orderValue(o), 0);
}

export function shipmentUnits(s: CdsState, sh: Shipment): number {
  return shipmentOrders(s, sh).reduce((sum, o) => sum + orderUnits(o), 0);
}

export function sortProgress(s: CdsState, sh: Shipment): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const o of shipmentOrders(s, sh)) {
    if (!RECEIVED_STATUSES.includes(o.status) && o.status !== "Ready for Dispatch") continue;
    for (const l of o.lines) {
      total += goodQty(l);
      done += Math.min(l.sortedQty ?? 0, goodQty(l));
    }
  }
  return { done, total };
}

export function canPack(s: CdsState, sh: Shipment): boolean {
  if (sh.status !== "Open") return false;
  const orders = shipmentOrders(s, sh);
  if (!orders.length) return false;
  return orders.every(
    (o) =>
      RECEIVED_STATUSES.includes(o.status) &&
      o.lines.every((l) => (l.sortedQty ?? 0) >= goodQty(l)),
  );
}

// ---- dates ----

export function localDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayLocal(): string {
  return localDate(new Date());
}

export function dayOffset(date: string): number {
  const a = new Date(date + "T00:00:00");
  const b = new Date(todayLocal() + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function addMinutes(iso: string, mins: number): string {
  return new Date(new Date(iso).getTime() + mins * 60000).toISOString();
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDate(d);
}

// ---- formatting ----

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function fmtINR(n: number): string {
  return `₹${inr.format(Math.round(n))}`;
}

export function fmtINRShort(n: number): string {
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return fmtINR(n);
}

export function fmtTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDayLabel(iso?: string): string {
  if (!iso) return "—";
  const date = iso.length === 10 ? iso : localDate(iso);
  const off = dayOffset(date);
  if (off === 0) return "Today";
  if (off === -1) return "Yesterday";
  if (off === 1) return "Tomorrow";
  return fmtDate(date);
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  return `${fmtDayLabel(iso)}, ${fmtTime(iso)}`;
}

// ---- date range filter ----

export type DateRangeKey = "today" | "yesterday" | "7d" | "30d" | "all";

export const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
];

export function inRange(date: string, range: DateRangeKey): boolean {
  const off = dayOffset(date.length === 10 ? date : localDate(date));
  switch (range) {
    case "today":
      return off === 0;
    case "yesterday":
      return off === -1;
    case "7d":
      return off <= 0 && off > -7;
    case "30d":
      return off <= 0 && off > -30;
    default:
      return true;
  }
}

// ---- CSV export ----

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const esc = (v: string | number) => {
    const str = String(v ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- seller-facing statuses (one vocabulary on every screen) ----

export type StatusTone = "gray" | "blue" | "green" | "amber" | "red" | "purple" | "indigo";

/** Order stage as the seller sees it — matches the CDS tab filters. */
export function sellerOrderStage(status: CdsOrderStatus): { label: string; tone: StatusTone } {
  switch (status) {
    case "Confirmed":
      return { label: "Ready for logistics", tone: "amber" };
    case "Pickup Requested":
      return { label: "Pickup requested", tone: "blue" };
    case "Delivered":
      return { label: "Delivered", tone: "green" };
    case "Delivery Failed":
      return { label: "Delivery failed", tone: "red" };
    case "Returned to Seller":
      return { label: "Returned to you", tone: "purple" };
    case "Cancelled":
      return { label: "Cancelled", tone: "gray" };
    default:
      return { label: "Picked up", tone: "indigo" };
  }
}

export type ReturnStageKey = "raised" | "coming" | "back" | "settled";

/** Return stage as the seller sees it. "Returned to seller", "Refund
 *  processed" and "Closed" all mean the goods are back → "Returned to you". */
export function returnStage(r: { status: string; sellerSettledAt?: string }): { key: ReturnStageKey; label: string; tone: StatusTone } {
  if (r.sellerSettledAt) return { key: "settled", label: "Settled", tone: "green" };
  if (r.status === "Open") return { key: "raised", label: "Return raised", tone: "amber" };
  if (r.status === "Return to Seller Scheduled") return { key: "coming", label: "Coming back to you", tone: "blue" };
  return { key: "back", label: "Returned to you", tone: "purple" };
}

export type PayoutKey = "settled" | "paid" | "onhold" | "due" | "upcoming" | "credit" | "none";

/** Payout status as the seller sees it:
 *  Awaiting delivery → To be paid → Paid to you → Settled (by the seller). */
export function sellerPayoutStatus(o: CdsOrder, s: CdsState): { key: PayoutKey; label: string; tone: StatusTone; sub?: string } {
  if (o.sellerSettledAt) return { key: "settled", label: "Settled", tone: "green", sub: `Confirmed by you ${fmtDateTime(o.sellerSettledAt)}` };
  if (o.status === "Cancelled") return { key: "none", label: "No payment", tone: "gray", sub: "Order cancelled" };
  if (o.status === "Returned to Seller") return { key: "none", label: "No payment", tone: "gray", sub: "Order returned to you" };
  if (o.status !== "Delivered") return { key: "upcoming", label: "Awaiting delivery", tone: "blue", sub: "Expected amount" };
  if (o.paymentType === "Credit") return { key: "credit", label: "Credit · handled offline", tone: "gray", sub: "Collect from the retailer offline" };
  const st = s.settlements.find((x) => x.orderIds.includes(o.id) && x.sellerId === o.sellerId);
  if (st?.status === "Settled") {
    const m = orderMoney(o, s);
    const pending = s.settlements.some((x) => x.status !== "Settled" && x.recoveries?.some((v) => v.orderId === o.id));
    const sub = m.recovered
      ? `Paid ${fmtINR(m.payout + m.recovered)} · return ${fmtINR(m.recovered)} ${pending ? "due in next payout" : "recovered"}`
      : `${st.utr ?? ""} · ${fmtDate(st.settledAt)}`;
    return { key: "paid", label: "Paid to you", tone: "indigo", sub };
  }
  if (st?.status === "On Hold") return { key: "onhold", label: "On hold", tone: "red", sub: st.holdReason };
  return { key: "due", label: "To be paid", tone: "amber", sub: st?.status === "Processing" ? "Processing" : undefined };
}

// ---- seller "Mark settled" (payments and returns) ----

export interface SettleCheck {
  done: boolean;
  /** Seller can mark it settled now. */
  ready: boolean;
  /** Why it can't be marked yet. */
  reason?: string;
}

/** Order is in the seller's "Picked up" stage (with the CDS / delivery partner). */
export function isPickedUpStage(status: CdsOrderStatus): boolean {
  return sellerOrderStage(status).label === "Picked up";
}

/** Pickup handover: ready once the pickup agent confirmed the OTP at the seller. */
export function pickupSettleCheck(o: CdsOrder, s: CdsState): SettleCheck {
  if (o.pickupSettledAt) return { done: true, ready: false };
  const trip = s.trips.find((t) => t.id === o.pickupTripId);
  const stop = trip?.stops.find((st) => st.orderIds.includes(o.id));
  if (!stop || stop.status !== "Done") return { done: false, ready: false, reason: "Waiting for pickup" };
  if (!stop.otpVerified) return { done: false, ready: false, reason: "Waiting for pickup OTP confirmation" };
  return { done: false, ready: true };
}

/** A return is ready once the goods are back with the seller or the refund is done. */
export function returnSettleCheck(r: { status: string; sellerSettledAt?: string; needsReturnToSeller: boolean }): SettleCheck {
  if (r.sellerSettledAt) return { done: true, ready: false };
  if (r.status === "Returned to Seller" || r.status === "Refund Processed" || r.status === "Closed") return { done: false, ready: true };
  if (r.status === "Return to Seller Scheduled") return { done: false, ready: false, reason: "Goods on the way back to you" };
  return { done: false, ready: false, reason: "Waiting for the delivery partner to collect the return" };
}

/** An order's payment is ready once it is delivered and paid to the seller.
 *  Credit orders are handled offline, so they are ready once delivered. */
export function paymentSettleCheck(o: CdsOrder, s: CdsState): SettleCheck {
  if (o.sellerSettledAt) return { done: true, ready: false };
  if (o.status === "Cancelled") return { done: false, ready: false, reason: "Order cancelled — nothing to settle" };
  if (o.status === "Returned to Seller") return { done: false, ready: false, reason: "Order returned — nothing to settle" };
  if (o.status !== "Delivered") return { done: false, ready: false, reason: "Waiting for delivery" };
  // Credit orders are handled offline — the seller settles them once delivered.
  if (o.paymentType !== "Credit") {
    const st = s.settlements.find((x) => x.orderIds.includes(o.id) && x.sellerId === o.sellerId);
    if (st?.status !== "Settled") return { done: false, ready: false, reason: "Waiting for payout to you" };
  }
  // Paid to you (or credit collected) → ready. Returns are settled
  // separately from the Returns tab.
  return { done: false, ready: true };
}

// ---- seller payout trail (shared by Payments and the order panel) ----

export interface OrderMoney {
  ordered: number;
  edited: number;
  shortPickup: number;
  shortCds: number;
  billed: number;
  returns: number;
  payout: number;
  /** Return value recovered from a later payout (order already paid out). */
  recovered: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ordered − edits − short pickup − short/damaged at CDS = billed − returns = payout. */
export function orderMoney(o: CdsOrder, s: CdsState): OrderMoney {
  let ordered = 0, edited = 0, shortPickup = 0, shortCds = 0, billed = 0;
  const cancelled = o.status === "Cancelled";
  for (const l of o.lines) {
    ordered += l.price * l.orderedQty;
    if (cancelled) continue;
    edited += l.price * (l.orderedQty - l.confirmedQty);
    shortPickup += l.price * (l.confirmedQty - pickupQty(l));
    shortCds += l.price * (pickupQty(l) - goodQty(l));
    billed += l.price * goodQty(l);
  }
  if (cancelled) edited = ordered;
  const returns = s.returns.filter((r) => r.orderId === o.id && r.type === "Retailer Return").reduce((x, r) => x + r.value, 0);
  const recovered = s.settlements.flatMap((x) => x.recoveries ?? []).filter((x) => x.orderId === o.id).reduce((x, r) => x + r.amount, 0);
  return {
    ordered: r2(ordered),
    edited: r2(edited),
    shortPickup: r2(shortPickup),
    shortCds: r2(shortCds),
    billed: r2(billed),
    returns: r2(returns),
    payout: r2(Math.max(0, billed - returns)),
    recovered: r2(recovered),
  };
}
