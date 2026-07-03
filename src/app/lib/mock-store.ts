// localStorage-backed mock store for admin flow (pending requests, active sellers,
// seller KYC, permissions, connectors config, managed companies).
// Phase 1 is UI-only, so everything is client-side.

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

/** Selection of company + (optionally) specific brands for the seller.
 *  Empty `brandIds` means "all brands of that company". Companies/brands
 *  reference the admin-catalog data (src/app/lib/admin-catalog.ts). */
export interface CompanyBrandSelection {
  companyId: string;
  brandIds: string[];
}

/** Seller business type. Wholesaler is reserved for Phase 2. */
export type SellerType = "distributor" | "wholesaler";

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  /** Business type — defaults to "distributor" in Phase 1. */
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
  approvedAt?: string;
}

const REQUESTS_KEY = "qwipo.mock.requests";
// Bumped to v6 — v5 records carried Secunderabad lat/long for seller-1
// while every address field says Banjara Hills; v6 re-seeds so the
// Serviceability Map warehouse pin lands where the address says.
const SELLERS_KEY = "qwipo.mock.sellers.v6";

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

const SEED_SELLERS: Seller[] = [
  {
    id: "seller-1", // matches demo login
    name: "Rajesh Kumar",
    email: "seller@qwipo.com",
    phone: "9810000001",
    businessName: "ABC Distributors",
    city: "Hyderabad",
    pinCode: "500032",
    state: "Telangana",
    latitude: 17.4156,
    longitude: 78.4347,
    fullAddress: "Plot 12, Banjara Hills, near Jubilee Park",
    isActive: true,
    sellerType: "distributor",
    kyc: {
      pan: "ABCPK1234L",
      aadhaar: "XXXX-XXXX-1234",
      gstin: "36ABCPK1234L1Z9",
      bankAcct: "XXXX-XXXX-7890",
      businessAddress: "Plot 12, Banjara Hills, Hyderabad, Telangana 500034",
      status: "verified",
      updatedAt: "2026-03-15T10:00:00Z",
    },
    connectors: {
      bizom: {
        status: "connected",
        config: {
          baseUrl: "https://api.bizom.com/v1",
          authToken: "BZM-••••-••••-7890",
          apiCreateSku: "/products/create",
          apiGetAllSkus: "/products/list",
          apiUpdateSku: "/products/update/{id}",
          apiCreateOrder: "/orders/create",
          apiGetOrderDetails: "/orders/{id}",
          apiGetAllCustomers: "/customers/list",
        },
      },
      ondc: {
        status: "connected",
        config: {
          subscriberId: "abc-distributors.ondc.org",
          uniqueKeyId: "KEY-abc-001",
          privateKey: "••••••••••••••••",
          apiEndpoint: "https://ondc-gw.qwipo.com/api/v1",
          webhookUrl: "https://ondc-gw.qwipo.com/webhook/abc",
          dataSyncTypes: ["SKU", "Orders", "Customers"],
          syncFrequencyMinutes: 15,
          maxRetries: 3,
          autoRetry: true,
          autoSyncEnabled: true,
        },
      },
    },
    permissions: { view: true, write: true, edit: true, update: true },
    managedCompanies: ["itc", "hul", "nestle", "britannia", "parle"],
    // Catalog companies/brands selected when this seller was created
    companyBrandSelections: [
      { companyId: "co-freedom", brandIds: [] }, // all brands of Gemini Edibles
      { companyId: "co-itc", brandIds: ["br-aashirvaad", "br-sunfeast"] }, // 2 specific ITC brands
    ],
    approvedAt: "2026-02-10T08:00:00Z",
  },
  {
    id: "seller-2",
    name: "Sunita Rao",
    email: "sunita@quickbazaar.in",
    phone: "9810000002",
    businessName: "QuickBazaar Wholesale",
    city: "Pune",
    pinCode: "411038",
    state: "Maharashtra",
    latitude: 18.5074,
    longitude: 73.8077,
    fullAddress: "Shop 45, Kothrud Industrial Area",
    isActive: true,
    sellerType: "distributor",
    kyc: {
      pan: "SUNPR5678M",
      aadhaar: "XXXX-XXXX-5678",
      gstin: "27SUNPR5678M1Z3",
      businessAddress: "Shop 45, Kothrud, Pune, Maharashtra 411038",
      status: "submitted",
      updatedAt: "2026-03-28T14:00:00Z",
    },
    connectors: {
      bizom: {
        status: "connected",
        config: {
          baseUrl: "https://api.bizom.com/v1",
          authToken: "BZM-••••-••••-4521",
          apiCreateSku: "/products/create",
          apiGetAllSkus: "/products/list",
          apiUpdateSku: "/products/update/{id}",
          apiCreateOrder: "/orders/create",
          apiGetOrderDetails: "/orders/{id}",
          apiGetAllCustomers: "/customers/list",
        },
      },
      ondc: { status: "not_connected" },
    },
    permissions: { view: true, write: true, edit: false, update: false },
    managedCompanies: ["amul", "britannia"],
    approvedAt: "2026-03-01T10:30:00Z",
  },
  {
    id: "seller-3",
    name: "Vikram Shah",
    email: "vikram@urbankirana.in",
    phone: "9810000003",
    businessName: "Urban Kirana Stores",
    city: "Ahmedabad",
    pinCode: "380009",
    state: "Gujarat",
    latitude: 23.0395,
    longitude: 72.566,
    fullAddress: "CG Road, Navrangpura",
    isActive: true,
    sellerType: "distributor",
    kyc: { status: "not_started" },
    connectors: {
      bizom: { status: "not_connected" },
      ondc: { status: "not_connected" },
    },
    permissions: { view: true, write: false, edit: false, update: false },
    managedCompanies: [],
    approvedAt: "2026-03-20T09:15:00Z",
  },
  {
    id: "seller-4",
    name: "Meena Iyer",
    email: "meena@coastgrocers.in",
    phone: "9810000004",
    businessName: "Coast Grocers Ltd",
    city: "Chennai",
    pinCode: "600001",
    state: "Tamil Nadu",
    latitude: 13.0827,
    longitude: 80.2707,
    fullAddress: "22 Marina Road",
    isActive: true,
    sellerType: "distributor",
    kyc: {
      pan: "MEEIR9012P",
      aadhaar: "XXXX-XXXX-9012",
      gstin: "33MEEIR9012P1Z5",
      bankAcct: "XXXX-XXXX-3344",
      businessAddress: "22 Marina Road, Chennai, Tamil Nadu 600001",
      status: "verified",
      updatedAt: "2026-03-25T12:00:00Z",
    },
    connectors: {
      bizom: {
        status: "connected",
        config: {
          baseUrl: "https://api.bizom.com/v1",
          authToken: "BZM-••••-••••-9921",
          apiCreateSku: "/products/create",
          apiGetAllSkus: "/products/list",
          apiUpdateSku: "/products/update/{id}",
          apiCreateOrder: "/orders/create",
          apiGetOrderDetails: "/orders/{id}",
          apiGetAllCustomers: "/customers/list",
        },
      },
      ondc: {
        status: "connected",
        config: {
          subscriberId: "coast-grocers.ondc.org",
          uniqueKeyId: "KEY-coast-001",
          privateKey: "••••••••••••••••",
          apiEndpoint: "https://ondc-gw.qwipo.com/api/v1",
          webhookUrl: "https://ondc-gw.qwipo.com/webhook/coast",
          dataSyncTypes: ["SKU", "Orders"],
          syncFrequencyMinutes: 30,
          maxRetries: 3,
          autoRetry: true,
          autoSyncEnabled: true,
        },
      },
    },
    permissions: { view: true, write: true, edit: true, update: true },
    managedCompanies: ["itc", "dabur", "colgate", "marico"],
    approvedAt: "2026-02-22T11:00:00Z",
  },
];

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
  return writeSeller(id, (s) => ({ ...s, companyBrandSelections: selections }));
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
  sellerType?: SellerType;
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
    sellerType: input.sellerType ?? "distributor",
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
