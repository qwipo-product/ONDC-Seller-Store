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
  haversineKm,
  polygonContainsPoint,
  polygonOuterRings,
  polygonsOverlap,
  sortDeliveryDays,
  type ServiceabilityBeat,
} from "./serviceability-data";
import { DELIVERY_DAY_OPTIONS, type DeliveryDay } from "./customers-data";
import { getSellers, type Seller } from "./mock-store";

// ---- Store registry ----

export interface DarkStore {
  /** URL slug — /admin/dark-store/:id */
  id: string;
  /** "KPHB Dark Store" */
  name: string;
  /** "KPHB" — prefix for the sidebar item and file names. */
  shortName: string;
  locality: string;
  centre: { lat: number; lng: number };
  /** Mean centre → boundary distance, for display. */
  radiusKm: number;
  /** GeoJSON (FeatureCollection / Feature / Polygon). */
  zone: unknown;
}

/**
 * Centre of a circle zone. geojson.io stamps `@circle.center` ([lng,
 * lat]) on circles it draws; any other polygon falls back to the mean
 * of its outer-ring vertices.
 */
function zoneCentre(zone: unknown): { lat: number; lng: number } {
  const props = (zone as { features?: { properties?: Record<string, unknown> }[] })
    ?.features?.[0]?.properties;
  const circle = props?.["@circle"] as { center?: [number, number] } | undefined;
  if (circle?.center) return { lat: circle.center[1], lng: circle.center[0] };
  const pts = polygonOuterRings(zone).flat();
  const sum = pts.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return { lat: sum[1] / pts.length, lng: sum[0] / pts.length };
}

function makeDarkStore(
  meta: Omit<DarkStore, "centre" | "radiusKm">,
): DarkStore {
  const centre = zoneCentre(meta.zone);
  const ring = polygonOuterRings(meta.zone)[0] ?? [];
  const radiusKm =
    ring.reduce((sum, [x, y]) => sum + haversineKm(centre.lat, centre.lng, y, x), 0) /
    Math.max(1, ring.length);
  return { ...meta, centre, radiusKm };
}

export const DARK_STORES: DarkStore[] = [
  makeDarkStore({
    id: "kphb",
    name: "KPHB Dark Store",
    shortName: "KPHB",
    locality: "Kukatpally, Hyderabad",
    zone: kphbZone,
  }),
  makeDarkStore({
    id: "alwal",
    name: "Alwal Dark Store",
    shortName: "Alwal",
    locality: "Alwal, Secunderabad",
    zone: alwalZone,
  }),
];

export function getDarkStore(id: string): DarkStore | undefined {
  return DARK_STORES.find((s) => s.id === id);
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
 * True when part of the beat lies outside the zone. Zones are circles
 * (convex), so a beat whose every vertex is inside is wholly inside.
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
    ["Locality", store.locality],
    ["Zone centre (lat, long)", `${store.centre.lat.toFixed(6)}, ${store.centre.lng.toFixed(6)}`],
    ["Zone radius (km)", Number(store.radiusKm.toFixed(2))],
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
