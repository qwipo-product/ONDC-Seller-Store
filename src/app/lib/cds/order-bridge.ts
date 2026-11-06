// Bridge between the seller's Orders module (lib/orders-data) and the
// CDS store. Pure helpers only — no store/React imports, so the seed
// can use them too.
//
// The two modules run on different calendars: Orders is anchored to a
// fixed demo day (getOrdersToday), the CDS store to the real clock.
// `alignToCdsDay` maps an Orders date onto the CDS calendar so "today"
// means the same day in both.

import { getOrderById, getOrdersToday, synthesizeProducts, type Order } from "../orders-data";
import type { ImportedOrder } from "./engine";
import { localDate } from "./calc";

/** Sellers the admin portal has given CDS connector access (demo). */
export const CDS_CONNECTOR_SELLERS = ["seller-prod-rm-traders"];

/** The CDS whose polygon covers this seller's retailers. */
export const SELLER_CDS_ID = "kkp";

/** YYYY-MM-DD + n days (UTC-safe). */
export function plusDays(date: string, n: number): string {
  const t = Date.parse(date + "T00:00:00Z");
  return Number.isNaN(t) ? date : new Date(t + n * 86400000).toISOString().slice(0, 10);
}

/** CDS rule: delivery is the day after the order was placed. */
export function cdsDeliveryDate(orderDate: string): string {
  return plusDays(orderDate, 1);
}

/** Order / delivery dates for a CDS order, on the Orders-page calendar
 *  so both screens show the same dates. */
export function cdsOrderDates(orderId: string, placedAt: string): { orderDate: string; deliveryDate: string; deliveredOn?: string } {
  const src = getOrderById(orderId);
  const orderDate = src?.orderDate ?? alignToOrdersDay(placedAt);
  return { orderDate, deliveryDate: cdsDeliveryDate(orderDate), deliveredOn: src?.status === "Delivered" ? src.actualDeliveryDate : undefined };
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
}

/** Orders-module date (YYYY-MM-DD) + time → ISO on the CDS calendar. */
export function alignToCdsDay(ordersDate: string, time = "10:00"): string {
  const shift = dayDiff(ordersDate, getOrdersToday());
  const d = new Date();
  d.setDate(d.getDate() + shift);
  const [h, m] = /^\d{1,2}:\d{2}/.test(time) ? time.split(":").map((x) => parseInt(x, 10)) : [10, 0];
  d.setHours(h, m, 0, 0);
  // Never in the future relative to now.
  return d.getTime() > Date.now() ? new Date(Date.now() - 60_000).toISOString() : d.toISOString();
}

/** CDS ISO timestamp → Orders-module date (YYYY-MM-DD). */
export function alignToOrdersDay(iso: string): string {
  const shift = dayDiff(localDate(iso), localDate(new Date()));
  const t = Date.parse(getOrdersToday() + "T00:00:00Z") + shift * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function to24h(t?: string): string {
  if (!t) return "10:00";
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t.trim());
  if (!m) return "10:00";
  let h = parseInt(m[1], 10);
  if (m[3]) {
    const pm = m[3].toUpperCase() === "PM";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  return `${h}:${m[2]}`;
}

/** Map a confirmed seller order into the CDS. Quantity edits made at
 *  confirmation travel with it. */
export function toImported(o: Order): ImportedOrder {
  const lines = synthesizeProducts(o).map((p) => {
    const mod = o.qtyModifications?.[p.skuId];
    return {
      sku: p.skuId,
      name: p.name,
      price: mod?.pricePerUnit ?? p.pricePerUnit,
      orderedQty: mod?.actualQty ?? p.orderedQuantity,
      confirmedQty: mod?.modifiedQty ?? p.orderedQuantity,
    };
  });
  const parts = o.buyerAddress?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];
  const area = parts.length >= 3 ? parts[parts.length - 3] : parts[0] ?? "";
  return {
    id: o.id,
    ondcOrderId: o.channelOrderId ?? o.id,
    retailerName: o.retailerName,
    retailerArea: area,
    retailerPhone: o.buyerContact ?? "",
    placedAt: alignToCdsDay(o.orderDate, to24h(o.orderTime)),
    paymentType: o.paymentMode === "Prepaid" ? "QR" : "Cash",
    lines,
  };
}
