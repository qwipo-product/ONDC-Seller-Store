// Keeps the seller's Orders module and the CDS in step for sellers with
// CDS connector access. Mounted once in the root layout.
//
// Orders → CDS
//   · Confirming an order routes it by serviceability (inside the CDS area →
//     CDS tab, outside → 3PL Logistics tab) and requests the pickup from
//     LBNP straight away — it lands at "Pickup requested".
//   · An order cancelled from the Orders page is cancelled in the CDS.
// CDS → Orders
//   · Edit qty (partial cancel) and partial pickup update the order's
//     quantities and value.
//   · Cancel / Delivered in the CDS update the order's status.

import { useEffect, useMemo, useState } from "react";
import { OPERATOR_SELLER_ID } from "../../lib/cds/master-data";
import { SELLER_CANCELLABLE } from "../../lib/cds/calc";
import { SELLER_CDS_ID, alignToOrdersDay, cdsDeliveryDate, isCdsServiceable, toImported } from "../../lib/cds/order-bridge";
import { engine, getCds, runQuiet, useCds } from "../../lib/cds/store";
import type { CdsOrder } from "../../lib/cds/types";
import {
  getOrders,
  setOrders,
  subscribeToOrders,
  synthesizeProducts,
  type LineQtyModification,
  type Order,
} from "../../lib/orders-data";

/** Ids of orders that are in the CDS flow. */
export function useCdsOrderIds(): Set<string> {
  const s = useCds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new Set(s.orders.map((o) => o.id)), [s.rev]);
}

/** CDS order by id (for stage labels on the Orders page). */
export function useCdsOrderMap(): Map<string, CdsOrder> {
  const s = useCds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new Map(s.orders.map((o) => [o.id, o])), [s.rev]);
}

/** Effective (seller-side) qty per SKU on an Orders-module order. */
function effectiveQty(o: Order): Map<string, { qty: number; actual: number; lineTotal: number; price: number }> {
  const m = new Map<string, { qty: number; actual: number; lineTotal: number; price: number }>();
  for (const p of synthesizeProducts(o)) {
    const mod = o.qtyModifications?.[p.skuId];
    m.set(p.skuId, {
      qty: mod?.modifiedQty ?? p.orderedQuantity,
      actual: mod?.actualQty ?? p.orderedQuantity,
      lineTotal: mod?.actualLineTotal ?? p.totalPrice,
      price: p.pricePerUnit,
    });
  }
  return m;
}

/** Quantity the retailer is billed for on a CDS line. */
function billedQty(l: CdsOrder["lines"][number]): number {
  return l.pickedQty ?? l.confirmedQty;
}

function applyCdsToOrder(o: Order, c: CdsOrder): Order {
  let next = o;

  // Quantities (seller edit / partial pickup).
  const eff = effectiveQty(o);
  const mods: Record<string, LineQtyModification> = { ...(o.qtyModifications ?? {}) };
  let qtyChanged = false;
  for (const l of c.lines) {
    const cur = eff.get(l.sku);
    if (!cur) continue;
    const want = billedQty(l);
    if (want === cur.qty) continue;
    qtyChanged = true;
    if (want === cur.actual) delete mods[l.sku];
    else
      mods[l.sku] = {
        actualQty: cur.actual,
        modifiedQty: want,
        pricePerUnit: l.price,
        actualLineTotal: cur.lineTotal,
        modifiedAt: new Date().toISOString(),
      };
  }
  if (qtyChanged) {
    const original = o.originalOrderValue ?? o.orderValue;
    const remaining = Object.values(mods);
    const reduction = remaining.reduce((s, m) => s + m.actualLineTotal - Math.round(m.modifiedQty * m.pricePerUnit * 100) / 100, 0);
    next = remaining.length
      ? { ...next, qtyModifications: mods, originalOrderValue: original, orderValue: Math.round((original - reduction) * 100) / 100 }
      : { ...next, qtyModifications: undefined, originalOrderValue: undefined, orderValue: original };
  }

  // Status.
  if (c.status === "Cancelled" && next.status !== "Cancelled") {
    next = {
      ...next,
      status: "Cancelled",
      cancelledBy: c.cancelledBy === "Retailer" ? "Buyer" : "Seller",
      cancellationReason: c.cancelReason ?? "Cancelled in CDS",
      cancellationTime: c.history[c.history.length - 1]?.at ?? new Date().toISOString(),
    };
  } else if (c.status === "Delivered" && next.status !== "Delivered" && next.status !== "Cancelled") {
    next = { ...next, status: "Delivered", actualDeliveryDate: c.deliveredAt ? alignToOrdersDay(c.deliveredAt) : undefined };
  } else if (c.status !== "Cancelled" && c.status !== "Delivered" && next.status === "New") {
    // Orders data is in-memory; after a reload the CDS remembers the confirmation.
    next = { ...next, status: "Confirmed" };
  }
  return next;
}

function sync() {
  const s = getCds();
  const byId = new Map(s.orders.map((o) => [o.id, o]));
  const orders = getOrders();

  // Orders → CDS
  const toCancel = orders.filter((o) => {
    const c = byId.get(o.id);
    return o.status === "Cancelled" && c && c.status !== "Cancelled" && SELLER_CANCELLABLE.includes(c.status);
  });
  const toRoute = orders.filter((o) => o.status === "Confirmed" && !o.logisticsRequested && !byId.has(o.id));
  if (toRoute.length || toCancel.length) {
    runQuiet(() => {
      // Confirming does both steps: route by serviceability AND send the
      // pickup request to LBNP (one request per route).
      const byRoute: Record<"cds" | "3pl", string[]> = { cds: [], "3pl": [] };
      for (const o of toRoute) {
        try {
          const route = isCdsServiceable(o) ? "cds" : "3pl";
          engine.moveOrderToCds(OPERATOR_SELLER_ID, SELLER_CDS_ID, toImported(o), undefined, route);
          byRoute[route].push(o.id);
        } catch {
          /* skip */
        }
      }
      for (const ids of Object.values(byRoute)) {
        if (!ids.length) continue;
        try {
          engine.requestPickupTrip(ids, { slot: "Assigned by LBNP" });
        } catch {
          /* skip */
        }
      }
      for (const o of toCancel) {
        try {
          engine.cancelOrder(o.id, o.cancelledBy === "Buyer" ? "Retailer" : "Seller", o.cancellationReason ?? "Cancelled from Orders", undefined);
        } catch {
          /* skip */
        }
      }
    });
    return; // the commit re-runs sync for the reverse direction
  }

  // CDS → Orders
  let changed = false;
  const next = orders.map((o) => {
    let n = o;
    const c = byId.get(o.id);
    if (c && c.sellerId === OPERATOR_SELLER_ID) {
      // CDS orders are delivered the day after the order is placed.
      const due = cdsDeliveryDate(o.orderDate);
      if (n.expectedDeliveryDate !== due) n = { ...n, expectedDeliveryDate: due };
      n = applyCdsToOrder(n, c);
    }
    if (n !== o) changed = true;
    return n;
  });
  if (changed) setOrders(next);
}

export function CdsOrderSync() {
  const s = useCds();
  const [ordersTick, setOrdersTick] = useState(0);
  useEffect(() => subscribeToOrders(() => setOrdersTick((n) => n + 1)), []);
  useEffect(() => {
    sync();
  }, [s.rev, ordersTick]);
  return null;
}
