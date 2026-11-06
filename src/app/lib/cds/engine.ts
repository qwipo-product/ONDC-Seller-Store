// Cross Dock Store (CDS) — lifecycle engine.
//
// Every state change an order goes through lives here, so the seed
// generator and the UI use exactly the same rules and every screen
// (Orders, Pickups, Inward, Sorting, Dispatch, Payments, Returns,
// Reports) stays in sync.
//
// Functions named lbnp* stand in for updates that arrive from LBNP /
// the Field Agent app in production. The CDS user never plans routes
// or assigns riders; it only requests trips and records what happens
// inside the CDS.

import {
  CANCELLABLE,
  RECEIVED_STATUSES,
  addMinutes,
  canPack,
  goodQty,
  pickupQty,
  localDate,
  orderMoney,
  orderUnits,
  orderValue,
  paymentSettleCheck,
  pickupSettleCheck,
  returnSettleCheck,
  shipmentOrders,
  shipmentUnits,
} from "./calc";
import { RIDERS } from "./master-data";
import type {
  AdjustmentType,
  CdsEvent,
  CdsLocation,
  CdsOrder,
  CdsOrderStatus,
  CdsState,
  CdsTrip,
  Collection,
  Leg,
  ReturnCase,
  ReturnCaseType,
  ReturnStage,
  Shipment,
  TripStop,
} from "./types";

export const ctx: { s: CdsState; now: () => string; rand: () => number } = {
  s: undefined as unknown as CdsState,
  now: () => new Date().toISOString(),
  rand: Math.random,
};

const T = (at?: string) => at ?? ctx.now();

export class CdsActionError extends Error {}

function fail(msg: string): never {
  throw new CdsActionError(msg);
}

export function nextId(prefix: string, start = 10000, pad = 5): string {
  const c = (ctx.s.counters[prefix] ?? start) + 1;
  ctx.s.counters[prefix] = c;
  return `${prefix}-${String(c).padStart(pad, "0")}`;
}

// ---- lookups ----

export const findOrder = (id: string) => ctx.s.orders.find((o) => o.id === id);
export const findTrip = (id?: string) => (id ? ctx.s.trips.find((t) => t.id === id) : undefined);
export const findShipment = (id?: string) => (id ? ctx.s.shipments.find((x) => x.id === id) : undefined);
export const findLocation = (id: string): CdsLocation =>
  ctx.s.locations.find((l) => l.id === id) ?? ctx.s.locations[0];
const sellerName = (id: string) => ctx.s.sellers.find((x) => x.id === id)?.name ?? id;
const retailerName = (id: string) => ctx.s.retailers.find((x) => x.id === id)?.name ?? id;

export function operatorName(cdsId: string): string {
  return `${findLocation(cdsId).manager} (CDS)`;
}

function log(o: CdsOrder, e: Omit<CdsEvent, "at">, at?: string) {
  o.history.push({ ...e, at: T(at) });
}

function setStatus(
  o: CdsOrder,
  status: CdsOrderStatus,
  title: string,
  leg: Leg,
  by: string,
  at?: string,
  note?: string,
) {
  o.status = status;
  o.history.push({ at: T(at), title, leg, by, status, note });
}

const pick = <X,>(arr: X[]): X => arr[Math.floor(ctx.rand() * arr.length)];

// ---- shipments (retailer consolidation) ----

export function attachToShipment(o: CdsOrder): Shipment {
  let sh = ctx.s.shipments.find(
    (x) =>
      x.cdsId === o.cdsId &&
      x.retailerId === o.retailerId &&
      x.waveDate === o.waveDate &&
      x.status === "Open",
  );
  if (!sh) {
    sh = {
      id: nextId("SHP", 40000),
      cdsId: o.cdsId,
      retailerId: o.retailerId,
      waveDate: o.waveDate,
      orderIds: [],
      status: "Open",
      attempts: [],
    };
    ctx.s.shipments.push(sh);
  }
  sh.orderIds.push(o.id);
  o.shipmentId = sh.id;
  return sh;
}

function cratesInUse(cdsId: string): Set<string> {
  const used = new Set<string>();
  for (const sh of ctx.s.shipments) {
    if (sh.cdsId === cdsId && sh.crate && (sh.status === "Open" || sh.status === "Packed")) {
      used.add(sh.crate);
    }
  }
  return used;
}

export function freeCrate(cdsId: string): string {
  const used = cratesInUse(cdsId);
  const total = findLocation(cdsId).crates;
  for (let i = 0; i < total; i++) {
    const label = `${String.fromCharCode(65 + Math.floor(i / 10))}-${String((i % 10) + 1).padStart(2, "0")}`;
    if (!used.has(label)) return label;
  }
  return `X-${used.size + 1}`;
}

export function assignCrate(shipmentId: string, crate?: string) {
  const sh = findShipment(shipmentId) ?? fail("Shipment not found");
  sh.crate = crate ?? freeCrate(sh.cdsId);
}

// ---- first mile: seller → CDS ----

export function requestPickupTrip(
  orderIds: string[],
  opts: { slot?: string; note?: string; at?: string } = {},
): string {
  const at = T(opts.at);
  const orders = orderIds
    .map(findOrder)
    .filter((o): o is CdsOrder => !!o && o.status === "Confirmed");
  if (!orders.length) fail("Select at least one confirmed order");
  const cdsId = orders[0].cdsId;
  const id = nextId("LBNP-PK", 24000);
  const bySeller = new Map<string, CdsOrder[]>();
  for (const o of orders) {
    if (o.cdsId !== cdsId) continue;
    bySeller.set(o.sellerId, [...(bySeller.get(o.sellerId) ?? []), o]);
  }
  const stops: TripStop[] = [...bySeller.entries()].map(([sellerId, os], i) => ({
    id: `${id}-S${i + 1}`,
    seq: i + 1,
    type: "Pickup",
    sellerId,
    orderIds: os.map((o) => o.id),
    expectedUnits: os.reduce((s, o) => s + orderUnits(o), 0),
    status: "Pending",
    eta: addMinutes(at, 70 + i * 35),
  }));
  const trip: CdsTrip = {
    id,
    kind: "Pickup",
    cdsId,
    status: "Requested",
    requestedAt: at,
    stops,
    distanceKm: Math.round(6 + stops.length * 4.5 + ctx.rand() * 5),
    slot: opts.slot ?? "Morning · 08:00 – 11:00",
    note: opts.note,
  };
  ctx.s.trips.push(trip);
  const by = operatorName(cdsId);
  for (const os of bySeller.values()) {
    for (const o of os) {
      o.pickupTripId = id;
      setStatus(o, "Pickup Requested", "Pickup requested on LBNP", "first-mile", by, at, `Trip ${id} · ${stops.length} seller stop(s)`);
    }
  }
  return id;
}

function tripOrders(t: CdsTrip): CdsOrder[] {
  return t.stops
    .flatMap((st) => st.orderIds)
    .map(findOrder)
    .filter((o): o is CdsOrder => !!o && o.status !== "Cancelled");
}

export function lbnpAssignRider(tripId: string, at?: string) {
  const t = findTrip(tripId) ?? fail("Trip not found");
  if (t.status !== "Requested") fail("Rider already assigned");
  const busy = new Set(
    ctx.s.trips
      .filter((x) => x.rider && (x.status === "Rider Assigned" || x.status === "In Progress"))
      .map((x) => x.rider!.name),
  );
  const free = RIDERS.filter((r) => !busy.has(r.name));
  t.rider = pick(free.length ? free : RIDERS);
  t.status = "Rider Assigned";
  t.assignedAt = T(at);
  for (const o of tripOrders(t)) {
    log(o, { title: `LBNP assigned rider ${t.rider.name}`, note: t.rider.vehicle, leg: t.kind === "Pickup" ? "first-mile" : "last-mile", by: "LBNP" }, at);
  }
}

export function lbnpCompletePickupStop(
  tripId: string,
  stopId: string,
  opts: { at?: string; collectedUnits?: number; exception?: string; shortLines?: { orderId: string; sku: string; qty: number }[] } = {},
) {
  const t = findTrip(tripId) ?? fail("Trip not found");
  const st = t.stops.find((x) => x.id === stopId) ?? fail("Stop not found");
  if (t.status !== "Rider Assigned" && t.status !== "In Progress") fail("Trip is not active");
  const at = T(opts.at);
  let shortTotal = 0;
  for (const sl of opts.shortLines ?? []) {
    const o = findOrder(sl.orderId);
    const l = o?.lines.find((x) => x.sku === sl.sku);
    if (!o || !l || sl.qty <= 0) continue;
    const qty = Math.min(sl.qty, l.confirmedQty);
    l.pickedQty = l.confirmedQty - qty;
    shortTotal += qty;
    addAdjustment(o, "Short at Pickup", qty * l.price, "Retailer bill", `${qty} × ${l.name} not available at seller during pickup`, at);
  }
  st.status = "Done";
  st.doneAt = at;
  st.collectedUnits = opts.collectedUnits ?? st.expectedUnits - shortTotal;
  st.exception = opts.exception ?? (shortTotal ? `Partial pickup — ${shortTotal} unit(s) not available at seller` : undefined);
  st.otpVerified = true;
  t.status = "In Progress";
  t.startedAt ??= at;
  const by = t.rider ? `${t.rider.name} (LBNP rider)` : "LBNP";
  for (const id of st.orderIds) {
    const o = findOrder(id);
    if (!o || o.status === "Cancelled") continue;
    const partial = o.lines.filter((l) => l.pickedQty !== undefined && l.pickedQty < l.confirmedQty);
    setStatus(
      o,
      "Picked Up",
      partial.length ? `Partially picked up from ${sellerName(o.sellerId)}` : `Picked up from ${sellerName(o.sellerId)}`,
      "first-mile",
      by,
      at,
      partial.length
        ? `${partial.map((l) => `${l.name}: ${l.pickedQty}/${l.confirmedQty}`).join(", ")} · seller OTP confirmed`
        : opts.exception ?? "Seller OTP confirmed in FA App",
    );
    o.settlementLock = { at, value: orderValue(o) };
    log(o, { title: "Settlement planning locked at pickup", note: `₹${Math.round(orderValue(o)).toLocaleString("en-IN")} planned for ${sellerName(o.sellerId)}`, leg: "payment", by: "LBNP" }, at);
  }
  if (t.stops.every((x) => x.status !== "Pending")) {
    for (const o of tripOrders(t)) {
      if (o.status === "Picked Up") {
        setStatus(o, "In Transit to CDS", `In transit to ${findLocation(t.cdsId).name}`, "first-mile", by, addMinutes(at, 5));
      }
    }
  }
}

export function lbnpArriveAtCds(tripId: string, at?: string) {
  const t = findTrip(tripId) ?? fail("Trip not found");
  if (t.stops.some((x) => x.status === "Pending")) fail("Pickup stops are still pending");
  t.status = "Arrived at CDS";
  t.arrivedAt = T(at);
  for (const o of tripOrders(t)) {
    log(o, { title: `Vehicle arrived at ${findLocation(t.cdsId).name}`, note: "Awaiting inward check", leg: "first-mile", by: "LBNP" }, at);
  }
}

// ---- CDS inward ----

export interface InwardEntry {
  orderId: string;
  sku: string;
  receivedQty: number;
  damagedQty: number;
}

export function receiveTrip(tripId: string, entries: InwardEntry[], opts: { at?: string; by?: string } = {}): string {
  const t = findTrip(tripId) ?? fail("Trip not found");
  if (t.status !== "Arrived at CDS") fail("Trip has not arrived at the CDS yet");
  const at = T(opts.at);
  const by = opts.by ?? operatorName(t.cdsId);
  const inwardId = nextId("INW", 8000);
  let expected = 0, received = 0, damaged = 0, short = 0, excess = 0;
  const discIds: string[] = [];
  const orderIds: string[] = [];
  for (const o of tripOrders(t)) {
    if (o.status !== "In Transit to CDS") continue;
    orderIds.push(o.id);
    let oShort = 0, oDamaged = 0, oExcess = 0;
    for (const l of o.lines) {
      const e = entries.find((x) => x.orderId === o.id && x.sku === l.sku);
      const pickBase = pickupQty(l);
      const rq = Math.max(0, e ? e.receivedQty : pickBase);
      const dq = Math.min(rq, Math.max(0, e ? e.damagedQty : 0));
      l.receivedQty = rq;
      l.damagedQty = dq;
      expected += pickBase;
      received += rq;
      damaged += dq;
      const sQty = Math.max(0, pickBase - rq);
      const xQty = Math.max(0, rq - pickBase);
      short += sQty;
      excess += xQty;
      oShort += sQty;
      oDamaged += dq;
      oExcess += xQty;
      const base = { orderId: o.id, sellerId: o.sellerId, retailerId: o.retailerId, cdsId: o.cdsId, tripId, sku: l.sku, name: l.name, status: "Open" as const, raisedAt: at };
      if (sQty > 0) {
        const id = nextId("DSC", 3000);
        ctx.s.discrepancies.push({ ...base, id, type: "Short", qty: sQty, value: sQty * l.price });
        discIds.push(id);
        addAdjustment(o, "Short Receipt", sQty * l.price, "Retailer bill", `${sQty} × ${l.name} not received from seller`, at);
      }
      if (dq > 0) {
        const id = nextId("DSC", 3000);
        ctx.s.discrepancies.push({ ...base, id, type: "Damaged", qty: dq, value: dq * l.price });
        discIds.push(id);
        addAdjustment(o, "Damaged at Receiving", dq * l.price, "Retailer bill", `${dq} × ${l.name} damaged at inward`, at);
        createReturn(o, {
          type: "Receiving Discrepancy",
          stage: "At CDS",
          reason: "Damaged on arrival at CDS",
          items: [{ sku: l.sku, name: l.name, qty: dq, value: dq * l.price }],
          impact: "Not billed to retailer · seller not paid for damaged units",
          needsReturnToSeller: true,
          discrepancyId: id,
          at,
        });
      }
      if (xQty > 0) {
        const id = nextId("DSC", 3000);
        ctx.s.discrepancies.push({ ...base, id, type: "Excess", qty: xQty, value: xQty * l.price });
        discIds.push(id);
        createReturn(o, {
          type: "Receiving Discrepancy",
          stage: "At CDS",
          reason: "Excess units received — held at CDS",
          items: [{ sku: l.sku, name: l.name, qty: xQty, value: xQty * l.price }],
          impact: "No billing impact · goes back on next pickup",
          needsReturnToSeller: true,
          discrepancyId: id,
          at,
        });
      }
    }
    const issues = oShort + oDamaged > 0;
    const parts = [
      `${o.lines.reduce((s, l) => s + (l.receivedQty ?? 0), 0)}/${o.lines.reduce((s, l) => s + pickupQty(l), 0)} units`,
      oShort ? `${oShort} short` : "",
      oDamaged ? `${oDamaged} damaged` : "",
      oExcess ? `${oExcess} excess` : "",
    ].filter(Boolean);
    setStatus(o, issues ? "Received Short" : "Received", issues ? "Received with discrepancy" : "Received in full", "cds", by, at, `${inwardId} · ${parts.join(" · ")}`);
    if (issues) {
      log(o, { title: "Order quantity adjusted to received stock", note: "Retailer is billed only for good units received", leg: "cds", by: "System" }, at);
    }
  }
  t.status = "Completed";
  t.completedAt = at;
  ctx.s.inward.push({
    id: inwardId,
    tripId,
    cdsId: t.cdsId,
    completedAt: at,
    receivedBy: by,
    expectedUnits: expected,
    receivedUnits: received,
    damagedUnits: damaged,
    shortUnits: short,
    excessUnits: excess,
    orderIds,
    discrepancyIds: discIds,
    status: discIds.length ? "Completed with discrepancies" : "Completed",
  });
  return inwardId;
}

// ---- sorting & packing ----

export function sortLine(orderId: string, sku: string, qty: number, at?: string) {
  const o = findOrder(orderId) ?? fail("Order not found");
  if (!RECEIVED_STATUSES.includes(o.status)) fail("Order is not at the CDS");
  const l = o.lines.find((x) => x.sku === sku) ?? fail("Line not found");
  l.sortedQty = Math.max(0, Math.min(qty, goodQty(l)));
  const sh = findShipment(o.shipmentId);
  if (sh) {
    sh.sortStartedAt ??= T(at);
    if (!sh.crate) assignCrate(sh.id);
  }
  if (o.status !== "Sorting") {
    setStatus(o, "Sorting", `Sorting into crate ${sh?.crate ?? ""}`.trim(), "cds", operatorName(o.cdsId), at);
  }
}

export function sortOrderAll(orderId: string, at?: string) {
  const o = findOrder(orderId) ?? fail("Order not found");
  for (const l of o.lines) sortLine(orderId, l.sku, goodQty(l), at);
}

export function sortShipmentAll(shipmentId: string, at?: string) {
  const sh = findShipment(shipmentId) ?? fail("Shipment not found");
  for (const o of shipmentOrders(ctx.s, sh)) {
    if (RECEIVED_STATUSES.includes(o.status)) sortOrderAll(o.id, at);
  }
}

export function packShipment(shipmentId: string, at?: string) {
  const sh = findShipment(shipmentId) ?? fail("Shipment not found");
  if (!canPack(ctx.s, sh)) fail("All orders must be received and fully sorted before packing");
  if (!sh.crate) assignCrate(sh.id);
  const orders = shipmentOrders(ctx.s, sh);
  sh.status = "Packed";
  sh.packedAt = T(at);
  sh.packages = Math.max(1, Math.round(shipmentUnits(ctx.s, sh) / 6));
  const svc = serviceableCds(sh);
  for (const o of orders) {
    log(o, {
      title: "Serviceability check",
      note: svc === sh.cdsId ? `Serviceable from ${findLocation(svc).name}` : `Not serviceable here — route via ${findLocation(svc).name} (transfer)`,
      leg: "cds",
      by: "System",
    }, at);
    setStatus(
      o,
      "Ready for Dispatch",
      `Packed in crate ${sh.crate}`,
      "cds",
      operatorName(o.cdsId),
      at,
      orders.length > 1 ? `Consolidated with ${orders.length - 1} other seller order(s) for ${retailerName(o.retailerId)}` : undefined,
    );
  }
}

// ---- last mile: CDS → retailer / CDS → CDS ----

export function serviceableCds(sh: Shipment): string {
  return ctx.s.retailers.find((x) => x.id === sh.retailerId)?.serviceableCdsId ?? sh.cdsId;
}

function packedShipments(ids: string[]): Shipment[] {
  const list = ids.map(findShipment).filter((x): x is Shipment => !!x && x.status === "Packed" && !activeTrip(x));
  if (!list.length) fail("Select packed shipments that are not already on a trip");
  return list;
}

function activeTrip(sh: Shipment): CdsTrip | undefined {
  const t = findTrip(sh.deliveryTripId);
  return t && t.status !== "Cancelled" && t.status !== "Completed" ? t : undefined;
}

export function requestDeliveryTrip(
  cdsId: string,
  shipmentIds: string[],
  opts: { slot?: string; note?: string; at?: string } = {},
): string {
  const at = T(opts.at);
  const list = packedShipments(shipmentIds).filter((x) => x.cdsId === cdsId);
  const routed = list.find((x) => serviceableCds(x) !== cdsId);
  if (routed) fail(`${retailerName(routed.retailerId)} is serviceable from ${findLocation(serviceableCds(routed)).name} — use Transfer to CDS`);
  const id = nextId("LBNP-DL", 52000);
  const stops: TripStop[] = list.map((sh, i) => ({
    id: `${id}-D${i + 1}`,
    seq: i + 1,
    type: "Drop",
    retailerId: sh.retailerId,
    shipmentId: sh.id,
    orderIds: shipmentOrders(ctx.s, sh).map((o) => o.id),
    expectedUnits: shipmentUnits(ctx.s, sh),
    status: "Pending",
    eta: addMinutes(at, 75 + i * 28),
  }));
  ctx.s.trips.push({
    id,
    kind: "Delivery",
    cdsId,
    status: "Requested",
    requestedAt: at,
    stops,
    distanceKm: Math.round(5 + stops.length * 3.2 + ctx.rand() * 4),
    slot: opts.slot ?? "Afternoon · 14:00 – 19:00",
    note: opts.note,
  });
  for (const sh of list) {
    sh.deliveryTripId = id;
    for (const o of shipmentOrders(ctx.s, sh)) {
      log(o, { title: "Delivery trip requested on LBNP", note: `Trip ${id} · ${stops.length} drop(s)`, leg: "last-mile", by: operatorName(cdsId) }, at);
    }
  }
  return id;
}

export function requestTransferTrip(cdsId: string, shipmentIds: string[], targetCdsId: string, opts: { at?: string; note?: string } = {}): string {
  if (cdsId === targetCdsId) fail("Choose a different CDS");
  const at = T(opts.at);
  const list = packedShipments(shipmentIds).filter((x) => x.cdsId === cdsId);
  const id = nextId("LBNP-TR", 7000);
  ctx.s.trips.push({
    id,
    kind: "Transfer",
    cdsId,
    targetCdsId,
    status: "Requested",
    requestedAt: at,
    stops: list.map((sh, i) => ({
      id: `${id}-T${i + 1}`,
      seq: i + 1,
      type: "Transfer Drop",
      targetCdsId,
      retailerId: sh.retailerId,
      shipmentId: sh.id,
      orderIds: shipmentOrders(ctx.s, sh).map((o) => o.id),
      expectedUnits: shipmentUnits(ctx.s, sh),
      status: "Pending",
      eta: addMinutes(at, 80),
    })),
    distanceKm: Math.round(8 + ctx.rand() * 9),
    slot: "Next available",
    note: opts.note,
  });
  for (const sh of list) {
    sh.deliveryTripId = id;
    for (const o of shipmentOrders(ctx.s, sh)) {
      log(o, { title: `Transfer to ${findLocation(targetCdsId).name} requested`, note: `Trip ${id}`, leg: "last-mile", by: operatorName(cdsId) }, at);
    }
  }
  return id;
}

export function newHandoverOtp(): string {
  return String(1000 + Math.floor(ctx.rand() * 9000));
}

export function confirmHandover(tripId: string, units?: number, at?: string, otp?: string) {
  const t = findTrip(tripId) ?? fail("Trip not found");
  if (t.kind === "Pickup") fail("Handover applies to delivery and transfer trips");
  if (t.status !== "Rider Assigned") fail("Wait for LBNP to assign a rider");
  const when = T(at);
  const expected = t.stops.reduce((s, x) => s + x.expectedUnits, 0);
  t.handoverAt = when;
  t.handoverUnits = units ?? expected;
  t.handoverOtp = otp ?? newHandoverOtp();
  t.status = "In Progress";
  t.startedAt = when;
  const by = operatorName(t.cdsId);
  for (const st of t.stops) {
    const sh = findShipment(st.shipmentId);
    if (!sh) continue;
    sh.status = t.kind === "Transfer" ? "In Transfer" : "Out for Delivery";
    for (const o of shipmentOrders(ctx.s, sh)) {
      if (t.kind === "Transfer") {
        setStatus(o, "Transferred to CDS", `In transfer to ${findLocation(t.targetCdsId!).name}`, "last-mile", by, when, `Handed to ${t.rider?.name} · ${t.handoverUnits}/${expected} units verified`);
      } else {
        setStatus(o, "Out for Delivery", `Handed over to rider ${t.rider?.name}`, "last-mile", by, when, `${t.handoverUnits}/${expected} units verified · DP confirmed OTP ${t.handoverOtp} at CDS pickup`);
      }
    }
  }
}

export type DropOutcome =
  | { delivered: true; qrFailed?: boolean }
  | { delivered: false; reason: string };

export function lbnpCompleteDropStop(tripId: string, stopId: string, outcome: DropOutcome, at?: string) {
  const t = findTrip(tripId) ?? fail("Trip not found");
  if (t.status !== "In Progress") fail("Trip has not started");
  const st = t.stops.find((x) => x.id === stopId) ?? fail("Stop not found");
  if (st.status !== "Pending") fail("Stop already completed");
  const when = T(at);
  const sh = findShipment(st.shipmentId) ?? fail("Shipment not found");
  const rider = t.rider?.name ?? "LBNP rider";
  const orders = shipmentOrders(ctx.s, sh);

  if (t.kind === "Transfer") {
    st.status = "Done";
    st.doneAt = when;
    const from = sh.cdsId;
    sh.cdsId = t.targetCdsId!;
    sh.status = "Packed";
    sh.deliveryTripId = undefined;
    sh.crate = freeCrate(sh.cdsId);
    for (const o of orders) {
      o.originCdsId = from;
      o.cdsId = t.targetCdsId!;
      setStatus(o, "Ready for Dispatch", `Received at ${findLocation(t.targetCdsId!).name} via transfer`, "cds", operatorName(t.targetCdsId!), when, `From ${findLocation(from).name} · crate ${sh.crate}`);
    }
  } else if (outcome.delivered) {
    st.status = "Done";
    st.doneAt = when;
    st.otpVerified = true;
    st.podRef = `POD-${Math.floor(100000 + ctx.rand() * 899999)}`;
    sh.status = "Delivered";
    sh.deliveredAt = when;
    sh.attempts.push({ at: when, tripId, outcome: "Delivered", otpVerified: true, podRef: st.podRef, agent: rider });
    for (const o of orders) {
      o.deliveredAt = when;
      for (const l of o.lines) l.deliveredQty = goodQty(l);
      setStatus(o, "Delivered", `Delivered to ${retailerName(o.retailerId)}`, "last-mile", `${rider} (LBNP rider)`, when, `OTP verified · ${st.podRef}`);
    }
    recordPayments(sh, t, orders, outcome.qrFailed ?? false, when);
  } else {
    st.status = "Failed";
    st.doneAt = when;
    st.failReason = outcome.reason;
    sh.status = "Delivery Failed";
    sh.attempts.push({ at: when, tripId, outcome: "Failed", reason: outcome.reason, agent: rider });
    for (const o of orders) {
      setStatus(o, "Delivery Failed", "Delivery attempt failed", "last-mile", `${rider} (LBNP rider)`, when, outcome.reason);
    }
  }
  if (t.stops.every((x) => x.status !== "Pending")) {
    t.status = "Completed";
    t.completedAt = when;
  }
}

function recordPayments(sh: Shipment, t: CdsTrip, orders: CdsOrder[], qrFailed: boolean, at: string) {
  const payable = orders.filter((o) => o.paymentType !== "Credit");
  const credit = orders.filter((o) => o.paymentType === "Credit");
  const agent = t.rider?.name ?? "LBNP rider";
  if (payable.length) {
    const mode = payable.some((o) => o.paymentType === "QR") ? "QR" : "Cash";
    const due = payable.reduce((s, o) => s + orderValue(o), 0);
    const failed = mode === "QR" && qrFailed;
    const col: Collection = {
      id: nextId("COL", 60000),
      shipmentId: sh.id,
      retailerId: sh.retailerId,
      cdsId: sh.cdsId,
      tripId: t.id,
      mode,
      amountDue: due,
      amountCollected: failed ? 0 : due,
      status: failed ? "Failed" : "Collected",
      at,
      agent,
      qrRef: mode === "QR" ? `UPI${Math.floor(1e11 + ctx.rand() * 8.9e11)}` : undefined,
      failReason: failed ? pick(["UPI timeout — bank did not confirm", "Payment declined by retailer's bank", "Retailer UPI app crashed mid-payment"]) : undefined,
      splits: payable.map((o) => ({ orderId: o.id, sellerId: o.sellerId, amount: orderValue(o) })),
    };
    ctx.s.collections.push(col);
    for (const o of payable) {
      log(o, {
        title: failed ? "QR payment failed" : `${mode} payment collected`,
        note: failed ? col.failReason : `${col.id} · one payment for ${payable.length} seller order(s)`,
        leg: "payment",
        by: agent,
      }, at);
      upsertSettlement(o, at, mode === "Cash" ? "cash" : "qr", failed ? 0 : orderValue(o));
    }
  }
  for (const o of credit) {
    const acct = ensureCreditAccount(o.sellerId, o.retailerId);
    const due = new Date(at);
    due.setDate(due.getDate() + acct.termsDays);
    ctx.s.credit.push({
      id: nextId("CRD", 20000),
      orderId: o.id,
      sellerId: o.sellerId,
      retailerId: o.retailerId,
      cdsId: o.cdsId,
      amount: orderValue(o),
      paid: 0,
      deliveredAt: at,
      dueDate: localDate(due),
      payments: [],
    });
    log(o, { title: "Billed on seller credit", note: `${acct.termsDays}-day terms from ${sellerName(o.sellerId)}`, leg: "payment", by: "System" }, at);
    upsertSettlement(o, at, "credit", orderValue(o));
  }
}

export function ensureCreditAccount(sellerId: string, retailerId: string) {
  let a = ctx.s.creditAccounts.find((x) => x.sellerId === sellerId && x.retailerId === retailerId);
  if (!a) {
    a = { sellerId, retailerId, limit: pick([25000, 40000, 50000, 75000]), termsDays: pick([7, 7, 14, 3]) };
    ctx.s.creditAccounts.push(a);
  }
  return a;
}

function upsertSettlement(o: CdsOrder, at: string, kind: "cash" | "qr" | "credit", amount: number) {
  const date = localDate(at);
  let st = ctx.s.settlements.find((x) => x.sellerId === o.sellerId && x.cdsId === o.cdsId && x.date === date);
  if (!st) {
    st = {
      id: nextId("STL", 9000),
      sellerId: o.sellerId,
      cdsId: o.cdsId,
      date,
      orderIds: [],
      cashAmount: 0,
      qrAmount: 0,
      creditAmount: 0,
      deductions: 0,
      net: 0,
      status: "Pending",
      lockedValue: 0,
    };
    ctx.s.settlements.push(st);
  }
  if (!st.orderIds.includes(o.id)) {
    st.orderIds.push(o.id);
    st.lockedValue += o.settlementLock?.value ?? 0;
  }
  if (kind === "cash") st.cashAmount += amount;
  if (kind === "qr") st.qrAmount += amount;
  if (kind === "credit") st.creditAmount += amount;
  st.net = st.cashAmount + st.qrAmount - st.deductions;
  refreshSettlementHold(st.id);
}

export function refreshSettlementHold(settlementId: string) {
  const st = ctx.s.settlements.find((x) => x.id === settlementId);
  if (!st || st.status === "Settled" || st.status === "Processing") return;
  const openDisc = ctx.s.discrepancies.some((d) => st.orderIds.includes(d.orderId) && d.status === "Open");
  const failedQr = ctx.s.collections.some((c) => c.status === "Failed" && c.splits.some((sp) => st.orderIds.includes(sp.orderId)));
  if (openDisc || failedQr) {
    st.status = "On Hold";
    st.holdReason = openDisc ? "Open receiving discrepancy" : "QR payment failed — pending collection";
  } else if (st.status === "On Hold") {
    st.status = "Pending";
    st.holdReason = undefined;
  }
}

function refreshHoldsForOrder(orderId: string) {
  for (const st of ctx.s.settlements) if (st.orderIds.includes(orderId)) refreshSettlementHold(st.id);
}

export function reattemptShipment(shipmentId: string, at?: string) {
  const sh = findShipment(shipmentId) ?? fail("Shipment not found");
  if (sh.status !== "Delivery Failed") fail("Only failed deliveries can be re-attempted");
  sh.status = "Packed";
  sh.deliveryTripId = undefined;
  for (const o of shipmentOrders(ctx.s, sh)) {
    setStatus(o, "Ready for Dispatch", "Re-attempt scheduled", "last-mile", operatorName(sh.cdsId), at, `Attempt ${sh.attempts.length + 1} — back in crate ${sh.crate ?? ""}`);
  }
}

export function returnShipmentToSellers(shipmentId: string, at?: string) {
  const sh = findShipment(shipmentId) ?? fail("Shipment not found");
  if (sh.status !== "Delivery Failed") fail("Only failed deliveries can be returned");
  const when = T(at);
  sh.status = "Returned";
  sh.crate = undefined;
  const reason = sh.attempts[sh.attempts.length - 1]?.reason ?? "Delivery failed";
  for (const o of shipmentOrders(ctx.s, sh)) {
    const value = orderValue(o);
    createReturn(o, {
      type: "Delivery Failure (RTO)",
      stage: "Last mile",
      reason,
      items: o.lines.filter((l) => goodQty(l) > 0).map((l) => ({ sku: l.sku, name: l.name, qty: goodQty(l), value: goodQty(l) * l.price })),
      impact: "Not billed to retailer · goods go back to seller",
      needsReturnToSeller: true,
      at: when,
    });
    addAdjustment(o, "Delivery Failure", value, "Retailer bill", "Order not delivered — RTO to seller", when);
    log(o, { title: "Marked for return to seller (RTO)", note: reason, leg: "exception", by: operatorName(sh.cdsId) }, when);
  }
}

// ---- cancellations & returns ----

function stageFor(status: CdsOrderStatus): ReturnStage {
  if (status === "Confirmed" || status === "Pickup Requested") return "Before pickup";
  if (status === "Picked Up" || status === "In Transit to CDS") return "First mile";
  if (status === "Delivered") return "After delivery";
  if (status === "Out for Delivery" || status === "Delivery Failed") return "Last mile";
  return "At CDS";
}

function addAdjustment(o: CdsOrder, type: AdjustmentType, amount: number, appliedTo: "Retailer bill" | "Seller settlement" | "QR refund" | "Credit note", note: string, at?: string) {
  ctx.s.adjustments.push({
    id: nextId("ADJ", 5000),
    orderId: o.id,
    sellerId: o.sellerId,
    retailerId: o.retailerId,
    cdsId: o.cdsId,
    type,
    amount,
    at: T(at),
    appliedTo,
    note,
  });
}

function createReturn(
  o: CdsOrder,
  r: {
    type: ReturnCaseType;
    stage: ReturnStage;
    reason: string;
    items: ReturnCase["items"];
    impact: string;
    needsReturnToSeller: boolean;
    discrepancyId?: string;
    at?: string;
  },
): ReturnCase {
  const at = T(r.at);
  const rc: ReturnCase = {
    id: nextId("RET", 1500),
    orderId: o.id,
    sellerId: o.sellerId,
    retailerId: o.retailerId,
    cdsId: o.cdsId,
    type: r.type,
    stage: r.stage,
    reason: r.reason,
    items: r.items,
    value: r.items.reduce((s, i) => s + i.value, 0),
    impact: r.impact,
    status: r.needsReturnToSeller ? "Open" : "Closed",
    createdAt: at,
    updatedAt: at,
    needsReturnToSeller: r.needsReturnToSeller,
    discrepancyId: r.discrepancyId,
  };
  ctx.s.returns.push(rc);
  return rc;
}

export function cancelOrder(orderId: string, by: "Retailer" | "Seller" | "CDS", reason: string, at?: string) {
  const o = findOrder(orderId) ?? fail("Order not found");
  if (!CANCELLABLE.includes(o.status)) fail(`Orders that are ${o.status.toLowerCase()} cannot be cancelled here`);
  const when = T(at);
  const stage = stageFor(o.status);
  const value = orderValue(o);
  const goodsMoved = stage !== "Before pickup";
  const type: ReturnCaseType =
    stage === "First mile" ? "Pickup-stage Cancellation" : by === "Retailer" ? "Retailer Cancellation" : "Seller Cancellation";

  // Remove from a pickup trip that has not reached this seller yet.
  const trip = findTrip(o.pickupTripId);
  if (trip && !goodsMoved) {
    for (const st of trip.stops) {
      if (st.status !== "Pending") continue;
      st.orderIds = st.orderIds.filter((x) => x !== o.id);
      st.expectedUnits = st.orderIds.map(findOrder).reduce((s, x) => s + (x ? orderUnits(x) : 0), 0);
    }
    trip.stops = trip.stops.filter((st) => st.orderIds.length > 0 || st.status !== "Pending");
    if (!trip.stops.length) trip.status = "Cancelled";
  }
  // Pull it out of the retailer shipment.
  const sh = findShipment(o.shipmentId);
  if (sh) {
    sh.orderIds = sh.orderIds.filter((x) => x !== o.id);
    if (sh.status === "Packed") sh.status = "Open";
    if (!sh.orderIds.length) sh.status = "Cancelled";
  }
  o.cancelReason = reason;
  o.cancelledBy = by;
  createReturn(o, {
    type,
    stage,
    reason,
    items: o.lines.map((l) => ({ sku: l.sku, name: l.name, qty: goodQty(l), value: goodQty(l) * l.price })),
    impact: goodsMoved ? "Not billed · goods go back to seller on next pickup" : "No financial impact — goods not picked up",
    needsReturnToSeller: goodsMoved,
    at: when,
  });
  addAdjustment(o, "Cancellation", value, "Retailer bill", `Cancelled by ${by.toLowerCase()} — ${reason}`, when);
  setStatus(o, "Cancelled", `Cancelled by ${by.toLowerCase()}`, "exception", by === "CDS" ? operatorName(o.cdsId) : by, when, reason);
}

export function createRetailerReturn(orderId: string, items: { sku: string; qty: number }[], reason: string, at?: string): string {
  const o = findOrder(orderId) ?? fail("Order not found");
  if (o.status !== "Delivered") fail("Returns can be raised only on delivered orders");
  const when = T(at);
  const lines = items
    .map((i) => {
      const l = o.lines.find((x) => x.sku === i.sku);
      if (!l || i.qty <= 0) return null;
      const qty = Math.min(i.qty, l.deliveredQty ?? goodQty(l));
      return { sku: l.sku, name: l.name, qty, value: qty * l.price };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.qty > 0);
  if (!lines.length) fail("Select at least one item to return");
  const value = lines.reduce((s, l) => s + l.value, 0);
  const refundTo = o.paymentType === "QR" ? "QR refund" : o.paymentType === "Credit" ? "Credit note" : "Retailer bill";
  const rc = createReturn(o, {
    type: "Retailer Return",
    stage: "After delivery",
    reason,
    items: lines,
    impact:
      o.paymentType === "Credit"
        ? "Reduces retailer credit outstanding · deducted from seller"
        : `Refund to retailer (${refundTo}) · deducted from seller settlement`,
    needsReturnToSeller: true,
    at: when,
  });
  addAdjustment(o, "Retailer Return", value, refundTo, `${reason} · ${rc.id}`, when);
  if (o.paymentType === "Credit") {
    const entry = ctx.s.credit.find((c) => c.orderId === o.id);
    if (entry) entry.amount = Math.max(entry.paid, entry.amount - value);
  } else {
    const st = ctx.s.settlements.find((x) => x.orderIds.includes(o.id) && x.sellerId === o.sellerId);
    if (st && st.status !== "Settled") {
      st.deductions += value;
      st.net = st.cashAmount + st.qrAmount - st.deductions;
    } else if (st) {
      // Already paid out — recover from the seller's next payout.
      const next = ctx.s.settlements
        .filter((x) => x.sellerId === o.sellerId && x.status !== "Settled")
        .sort((x, y) => x.date.localeCompare(y.date))[0];
      if (next) {
        next.recoveries = [...(next.recoveries ?? []), { orderId: o.id, returnId: rc.id, amount: value }];
        next.deductions += value;
        next.net = next.cashAmount + next.qrAmount - next.deductions;
      }
    }
  }
  log(o, { title: "Retailer return raised", note: `${rc.id} · ${lines.map((l) => `${l.qty} × ${l.name}`).join(", ")} · ${reason}`, leg: "exception", by: operatorName(o.cdsId) }, when);
  return rc.id;
}

export function acknowledgeDiscrepancy(id: string, at?: string) {
  const d = ctx.s.discrepancies.find((x) => x.id === id) ?? fail("Discrepancy not found");
  if (d.status !== "Open") fail("Already acknowledged");
  d.status = "Seller Acknowledged";
  const o = findOrder(d.orderId);
  if (o) log(o, { title: `Seller acknowledged ${d.type.toLowerCase()} of ${d.qty} × ${d.name}`, leg: "exception", by: sellerName(d.sellerId) }, at);
  refreshHoldsForOrder(d.orderId);
}

export function closeDiscrepancy(id: string, resolution: string, at?: string) {
  const d = ctx.s.discrepancies.find((x) => x.id === id) ?? fail("Discrepancy not found");
  d.status = "Closed";
  d.resolvedAt = T(at);
  d.resolution = resolution;
  const o = findOrder(d.orderId);
  if (o) log(o, { title: `Discrepancy ${d.id} closed`, note: resolution, leg: "exception", by: operatorName(d.cdsId) }, at);
  refreshHoldsForOrder(d.orderId);
}

export function scheduleReturnToSeller(id: string, at?: string) {
  const r = ctx.s.returns.find((x) => x.id === id) ?? fail("Return not found");
  if (r.status !== "Open") fail("Return is not open");
  r.status = "Return to Seller Scheduled";
  r.updatedAt = T(at);
  const o = findOrder(r.orderId);
  if (o) log(o, { title: "Return to seller scheduled", note: `${r.id} · goes back on the next pickup trip from ${sellerName(r.sellerId)}`, leg: "exception", by: operatorName(r.cdsId) }, at);
}

export function markReturnedToSeller(id: string, at?: string) {
  const r = ctx.s.returns.find((x) => x.id === id) ?? fail("Return not found");
  if (r.status !== "Return to Seller Scheduled" && r.status !== "Open") fail("Return already completed");
  r.status = "Returned to Seller";
  r.updatedAt = T(at);
  const o = findOrder(r.orderId);
  if (o) {
    if (r.type === "Delivery Failure (RTO)") {
      setStatus(o, "Returned to Seller", "Returned to seller", "exception", operatorName(r.cdsId), at, r.id);
    } else {
      log(o, { title: "Goods returned to seller", note: `${r.id} · ${r.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}`, leg: "exception", by: operatorName(r.cdsId) }, at);
    }
  }
}

export function processReturnRefund(id: string, at?: string) {
  const r = ctx.s.returns.find((x) => x.id === id) ?? fail("Return not found");
  if (r.type !== "Retailer Return") fail("Refunds apply to retailer returns only");
  r.status = "Refund Processed";
  r.updatedAt = T(at);
  const o = findOrder(r.orderId);
  if (o) log(o, { title: "Refund processed to retailer", note: `${r.id} · ${o.paymentType === "QR" ? "UPI refund" : o.paymentType === "Credit" ? "Credit note" : "Adjusted on next bill"}`, leg: "payment", by: "System" }, at);
}

export function closeReturn(id: string, at?: string) {
  const r = ctx.s.returns.find((x) => x.id === id) ?? fail("Return not found");
  r.status = "Closed";
  r.updatedAt = T(at);
}

/** Prototype stand-in for the payout system: the seller's payout is sent. */
export function payoutSettlement(id: string, at?: string) {
  const st = ctx.s.settlements.find((x) => x.id === id) ?? fail("Payout not found");
  if (st.status === "Settled") fail("Already paid");
  st.status = "Settled";
  st.holdReason = undefined;
  st.settledAt = T(at);
  st.utr = `UTR${Math.floor(1e11 + Math.random() * 8.9e11)}`;
  for (const oid of st.orderIds) {
    const o = findOrder(oid);
    if (o) log(o, { title: "Payout sent to you", note: `${st.id} · ${st.utr}`, leg: "payment", by: "Payout" }, at);
  }
}

/** Seller confirms a return is fully settled on their side. */
export function sellerSettleReturn(id: string, at?: string) {
  const r = ctx.s.returns.find((x) => x.id === id) ?? fail("Return not found");
  const chk = returnSettleCheck(r);
  if (chk.done) fail("Already marked settled");
  if (!chk.ready) fail(chk.reason ?? "Return is not ready to settle");
  r.sellerSettledAt = T(at);
  r.status = "Closed";
  r.updatedAt = r.sellerSettledAt;
  const o = findOrder(r.orderId);
  if (o) log(o, { title: "Return marked settled by you", note: `${r.id} · ${r.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}`, leg: "payment", by: sellerName(r.sellerId) }, at);
}

/** Seller confirms the pickup handover is settled (after the agent's OTP). */
export function sellerSettlePickup(orderId: string, at?: string) {
  const o = findOrder(orderId) ?? fail("Order not found");
  const chk = pickupSettleCheck(o, ctx.s);
  if (chk.done) fail("Already marked settled");
  if (!chk.ready) fail(chk.reason ?? "Pickup is not ready to settle");
  o.pickupSettledAt = T(at);
  o.pickupSettledBy = "seller";
  const units = o.lines.reduce((x, l) => x + pickupQty(l), 0);
  log(o, { title: "Pickup marked settled by you", note: `${units} units handed to the pickup agent (OTP verified)`, leg: "first-mile", by: sellerName(o.sellerId) }, at);
}

/** If the seller missed "Mark settled" on a pickup and the delivery app has
 *  since moved the order to Delivered, Cancelled or Returned, the system
 *  marks the pickup settled. Returns how many were auto-marked. */
export function autoSettlePickups(): number {
  let n = 0;
  for (const o of ctx.s.orders) {
    if (o.pickupSettledAt) continue;
    if (o.status !== "Delivered" && o.status !== "Cancelled" && o.status !== "Returned to Seller") continue;
    const trip = findTrip(o.pickupTripId);
    const stop = trip?.stops.find((st) => st.orderIds.includes(o.id));
    if (!stop || stop.status !== "Done") continue; // never picked up — nothing to settle
    const when = o.history[o.history.length - 1]?.at ?? new Date().toISOString();
    o.pickupSettledAt = when;
    o.pickupSettledBy = "system";
    o.history.push({ at: when, title: "Pickup settled by system", note: `You didn't mark it — auto-settled as the order is ${o.status.toLowerCase()}`, leg: "first-mile", by: "System" });
    n++;
  }
  return n;
}

/** Seller confirms an order's payment is fully settled. */
export function sellerSettlePayment(orderId: string, at?: string) {
  const o = findOrder(orderId) ?? fail("Order not found");
  const chk = paymentSettleCheck(o, ctx.s);
  if (chk.done) fail("Already marked settled");
  if (!chk.ready) fail(chk.reason ?? "Payment is not ready to settle");
  o.sellerSettledAt = T(at);
  log(o, { title: "Payment marked settled by you", note: `₹${Math.round(orderMoney(o, ctx.s).payout).toLocaleString("en-IN")} received`, leg: "payment", by: sellerName(o.sellerId) }, at);
}

/** Seller reduces quantities after moving the order to CDS (before pickup). */
export function partialCancel(orderId: string, items: { sku: string; qty: number }[], reason: string, at?: string) {
  const o = findOrder(orderId) ?? fail("Order not found");
  if (o.status !== "Confirmed" && o.status !== "Pickup Requested") fail("Quantities can be changed only before pickup");
  const when = T(at);
  const changes: string[] = [];
  let value = 0;
  for (const it of items) {
    const l = o.lines.find((x) => x.sku === it.sku);
    if (!l || it.qty <= 0) continue;
    const qty = Math.min(it.qty, l.confirmedQty);
    l.confirmedQty -= qty;
    l.cancelledQty = (l.cancelledQty ?? 0) + qty;
    value += qty * l.price;
    changes.push(`${l.name}: ${l.confirmedQty + qty} → ${l.confirmedQty}`);
  }
  if (!changes.length) fail("Reduce at least one quantity");
  if (o.lines.every((l) => l.confirmedQty === 0)) {
    cancelOrder(orderId, "Seller", reason, when);
    return;
  }
  const trip = findTrip(o.pickupTripId);
  if (trip) {
    for (const st of trip.stops) {
      if (st.orderIds.includes(o.id) && st.status === "Pending") {
        st.expectedUnits = st.orderIds.map(findOrder).reduce((s, x) => s + (x ? orderUnits(x) : 0), 0);
      }
    }
  }
  addAdjustment(o, "Partial Cancellation", value, "Retailer bill", `${changes.join("; ")} — ${reason}`, when);
  log(o, { title: "Partially cancelled by seller", note: `${changes.join("; ")} · ${reason}`, leg: "order", by: sellerName(o.sellerId) }, when);
}

export interface ImportedOrder {
  id: string;
  ondcOrderId: string;
  retailerName: string;
  retailerArea: string;
  retailerPhone: string;
  placedAt: string;
  paymentType: "Cash" | "QR" | "Credit";
  lines: { sku: string; name: string; price: number; orderedQty: number; confirmedQty: number }[];
}

/** A connector seller confirms an order — it joins the CDS flow automatically. */
export function moveOrderToCds(sellerId: string, cdsId: string, input: ImportedOrder, at?: string): CdsOrder {
  if (findOrder(input.id)) fail(`${input.id} is already with the CDS`);
  const when = T(at);
  let r = ctx.s.retailers.find((x) => x.name === input.retailerName && x.cdsId === cdsId);
  if (!r) {
    r = { id: `r-x${ctx.s.retailers.length + 1}`, name: input.retailerName, owner: "—", phone: input.retailerPhone, area: input.retailerArea, cdsId, serviceableCdsId: cdsId, type: "Kirana" };
    ctx.s.retailers.push(r);
  }
  const o: CdsOrder = {
    id: input.id,
    ondcOrderId: input.ondcOrderId,
    sellerId,
    retailerId: r.id,
    cdsId,
    placedAt: input.placedAt,
    confirmedAt: when,
    waveDate: localDate(when),
    lines: input.lines.map((l) => ({ ...l, brand: "", uom: "Unit" })),
    paymentType: input.paymentType,
    status: "Confirmed",
    history: [{ at: input.placedAt, title: "Order placed on Buyer App", leg: "order", by: input.retailerName }],
  };
  const mods = o.lines.filter((l) => l.confirmedQty !== l.orderedQty);
  if (mods.length) {
    log(o, { title: "Order modified at confirmation", note: mods.map((l) => `${l.name}: ${l.orderedQty} → ${l.confirmedQty}`).join("; "), leg: "order", by: sellerName(sellerId) }, when);
  }
  setStatus(o, "Confirmed", `Added to CDS · ${findLocation(cdsId).name}`, "order", sellerName(sellerId), when, "Ready to request logistics");
  ctx.s.orders.push(o);
  attachToShipment(o);
  return o;
}

// ---- cash, QR, credit ----

export function recordHandover(cdsId: string, agent: string, collectionIds: string[], received: number, at?: string): string {
  const cols = collectionIds
    .map((id) => ctx.s.collections.find((c) => c.id === id))
    .filter((c): c is Collection => !!c && c.mode === "Cash" && c.status === "Collected");
  if (!cols.length) fail("No cash collections selected");
  const id = nextId("CHO", 2000);
  const expected = cols.reduce((s, c) => s + c.amountCollected, 0);
  ctx.s.handovers.push({
    id,
    cdsId,
    agent,
    at: T(at),
    expected,
    received,
    status: "Pending Verification",
    collectionIds: cols.map((c) => c.id),
    receivedBy: operatorName(cdsId),
  });
  for (const c of cols) {
    c.status = "Handed Over";
    c.handoverId = id;
  }
  return id;
}

export function verifyHandover(id: string, at?: string) {
  const h = ctx.s.handovers.find((x) => x.id === id) ?? fail("Handover not found");
  if (h.status !== "Pending Verification") fail("Already verified");
  h.status = h.received >= h.expected ? "Matched" : "Short";
  h.verifiedAt = T(at);
  for (const cid of h.collectionIds) {
    const c = ctx.s.collections.find((x) => x.id === cid);
    if (c) c.status = h.status === "Matched" ? "Reconciled" : "Short";
  }
}

export function reconcileQr(ids: string[]) {
  for (const id of ids) {
    const c = ctx.s.collections.find((x) => x.id === id);
    if (c && c.mode === "QR" && c.status === "Collected") c.status = "Reconciled";
  }
}

export function resolveFailedQr(id: string, how: "retry" | "cash", at?: string) {
  const c = ctx.s.collections.find((x) => x.id === id) ?? fail("Collection not found");
  if (c.status !== "Failed") fail("Only failed QR payments can be resolved");
  const when = T(at);
  if (how === "cash") {
    c.mode = "Cash";
    c.qrRef = undefined;
  } else {
    c.qrRef = `UPI${Math.floor(1e11 + ctx.rand() * 8.9e11)}`;
  }
  c.status = "Collected";
  c.amountCollected = c.amountDue;
  c.at = when;
  for (const sp of c.splits) {
    const st = ctx.s.settlements.find((x) => x.orderIds.includes(sp.orderId) && x.sellerId === sp.sellerId);
    if (st) {
      if (how === "cash") st.cashAmount += sp.amount;
      else st.qrAmount += sp.amount;
      st.net = st.cashAmount + st.qrAmount - st.deductions;
      refreshSettlementHold(st.id);
    }
    const o = findOrder(sp.orderId);
    if (o) log(o, { title: how === "cash" ? "Collected in cash after QR failure" : "QR payment retried successfully", note: c.id, leg: "payment", by: c.agent }, when);
  }
}

export function recordCreditPayment(entryId: string, amount: number, ref: string, at?: string) {
  const e = ctx.s.credit.find((x) => x.id === entryId) ?? fail("Credit entry not found");
  const pay = Math.min(amount, e.amount - e.paid);
  if (pay <= 0) fail("Nothing outstanding");
  e.paid += pay;
  e.payments.push({ at: T(at), amount: pay, ref });
  const o = findOrder(e.orderId);
  if (o) log(o, { title: "Credit repayment recorded", note: `₹${pay.toLocaleString("en-IN")} · ${ref}`, leg: "payment", by: sellerName(e.sellerId) }, at);
}

export { orderValue };
