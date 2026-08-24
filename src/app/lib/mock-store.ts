// localStorage-backed mock store for admin flow (pending requests, active sellers,
// seller KYC, permissions, connectors config, managed companies).
// Phase 1 is UI-only, so everything is client-side.

import { PROD_REPLICA_SELLERS } from "./prod-replica-sellers-seed";
import { getCompanies } from "./admin-catalog";
import type { DeliveryDay } from "./customers-data";

export type RequestStatus = "pending" | "approved" | "rejected";

export interface SellerRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  city: string;
  submittedAt: string; // ISO
  status: RequestStatus;
}

export type KycStatus = "not_started" | "submitted" | "verified";

export interface SellerKyc {
  pan?: string;
  aadhaar?: string;
  gstin?: string;
  bankAcct?: string;
  businessAddress?: string;
  status: KycStatus;
  updatedAt?: string;
}

// ---- Connector configs ----

export interface BizomConfig {
  baseUrl: string;
  authToken: string;
  apiCreateSku: string;
  apiGetAllSkus: string;
  apiUpdateSku: string;
  apiCreateOrder: string;
  apiGetOrderDetails: string;
  apiGetAllCustomers: string;
}

export interface OndcConfig {
  subscriberId: string;
  uniqueKeyId: string;
  privateKey: string;
  apiEndpoint: string;
  webhookUrl: string;
  dataSyncTypes: string[]; // e.g. ["SKU", "Orders", "Customers"]
  syncFrequencyMinutes: number;
  maxRetries: number;
  autoRetry: boolean;
  autoSyncEnabled: boolean;
}

export type ConnectorStatus = "connected" | "not_connected";

export interface ConnectorState<T> {
  status: ConnectorStatus;
  config?: T;
}

export interface SellerConnectors {
  bizom: ConnectorState<BizomConfig>;
  ondc: ConnectorState<OndcConfig>;
}

export type ConnectorType = "bizom" | "ondc";

// ---- Managed Companies ----

export interface ManagedCompany {
  id: string;
  name: string;
  category: string;
}

export const QWIPO_COMPANIES: ManagedCompany[] = [
  { id: "itc", name: "ITC Limited", category: "FMCG" },
  { id: "hul", name: "Hindustan Unilever", category: "FMCG" },
  { id: "nestle", name: "Nestlé India", category: "Food & Beverages" },
  { id: "britannia", name: "Britannia Industries", category: "Biscuits & Bakery" },
  { id: "parle", name: "Parle Products", category: "Biscuits & Confectionery" },
  { id: "amul", name: "Amul", category: "Dairy" },
  { id: "dabur", name: "Dabur India", category: "Health & Ayurveda" },
  { id: "colgate", name: "Colgate-Palmolive", category: "Personal Care" },
  { id: "marico", name: "Marico", category: "Personal Care" },
  { id: "godrej", name: "Godrej Consumer", category: "Home & Personal Care" },
  { id: "mondelez", name: "Mondelez India", category: "Confectionery" },
  { id: "pepsico", name: "PepsiCo India", category: "Beverages & Snacks" },
];

export function getQwipoCompanies(): ManagedCompany[] {
  return QWIPO_COMPANIES;
}

// ---- Seller ----

export interface SellerPermissions {
  view: boolean;
  write: boolean;
  edit: boolean;
  update: boolean;
}

/** How the seller operates for ONE linked company. Chosen while
 *  linking the company; each linked company carries its own mode. */
export type OperationMode = "distributor" | "wholesaler";

/** Selection of company + (optionally) specific brands for the seller.
 *  Empty `brandIds` means "all brands of that company". Companies/brands
 *  reference the admin-catalog data (src/app/lib/admin-catalog.ts). */
export interface CompanyBrandSelection {
  companyId: string;
  brandIds: string[];
  /** Distributor or Wholesaler for THIS company. Legacy records that
   *  predate the field are treated as "distributor". */
  operationMode?: OperationMode;
}

/** Seller business type — no longer chosen manually. Calculated from
 *  the operation modes of the linked companies: all distributor →
 *  "distributor", all wholesaler → "wholesaler", a mix → "hybrid". */
export type SellerType = "distributor" | "wholesaler" | "hybrid";

/**
 * Calculate the seller type from company mappings. Sellers with no
 * linked companies fall back to their stored type (legacy records) or
 * "distributor".
 */
export function deriveSellerType(
  seller: Pick<Seller, "companyBrandSelections" | "sellerType">,
): SellerType {
  const selections = seller.companyBrandSelections ?? [];
  if (selections.length === 0) return seller.sellerType ?? "distributor";
  const hasDistributor = selections.some(
    (s) => (s.operationMode ?? "distributor") === "distributor",
  );
  const hasWholesaler = selections.some(
    (s) => s.operationMode === "wholesaler",
  );
  if (hasDistributor && hasWholesaler) return "hybrid";
  return hasWholesaler ? "wholesaler" : "distributor";
}

/** One wholesaler delivery polygon. A seller can hold SEVERAL — e.g.
 *  one zone for Monday, another for Tuesday — but none is company-
 *  specific: every polygon applies to EVERY company mapped as
 *  Wholesaler, including companies linked later. */
export interface WholesalerPolygon {
  id: string;
  fileName: string;
  data?: unknown;
  updatedAt: string; // ISO
  /** Beat name for this zone — same idea as a distributor beat, but
   *  unique per SELLER (not per company), since a wholesale zone is
   *  never company-specific. Optional only so zones saved before beat
   *  names existed still load; the dialog requires one on every save. */
  beatName?: string;
  /** Days this zone is served on — picked in the Add Wholesale Beat
   *  dialog (beat name + days + polygon; no company). */
  deliveryDays?: DeliveryDay[];
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  /** Business type — CALCULATED from linked-company operation modes
   *  (see deriveSellerType). Kept on the record so list surfaces don't
   *  recompute, and as the fallback for sellers with no linked
   *  companies. Never edited manually. */
  sellerType?: SellerType;
  city: string;
  /** Structured address fields captured during seller creation. PIN drives
   *  city/state via the offline lookup; lat-long are required for map views. */
  pinCode?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  /** Free-text street/area/landmark description. */
  fullAddress?: string;
  /** Optional avatar image (blob: or http(s) URL) */
  imageUrl?: string | null;
  /** Active flag — when false the seller cannot log in or be assigned new
   *  companies. Defaults to true. */
  isActive?: boolean;
  kyc: SellerKyc;
  connectors: SellerConnectors;
  permissions: SellerPermissions;
  managedCompanies: string[]; // legacy Qwipo company ids
  /** Companies & brands attached to this seller (added via Add Seller flow) */
  companyBrandSelections?: CompanyBrandSelection[];
  /** Legacy single polygon — superseded by wholesalerPolygons; kept
   *  so records saved before the multi-polygon change still load. */
  wholesalerPolygon?: WholesalerPolygon | null;
  /** Day-wise wholesaler zones. Each applies to ALL wholesaler-mode
   *  companies; uploaded from the Delivery Beats – Wholesaler section. */
  wholesalerPolygons?: WholesalerPolygon[];
  approvedAt?: string;
}

const REQUESTS_KEY = "qwipo.mock.requests";
// Bumped to v8 — the roster is now the exact production replica
// (real seller names + mobile numbers from seller-portal.bms.qwipo.com,
// captured 2026-07-24; see prod-replica-sellers-seed.ts). v8 forces
// every browser to re-seed with the new list.
// v9 (2026-07-30): production roster refresh — 4 new sellers (Banjara,
// SKM, Balaji Trading, Silpatwal), CHASWI re-activated, Lakshmi Saai
// deactivated.
// v11 (2026-08-24): added a demo "Test Seller" linked to every company in
// the master catalog to showcase company/brand preference ordering.
const SELLERS_KEY = "qwipo.mock.sellers.v11";

// ---- Default factory helpers ----

export function emptyBizomConfig(): BizomConfig {
  return {
    baseUrl: "",
    authToken: "",
    apiCreateSku: "",
    apiGetAllSkus: "",
    apiUpdateSku: "",
    apiCreateOrder: "",
    apiGetOrderDetails: "",
    apiGetAllCustomers: "",
  };
}

export function emptyOndcConfig(): OndcConfig {
  return {
    subscriberId: "",
    uniqueKeyId: "",
    privateKey: "",
    apiEndpoint: "",
    webhookUrl: "",
    dataSyncTypes: [],
    syncFrequencyMinutes: 15,
    maxRetries: 3,
    autoRetry: true,
    autoSyncEnabled: true,
  };
}

// ---- Seeds ----

const SEED_REQUESTS: SellerRequest[] = [
  {
    id: "req-001",
    name: "Anil Sharma",
    email: "anil@freshmart.in",
    phone: "9812345671",
    businessName: "FreshMart Distributors",
    city: "Mumbai",
    submittedAt: "2026-04-07T09:12:00Z",
    status: "pending",
  },
  {
    id: "req-002",
    name: "Priya Nair",
    email: "priya@southstore.in",
    phone: "9812345672",
    businessName: "SouthStore Wholesale",
    city: "Bengaluru",
    submittedAt: "2026-04-08T11:45:00Z",
    status: "pending",
  },
  {
    id: "req-003",
    name: "Mohit Verma",
    email: "mohit@capitalretail.in",
    phone: "9812345673",
    businessName: "Capital Retail Hub",
    city: "Delhi",
    submittedAt: "2026-04-08T16:30:00Z",
    status: "pending",
  },
];

// Prod seller roster — exact replica of production
// (seller-portal.bms.qwipo.com) captured 2026-07-24. Real names,
// mobile numbers, GST, addresses and warehouse lat/long live in the
// generated module prod-replica-sellers-seed.ts (rebuild it with
// build-prod-replica-seed.cjs at the repo root).
// Demo seller linked to EVERY company in the master catalog — used to
// showcase company/brand preference ordering (drag-to-reorder). Based on a
// real replica seller so its KYC/connector/permission shape stays valid;
// identity, address and company links are overridden.
const TEST_SELLER: Seller = {
  ...PROD_REPLICA_SELLERS[0],
  id: "seller-test-all",
  name: "Test Seller",
  businessName: "Test Distributors",
  email: "test.seller@qwipo.com",
  phone: "9000000009",
  city: "Hyderabad",
  pinCode: "500001",
  state: "Telangana",
  latitude: 17.385,
  longitude: 78.4867,
  fullAddress: "Plot 1, Test Nagar, Hyderabad, Telangana, 500001",
  imageUrl: null,
  isActive: true,
  managedCompanies: [],
  wholesalerPolygon: null,
  wholesalerPolygons: [],
  companyBrandSelections: getCompanies().map((c) => ({
    companyId: c.id,
    brandIds: [] as string[],
    operationMode: "distributor" as OperationMode,
  })),
};

const SEED_SELLERS: Seller[] = [TEST_SELLER, ...PROD_REPLICA_SELLERS];



// ---- Internal helpers ----

function read<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as T;
  } catch {
    return seed;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

// ---- Public API: Requests ----

export function getRequests(): SellerRequest[] {
  return read<SellerRequest[]>(REQUESTS_KEY, SEED_REQUESTS);
}

export function getPendingRequests(): SellerRequest[] {
  return getRequests().filter((r) => r.status === "pending");
}

export function addRequest(
  input: Omit<SellerRequest, "id" | "submittedAt" | "status">,
): SellerRequest {
  const newReq: SellerRequest = {
    ...input,
    id: makeId("req"),
    submittedAt: new Date().toISOString(),
    status: "pending",
  };
  const all = getRequests();
  write(REQUESTS_KEY, [newReq, ...all]);
  return newReq;
}

export function approveRequest(id: string): Seller | null {
  const all = getRequests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const req = all[idx];
  if (req.status !== "pending") return null;
  all[idx] = { ...req, status: "approved" };
  write(REQUESTS_KEY, all);

  // Also create an active seller record
  const newSeller: Seller = {
    id: makeId("seller"),
    name: req.name,
    email: req.email,
    phone: req.phone,
    businessName: req.businessName,
    city: req.city,
    kyc: { status: "not_started" },
    connectors: {
      bizom: { status: "not_connected" },
      ondc: { status: "not_connected" },
    },
    permissions: { view: true, write: false, edit: false, update: false },
    managedCompanies: [],
    approvedAt: new Date().toISOString(),
  };
  const sellers = getSellers();
  write(SELLERS_KEY, [newSeller, ...sellers]);
  return newSeller;
}

export function rejectRequest(id: string): boolean {
  const all = getRequests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  if (all[idx].status !== "pending") return false;
  all[idx] = { ...all[idx], status: "rejected" };
  write(REQUESTS_KEY, all);
  return true;
}

// ---- Public API: Sellers ----

export function getSellers(): Seller[] {
  return read<Seller[]>(SELLERS_KEY, SEED_SELLERS);
}

export function getSellerById(id: string): Seller | undefined {
  return getSellers().find((s) => s.id === id);
}

export function getSellerByEmail(email: string): Seller | undefined {
  const normalized = email.trim().toLowerCase();
  return getSellers().find((s) => s.email.toLowerCase() === normalized);
}

function writeSeller(id: string, update: (s: Seller) => Seller): Seller | null {
  const all = getSellers();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  all[idx] = update(all[idx]);
  write(SELLERS_KEY, all);
  return all[idx];
}

export function updateSellerProfile(
  id: string,
  profile: Pick<Seller, "name" | "email" | "phone" | "businessName" | "city">,
): Seller | null {
  return writeSeller(id, (s) => ({ ...s, ...profile }));
}

export function updateSellerPermissions(
  id: string,
  permissions: SellerPermissions,
): Seller | null {
  return writeSeller(id, (s) => ({ ...s, permissions }));
}

export function updateSellerKyc(
  id: string,
  kyc: Omit<SellerKyc, "status" | "updatedAt">,
): Seller | null {
  return writeSeller(id, (s) => ({
    ...s,
    kyc: {
      ...kyc,
      status: "submitted",
      updatedAt: new Date().toISOString(),
    },
  }));
}

// ---- Connectors ----

export function updateSellerBizomConfig(
  id: string,
  config: BizomConfig,
): Seller | null {
  return writeSeller(id, (s) => ({
    ...s,
    connectors: {
      ...s.connectors,
      bizom: { status: "connected", config },
    },
  }));
}

export function updateSellerOndcConfig(
  id: string,
  config: OndcConfig,
): Seller | null {
  return writeSeller(id, (s) => ({
    ...s,
    connectors: {
      ...s.connectors,
      ondc: { status: "connected", config },
    },
  }));
}

export function disconnectSellerConnector(
  id: string,
  type: ConnectorType,
): Seller | null {
  return writeSeller(id, (s) => ({
    ...s,
    connectors: {
      ...s.connectors,
      [type]: { status: "not_connected" },
    },
  }));
}

// ---- Managed Companies ----

export function updateManagedCompanies(
  id: string,
  companyIds: string[],
): Seller | null {
  // Dedupe and keep only valid ids
  const validIds = new Set(QWIPO_COMPANIES.map((c) => c.id));
  const deduped = Array.from(new Set(companyIds)).filter((cid) =>
    validIds.has(cid),
  );
  return writeSeller(id, (s) => ({ ...s, managedCompanies: deduped }));
}

// ---- Seller image ----

export function updateSellerImage(
  id: string,
  imageUrl: string | null,
): Seller | null {
  return writeSeller(id, (s) => ({ ...s, imageUrl }));
}

// ---- Seller company / brand selections (admin-catalog) ----

export function updateCompanyBrandSelections(
  id: string,
  selections: CompanyBrandSelection[],
): Seller | null {
  // Seller type follows the company mappings automatically — every
  // write recalculates it so the profile never needs manual upkeep.
  return writeSeller(id, (s) => {
    const next = { ...s, companyBrandSelections: selections };
    return { ...next, sellerType: deriveSellerType(next) };
  });
}

// ---- Wholesaler serviceability polygons (day-wise, seller-wide) ----

/** Read a seller's wholesaler zones, folding a legacy single-polygon
 *  record (pre multi-polygon) into the array shape. */
export function getSellerWholesalerPolygons(
  seller: Pick<Seller, "wholesalerPolygon" | "wholesalerPolygons">,
): WholesalerPolygon[] {
  if (seller.wholesalerPolygons) return seller.wholesalerPolygons;
  if (seller.wholesalerPolygon)
    return [{ id: "wp-legacy", ...seller.wholesalerPolygon }];
  return [];
}

export function makeWholesalerPolygonId(): string {
  return `wp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Add or replace one wholesaler polygon (matched by id). Clears the
 *  legacy single-polygon field by migrating it into the array first. */
export function upsertSellerWholesalerPolygon(
  id: string,
  polygon: WholesalerPolygon,
): Seller | null {
  return writeSeller(id, (s) => {
    const list = getSellerWholesalerPolygons(s);
    const exists = list.some((p) => p.id === polygon.id);
    const next = exists
      ? list.map((p) => (p.id === polygon.id ? polygon : p))
      : [...list, polygon];
    return { ...s, wholesalerPolygon: null, wholesalerPolygons: next };
  });
}

export function removeSellerWholesalerPolygon(
  id: string,
  polygonId: string,
): Seller | null {
  return writeSeller(id, (s) => ({
    ...s,
    wholesalerPolygon: null,
    wholesalerPolygons: getSellerWholesalerPolygons(s).filter(
      (p) => p.id !== polygonId,
    ),
  }));
}

/** Delete every wholesaler zone — the card-level trash action. */
export function clearSellerWholesalerPolygons(id: string): Seller | null {
  return writeSeller(id, (s) => ({
    ...s,
    wholesalerPolygon: null,
    wholesalerPolygons: [],
  }));
}

// Toggle a seller's active flag. Inactive sellers cannot log in or have new
// companies linked to them by the admin.
export function updateSellerActive(id: string, isActive: boolean): Seller | null {
  return writeSeller(id, (s) => ({ ...s, isActive }));
}

// Create a new seller directly (used by Add Seller flow). Returns the
// inserted seller record.
export function addSeller(input: {
  name: string;
  email?: string;
  phone: string;
  businessName: string;
  city: string;
  pinCode?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  fullAddress?: string;
  imageUrl?: string | null;
  companyBrandSelections?: CompanyBrandSelection[];
}): Seller {
  const newSeller: Seller = {
    id: makeId("seller"),
    name: input.name,
    email: input.email ?? "",
    phone: input.phone,
    businessName: input.businessName,
    city: input.city,
    pinCode: input.pinCode,
    state: input.state,
    latitude: input.latitude,
    longitude: input.longitude,
    fullAddress: input.fullAddress,
    imageUrl: input.imageUrl ?? null,
    isActive: true,
    // Never chosen manually — calculated from the linked companies'
    // operation modes.
    sellerType: deriveSellerType({
      companyBrandSelections: input.companyBrandSelections,
    }),
    kyc: { status: "not_started" },
    connectors: {
      bizom: { status: "not_connected", config: emptyBizomConfig() },
      ondc: { status: "not_connected", config: emptyOndcConfig() },
    },
    permissions: { view: true, write: false, edit: false, update: false },
    managedCompanies: [],
    companyBrandSelections: input.companyBrandSelections,
    approvedAt: new Date().toISOString(),
  };
  const sellers = getSellers();
  write(SELLERS_KEY, [newSeller, ...sellers]);
  return newSeller;
}

// Force-reset (useful when testing)
export function resetMockStore() {
  localStorage.removeItem(REQUESTS_KEY);
  localStorage.removeItem(SELLERS_KEY);
}

/**
 * Switch persisted mock data between the demo seed and an empty state.
 * Used by the empty-mode super-admin login to render inception-day screens.
 *
 * "demo" → re-seed both keys with SEED_REQUESTS / SEED_SELLERS.
 * "empty" → write empty arrays so getSellers() / getRequests() return [].
 */
export function applyDataMode(mode: "demo" | "empty") {
  try {
    if (mode === "empty") {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify([]));
      localStorage.setItem(SELLERS_KEY, JSON.stringify([]));
    } else {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(SEED_REQUESTS));
      localStorage.setItem(SELLERS_KEY, JSON.stringify(SEED_SELLERS));
    }
  } catch {
    /* localStorage may be unavailable in SSR — silent no-op */
  }
}
