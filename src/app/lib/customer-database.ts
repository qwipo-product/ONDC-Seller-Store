// Admin Customer Database — the raw customer roster the business team
// uploads (CSV/XLSX) to check WHERE their customers fall relative to
// every distributor company's delivery-beat polygons.
//
// Unlike the demo stores, this one persists to localStorage: the whole
// point of the module is uploading real production rosters and keeping
// them around across sessions while the team iterates on reports.
//
// Matching is real point-in-polygon (findBeatsContainingPoint), not
// the demo hash picker — a customer is "visible" to a company exactly
// when their lat/lng falls inside one of that company's beat polygons.

import {
  findBeatsContainingPoint,
  haversineKm,
  sortDeliveryDays,
  type ServiceabilityBeat,
} from "./serviceability-data";
import { getSellerById } from "./mock-store";
// The production "Customer raw" roster — bundled with the app so the
// base customer database is ALWAYS present, on every device, without
// re-uploading. Uploads layer on top of it (deduped by mobile number).
import customerRawSeedCsv from "./customer-raw-seed.csv?raw";

export interface DbCustomer {
  /** Internal stable id (row key). */
  id: string;
  /** Business customer id from the upload — free text, may be blank. */
  customerId: string;
  name: string;
  mobile: string;
  lat: number;
  lng: number;
  uploadedAt: string;
}

// ---- Mobile-number identity ----
//
// Dedupe key for the whole module: digits only, last 10 kept (so
// "+91 98765 43210", "919876543210" and "9876543210" all collide).
// Empty when the row has no usable mobile — those rows can't be
// deduped and are always accepted.

export function normalizeMobile(mobile: string): string {
  const digits = (mobile ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

let _seq = 0;
export function makeCustomerRowId(): string {
  return `cust-${Date.now()}-${(_seq++).toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

// ---- Base roster (bundled seed) ----
//
// "Customer raw.csv" ships inside the bundle and is ALWAYS loaded —
// uploads and per-row deletes layer on top and persist separately.
// Seed rows get stable `seed-N` ids so the overlay survives reloads.
//
// Parsed lazily on first store access: the CSV helpers this relies on
// (HEADER_ALIASES etc.) are declared further down the module, so an
// eager module-scope parse would hit their temporal dead zone.

let _seedCustomers: DbCustomer[] | null = null;

function getSeedCustomers(): DbCustomer[] {
  if (_seedCustomers === null) {
    const parsed = rowsToCustomers(parseCsvGrid(customerRawSeedCsv));
    _seedCustomers = parsed.customers.map((c, i) => ({
      ...c,
      id: `seed-${i + 1}`,
      uploadedAt: "2026-07-19T00:00:00Z",
    }));
  }
  return _seedCustomers;
}

const isSeedId = (id: string) => id.startsWith("seed-");

// ---- Persistence ----
//
// Two keys: uploaded extras, and the ids of seed rows the admin has
// explicitly removed. The base roster itself is never written to
// storage — it always comes from the bundle.

const STORAGE_KEY = "qwipo-admin-customer-db";
const REMOVED_SEED_KEY = "qwipo-admin-customer-db-removed-seed";

function loadFromStorage(): DbCustomer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is DbCustomer =>
        c &&
        typeof c === "object" &&
        typeof c.id === "string" &&
        typeof c.lat === "number" &&
        typeof c.lng === "number",
    );
  } catch {
    return [];
  }
}

function loadRemovedSeedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(REMOVED_SEED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function persist(customers: DbCustomer[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(customers.filter((c) => !isSeedId(c.id))),
    );
    localStorage.setItem(REMOVED_SEED_KEY, JSON.stringify([..._removedSeedIds]));
  } catch {
    // Quota exceeded on very large rosters — keep the in-memory copy
    // working; the session still functions, it just won't survive a
    // reload. Surfacing this is the caller's job if it matters.
  }
}

let _removedSeedIds = loadRemovedSeedIds();

function buildInitialCustomers(): DbCustomer[] {
  const seed = getSeedCustomers().filter((c) => !_removedSeedIds.has(c.id));
  const seenMobiles = new Set(
    seed.map((c) => normalizeMobile(c.mobile)).filter(Boolean),
  );
  const extras = loadFromStorage().filter((c) => {
    if (isSeedId(c.id)) return false; // never trust seed copies from storage
    const m = normalizeMobile(c.mobile);
    if (m && seenMobiles.has(m)) return false;
    if (m) seenMobiles.add(m);
    return true;
  });
  return [...seed, ...extras];
}

// Lazy for the same TDZ reason as the seed parse above.
let _customers: DbCustomer[] | null = null;

function ensureLoaded(): DbCustomer[] {
  if (_customers === null) _customers = buildInitialCustomers();
  return _customers;
}

const _listeners = new Set<() => void>();

const notify = () => {
  for (const cb of _listeners) cb();
};

export function getCustomers(): DbCustomer[] {
  return ensureLoaded();
}

export function getCustomerById(id: string): DbCustomer | undefined {
  return ensureLoaded().find((c) => c.id === id);
}

export function subscribeToCustomers(cb: () => void): () => void {
  _listeners.add(cb);
  return () => {
    _listeners.delete(cb);
  };
}

export interface ImportResult {
  added: number;
  /** Rows skipped because their mobile number already exists. */
  skippedDuplicates: number;
}

/**
 * Append parsed rows, skipping any whose mobile number already exists
 * (in the base roster, in previous uploads, or earlier in this same
 * batch). `replace` drops previous uploads first — the bundled base
 * roster always stays.
 */
export function addCustomers(rows: DbCustomer[], replace = false): ImportResult {
  const current = ensureLoaded();
  const base = replace ? current.filter((c) => isSeedId(c.id)) : current;
  const seen = new Set(
    base.map((c) => normalizeMobile(c.mobile)).filter(Boolean),
  );
  const fresh: DbCustomer[] = [];
  let skipped = 0;
  for (const r of rows) {
    const m = normalizeMobile(r.mobile);
    if (m && seen.has(m)) {
      skipped++;
      continue;
    }
    if (m) seen.add(m);
    fresh.push(r);
  }
  _customers = [...base, ...fresh];
  persist(_customers);
  notify();
  return { added: fresh.length, skippedDuplicates: skipped };
}

/**
 * How many of these parsed rows would be skipped as duplicates if
 * imported right now (existing mobiles + repeats within the batch).
 * Used by the upload dialog to warn before the import happens.
 */
export function countDuplicateMobiles(rows: DbCustomer[]): number {
  const seen = new Set(
    ensureLoaded().map((c) => normalizeMobile(c.mobile)).filter(Boolean),
  );
  let dup = 0;
  for (const r of rows) {
    const m = normalizeMobile(r.mobile);
    if (!m) continue;
    if (seen.has(m)) dup++;
    else seen.add(m);
  }
  return dup;
}

export function removeCustomer(id: string): void {
  if (isSeedId(id)) _removedSeedIds.add(id);
  _customers = ensureLoaded().filter((c) => c.id !== id);
  persist(_customers);
  notify();
}

/**
 * Reset to the pristine bundled roster: uploaded extras are dropped
 * and previously removed base-roster rows come back.
 */
export function clearCustomers(): void {
  _removedSeedIds = new Set();
  _customers = getSeedCustomers().map((c) => ({ ...c }));
  persist(_customers);
  notify();
}

// ---- Upload parsing ----
//
// Header names in real rosters are messy — accept every alias we've
// seen. Matching is done on a normalized (lowercase, alphanumeric-only)
// form of the header cell.

const HEADER_ALIASES: Record<keyof ParsedColumns, string[]> = {
  customerId: ["customerid", "custid", "id", "customercode", "code", "retailerid"],
  name: ["customername", "name", "retailername", "storename", "outletname"],
  mobile: [
    "mobile",
    "mobilenumber",
    "mobileno",
    "phone",
    "phonenumber",
    "phoneno",
    "contact",
    "contactnumber",
  ],
  lat: ["lat", "latitude"],
  lng: ["lng", "long", "lon", "longitude"],
};

interface ParsedColumns {
  customerId: number | null;
  name: number | null;
  mobile: number | null;
  lat: number | null;
  lng: number | null;
}

const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function mapHeaders(headerRow: string[]): ParsedColumns {
  const cols: ParsedColumns = {
    customerId: null,
    name: null,
    mobile: null,
    lat: null,
    lng: null,
  };
  headerRow.forEach((cell, idx) => {
    const n = normHeader(cell ?? "");
    if (!n) return;
    for (const key of Object.keys(HEADER_ALIASES) as (keyof ParsedColumns)[]) {
      if (cols[key] === null && HEADER_ALIASES[key].includes(n)) {
        cols[key] = idx;
        return;
      }
    }
  });
  return cols;
}

export interface ParseResult {
  customers: DbCustomer[];
  /** Row-level problems, 1-based row numbers as seen in the file. */
  errors: string[];
  /** Total data rows encountered (valid + invalid). */
  totalRows: number;
}

/** Turn a grid of cells (header row first) into validated customers. */
function rowsToCustomers(grid: string[][]): ParseResult {
  const errors: string[] = [];
  if (grid.length === 0) {
    return { customers: [], errors: ["The file is empty."], totalRows: 0 };
  }
  const cols = mapHeaders(grid[0]);
  if (cols.lat === null || cols.lng === null) {
    return {
      customers: [],
      errors: [
        'Could not find latitude/longitude columns. Expected headers like "Latitude" and "Longitude" (or "Lat" / "Long").',
      ],
      totalRows: 0,
    };
  }
  if (cols.name === null && cols.customerId === null) {
    return {
      customers: [],
      errors: [
        'Could not find a "Customer Name" or "Customer ID" column — at least one is required.',
      ],
      totalRows: 0,
    };
  }

  const uploadedAt = new Date().toISOString();
  const customers: DbCustomer[] = [];
  let totalRows = 0;

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const cell = (i: number | null) => (i === null ? "" : (row[i] ?? "").trim());
    const isBlank = row.every((c) => !(c ?? "").trim());
    if (isBlank) continue;
    totalRows++;

    const latRaw = cell(cols.lat);
    const lngRaw = cell(cols.lng);
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const name = cell(cols.name);
    const customerId = cell(cols.customerId);

    if (!latRaw || !lngRaw || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      errors.push(`Row ${r + 1}: invalid lat/long ("${latRaw}", "${lngRaw}").`);
      continue;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      errors.push(`Row ${r + 1}: lat/long out of range (${lat}, ${lng}).`);
      continue;
    }
    if (!name && !customerId) {
      errors.push(`Row ${r + 1}: missing both customer name and customer id.`);
      continue;
    }

    customers.push({
      id: makeCustomerRowId(),
      customerId,
      name: name || customerId,
      mobile: cell(cols.mobile),
      lat,
      lng,
      uploadedAt,
    });
  }

  return { customers, errors, totalRows };
}

/**
 * Minimal RFC-4180-ish CSV parser — quoted fields, embedded commas,
 * escaped quotes, CRLF. Good enough for exports from Excel/Sheets.
 */
export function parseCsvGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip BOM
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty trailing rows
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function parseCustomerCsv(text: string): ParseResult {
  return rowsToCustomers(parseCsvGrid(text));
}

/** Parse the first worksheet of an .xlsx upload (ExcelJS, lazy-loaded). */
export async function parseCustomerXlsx(buffer: ArrayBuffer): Promise<ParseResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { customers: [], errors: ["No worksheet found in the file."], totalRows: 0 };
  }
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // row.values is 1-based; normalize every cell to display text.
    const values = row.values as unknown[];
    for (let c = 1; c < values.length; c++) {
      const v = values[c];
      if (v == null) {
        cells.push("");
      } else if (typeof v === "object" && v !== null && "text" in (v as object)) {
        cells.push(String((v as { text: unknown }).text ?? ""));
      } else if (typeof v === "object" && v !== null && "result" in (v as object)) {
        cells.push(String((v as { result: unknown }).result ?? ""));
      } else {
        cells.push(String(v));
      }
    }
    grid.push(cells);
  });
  return rowsToCustomers(grid);
}

/** Dispatch on file extension. */
export async function parseCustomerFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseCustomerXlsx(await file.arrayBuffer());
  }
  return parseCustomerCsv(await file.text());
}

// ---- Serviceability matching ----

export interface CompanyMatch {
  companyId: string;
  companyName: string;
  beats: ServiceabilityBeat[];
}

/** All beats (any company) whose polygon contains this customer. */
export function matchCustomer(customer: Pick<DbCustomer, "lat" | "lng">): ServiceabilityBeat[] {
  return findBeatsContainingPoint(customer.lat, customer.lng);
}

/** Group matched beats by company for display. */
export function groupByCompany(beats: ServiceabilityBeat[]): CompanyMatch[] {
  const map = new Map<string, CompanyMatch>();
  for (const b of beats) {
    let entry = map.get(b.companyId);
    if (!entry) {
      entry = { companyId: b.companyId, companyName: b.companyName, beats: [] };
      map.set(b.companyId, entry);
    }
    entry.beats.push(b);
  }
  return [...map.values()].sort((a, b) =>
    a.companyName.localeCompare(b.companyName),
  );
}

// ---- Report building ----

export interface ReportRow {
  customerId: string;
  customerName: string;
  mobile: string;
  lat: number;
  lng: number;
  /** Seller (distributor) who owns the matched beat. Empty when unknown. */
  sellerId: string;
  sellerName: string;
  companyName: string;
  beatName: string;
  /** "Monday, Wednesday" — calendar-sorted. Empty for unserviceable rows. */
  deliveryDays: string;
  /**
   * Customer ↔ seller-warehouse great-circle distance in km (2 dp).
   * Null when the beat has no seller or the seller has no lat/long.
   */
  distanceKm: number | null;
  serviceable: boolean;
}

/**
 * Resolve the owning seller for a beat — live from the seller store
 * (so a corrected seller lat/long immediately fixes distances), with
 * the name stamped on the beat as fallback for deleted sellers.
 */
function sellerInfoForBeat(
  beat: ServiceabilityBeat,
  customerLat: number,
  customerLng: number,
): { sellerName: string; distanceKm: number | null } {
  const seller = beat.sellerId ? getSellerById(beat.sellerId) : undefined;
  const sellerName = seller?.name ?? beat.sellerName ?? "";
  const distanceKm =
    seller?.latitude != null && seller?.longitude != null
      ? Number(
          haversineKm(
            customerLat,
            customerLng,
            seller.latitude,
            seller.longitude,
          ).toFixed(2),
        )
      : null;
  return { sellerName, distanceKm };
}

/**
 * Explode the roster into one row per (customer × matched beat) —
 * exactly the shape the business team pivots on. Customers matched by
 * nobody get a single "Not Serviceable" row so coverage gaps are
 * visible in the same sheet.
 */
export function buildReportRows(customers: DbCustomer[]): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const c of customers) {
    const beats = matchCustomer(c);
    if (beats.length === 0) {
      rows.push({
        customerId: c.customerId,
        customerName: c.name,
        mobile: c.mobile,
        lat: c.lat,
        lng: c.lng,
        sellerId: "",
        sellerName: "",
        companyName: "",
        beatName: "",
        deliveryDays: "",
        distanceKm: null,
        serviceable: false,
      });
      continue;
    }
    for (const b of beats) {
      const { sellerName, distanceKm } = sellerInfoForBeat(b, c.lat, c.lng);
      rows.push({
        customerId: c.customerId,
        customerName: c.name,
        mobile: c.mobile,
        lat: c.lat,
        lng: c.lng,
        sellerId: b.sellerId ?? "",
        sellerName,
        companyName: b.companyName,
        beatName: b.beatName,
        deliveryDays: sortDeliveryDays(b.deliveryDays).join(", "),
        distanceKm,
        serviceable: true,
      });
    }
  }
  return rows;
}

export const REPORT_HEADERS = [
  "Customer ID",
  "Customer Name",
  "Mobile Number",
  "Latitude",
  "Longitude",
  "Seller Name",
  "Company Name",
  "Beat Name",
  "Delivery Days",
  "Distance (km)",
  "Status",
] as const;

export function reportRowCells(r: ReportRow): (string | number)[] {
  return [
    r.customerId,
    r.customerName,
    r.mobile,
    r.lat,
    r.lng,
    r.serviceable ? r.sellerName || "—" : "—",
    r.serviceable ? r.companyName : "—",
    r.serviceable ? r.beatName : "—",
    r.serviceable ? r.deliveryDays : "—",
    r.distanceKm ?? "—",
    r.serviceable ? "Serviceable" : "Not Serviceable",
  ];
}

// ---- Downloads ----

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvEscape = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadReportCsv(rows: ReportRow[], filename: string): void {
  const lines = [
    REPORT_HEADERS.join(","),
    ...rows.map((r) => reportRowCells(r).map(csvEscape).join(",")),
  ];
  // BOM so Excel opens UTF-8 names correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, filename);
}

export async function downloadReportXlsx(
  rows: ReportRow[],
  filename: string,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Serviceability Report", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: REPORT_HEADERS[0], key: "cid", width: 16 },
    { header: REPORT_HEADERS[1], key: "name", width: 28 },
    { header: REPORT_HEADERS[2], key: "mobile", width: 16 },
    { header: REPORT_HEADERS[3], key: "lat", width: 12 },
    { header: REPORT_HEADERS[4], key: "lng", width: 12 },
    { header: REPORT_HEADERS[5], key: "seller", width: 22 },
    { header: REPORT_HEADERS[6], key: "company", width: 26 },
    { header: REPORT_HEADERS[7], key: "beat", width: 22 },
    { header: REPORT_HEADERS[8], key: "days", width: 24 },
    { header: REPORT_HEADERS[9], key: "distance", width: 14 },
    { header: REPORT_HEADERS[10], key: "status", width: 16 },
  ];
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1D4ED8" },
  };
  for (const r of rows) ws.addRow(reportRowCells(r));
  ws.autoFilter = { from: "A1", to: "K1" };
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

/** Blank upload template with the expected headers + two example rows. */
export function downloadCustomerTemplate(): void {
  const lines = [
    "Customer ID,Customer Name,Mobile Number,Latitude,Longitude",
    "CUST-0001,Sri Venkateswara Kirana,9876543210,17.4948,78.3996",
    "CUST-0002,Lakshmi General Store,9123456780,17.4326,78.4071",
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, "customer-upload-template.csv");
}

// ---- Sample data ----
//
// One-click demo roster: ~30 customers scattered around the seeded
// Hyderabad beat centres (plus a few deliberately outside every
// polygon so "Not Serviceable" rows show up in the report).

const SAMPLE_CENTRES: [string, number, number][] = [
  ["KPHB", 17.4948, 78.3996],
  ["Jubilee Hills", 17.4326, 78.4071],
  ["Ameerpet", 17.4374, 78.4487],
  ["Madhapur", 17.4483, 78.3915],
  ["Gachibowli", 17.4401, 78.3489],
  ["Kondapur", 17.4622, 78.3568],
  ["Secunderabad", 17.4399, 78.4983],
  ["Dilsukhnagar", 17.3688, 78.5247],
  ["Charminar", 17.3616, 78.4747],
  ["Miyapur", 17.5169, 78.3762],
];

const SAMPLE_NAMES = [
  "Sri Venkateswara Kirana",
  "Lakshmi General Store",
  "Balaji Super Market",
  "Annapurna Provisions",
  "Sai Durga Stores",
  "Hanuman Traders",
  "Padma Kirana & General",
  "Vijaya Departmental",
  "Ganesh Provision Store",
  "Manikanta Super Bazar",
];

export function makeSampleCustomers(count = 30): DbCustomer[] {
  const uploadedAt = new Date().toISOString();
  const rows: DbCustomer[] = [];
  for (let i = 0; i < count; i++) {
    // A few far-out points so coverage gaps show in the demo.
    const outside = i % 9 === 8;
    const [, cLat, cLng] = SAMPLE_CENTRES[i % SAMPLE_CENTRES.length];
    const jitter = () => (Math.random() - 0.5) * (outside ? 0.4 : 0.016);
    rows.push({
      id: makeCustomerRowId(),
      customerId: `CUST-${String(i + 1).padStart(4, "0")}`,
      name: `${SAMPLE_NAMES[i % SAMPLE_NAMES.length]} ${i + 1}`,
      mobile: `9${String(100000000 + Math.floor(Math.random() * 899999999))}`,
      lat: Number((cLat + jitter()).toFixed(6)),
      lng: Number((cLng + jitter()).toFixed(6)),
      uploadedAt,
    });
  }
  return rows;
}
