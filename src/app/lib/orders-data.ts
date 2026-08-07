// Shared orders data — the seed + a tiny store the orders list and
// the order detail page both read from.
//
// Why a shared store? Before this lib, the orders list owned the
// table data and the detail page rendered a single hard-coded
// OrderDetails mock for every order ID. Clicking any row landed
// the seller on the same "QWI-ONDC-260330-8F3K92" detail regardless of
// which row they came from. With this lib:
//
//   - The list reads from `getOrders()`.
//   - The detail page calls `getOrderDetail(orderId)` and renders
//     the right buyer / channel / status for that specific order.
//   - Status writes (confirm / cancel / mark as delivered) call
//     `updateOrderStatus(orderId, status)` and broadcast via a
//     tiny subscribe API so the list page re-renders the new
//     status without needing a reload.
//
// Phase 1 also retired the word "Rejected" — cancelled orders
// now use the consistent status name "Cancelled" across the
// whole module.

export type OrderStatus = "New" | "Confirmed" | "Delivered" | "Cancelled";

/**
 * Who initiated a cancellation. Seller cancellations originate from
 * the seller store (the bulk Cancel action on the New / Confirmed tabs
 * and the Cancel CTA on the order detail page). Buyer cancellations
 * arrive via the buyer app's ONDC /cancel call while the order is
 * still in "New" status and within the configured Cancellation Window
 * — they land here as terminal cancellations the seller didn't act on.
 *
 * The seller store surfaces the distinction so the Cancelled tab and
 * the order detail page tell the seller at a glance who pulled the
 * plug. Buyer-side cancellations carry the buyer's reason verbatim
 * from the cancel payload; seller-side cancellations carry the reason
 * the seller picked in the Cancel popup.
 */
export type CancelledBy = "Buyer" | "Seller";

/**
 * Operational delivery classification for an order. Simplified per
 * the May 2026 product call to just two values — the granular
 * Sales Beat / Non-Sales Beat split now lives on the `beatName`
 * field instead, and Next Day Delivery rolls into "Urgent".
 *
 *   - "Urgent"  — must dispatch ASAP. Express, NDD-style, or any
 *                 other priority signal. Renders with a red badge
 *                 and rides the urgent lane in the day checklist.
 *   - "Regular" — standard scheduled delivery; rides the configured
 *                 beat / route on its assigned day.
 */
export type DeliveryType = "Urgent" | "Regular";

/**
 * Whether the order rode the distributor's Sales Beat schedule or
 * was an ad-hoc / standard order.
 *
 *   - "beat"     — Sales Beat order. Lower MOV, must be placed
 *                  before the configured cut-off, lands on the
 *                  customer's serviceability delivery day.
 *   - "standard" — Non-beat. Higher MOV, no cut-off constraint.
 *
 * When absent on a seed row, fall back via {@link getOrderType} —
 * we derive Beat when `beatName` is set (the same signal the orders
 * list filter uses today).
 */
export type OrderType = "beat" | "standard";

/** Stable derivation of orderType from an order — explicit field
 *  wins, otherwise infer from `beatName`. Keep callers reading via
 *  this helper so seed data without an explicit orderType still
 *  classifies correctly. */
export function getOrderType(o: {
  orderType?: OrderType;
  beatName?: string;
}): OrderType {
  return o.orderType ?? (o.beatName ? "beat" : "standard");
}

/**
 * Which business model the order was placed under — hybrid sellers
 * fulfil both. Distribution orders are per company; wholesale orders
 * consolidate every wholesale company into one order, so the real
 * company is never shown for them (see {@link getOrderCompanyLabel}).
 */
export type OrderOperationMode = "distribution" | "wholesale";

/** Explicit field wins; every pre-hybrid order is distribution. */
export function getOrderOperationMode(o: {
  operationMode?: OrderOperationMode;
}): OrderOperationMode {
  return o.operationMode ?? "distribution";
}

/** Company shown to the seller. Wholesale orders mask the real
 *  company — list, export and detail all read "Wholesaler". */
export function getOrderCompanyLabel(o: {
  operationMode?: OrderOperationMode;
  company: string;
}): string {
  return getOrderOperationMode(o) === "wholesale" ? "Wholesaler" : o.company;
}

/**
 * The buyer-app purchase this order came from. One checkout splits
 * into several seller orders (one per distribution company + one
 * consolidated wholesale order), all stamped with the same clubbing
 * key so the seller sees them as one purchase. The key is INTERNAL
 * — never rendered anywhere (a dummy "customer order number" was
 * rejected because real order IDs come from the buyer app and a
 * fabricated one reads like a real ID). The UI shows an "N orders
 * clubbed" count instead. Orders created before clubbing fall back
 * to their own id — every order always belongs to exactly one
 * customer group.
 */
export function getCustomerOrderId(o: {
  customerOrderId?: string;
  id: string;
}): string {
  return o.customerOrderId ?? o.id;
}

/** What a customer group contains — drives the group badge. */
export type CustomerGroupKind = "distribution" | "wholesale" | "hybrid";

export function getCustomerGroupKind(
  orders: { operationMode?: OrderOperationMode }[],
): CustomerGroupKind {
  const hasDistribution = orders.some(
    (o) => getOrderOperationMode(o) === "distribution",
  );
  const hasWholesale = orders.some(
    (o) => getOrderOperationMode(o) === "wholesale",
  );
  if (hasDistribution && hasWholesale) return "hybrid";
  return hasWholesale ? "wholesale" : "distribution";
}

export interface OrderLineItem {
  skuCode: string;
  productName: string;
  /** Company that owns the product (e.g. "ITC Limited"). */
  company: string;
  brand: string;
  /** ONDC eB2B taxonomy category — surfaced on the export. */
  category: string;
  qty: number;
  originalPricePerUnit: number;
  finalPricePerUnit: number;
  discountApplied: number;
  discountDetails: string;
  lineTotal: number;
}

export interface Order {
  id: string;
  brand: string;
  /** Company that the order's primary line items map to. Displayed
   *  in the list as the second column (previously "Company / Brand"
   *  — we ship just the company now). */
  company: string;
  source: string;
  retailerName: string;
  itemsSummary: string;
  orderValue: number;
  paymentMode: "COD" | "Prepaid";
  orderDate: string;
  status: OrderStatus;
  marketplace: string;
  buyerContact?: string;
  buyerAddress?: string;
  buyerCode?: string;
  channelOrderId?: string;
  orderTime?: string;
  lineItems?: OrderLineItem[];
  /**
   * Date the seller has committed to deliver this order on
   * (YYYY-MM-DD). Becomes the primary operational reference for the
   * distributor — orders sort + bucket by this, not by orderDate.
   * For NDD the value is orderDate + 1 day.
   */
  expectedDeliveryDate: string;
  /**
   * Date the order was actually delivered (YYYY-MM-DD). Only set
   * after status transitions to "Delivered" — undefined for any
   * other status. Shown alongside `expectedDeliveryDate` in the
   * orders list so the seller can spot late deliveries at a glance.
   */
  actualDeliveryDate?: string;
  /** See `DeliveryType` for semantics. */
  deliveryType: DeliveryType;
  /** Optional beat name the order belongs to (when the order rides
   *  a configured serviceability beat). Surfaced on the badge and
   *  the detail page; orphan/ad-hoc deliveries leave this blank. */
  beatName?: string;
  /** Whether the order rode the Sales Beat schedule. Optional on
   *  seed rows — {@link getOrderType} falls back to `beatName`. */
  orderType?: OrderType;
  /**
   * Set when the seller has handed this order to the third-party
   * logistics network. The order keeps `status: "Confirmed"` — the
   * hand-off is a fulfilment route, not a new order state — but it
   * leaves the seller's Confirmed tab because the delivery is no
   * longer theirs to action. It returns to the seller's view in the
   * Delivered tab once the delivery partner closes it out.
   *
   * Only meaningful when the seller has Logistics enabled.
   */
  logisticsRequested?: boolean;
  /** When the 3PL hand-off was raised. ISO 8601. Set alongside
   *  `logisticsRequested`; shown on the in-transit strip so the
   *  seller can see how long an order has been with the partner. */
  logisticsRequestedAt?: string;
  /**
   * Reason recorded for a cancelled order. For seller-side
   * cancellations this is the option the seller picked in the Cancel
   * popup (Out of Stock / Delivery Issue / Pricing Error / Other);
   * for buyer-side cancellations this is the reason the buyer chose
   * in the buyer app, surfaced verbatim. Only meaningful when
   * `status === "Cancelled"`. Rendered in the Order Meta block + the
   * Cancellation banner on the detail page so the cancelled-tab
   * reviewer can see why each order was cancelled without re-opening
   * the activity log.
   */
  cancellationReason?: string;
  /** Who cancelled the order — see {@link CancelledBy}. Only set when
   *  `status === "Cancelled"`. Drives the status-chip variant on the
   *  orders list (amber "Cancelled by Buyer" vs red "Cancelled by
   *  Seller"), the Cancelled-By quick filters on the Cancelled tab,
   *  and the banner + meta on the detail page. */
  cancelledBy?: CancelledBy;
  /** When the cancellation was processed. ISO 8601 string. Set
   *  alongside `cancelledBy` whenever the order transitions to
   *  Cancelled, so the detail page banner and the Cancelled tab can
   *  show "Cancelled on 15 Jun 2026 at 04:32 PM" without re-reading
   *  the activity log. */
  cancellationTime?: string;
  /** GST registration number for the buyer (GSTIN). Optional — not
   *  all retailers are GST-registered. Surfaced in the Buyer section
   *  on the order detail page. */
  gstNumber?: string;
  /** Buyer's geo coordinates captured by the buyer app at order
   *  placement time. Used by the Orders → View on Map dialog to
   *  render each order's customer pin on the embedded Leaflet map.
   *  Optional — pre-API orders may not carry coords. */
  buyerLat?: number;
  buyerLng?: number;
  /** Buyer-app connectivity state at order placement — drives the
   *  Online/Offline legend on the map. "Online" pins draw blue,
   *  "Offline" pins draw orange. Defaults to "Online" when missing. */
  connectivity?: "Online" | "Offline";
  /** Business model this order was placed under. Absent on legacy
   *  rows → distribution (see {@link getOrderOperationMode}). */
  operationMode?: OrderOperationMode;
  /** Internal clubbing key stamped on every seller order that came
   *  from the same buyer-app checkout — drives the grouped orders
   *  view and the export's Clubbed Orders count. Never displayed
   *  (see {@link getCustomerOrderId}). Absent on legacy rows → the
   *  order is its own group. */
  customerOrderId?: string;
}

// One distributor for the demo seller. Populates the Seller-*
// columns on the export and the seller card on the detail page.
export const SELLER_INFO = {
  name: "ITC Private Limited",
  contact: "+91 80 2222 3333",
  code: "SELLER-ITC-001",
};

// Seed orders — the same 13 mock orders the list used to inline.
// Statuses use the new "Cancelled" wording everywhere (was
// "Rejected"); companies are derived from each order's primary
// line-item company so the list's second column has a real value.
// `expectedDeliveryDate` + `deliveryType` are tuned around the demo
// "today" (2026-05-20) so the Tomorrow / Beyond Tomorrow tabs are
// pre-populated with realistic mixes.
export const seedOrders: Order[] = [
  {
    id: "QWI-ONDC-260330-8F3K92",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana Store",
    itemsSummary: "Sunflower Oil + 5 more",
    orderValue: 12450,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    orderTime: "10:30 AM",
    // One buyer-app checkout split into three seller orders — this
    // distribution order, M3P6FH (second distribution company) and
    // WHL9F2 (consolidated wholesale) all share the customer number.
    customerOrderId: "QWI-ORD-260520-BLJ42K",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Urgent",
    beatName: "KPHB 1",
    buyerContact: "+91 98765 43210",
    buyerAddress:
      "Shop No. 12, MG Road, Koramangala, Bangalore, Karnataka - 560034",
    buyerCode: "BUYER-BAL-456",
    channelOrderId: "ONDC-ORD-789456",
    gstNumber: "29ABCDE1234F1Z5",
    lineItems: [
      {
        skuCode: "180000008",
        productName: "Freedom Refined Sunflower Oil 1L × 16",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 25,
        originalPricePerUnit: 171,
        finalPricePerUnit: 162.45,
        discountApplied: 213.75,
        discountDetails: "Slab 2: 12–47 qty • 5% off vs ₹171.00",
        lineTotal: 4061.25,
      },
      {
        skuCode: "SKU-AASH-10",
        productName: "Aashirvaad Atta 10kg",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 20,
        originalPricePerUnit: 450,
        finalPricePerUnit: 420,
        discountApplied: 600,
        discountDetails: "Slab 2: 10–24 qty • 6.67% off vs ₹450.00",
        lineTotal: 8400,
      },
      {
        skuCode: "SKU-SUNF-DF150",
        productName: "Sunfeast Biscuits Dark Fantasy 150g",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 50,
        originalPricePerUnit: 35,
        finalPricePerUnit: 35,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1750,
      },
      {
        skuCode: "SKU-CLAS-NB172",
        productName: "Classmate Notebook 172 Pages",
        company: "ITC Limited",
        brand: "Classmate",
        category: "Stationery",
        qty: 30,
        originalPricePerUnit: 45,
        finalPricePerUnit: 45,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1350,
      },
      {
        skuCode: "SKU-BING-MA90",
        productName: "Bingo Mad Angles 90g",
        company: "ITC Limited",
        brand: "Bingo",
        category: "Snacks",
        qty: 40,
        originalPricePerUnit: 20,
        finalPricePerUnit: 20,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 800,
      },
      {
        skuCode: "SKU-YIPP-240",
        productName: "Yippee Noodles 240g",
        company: "ITC Limited",
        brand: "Yippee",
        category: "Noodles",
        qty: 25,
        originalPricePerUnit: 12,
        finalPricePerUnit: 12,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 300,
      },
    ],
    orderType: "beat",
  },
  {
    id: "QWI-ONDC-260519-K2P7XR",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana",
    itemsSummary: "100 units Mixed SKUs",
    orderValue: 12450,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-BLJ7P9",
    status: "Confirmed",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "Mumbai Metro — North",
    buyerContact: "+91 98765 43211",
    orderTime: "12:20 PM",
    orderType: "beat",
    buyerCode: "BUYER-BLK-208",
    channelOrderId: "ONDC-ORD-742218",
    gstNumber: "36AAACB2894G1ZL",
  },
  // Consolidated wholesale order from the same checkout as K2P7XR —
  // every wholesale company rides ONE order, so the company is
  // masked as "Wholesaler" everywhere it renders.
  {
    id: "QWI-ONDC-260519-WHL3T7",
    brand: "Mixed",
    company: "Aachi Masala Foods",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana",
    itemsSummary: "45 units Mixed wholesale SKUs",
    orderValue: 5150,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    operationMode: "wholesale",
    customerOrderId: "QWI-ORD-260519-BLJ7P9",
    status: "Confirmed",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    buyerContact: "+91 98765 43211",
    orderTime: "12:20 PM",
    orderType: "standard",
    buyerCode: "BUYER-BLK-208",
    channelOrderId: "ONDC-ORD-742219",
    gstNumber: "36AAACB2894G1ZL",
  },
  // Consolidated wholesale order from the 8F3K92 / M3P6FH checkout —
  // completes the hybrid customer group on the New tab.
  {
    id: "QWI-ONDC-260520-WHL9F2",
    brand: "Mixed",
    company: "Sri Krupa Traders",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana Store",
    itemsSummary: "60 units Mixed wholesale SKUs",
    orderValue: 6800,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    orderTime: "10:31 AM",
    operationMode: "wholesale",
    customerOrderId: "QWI-ORD-260520-BLJ42K",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    buyerContact: "+91 98765 43210",
    buyerAddress:
      "Shop No. 12, MG Road, Koramangala, Bangalore, Karnataka - 560034",
    gstNumber: "29ABCDE1234F1Z5",
    orderType: "standard",
    buyerCode: "BUYER-BAL-456",
    channelOrderId: "ONDC-ORD-789458",
  },
  {
    id: "QWI-FLPK-260519-Q4M8YE",
    brand: "Freedom Oil",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Botery",
    retailerName: "City Supermart",
    itemsSummary: "50 units Britannia Biscuits",
    orderValue: 8750,
    paymentMode: "Prepaid",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-Q4M8YE",
    status: "Confirmed",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "Madhapur",
    buyerContact: "+91 98765 43212",
    orderTime: "11:05 AM",
    orderType: "beat",
    buyerCode: "BUYER-CSM-101",
    channelOrderId: "FLPK-ORD-518274",
    gstNumber: "36AABCC4521E1ZC",
  },
  {
    id: "QWI-AMZN-260518-V6T3HN",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Modern Retail Chain",
    itemsSummary: "200 units Maggi Noodles",
    orderValue: 24000,
    paymentMode: "Prepaid",
    orderDate: "2026-05-18",
    customerOrderId: "QWI-ORD-260518-V6T3HN",
    status: "Delivered",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-19",
    actualDeliveryDate: "2026-05-19",
    deliveryType: "Regular",
    beatName: "Pune Central",
    buyerContact: "+91 98765 43213",
    orderTime: "01:40 PM",
    orderType: "beat",
    buyerCode: "BUYER-MRC-514",
    channelOrderId: "AMZN-ORD-694105",
    gstNumber: "36AADCM8265F1ZP",
  },
  {
    id: "QWI-ONDC-260518-J5C9BD",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Botery",
    retailerName: "Quick Mart",
    itemsSummary: "30 units Aashirvaad Atta",
    orderValue: 5400,
    paymentMode: "COD",
    orderDate: "2026-05-18",
    customerOrderId: "QWI-ORD-260518-J5C9BD",
    status: "Cancelled",
    cancellationReason: "Out of Stock",
    cancelledBy: "Seller",
    cancellationTime: "2026-05-18T11:42:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-19",
    deliveryType: "Urgent",
    beatName: "Banjara Hills",
    buyerContact: "+91 98765 43214",
    orderTime: "10:55 AM",
    orderType: "beat",
    buyerCode: "BUYER-QMT-092",
    channelOrderId: "ONDC-ORD-628341",
    gstNumber: "36AAECQ1937H1ZT",
  },
  {
    id: "QWI-AMZN-260519-N7W2XK",
    brand: "Freedom Oil",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Bizom",
    retailerName: "Sunrise Traders",
    itemsSummary: "75 units Sunfeast Biscuits",
    orderValue: 6825,
    paymentMode: "Prepaid",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-N7W2XK",
    status: "Confirmed",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-22",
    deliveryType: "Regular",
    beatName: "Mumbai Metro — South",
    buyerContact: "+91 98765 43215",
    orderTime: "04:32 PM",
    orderType: "beat",
    buyerCode: "BUYER-SUN-233",
    channelOrderId: "AMZN-ORD-517296",
    gstNumber: "36AAFCS7412K1ZB",
  },
  {
    id: "QWI-ONDC-260519-R3F4PT",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "Lucky Store",
    itemsSummary: "40 units Surf Excel",
    orderValue: 9200,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-R3F4PT",
    status: "Confirmed",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-25",
    deliveryType: "Regular",
    beatName: "Ameerpet",
    buyerContact: "+91 98765 43216",
    orderTime: "12:47 PM",
    orderType: "beat",
    buyerCode: "BUYER-LKY-347",
    channelOrderId: "ONDC-ORD-806412",
    gstNumber: "36AAGCL5628M1ZD",
  },
  {
    id: "QWI-FLPK-260520-A6H8WC",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "New Era Retail",
    itemsSummary: "60 units Colgate Toothpaste",
    orderValue: 4320,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-A6H8WC",
    // Standalone wholesale order — the list masks the company as
    // "Wholesaler" and badges the row Wholesale.
    operationMode: "wholesale",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "Bengaluru East",
    buyerContact: "+91 98765 43217",
    orderTime: "09:58 AM",
    orderType: "beat",
    buyerCode: "BUYER-NER-405",
    channelOrderId: "FLPK-ORD-590148",
    gstNumber: "36AAHCN3971P1ZF",
  },
  // Demo order — shares exact lat/lng with QWI-ONDC-260330-8F3K92 so
  // "View on Map" on the New tab shows one multi-order pin (BR-3).
  {
    id: "QWI-ONDC-260520-M3P6FH",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana Store",
    itemsSummary: "30 units Aashirvaad Atta",
    orderValue: 8750,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    orderTime: "11:45 AM",
    customerOrderId: "QWI-ORD-260520-BLJ42K",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "KPHB 1",
    buyerContact: "+91 98765 43210",
    buyerCode: "BUYER-BAL-456",
    channelOrderId: "ONDC-ORD-789457",
    gstNumber: "29ABCDE1234F1Z5",
    orderType: "beat",
  },
  {
    id: "QWI-AMZN-260517-B9D2MZ",
    brand: "Freedom Oil",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Botery",
    retailerName: "Himalaya Traders",
    itemsSummary: "90 units Lizol Floor Cleaner",
    orderValue: 10800,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    customerOrderId: "QWI-ORD-260517-B9D2MZ",
    status: "Delivered",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-18",
    actualDeliveryDate: "2026-05-19",
    deliveryType: "Regular",
    beatName: "SR Nagar",
    buyerContact: "+91 98765 43218",
    orderTime: "05:22 PM",
    orderType: "beat",
    buyerCode: "BUYER-HIM-129",
    channelOrderId: "AMZN-ORD-463870",
    gstNumber: "36AAJCH6084R1ZH",
  },
  {
    id: "QWI-ONDC-260520-E5G7QY",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Anand General Store",
    itemsSummary: "120 units Tata Tea Gold",
    orderValue: 19800,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-E5G7QY",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-22",
    deliveryType: "Regular",
    beatName: "Hyderabad North",
    buyerContact: "+91 98765 43219",
    orderTime: "08:47 AM",
    orderType: "beat",
    buyerCode: "BUYER-AGS-286",
    channelOrderId: "ONDC-ORD-731529",
    gstNumber: "36AAKCA2749T1ZJ",
  },
  {
    id: "QWI-FLPK-260516-S4U8VK",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Botery",
    retailerName: "Premium Retail Pvt Ltd",
    itemsSummary: "80 units Dove Soap",
    orderValue: 6400,
    paymentMode: "COD",
    orderDate: "2026-05-16",
    customerOrderId: "QWI-ORD-260516-S4U8VK",
    status: "Delivered",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-17",
    actualDeliveryDate: "2026-05-17",
    deliveryType: "Regular",
    beatName: "Mumbai Metro — North",
    buyerContact: "+91 98765 43220",
    orderTime: "03:15 PM",
    orderType: "beat",
    buyerCode: "BUYER-PRM-058",
    channelOrderId: "FLPK-ORD-402965",
    gstNumber: "36AALCP8156V1ZL",
  },
  {
    id: "QWI-AMZN-260515-T6Y9NF",
    brand: "Freedom Oil",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Bizom",
    retailerName: "Vinayak Traders",
    itemsSummary: "45 units Ariel Detergent",
    orderValue: 13500,
    paymentMode: "Prepaid",
    orderDate: "2026-05-15",
    customerOrderId: "QWI-ORD-260515-T6Y9NF",
    status: "Cancelled",
    cancellationReason: "Pricing Error",
    cancelledBy: "Seller",
    cancellationTime: "2026-05-15T09:18:00+05:30",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-16",
    deliveryType: "Urgent",
    beatName: "Hyderabad West",
    buyerContact: "+91 98765 43221",
    orderTime: "09:05 AM",
    orderType: "beat",
    buyerCode: "BUYER-VIN-663",
    channelOrderId: "AMZN-ORD-385214",
    gstNumber: "36AAMCV4392X1ZN",
  },
  // Buyer-cancelled examples. Both arrived via the buyer app's
  // ONDC /cancel call while the order was still in "New" status —
  // the seller never confirmed them, so they land on the Cancelled
  // tab with the amber "Cancelled by Buyer" chip and the buyer's
  // own reason copy carried verbatim from the buyer app.
  {
    id: "QWI-ONDC-260520-H7L4MX",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Sai Krishna Provisions",
    itemsSummary: "20 units Sunfeast Marie Light",
    orderValue: 3600,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-H7L4MX",
    orderTime: "09:12 AM",
    status: "Cancelled",
    cancellationReason: "Ordered by mistake",
    cancelledBy: "Buyer",
    cancellationTime: "2026-05-20T09:38:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    buyerContact: "+91 98765 43222",
    channelOrderId: "ONDC-ORD-784512",
    orderType: "standard",
    buyerCode: "BUYER-SKP-174",
    gstNumber: "36AANCS9517Z1ZQ",
  },
  {
    id: "QWI-ONDC-260519-W2K8PV",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "Greenfield Mart",
    itemsSummary: "60 units Parachute Coconut Oil",
    orderValue: 8400,
    paymentMode: "Prepaid",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-W2K8PV",
    orderTime: "06:48 PM",
    status: "Cancelled",
    cancellationReason: "Found a better price elsewhere",
    cancelledBy: "Buyer",
    cancellationTime: "2026-05-19T07:14:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-22",
    deliveryType: "Regular",
    buyerContact: "+91 98765 43223",
    channelOrderId: "ONDC-ORD-861247",
    orderType: "standard",
    buyerCode: "BUYER-GFM-521",
    gstNumber: "36AAPCG6873B1ZS",
  },
  {
    id: "QWI-FLPK-260518-D9J3RE",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "Sri Lakshmi Stores",
    itemsSummary: "40 units Lay's Classic Salted",
    orderValue: 2800,
    paymentMode: "COD",
    orderDate: "2026-05-18",
    customerOrderId: "QWI-ORD-260518-D9J3RE",
    orderTime: "02:25 PM",
    status: "Cancelled",
    cancellationReason: "Delivery is too late",
    cancelledBy: "Buyer",
    cancellationTime: "2026-05-18T02:51:00+05:30",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    buyerContact: "+91 98765 43224",
    channelOrderId: "FLPK-ORD-552031",
    orderType: "standard",
    buyerCode: "BUYER-SLS-390",
    gstNumber: "36AAQCS3248D1ZU",
  },

  // ---- June 2026 workflow showcase rows ----------------------------
  // The seed below was added so the seller can demo every Confirm /
  // Confirmed workflow path side-by-side: Beat vs Standard, before
  // vs after the 5 PM cut-off, and each status (New, Confirmed,
  // Delivered, Cancelled). Without these, the original 16 rows are
  // almost entirely Beat orders, so the Beat / Non-Beat filter on the
  // Confirmed tab and the per-bucket groups in the Confirm dialog had
  // no Non-Beat side to point at.

  // [New · Beat · placed AFTER 5 PM cut-off → rolled one cycle].
  // Banjara Hills beat delivers Tuesday. Order placed Tue 19 May at
  // 6:48 PM is past the 17:00 cut-off, so the next eligible Tuesday
  // (26 May) becomes the expected date. Lets the seller demo the
  // cut-off rule without manually editing settings.
  {
    id: "QWI-ONDC-260519-X7B2QC",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Annapurna Wholesale",
    itemsSummary: "Aashirvaad Atta + Sunfeast Marie",
    orderValue: 9800,
    paymentMode: "Prepaid",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-X7B2QC",
    orderTime: "06:48 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-26",
    deliveryType: "Regular",
    beatName: "Banjara Hills",
    orderType: "beat",
    buyerContact: "+91 98765 43224",
    buyerCode: "BUYER-ANP-712",
    channelOrderId: "ONDC-ORD-987541",
    gstNumber: "36AARCA7591F1ZW",
  },

  // [New · Standard · tomorrow]. Non-beat ad-hoc — lands in the
  // Confirm dialog's "Other / Tomorrow" group with a Standard pill.
  {
    id: "QWI-ONDC-260520-P3R9KZ",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Quick Mart Express",
    itemsSummary: "30 units Parachute Coconut Oil 200ml",
    orderValue: 1680,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-P3R9KZ",
    orderTime: "11:15 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43225",
    buyerCode: "BUYER-QME-301",
    channelOrderId: "ONDC-ORD-784123",
    gstNumber: "36AASCQ1826H1ZY",
  },

  // [New · Standard · today]. Non-beat same-day request — lands in
  // the Confirm dialog's "Other" group.
  {
    id: "QWI-FLPK-260520-Y6N4HW",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Botery",
    retailerName: "City Supermart",
    itemsSummary: "24 units Pepsi Black Can 250ml",
    orderValue: 1920,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-Y6N4HW",
    orderTime: "09:30 AM",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-20",
    deliveryType: "Urgent",
    orderType: "standard",
    buyerContact: "+91 98765 43226",
    channelOrderId: "FLPK-ORD-661204",
    buyerCode: "BUYER-CSM-101",
    gstNumber: "36AABCC4521E1ZC",
  },

  // [New · Standard · beyond tomorrow]. Non-beat with a future date —
  // lands in the Confirm dialog's "Beyond Tomorrow" group.
  {
    id: "QWI-ONDC-260520-T8K1MR",
    brand: "Adani Wilmar",
    company: "Adani Wilmar Ltd",
    source: "DMS-Bizom",
    retailerName: "Patel Provision Store",
    itemsSummary: "Fortune Sunflower Oil 5L × 12",
    orderValue: 7200,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-T8K1MR",
    orderTime: "02:18 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-23",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43227",
    channelOrderId: "ONDC-ORD-451890",
    buyerCode: "BUYER-PPS-218",
    gstNumber: "36AATCP5964J1ZA",
  },

  // [Confirmed · Standard · tomorrow]. Already confirmed for
  // tomorrow — visible on the Confirmed tab when filtering Non-Beat.
  {
    id: "QWI-AMZN-260519-G4D7VX",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "Sunshine Kirana",
    itemsSummary: "20 units Saffola Honey 250g",
    orderValue: 4400,
    paymentMode: "Prepaid",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-G4D7VX",
    orderTime: "10:42 AM",
    status: "Confirmed",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43228",
    channelOrderId: "AMZN-ORD-303912",
    buyerCode: "BUYER-SSK-441",
    gstNumber: "36AAUCS2137L1ZC",
  },

  // [Confirmed · Standard · 25 May]. Future-dated non-beat — Confirmed
  // tab with date filter set to 25 May shows this only when the
  // Non-Beat filter is active.
  {
    id: "QWI-ONDC-260518-L9F6QJ",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Modern Retail Chain",
    itemsSummary: "100 units Bingo Mad Angles 90g",
    orderValue: 5200,
    paymentMode: "Prepaid",
    orderDate: "2026-05-18",
    customerOrderId: "QWI-ORD-260518-L9F6QJ",
    orderTime: "03:55 PM",
    status: "Confirmed",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-25",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43229",
    channelOrderId: "ONDC-ORD-562118",
    buyerCode: "BUYER-MRC-514",
    gstNumber: "36AADCM8265F1ZP",
  },

  // [Delivered · Standard · on time]. Non-beat delivered example —
  // anchor for "what delivered Standard orders look like" in history.
  {
    id: "QWI-AMZN-260515-Z2H5BS",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "Greenfield Mart",
    itemsSummary: "50 units Doritos Nacho Cheese",
    orderValue: 2750,
    paymentMode: "COD",
    orderDate: "2026-05-15",
    customerOrderId: "QWI-ORD-260515-Z2H5BS",
    orderTime: "11:30 AM",
    status: "Delivered",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-16",
    actualDeliveryDate: "2026-05-16",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43230",
    channelOrderId: "AMZN-ORD-770521",
    buyerCode: "BUYER-GFM-521",
    gstNumber: "36AAPCG6873B1ZS",
  },

  // ---- Same-day, same-customer, FOUR companies (showcase) ----------
  // City Supermart placed FOUR Beat orders on 2026-05-20 — one against
  // each company linked to that retailer (ITC, Marico, Gemini Edibles,
  // Adani Wilmar). All four ride the SAME distributor delivery schedule
  // (Madhapur beat, Thu 21 May), proving the June 2026 rule: one beat
  // per area applies to every company the distributor handles. Useful
  // for explaining "what changes when a 5th company is linked later"
  // without setting it up live. One purchase → one clubbing key: the
  // list shows them as a single "4 orders clubbed" row.
  {
    id: "QWI-ONDC-260520-MD9F1A",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "City Supermart",
    itemsSummary: "Aashirvaad Atta 10kg + Sunfeast Marie",
    orderValue: 8400,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-MD9F0X",
    orderTime: "10:05 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "Madhapur",
    orderType: "beat",
    buyerContact: "+91 98765 43226",
    buyerCode: "BUYER-CSM-101",
    channelOrderId: "ONDC-ORD-450201",
    gstNumber: "36AABCC4521E1ZC",
  },
  {
    id: "QWI-ONDC-260520-MD9F2B",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "City Supermart",
    itemsSummary: "30 units Parachute Coconut Oil 500ml",
    orderValue: 5400,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-MD9F0X",
    orderTime: "10:08 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "Madhapur",
    orderType: "beat",
    buyerContact: "+91 98765 43226",
    buyerCode: "BUYER-CSM-101",
    channelOrderId: "ONDC-ORD-450202",
    gstNumber: "36AABCC4521E1ZC",
  },
  {
    id: "QWI-FLPK-260520-MD9F3C",
    brand: "Freedom",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Bizom",
    retailerName: "City Supermart",
    itemsSummary: "Freedom Sunflower Oil 1L × 16",
    orderValue: 4200,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-MD9F0X",
    orderTime: "10:10 AM",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "Madhapur",
    orderType: "beat",
    buyerContact: "+91 98765 43226",
    buyerCode: "BUYER-CSM-101",
    channelOrderId: "FLPK-ORD-450203",
    gstNumber: "36AABCC4521E1ZC",
  },
  {
    id: "QWI-AMZN-260520-MD9F4D",
    brand: "Adani Wilmar",
    company: "Adani Wilmar Ltd",
    source: "DMS-Botery",
    retailerName: "City Supermart",
    itemsSummary: "Fortune Basmati Rice 5kg × 8",
    orderValue: 3600,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-MD9F0X",
    orderTime: "10:13 AM",
    status: "New",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "Madhapur",
    orderType: "beat",
    buyerContact: "+91 98765 43226",
    buyerCode: "BUYER-CSM-101",
    channelOrderId: "AMZN-ORD-450204",
    gstNumber: "36AABCC4521E1ZC",
  },

  // [Cancelled · Standard · seller-side, out of stock]. Non-beat
  // cancelled by the seller — closes the cross-product (Beat /
  // Non-Beat) × (New / Confirmed / Delivered / Cancelled) grid.
  {
    id: "QWI-ONDC-260517-A3W8EU",
    brand: "Adani Wilmar",
    company: "Adani Wilmar Ltd",
    source: "DMS-Botery",
    retailerName: "Sai Krishna Provisions",
    itemsSummary: "15 units Fortune Basmati Rice 5kg",
    orderValue: 6750,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    customerOrderId: "QWI-ORD-260517-A3W8EU",
    orderTime: "04:10 PM",
    status: "Cancelled",
    cancellationReason: "Out of Stock",
    cancelledBy: "Seller",
    cancellationTime: "2026-05-17T05:22:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-18",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43231",
    channelOrderId: "ONDC-ORD-911047",
    buyerCode: "BUYER-SKP-174",
    gstNumber: "36AANCS9517Z1ZQ",
  },];

// Hyderabad-area buyer location data per seed order — lat/lng,
// street address, and Online/Offline connectivity. Kept out of the
// main seed array so the order definitions stay focused on the
// line-item / status story; merged in below so the View on Map
// dialog has real coordinates AND human-readable addresses for the
// pin popups + the single-order View on Map link on the detail page.
// Every address is consistent with its lat/lng — the neighborhood
// name in the string matches the area the coordinates pin to.
const ORDER_GEO: Record<
  string,
  { lat: number; lng: number; address: string; connectivity: "Online" | "Offline" }
> = {
  // Cluster 1 — Hitech City / Madhapur / Gachibowli (west)
  "QWI-ONDC-260330-8F3K92": {
    lat: 17.4483,
    lng: 78.3915,
    address: "Shop 12, Cyber Towers Road, HITEC City, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  // Demo: same lat/lng as above → triggers BR-3 multi-order pin on the New tab.
  "QWI-ONDC-260520-M3P6FH": {
    lat: 17.4483,
    lng: 78.3915,
    address: "Shop 12, Cyber Towers Road, HITEC City, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  "QWI-ONDC-260519-K2P7XR": {
    lat: 17.4485,
    lng: 78.3908,
    address: "Plot 47, Inorbit Mall Road, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  "QWI-FLPK-260519-Q4M8YE": {
    lat: 17.4399,
    lng: 78.3489,
    address: "Shop 8, DLF Cyber City Road, Gachibowli, Hyderabad, Telangana 500032",
    connectivity: "Online",
  },
  // Cluster 2 — Banjara Hills / Jubilee Hills (central west)
  "QWI-AMZN-260518-V6T3HN": {
    lat: 17.4156,
    lng: 78.4347,
    address: "Shop 23, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034",
    connectivity: "Online",
  },
  "QWI-ONDC-260518-J5C9BD": {
    lat: 17.4317,
    lng: 78.4078,
    address: "Plot 5, Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033",
    connectivity: "Offline",
  },
  // Cluster 3 — Ameerpet / Begumpet (central)
  "QWI-AMZN-260519-N7W2XK": {
    lat: 17.4374,
    lng: 78.4482,
    address: "Shop 14, SR Nagar Main Road, Ameerpet, Hyderabad, Telangana 500038",
    connectivity: "Online",
  },
  "QWI-ONDC-260519-R3F4PT": {
    lat: 17.4399,
    lng: 78.4737,
    address: "Shop 9, Prakash Nagar, Begumpet, Hyderabad, Telangana 500016",
    connectivity: "Online",
  },
  // Cluster 4 — Secunderabad / Malkajgiri (north-east)
  "QWI-FLPK-260520-A6H8WC": {
    lat: 17.4399,
    lng: 78.4983,
    address: "Shop 31, S.D. Road, Secunderabad, Hyderabad, Telangana 500003",
    connectivity: "Online",
  },
  "QWI-AMZN-260517-B9D2MZ": {
    lat: 17.4485,
    lng: 78.5042,
    address: "Shop 17, Patny Centre, Secunderabad, Hyderabad, Telangana 500003",
    connectivity: "Offline",
  },
  // Cluster 5 — Kukatpally / Miyapur (north-west)
  "QWI-ONDC-260520-E5G7QY": {
    lat: 17.4849,
    lng: 78.4138,
    address: "Shop 6, KPHB Phase 4, Kukatpally, Hyderabad, Telangana 500072",
    connectivity: "Online",
  },
  "QWI-FLPK-260516-S4U8VK": {
    lat: 17.4978,
    lng: 78.3578,
    address: "Shop 22, Miyapur Main Road, Miyapur, Hyderabad, Telangana 500049",
    connectivity: "Online",
  },
  // South — Mehdipatnam
  "QWI-AMZN-260515-T6Y9NF": {
    lat: 17.3958,
    lng: 78.4358,
    address: "Shop 11, Tolichowki Junction, Mehdipatnam, Hyderabad, Telangana 500028",
    connectivity: "Online",
  },
  // Buyer-cancelled orders — clustered near existing pins so the
  // Cancelled tab's "View on Map" reads as one realistic delivery zone.
  "QWI-ONDC-260520-H7L4MX": {
    lat: 17.4188,
    lng: 78.4587,
    address: "Shop 4, Punjagutta Cross Roads, Punjagutta, Hyderabad, Telangana 500082",
    connectivity: "Online",
  },
  "QWI-ONDC-260519-W2K8PV": {
    lat: 17.4256,
    lng: 78.4521,
    address: "Plot 28, Somajiguda Circle, Somajiguda, Hyderabad, Telangana 500082",
    connectivity: "Online",
  },
  "QWI-FLPK-260518-D9J3RE": {
    lat: 17.4108,
    lng: 78.4942,
    address: "Shop 19, Tarnaka Main Road, Tarnaka, Hyderabad, Telangana 500017",
    connectivity: "Offline",
  },
  // Wholesale legs of clubbed checkouts — same shop as their
  // distribution siblings, so the map shows one multi-order pin
  // per customer purchase.
  "QWI-ONDC-260519-WHL3T7": {
    lat: 17.4485,
    lng: 78.3908,
    address: "Plot 47, Inorbit Mall Road, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  "QWI-ONDC-260520-WHL9F2": {
    lat: 17.4483,
    lng: 78.3915,
    address: "Shop 12, Cyber Towers Road, HITEC City, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  // June 2026 workflow showcase rows
  "QWI-ONDC-260519-X7B2QC": {
    lat: 17.4132,
    lng: 78.4382,
    address: "Shop 2, Road No. 10, Banjara Hills, Hyderabad, Telangana 500034",
    connectivity: "Online",
  },
  "QWI-ONDC-260520-P3R9KZ": {
    lat: 17.4622,
    lng: 78.3568,
    address: "Shop 15, Kothaguda Junction, Kondapur, Hyderabad, Telangana 500084",
    connectivity: "Online",
  },
  "QWI-ONDC-260520-T8K1MR": {
    lat: 17.4931,
    lng: 78.3216,
    address: "Shop 27, Chanda Nagar Main Road, Chanda Nagar, Hyderabad, Telangana 500050",
    connectivity: "Online",
  },
  "QWI-AMZN-260519-G4D7VX": {
    lat: 17.4022,
    lng: 78.4871,
    address: "Shop 10, Himayatnagar Main Road, Himayatnagar, Hyderabad, Telangana 500029",
    connectivity: "Online",
  },
  "QWI-ONDC-260518-L9F6QJ": {
    lat: 17.3891,
    lng: 78.4741,
    address: "Shop 44, GPO Road, Abids, Hyderabad, Telangana 500001",
    connectivity: "Offline",
  },
  // Greenfield Mart delivered order — same store as W2K8PV.
  "QWI-AMZN-260515-Z2H5BS": {
    lat: 17.4256,
    lng: 78.4521,
    address: "Plot 28, Somajiguda Circle, Somajiguda, Hyderabad, Telangana 500082",
    connectivity: "Online",
  },
  // Sai Krishna Provisions cancelled order — same store as H7L4MX.
  "QWI-ONDC-260517-A3W8EU": {
    lat: 17.4188,
    lng: 78.4587,
    address: "Shop 4, Punjagutta Cross Roads, Punjagutta, Hyderabad, Telangana 500082",
    connectivity: "Online",
  },
  // City Supermart (Madhapur branch) — the four-company clubbed
  // purchase plus the separate same-day Flipkart order all pin to
  // one storefront.
  "QWI-FLPK-260520-Y6N4HW": {
    lat: 17.4504,
    lng: 78.3937,
    address: "Shop 3, Ayyappa Society Main Road, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  "QWI-ONDC-260520-MD9F1A": {
    lat: 17.4504,
    lng: 78.3937,
    address: "Shop 3, Ayyappa Society Main Road, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  "QWI-ONDC-260520-MD9F2B": {
    lat: 17.4504,
    lng: 78.3937,
    address: "Shop 3, Ayyappa Society Main Road, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  "QWI-FLPK-260520-MD9F3C": {
    lat: 17.4504,
    lng: 78.3937,
    address: "Shop 3, Ayyappa Society Main Road, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
  "QWI-AMZN-260520-MD9F4D": {
    lat: 17.4504,
    lng: 78.3937,
    address: "Shop 3, Ayyappa Society Main Road, Madhapur, Hyderabad, Telangana 500081",
    connectivity: "Online",
  },
};

// Merge the geo data into the seed array so the View on Map dialog,
// the single-order map link on the detail page, and the popup card
// inside the embedded map all read from the same source of truth.
// `buyerAddress` is overridden so the legacy Bangalore stub on the
// first seed order can't drift away from its new Hyderabad coords.
for (let i = 0; i < seedOrders.length; i++) {
  const g = ORDER_GEO[seedOrders[i].id];
  if (g) {
    seedOrders[i] = {
      ...seedOrders[i],
      buyerLat: g.lat,
      buyerLng: g.lng,
      buyerAddress: g.address,
      connectivity: g.connectivity,
    };
  }
}

// ---- Tiny in-memory store + subscribe API ----
//
// Both pages can mutate (the list does bulk confirm / cancel /
// deliver, the detail page does single-order actions). When either
// writes, the other gets a re-render via the subscribe callback.

let _orders: Order[] = [...seedOrders];
const _listeners = new Set<() => void>();

const notify = () => {
  for (const cb of _listeners) cb();
};

export function getOrders(): Order[] {
  return _orders;
}

export function setOrders(next: Order[]) {
  _orders = next;
  notify();
}

export function getOrderById(id: string): Order | undefined {
  return _orders.find((o) => o.id === id);
}

/**
 * Update a single order's status. No-op if the id isn't found.
 * Passing `reason` + `cancelledBy` alongside a "Cancelled" status
 * persists them as `cancellationReason` / `cancelledBy` and stamps
 * `cancellationTime` to "now" so the detail page can render the
 * banner + meta. When the status flips to something OTHER than
 * "Cancelled" the previously persisted cancellation fields are
 * cleared.
 */
export function updateOrderStatus(
  id: string,
  status: OrderStatus,
  reason?: string,
  cancelledBy: CancelledBy = "Seller",
) {
  let mutated = false;
  _orders = _orders.map((o) => {
    if (o.id !== id) return o;
    mutated = true;
    return applyStatusUpdate(o, status, reason, cancelledBy);
  });
  if (mutated) notify();
}

/** Bulk variant — atomic from the subscriber's perspective. */
export function updateOrderStatuses(
  ids: string[],
  status: OrderStatus,
  reason?: string,
  cancelledBy: CancelledBy = "Seller",
) {
  const set = new Set(ids);
  let mutated = false;
  _orders = _orders.map((o) => {
    if (!set.has(o.id)) return o;
    mutated = true;
    return applyStatusUpdate(o, status, reason, cancelledBy);
  });
  if (mutated) notify();
}

/**
 * Hand a batch of confirmed orders to the third-party logistics
 * network. The orders keep `status: "Confirmed"` — from the buyer's
 * and the network's point of view nothing about the order changed,
 * only who is carrying it — but `logisticsRequested` takes them out
 * of the seller's Confirmed working list so the seller isn't asked
 * to action a delivery a partner now owns.
 *
 * Only orders currently sitting in Confirmed and not already handed
 * over are affected; anything else in `ids` is ignored. Returns the
 * number of orders actually handed over so the caller can phrase its
 * confirmation accurately.
 */
export function requestLogisticsForOrders(ids: string[]): number {
  const set = new Set(ids);
  const stamp = new Date().toISOString();
  let count = 0;
  _orders = _orders.map((o) => {
    if (!set.has(o.id)) return o;
    if (o.status !== "Confirmed" || o.logisticsRequested) return o;
    count++;
    return { ...o, logisticsRequested: true, logisticsRequestedAt: stamp };
  });
  if (count > 0) notify();
  return count;
}

/**
 * Close out orders the delivery partner has completed. This is the
 * inbound callback from the delivery-partner app via LBNP — it is
 * deliberately NOT wired to any seller-facing control, because once
 * an order is with the partner the seller has no say in when it
 * completes. Clears the in-transit flags and flips the order to
 * Delivered, which lands it in the seller's Delivered tab.
 */
export function completeLogisticsOrders(ids: string[]): number {
  const set = new Set(ids);
  let count = 0;
  _orders = _orders.map((o) => {
    if (!set.has(o.id) || !o.logisticsRequested) return o;
    count++;
    const { logisticsRequested: _lr, logisticsRequestedAt: _la, ...rest } = o;
    void _lr;
    void _la;
    return {
      ...rest,
      status: "Delivered" as const,
      actualDeliveryDate: o.actualDeliveryDate ?? DEMO_TODAY,
    };
  });
  if (count > 0) notify();
  return count;
}

/** Every order currently out with the logistics partner. */
export function getLogisticsInTransitOrders(): Order[] {
  return _orders.filter((o) => o.logisticsRequested && o.status === "Confirmed");
}

/** Status-write helper — single source of truth for the cancellation
 *  side-effects AND the actualDeliveryDate stamp.
 *   - Cancelled + reason → persist reason, cancelledBy and a fresh
 *     cancellationTime; any non-Cancelled write wipes stale
 *     cancellation fields so a re-opened-then-fulfilled order doesn't
 *     carry stale labels.
 *   - Delivered writes stamp today's date as the actualDeliveryDate
 *     (if not already set) so the orders list can show the seller
 *     exactly when each order shipped. Reverting away from Delivered
 *     wipes the stamp. */
function applyStatusUpdate(
  o: Order,
  status: OrderStatus,
  reason?: string,
  cancelledBy: CancelledBy = "Seller",
): Order {
  if (status === "Cancelled") {
    const next: Order = {
      ...o,
      status,
      cancelledBy,
      cancellationTime: new Date().toISOString(),
    };
    if (reason !== undefined) next.cancellationReason = reason;
    return next;
  }
  // Any non-Cancelled write clears previously persisted cancellation
  // fields so a re-opened-then-fulfilled order doesn't carry stale labels.
  const {
    cancellationReason: _r,
    cancelledBy: _b,
    cancellationTime: _t,
    ...rest
  } = o;
  void _r;
  void _b;
  void _t;
  if (status === "Delivered") {
    return {
      ...rest,
      status,
      actualDeliveryDate: o.actualDeliveryDate ?? DEMO_TODAY,
    };
  }
  // Reverting away from Delivered (e.g. re-opening) wipes the stamp.
  if (o.actualDeliveryDate !== undefined) {
    const { actualDeliveryDate: _dropAct, ...withoutAct } = rest;
    void _dropAct;
    return { ...withoutAct, status };
  }
  return { ...rest, status };
}

export function subscribeToOrders(cb: () => void): () => void {
  _listeners.add(cb);
  return () => {
    _listeners.delete(cb);
  };
}

// ---- Delivery-bucket helpers ----
//
// "Today" is what the user is looking at right now. Hard-coding a
// demo-day baseline keeps the seed data and the bucketing logic in
// sync across screens — there's no live clock to chase. Override via
// `OVERRIDE_TODAY` if you ever need a different anchor for QA.

const DEMO_TODAY = "2026-05-20";

/** Resolve "today" for the orders module. */
export function getOrdersToday(): string {
  return DEMO_TODAY;
}

/** Add `n` days to a YYYY-MM-DD string. Returns YYYY-MM-DD. Parses
 *  and serialises in UTC so the result doesn't drift across the
 *  client's timezone boundary. */
function addDays(iso: string, n: number): string {
  const t = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(t)) return iso;
  return new Date(t + n * 86400000).toISOString().slice(0, 10);
}

export type DeliveryBucket = "past" | "today" | "tomorrow" | "beyond";

/**
 * Classify an order's expected delivery date relative to today.
 * - past     — already overdue (operationally needs cleanup)
 * - today    — must dispatch / deliver today
 * - tomorrow — primary "Tomorrow Deliveries" bucket
 * - beyond   — anything dated after tomorrow
 */
export function getDeliveryBucket(order: Order): DeliveryBucket {
  const today = getOrdersToday();
  const tomorrow = addDays(today, 1);
  if (order.expectedDeliveryDate < today) return "past";
  if (order.expectedDeliveryDate === today) return "today";
  if (order.expectedDeliveryDate === tomorrow) return "tomorrow";
  return "beyond";
}

/**
 * Confirm-eligibility gate. Sellers can confirm orders whose committed
 * Delivery Day is today, tomorrow, or in the past — anything two or
 * more days out has to wait until the day-before window. Keeps the
 * dispatch desk from over-committing on routes that may still shift.
 *
 * Rule lives here so the bulk list, the single-order detail page, and
 * any future automation share the same definition.
 */
export function isConfirmableDeliveryDay(iso: string): boolean {
  const today = getOrdersToday();
  const tomorrow = addDays(today, 1);
  return iso <= tomorrow;
}

/** Day-of-week label for a YYYY-MM-DD date. Used by the
 *  "Friday Delivery" / "Monday Delivery" callouts on the row. */
export function dayOfWeekLabel(iso: string): string {
  const t = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(t)) return iso;
  // Render in UTC so the weekday matches the date string regardless
  // of the user's local timezone.
  return new Date(t).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/**
 * Human-friendly compound label combining the bucket + the delivery
 * type. Rewritten alongside the May 2026 Urgent / Regular collapse —
 * Urgent always reads as "Urgent" regardless of bucket; Regular
 * surfaces the bucket name (Tomorrow / Today / weekday).
 */
export function deliveryLabelFor(order: Order): string {
  const bucket = getDeliveryBucket(order);
  if (order.deliveryType === "Urgent") return "Urgent";
  if (bucket === "tomorrow") return "Tomorrow – Regular";
  if (bucket === "today") return "Today – Regular";
  if (bucket === "past") return "Overdue – Regular";
  // Beyond: surface the weekday so distributors can scan workload.
  return `${dayOfWeekLabel(order.expectedDeliveryDate)} Delivery`;
}

// ---- Synthesizer for the detail page ----
//
// OrderDetail wants a richer shape than the list row. For the seed
// "QWI-ONDC-260330-8F3K92" we have full line items in the seed; for every
// other order we synthesize a single-line products array from the
// itemsSummary string so the products table has something to show.
// In production this would be a real lookup against the backend.

export interface SynthesizedOrderProduct {
  id: string;
  name: string;
  skuId: string;
  orderedQuantity: number;
  availableStock: number;
  pricePerUnit: number;
  totalPrice: number;
  basePrice?: number;
}

/** Build the order-detail shape from a list `Order`. The caller
 *  (order-detail.tsx) supplies the rich line items for orders we
 *  have full mock data for; for the rest we synthesise a single
 *  line from itemsSummary so the products table isn't empty. */
export function synthesizeProducts(
  order: Order,
): SynthesizedOrderProduct[] {
  // Use line items when present (real export-grade detail).
  if (order.lineItems && order.lineItems.length > 0) {
    return order.lineItems.map((li, idx) => ({
      id: String(idx + 1),
      name: li.productName,
      skuId: li.skuCode,
      orderedQuantity: li.qty,
      availableStock: Math.max(li.qty * 2, 50),
      basePrice: li.originalPricePerUnit,
      pricePerUnit: li.finalPricePerUnit,
      totalPrice: li.lineTotal,
    }));
  }

  // Fallback — derive a placeholder line item from the itemsSummary
  // string. The summary follows a "<qty> units <name>" / "Sunflower
  // Oil + N more" shape; we strip the suffix and approximate the
  // unit price from orderValue / qty.
  const summary = order.itemsSummary;
  const m = /^(\d+)\s+units\s+(.+)$/i.exec(summary);
  const qty = m ? Number(m[1]) : 1;
  const name = m ? m[2] : summary;
  const ppu = qty > 0 ? +(order.orderValue / qty).toFixed(2) : order.orderValue;
  return [
    {
      id: "1",
      name,
      skuId: `${order.id}-LINE-1`,
      orderedQuantity: qty,
      availableStock: qty * 2,
      basePrice: ppu,
      pricePerUnit: ppu,
      totalPrice: order.orderValue,
    },
  ];
}
