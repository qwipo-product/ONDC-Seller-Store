// Dark Stores — Qwipo-run fulfilment points, each defined by a zone
// (a GeoJSON polygon, usually a radius circle drawn on geojson.io).
//
// The admin Dark Store dashboard measures how today's distributor
// network already covers a zone: which ACTIVE sellers' delivery beats
// reach the zone's ACTIVE customers, and how many companies each of
// those customers can order from. Matching is the same real
// point-in-polygon the Beat Serviceability Report uses
// (matchCustomer), so the two never disagree.
//
// Two coverage views:
// - "zone" — Dark Store Only: active customers inside the zone.
// - "full" — Dark Store + Seller Coverage: the zone plus the whole
//   footprint of every active beat that touches it. Beats straddle the
//   boundary, so this adds the customers those same beats reach
//   OUTSIDE the zone; every count is split inside / outside.

import { useSyncExternalStore } from "react";
import kphbZone from "./kphb-dark-store-zone.json";
import alwalZone from "./alwal-dark-store-zone.json";
import {
  csvEscape,
  getCustomers,
  isActiveCustomer,
  matchCustomer,
  triggerDownload,
  type DbCustomer,
} from "./customer-database";
import {
  getServiceabilityBeats,
  getServiceabilityBeatsVersion,
  haversineKm,
  polygonContainsPoint,
  polygonOuterRings,
  polygonsOverlap,
  sortDeliveryDays,
  type ServiceabilityBeat,
} from "./serviceability-data";
import { DELIVERY_DAY_OPTIONS, type DeliveryDay } from "./customers-data";
import { getSellers, type Seller } from "./mock-store";
import { isEmptyMode } from "./data-mode";

// ---- Store registry ----
//
// The dark stores of the Digidukaan Darkstore Connector (Admin →
// Connectors → Digidukaan Darkstore Connector → Manage). Qwipo's
// last-mile (cross) dark stores collect the orders of the sellers
// connected to them and deliver to the retailer on the seller's behalf.
//
// A store's SERVICE AREA is an uploaded GeoJSON polygon, not a pincode
// list, and the
// polygon is also how sellers connect: every active seller whose
// delivery-beat polygons reach into it is a connected account
// (getConnectedSellerIds) — there is no hand-kept seller list. A
// retailer is routed to the ACTIVE store whose polygon contains their
// lat/long (findStoreForPoint), and orders to its connected sellers go
// through that store. Polygons may overlap — the seed KPHB and Alwal
// circles already do — so a retailer inside two goes to the nearer
// store.
//
// Persisted to localStorage like the rest of the mock store. KPHB and
// Alwal are the seed; in a real install this would live behind an API.

/** The persisted record — the Add / Update Dark Store form. */
export interface DarkStoreConfig {
  /** URL slug — /admin/dark-stores/:id */
  id: string;
  /** Dark Store Name — "Manvik Stores". */
  name: string;
  /** Area Name — "KPHB". Sidebar dashboard + report file names. */
  areaName: string;
  gstNumber: string;
  mobile: string;
  email: string;
  /** The store's own address. */
  address: string;
  /** The store's own address PIN — NOT its service area. */
  pincode: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  /** "std:040" */
  ondcCityCode: string;
  /** Inactive stores keep their setup but receive no orders. */
  isActive: boolean;
  /** Service area — the uploaded GeoJSON polygon. */
  zone: unknown;
  /** Name of the uploaded polygon file. */
  zoneFileName?: string;
  createdAt: string;
  updatedAt: string;
}

/** A store with its polygon measured, for display and analysis. */
export interface DarkStore extends DarkStoreConfig {
  /** The store's lat/long, else the centre of its polygon. */
  centre: { lat: number; lng: number };
  areaKm2: number;
}

/**
 * Centre of a polygon: `@circle.center` ([lng, lat]) when geojson.io
 * drew it as a circle (the seed zones), else the mean of its outer-ring
 * vertices.
 */
function zoneCentre(zone: unknown): { lat: number; lng: number } {
  const props = (zone as { features?: { properties?: Record<string, unknown> }[] })
    ?.features?.[0]?.properties;
  const circle = props?.["@circle"] as { center?: [number, number] } | undefined;
  if (circle?.center) return { lat: circle.center[1], lng: circle.center[0] };
  const pts = polygonOuterRings(zone).flat();
  if (pts.length === 0) return { lat: 0, lng: 0 };
  const sum = pts.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return { lat: sum[1] / pts.length, lng: sum[0] / pts.length };
}

/**
 * Zone area in km² — the outer rings projected onto a local flat plane
 * (accurate to well under 1% at city scale) and summed with the
 * shoelace formula.
 */
export function zoneAreaKm2(zone: unknown): number {
  let total = 0;
  for (const ring of polygonOuterRings(zone)) {
    if (ring.length < 3) continue;
    const lat0 = (ring.reduce((s, [, y]) => s + y, 0) / ring.length) * (Math.PI / 180);
    const kx = 111.32 * Math.cos(lat0);
    const ky = 110.574;
    let twice = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      twice += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky);
    }
    total += Math.abs(twice) / 2;
  }
  return total;
}

function measureStore(config: DarkStoreConfig): DarkStore {
  const located = config.latitude != null && config.longitude != null;
  return {
    ...config,
    centre: located
      ? { lat: config.latitude!, lng: config.longitude! }
      : zoneCentre(config.zone),
    areaKm2: zoneAreaKm2(config.zone),
  };
}

/** "72.1 km²" — the polygon's size, for tables and headers. */
export function storeZoneLabel(store: Pick<DarkStore, "areaKm2">) {
  return `${store.areaKm2.toFixed(1)} km²`;
}

/** Field formats the Add / Update Dark Store form enforces. */
export const STORE_FORMATS = {
  mobile: /^[6-9]\d{9}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  pincode: /^\d{6}$/,
  ondcCityCode: /^std:\d{2,5}$/,
};

/**
 * Logistics account — the store's ONDC logistics roles (LBNP + LSP) can
 * be provisioned once every detail the network needs is on file. Seed
 * stores show "Provisioning incomplete" until they're updated.
 */
export function isLogisticsProvisioned(s: DarkStoreConfig): boolean {
  return (
    STORE_FORMATS.mobile.test(s.mobile) &&
    STORE_FORMATS.email.test(s.email.trim()) &&
    s.address.trim() !== "" &&
    STORE_FORMATS.pincode.test(s.pincode) &&
    s.city.trim() !== "" &&
    s.state.trim() !== "" &&
    s.latitude != null &&
    s.longitude != null &&
    STORE_FORMATS.ondcCityCode.test(s.ondcCityCode)
  );
}

const SEED_TIMESTAMP = "2026-07-24T00:00:00.000Z";

// The seed polygons' centres stand in for the store location; contact
// details are left blank for the admin to fill in.
function seedStore(
  meta: Pick<DarkStoreConfig, "id" | "name" | "areaName" | "city" | "pincode" | "zone" | "zoneFileName">,
): DarkStoreConfig {
  const centre = zoneCentre(meta.zone);
  return {
    ...meta,
    gstNumber: "",
    mobile: "",
    email: "",
    address: "",
    state: "Telangana",
    latitude: Number(centre.lat.toFixed(6)),
    longitude: Number(centre.lng.toFixed(6)),
    ondcCityCode: "std:040",
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

const SEED_STORES: DarkStoreConfig[] = [
  seedStore({
    id: "kphb",
    name: "KPHB Dark Store",
    areaName: "KPHB",
    city: "Hyderabad",
    pincode: "500072",
    zone: kphbZone,
    zoneFileName: "kphb-dark-store-zone.geojson",
  }),
  seedStore({
    id: "alwal",
    name: "Alwal Dark Store",
    areaName: "Alwal",
    city: "Secunderabad",
    pincode: "500010",
    zone: alwalZone,
    zoneFileName: "alwal-dark-store-zone.geojson",
  }),
];

// v2: the connector form's fields (v1 was an earlier internal shape).
const STORES_KEY = "qwipo.mock.dark-stores.v2";

function readConfigs(): DarkStoreConfig[] {
  try {
    const raw = localStorage.getItem(STORES_KEY);
    if (raw === null) return SEED_STORES;
    const parsed = JSON.parse(raw) as (DarkStoreConfig & {
      sellerIds?: unknown;
      zoneSource?: unknown;
    })[];
    if (!Array.isArray(parsed)) return SEED_STORES;
    // Drop fields earlier builds saved: the hand-picked seller list
    // (connected sellers now come from the polygon) and the map-editor
    // mode (polygons are uploaded now).
    return parsed.map(({ sellerIds: _s, zoneSource: _z, ...config }) => config);
  } catch {
    return SEED_STORES;
  }
}

// Measured stores, rebuilt only on write — so getDarkStore() returns the
// same object between writes and pages can key effects on it.
let _stores: DarkStore[] = readConfigs().map(measureStore);
const _storeListeners = new Set<() => void>();

function commit(next: DarkStoreConfig[]) {
  // Strip the measured fields so only the config is persisted.
  const configs = next.map((s) => {
    const { centre: _c, areaKm2: _a, ...config } = s as DarkStore;
    return config as DarkStoreConfig;
  });
  try {
    localStorage.setItem(STORES_KEY, JSON.stringify(configs));
  } catch {
    throw new Error(
      "Couldn't save — the browser's storage is full. Try a simpler polygon file.",
    );
  }
  _stores = configs.map(measureStore);
  for (const cb of _storeListeners) cb();
}

/** Every store, active or not. Empty in the inception-day demo mode. */
export function getDarkStores(): DarkStore[] {
  return isEmptyMode() ? EMPTY_STORES : _stores;
}
const EMPTY_STORES: DarkStore[] = [];

export function getDarkStore(id: string): DarkStore | undefined {
  return getDarkStores().find((s) => s.id === id);
}

export function subscribeToDarkStores(cb: () => void): () => void {
  _storeListeners.add(cb);
  return () => {
    _storeListeners.delete(cb);
  };
}

/** Live store list for components — re-renders on every save. */
export function useDarkStores(): DarkStore[] {
  return useSyncExternalStore(subscribeToDarkStores, getDarkStores);
}

/**
 * The active store that fulfils orders from a retailer at this point —
 * undefined when no zone covers it. Inside overlapping zones the store
 * whose centre is nearest wins.
 */
export function findStoreForPoint(lat: number, lng: number): DarkStore | undefined {
  let best: DarkStore | undefined;
  let bestKm = Infinity;
  for (const s of getDarkStores()) {
    if (!s.isActive || !polygonContainsPoint(s.zone, lat, lng)) continue;
    const km = haversineKm(lat, lng, s.centre.lat, s.centre.lng);
    if (km < bestKm) {
      best = s;
      bestKm = km;
    }
  }
  return best;
}

/** URL-safe id from the area name, unique among existing stores. */
function makeStoreId(areaName: string): string {
  const base =
    areaName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "store";
  const taken = new Set(_stores.map((s) => s.id));
  if (!taken.has(base) && base !== "new") return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export type DarkStoreInput = Omit<DarkStoreConfig, "id" | "createdAt" | "updatedAt">;

/**
 * Create (no id) or update a store. Throws with a user-facing message
 * when the zone is empty or the browser can't store it.
 */
export function saveDarkStore(input: DarkStoreInput, id?: string): DarkStore {
  if (polygonOuterRings(input.zone).length === 0) {
    throw new Error("Set the service area on the map before saving.");
  }
  const now = new Date().toISOString();
  const existing = id ? _stores.find((s) => s.id === id) : undefined;
  const record: DarkStoreConfig = existing
    ? { ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
    : { ...input, id: makeStoreId(input.areaName), createdAt: now, updatedAt: now };
  commit(existing ? _stores.map((s) => (s.id === id ? record : s)) : [..._stores, record]);
  return _stores.find((s) => s.id === record.id)!;
}

/** The form values of a saved store. */
export function toDarkStoreInput(store: DarkStore): DarkStoreInput {
  const { centre: _c, areaKm2: _a, id: _id, createdAt: _cr, updatedAt: _u, ...input } =
    store;
  return input;
}

// Per store, keyed on its zone object and the beat-store version so an
// edited polygon or beat recomputes; the store pages call this on
// every render.
const _connectedCache = new Map<string, { zone: unknown; beatsVersion: number; ids: string[] }>();

/**
 * Connected accounts — the active sellers whose delivery-beat polygons
 * reach into the store's polygon, sorted by business name.
 */
export function getConnectedSellerIds(store: Pick<DarkStore, "id" | "zone">): string[] {
  const beatsVersion = getServiceabilityBeatsVersion();
  const hit = _connectedCache.get(store.id);
  if (hit && hit.zone === store.zone && hit.beatsVersion === beatsVersion) return hit.ids;
  const sellers = getSellers().filter((s) => s.isActive !== false);
  const active = new Set(sellers.map((s) => s.id));
  const found = new Set<string>();
  for (const b of getServiceabilityBeats()) {
    if (
      b.sellerId &&
      active.has(b.sellerId) &&
      !found.has(b.sellerId) &&
      b.polygonData != null &&
      polygonsOverlap(b.polygonData, store.zone)
    ) {
      found.add(b.sellerId);
    }
  }
  const name = new Map(sellers.map((s) => [s.id, s.businessName || s.name]));
  const ids = [...found].sort((a, b) => (name.get(a) ?? "").localeCompare(name.get(b) ?? ""));
  _connectedCache.set(store.id, { zone: store.zone, beatsVersion, ids });
  return ids;
}

/** Stores a seller is connected to through its delivery beats. */
export function getSellerDarkStores(sellerId: string): DarkStore[] {
  return getDarkStores().filter((s) => getConnectedSellerIds(s).includes(sellerId));
}

// ---- Analysis ----

/** "zone" = Dark Store Only; "full" = Dark Store + Seller Coverage. */
export type CoverageScope = "zone" | "full";

export interface ZoneCustomer {
  customer: DbCustomer;
  /** Inside the dark-store zone (always true in the "zone" scope). */
  insideZone: boolean;
  /** Customer ↔ dark-store centre, km (2 dp). */
  distanceKm: number;
  /**
   * Active-seller beats whose polygon contains the customer — outside
   * the zone, only the beats that touch the zone.
   */
  beats: ServiceabilityBeat[];
  sellerIds: string[];
  /** Business names of the sellers above, sorted. */
  sellerNames: string[];
  /** Unique companies the customer can order from, sorted by name. */
  companyNames: string[];
  deliveryDays: DeliveryDay[];
}

export interface SellerCoverage {
  sellerId: string;
  sellerName: string;
  businessName: string;
  /** Seller warehouse ↔ dark-store centre, km. Null without lat/long. */
  warehouseKm: number | null;
  warehouseInZone: boolean;
  /** This seller's beats whose polygon overlaps the zone. */
  beatsInZone: number;
  /** …of which reach past the zone boundary. */
  beatsExtendingOutside: number;
  /** Companies carried on those beats, sorted. */
  companyNames: string[];
  /** Active customers in scope inside at least one of its beats. */
  customersReached: number;
  /** customersReached split by the zone boundary. */
  customersInside: number;
  customersOutside: number;
  /** Share of the scope's active customers reached, 0–100. */
  coveragePct: number;
  /** Customers no OTHER active seller reaches. */
  soleSellerCustomers: number;
  deliveryDays: DeliveryDay[];
}

export interface CompanyCoverage {
  companyId: string;
  companyName: string;
  /** Business names of the active sellers carrying it in the zone. */
  sellerNames: string[];
  customersReached: number;
  customersInside: number;
  customersOutside: number;
  coveragePct: number;
}

export interface ClusterCoverage {
  cluster: string;
  activeCustomers: number;
  inside: number;
  outside: number;
  covered: number;
  coveragePct: number;
  avgCompanies: number;
  avgSellers: number;
}

export interface Bucket {
  label: string;
  count: number;
}

export interface DayReach {
  day: DeliveryDay;
  customers: number;
  pct: number;
}

export interface DarkStoreAnalysis {
  store: DarkStore;
  scope: CoverageScope;
  /** Every roster customer inside the zone, any status. */
  totalInZone: number;
  /** Every roster customer in scope, any status (= totalInZone for "zone"). */
  totalInScope: number;
  /** Active customers in scope — the population analysed. */
  customers: ZoneCustomer[];
  /** customers split by the zone boundary. */
  insideCount: number;
  outsideCount: number;
  covered: number;
  notCovered: number;
  coveragePct: number;
  activeSellerTotal: number;
  /** Active sellers with at least one beat overlapping the zone. */
  sellers: SellerCoverage[];
  sellersReachingCustomers: number;
  /** Inactive sellers whose beats overlap the zone — excluded. */
  inactiveSellersExcluded: number;
  /** Active beats overlapping the zone — drawn on the coverage map. */
  zoneBeats: ServiceabilityBeat[];
  beatsInZone: number;
  /** …of which reach past the zone boundary. */
  beatsExtendingOutside: number;
  companies: CompanyCoverage[];
  clusters: ClusterCoverage[];
  /** Mean / median / max companies visible per active customer. */
  avgCompanies: number;
  medianCompanies: number;
  maxCompanies: number;
  avgSellers: number;
  /** Mean customers reached across sellers that reach any. */
  avgCustomersPerSeller: number;
  companyBuckets: Bucket[];
  sellerBuckets: Bucket[];
  dayReach: DayReach[];
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Number(((n / d) * 100).toFixed(1)));
const round1 = (n: number) => Number(n.toFixed(1));

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Sized for Hyderabad's dense network — a KPHB customer typically sees
// 40–70 companies through 7–14 sellers.
const COMPANY_BUCKETS: [string, number, number][] = [
  ["None", 0, 0],
  ["1–10", 1, 10],
  ["11–20", 11, 20],
  ["21–30", 21, 30],
  ["31–40", 31, 40],
  ["41–50", 41, 50],
  ["51–60", 51, 60],
  ["61–70", 61, 70],
  ["71+", 71, Infinity],
];

const SELLER_BUCKETS: [string, number, number][] = [
  ["None", 0, 0],
  ["1", 1, 1],
  ["2–3", 2, 3],
  ["4–6", 4, 6],
  ["7–9", 7, 9],
  ["10–12", 10, 12],
  ["13–15", 13, 15],
  ["16+", 16, Infinity],
];

function bucketise(values: number[], defs: [string, number, number][]): Bucket[] {
  return defs.map(([label, lo, hi]) => ({
    label,
    count: values.filter((v) => v >= lo && v <= hi).length,
  }));
}

const sellerDisplayName = (s: Seller | undefined, beat: ServiceabilityBeat) =>
  s?.businessName || s?.name || beat.sellerName || "Unknown seller";

/**
 * True when part of the beat lies outside the zone, judged by its
 * vertices. Exact for convex zones (circles); with a concave drawn
 * zone a beat can bulge out between two inside vertices and still
 * count as inside — close enough for a dashboard count.
 */
function beatExtendsOutside(beat: ServiceabilityBeat, zone: unknown): boolean {
  return polygonOuterRings(beat.polygonData).some((ring) =>
    ring.some(([lng, lat]) => !polygonContainsPoint(zone, lat, lng)),
  );
}

/**
 * Point → containing beats, through a ~1 km grid over the beats'
 * bounding boxes. The full-coverage pass tests the whole city roster;
 * a cold matchCustomer scans every beat for every customer (~12 s on
 * the real roster). Same polygonContainsPoint test, so the result is
 * matchCustomer's restricted to these beats.
 */
function beatPointIndex(
  beats: ServiceabilityBeat[],
): (lat: number, lng: number) => ServiceabilityBeat[] {
  const CELL = 0.01;
  const cell = (v: number) => Math.floor(v / CELL);
  const grid = new Map<string, ServiceabilityBeat[]>();
  for (const b of beats) {
    const pts = polygonOuterRings(b.polygonData).flat();
    if (pts.length === 0) continue;
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    for (let cx = cell(Math.min(...xs)); cx <= cell(Math.max(...xs)); cx++) {
      for (let cy = cell(Math.min(...ys)); cy <= cell(Math.max(...ys)); cy++) {
        const key = `${cx}:${cy}`;
        const list = grid.get(key);
        if (list) list.push(b);
        else grid.set(key, [b]);
      }
    }
  }
  return (lat, lng) =>
    (grid.get(`${cell(lng)}:${cell(lat)}`) ?? []).filter((b) =>
      polygonContainsPoint(b.polygonData, lat, lng),
    );
}

export function buildDarkStoreAnalysis(
  store: DarkStore,
  roster: DbCustomer[] = getCustomers(),
  scope: CoverageScope = "zone",
): DarkStoreAnalysis {
  const sellers = getSellers();
  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  const activeSellerIds = new Set(
    sellers.filter((s) => s.isActive !== false).map((s) => s.id),
  );

  // 1 — every beat geometrically overlapping the zone, split by whether
  // its seller is active.
  const zoneBeats = getServiceabilityBeats().filter(
    (b) => b.polygonData != null && polygonsOverlap(b.polygonData, store.zone),
  );
  const inactiveSellersExcluded = new Set(
    zoneBeats
      .filter((b) => b.sellerId && !activeSellerIds.has(b.sellerId))
      .map((b) => b.sellerId),
  ).size;
  const activeZoneBeats = zoneBeats.filter(
    (b) => !b.sellerId || activeSellerIds.has(b.sellerId),
  );
  const extendingBeatIds = new Set(
    activeZoneBeats.filter((b) => beatExtendsOutside(b, store.zone)).map((b) => b.id),
  );

  // 2 — customers in scope: inside the zone, plus (full scope) those
  // outside it that a zone-touching beat reaches. Only active ones are
  // analysed.
  const inZone = roster.filter((c) => polygonContainsPoint(store.zone, c.lat, c.lng));
  const inZoneSet = new Set(inZone);
  const outsideZone: { customer: DbCustomer; beats: ServiceabilityBeat[] }[] = [];
  if (scope === "full") {
    const zoneBeatsAt = beatPointIndex(activeZoneBeats);
    for (const c of roster) {
      if (inZoneSet.has(c)) continue;
      const beats = zoneBeatsAt(c.lat, c.lng);
      if (beats.length > 0) outsideZone.push({ customer: c, beats });
    }
  }

  const toZoneCustomer = (
    c: DbCustomer,
    insideZone: boolean,
    beats: ServiceabilityBeat[],
  ): ZoneCustomer => {
    const sellerIds = [...new Set(beats.map((b) => b.sellerId ?? ""))].filter(Boolean);
    const companyNames = [...new Set(beats.map((b) => b.companyName))].sort((a, b) =>
      a.localeCompare(b),
    );
    const sellerNames = [
      ...new Set(beats.map((b) => sellerDisplayName(sellerById.get(b.sellerId ?? ""), b))),
    ].sort((a, b) => a.localeCompare(b));
    const deliveryDays = sortDeliveryDays([...new Set(beats.flatMap((b) => b.deliveryDays))]);
    return {
      customer: c,
      insideZone,
      distanceKm: Number(
        haversineKm(store.centre.lat, store.centre.lng, c.lat, c.lng).toFixed(2),
      ),
      beats,
      sellerIds,
      sellerNames,
      companyNames,
      deliveryDays,
    };
  };
  const customers: ZoneCustomer[] = [
    ...inZone
      .filter(isActiveCustomer)
      .map((c) => toZoneCustomer(c, true, matchCustomer(c, activeSellerIds))),
    ...outsideZone
      .filter((o) => isActiveCustomer(o.customer))
      .map((o) => toZoneCustomer(o.customer, false, o.beats)),
  ];
  const total = customers.length;
  const insideCount = customers.filter((z) => z.insideZone).length;
  const covered = customers.filter((z) => z.beats.length > 0).length;

  // 3 — seller coverage, from the active zone beats.
  const reachBySeller = new Map<string, { inside: number; outside: number }>();
  const soleBySeller = new Map<string, number>();
  for (const z of customers) {
    for (const id of z.sellerIds) {
      const reach = reachBySeller.get(id) ?? { inside: 0, outside: 0 };
      if (z.insideZone) reach.inside++;
      else reach.outside++;
      reachBySeller.set(id, reach);
    }
    if (z.sellerIds.length === 1) {
      soleBySeller.set(z.sellerIds[0], (soleBySeller.get(z.sellerIds[0]) ?? 0) + 1);
    }
  }

  const beatsBySeller = new Map<string, ServiceabilityBeat[]>();
  for (const b of activeZoneBeats) {
    const id = b.sellerId ?? "";
    const beats = beatsBySeller.get(id) ?? [];
    beats.push(b);
    beatsBySeller.set(id, beats);
  }
  const sellerRows: SellerCoverage[] = [...beatsBySeller.entries()].map(([id, beats]) => {
    const s = sellerById.get(id);
    const warehouseKm =
      s?.latitude != null && s?.longitude != null
        ? Number(
            haversineKm(store.centre.lat, store.centre.lng, s.latitude, s.longitude).toFixed(2),
          )
        : null;
    const reach = reachBySeller.get(id) ?? { inside: 0, outside: 0 };
    const reached = reach.inside + reach.outside;
    return {
      sellerId: id,
      sellerName: s?.name ?? beats[0].sellerName ?? "",
      businessName: sellerDisplayName(s, beats[0]),
      warehouseKm,
      warehouseInZone:
        s?.latitude != null &&
        s?.longitude != null &&
        polygonContainsPoint(store.zone, s.latitude, s.longitude),
      beatsInZone: beats.length,
      beatsExtendingOutside: beats.filter((b) => extendingBeatIds.has(b.id)).length,
      companyNames: [...new Set(beats.map((b) => b.companyName))].sort((a, b) =>
        a.localeCompare(b),
      ),
      customersReached: reached,
      customersInside: reach.inside,
      customersOutside: reach.outside,
      coveragePct: pct(reached, total),
      soleSellerCustomers: soleBySeller.get(id) ?? 0,
      deliveryDays: sortDeliveryDays([...new Set(beats.flatMap((b) => b.deliveryDays))]),
    };
  });
  sellerRows.sort(
    (a, b) =>
      b.customersReached - a.customersReached ||
      a.businessName.localeCompare(b.businessName),
  );

  // 4 — company coverage, from the customers' matched beats.
  const companyAgg = new Map<
    string,
    { companyName: string; sellers: Set<string>; inside: number; outside: number }
  >();
  for (const b of activeZoneBeats) {
    const entry = companyAgg.get(b.companyId) ?? {
      companyName: b.companyName,
      sellers: new Set<string>(),
      inside: 0,
      outside: 0,
    };
    entry.sellers.add(sellerDisplayName(sellerById.get(b.sellerId ?? ""), b));
    companyAgg.set(b.companyId, entry);
  }
  for (const z of customers) {
    for (const companyId of new Set(z.beats.map((b) => b.companyId))) {
      const entry = companyAgg.get(companyId);
      if (!entry) continue;
      if (z.insideZone) entry.inside++;
      else entry.outside++;
    }
  }
  const companies: CompanyCoverage[] = [...companyAgg.entries()]
    .map(([companyId, e]) => ({
      companyId,
      companyName: e.companyName,
      sellerNames: [...e.sellers].sort((a, b) => a.localeCompare(b)),
      customersReached: e.inside + e.outside,
      customersInside: e.inside,
      customersOutside: e.outside,
      coveragePct: pct(e.inside + e.outside, total),
    }))
    .sort(
      (a, b) =>
        b.customersReached - a.customersReached ||
        a.companyName.localeCompare(b.companyName),
    );

  // 5 — cluster pivot.
  const clusterAgg = new Map<string, ZoneCustomer[]>();
  for (const z of customers) {
    const key = z.customer.cluster || "Unassigned";
    const members = clusterAgg.get(key) ?? [];
    members.push(z);
    clusterAgg.set(key, members);
  }
  const clusters: ClusterCoverage[] = [...clusterAgg.entries()]
    .map(([cluster, list]) => {
      const cov = list.filter((z) => z.beats.length > 0).length;
      const inside = list.filter((z) => z.insideZone).length;
      return {
        cluster,
        activeCustomers: list.length,
        inside,
        outside: list.length - inside,
        covered: cov,
        coveragePct: pct(cov, list.length),
        avgCompanies: round1(
          list.reduce((s, z) => s + z.companyNames.length, 0) / list.length,
        ),
        avgSellers: round1(list.reduce((s, z) => s + z.sellerIds.length, 0) / list.length),
      };
    })
    .sort((a, b) => b.activeCustomers - a.activeCustomers);

  const companyCounts = customers.map((z) => z.companyNames.length);
  const sellerCounts = customers.map((z) => z.sellerIds.length);
  const reachingSellers = sellerRows.filter((s) => s.customersReached > 0);

  return {
    store,
    scope,
    totalInZone: inZone.length,
    totalInScope: inZone.length + outsideZone.length,
    customers,
    insideCount,
    outsideCount: total - insideCount,
    covered,
    notCovered: total - covered,
    coveragePct: pct(covered, total),
    activeSellerTotal: activeSellerIds.size,
    sellers: sellerRows,
    sellersReachingCustomers: reachingSellers.length,
    inactiveSellersExcluded,
    zoneBeats: activeZoneBeats,
    beatsInZone: activeZoneBeats.length,
    beatsExtendingOutside: extendingBeatIds.size,
    companies,
    clusters,
    avgCompanies: total ? round1(companyCounts.reduce((a, b) => a + b, 0) / total) : 0,
    medianCompanies: median(companyCounts),
    maxCompanies: Math.max(0, ...companyCounts),
    avgSellers: total ? round1(sellerCounts.reduce((a, b) => a + b, 0) / total) : 0,
    avgCustomersPerSeller: reachingSellers.length
      ? Math.round(
          reachingSellers.reduce((s, r) => s + r.customersReached, 0) /
            reachingSellers.length,
        )
      : 0,
    companyBuckets: bucketise(companyCounts, COMPANY_BUCKETS),
    sellerBuckets: bucketise(sellerCounts, SELLER_BUCKETS),
    dayReach: DELIVERY_DAY_OPTIONS.map((day) => {
      const n = customers.filter((z) => z.deliveryDays.includes(day)).length;
      return { day, customers: n, pct: pct(n, total) };
    }),
  };
}

// ---- Table exports ----
//
// Each dashboard table has a header list + a row → cells mapper, shared
// by its CSV download and its sheet in the analytics workbook so the
// two can't drift apart. The full-coverage view adds inside / outside
// zone columns.

type Cell = string | number;

export interface TableSpec<T> {
  sheet: string;
  headers: string[];
  widths: number[];
  cells: (row: T) => Cell[];
}

interface Column<T> {
  header: string;
  width: number;
  cell: (row: T) => Cell;
}

/** Build a spec from columns; `false` entries are skipped. */
function tableSpec<T>(sheet: string, columns: (Column<T> | false)[]): TableSpec<T> {
  const cols = columns.filter((c): c is Column<T> => c !== false);
  return {
    sheet,
    headers: cols.map((c) => c.header),
    widths: cols.map((c) => c.width),
    cells: (row) => cols.map((c) => c.cell(row)),
  };
}

const list = (xs: string[]) => (xs.length ? xs.join(", ") : "—");

export const SCOPE_LABEL: Record<CoverageScope, string> = {
  zone: "Dark Store Only",
  full: "Dark Store + Seller Coverage",
};

export function sellerTable(scope: CoverageScope): TableSpec<SellerCoverage> {
  const full = scope === "full";
  return tableSpec("Seller-wise", [
    { header: "Business Name", width: 30, cell: (s) => s.businessName },
    { header: "Seller Name", width: 26, cell: (s) => s.sellerName || "—" },
    { header: "Customers Reached", width: 18, cell: (s) => s.customersReached },
    full && { header: "Inside Zone", width: 14, cell: (s) => s.customersInside },
    full && { header: "Outside Zone", width: 14, cell: (s) => s.customersOutside },
    full && {
      header: "Inside Zone %",
      width: 14,
      cell: (s) => pct(s.customersInside, s.customersReached),
    },
    { header: "Coverage %", width: 12, cell: (s) => s.coveragePct },
    { header: "Sole Seller For", width: 16, cell: (s) => s.soleSellerCustomers },
    { header: "Beats in Zone", width: 14, cell: (s) => s.beatsInZone },
    { header: "Beats Extending Outside", width: 22, cell: (s) => s.beatsExtendingOutside },
    { header: "Companies", width: 12, cell: (s) => s.companyNames.length },
    { header: "Company Names", width: 60, cell: (s) => list(s.companyNames) },
    { header: "Delivery Days", width: 40, cell: (s) => list(s.deliveryDays) },
    { header: "Warehouse Distance (km)", width: 22, cell: (s) => s.warehouseKm ?? "—" },
    { header: "Warehouse in Zone", width: 18, cell: (s) => (s.warehouseInZone ? "Yes" : "No") },
  ]);
}

export function companyTable(scope: CoverageScope): TableSpec<CompanyCoverage> {
  const full = scope === "full";
  return tableSpec("Company-wise", [
    { header: "Company Name", width: 32, cell: (c) => c.companyName },
    { header: "Customers Reached", width: 18, cell: (c) => c.customersReached },
    full && { header: "Inside Zone", width: 14, cell: (c) => c.customersInside },
    full && { header: "Outside Zone", width: 14, cell: (c) => c.customersOutside },
    { header: "Coverage %", width: 12, cell: (c) => c.coveragePct },
    { header: "Sellers", width: 10, cell: (c) => c.sellerNames.length },
    { header: "Seller Names", width: 60, cell: (c) => list(c.sellerNames) },
  ]);
}

export function clusterTable(scope: CoverageScope): TableSpec<ClusterCoverage> {
  const full = scope === "full";
  return tableSpec("Cluster-wise", [
    { header: "Cluster", width: 22, cell: (c) => c.cluster },
    { header: "Active Customers", width: 16, cell: (c) => c.activeCustomers },
    full && { header: "Inside Zone", width: 14, cell: (c) => c.inside },
    full && { header: "Outside Zone", width: 14, cell: (c) => c.outside },
    { header: "Covered", width: 12, cell: (c) => c.covered },
    { header: "Not Covered", width: 14, cell: (c) => c.activeCustomers - c.covered },
    { header: "Coverage %", width: 12, cell: (c) => c.coveragePct },
    { header: "Avg Companies / Customer", width: 24, cell: (c) => c.avgCompanies },
    { header: "Avg Sellers / Customer", width: 22, cell: (c) => c.avgSellers },
  ]);
}

export function customerTable(scope: CoverageScope): TableSpec<ZoneCustomer> {
  const full = scope === "full";
  return tableSpec("Customer Exposure", [
    { header: "Customer ID", width: 16, cell: (z) => z.customer.customerId },
    { header: "Customer Name", width: 30, cell: (z) => z.customer.name },
    { header: "Mobile Number", width: 16, cell: (z) => z.customer.mobile },
    { header: "Business Type", width: 16, cell: (z) => z.customer.businessType || "—" },
    { header: "Cluster", width: 16, cell: (z) => z.customer.cluster || "—" },
    { header: "Salesperson", width: 20, cell: (z) => z.customer.salespersonName || "—" },
    { header: "Latitude", width: 12, cell: (z) => z.customer.lat },
    { header: "Longitude", width: 12, cell: (z) => z.customer.lng },
    full && {
      header: "Location",
      width: 14,
      cell: (z) => (z.insideZone ? "Inside zone" : "Outside zone"),
    },
    { header: "Distance to Dark Store (km)", width: 24, cell: (z) => z.distanceKm },
    { header: "Sellers", width: 10, cell: (z) => z.sellerIds.length },
    { header: "Companies", width: 12, cell: (z) => z.companyNames.length },
    { header: "Seller Names", width: 50, cell: (z) => list(z.sellerNames) },
    { header: "Company Names", width: 70, cell: (z) => list(z.companyNames) },
    { header: "Delivery Days", width: 40, cell: (z) => list(z.deliveryDays) },
    {
      header: "Status",
      width: 16,
      cell: (z) => (z.beats.length > 0 ? "Serviceable" : "Not Serviceable"),
    },
  ]);
}

export function downloadTableCsv<T>(spec: TableSpec<T>, rows: T[], filename: string): void {
  const lines = [
    spec.headers.map(csvEscape).join(","),
    ...rows.map((r) => spec.cells(r).map(csvEscape).join(",")),
  ];
  // BOM so Excel opens UTF-8 names correctly.
  triggerDownload(
    new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
    filename,
  );
}

/**
 * One workbook with every dashboard view: Overview (the KPI cards),
 * Seller-wise, Company-wise, Cluster-wise, Day-wise and the per-customer
 * exposure sheet — for the analysis' coverage view.
 */
export async function downloadAnalyticsXlsx(
  a: DarkStoreAnalysis,
  filename: string,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  const addSheet = (name: string, headers: string[], widths: number[], rows: Cell[][]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = headers.map((header, i) => ({ header, key: `c${i}`, width: widths[i] }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    for (const r of rows) ws.addRow(r);
    ws.autoFilter = {
      from: "A1",
      to: `${String.fromCharCode(64 + headers.length)}1`,
    };
  };

  const { store, scope } = a;
  const full = scope === "full";
  const overview: Cell[][] = [
    ["Dark Store", store.name],
    ["Coverage view", SCOPE_LABEL[scope]],
    ["Area", [store.areaName, store.city].filter(Boolean).join(", ")],
    ["Store location (lat, long)", `${store.centre.lat.toFixed(6)}, ${store.centre.lng.toFixed(6)}`],
    ["Service area", `Polygon · ${storeZoneLabel(store)}`],
    ["Service area (km²)", Number(store.areaKm2.toFixed(2))],
    ["Connected seller accounts", getConnectedSellerIds(store).length],
    ["Customers in zone (all statuses)", a.totalInZone],
    ...(full ? [["Customers in coverage (all statuses)", a.totalInScope]] : []),
    [full ? "Active customers in coverage" : "Active customers in zone", a.customers.length],
    ...(full
      ? [
          ["Active customers inside the zone", a.insideCount],
          ["Active customers outside the zone", a.outsideCount],
          ["Inside zone %", pct(a.insideCount, a.customers.length)],
        ]
      : []),
    ["Active customers covered", a.covered],
    ["Active customers not covered", a.notCovered],
    ["Coverage %", a.coveragePct],
    ["Active sellers covering zone", a.sellers.length],
    ["Sellers reaching active customers", a.sellersReachingCustomers],
    ["Active sellers (network)", a.activeSellerTotal],
    ["Inactive sellers excluded", a.inactiveSellersExcluded],
    ["Beats overlapping zone", a.beatsInZone],
    ["Beats extending outside zone", a.beatsExtendingOutside],
    ["Companies available in zone", a.companies.length],
    ["Avg companies per active customer", a.avgCompanies],
    ["Median companies per active customer", a.medianCompanies],
    ["Max companies for one customer", a.maxCompanies],
    ["Avg sellers per active customer", a.avgSellers],
    ["Avg customers per seller", a.avgCustomersPerSeller],
    ["Active customer rule", "Business Status = Active-User AND Status = Active"],
    ...(full
      ? [
          [
            "Coverage rule",
            "Zone customers, plus customers outside it reached by a beat that overlaps the zone",
          ],
        ]
      : []),
    ["Generated", new Date().toLocaleString("en-IN")],
  ];
  addSheet("Overview", ["Metric", "Value"], [44, 40], overview);

  const addTable = <T,>(spec: TableSpec<T>, rows: T[]) =>
    addSheet(spec.sheet, spec.headers, spec.widths, rows.map(spec.cells));
  addTable(sellerTable(scope), a.sellers);
  addTable(companyTable(scope), a.companies);
  addTable(clusterTable(scope), a.clusters);
  addSheet(
    "Day-wise",
    ["Delivery Day", "Customers Served", "Coverage %"],
    [16, 18, 12],
    a.dayReach.map((d) => [d.day, d.customers, d.pct]),
  );
  addTable(customerTable(scope), a.customers);

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}
