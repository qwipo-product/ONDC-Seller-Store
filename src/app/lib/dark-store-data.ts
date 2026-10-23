// Dark Stores — Qwipo-run fulfilment points, each defined by a zone
// (a GeoJSON polygon, usually a radius circle drawn on geojson.io).
//
// The admin Dark Store dashboard measures how today's distributor
// network already covers a zone: which ACTIVE sellers' delivery beats
// reach the zone's ACTIVE customers, and how many companies each of
// those customers can order from. Matching is the same real
// point-in-polygon the Beat Serviceability Report uses
// (matchCustomer), so the two never disagree.

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

export interface ZoneCustomer {
  customer: DbCustomer;
  /** Customer ↔ dark-store centre, km (2 dp). */
  distanceKm: number;
  /** Active-seller beats whose polygon contains the customer. */
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
  /** Companies carried on those beats, sorted. */
  companyNames: string[];
  /** Active zone customers inside at least one of its beats. */
  customersReached: number;
  /** Share of the zone's active customers reached, 0–100. */
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
  coveragePct: number;
}

export interface ClusterCoverage {
  cluster: string;
  activeCustomers: number;
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
  /** Every roster customer inside the zone, any status. */
  totalInZone: number;
  /** Active customers inside the zone — the population analysed. */
  customers: ZoneCustomer[];
  covered: number;
  notCovered: number;
  coveragePct: number;
  activeSellerTotal: number;
  /** Active sellers with at least one beat overlapping the zone. */
  sellers: SellerCoverage[];
  sellersReachingCustomers: number;
  /** Inactive sellers whose beats overlap the zone — excluded. */
  inactiveSellersExcluded: number;
  beatsInZone: number;
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

export function buildDarkStoreAnalysis(
  store: DarkStore,
  roster: DbCustomer[] = getCustomers(),
): DarkStoreAnalysis {
  const sellers = getSellers();
  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  const activeSellerIds = new Set(
    sellers.filter((s) => s.isActive !== false).map((s) => s.id),
  );

  // 1 — customers inside the zone; only active ones are analysed.
  const inZone = roster.filter((c) =>
    polygonContainsPoint(store.zone, c.lat, c.lng),
  );
  const customers: ZoneCustomer[] = inZone.filter(isActiveCustomer).map((c) => {
    const beats = matchCustomer(c, activeSellerIds);
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
      distanceKm: Number(
        haversineKm(store.centre.lat, store.centre.lng, c.lat, c.lng).toFixed(2),
      ),
      beats,
      sellerIds,
      sellerNames,
      companyNames,
      deliveryDays,
    };
  });
  const total = customers.length;
  const covered = customers.filter((z) => z.beats.length > 0).length;

  // 2 — seller coverage: every beat geometrically overlapping the zone,
  // split by whether its seller is active.
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

  const reachBySeller = new Map<string, number>();
  const soleBySeller = new Map<string, number>();
  for (const z of customers) {
    for (const id of z.sellerIds) reachBySeller.set(id, (reachBySeller.get(id) ?? 0) + 1);
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
    const reached = reachBySeller.get(id) ?? 0;
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
      companyNames: [...new Set(beats.map((b) => b.companyName))].sort((a, b) =>
        a.localeCompare(b),
      ),
      customersReached: reached,
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

  // 3 — company coverage, from the customers' matched beats.
  const companyAgg = new Map<
    string,
    { companyName: string; sellers: Set<string>; customers: number }
  >();
  for (const b of activeZoneBeats) {
    const entry = companyAgg.get(b.companyId) ?? {
      companyName: b.companyName,
      sellers: new Set<string>(),
      customers: 0,
    };
    entry.sellers.add(sellerDisplayName(sellerById.get(b.sellerId ?? ""), b));
    companyAgg.set(b.companyId, entry);
  }
  for (const z of customers) {
    for (const companyId of new Set(z.beats.map((b) => b.companyId))) {
      const entry = companyAgg.get(companyId);
      if (entry) entry.customers++;
    }
  }
  const companies: CompanyCoverage[] = [...companyAgg.entries()]
    .map(([companyId, e]) => ({
      companyId,
      companyName: e.companyName,
      sellerNames: [...e.sellers].sort((a, b) => a.localeCompare(b)),
      customersReached: e.customers,
      coveragePct: pct(e.customers, total),
    }))
    .sort(
      (a, b) =>
        b.customersReached - a.customersReached ||
        a.companyName.localeCompare(b.companyName),
    );

  // 4 — cluster pivot.
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
      return {
        cluster,
        activeCustomers: list.length,
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
    totalInZone: inZone.length,
    customers,
    covered,
    notCovered: total - covered,
    coveragePct: pct(covered, total),
    activeSellerTotal: activeSellerIds.size,
    sellers: sellerRows,
    sellersReachingCustomers: reachingSellers.length,
    inactiveSellersExcluded,
    beatsInZone: activeZoneBeats.length,
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
// two can't drift apart.

type Cell = string | number;

export interface TableSpec<T> {
  sheet: string;
  headers: string[];
  widths: number[];
  cells: (row: T) => Cell[];
}

const list = (xs: string[]) => (xs.length ? xs.join(", ") : "—");

export const SELLER_TABLE: TableSpec<SellerCoverage> = {
  sheet: "Seller-wise",
  headers: [
    "Business Name",
    "Seller Name",
    "Customers Reached",
    "Coverage %",
    "Sole Seller For",
    "Beats in Zone",
    "Companies",
    "Company Names",
    "Delivery Days",
    "Warehouse Distance (km)",
    "Warehouse in Zone",
  ],
  widths: [30, 26, 18, 12, 16, 14, 12, 60, 40, 22, 18],
  cells: (s) => [
    s.businessName,
    s.sellerName || "—",
    s.customersReached,
    s.coveragePct,
    s.soleSellerCustomers,
    s.beatsInZone,
    s.companyNames.length,
    list(s.companyNames),
    list(s.deliveryDays),
    s.warehouseKm ?? "—",
    s.warehouseInZone ? "Yes" : "No",
  ],
};

export const COMPANY_TABLE: TableSpec<CompanyCoverage> = {
  sheet: "Company-wise",
  headers: ["Company Name", "Customers Reached", "Coverage %", "Sellers", "Seller Names"],
  widths: [32, 18, 12, 10, 60],
  cells: (c) => [
    c.companyName,
    c.customersReached,
    c.coveragePct,
    c.sellerNames.length,
    list(c.sellerNames),
  ],
};

export const CLUSTER_TABLE: TableSpec<ClusterCoverage> = {
  sheet: "Cluster-wise",
  headers: [
    "Cluster",
    "Active Customers",
    "Covered",
    "Not Covered",
    "Coverage %",
    "Avg Companies / Customer",
    "Avg Sellers / Customer",
  ],
  widths: [22, 16, 12, 14, 12, 24, 22],
  cells: (c) => [
    c.cluster,
    c.activeCustomers,
    c.covered,
    c.activeCustomers - c.covered,
    c.coveragePct,
    c.avgCompanies,
    c.avgSellers,
  ],
};

export const CUSTOMER_TABLE: TableSpec<ZoneCustomer> = {
  sheet: "Customer Exposure",
  headers: [
    "Customer ID",
    "Customer Name",
    "Mobile Number",
    "Business Type",
    "Cluster",
    "Salesperson",
    "Latitude",
    "Longitude",
    "Distance to Dark Store (km)",
    "Sellers",
    "Companies",
    "Seller Names",
    "Company Names",
    "Delivery Days",
    "Status",
  ],
  widths: [16, 30, 16, 16, 16, 20, 12, 12, 24, 10, 12, 50, 70, 40, 16],
  cells: (z) => [
    z.customer.customerId,
    z.customer.name,
    z.customer.mobile,
    z.customer.businessType || "—",
    z.customer.cluster || "—",
    z.customer.salespersonName || "—",
    z.customer.lat,
    z.customer.lng,
    z.distanceKm,
    z.sellerIds.length,
    z.companyNames.length,
    list(z.sellerNames),
    list(z.companyNames),
    list(z.deliveryDays),
    z.beats.length > 0 ? "Serviceable" : "Not Serviceable",
  ],
};

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
 * exposure sheet.
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

  const { store } = a;
  addSheet("Overview", ["Metric", "Value"], [44, 40], [
    ["Dark Store", store.name],
    ["Locality", store.locality],
    ["Zone centre (lat, long)", `${store.centre.lat.toFixed(6)}, ${store.centre.lng.toFixed(6)}`],
    ["Zone radius (km)", Number(store.radiusKm.toFixed(2))],
    ["Customers in zone (all statuses)", a.totalInZone],
    ["Active customers in zone", a.customers.length],
    ["Active customers covered", a.covered],
    ["Active customers not covered", a.notCovered],
    ["Coverage %", a.coveragePct],
    ["Active sellers covering zone", a.sellers.length],
    ["Sellers reaching active customers", a.sellersReachingCustomers],
    ["Active sellers (network)", a.activeSellerTotal],
    ["Inactive sellers excluded", a.inactiveSellersExcluded],
    ["Beats overlapping zone", a.beatsInZone],
    ["Companies available in zone", a.companies.length],
    ["Avg companies per active customer", a.avgCompanies],
    ["Median companies per active customer", a.medianCompanies],
    ["Max companies for one customer", a.maxCompanies],
    ["Avg sellers per active customer", a.avgSellers],
    ["Avg customers per seller", a.avgCustomersPerSeller],
    ["Active customer rule", "Business Status = Active-User AND Status = Active"],
    ["Generated", new Date().toLocaleString("en-IN")],
  ]);

  const addTable = <T,>(spec: TableSpec<T>, rows: T[]) =>
    addSheet(spec.sheet, spec.headers, spec.widths, rows.map(spec.cells));
  addTable(SELLER_TABLE, a.sellers);
  addTable(COMPANY_TABLE, a.companies);
  addTable(CLUSTER_TABLE, a.clusters);
  addSheet(
    "Day-wise",
    ["Delivery Day", "Customers Served", "Coverage %"],
    [16, 18, 12],
    a.dayReach.map((d) => [d.day, d.customers, d.pct]),
  );
  addTable(CUSTOMER_TABLE, a.customers);

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}
