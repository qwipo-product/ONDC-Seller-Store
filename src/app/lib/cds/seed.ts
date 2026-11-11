// Cross Dock Store (CDS) — synthetic Hyderabad operations data.
//
// The seed is not a static fixture: it creates orders and then drives
// them through the same engine actions the UI uses (request pickup →
// LBNP rider → inward → sorting → packing → delivery → payments →
// settlement), so every record is consistent across every screen.
//
// Past 5 days: full cycles with realistic exceptions.
// Today: a mid-day snapshot with orders at every stage.

import { addMinutes, localDate, shipmentOrders } from "./calc";
import {
  acknowledgeDiscrepancy,
  cancelOrder,
  closeDiscrepancy,
  closeReturn,
  confirmHandover,
  createRetailerReturn,
  ctx,
  attachToShipment,
  ensureCreditAccount,
  lbnpArriveAtCds,
  lbnpAssignRider,
  lbnpCompleteDropStop,
  lbnpCompletePickupStop,
  moveOrderToCds,
  markReturnedToSeller,
  packShipment,
  processReturnRefund,
  reattemptShipment,
  receiveTrip,
  recordCreditPayment,
  recordHandover,
  reconcileQr,
  requestDeliveryTrip,
  requestPickupTrip,
  requestTransferTrip,
  resolveFailedQr,
  returnShipmentToSellers,
  scheduleReturnToSeller,
  serviceableCds,
  sortOrderAll,
  sortShipmentAll,
  verifyHandover,
  type InwardEntry,
} from "./engine";
import { CDS_INTENSITY, CDS_LOCATIONS, OPERATOR_SELLER_ID, PRODUCTS, SELLERS, buildRetailers } from "./master-data";
import { seedOrders } from "../orders-data";
import { SELLER_CDS_ID, alignToCdsDay, plusDays, toImported } from "./order-bridge";
import type { CdsOrder, CdsState, CdsTrip, PaymentType, Shipment } from "./types";

export const CDS_DATA_VERSION = 38;
const PAST_DAYS = 4;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r = () => ctx.rand();
const pick = <X,>(arr: X[]): X => arr[Math.floor(r() * arr.length)];
const chance = (p: number) => r() < p;
function shuffle<X>(arr: X[]): X[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** ISO timestamp for local time on today + `off` days. Minutes may overflow. */
function at(off: number, h: number, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + off);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const TOKEN = "ABCDEFGHJKMNPQRSTUVWXYZ2345678";
function orderId(placedAt: string): string {
  const d = new Date(placedAt);
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  let tok = "";
  for (let i = 0; i < 6; i++) tok += TOKEN[Math.floor(r() * TOKEN.length)];
  return `QWI-ONDC-${ymd}-${tok}`;
}

const FAIL_REASONS = [
  "Shop closed — shutter down at delivery time",
  "Retailer not reachable on phone",
  "Retailer asked to deliver tomorrow",
  "Cash not ready with retailer",
  "Wrong address pin — could not locate shop",
];
const RETAILER_CANCEL = [
  "Ordered by mistake",
  "Found a better price locally",
  "Duplicate order",
  "Shop closed for a family function",
];
const SELLER_CANCEL = ["Out of stock at seller", "Price revision from company", "Item discontinued"];
const RETURN_REASONS = [
  "Near-expiry stock received",
  "Pack leaking / torn on opening",
  "Wrong variant delivered",
  "Retailer did not order this variant",
];
const DISC_RESOLUTIONS = [
  "Seller issued credit note for short units",
  "Damaged units sent back on next pickup",
  "Seller confirmed short dispatch — order adjusted",
  "Excess units returned to seller",
];

function retailersOf(cdsId: string) {
  return ctx.s.retailers.filter((x) => x.cdsId === cdsId);
}
function sellersOf(cdsId: string) {
  // The connector seller's CDS orders come only from their Orders page (sellerStory).
  return SELLERS.filter((s) => s.cdsIds.includes(cdsId) && s.id !== OPERATOR_SELLER_ID);
}

function retailerMode(retailerId: string): PaymentType {
  return Number(retailerId.slice(2)) % 3 === 0 ? "QR" : "Cash";
}

function createOrder(
  cdsId: string,
  sellerId: string,
  retailerId: string,
  off: number,
  opts: { placedAt?: string; confirmedAt?: string } = {},
): CdsOrder {
  const seller = SELLERS.find((s) => s.id === sellerId)!;
  const retailer = ctx.s.retailers.find((x) => x.id === retailerId)!;
  const prods = shuffle(PRODUCTS.filter((p) => seller.brands.includes(p.brand)));
  const nLines = Math.min(prods.length, 2 + Math.floor(r() * 4));
  const lines = prods.slice(0, nLines).map((p) => {
    const max = p.price >= 2000 ? 2 : p.price >= 1000 ? 4 : 8;
    const qty = 1 + Math.floor(r() * max);
    return { sku: p.sku, name: p.name, brand: p.brand, uom: p.uom, price: p.price, orderedQty: qty, confirmedQty: qty };
  });
  const placedAt = opts.placedAt ?? at(off - 1, 10 + Math.floor(r() * 10), Math.floor(r() * 60));
  const confirmedAt = opts.confirmedAt ?? addMinutes(placedAt, 20 + Math.floor(r() * 110));
  let paymentType: PaymentType = retailerMode(retailerId);
  if (chance(0.2)) {
    paymentType = "Credit";
    ensureCreditAccount(sellerId, retailerId);
  }
  const o: CdsOrder = {
    id: orderId(placedAt),
    ondcOrderId: `${Math.floor(1e15 + r() * 8.9e15)}`,
    sellerId,
    retailerId,
    cdsId,
    placedAt,
    confirmedAt,
    waveDate: localDate(at(off, 12)),
    lines,
    paymentType,
    status: "Confirmed",
    history: [],
  };
  const total = lines.reduce((s, l) => s + l.price * l.orderedQty, 0);
  o.history.push({
    at: placedAt,
    title: "Order placed on Buyer App",
    note: `${lines.length} items · ₹${total.toLocaleString("en-IN")} · ${paymentType === "Credit" ? "Seller credit" : paymentType === "QR" ? "Pay by QR on delivery" : "Cash on delivery"}`,
    leg: "order",
    by: retailer.name,
  });
  const modLine = lines.find((l) => l.orderedQty >= 2);
  if (modLine && chance(0.15)) {
    const cut = modLine.orderedQty >= 4 && chance(0.4) ? 2 : 1;
    modLine.confirmedQty = modLine.orderedQty - cut;
    o.history.push({
      at: addMinutes(confirmedAt, -2),
      title: "Order modified at confirmation",
      note: `${modLine.name}: ${modLine.orderedQty} → ${modLine.confirmedQty} (limited stock)`,
      leg: "order",
      by: seller.name,
    });
  }
  o.history.push({ at: confirmedAt, title: "Confirmed by seller", note: "Eligible for CDS pickup planning", leg: "order", by: seller.name, status: "Confirmed" });
  ctx.s.orders.push(o);
  attachToShipment(o);
  return o;
}

function randomEntries(t: CdsTrip, force?: { shortFirst?: boolean; damageSecond?: boolean }): InwardEntry[] {
  const entries: InwardEntry[] = [];
  const orders = t.stops.flatMap((s) => s.orderIds).map((id) => ctx.s.orders.find((o) => o.id === id)!).filter((o) => o.status === "In Transit to CDS");
  orders.forEach((o, oi) => {
    o.lines.forEach((l, li) => {
      let rq = l.confirmedQty;
      let dq = 0;
      const x = r();
      if (force?.shortFirst && oi === 0 && li === 0) rq = Math.max(0, l.confirmedQty - 1);
      else if (force?.damageSecond && oi === 1 && li === 0) dq = 1;
      else if (x < 0.03) rq = Math.max(0, l.confirmedQty - 1);
      else if (x < 0.05) dq = 1;
      else if (x < 0.057) rq = l.confirmedQty + 1;
      entries.push({ orderId: o.id, sku: l.sku, receivedQty: rq, damagedQty: Math.min(dq, rq) });
    });
  });
  return entries;
}

function trip(id: string) {
  return ctx.s.trips.find((t) => t.id === id)!;
}

function runPickup(ids: string[], off: number, startMin: number, stage: "received" | "arrived" | "transit" | "assigned" | "requested", force?: { shortFirst?: boolean; damageSecond?: boolean }) {
  if (!ids.length) return undefined;
  const tid = requestPickupTrip(ids, { at: at(off, 7, startMin) });
  if (stage === "requested") return tid;
  lbnpAssignRider(tid, at(off, 7, startMin + 25));
  if (stage === "assigned") return tid;
  const t = trip(tid);
  const stops = t.stops;
  stops.forEach((st, i) => {
    if (stage === "transit" && i === stops.length - 1 && stops.length > 1) return;
    if (stage === "transit" && stops.length === 1) return;
    const shortAtPickup = stage === "arrived" && i === 0 && st.expectedUnits > 3;
    lbnpCompletePickupStop(tid, st.id, {
      at: at(off, 8, startMin + 10 + i * 35),
      collectedUnits: shortAtPickup ? st.expectedUnits - 1 : undefined,
      exception: shortAtPickup ? "Seller short by 1 unit at pickup — noted by rider" : undefined,
    });
  });
  if (stage === "transit") return tid;
  lbnpArriveAtCds(tid, at(off, 10, 30 + startMin));
  if (stage === "arrived") return tid;
  receiveTrip(tid, randomEntries(t, force), { at: at(off, 11, startMin) });
  return tid;
}

function deliverShipments(cdsId: string, shs: Shipment[], off: number, startH: number, startM: number, opts: { pendingLast?: number; failRate?: number; qrFailRate?: number } = {}) {
  if (!shs.length) return undefined;
  const tid = requestDeliveryTrip(cdsId, shs.map((s) => s.id), { at: at(off, startH, startM) });
  lbnpAssignRider(tid, at(off, startH, startM + 15));
  confirmHandover(tid, undefined, at(off, startH, startM + 35));
  const t = trip(tid);
  const doneCount = t.stops.length - (opts.pendingLast ?? 0);
  t.stops.slice(0, doneCount).forEach((st, i) => {
    const failed = chance(opts.failRate ?? 0.07);
    lbnpCompleteDropStop(
      tid,
      st.id,
      failed ? { delivered: false, reason: pick(FAIL_REASONS) } : { delivered: true, qrFailed: chance(opts.qrFailRate ?? 0.1) },
      at(off, startH, startM + 60 + i * 26),
    );
  });
  return tid;
}

function waveShipments(cdsId: string, off: number): Shipment[] {
  const wave = localDate(at(off, 12));
  return ctx.s.shipments.filter((sh) => sh.cdsId === cdsId && sh.waveDate === wave);
}

function sortAndPack(shs: Shipment[], off: number, h: number, m: number) {
  shs.forEach((sh, i) => {
    if (sh.status !== "Open" || !shipmentOrders(ctx.s, sh).length) return;
    sortShipmentAll(sh.id, at(off, h, m + i * 3));
    try {
      packShipment(sh.id, at(off, h, m + 20 + i * 3));
    } catch {
      /* not every order received — stays in sorting */
    }
  });
}

// ---------------- past days ----------------

function pastWave(cdsId: string, off: number, k: number) {
  const sellers = sellersOf(cdsId);
  const rets = retailersOf(cdsId);
  const n = Math.round(4 + 8 * k);
  const orders: CdsOrder[] = [];
  for (let i = 0; i < n; i++) orders.push(createOrder(cdsId, pick(sellers).id, pick(rets).id, off));
  if (chance(0.4)) cancelOrder(orders[0].id, "Retailer", pick(RETAILER_CANCEL), at(off, 7, 5));
  if (chance(0.15) && orders.length > 3) cancelOrder(orders[1].id, "Seller", pick(SELLER_CANCEL), at(off - 1, 21, 40));

  const live = orders.filter((o) => o.status === "Confirmed");
  const sellerIds = [...new Set(live.map((o) => o.sellerId))];
  const half = sellerIds.length > 3 ? Math.ceil(sellerIds.length / 2) : sellerIds.length;
  [sellerIds.slice(0, half), sellerIds.slice(half)]
    .filter((g) => g.length)
    .forEach((g, gi) => {
      runPickup(live.filter((o) => g.includes(o.sellerId)).map((o) => o.id), off, 15 + gi * 12, "received");
    });

  const shs = waveShipments(cdsId, off);
  sortAndPack(shs, off, 11, 45);
  const packedAll = shs.filter((s) => s.status === "Packed");
  const packed = packedAll.filter((s) => serviceableCds(s) === cdsId);

  // Serviceability check (#7): border retailers go via another CDS.
  for (const sh of packedAll.filter((s) => serviceableCds(s) !== cdsId)) {
    const target = serviceableCds(sh);
    const tid = requestTransferTrip(cdsId, [sh.id], target, { at: at(off, 12, 40), note: "Serviceability check routed this retailer to a nearby CDS" });
    lbnpAssignRider(tid, at(off, 12, 55));
    confirmHandover(tid, undefined, at(off, 13, 10));
    lbnpCompleteDropStop(tid, trip(tid).stops[0].id, { delivered: true }, at(off, 13, 55));
    deliverShipments(target, [sh], off, 15, 30, { failRate: 0 });
  }

  for (let i = 0; i < packed.length; i += 5) {
    deliverShipments(cdsId, packed.slice(i, i + 5), off, 13, 5 + (i / 5) * 12);
  }

  // Failed deliveries — re-attempt next day or RTO; yesterday's stay open.
  for (const sh of shs.filter((s) => s.status === "Delivery Failed")) {
    if (off >= -1) continue;
    if (chance(0.7)) {
      reattemptShipment(sh.id, at(off + 1, 9, 0));
      deliverShipments(cdsId, [sh], off + 1, 15, 0, { failRate: 0 });
    } else {
      returnShipmentToSellers(sh.id, at(off + 1, 10, 0));
    }
  }

  // Cash handover per delivery trip (agent → CDS), QR reconciliation.
  const wave = localDate(at(off, 12));
  const dTrips = ctx.s.trips.filter((t) => t.kind === "Delivery" && t.cdsId === cdsId && localDate(t.requestedAt) === wave);
  dTrips.forEach((t, ti) => {
    const cols = ctx.s.collections.filter((c) => c.tripId === t.id && c.mode === "Cash" && c.status === "Collected");
    if (!cols.length) return;
    if (off === -1 && ti === dTrips.length - 1 && dTrips.length > 1) return; // agent yet to hand over
    const expected = cols.reduce((s, c) => s + c.amountCollected, 0);
    const short = cdsId === "kkp" && off === -3 && ti === 0 ? 150 : 0;
    const hid = recordHandover(cdsId, t.rider!.name, cols.map((c) => c.id), expected - short, at(off, 19, 20 + ti * 10));
    if (off <= -2 || ti === 0) verifyHandover(hid, at(off, 20, ti * 10));
  });
  const waveCols = ctx.s.collections.filter((c) => c.cdsId === cdsId && localDate(c.at) === wave);
  if (off <= -2) {
    for (const c of waveCols.filter((x) => x.status === "Failed")) resolveFailedQr(c.id, chance(0.5) ? "retry" : "cash", at(off + 1, 11, 0));
    reconcileQr(waveCols.filter((x) => x.mode === "QR").map((x) => x.id));
  }

  // Discrepancies and receiving returns.
  const waveOrderIds = new Set(orders.map((o) => o.id));
  for (const d of ctx.s.discrepancies.filter((x) => waveOrderIds.has(x.orderId))) {
    if (off <= -2) {
      acknowledgeDiscrepancy(d.id, at(off, 16, 0));
      closeDiscrepancy(d.id, pick(DISC_RESOLUTIONS), at(off + 1, 12, 0));
    } else if (chance(0.5)) {
      acknowledgeDiscrepancy(d.id, at(off, 17, 0));
    }
  }
  for (const rc of ctx.s.returns.filter((x) => waveOrderIds.has(x.orderId) && x.status === "Open")) {
    if (off <= -2) {
      scheduleReturnToSeller(rc.id, at(off, 16, 30));
      markReturnedToSeller(rc.id, at(off + 1, 9, 30));
      if (off <= -3) closeReturn(rc.id, at(off + 2, 10, 0));
    } else {
      scheduleReturnToSeller(rc.id, at(off, 18, 0));
    }
  }

  // Retailer returns after delivery.
  if (off <= -2) {
    for (const o of orders.filter((x) => x.status === "Delivered")) {
      if (!chance(0.06)) continue;
      const line = o.lines.find((l) => (l.deliveredQty ?? 0) > 0);
      if (!line) continue;
      const rid = createRetailerReturn(o.id, [{ sku: line.sku, qty: 1 }], pick(RETURN_REASONS), at(off + 1, 11, 30));
      if (off <= -3) {
        scheduleReturnToSeller(rid, at(off + 1, 12, 0));
        markReturnedToSeller(rid, at(off + 2, 9, 45));
        processReturnRefund(rid, at(off + 2, 15, 0));
        if (off <= -4) closeReturn(rid, at(off + 3, 10, 0));
      }
    }
  }
}

// ---------------- today ----------------

function todayFull(cdsId: string) {
  const sellers = shuffle(sellersOf(cdsId));
  const rets = shuffle(retailersOf(cdsId));
  const routedIdx = rets.findIndex((x) => x.serviceableCdsId !== cdsId);
  if (routedIdx > 3) [rets[3], rets[routedIdx]] = [rets[routedIdx], rets[3]];
  const slots: [string, number][] = [["recv", 2], ["arr", 1], ["transit", 2], ["req", 1], ["conf", 1], ["assigned", 1]];
  const groups: Record<string, string[]> = {};
  let idx = 0;
  for (const [name, size] of slots) {
    groups[name] = sellers.slice(idx, idx + size).map((s) => s.id);
    idx += size;
  }
  const recv = groups.recv;
  const later = [...groups.arr, ...groups.transit];
  const nonRecv = sellers.map((s) => s.id).filter((id) => !recv.includes(id));
  const aCount = Math.min(7, rets.length - 6);
  const A = rets.slice(0, aCount);
  const B = rets.slice(aCount, aCount + 3);
  const rest = rets.slice(aCount + 3);

  A.forEach((ret, i) => {
    createOrder(cdsId, recv[i % recv.length], ret.id, 0);
    if (recv.length > 1 && chance(0.55)) createOrder(cdsId, recv[(i + 1) % recv.length], ret.id, 0);
  });
  B.forEach((ret) => {
    createOrder(cdsId, pick(recv), ret.id, 0);
    if (later.length) createOrder(cdsId, pick(later), ret.id, 0);
  });
  rest.forEach((ret) => {
    const n = 1 + (chance(0.4) ? 1 : 0);
    const used = new Set<string>();
    for (let i = 0; i < n; i++) {
      const sid = pick(nonRecv.filter((x) => !used.has(x)));
      if (!sid) break;
      used.add(sid);
      createOrder(cdsId, sid, ret.id, 0);
    }
  });
  const wave = localDate(at(0, 12));
  const todays = () => ctx.s.orders.filter((o) => o.cdsId === cdsId && o.waveDate === wave);
  for (const sid of nonRecv) {
    if (!todays().some((o) => o.sellerId === sid)) createOrder(cdsId, sid, pick(rest.length ? rest : rets).id, 0);
  }

  const idsOf = (g: string[]) => todays().filter((o) => g.includes(o.sellerId) && o.status === "Confirmed").map((o) => o.id);

  // Cancellations: one by a retailer, one by a seller (out of stock).
  const reqIds = idsOf(groups.req);
  if (reqIds.length > 1) cancelOrder(reqIds[0], "Retailer", pick(RETAILER_CANCEL), at(0, 8, 10));
  const confIds = idsOf(groups.conf);
  if (confIds.length > 1) cancelOrder(confIds[0], "Seller", pick(SELLER_CANCEL), at(0, 9, 40));

  runPickup(idsOf(groups.recv), 0, 20, "received", { shortFirst: true, damageSecond: true });
  runPickup(idsOf(groups.arr), 0, 25, "arrived");
  runPickup(idsOf(groups.transit), 0, 35, "transit");
  if (groups.assigned.length) {
    const tid = requestPickupTrip(idsOf(groups.assigned), { at: at(0, 9, 10) });
    lbnpAssignRider(tid, at(0, 12, 20));
  }
  if (groups.req.length) requestPickupTrip(idsOf(groups.req), { at: at(0, 12, 45), slot: "Midday · 13:00 – 15:00" });

  // Late confirmations — the morning pickup already left this seller.
  for (let i = 0; i < 2; i++) {
    const ret = pick(rest.length ? rest : rets);
    createOrder(cdsId, recv[0], ret.id, 0, { placedAt: at(0, 9, 5 + i * 20), confirmedAt: at(0, 10, 45 + i * 10) });
  }

  const shOf = (retId: string) => ctx.s.shipments.find((s) => s.cdsId === cdsId && s.retailerId === retId && s.waveDate === wave && s.status === "Open");
  const aShs = A.map((x) => shOf(x.id)).filter((x): x is Shipment => !!x);
  sortAndPack(aShs.slice(0, 5), 0, 11, 20);
  const packedA = aShs.slice(0, 5).filter((s) => s.status === "Packed");
  const routed = packedA.filter((s) => serviceableCds(s) !== cdsId);
  const out = packedA.filter((s) => serviceableCds(s) === cdsId).slice(0, 3);
  if (out.length) {
    const tid = requestDeliveryTrip(cdsId, out.map((s) => s.id), { at: at(0, 12, 5) });
    lbnpAssignRider(tid, at(0, 12, 20));
    confirmHandover(tid, undefined, at(0, 12, 35));
    const t = trip(tid);
    t.stops.slice(0, Math.max(0, t.stops.length - 1)).forEach((st, i) => {
      lbnpCompleteDropStop(tid, st.id, { delivered: true }, at(0, 13, 0 + i * 15));
    });
  }
  const tr = routed[0];
  if (tr) {
    const tid = requestTransferTrip(cdsId, [tr.id], serviceableCds(tr), { at: at(0, 12, 15), note: "Serviceability check routed this retailer to a nearby CDS" });
    lbnpAssignRider(tid, at(0, 12, 40));
  }
  const sorting = aShs[5];
  if (sorting) {
    const first = shipmentOrders(ctx.s, sorting)[0];
    if (first) sortOrderAll(first.id, at(0, 12, 10));
  }
}

function todaySimple(cdsId: string, k: number) {
  const sellers = shuffle(sellersOf(cdsId));
  const rets = retailersOf(cdsId);
  const n = Math.round(6 + 12 * k);
  const waiting = sellers.length >= 3 ? sellers[sellers.length - 1].id : undefined;
  const active = sellers.filter((s) => s.id !== waiting);
  for (let i = 0; i < n; i++) {
    const sid = waiting && i % 4 === 3 ? waiting : pick(active).id;
    createOrder(cdsId, sid, pick(rets).id, 0);
  }
  const wave = localDate(at(0, 12));
  const ids = ctx.s.orders.filter((o) => o.cdsId === cdsId && o.waveDate === wave && o.sellerId !== waiting).map((o) => o.id);
  runPickup(ids, 0, 30, "received", { shortFirst: true });
  const shs = waveShipments(cdsId, 0).filter((s) => s.status === "Open");
  const ready = shs.filter((s) => shipmentOrders(ctx.s, s).every((o) => o.status === "Received" || o.status === "Received Short"));
  const half = Math.ceil(ready.length / 2);
  sortAndPack(ready.slice(0, half), 0, 11, 50);
  const packed = ready.slice(0, half).filter((s) => s.status === "Packed");
  if (packed.length > 1) {
    const tid = requestDeliveryTrip(cdsId, packed.slice(0, -1).map((s) => s.id), { at: at(0, 12, 30) });
    lbnpAssignRider(tid, at(0, 12, 45));
  }
  const s0 = ready[half];
  if (s0) {
    const first = shipmentOrders(ctx.s, s0)[0];
    if (first) sortOrderAll(first.id, at(0, 12, 20));
  }
}

// ---------------- logged-in seller story ----------------
// Guarantees the demo seller (RM Traders) has an order in every state
// the seller needs to see: ready to send, pickup requested, partial
// pickup, at CDS, out for delivery, delivered, returned, cancelled and
// partially cancelled.

function sellerStory() {
  // The connector seller's CDS orders are the SAME orders as on the
  // Orders page (lib/orders-data): every Confirmed and Delivered order
  // went through the CDS. Stages below give the demo one order at
  // each step.
  const cds = SELLER_CDS_ID;
  const sid = OPERATOR_SELLER_ID;
  // trim: the seller reduced a line on the New tab before confirming.
  const imp = (id: string, off: number, h = 8, m = 10, trim = 0, route: "cds" | "3pl" = "cds") => {
    const src = seedOrders.find((o) => o.id === id);
    if (!src) return undefined;
    const input = toImported(src);
    if (trim > 0) {
      const l = input.lines.find((x) => x.confirmedQty >= 4) ?? input.lines[0];
      l.confirmedQty -= Math.max(1, Math.floor(l.confirmedQty * trim));
    }
    return moveOrderToCds(sid, cds, input, at(off, h, m), route);
  };
  const confirmed = seedOrders.filter((o) => o.status === "Confirmed").map((o) => o.id);
  const delivered = seedOrders.filter((o) => o.status === "Delivered");

  // Delivered — each on its own (aligned) delivery day.
  const back: string[] = [];
  for (const [i, o] of delivered.entries()) {
    const dDay = alignToCdsDay(o.actualDeliveryDate ?? o.orderDate);
    const off = Math.min(-1, Math.round((new Date(localDate(dDay) + "T12:00:00").getTime() - new Date(localDate(new Date()) + "T12:00:00").getTime()) / 86400000));
    // The second delivered order was trimmed by the seller before confirming.
    const c = imp(o.id, off, 6, 30, i === 1 ? 0.25 : 0);
    if (!c) continue;
    runPickup([c.id], off, 0, "received");
    const sh = ctx.s.shipments.find((x) => x.id === c.shipmentId);
    if (!sh) continue;
    sortAndPack([sh], off, 12, 0);
    if (sh.status === "Packed") deliverShipments(cds, [sh], off, 14, 0, { failRate: 0, qrFailRate: 0 });
    if (c.status === "Delivered") back.push(c.id);
  }
  const ret = back.length ? ctx.s.orders.find((o) => o.id === back[0]) : undefined;
  if (ret) createRetailerReturn(ret.id, [{ sku: ret.lines[0].sku, qty: 1 }], "Pack leaking / torn on opening", at(0, 10, 15));
  // Returned before payout — deducted in the same payout, all settled.
  const o4 = back[3] ? ctx.s.orders.find((o) => o.id === back[3]) : undefined;
  if (o4) {
    const id = createRetailerReturn(o4.id, [{ sku: o4.lines[0].sku, qty: 1 }], "Wrong item delivered", at(-2, 12, 0));
    scheduleReturnToSeller(id, at(-2, 15, 0));
    markReturnedToSeller(id, at(-1, 9, 0));
    processReturnRefund(id, at(-1, 11, 0));
    closeReturn(id, at(-1, 11, 5));
  }
  // Confirmed today — confirming routes an order automatically (these are
  // all inside the CDS area). In stage order:
  //   [0..1] ready for logistics (one edited before confirming),
  //   [2]    cancelled by the retailer before pickup,
  //   [3..4] pickup requested, [5] partial pickup, [6] out for delivery.
  const c = confirmed.map((id, i) => imp(id, 0, 8, 5 + i, i === 0 ? 0.2 : 0)).filter((x): x is CdsOrder => !!x);
  const multi = (o: CdsOrder) => o.lines.find((l) => l.confirmedQty >= 2) ?? o.lines[0];
  if (c[2]) cancelOrder(c[2].id, "Retailer", "Ordered by mistake", at(0, 9, 40));
  if (c[3] && c[4]) requestPickupTrip([c[3].id, c[4].id], { at: at(0, 10, 0), slot: "Assigned by LBNP" });
  if (c[5]) {
    const t1 = requestPickupTrip([c[5].id], { at: at(0, 7, 30) });
    lbnpAssignRider(t1, at(0, 7, 50));
    lbnpCompletePickupStop(t1, trip(t1).stops[0].id, { at: at(0, 8, 40), shortLines: [{ orderId: c[5].id, sku: multi(c[5]).sku, qty: 1 }] });
  }
  if (c[6]) {
    runPickup([c[6].id], 0, 5, "received");
    const sh = ctx.s.shipments.find((x) => x.id === c[6].shipmentId);
    if (sh) {
      sortAndPack([sh], 0, 11, 40);
      if (sh.status === "Packed") deliverShipments(cds, [sh], 0, 12, 0, { pendingLast: 1 });
    }
  }

  // 3PL Logistics — retailers outside the CDS area. Picked up from the
  // seller and delivered straight to the retailer (no CDS stop).
  const p3 = (id: string, off: number) => imp(id, off, 8, 20, 0, "3pl");
  // Ready for logistics
  p3("QWI-ONDC-260517-R8T3LM", 0);
  p3("QWI-ONDC-260514-T1R7NH", 0);
  // Pickup requested
  const pr = [p3("QWI-ONDC-260516-H5V9PK", 0), p3("QWI-ONDC-260515-Q2X6BN", 0)].filter((x): x is CdsOrder => !!x);
  if (pr.length) requestPickupTrip(pr.map((o) => o.id), { at: at(0, 10, 30), slot: "Assigned by LBNP" });
  // Picked up (OTP) and out for delivery with the 3PL rider
  const ofd = p3("QWI-ONDC-260517-D3F8KT", 0);
  if (ofd) {
    const t = requestPickupTrip([ofd.id], { at: at(0, 7, 40), slot: "Assigned by LBNP" });
    lbnpAssignRider(t, at(0, 8, 0));
    lbnpCompletePickupStop(t, trip(t).stops[0].id, { at: at(0, 9, 0) });
  }
  // Delivered by 3PL — on each order's delivery day (order date + 1).
  for (const id of ["QWI-ONDC-260513-W7C1DZ", "QWI-ONDC-260516-M9B2VC", "QWI-ONDC-260515-P6L4XE"]) {
    const src = seedOrders.find((x) => x.id === id);
    if (!src) continue;
    const dDay = alignToCdsDay(plusDays(src.orderDate, 1));
    const off = Math.min(-1, Math.round((new Date(localDate(dDay) + "T12:00:00").getTime() - new Date(localDate(new Date()) + "T12:00:00").getTime()) / 86400000));
    const o = p3(id, off);
    if (!o) continue;
    const t = requestPickupTrip([o.id], { at: at(off, 8, 0), slot: "Assigned by LBNP" });
    lbnpAssignRider(t, at(off, 8, 20));
    lbnpCompletePickupStop(t, trip(t).stops[0].id, { at: at(off, 9, 30) });
    const sh = ctx.s.shipments.find((x) => x.id === o.shipmentId);
    const dt = sh?.deliveryTripId ? trip(sh.deliveryTripId) : undefined;
    if (dt) lbnpCompleteDropStop(dt.id, dt.stops[0].id, { delivered: true }, at(off, 11, 0));
  }

  // ---- Extra cases so every filter has an example in demos ----
  // (logistics for anything still waiting is requested at the end)

  // 3PL cancelled by the retailer before pickup (Ghatkesar).
  const cx3 = p3("QWI-ONDC-260511-V2N9JD", 0);
  if (cx3) cancelOrder(cx3.id, "Retailer", "Shop closed for renovation", at(0, 9, 15));

  // 3PL delivered, then a retailer return that is on its way back (Patancheru).
  const r3 = p3("QWI-ONDC-260512-K8W5QZ", -2);
  if (r3) {
    const t3 = requestPickupTrip([r3.id], { at: at(-2, 8, 0), slot: "Assigned by LBNP" });
    lbnpAssignRider(t3, at(-2, 8, 20));
    lbnpCompletePickupStop(t3, trip(t3).stops[0].id, { at: at(-2, 9, 30) });
    const sh = ctx.s.shipments.find((x) => x.id === r3.shipmentId);
    const dt = sh?.deliveryTripId ? trip(sh.deliveryTripId) : undefined;
    if (dt) lbnpCompleteDropStop(dt.id, dt.stops[0].id, { delivered: true }, at(-2, 11, 30));
    if (r3.status === "Delivered") {
      const rid = createRetailerReturn(r3.id, [{ sku: r3.lines[0].sku, qty: 1 }], "Damaged pack received", at(-1, 11, 0));
      scheduleReturnToSeller(rid, at(-1, 16, 0));
    }
  }

  // CDS delivered today, QR payment failed — shows under "Needs attention" (Banjara Hills).
  const qr = imp("QWI-ONDC-260519-X7B2QC", 0, 6, 40);
  if (qr) {
    runPickup([qr.id], 0, 2, "received");
    const sh = ctx.s.shipments.find((x) => x.id === qr.shipmentId);
    if (sh) {
      sortAndPack([sh], 0, 11, 20);
      if (sh.status === "Packed") deliverShipments(cds, [sh], 0, 12, 10, { failRate: 0, qrFailRate: 1 });
    }
  }

  // Confirming requests logistics straight away — nothing waits at "Ready".
  for (const route of ["cds", "3pl"] as const) {
    const ids = ctx.s.orders.filter((o) => o.sellerId === sid && o.status === "Confirmed" && (o.route ?? "cds") === route).map((o) => o.id);
    if (ids.length) requestPickupTrip(ids, { at: at(0, 8, 30), slot: "Assigned by LBNP" });
  }
}


function sellerLateReturns() {
  // Returns raised after these orders were paid out (run after finalise).
  const back = ctx.s.orders.filter((o) => o.sellerId === OPERATOR_SELLER_ID && o.status === "Delivered" && (o.route ?? "cds") === "cds").sort((a, b) => (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? "")).map((o) => o.id);
  const o3 = back[2] ? ctx.s.orders.find((o) => o.id === back[2]) : undefined;
  if (o3) {
    const id = createRetailerReturn(o3.id, [{ sku: o3.lines[0].sku, qty: 2 }], "Near expiry date", at(-1, 16, 0));
    scheduleReturnToSeller(id, at(-1, 18, 0));
    markReturnedToSeller(id, at(0, 9, 30));
  }

}

// ---------------- finalise ----------------

function finalise() {
  const today = localDate(new Date());
  for (const st of ctx.s.settlements) {
    const off = Math.round((new Date(st.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
    if (off <= -3 && (st.status !== "On Hold" || off <= -4)) {
      st.status = "Settled";
      st.holdReason = undefined;
      const d = new Date(st.date + "T11:00:00");
      d.setDate(d.getDate() + 2);
      st.settledAt = d.toISOString();
      st.utr = `UTR${Math.floor(1e11 + r() * 8.9e11)}`;
    } else if (off === -2 && st.status === "Pending") {
      st.status = "Processing";
    }
  }
  for (const e of ctx.s.credit) {
    const ageDays = (Date.now() - new Date(e.deliveredAt).getTime()) / 86400000;
    if (ageDays < 2.5) continue;
    const x = r();
    const payAt = addMinutes(e.deliveredAt, 60 * 24 * Math.max(1, Math.floor(ageDays - 1)));
    if (x < 0.5) recordCreditPayment(e.id, e.amount, `UPI/${Math.floor(1e9 + r() * 8e9)}`, payAt);
    else if (x < 0.75) recordCreditPayment(e.id, Math.round(e.amount / 2), `NEFT/${Math.floor(1e9 + r() * 8e9)}`, payAt);
  }
}

export function buildSeed(): CdsState {
  ctx.rand = mulberry32(20261106);
  ctx.s = {
    version: CDS_DATA_VERSION,
    seededOn: localDate(new Date()),
    rev: 0,
    selectedCdsId: "kkp",
    locations: CDS_LOCATIONS,
    sellers: SELLERS,
    retailers: [],
    products: PRODUCTS,
    creditAccounts: [],
    orders: [],
    trips: [],
    inward: [],
    shipments: [],
    collections: [],
    handovers: [],
    credit: [],
    settlements: [],
    adjustments: [],
    discrepancies: [],
    returns: [],
    counters: {},
  };
  ctx.s.retailers = buildRetailers(ctx.rand);
  const active = CDS_LOCATIONS.filter((l) => l.status === "Active");
  for (let off = -PAST_DAYS; off <= -1; off++) {
    for (const loc of active) {
      try {
        pastWave(loc.id, off, CDS_INTENSITY[loc.id] ?? 0.3);
      } catch (e) {
        console.error(`[CDS seed] past wave ${loc.id} ${off}`, e);
      }
    }
  }
  for (const loc of active) {
    const k = CDS_INTENSITY[loc.id] ?? 0.3;
    try {
      if (k >= 0.7) todayFull(loc.id);
      else todaySimple(loc.id, k);
    } catch (e) {
      console.error(`[CDS seed] today ${loc.id}`, e);
    }
  }
  try {
    sellerStory();
  } catch (e) {
    console.error("[CDS seed] seller story", e);
  }
  finalise();
  try {
    sellerLateReturns();
  } catch (e) {
    console.error("[CDS seed] late returns", e);
  }
  ctx.rand = Math.random;
  return ctx.s;
}
