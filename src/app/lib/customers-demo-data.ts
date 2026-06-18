// Shared store for the Customers module. The list page (customers-demo.tsx)
// and the detail page (customer-demo-detail.tsx) both read from here.
// Module-level state + a tiny publish/subscribe pattern keeps the surface
// familiar to anyone who's worked with the other mock stores.

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
   * Optional serviceability beat override. Beats now live at the
   * distributor level (one area = one beat applies to all companies),
   * so this is just the list of beat ids the customer maps into.
   *
   * Production wiring will swap this for point-in-polygon results.
   */
  serviceabilityOverrides?: string[];
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
    // Sunshine Kirana sits on the KPHB 1 beat — that beat is
    // configured (in Admin → Serviceability) to deliver on Monday
    // AND Tuesday, so the customer detail page surfaces both day
    // chips behind a single beat row. Beats are distributor-level so
    // the same schedule applies to every company the customer buys
    // from (ITC + Marico here).
    serviceabilityOverrides: ["beat-kphb1"],
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
    fullAddress: "F-12 Connaught Place, Outer Circle",
    area: "Connaught Place",
    city: "Delhi",
    state: "Delhi",
    pincode: "110001",
    latitude: 28.6328,
    longitude: 77.2197,
    gstNumber: "07ABCDE5678G1Z9",
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
    // Pin City Supermart's serviceability to the Madhapur beat
    // (Thursday delivery) — this is the showcase customer for the
    // "same retailer, same day, four companies" demo. With the
    // override the customer detail's Delivery Serviceability card
    // matches the beatName carried by the four seed orders, so the
    // narrative reads end-to-end ("their one beat covers all four
    // brands they buy from").
    serviceabilityOverrides: ["beat-madhapur"],
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
