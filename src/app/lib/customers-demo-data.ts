// Shared store for the Customers module. The list page (customers-demo.tsx)
// and the detail page (customer-demo-detail.tsx) both read from here.
// Module-level state + a tiny publish/subscribe pattern keeps the surface
// familiar to anyone who's worked with the other mock stores.

import {
  findBeatsForCustomer,
  type ServiceabilityBeat,
} from "./serviceability-data";

/** A single (customer → company) link. Status lives here — block/unblock
 *  is done per-company, so a single customer can be Active for one company
 *  and Blocked for another (e.g. unpaid dues against one brand). */
export interface CompanyLink {
  companyId: string;
  companyName: string;
  /** Per-company status — Active / Blocked. */
  status: "Active" | "Blocked";
}

/**
 * How this customer arrived in the seller's list.
 *  - "polygon-sync"  — auto-onboarded by the backend when an admin
 *                      configured serviceability that covered this
 *                      customer's location. The customer exists in the
 *                      list before they have placed any order.
 *  - "first-order"   — legacy auto-register flow: customer landed in
 *                      the list the moment they placed their first
 *                      order against one of the seller's companies.
 */
export type CustomerOrigin = "polygon-sync" | "first-order";

/**
 * A single delivery address for a customer. A customer can have more
 * than one (main store, branch, warehouse …). Each address sits in its
 * own location, so it maps into its OWN set of serviceability beats —
 * meaning different addresses of the same customer can be served by
 * different companies and on different delivery/beat days.
 */
export interface CustomerAddress {
  id: string;
  /** Short human label — "Main Store", "Warehouse", "Branch – KPHB". */
  label: string;
  /** Free-form address line shown on the detail card. */
  fullAddress?: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  /** Lat/long power the embedded map for this address. */
  latitude: number;
  longitude: number;
  /** The customer's default delivery address. Exactly one per customer. */
  isPrimary?: boolean;
  /**
   * Per-company beat mapping for THIS address, keyed by companyId →
   * beat ids in the serviceability store. Two roles:
   *   1. The KEYS declare which companies deliver to this address — a
   *      company absent from the map has no beat covering this spot.
   *   2. The beat ids resolve live against the serviceability store, so
   *      the beat name + delivery days always reflect the admin's
   *      current polygon config (auto-derived, not copied).
   * Omit entirely to fall back to the deterministic hash picker for
   * every linked company (legacy single-address behaviour).
   */
  serviceabilityOverrides?: Record<string, string[]>;
}

export interface DemoCustomer {
  customerId: string;
  customerName: string;
  businessName: string;
  mobile: string;
  email?: string;
  /** Free-form address line, used by the detail page's Address card. */
  fullAddress?: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  /** Lat/long power the embedded map on the detail page. */
  latitude: number;
  longitude: number;
  /** Optional GSTIN — only filled for Wholesaler / Modern Trade in seed. */
  gstNumber?: string;
  totalOrders: number;
  /** Total revenue in INR — surfaced on the detail page Business card. */
  totalRevenue?: number;
  /** Companies the customer buys from. Length ≥ 1. */
  companies: CompanyLink[];
  /**
   * How the customer was onboarded. Defaults to "first-order" for the
   * legacy seed rows; new polygon-synced rows mark themselves so the
   * list page can render an "Auto-onboarded" badge.
   */
  origin?: CustomerOrigin;
  /**
   * Optional per-company serviceability bit override. Used by the
   * showcase seed to surface scenarios the deterministic hash picker
   * inside `findBitsForCustomer` can't produce — chiefly "one company,
   * multiple delivery days for the same customer". Keyed by companyId
   * and listing the bit ids the customer is mapped to.
   *
   * Applies to the customer's PRIMARY address. Per-address overrides
   * live on each `CustomerAddress` instead.
   *
   * Production wiring will swap this for point-in-polygon results.
   */
  serviceabilityOverrides?: Record<string, string[]>;
  /**
   * Delivery addresses for this customer. When present (length ≥ 1) the
   * detail page renders one entry per address, each with its own map and
   * its own company × beat-day serviceability. When omitted, the legacy
   * top-level address fields are treated as a single primary address.
   */
  addresses?: CustomerAddress[];
}

// ---------- Seed ----------

const SEED: DemoCustomer[] = [
  {
    customerId: "c1",
    customerName: "Priya Singh",
    businessName: "Sunshine Kirana",
    mobile: "+91 98765 43222",
    email: "priya.singh@sunshinekirana.in",
    fullAddress: "Shop 12, 100ft Road, Indiranagar 1st Stage",
    area: "Indiranagar",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560038",
    latitude: 12.9719,
    longitude: 77.6412,
    totalOrders: 14,
    totalRevenue: 145600,
    companies: [
      { companyId: "co-itc", companyName: "ITC Limited", status: "Active" },
      { companyId: "co-marico", companyName: "Marico", status: "Active" },
    ],
    // Sunshine Kirana sits on ITC's KPHB 1 beat — that beat is
    // configured (in Admin → Serviceability) to deliver on Monday
    // AND Tuesday, so the customer detail page surfaces both day
    // chips behind a single beat row. One beat per company is the
    // seller-side rule.
    serviceabilityOverrides: {
      "co-itc": ["beat-itc-kphb-1"],
    },
  },
  {
    customerId: "c2",
    customerName: "Lakshmi Rao",
    businessName: "Annapurna Wholesale",
    mobile: "+91 98765 43224",
    email: "lakshmi@annapurnawholesale.com",
    fullAddress: "Plot 47, Patny Centre, Secunderabad",
    area: "Secunderabad",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500003",
    latitude: 17.4399,
    longitude: 78.4983,
    gstNumber: "36ABCDE1234F1Z5",
    totalOrders: 47,
    totalRevenue: 612400,
    companies: [
      { companyId: "co-itc", companyName: "ITC Limited", status: "Active" },
    ],
    // Same company (ITC), two addresses that fall on DIFFERENT beats —
    // so the same wholesaler gets a Saturday delivery at the main shop
    // (Secunderabad beat) and a Friday delivery at the godown (Kondapur
    // beat). Demonstrates "different address → different beat day".
    addresses: [
      {
        id: "c2-addr-1",
        label: "Main Shop",
        fullAddress: "Plot 47, Patny Centre, Secunderabad",
        area: "Secunderabad",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500003",
        latitude: 17.4399,
        longitude: 78.4983,
        isPrimary: true,
        serviceabilityOverrides: { "co-itc": ["beat-itc-secunderabad"] },
      },
      {
        id: "c2-addr-2",
        label: "Godown",
        fullAddress: "Warehouse 3, Kondapur Main Road, near Botanical Garden",
        area: "Kondapur",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500084",
        latitude: 17.4622,
        longitude: 78.3568,
        serviceabilityOverrides: { "co-itc": ["beat-itc-kondapur"] },
      },
    ],
  },
  {
    customerId: "c3",
    customerName: "Ramesh Patel",
    businessName: "Patel Provision Store",
    mobile: "+91 98765 43225",
    email: "ramesh.patel@gmail.com",
    fullAddress: "Shop 4, Andheri West, near Lokhandwala Market",
    area: "Andheri West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400058",
    latitude: 19.1340,
    longitude: 72.8270,
    totalOrders: 6,
    totalRevenue: 38600,
    origin: "polygon-sync",
    companies: [
      {
        companyId: "co-freedom",
        companyName: "Gemini Edibles & Fats India",
        status: "Active",
      },
    ],
  },
  {
    customerId: "c4",
    customerName: "Suresh Kumar",
    businessName: "City Supermart",
    mobile: "+91 98765 43226",
    email: "suresh@citysupermart.in",
    fullAddress: "Plot 9, Madhapur Main Road, near Cyber Towers",
    area: "Madhapur",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    latitude: 17.4483,
    longitude: 78.3915,
    gstNumber: "36ABCDE5678G1Z9",
    totalOrders: 92,
    totalRevenue: 1480000,
    companies: [
      { companyId: "co-itc", companyName: "ITC Limited", status: "Active" },
      { companyId: "co-marico", companyName: "Marico", status: "Active" },
      {
        companyId: "co-freedom",
        companyName: "Gemini Edibles & Fats India",
        status: "Active",
      },
      { companyId: "co-adani", companyName: "Adani Wilmar Ltd", status: "Active" },
    ],
    // Multi-address showcase. City Supermart runs three locations, and
    // each one falls in a different beat — so the COMPANY set and the
    // DELIVERY DAYS differ per address:
    //   • Main Store (Madhapur)   → ITC + Gemini, both Thursday.
    //   • Branch (KPHB)           → ITC + Adani,  both Mon & Tue.
    //   • Warehouse (Jubilee Hlls)→ ITC + Adani,  both Tuesday.
    // Marico is linked but has no serviceability polygon anywhere, so it
    // shows "not served" at every address — a realistic gap the seller
    // can spot at a glance.
    addresses: [
      {
        id: "c4-addr-1",
        label: "Main Store",
        fullAddress: "Plot 9, Madhapur Main Road, near Cyber Towers",
        area: "Madhapur",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500081",
        latitude: 17.4483,
        longitude: 78.3915,
        isPrimary: true,
        serviceabilityOverrides: {
          "co-itc": ["beat-itc-madhapur"],
          "co-freedom": ["beat-gemini-madhapur"],
        },
      },
      {
        id: "c4-addr-2",
        label: "Branch – KPHB",
        fullAddress: "Shop 21, KPHB Phase 1, Kukatpally",
        area: "KPHB",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500072",
        latitude: 17.4948,
        longitude: 78.3996,
        serviceabilityOverrides: {
          "co-itc": ["beat-itc-kphb-1"],
          "co-adani": ["beat-adani-kphb-1"],
        },
      },
      {
        id: "c4-addr-3",
        label: "Warehouse",
        fullAddress: "Godown 5, Road No. 10, Jubilee Hills",
        area: "Jubilee Hills",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500033",
        latitude: 17.4326,
        longitude: 78.4071,
        serviceabilityOverrides: {
          "co-itc": ["beat-itc-jubilee-hills"],
          "co-adani": ["beat-adani-jubilee-hills"],
        },
      },
    ],
  },
  {
    customerId: "c5",
    customerName: "Anand Sharma",
    businessName: "Anand General Store",
    mobile: "+91 98765 43227",
    fullAddress: "Plot 5, Road No.12, Banjara Hills",
    area: "Banjara Hills",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500034",
    latitude: 17.4156,
    longitude: 78.4347,
    totalOrders: 3,
    totalRevenue: 12450,
    origin: "polygon-sync",
    companies: [
      { companyId: "co-itc", companyName: "ITC Limited", status: "Active" },
    ],
  },
  {
    customerId: "c6",
    customerName: "Meera Iyer",
    businessName: "Iyer's HoReCa Hub",
    mobile: "+91 98765 43228",
    email: "meera@iyershoreca.com",
    fullAddress: "5th Block, Koramangala, near Forum Mall",
    area: "Koramangala",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560034",
    latitude: 12.9352,
    longitude: 77.6245,
    totalOrders: 21,
    totalRevenue: 256000,
    companies: [
      { companyId: "co-marico", companyName: "Marico", status: "Active" },
    ],
  },
  {
    customerId: "c7",
    customerName: "Rajan Nair",
    businessName: "Coastal Trading Co.",
    mobile: "+91 98765 43229",
    email: "rajan@coastaltrading.in",
    fullAddress: "Old No. 9, T. Nagar, Pondy Bazaar",
    area: "T. Nagar",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600017",
    latitude: 13.0418,
    longitude: 80.2341,
    gstNumber: "33ABCDE9876H1Z3",
    totalOrders: 38,
    totalRevenue: 487000,
    companies: [
      {
        companyId: "co-freedom",
        companyName: "Gemini Edibles & Fats India",
        status: "Blocked",
      },
    ],
  },
];

// ---------- Module-level state with publish/subscribe ----------

let _customers: DemoCustomer[] = SEED.map((c) => ({
  ...c,
  companies: c.companies.map((co) => ({ ...co })),
}));
const subscribers = new Set<() => void>();

const notify = () => subscribers.forEach((fn) => fn());

export const getDemoCustomers = (): DemoCustomer[] => _customers;

export const getDemoCustomerById = (
  customerId: string,
): DemoCustomer | undefined => _customers.find((c) => c.customerId === customerId);

export const setDemoCustomers = (next: DemoCustomer[]) => {
  _customers = next;
  notify();
};

/** Update the status of a single company link for a single customer. */
export const setDemoCompanyStatus = (
  customerId: string,
  companyId: string,
  status: "Active" | "Blocked",
) => {
  _customers = _customers.map((c) =>
    c.customerId === customerId
      ? {
          ...c,
          companies: c.companies.map((co) =>
            co.companyId === companyId ? { ...co, status } : co,
          ),
        }
      : c,
  );
  notify();
};

export const subscribeToDemoCustomers = (cb: () => void) => {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
};

// ---------- Address helpers ----------

/**
 * Normalised address list for a customer. Returns `customer.addresses`
 * when present; otherwise synthesises a single primary address from the
 * legacy top-level fields so older single-address seed rows keep working.
 */
export const getCustomerAddresses = (c: DemoCustomer): CustomerAddress[] => {
  if (c.addresses && c.addresses.length > 0) return c.addresses;
  return [
    {
      id: `${c.customerId}-addr-1`,
      label: "Primary address",
      fullAddress: c.fullAddress,
      area: c.area,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      latitude: c.latitude,
      longitude: c.longitude,
      isPrimary: true,
      serviceabilityOverrides: c.serviceabilityOverrides,
    },
  ];
};

/** The customer's default address — the one flagged primary, else first. */
export const getPrimaryAddress = (c: DemoCustomer): CustomerAddress => {
  const list = getCustomerAddresses(c);
  return list.find((a) => a.isPrimary) ?? list[0];
};

/** Convenience — how many distinct addresses a customer has. */
export const getAddressCount = (c: DemoCustomer): number =>
  getCustomerAddresses(c).length;

/** One company's resolved beats at a specific address. */
export interface AddressCompanyServiceability extends CompanyLink {
  beats: ServiceabilityBeat[];
}

/**
 * Resolve the company × beat mapping for ONE address of a customer.
 * A company is "served" here only if a beat covers this address:
 *   • when the address carries serviceabilityOverrides, the KEYS decide
 *     which linked companies are served (and which beats resolve);
 *   • otherwise every linked company is resolved via the location hash
 *     picker (legacy single-address behaviour).
 * Linked companies with no covering beat come back in `unserved`, so the
 * detail page can flag coverage gaps (e.g. a brand with no polygon).
 */
export const getAddressServiceability = (
  c: DemoCustomer,
  address: CustomerAddress,
): { served: AddressCompanyServiceability[]; unserved: CompanyLink[] } => {
  const served: AddressCompanyServiceability[] = [];
  const unserved: CompanyLink[] = [];
  const overrides = address.serviceabilityOverrides;
  for (const co of c.companies) {
    // With explicit overrides, a company that isn't a key doesn't
    // deliver to this address — skip the hash-picker fallback for it.
    if (overrides != null && !(co.companyId in overrides)) {
      unserved.push(co);
      continue;
    }
    const beats = findBeatsForCustomer(
      {
        customerId: c.customerId,
        city: address.city,
        area: address.area,
        pincode: address.pincode,
        serviceabilityOverrides: overrides,
      },
      co.companyId,
    );
    if (beats.length === 0) unserved.push(co);
    else served.push({ ...co, beats });
  }
  return { served, unserved };
};
