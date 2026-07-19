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

/** Seller business type — a seller is either a distributor or a
 *  wholesaler, never both. */
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
// Bumped to v7 — the seed roster was replaced wholesale with the
// "Prod" sellers replicated from the production-parallel test portal
// (2026-07-19). v7 forces every browser to re-seed with the new list.
const SELLERS_KEY = "qwipo.mock.sellers.v7";

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

// Prod seller roster — replicated 1:1 from the production-parallel
// test portal (seller-portal.test.bms.qwipo.com) on 2026-07-19. Every
// seller whose name carries the "Prod" marker was copied with its real
// mobile, GST, address and warehouse lat/long so the local app mirrors
// the production serviceability setup.
//
// Known source-data issues (copied faithfully unless noted):
//   - LAKSHMI SAAI: the portal stores longitude = latitude
//     (17.4862465 twice). Kept verbatim — fix it in the portal, then
//     here.
//   - MAHADEVA: the portal has lat/long SWAPPED (lat 78.41, lng 17.48).
//     Un-swapped here so the warehouse pin lands in Hyderabad.

function prodSeller(input: {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  city: string;
  state: string;
  pinCode: string;
  latitude: number;
  longitude: number;
  fullAddress: string;
  gstin: string;
}): Seller {
  return {
    id: input.id,
    name: input.name,
    email: `prod-${input.phone}@qwipo.com`,
    phone: input.phone,
    businessName: input.businessName,
    city: input.city,
    pinCode: input.pinCode,
    state: input.state,
    latitude: input.latitude,
    longitude: input.longitude,
    fullAddress: input.fullAddress,
    isActive: true,
    sellerType: "distributor",
    kyc: {
      gstin: input.gstin,
      businessAddress: input.fullAddress,
      status: "verified",
      updatedAt: "2026-07-17T00:00:00Z",
    },
    connectors: {
      bizom: { status: "not_connected" },
      ondc: { status: "not_connected" },
    },
    permissions: { view: true, write: true, edit: true, update: true },
    managedCompanies: [],
    companyBrandSelections: [],
    approvedAt: "2026-07-17T00:00:00Z",
  };
}

const SEED_SELLERS: Seller[] = [
  prodSeller({
    id: "seller-prod-shalvi",
    name: "Prod Shalvi Mumbai Seller",
    businessName: "Shalvi Mumbai Seller Prod",
    phone: "7700000200",
    city: "Mumbai North West",
    state: "Maharashtra",
    pinCode: "400092",
    latitude: 19.22448,
    longitude: 72.84594,
    fullAddress:
      "Wamanrao Pai Garden, TPS Rd, Rameshwar Darshan CHS, Babhai Naka, Borivali West",
    gstin: "37AAACX1706A1ZW",
  }),
  prodSeller({
    id: "seller-prod-ss-ent",
    name: "SS Enterprises prod",
    businessName: "prod SS Enterprises",
    phone: "9999999919",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500037",
    latitude: 17.501496,
    longitude: 78.430619,
    fullAddress:
      "36-88/4, Devamma Basthi, Near Swathi Vidhya Nikethan, Jagathgiri Gutta, Hyderabad, Medchal Malkajgiri, Telangana, 500037",
    gstin: "36ARQPP4829B1ZJ",
  }),
  prodSeller({
    id: "seller-prod-ss-dist",
    name: "SS DISTRIBUTORS prod",
    businessName: "prod SS DISTRIBUTORS",
    phone: "9999999918",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500037",
    latitude: 17.501496,
    longitude: 78.430621,
    fullAddress:
      "H.No. 36-88/4, Road Number 3, Devamma Basthi, Near Swathi Vidhyanikethan, Quthbullapur, Jagathgirigutta, Hyderabad, Medchal Malkajgiri, Telangana, 500037",
    gstin: "36AFSFS1308E1ZY",
  }),
  prodSeller({
    id: "seller-prod-jai-ganesh",
    name: "Prod JAI GANESH AGENCIES",
    businessName: "JAI GANESH AGENCIES Prod",
    phone: "7700000100",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500062",
    latitude: 17.474239,
    longitude: 78.547992,
    fullAddress: "H.NO 30-265/8/83/1, Geetha nagar, road no 2, AS Rao Nagar",
    gstin: "36BBTPK2286H1Z6",
  }),
  prodSeller({
    id: "seller-prod-rm-traders",
    name: "RM Traders prod",
    businessName: "prod RM Traders",
    phone: "9999999917",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500072",
    latitude: 17.486168,
    longitude: 78.397041,
    fullAddress: "MIG-736/A, Opp. 724, KPHB, Kukatpally, Hyderabad - 500072",
    gstin: "36AFTPC7788R1Z5",
  }),
  prodSeller({
    id: "seller-prod-sai-krishna",
    name: "SHRI SAI KRISHNA TRADERS prod",
    businessName: "prod SHRI SAI KRISHNA TRADERS",
    phone: "9999999916",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500072",
    latitude: 17.496161,
    longitude: 78.41861,
    fullAddress:
      "4-35-284, PLOT NO 87,88,105,106 & 107, BALKRISHNA NAGAR, NEAR INDIAN GAS GODOWN, Kukatpally, Hyderabad, Medchal Malkajgiri, Telangana, 500072",
    gstin: "36AEEPC4773N1Z7",
  }),
  prodSeller({
    id: "seller-prod-dhhana-laxme",
    name: "Prod DHHANA LAXME ENTERPRISES",
    businessName: "DHHANA LAXME ENTERPRISES Prod",
    phone: "7700000088",
    city: "Hyderabad City",
    state: "Telangana",
    pinCode: "500038",
    latitude: 17.445655,
    longitude: 78.445282,
    fullAddress: "7-1-621/542, PLOT NO 216A, BK GUDA, SR NAGAR",
    gstin: "36AFPPV0738N1ZM",
  }),
  prodSeller({
    id: "seller-prod-sri-sarda",
    name: "SRI SARDA ENTERPRISES prod",
    businessName: "prod SRI SARDA ENTERPRISES",
    phone: "9999999915",
    city: "Hyderabad City",
    state: "Telangana",
    pinCode: "500018",
    latitude: 17.464923,
    longitude: 78.421141,
    fullAddress:
      "GROUND FLOOR, 12-7-20/52, FATIMA WAREHOUSING COMPLEX, Railway Goods Shed Road, IND Swift Ltd, Moosapet, Hyderabad, Medchal Malkajgiri, Telangana, 500018",
    gstin: "36DDQPA6260J1ZA",
  }),
  prodSeller({
    id: "seller-prod-jsv",
    name: "Prod J S V MARKETING",
    businessName: "J S V MARKETING Prod",
    phone: "7700000077",
    city: "Hyderabad City",
    state: "Telangana",
    pinCode: "500018",
    latitude: 17.451225,
    longitude: 78.448068,
    fullAddress: "7-2-590, SRT 369",
    gstin: "36AMZPP2684A1ZL",
  }),
  prodSeller({
    id: "seller-prod-yln",
    name: "Prod YLN AGENCIES",
    businessName: "YLN AGENCIES Prod",
    phone: "7700000066",
    city: "Hyderabad South East",
    state: "Telangana",
    pinCode: "500074",
    latitude: 17.338726,
    longitude: 78.55168,
    fullAddress:
      "7-4-26, Biramalguda, Saroor Nagar Mandal, Hyderabad, Rangareddy, Telangana, 500074",
    gstin: "36AABFY9700C1ZB",
  }),
  prodSeller({
    id: "seller-prod-venkateshwara",
    name: "VENKATESHWARA AGENCIES prod",
    businessName: "prod VENKATESHWARA AGENCIES",
    phone: "9999999914",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500072",
    latitude: 17.4907605,
    longitude: 78.40817,
    fullAddress:
      "HOUSE NO 5-5, BAGHAMEERI, KUKATPALLY VILLAGE, Medchal - Malkajgiri, Telangana, 500072",
    gstin: "36AOQPA0800E2ZI",
  }),
  prodSeller({
    id: "seller-prod-s-r",
    name: "S R ENTERPRISES prod",
    businessName: "prod S R ENTERPRISES",
    phone: "9999999913",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500037",
    latitude: 17.49925,
    longitude: 78.431143,
    fullAddress:
      "H.NO-36-280, Jagathgiri Gutta, Medchal Malkajgiri, Hyderabad, Telangana",
    gstin: "36DCZPA0374M1Z2",
  }),
  prodSeller({
    id: "seller-prod-chaswi",
    name: "Prod CHASWI MARKETING SOLUTIONS",
    businessName: "CHASWI MARKETING SOLUTIONS Prod",
    phone: "7700000055",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500050",
    latitude: 17.4866371,
    longitude: 78.32127,
    fullAddress:
      "HUDAFACE-2, 6-94/249, NEAR TO PJR STADIUM, CHANDANAGAR, Ranga Reddy, Telangana, 500050",
    gstin: "36ANXPV7185M1ZK",
  }),
  prodSeller({
    id: "seller-prod-internal-catalog",
    name: "Internal Catalog Seller prod",
    businessName: "prod Internal Catalog Seller",
    phone: "9999999912",
    city: "Hyderabad City",
    state: "Telangana",
    pinCode: "500081",
    latitude: 17.448294,
    longitude: 78.391487,
    fullAddress: "Flat No. 404, Aakash Enclave",
    gstin: "36AAACX1705A1ZY",
  }),
  prodSeller({
    id: "seller-prod-sahasra",
    name: "Prod SAHASRA ENTERPRISES",
    businessName: "SAHASRA ENTERPRISES Prod",
    phone: "7700000044",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500072",
    latitude: 17.505048,
    longitude: 78.414073,
    fullAddress:
      "H. No. 432-1135-A164, Phase-2, Allwyn Colony, Kukatpally, Hyderabad, Medchal Malkajgiri, Telangana - 500072",
    gstin: "36AVFPG1187N1Z9",
  }),
  // Portal stores longitude = latitude for this seller (both
  // 17.4862465) — copied verbatim; distance/map for this seller will
  // be wrong until it's corrected at the source.
  prodSeller({
    id: "seller-prod-lakshmi-saai",
    name: "Prod LAKSHMI SAAI ENTERPRISES",
    businessName: "LAKSHMI SAAI ENTERPRISES Prod",
    phone: "7700000033",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500054",
    latitude: 17.4862465,
    longitude: 17.4862465,
    fullAddress:
      "7 100/28, RAMAKRISHNA NAGAR, CHINTAL, Medchal - Malkajgiri, Telangana, 500054",
    gstin: "36AWYPV1343D1Z4",
  }),
  prodSeller({
    id: "seller-prod-vinodh",
    name: "Prod VINODH ENTERPRISES",
    businessName: "VINODH ENTERPRISES Prod",
    phone: "7700000022",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500055",
    latitude: 17.509018,
    longitude: 78.32085,
    fullAddress:
      "HUDA COLONY, 13-81/1, MIG 459, CHANDANAGAR, HYDERABAD, Ranga Reddy, Telangana, 500055",
    gstin: "36AJFPV0935P1ZK",
  }),
  prodSeller({
    id: "seller-prod-dev",
    name: "Prod DEV AGENCIES",
    businessName: "DEV AGENCIES Pros",
    phone: "7700000011",
    city: "Hyderabad City",
    state: "Telangana",
    pinCode: "500019",
    latitude: 17.5033618,
    longitude: 78.3070492,
    fullAddress:
      "H.No. 3-33/19, Venkata Reddy Colony, Taranagar, Serilingampally, Hyderabad, Ranga Reddy, Telangana - 500019",
    gstin: "36AKVPP3365L1ZA",
  }),
  prodSeller({
    id: "seller-prod-sri-sairam",
    name: "Prod Sri Sairam Enterprises",
    businessName: "Sri Sairam Enterprises Prod",
    phone: "6600000002",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500055",
    latitude: 17.488862,
    longitude: 78.412379,
    fullAddress:
      "SHOP NO 5, SWASTIK RESIDENCY, BAGH AMEER, KUKATPALLY, HYDERABAD, Medchal - Malkajgiri, Telangana",
    gstin: "36AHBPD2014R1ZH",
  }),
  // Portal has lat/long swapped for MAHADEVA (lat 78.419938,
  // lng 17.483253) — un-swapped here so the pin lands in KPHB.
  prodSeller({
    id: "seller-prod-mahadeva",
    name: "Prod MAHADEVA ENTERPRISES",
    businessName: "MAHADEVA ENTERPRISES Prod",
    phone: "6600000001",
    city: "Secunderabad",
    state: "Telangana",
    pinCode: "500072",
    latitude: 17.483253,
    longitude: 78.419938,
    fullAddress:
      "GROUND FLOOR, MIG 835, 1ST & II P, Kukatpally Main Road, KPHB Colony, Hyderabad, Medchal Malkajgiri, Telangana, 500072",
    gstin: "36AAYPD6568L1ZT",
  }),
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
