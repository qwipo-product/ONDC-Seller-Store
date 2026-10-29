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

import { getDemoCustomers } from "./customers-demo-data";

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
  /** Short Name from the SKU master, when the SKU has one. */
  shortName?: string;
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

/**
 * A seller-side quantity change on one order line, keyed on the order
 * by SKU code. Seller edits can only trim a line (never add to it) and
 * must land on a multiple of the SKU's inner pack — see
 * {@link validateModifiedQty}.
 */
export interface LineQtyModification {
  /** Quantity the buyer ordered — the "Actual Qty" column. */
  actualQty: number;
  /** Quantity the seller changed the line to. */
  modifiedQty: number;
  /** Unit price at the modified quantity. Re-evaluated against the
   *  SKU's QPS slabs, so trimming a line can drop it to a lower slab
   *  (or out of the offer entirely). */
  pricePerUnit: number;
  /** Line total as ordered — the baseline the order value adjusts from. */
  actualLineTotal: number;
  /** ISO 8601. */
  modifiedAt: string;
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
  /** Qwipo Customer ID of the buyer (QWIP + 16 digits) — the same on
   *  every order the customer places. Shown on the orders list and
   *  in the order page header. */
  qwipoCustomerId?: string;
  /** The retailer's ID with this order's company, when the system
   *  sends it with the order. Otherwise looked up in the Customers
   *  module. */
  retailerCompanyId?: string;
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
  /** Seller quantity edits, keyed by SKU code. Absent until the
   *  seller modifies a line. */
  qtyModifications?: Record<string, LineQtyModification>;
  /** Order value as placed by the buyer. Set on the first quantity
   *  modification; from then on `orderValue` carries the revised
   *  (final) value. */
  originalOrderValue?: number;
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
    // Sum of the six line totals below.
    orderValue: 37224,
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
    qwipoCustomerId: "QWIP6021943418321165",
    channelOrderId: "ONDC-ORD-789456",
    gstNumber: "29ABCDE1234F1Z5",
    lineItems: [
      {
        skuCode: "180000008",
        productName: "Freedom Refined Sunflower Oil 1L × 16",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        // 160 pcs = 10 inner packs of 16 — the order-modification demo
        // line (edits must stay in multiples of the inner pack).
        qty: 160,
        originalPricePerUnit: 171,
        finalPricePerUnit: 153.9,
        discountApplied: 2736,
        discountDetails: "Slab 3: 48+ qty • 10% off vs ₹171.00",
        lineTotal: 24624,
      },
      {
        skuCode: "SKU-AASH-10",
        shortName: "AASH-10K",
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
        shortName: "SDF-150",
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
        shortName: "CNB-172",
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
        shortName: "BMA-90",
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
        shortName: "YIP-240",
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
    itemsSummary: "Pepsi Soft Drink 750ml + 3 more",
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
    qwipoCustomerId: "QWIP6000466011265714",
    channelOrderId: "ONDC-ORD-742218",
    gstNumber: "36AAACB2894G1ZL",
    lineItems: [
      {
        skuCode: "SKU-PEP-PS750",
        productName: "Pepsi Soft Drink 750ml",
        shortName: "PEP-750",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 72,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2880,
      },
      {
        skuCode: "SKU-PEP-KKM",
        productName: "Kurkure Masala Munch 90g",
        shortName: "KMM-90",
        company: "PepsiCo India",
        brand: "Kurkure",
        category: "Snacks",
        qty: 130,
        originalPricePerUnit: 20,
        finalPricePerUnit: 20,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2600,
      },
      {
        skuCode: "SKU-PEP-LMM52",
        productName: "Lay's India's Magic Masala 52g",
        shortName: "LMM-52",
        company: "PepsiCo India",
        brand: "Lay's",
        category: "Snacks",
        qty: 150,
        originalPricePerUnit: 20,
        finalPricePerUnit: 19,
        discountApplied: 150,
        discountDetails: "Scheme: 5% off vs ₹20.00",
        lineTotal: 2850,
      },
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 40,
        originalPricePerUnit: 103,
        finalPricePerUnit: 103,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4120,
      },
    ],
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
    itemsSummary: "Aachi Coriander Powder 200g + 2 more",
    orderValue: 5150,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    operationMode: "wholesale",
    customerOrderId: "QWI-ORD-260519-BLJ7P9",
    status: "Confirmed",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-22",
    deliveryType: "Regular",
    buyerContact: "+91 98765 43211",
    orderTime: "12:26 PM",
    orderType: "standard",
    buyerCode: "BUYER-BLK-208",
    qwipoCustomerId: "QWIP6000466011265714",
    channelOrderId: "ONDC-ORD-742219",
    gstNumber: "36AAACB2894G1ZL",
    lineItems: [
      {
        skuCode: "SKU-ACH-CRP200",
        productName: "Aachi Coriander Powder 200g",
        shortName: "ACR-200",
        company: "Aachi Masala Foods",
        brand: "Aachi",
        category: "Spices",
        qty: 20,
        originalPricePerUnit: 55,
        finalPricePerUnit: 55,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1100,
      },
      {
        skuCode: "SKU-ACH-CHP200",
        productName: "Aachi Chilli Powder 200g",
        shortName: "ACP-200",
        company: "Aachi Masala Foods",
        brand: "Aachi",
        category: "Spices",
        qty: 30,
        originalPricePerUnit: 70,
        finalPricePerUnit: 64.4,
        discountApplied: 168,
        discountDetails: "Scheme: 8% off vs ₹70.00",
        lineTotal: 1932,
      },
      {
        skuCode: "SKU-ACH-SMB1",
        productName: "Aachi Sambar Powder 1kg",
        shortName: "ASP-1K",
        company: "Aachi Masala Foods",
        brand: "Aachi",
        category: "Spices",
        qty: 5,
        originalPricePerUnit: 423.6,
        finalPricePerUnit: 423.6,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2118,
      },
    ],
  },
  // Consolidated wholesale order from the 8F3K92 / M3P6FH checkout —
  // completes the hybrid customer group on the New tab.
  {
    id: "QWI-ONDC-260520-WHL9F2",
    brand: "Mixed",
    company: "Sri Krupa Traders",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana Store",
    itemsSummary: "Toor Dal Premium 1kg + 3 more",
    orderValue: 6800,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    orderTime: "10:31 AM",
    operationMode: "wholesale",
    customerOrderId: "QWI-ORD-260520-BLJ42K",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-22",
    deliveryType: "Regular",
    buyerContact: "+91 98765 43210",
    buyerAddress:
      "Shop No. 12, MG Road, Koramangala, Bangalore, Karnataka - 560034",
    gstNumber: "29ABCDE1234F1Z5",
    orderType: "standard",
    buyerCode: "BUYER-BAL-456",
    qwipoCustomerId: "QWIP6021943418321165",
    channelOrderId: "ONDC-ORD-789458",
    lineItems: [
      {
        skuCode: "SKU-SKT-TDL1",
        productName: "Toor Dal Premium 1kg",
        shortName: "TDL-1K",
        company: "Sri Krupa Traders",
        brand: "Sri Krupa",
        category: "Pulses",
        qty: 10,
        originalPricePerUnit: 165,
        finalPricePerUnit: 151.8,
        discountApplied: 132,
        discountDetails: "Scheme: 8% off vs ₹165.00",
        lineTotal: 1518,
      },
      {
        skuCode: "SKU-SKT-SLT1",
        productName: "Iodised Salt 1kg",
        shortName: "SLT-1K",
        company: "Sri Krupa Traders",
        brand: "Sri Krupa",
        category: "Staples",
        qty: 60,
        originalPricePerUnit: 24,
        finalPricePerUnit: 21.6,
        discountApplied: 144,
        discountDetails: "Scheme: 10% off vs ₹24.00",
        lineTotal: 1296,
      },
      {
        skuCode: "SKU-SKT-CDL1",
        productName: "Chana Dal 1kg",
        shortName: "CDL-1K",
        company: "Sri Krupa Traders",
        brand: "Sri Krupa",
        category: "Pulses",
        qty: 10,
        originalPricePerUnit: 98,
        finalPricePerUnit: 98,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 980,
      },
      {
        skuCode: "SKU-SKT-SNM5",
        productName: "Sona Masoori Rice 5kg",
        shortName: "SMR-5K",
        company: "Sri Krupa Traders",
        brand: "Sri Krupa",
        category: "Foodgrains",
        qty: 9,
        originalPricePerUnit: 334,
        finalPricePerUnit: 334,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 3006,
      },
    ],
  },
  {
    id: "QWI-FLPK-260519-Q4M8YE",
    brand: "Freedom Oil",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Botery",
    retailerName: "City Supermart",
    itemsSummary: "Freedom Groundnut Oil 1L + 3 more",
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
    qwipoCustomerId: "QWIP6095417856334092",
    channelOrderId: "FLPK-ORD-518274",
    gstNumber: "36AABCC4521E1ZC",
    lineItems: [
      {
        skuCode: "SKU-GEF-FGN1",
        productName: "Freedom Groundnut Oil 1L",
        shortName: "FGN-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 210,
        finalPricePerUnit: 210,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2100,
      },
      {
        skuCode: "SKU-GEF-FRB1",
        productName: "Freedom Rice Bran Oil 1L",
        shortName: "FRB-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 155,
        finalPricePerUnit: 155,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1550,
      },
      {
        skuCode: "SKU-GEF-FSO1",
        productName: "Freedom Refined Sunflower Oil 1L Pouch",
        shortName: "FSO-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 145,
        finalPricePerUnit: 145,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1450,
      },
      {
        skuCode: "SKU-GEF-FSO5",
        productName: "Freedom Refined Sunflower Oil 5L Jar",
        shortName: "FSO-5L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 5,
        originalPricePerUnit: 730,
        finalPricePerUnit: 730,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 3650,
      },
    ],
  },
  {
    id: "QWI-AMZN-260518-V6T3HN",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Modern Retail Chain",
    itemsSummary: "Saffola Masala Oats 500g + 3 more",
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
    qwipoCustomerId: "QWIP6078668367661533",
    channelOrderId: "AMZN-ORD-694105",
    gstNumber: "36AADCM8265F1ZP",
    lineItems: [
      {
        skuCode: "SKU-MRC-SFO1",
        productName: "Saffola Masala Oats 500g",
        shortName: "SMO-500",
        company: "Marico Limited",
        brand: "Saffola",
        category: "Breakfast Cereals",
        qty: 24,
        originalPricePerUnit: 199,
        finalPricePerUnit: 199,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4776,
      },
      {
        skuCode: "SKU-MRC-PCO500",
        productName: "Parachute Pure Coconut Oil 500ml",
        shortName: "PCO-500",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 36,
        originalPricePerUnit: 180,
        finalPricePerUnit: 162,
        discountApplied: 648,
        discountDetails: "Scheme: 10% off vs ₹180.00",
        lineTotal: 5832,
      },
      {
        skuCode: "SKU-MRC-PCO250",
        productName: "Parachute Pure Coconut Oil 250ml",
        shortName: "PCO-250",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Hair Care",
        qty: 48,
        originalPricePerUnit: 98,
        finalPricePerUnit: 98,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4704,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 24,
        originalPricePerUnit: 362,
        finalPricePerUnit: 362,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 8688,
      },
    ],
  },
  {
    id: "QWI-ONDC-260518-J5C9BD",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Botery",
    retailerName: "Quick Mart",
    itemsSummary: "Pepsi Soft Drink 750ml + 2 more",
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
    qwipoCustomerId: "QWIP6015038770734131",
    channelOrderId: "ONDC-ORD-628341",
    gstNumber: "36AAECQ1937H1ZT",
    lineItems: [
      {
        skuCode: "SKU-PEP-PS750",
        productName: "Pepsi Soft Drink 750ml",
        shortName: "PEP-750",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 30,
        originalPricePerUnit: 40,
        finalPricePerUnit: 36.8,
        discountApplied: 96,
        discountDetails: "Scheme: 8% off vs ₹40.00",
        lineTotal: 1104,
      },
      {
        skuCode: "SKU-PEP-7UP",
        productName: "7UP Lemon Soft Drink 750ml",
        shortName: "7UP-750",
        company: "PepsiCo India",
        brand: "7UP",
        category: "Beverages",
        qty: 30,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1200,
      },
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 32,
        originalPricePerUnit: 96.75,
        finalPricePerUnit: 96.75,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 3096,
      },
    ],
  },
  {
    id: "QWI-AMZN-260519-N7W2XK",
    brand: "Freedom Oil",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Bizom",
    retailerName: "Sunrise Traders",
    itemsSummary: "Freedom Groundnut Oil 1L + 3 more",
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
    qwipoCustomerId: "QWIP6084994651408664",
    channelOrderId: "AMZN-ORD-517296",
    gstNumber: "36AAFCS7412K1ZB",
    lineItems: [
      {
        skuCode: "SKU-GEF-FGN1",
        productName: "Freedom Groundnut Oil 1L",
        shortName: "FGN-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 210,
        finalPricePerUnit: 189,
        discountApplied: 210,
        discountDetails: "Scheme: 10% off vs ₹210.00",
        lineTotal: 1890,
      },
      {
        skuCode: "SKU-GEF-FSO1",
        productName: "Freedom Refined Sunflower Oil 1L Pouch",
        shortName: "FSO-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 145,
        finalPricePerUnit: 145,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1450,
      },
      {
        skuCode: "SKU-GEF-FRB1",
        productName: "Freedom Rice Bran Oil 1L",
        shortName: "FRB-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 155,
        finalPricePerUnit: 155,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1550,
      },
      {
        skuCode: "SKU-GEF-FSO5",
        productName: "Freedom Refined Sunflower Oil 5L Jar",
        shortName: "FSO-5L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 3,
        originalPricePerUnit: 645,
        finalPricePerUnit: 645,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1935,
      },
    ],
  },
  {
    id: "QWI-ONDC-260519-R3F4PT",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "Lucky Store",
    itemsSummary: "Parachute Pure Coconut Oil 500ml + 3 more",
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
    qwipoCustomerId: "QWIP6088200430410147",
    channelOrderId: "ONDC-ORD-806412",
    gstNumber: "36AAGCL5628M1ZD",
    lineItems: [
      {
        skuCode: "SKU-MRC-PCO500",
        productName: "Parachute Pure Coconut Oil 500ml",
        shortName: "PCO-500",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 12,
        originalPricePerUnit: 180,
        finalPricePerUnit: 162,
        discountApplied: 216,
        discountDetails: "Scheme: 10% off vs ₹180.00",
        lineTotal: 1944,
      },
      {
        skuCode: "SKU-MRC-PCO250",
        productName: "Parachute Pure Coconut Oil 250ml",
        shortName: "PCO-250",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Hair Care",
        qty: 24,
        originalPricePerUnit: 98,
        finalPricePerUnit: 98,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2352,
      },
      {
        skuCode: "SKU-MRC-NHR",
        productName: "Nihar Naturals Shanti Amla Hair Oil 300ml",
        shortName: "NSA-300",
        company: "Marico Limited",
        brand: "Nihar",
        category: "Hair Care",
        qty: 18,
        originalPricePerUnit: 120,
        finalPricePerUnit: 110.4,
        discountApplied: 172.8,
        discountDetails: "Scheme: 8% off vs ₹120.00",
        lineTotal: 1987.2,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 8,
        originalPricePerUnit: 364.6,
        finalPricePerUnit: 364.6,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2916.8,
      },
    ],
  },
  {
    id: "QWI-FLPK-260520-A6H8WC",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "New Era Retail",
    itemsSummary: "Pepsi Soft Drink 2.25L + 2 more",
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
    qwipoCustomerId: "QWIP6073539072790553",
    channelOrderId: "FLPK-ORD-590148",
    gstNumber: "36AAHCN3971P1ZF",
    lineItems: [
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 13,
        originalPricePerUnit: 95,
        finalPricePerUnit: 95,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1235,
      },
      {
        skuCode: "SKU-PEP-PS750",
        productName: "Pepsi Soft Drink 750ml",
        shortName: "PEP-750",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 36,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1440,
      },
      {
        skuCode: "SKU-PEP-TRP",
        productName: "Tropicana Orange Juice 1L",
        shortName: "TOJ-1L",
        company: "PepsiCo India",
        brand: "Tropicana",
        category: "Beverages",
        qty: 14,
        originalPricePerUnit: 117.5,
        finalPricePerUnit: 117.5,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1645,
      },
    ],
  },
  // Demo order — shares exact lat/lng with QWI-ONDC-260330-8F3K92 so
  // "View on Map" on the New tab shows one multi-order pin (BR-3).
  {
    id: "QWI-ONDC-260520-M3P6FH",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana Store",
    itemsSummary: "Aashirvaad Whole Wheat Atta 1kg + 3 more",
    orderValue: 8750,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    orderTime: "11:45 AM",
    customerOrderId: "QWI-ORD-260520-BLJ42K",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-23",
    deliveryType: "Regular",
    beatName: "KPHB 1",
    buyerContact: "+91 98765 43210",
    buyerCode: "BUYER-BAL-456",
    qwipoCustomerId: "QWIP6021943418321165",
    channelOrderId: "ONDC-ORD-789457",
    gstNumber: "29ABCDE1234F1Z5",
    orderType: "beat",
    lineItems: [
      {
        skuCode: "SKU-ITC-AASH1",
        productName: "Aashirvaad Whole Wheat Atta 1kg",
        shortName: "AASH-1K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 30,
        originalPricePerUnit: 62,
        finalPricePerUnit: 62,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1860,
      },
      {
        skuCode: "SKU-ITC-SDF75",
        productName: "Sunfeast Dark Fantasy Choco Fills 75g",
        shortName: "SDF-75",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 48,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1920,
      },
      {
        skuCode: "SKU-ITC-SMRC",
        productName: "Sunfeast Marie Light 250g",
        shortName: "SML-250",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 60,
        originalPricePerUnit: 35,
        finalPricePerUnit: 31.5,
        discountApplied: 210,
        discountDetails: "Scheme: 10% off vs ₹35.00",
        lineTotal: 1890,
      },
      {
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 11,
        originalPricePerUnit: 280,
        finalPricePerUnit: 280,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 3080,
      },
    ],
  },
  {
    id: "QWI-AMZN-260517-B9D2MZ",
    brand: "Freedom Oil",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Botery",
    retailerName: "Himalaya Traders",
    itemsSummary: "Freedom Groundnut Oil 1L + 3 more",
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
    qwipoCustomerId: "QWIP6076101937176105",
    channelOrderId: "AMZN-ORD-463870",
    gstNumber: "36AAJCH6084R1ZH",
    lineItems: [
      {
        skuCode: "SKU-GEF-FGN1",
        productName: "Freedom Groundnut Oil 1L",
        shortName: "FGN-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 210,
        finalPricePerUnit: 210,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2100,
      },
      {
        skuCode: "SKU-GEF-FRB1",
        productName: "Freedom Rice Bran Oil 1L",
        shortName: "FRB-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 155,
        finalPricePerUnit: 142.6,
        discountApplied: 124,
        discountDetails: "Scheme: 8% off vs ₹155.00",
        lineTotal: 1426,
      },
      {
        skuCode: "SKU-GEF-FSO1",
        productName: "Freedom Refined Sunflower Oil 1L Pouch",
        shortName: "FSO-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 20,
        originalPricePerUnit: 145,
        finalPricePerUnit: 145,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2900,
      },
      {
        skuCode: "SKU-GEF-FSO5",
        productName: "Freedom Refined Sunflower Oil 5L Jar",
        shortName: "FSO-5L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 6,
        originalPricePerUnit: 729,
        finalPricePerUnit: 729,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4374,
      },
    ],
  },
  {
    id: "QWI-ONDC-260520-E5G7QY",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Anand General Store",
    itemsSummary: "Saffola Gold Refined Oil 1L + 3 more",
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
    qwipoCustomerId: "QWIP6031374576648998",
    channelOrderId: "ONDC-ORD-731529",
    gstNumber: "36AAKCA2749T1ZJ",
    lineItems: [
      {
        skuCode: "SKU-MRC-SFL1",
        productName: "Saffola Gold Refined Oil 1L",
        shortName: "SFG-1L",
        company: "Marico Limited",
        brand: "Saffola",
        category: "Edible Oil",
        qty: 18,
        originalPricePerUnit: 195,
        finalPricePerUnit: 195,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 3510,
      },
      {
        skuCode: "SKU-MRC-LVT",
        productName: "Livon Serum 100ml",
        shortName: "LVS-100",
        company: "Marico Limited",
        brand: "Livon",
        category: "Hair Care",
        qty: 18,
        originalPricePerUnit: 245,
        finalPricePerUnit: 245,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4410,
      },
      {
        skuCode: "SKU-MRC-PCO250",
        productName: "Parachute Pure Coconut Oil 250ml",
        shortName: "PCO-250",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Hair Care",
        qty: 36,
        originalPricePerUnit: 98,
        finalPricePerUnit: 98,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 3528,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 24,
        originalPricePerUnit: 348,
        finalPricePerUnit: 348,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 8352,
      },
    ],
  },
  {
    id: "QWI-FLPK-260516-S4U8VK",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Botery",
    retailerName: "Premium Retail Pvt Ltd",
    itemsSummary: "Pepsi Soft Drink 750ml + 3 more",
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
    qwipoCustomerId: "QWIP6076803739224769",
    channelOrderId: "FLPK-ORD-402965",
    gstNumber: "36AALCP8156V1ZL",
    lineItems: [
      {
        skuCode: "SKU-PEP-PS750",
        productName: "Pepsi Soft Drink 750ml",
        shortName: "PEP-750",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 30,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1200,
      },
      {
        skuCode: "SKU-PEP-LCS52",
        productName: "Lay's Classic Salted Chips 52g",
        shortName: "LCS-52",
        company: "PepsiCo India",
        brand: "Lay's",
        category: "Snacks",
        qty: 70,
        originalPricePerUnit: 20,
        finalPricePerUnit: 20,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1400,
      },
      {
        skuCode: "SKU-PEP-7UP",
        productName: "7UP Lemon Soft Drink 750ml",
        shortName: "7UP-750",
        company: "PepsiCo India",
        brand: "7UP",
        category: "Beverages",
        qty: 30,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1200,
      },
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 26,
        originalPricePerUnit: 100,
        finalPricePerUnit: 100,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2600,
      },
    ],
  },
  {
    id: "QWI-AMZN-260515-T6Y9NF",
    brand: "Freedom Oil",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Bizom",
    retailerName: "Vinayak Traders",
    itemsSummary: "Freedom Rice Bran Oil 1L + 3 more",
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
    qwipoCustomerId: "QWIP6051055421052000",
    channelOrderId: "AMZN-ORD-385214",
    gstNumber: "36AAMCV4392X1ZN",
    lineItems: [
      {
        skuCode: "SKU-GEF-FRB1",
        productName: "Freedom Rice Bran Oil 1L",
        shortName: "FRB-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 155,
        finalPricePerUnit: 155,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1550,
      },
      {
        skuCode: "SKU-GEF-FGN1",
        productName: "Freedom Groundnut Oil 1L",
        shortName: "FGN-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 210,
        finalPricePerUnit: 210,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2100,
      },
      {
        skuCode: "SKU-GEF-FSO1",
        productName: "Freedom Refined Sunflower Oil 1L Pouch",
        shortName: "FSO-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 20,
        originalPricePerUnit: 145,
        finalPricePerUnit: 145,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2900,
      },
      {
        skuCode: "SKU-GEF-FSO5",
        productName: "Freedom Refined Sunflower Oil 5L Jar",
        shortName: "FSO-5L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 695,
        finalPricePerUnit: 695,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 6950,
      },
    ],
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
    itemsSummary: "Savlon Glycerin Soap 75g + 2 more",
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
    qwipoCustomerId: "QWIP6046080224774902",
    gstNumber: "36AANCS9517Z1ZQ",
    lineItems: [
      {
        skuCode: "SKU-ITC-SVLS",
        productName: "Savlon Glycerin Soap 75g",
        shortName: "SVL-75",
        company: "ITC Limited",
        brand: "Savlon",
        category: "Personal Care",
        qty: 40,
        originalPricePerUnit: 30,
        finalPricePerUnit: 30,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1200,
      },
      {
        skuCode: "SKU-ITC-SMRC",
        productName: "Sunfeast Marie Light 250g",
        shortName: "SML-250",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 24,
        originalPricePerUnit: 35,
        finalPricePerUnit: 35,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 840,
      },
      {
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 6,
        originalPricePerUnit: 260,
        finalPricePerUnit: 260,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1560,
      },
    ],
  },
  {
    id: "QWI-ONDC-260519-W2K8PV",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "Greenfield Mart",
    itemsSummary: "Saffola Masala Oats 500g + 3 more",
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
    qwipoCustomerId: "QWIP6065709357048075",
    gstNumber: "36AAPCG6873B1ZS",
    lineItems: [
      {
        skuCode: "SKU-MRC-SFO1",
        productName: "Saffola Masala Oats 500g",
        shortName: "SMO-500",
        company: "Marico Limited",
        brand: "Saffola",
        category: "Breakfast Cereals",
        qty: 6,
        originalPricePerUnit: 199,
        finalPricePerUnit: 179.1,
        discountApplied: 119.4,
        discountDetails: "Scheme: 10% off vs ₹199.00",
        lineTotal: 1074.6,
      },
      {
        skuCode: "SKU-MRC-SFL1",
        productName: "Saffola Gold Refined Oil 1L",
        shortName: "SFG-1L",
        company: "Marico Limited",
        brand: "Saffola",
        category: "Edible Oil",
        qty: 6,
        originalPricePerUnit: 195,
        finalPricePerUnit: 195,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1170,
      },
      {
        skuCode: "SKU-MRC-PCO250",
        productName: "Parachute Pure Coconut Oil 250ml",
        shortName: "PCO-250",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Hair Care",
        qty: 12,
        originalPricePerUnit: 98,
        finalPricePerUnit: 98,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1176,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 15,
        originalPricePerUnit: 331.96,
        finalPricePerUnit: 331.96,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4979.4,
      },
    ],
  },
  {
    id: "QWI-FLPK-260518-D9J3RE",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "Sri Lakshmi Stores",
    itemsSummary: "Pepsi Soft Drink 750ml + 2 more",
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
    qwipoCustomerId: "QWIP6089023614622227",
    gstNumber: "36AAQCS3248D1ZU",
    lineItems: [
      {
        skuCode: "SKU-PEP-PS750",
        productName: "Pepsi Soft Drink 750ml",
        shortName: "PEP-750",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 24,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 960,
      },
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 10,
        originalPricePerUnit: 95,
        finalPricePerUnit: 95,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 950,
      },
      {
        skuCode: "SKU-PEP-TRP",
        productName: "Tropicana Orange Juice 1L",
        shortName: "TOJ-1L",
        company: "PepsiCo India",
        brand: "Tropicana",
        category: "Beverages",
        qty: 8,
        originalPricePerUnit: 111.25,
        finalPricePerUnit: 111.25,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 890,
      },
    ],
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
    itemsSummary: "Sunfeast Marie Light 250g + 3 more",
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
    qwipoCustomerId: "QWIP6056636739152741",
    channelOrderId: "ONDC-ORD-987541",
    gstNumber: "36AARCA7591F1ZW",
    lineItems: [
      {
        skuCode: "SKU-ITC-SMRC",
        productName: "Sunfeast Marie Light 250g",
        shortName: "SML-250",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 60,
        originalPricePerUnit: 35,
        finalPricePerUnit: 35,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2100,
      },
      {
        skuCode: "SKU-ITC-SDF75",
        productName: "Sunfeast Dark Fantasy Choco Fills 75g",
        shortName: "SDF-75",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 36,
        originalPricePerUnit: 40,
        finalPricePerUnit: 38,
        discountApplied: 72,
        discountDetails: "Scheme: 5% off vs ₹40.00",
        lineTotal: 1368,
      },
      {
        skuCode: "SKU-ITC-SVLS",
        productName: "Savlon Glycerin Soap 75g",
        shortName: "SVL-75",
        company: "ITC Limited",
        brand: "Savlon",
        category: "Personal Care",
        qty: 68,
        originalPricePerUnit: 30,
        finalPricePerUnit: 30,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2040,
      },
      {
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 16,
        originalPricePerUnit: 268.25,
        finalPricePerUnit: 268.25,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4292,
      },
    ],
  },

  // [New · Standard · tomorrow]. Non-beat ad-hoc — lands in the
  // Confirm dialog's "Other / Tomorrow" group with a Standard pill.
  {
    id: "QWI-ONDC-260520-P3R9KZ",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Quick Mart Express",
    itemsSummary: "Nihar Naturals Shanti Amla Hair Oil 300ml + 1 more",
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
    qwipoCustomerId: "QWIP6091680089887992",
    channelOrderId: "ONDC-ORD-784123",
    gstNumber: "36AASCQ1826H1ZY",
    lineItems: [
      {
        skuCode: "SKU-MRC-NHR",
        productName: "Nihar Naturals Shanti Amla Hair Oil 300ml",
        shortName: "NSA-300",
        company: "Marico Limited",
        brand: "Nihar",
        category: "Hair Care",
        qty: 6,
        originalPricePerUnit: 120,
        finalPricePerUnit: 114,
        discountApplied: 36,
        discountDetails: "Scheme: 5% off vs ₹120.00",
        lineTotal: 684,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 3,
        originalPricePerUnit: 332,
        finalPricePerUnit: 332,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 996,
      },
    ],
  },

  // [New · Standard · today]. Non-beat same-day request — lands in
  // the Confirm dialog's "Other" group.
  {
    id: "QWI-FLPK-260520-Y6N4HW",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Botery",
    retailerName: "City Supermart",
    itemsSummary: "Pepsi Soft Drink 750ml + 1 more",
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
    qwipoCustomerId: "QWIP6095417856334092",
    gstNumber: "36AABCC4521E1ZC",
    lineItems: [
      {
        skuCode: "SKU-PEP-PS750",
        productName: "Pepsi Soft Drink 750ml",
        shortName: "PEP-750",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 24,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 960,
      },
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 10,
        originalPricePerUnit: 96,
        finalPricePerUnit: 96,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 960,
      },
    ],
  },

  // [New · Standard · beyond tomorrow]. Non-beat with a future date —
  // lands in the Confirm dialog's "Beyond Tomorrow" group.
  {
    id: "QWI-ONDC-260520-T8K1MR",
    brand: "Adani Wilmar",
    company: "Adani Wilmar Ltd",
    source: "DMS-Bizom",
    retailerName: "Patel Provision Store",
    itemsSummary: "Fortune Kachi Ghani Mustard Oil 1L + 3 more",
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
    qwipoCustomerId: "QWIP6087526691643478",
    gstNumber: "36AATCP5964J1ZA",
    lineItems: [
      {
        skuCode: "SKU-AWL-FKG1",
        productName: "Fortune Kachi Ghani Mustard Oil 1L",
        shortName: "FKG-1L",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 175,
        finalPricePerUnit: 175,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1750,
      },
      {
        skuCode: "SKU-AWL-FBS1",
        productName: "Fortune Besan 1kg",
        shortName: "FBS-1K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 10,
        originalPricePerUnit: 110,
        finalPricePerUnit: 110,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1100,
      },
      {
        skuCode: "SKU-AWL-FSF1",
        productName: "Fortune Sunlite Refined Sunflower Oil 1L",
        shortName: "FSL-1L",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 150,
        finalPricePerUnit: 150,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1500,
      },
      {
        skuCode: "SKU-AWL-FCA5",
        productName: "Fortune Chakki Fresh Atta 5kg",
        shortName: "FCA-5K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 12,
        originalPricePerUnit: 237.5,
        finalPricePerUnit: 237.5,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2850,
      },
    ],
  },

  // [New · Standard · stale/pending — cluster]. Five orders placed
  // 3 to 7 days before DEMO_TODAY (2026-05-20) and never confirmed —
  // feeds the New-tab soft nudge from VIW-2026-06911 (Stage 1 only;
  // Stage 2's hard restriction was dropped before launch). A single
  // stale row was too easy to miss on the tab; this cluster gives the
  // banner, the per-row badge, and the Confirm-dialog "left behind"
  // nudge a realistic-sized backlog to render against. Ages are
  // deliberately spread (3/3/4/5/7 days) so the badge's day-count
  // renders more than one value during testing. See
  // `isStalePendingOrder` / `getStalePendingOrders`.
  {
    id: "QWI-ONDC-260517-N4WQ2S",
    brand: "Britannia",
    company: "Britannia Industries",
    source: "DMS-Bizom",
    retailerName: "Ganesh General Store",
    itemsSummary: "Britannia Cheese Slices 200g + 2 more",
    orderValue: 3260,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    customerOrderId: "QWI-ORD-260517-N4WQ2S",
    orderTime: "04:05 PM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-18",
    actualDeliveryDate: "2026-05-18",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Madhapur",
    buyerContact: "+91 98765 43230",
    buyerAddress: "Shop 7, Ayyappa Society Main Road, Madhapur, Hyderabad, Telangana 500081",
    buyerLat: 17.4505,
    buyerLng: 78.3924,
    channelOrderId: "ONDC-ORD-118823",
    buyerCode: "BUYER-GGS-441",
    qwipoCustomerId: "QWIP6095302961101658",
    gstNumber: "36AAJCG2210K1ZP",
    lineItems: [
      {
        skuCode: "SKU-BRT-CHZ200",
        productName: "Britannia Cheese Slices 200g",
        shortName: "BCS-200",
        company: "Britannia Industries",
        brand: "Britannia",
        category: "Dairy",
        qty: 9,
        originalPricePerUnit: 145,
        finalPricePerUnit: 130.5,
        discountApplied: 130.5,
        discountDetails: "Scheme: 10% off vs ₹145.00",
        lineTotal: 1174.5,
      },
      {
        skuCode: "SKU-BRT-MGL100",
        productName: "Britannia Marie Gold 250g",
        shortName: "MGL-250",
        company: "Britannia Industries",
        brand: "Britannia",
        category: "Biscuits",
        qty: 24,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 960,
      },
      {
        skuCode: "SKU-BRT-BRB400",
        productName: "Britannia Brown Bread 400g",
        shortName: "BBR-400",
        company: "Britannia Industries",
        brand: "Britannia",
        category: "Bakery",
        qty: 25,
        originalPricePerUnit: 45.02,
        finalPricePerUnit: 45.02,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1125.5,
      },
    ],
  },
  {
    id: "QWI-ONDC-260517-R8T3LM",
    brand: "Dabur",
    company: "Dabur India",
    source: "DMS-Bizom",
    retailerName: "Lakshmi Super Bazaar",
    itemsSummary: "Dabur Amla Hair Oil 275ml + 1 more",
    orderValue: 2140,
    paymentMode: "Prepaid",
    orderDate: "2026-05-17",
    customerOrderId: "QWI-ORD-260517-R8T3LM",
    orderTime: "11:20 AM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-18",
    actualDeliveryDate: "2026-05-18",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "KPHB 1",
    buyerContact: "+91 98765 43231",
    buyerAddress: "Plot 15, KPHB Phase 1, Kukatpally, Hyderabad, Telangana 500072",
    buyerLat: 17.4889,
    buyerLng: 78.3956,
    channelOrderId: "ONDC-ORD-118902",
    buyerCode: "BUYER-LSB-552",
    qwipoCustomerId: "QWIP6023687326486030",
    gstNumber: "36AADCD1140M1ZQ",
    lineItems: [
      {
        skuCode: "SKU-DAB-AMLA",
        productName: "Dabur Amla Hair Oil 275ml",
        shortName: "DAH-275",
        company: "Dabur India",
        brand: "Dabur",
        category: "Hair Care",
        qty: 12,
        originalPricePerUnit: 140,
        finalPricePerUnit: 140,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1680,
      },
      {
        skuCode: "SKU-DAB-RLJ1",
        productName: "Real Fruit Power Mixed Fruit Juice 1L",
        shortName: "RMF-1L",
        company: "Dabur India",
        brand: "Real",
        category: "Beverages",
        qty: 4,
        originalPricePerUnit: 115,
        finalPricePerUnit: 115,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 460,
      },
    ],
  },
  {
    id: "QWI-ONDC-260516-H5V9PK",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "Krishna Kirana Store",
    itemsSummary: "Parachute Pure Coconut Oil 250ml + 1 more",
    orderValue: 1860,
    paymentMode: "COD",
    orderDate: "2026-05-16",
    customerOrderId: "QWI-ORD-260516-H5V9PK",
    orderTime: "09:50 AM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-17",
    actualDeliveryDate: "2026-05-17",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Banjara Hills",
    buyerContact: "+91 98765 43232",
    buyerAddress: "Shop 3, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034",
    buyerLat: 17.4126,
    buyerLng: 78.4382,
    channelOrderId: "ONDC-ORD-119014",
    buyerCode: "BUYER-KKS-663",
    qwipoCustomerId: "QWIP6042933910379971",
    gstNumber: "36AAECK9021N1ZR",
    lineItems: [
      {
        skuCode: "SKU-MRC-PCO250",
        productName: "Parachute Pure Coconut Oil 250ml",
        shortName: "PCO-250",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Hair Care",
        qty: 12,
        originalPricePerUnit: 98,
        finalPricePerUnit: 93.1,
        discountApplied: 58.8,
        discountDetails: "Scheme: 5% off vs ₹98.00",
        lineTotal: 1117.2,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 2,
        originalPricePerUnit: 371.4,
        finalPricePerUnit: 371.4,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 742.8,
      },
    ],
  },
  {
    id: "QWI-ONDC-260515-Q2X6BN",
    brand: "PepsiCo",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "New Bombay Mart",
    itemsSummary: "Pepsi Soft Drink 750ml + 2 more",
    orderValue: 4720,
    paymentMode: "COD",
    orderDate: "2026-05-15",
    customerOrderId: "QWI-ORD-260515-Q2X6BN",
    orderTime: "03:35 PM",
    status: "Delivered",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-16",
    actualDeliveryDate: "2026-05-16",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "SR Nagar",
    buyerContact: "+91 98765 43233",
    buyerAddress: "H.No 7-1-61, SR Nagar Main Road, Hyderabad, Telangana 500038",
    buyerLat: 17.4421,
    buyerLng: 78.4431,
    channelOrderId: "FLPK-ORD-661377",
    buyerCode: "BUYER-NBM-774",
    qwipoCustomerId: "QWIP6087105683167565",
    gstNumber: "36AAFCN5502P1ZS",
    lineItems: [
      {
        skuCode: "SKU-PEP-PS750",
        productName: "Pepsi Soft Drink 750ml",
        shortName: "PEP-750",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 30,
        originalPricePerUnit: 40,
        finalPricePerUnit: 36.8,
        discountApplied: 96,
        discountDetails: "Scheme: 8% off vs ₹40.00",
        lineTotal: 1104,
      },
      {
        skuCode: "SKU-PEP-TRP",
        productName: "Tropicana Orange Juice 1L",
        shortName: "TOJ-1L",
        company: "PepsiCo India",
        brand: "Tropicana",
        category: "Beverages",
        qty: 15,
        originalPricePerUnit: 120,
        finalPricePerUnit: 114,
        discountApplied: 90,
        discountDetails: "Scheme: 5% off vs ₹120.00",
        lineTotal: 1710,
      },
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 20,
        originalPricePerUnit: 95.3,
        finalPricePerUnit: 95.3,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1906,
      },
    ],
  },
  {
    id: "QWI-ONDC-260513-W7C1DZ",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Sai Ram Traders",
    itemsSummary: "Savlon Glycerin Soap 75g + 2 more",
    orderValue: 5380,
    paymentMode: "Prepaid",
    orderDate: "2026-05-13",
    customerOrderId: "QWI-ORD-260513-W7C1DZ",
    orderTime: "01:10 PM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-14",
    actualDeliveryDate: "2026-05-14",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Ameerpet",
    buyerContact: "+91 98765 43234",
    buyerAddress: "Shop 11, Mythrivanam Road, Ameerpet, Hyderabad, Telangana 500016",
    buyerLat: 17.4372,
    buyerLng: 78.4489,
    channelOrderId: "ONDC-ORD-119203",
    buyerCode: "BUYER-SRT-885",
    qwipoCustomerId: "QWIP6073409428719430",
    gstNumber: "36AAGCS7734Q1ZT",
    lineItems: [
      {
        skuCode: "SKU-ITC-SVLS",
        productName: "Savlon Glycerin Soap 75g",
        shortName: "SVL-75",
        company: "ITC Limited",
        brand: "Savlon",
        category: "Personal Care",
        qty: 64,
        originalPricePerUnit: 30,
        finalPricePerUnit: 30,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1920,
      },
      {
        skuCode: "SKU-ITC-CLNB",
        productName: "Classmate Long Notebook 172 Pages",
        shortName: "CLNB-172",
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
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 8,
        originalPricePerUnit: 263.75,
        finalPricePerUnit: 263.75,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2110,
      },
    ],
  },
  {
    id: "QWI-ONDC-260517-D3F8KT",
    brand: "Nestle",
    company: "Nestle India",
    source: "DMS-Bizom",
    retailerName: "Annapurna Provisions",
    itemsSummary: "Nestle KitKat 4 Finger 37g + 1 more",
    orderValue: 2480,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    customerOrderId: "QWI-ORD-260517-D3F8KT",
    orderTime: "11:45 AM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-18",
    actualDeliveryDate: "2026-05-18",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Madhapur",
    buyerContact: "+91 98765 43240",
    buyerAddress: "Shop 2, Kavuri Hills Road, Madhapur, Hyderabad, Telangana 500081",
    buyerLat: 17.4434,
    buyerLng: 78.3984,
    channelOrderId: "ONDC-ORD-119310",
    buyerCode: "BUYER-APP-120",
    qwipoCustomerId: "QWIP6087450231757565",
    gstNumber: "36AAKCA3321B1ZV",
    lineItems: [
      {
        skuCode: "SKU-NES-KKT",
        productName: "Nestle KitKat 4 Finger 37g",
        shortName: "KKT-37",
        company: "Nestle India",
        brand: "KitKat",
        category: "Confectionery",
        qty: 48,
        originalPricePerUnit: 30,
        finalPricePerUnit: 30,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1440,
      },
      {
        skuCode: "SKU-NES-MLK",
        productName: "Nestle Everyday Dairy Whitener 1kg",
        shortName: "NEW-1K",
        company: "Nestle India",
        brand: "Nestle",
        category: "Dairy",
        qty: 2,
        originalPricePerUnit: 520,
        finalPricePerUnit: 520,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1040,
      },
    ],
  },
  {
    id: "QWI-ONDC-260516-M9B2VC",
    brand: "Hindustan Unilever",
    company: "Hindustan Unilever Ltd",
    source: "DMS-Bizom",
    retailerName: "Sri Venkateswara Stores",
    itemsSummary: "Surf Excel Easy Wash Detergent Powder 1kg + 2 more",
    orderValue: 3915,
    paymentMode: "Prepaid",
    orderDate: "2026-05-16",
    customerOrderId: "QWI-ORD-260516-M9B2VC",
    orderTime: "05:20 PM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-17",
    actualDeliveryDate: "2026-05-17",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Hyderabad West",
    buyerContact: "+91 98765 43241",
    buyerAddress: "Shop 5, Tolichowki Main Road, Hyderabad, Telangana 500008",
    buyerLat: 17.3986,
    buyerLng: 78.4143,
    channelOrderId: "ONDC-ORD-119355",
    buyerCode: "BUYER-SVS-301",
    qwipoCustomerId: "QWIP6070781183232318",
    gstNumber: "36AAHCS6618C1ZW",
    lineItems: [
      {
        skuCode: "SKU-HUL-SEW1",
        productName: "Surf Excel Easy Wash Detergent Powder 1kg",
        shortName: "SEW-1K",
        company: "Hindustan Unilever Ltd",
        brand: "Surf Excel",
        category: "Home Care",
        qty: 6,
        originalPricePerUnit: 140,
        finalPricePerUnit: 140,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 840,
      },
      {
        skuCode: "SKU-HUL-LUX",
        productName: "Lux Soft Touch Soap 100g",
        shortName: "LUX-100",
        company: "Hindustan Unilever Ltd",
        brand: "Lux",
        category: "Personal Care",
        qty: 28,
        originalPricePerUnit: 38,
        finalPricePerUnit: 38,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1064,
      },
      {
        skuCode: "SKU-HUL-SML2",
        productName: "Surf Excel Matic Liquid Detergent 2L",
        shortName: "SEM-2L",
        company: "Hindustan Unilever Ltd",
        brand: "Surf Excel",
        category: "Home Care",
        qty: 5,
        originalPricePerUnit: 402.2,
        finalPricePerUnit: 402.2,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2011,
      },
    ],
  },
  {
    id: "QWI-ONDC-260515-P6L4XE",
    brand: "Parle",
    company: "Parle Products",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana",
    itemsSummary: "Parle Monaco Classic 200g + 1 more",
    orderValue: 1325,
    paymentMode: "COD",
    orderDate: "2026-05-15",
    customerOrderId: "QWI-ORD-260515-P6L4XE",
    orderTime: "10:05 AM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-16",
    actualDeliveryDate: "2026-05-16",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "KPHB 1",
    buyerContact: "+91 98765 43242",
    buyerAddress: "Shop 9, KPHB Phase 3, Kukatpally, Hyderabad, Telangana 500072",
    buyerLat: 17.4932,
    buyerLng: 78.3999,
    channelOrderId: "ONDC-ORD-119401",
    buyerCode: "BUYER-BKR-212",
    qwipoCustomerId: "QWIP6056759718578724",
    gstNumber: "36AAFCB1409D1ZX",
    lineItems: [
      {
        skuCode: "SKU-PRL-MNK",
        productName: "Parle Monaco Classic 200g",
        shortName: "MNC-200",
        company: "Parle Products",
        brand: "Parle",
        category: "Biscuits",
        qty: 24,
        originalPricePerUnit: 35,
        finalPricePerUnit: 35,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 840,
      },
      {
        skuCode: "SKU-PRL-MLB",
        productName: "Parle Melody Toffee Jar 391g",
        shortName: "MEL-391",
        company: "Parle Products",
        brand: "Parle",
        category: "Confectionery",
        qty: 5,
        originalPricePerUnit: 97,
        finalPricePerUnit: 97,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 485,
      },
    ],
  },
  {
    id: "QWI-ONDC-260514-T1R7NH",
    brand: "Colgate",
    company: "Colgate Palmolive",
    source: "DMS-Bizom",
    retailerName: "Hanuman General Stores",
    itemsSummary: "Colgate Strong Teeth Toothpaste 200g + 2 more",
    orderValue: 2760,
    paymentMode: "COD",
    orderDate: "2026-05-14",
    customerOrderId: "QWI-ORD-260514-T1R7NH",
    orderTime: "03:40 PM",
    status: "Delivered",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-15",
    actualDeliveryDate: "2026-05-15",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Banjara Hills",
    buyerContact: "+91 98765 43243",
    buyerAddress: "Shop 14, Road No. 3, Banjara Hills, Hyderabad, Telangana 500034",
    buyerLat: 17.42,
    buyerLng: 78.4462,
    channelOrderId: "FLPK-ORD-661502",
    buyerCode: "BUYER-HGS-458",
    qwipoCustomerId: "QWIP6006474738000355",
    gstNumber: "36AAGCH7742E1ZY",
    lineItems: [
      {
        skuCode: "SKU-CPL-CST200",
        productName: "Colgate Strong Teeth Toothpaste 200g",
        shortName: "CST-200",
        company: "Colgate Palmolive",
        brand: "Colgate",
        category: "Oral Care",
        qty: 12,
        originalPricePerUnit: 70,
        finalPricePerUnit: 70,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 840,
      },
      {
        skuCode: "SKU-CPL-CMG150",
        productName: "Colgate MaxFresh Gel 150g",
        shortName: "CMF-150",
        company: "Colgate Palmolive",
        brand: "Colgate",
        category: "Oral Care",
        qty: 12,
        originalPricePerUnit: 95,
        finalPricePerUnit: 95,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1140,
      },
      {
        skuCode: "SKU-CPL-CFP",
        productName: "Colgate Family Pack Toothpaste 4 x 150g",
        shortName: "CFP-4X",
        company: "Colgate Palmolive",
        brand: "Colgate",
        category: "Oral Care",
        qty: 2,
        originalPricePerUnit: 390,
        finalPricePerUnit: 390,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 780,
      },
    ],
  },
  {
    id: "QWI-ONDC-260512-K8W5QZ",
    brand: "Dabur",
    company: "Dabur India",
    source: "DMS-Bizom",
    retailerName: "Gayatri Super Market",
    itemsSummary: "Dabur Red Toothpaste 200g + 2 more",
    orderValue: 4210,
    paymentMode: "Prepaid",
    orderDate: "2026-05-12",
    customerOrderId: "QWI-ORD-260512-K8W5QZ",
    orderTime: "12:30 PM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-13",
    actualDeliveryDate: "2026-05-13",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Hyderabad North",
    buyerContact: "+91 98765 43244",
    buyerAddress: "Plot 21, Bowenpally Main Road, Secunderabad, Telangana 500011",
    buyerLat: 17.4763,
    buyerLng: 78.4872,
    channelOrderId: "ONDC-ORD-119488",
    buyerCode: "BUYER-GSM-519",
    qwipoCustomerId: "QWIP6085584699379243",
    gstNumber: "36AAHCG8855F1ZZ",
    lineItems: [
      {
        skuCode: "SKU-DAB-DRP200",
        productName: "Dabur Red Toothpaste 200g",
        shortName: "DRP-200",
        company: "Dabur India",
        brand: "Dabur Red",
        category: "Oral Care",
        qty: 12,
        originalPricePerUnit: 120,
        finalPricePerUnit: 120,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1440,
      },
      {
        skuCode: "SKU-DAB-CHY500",
        productName: "Dabur Chyawanprash 500g",
        shortName: "DCP-500",
        company: "Dabur India",
        brand: "Dabur",
        category: "Health Care",
        qty: 6,
        originalPricePerUnit: 235,
        finalPricePerUnit: 216.2,
        discountApplied: 112.8,
        discountDetails: "Scheme: 8% off vs ₹235.00",
        lineTotal: 1297.2,
      },
      {
        skuCode: "SKU-DAB-RLJ1",
        productName: "Real Fruit Power Mixed Fruit Juice 1L",
        shortName: "RMF-1L",
        company: "Dabur India",
        brand: "Real",
        category: "Beverages",
        qty: 14,
        originalPricePerUnit: 105.2,
        finalPricePerUnit: 105.2,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1472.8,
      },
    ],
  },
  {
    id: "QWI-ONDC-260511-V2N9JD",
    brand: "Britannia",
    company: "Britannia Industries",
    source: "DMS-Bizom",
    retailerName: "Sai Krishna Traders",
    itemsSummary: "Britannia Brown Bread 400g + 1 more",
    orderValue: 1890,
    paymentMode: "COD",
    orderDate: "2026-05-11",
    customerOrderId: "QWI-ORD-260511-V2N9JD",
    orderTime: "09:15 AM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-12",
    actualDeliveryDate: "2026-05-12",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "SR Nagar",
    buyerContact: "+91 98765 43245",
    buyerAddress: "Shop 4, BK Guda Road, SR Nagar, Hyderabad, Telangana 500038",
    buyerLat: 17.4486,
    buyerLng: 78.4374,
    channelOrderId: "ONDC-ORD-119520",
    buyerCode: "BUYER-SKT-620",
    qwipoCustomerId: "QWIP6046957495278770",
    gstNumber: "36AAICS9966G1Z1",
    lineItems: [
      {
        skuCode: "SKU-BRT-BRB400",
        productName: "Britannia Brown Bread 400g",
        shortName: "BBR-400",
        company: "Britannia Industries",
        brand: "Britannia",
        category: "Bakery",
        qty: 21,
        originalPricePerUnit: 50,
        finalPricePerUnit: 50,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1050,
      },
      {
        skuCode: "SKU-BRT-CHZ200",
        productName: "Britannia Cheese Slices 200g",
        shortName: "BCS-200",
        company: "Britannia Industries",
        brand: "Britannia",
        category: "Dairy",
        qty: 6,
        originalPricePerUnit: 140,
        finalPricePerUnit: 140,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 840,
      },
    ],
  },
  {
    id: "QWI-ONDC-260510-Z4C6LU",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Lakshmi Narasimha Stores",
    itemsSummary: "Classmate Long Notebook 172 Pages + 3 more",
    orderValue: 6340,
    paymentMode: "COD",
    orderDate: "2026-05-10",
    customerOrderId: "QWI-ORD-260510-Z4C6LU",
    orderTime: "04:50 PM",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-11",
    actualDeliveryDate: "2026-05-11",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Ameerpet",
    buyerContact: "+91 98765 43246",
    buyerAddress: "Shop 6, Satyam Theatre Road, Ameerpet, Hyderabad, Telangana 500016",
    buyerLat: 17.4357,
    buyerLng: 78.4454,
    channelOrderId: "ONDC-ORD-119577",
    buyerCode: "BUYER-LNS-731",
    qwipoCustomerId: "QWIP6046803674783210",
    gstNumber: "36AAJCL1077H1Z2",
    lineItems: [
      {
        skuCode: "SKU-ITC-CLNB",
        productName: "Classmate Long Notebook 172 Pages",
        shortName: "CLNB-172",
        company: "ITC Limited",
        brand: "Classmate",
        category: "Stationery",
        qty: 24,
        originalPricePerUnit: 45,
        finalPricePerUnit: 45,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1080,
      },
      {
        skuCode: "SKU-ITC-YPN70",
        productName: "Sunfeast YiPPee Magic Masala Noodles 70g",
        shortName: "YPN-70",
        company: "ITC Limited",
        brand: "Yippee",
        category: "Noodles",
        qty: 84,
        originalPricePerUnit: 14,
        finalPricePerUnit: 12.6,
        discountApplied: 117.6,
        discountDetails: "Scheme: 10% off vs ₹14.00",
        lineTotal: 1058.4,
      },
      {
        skuCode: "SKU-ITC-SVLS",
        productName: "Savlon Glycerin Soap 75g",
        shortName: "SVL-75",
        company: "ITC Limited",
        brand: "Savlon",
        category: "Personal Care",
        qty: 44,
        originalPricePerUnit: 30,
        finalPricePerUnit: 27.6,
        discountApplied: 105.6,
        discountDetails: "Scheme: 8% off vs ₹30.00",
        lineTotal: 1214.4,
      },
      {
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 10,
        originalPricePerUnit: 298.72,
        finalPricePerUnit: 298.72,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2987.2,
      },
    ],
  },
  {
    id: "QWI-ONDC-260509-Y7H3PA",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Venkata Ramana Mart",
    itemsSummary: "Saffola Gold Refined Oil 1L + 2 more",
    orderValue: 3055,
    paymentMode: "Prepaid",
    orderDate: "2026-05-09",
    customerOrderId: "QWI-ORD-260509-Y7H3PA",
    orderTime: "02:25 PM",
    status: "Delivered",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-10",
    actualDeliveryDate: "2026-05-10",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Madhapur",
    buyerContact: "+91 98765 43247",
    buyerAddress: "Shop 18, Hitech City Road, Madhapur, Hyderabad, Telangana 500081",
    buyerLat: 17.4474,
    buyerLng: 78.3762,
    channelOrderId: "FLPK-ORD-661590",
    buyerCode: "BUYER-VRM-842",
    qwipoCustomerId: "QWIP6093182213570386",
    gstNumber: "36AAKCV2188J1Z3",
    lineItems: [
      {
        skuCode: "SKU-MRC-SFL1",
        productName: "Saffola Gold Refined Oil 1L",
        shortName: "SFG-1L",
        company: "Marico Limited",
        brand: "Saffola",
        category: "Edible Oil",
        qty: 6,
        originalPricePerUnit: 195,
        finalPricePerUnit: 185.25,
        discountApplied: 58.5,
        discountDetails: "Scheme: 5% off vs ₹195.00",
        lineTotal: 1111.5,
      },
      {
        skuCode: "SKU-MRC-PCO250",
        productName: "Parachute Pure Coconut Oil 250ml",
        shortName: "PCO-250",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Hair Care",
        qty: 12,
        originalPricePerUnit: 98,
        finalPricePerUnit: 98,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1176,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 2,
        originalPricePerUnit: 383.75,
        finalPricePerUnit: 383.75,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 767.5,
      },
    ],
  },

  // [Confirmed · Standard · tomorrow]. Already confirmed for
  // tomorrow — visible on the Confirmed tab when filtering Non-Beat.
  {
    id: "QWI-AMZN-260519-G4D7VX",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "Sunshine Kirana",
    itemsSummary: "Livon Serum 100ml + 2 more",
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
    qwipoCustomerId: "QWIP6062834269565837",
    gstNumber: "36AAUCS2137L1ZC",
    lineItems: [
      {
        skuCode: "SKU-MRC-LVT",
        productName: "Livon Serum 100ml",
        shortName: "LVS-100",
        company: "Marico Limited",
        brand: "Livon",
        category: "Hair Care",
        qty: 6,
        originalPricePerUnit: 245,
        finalPricePerUnit: 245,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1470,
      },
      {
        skuCode: "SKU-MRC-PCO500",
        productName: "Parachute Pure Coconut Oil 500ml",
        shortName: "PCO-500",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 6,
        originalPricePerUnit: 180,
        finalPricePerUnit: 171,
        discountApplied: 54,
        discountDetails: "Scheme: 5% off vs ₹180.00",
        lineTotal: 1026,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 5,
        originalPricePerUnit: 380.8,
        finalPricePerUnit: 380.8,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1904,
      },
    ],
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
    itemsSummary: "Aashirvaad Whole Wheat Atta 1kg + 2 more",
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
    qwipoCustomerId: "QWIP6078668367661533",
    gstNumber: "36AADCM8265F1ZP",
    lineItems: [
      {
        skuCode: "SKU-ITC-AASH1",
        productName: "Aashirvaad Whole Wheat Atta 1kg",
        shortName: "AASH-1K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 20,
        originalPricePerUnit: 62,
        finalPricePerUnit: 58.9,
        discountApplied: 62,
        discountDetails: "Scheme: 5% off vs ₹62.00",
        lineTotal: 1178,
      },
      {
        skuCode: "SKU-ITC-SDF75",
        productName: "Sunfeast Dark Fantasy Choco Fills 75g",
        shortName: "SDF-75",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 36,
        originalPricePerUnit: 40,
        finalPricePerUnit: 36.8,
        discountApplied: 115.2,
        discountDetails: "Scheme: 8% off vs ₹40.00",
        lineTotal: 1324.8,
      },
      {
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 10,
        originalPricePerUnit: 269.72,
        finalPricePerUnit: 269.72,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2697.2,
      },
    ],
  },

  // [Delivered · Standard · on time]. Non-beat delivered example —
  // anchor for "what delivered Standard orders look like" in history.
  {
    id: "QWI-AMZN-260515-Z2H5BS",
    brand: "Pepsi",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "Greenfield Mart",
    itemsSummary: "Pepsi Soft Drink 2.25L + 2 more",
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
    qwipoCustomerId: "QWIP6065709357048075",
    gstNumber: "36AAPCG6873B1ZS",
    lineItems: [
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 7,
        originalPricePerUnit: 95,
        finalPricePerUnit: 87.4,
        discountApplied: 53.2,
        discountDetails: "Scheme: 8% off vs ₹95.00",
        lineTotal: 611.8,
      },
      {
        skuCode: "SKU-PEP-PS750",
        productName: "Pepsi Soft Drink 750ml",
        shortName: "PEP-750",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 24,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 960,
      },
      {
        skuCode: "SKU-PEP-TRP",
        productName: "Tropicana Orange Juice 1L",
        shortName: "TOJ-1L",
        company: "PepsiCo India",
        brand: "Tropicana",
        category: "Beverages",
        qty: 10,
        originalPricePerUnit: 117.82,
        finalPricePerUnit: 117.82,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1178.2,
      },
    ],
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
    itemsSummary: "Sunfeast Dark Fantasy Choco Fills 75g + 3 more",
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
    qwipoCustomerId: "QWIP6095417856334092",
    channelOrderId: "ONDC-ORD-450201",
    gstNumber: "36AABCC4521E1ZC",
    lineItems: [
      {
        skuCode: "SKU-ITC-SDF75",
        productName: "Sunfeast Dark Fantasy Choco Fills 75g",
        shortName: "SDF-75",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 48,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1920,
      },
      {
        skuCode: "SKU-ITC-SVLS",
        productName: "Savlon Glycerin Soap 75g",
        shortName: "SVL-75",
        company: "ITC Limited",
        brand: "Savlon",
        category: "Personal Care",
        qty: 40,
        originalPricePerUnit: 30,
        finalPricePerUnit: 30,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1200,
      },
      {
        skuCode: "SKU-ITC-AASH1",
        productName: "Aashirvaad Whole Wheat Atta 1kg",
        shortName: "AASH-1K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 30,
        originalPricePerUnit: 62,
        finalPricePerUnit: 62,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1860,
      },
      {
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 12,
        originalPricePerUnit: 285,
        finalPricePerUnit: 285,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 3420,
      },
    ],
  },
  {
    id: "QWI-ONDC-260520-MD9F2B",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "City Supermart",
    itemsSummary: "Parachute Pure Coconut Oil 250ml + 2 more",
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
    qwipoCustomerId: "QWIP6095417856334092",
    channelOrderId: "ONDC-ORD-450202",
    gstNumber: "36AABCC4521E1ZC",
    lineItems: [
      {
        skuCode: "SKU-MRC-PCO250",
        productName: "Parachute Pure Coconut Oil 250ml",
        shortName: "PCO-250",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Hair Care",
        qty: 24,
        originalPricePerUnit: 98,
        finalPricePerUnit: 93.1,
        discountApplied: 117.6,
        discountDetails: "Scheme: 5% off vs ₹98.00",
        lineTotal: 2234.4,
      },
      {
        skuCode: "SKU-MRC-PCO500",
        productName: "Parachute Pure Coconut Oil 500ml",
        shortName: "PCO-500",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 12,
        originalPricePerUnit: 180,
        finalPricePerUnit: 165.6,
        discountApplied: 172.8,
        discountDetails: "Scheme: 8% off vs ₹180.00",
        lineTotal: 1987.2,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 3,
        originalPricePerUnit: 392.8,
        finalPricePerUnit: 392.8,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1178.4,
      },
    ],
  },
  {
    id: "QWI-FLPK-260520-MD9F3C",
    brand: "Freedom",
    company: "Gemini Edibles & Fats India",
    source: "DMS-Bizom",
    retailerName: "City Supermart",
    itemsSummary: "Freedom Groundnut Oil 1L + 2 more",
    orderValue: 4200,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-MD9F0X",
    orderTime: "10:10 AM",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-22",
    deliveryType: "Regular",
    beatName: "Madhapur",
    orderType: "beat",
    buyerContact: "+91 98765 43226",
    buyerCode: "BUYER-CSM-101",
    qwipoCustomerId: "QWIP6095417856334092",
    channelOrderId: "FLPK-ORD-450203",
    gstNumber: "36AABCC4521E1ZC",
    lineItems: [
      {
        skuCode: "SKU-GEF-FGN1",
        productName: "Freedom Groundnut Oil 1L",
        shortName: "FGN-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 210,
        finalPricePerUnit: 210,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2100,
      },
      {
        skuCode: "SKU-GEF-FSO1",
        productName: "Freedom Refined Sunflower Oil 1L Pouch",
        shortName: "FSO-1L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 145,
        finalPricePerUnit: 145,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1450,
      },
      {
        skuCode: "SKU-GEF-FSO5",
        productName: "Freedom Refined Sunflower Oil 5L Jar",
        shortName: "FSO-5L",
        company: "Gemini Edibles & Fats India",
        brand: "Freedom",
        category: "Edible Oil",
        qty: 1,
        originalPricePerUnit: 650,
        finalPricePerUnit: 650,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 650,
      },
    ],
  },
  {
    id: "QWI-AMZN-260520-MD9F4D",
    brand: "Adani Wilmar",
    company: "Adani Wilmar Ltd",
    source: "DMS-Botery",
    retailerName: "City Supermart",
    itemsSummary: "Fortune Biryani Special Basmati Rice 5kg + 2 more",
    orderValue: 3600,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-MD9F0X",
    orderTime: "10:13 AM",
    status: "New",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-23",
    deliveryType: "Regular",
    beatName: "Madhapur",
    orderType: "beat",
    buyerContact: "+91 98765 43226",
    buyerCode: "BUYER-CSM-101",
    qwipoCustomerId: "QWIP6095417856334092",
    channelOrderId: "AMZN-ORD-450204",
    gstNumber: "36AABCC4521E1ZC",
    lineItems: [
      {
        skuCode: "SKU-AWL-FBR5",
        productName: "Fortune Biryani Special Basmati Rice 5kg",
        shortName: "FBR-5K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 1,
        originalPricePerUnit: 620,
        finalPricePerUnit: 620,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 620,
      },
      {
        skuCode: "SKU-AWL-FBS1",
        productName: "Fortune Besan 1kg",
        shortName: "FBS-1K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 10,
        originalPricePerUnit: 110,
        finalPricePerUnit: 99,
        discountApplied: 110,
        discountDetails: "Scheme: 10% off vs ₹110.00",
        lineTotal: 990,
      },
      {
        skuCode: "SKU-AWL-FCA5",
        productName: "Fortune Chakki Fresh Atta 5kg",
        shortName: "FCA-5K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 8,
        originalPricePerUnit: 248.75,
        finalPricePerUnit: 248.75,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1990,
      },
    ],
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
    itemsSummary: "Fortune Kachi Ghani Mustard Oil 1L + 3 more",
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
    qwipoCustomerId: "QWIP6046080224774902",
    gstNumber: "36AANCS9517Z1ZQ",
    lineItems: [
      {
        skuCode: "SKU-AWL-FKG1",
        productName: "Fortune Kachi Ghani Mustard Oil 1L",
        shortName: "FKG-1L",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 175,
        finalPricePerUnit: 161,
        discountApplied: 140,
        discountDetails: "Scheme: 8% off vs ₹175.00",
        lineTotal: 1610,
      },
      {
        skuCode: "SKU-AWL-FBS1",
        productName: "Fortune Besan 1kg",
        shortName: "FBS-1K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 10,
        originalPricePerUnit: 110,
        finalPricePerUnit: 110,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1100,
      },
      {
        skuCode: "SKU-AWL-FSF1",
        productName: "Fortune Sunlite Refined Sunflower Oil 1L",
        shortName: "FSL-1L",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 150,
        finalPricePerUnit: 142.5,
        discountApplied: 75,
        discountDetails: "Scheme: 5% off vs ₹150.00",
        lineTotal: 1425,
      },
      {
        skuCode: "SKU-AWL-FCA5",
        productName: "Fortune Chakki Fresh Atta 5kg",
        shortName: "FCA-5K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 10,
        originalPricePerUnit: 261.5,
        finalPricePerUnit: 261.5,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2615,
      },
    ],
  },
  // ── Customer-wise view demo — multi-company customer orders for
  // every tab, incl. one whose company orders sit in different
  // statuses and two handed to the 3PL partner. ──
  {
    id: "QWI-ONDC-260519-MXD1A1",
    brand: "Aashirvaad",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Mahalakshmi Stores",
    itemsSummary: "Aashirvaad Whole Wheat Atta 1kg + 3 more",
    orderValue: 9450,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    orderTime: "11:40 AM",
    customerOrderId: "QWI-ORD-260519-MXD7K2",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "KPHB 1",
    orderType: "beat",
    buyerContact: "+91 98765 43301",
    buyerCode: "BUYER-MHS-311",
    qwipoCustomerId: "QWIP6032022026941329",
    retailerCompanyId: "ITC-RT-458213",
    channelOrderId: "ONDC-ORD-930101",
    gstNumber: "36AAFCM4521K1ZP",
    buyerAddress: "Shop 4, KPHB Colony Main Road, Kukatpally, Hyderabad, Telangana 500072",
    buyerLat: 17.4948,
    buyerLng: 78.3996,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-ITC-AASH1",
        productName: "Aashirvaad Whole Wheat Atta 1kg",
        shortName: "AASH-1K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 30,
        originalPricePerUnit: 62,
        finalPricePerUnit: 55.8,
        discountApplied: 186,
        discountDetails: "Scheme: 10% off vs ₹62.00",
        lineTotal: 1674,
      },
      {
        skuCode: "SKU-ITC-SMRC",
        productName: "Sunfeast Marie Light 250g",
        shortName: "SML-250",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 48,
        originalPricePerUnit: 35,
        finalPricePerUnit: 33.25,
        discountApplied: 84,
        discountDetails: "Scheme: 5% off vs ₹35.00",
        lineTotal: 1596,
      },
      {
        skuCode: "SKU-ITC-SVLS",
        productName: "Savlon Glycerin Soap 75g",
        shortName: "SVL-75",
        company: "ITC Limited",
        brand: "Savlon",
        category: "Personal Care",
        qty: 64,
        originalPricePerUnit: 30,
        finalPricePerUnit: 27.6,
        discountApplied: 153.6,
        discountDetails: "Scheme: 8% off vs ₹30.00",
        lineTotal: 1766.4,
      },
      {
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 16,
        originalPricePerUnit: 275.85,
        finalPricePerUnit: 275.85,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4413.6,
      },
    ],
  },
  {
    id: "QWI-ONDC-260519-MXD2B2",
    brand: "Surf Excel",
    company: "Hindustan Unilever",
    source: "DMS-Bizom",
    retailerName: "Mahalakshmi Stores",
    itemsSummary: "Surf Excel Easy Wash Detergent Powder 1kg + 2 more",
    orderValue: 5280,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    orderTime: "11:42 AM",
    customerOrderId: "QWI-ORD-260519-MXD7K2",
    status: "Confirmed",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-22",
    deliveryType: "Regular",
    beatName: "KPHB 1",
    orderType: "beat",
    buyerContact: "+91 98765 43301",
    buyerCode: "BUYER-MHS-311",
    qwipoCustomerId: "QWIP6032022026941329",
    retailerCompanyId: "HUL-RT-772940",
    channelOrderId: "ONDC-ORD-930102",
    gstNumber: "36AAFCM4521K1ZP",
    buyerAddress: "Shop 4, KPHB Colony Main Road, Kukatpally, Hyderabad, Telangana 500072",
    buyerLat: 17.4948,
    buyerLng: 78.3996,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-HUL-SEW1",
        productName: "Surf Excel Easy Wash Detergent Powder 1kg",
        shortName: "SEW-1K",
        company: "Hindustan Unilever",
        brand: "Surf Excel",
        category: "Home Care",
        qty: 12,
        originalPricePerUnit: 140,
        finalPricePerUnit: 126,
        discountApplied: 168,
        discountDetails: "Scheme: 10% off vs ₹140.00",
        lineTotal: 1512,
      },
      {
        skuCode: "SKU-HUL-VIM",
        productName: "Vim Dishwash Bar 300g",
        shortName: "VIM-300",
        company: "Hindustan Unilever",
        brand: "Vim",
        category: "Home Care",
        qty: 48,
        originalPricePerUnit: 30,
        finalPricePerUnit: 30,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1440,
      },
      {
        skuCode: "SKU-HUL-SML2",
        productName: "Surf Excel Matic Liquid Detergent 2L",
        shortName: "SEM-2L",
        company: "Hindustan Unilever",
        brand: "Surf Excel",
        category: "Home Care",
        qty: 5,
        originalPricePerUnit: 465.6,
        finalPricePerUnit: 465.6,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2328,
      },
    ],
  },
  {
    id: "QWI-ONDC-260519-MXD3C3",
    brand: "Maggi",
    company: "Nestle India",
    source: "DMS-Bizom",
    retailerName: "Mahalakshmi Stores",
    itemsSummary: "Maggi 2-Minute Masala Noodles 280g + 2 more",
    orderValue: 2880,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    orderTime: "11:45 AM",
    customerOrderId: "QWI-ORD-260519-MXD7K2",
    status: "Cancelled",
    cancellationReason: "Out of Stock",
    cancelledBy: "Seller",
    cancellationTime: "2026-05-19T15:10:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-23",
    deliveryType: "Regular",
    beatName: "KPHB 1",
    orderType: "beat",
    buyerContact: "+91 98765 43301",
    buyerCode: "BUYER-MHS-311",
    qwipoCustomerId: "QWIP6032022026941329",
    retailerCompanyId: "NES-RT-319675",
    channelOrderId: "ONDC-ORD-930103",
    gstNumber: "36AAFCM4521K1ZP",
    buyerAddress: "Shop 4, KPHB Colony Main Road, Kukatpally, Hyderabad, Telangana 500072",
    buyerLat: 17.4948,
    buyerLng: 78.3996,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-NES-MMN280",
        productName: "Maggi 2-Minute Masala Noodles 280g",
        shortName: "MMN-280",
        company: "Nestle India",
        brand: "Maggi",
        category: "Noodles",
        qty: 18,
        originalPricePerUnit: 56,
        finalPricePerUnit: 56,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1008,
      },
      {
        skuCode: "SKU-NES-MKS",
        productName: "Maggi Rich Tomato Ketchup 1kg",
        shortName: "MTK-1K",
        company: "Nestle India",
        brand: "Maggi",
        category: "Sauces",
        qty: 6,
        originalPricePerUnit: 150,
        finalPricePerUnit: 150,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 900,
      },
      {
        skuCode: "SKU-NES-MLK",
        productName: "Nestle Everyday Dairy Whitener 1kg",
        shortName: "NEW-1K",
        company: "Nestle India",
        brand: "Nestle",
        category: "Dairy",
        qty: 2,
        originalPricePerUnit: 486,
        finalPricePerUnit: 486,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 972,
      },
    ],
  },
  {
    id: "QWI-ONDC-260518-LGX1M1",
    brand: "Parachute",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Sri Lakshmi Ganapathi Traders",
    itemsSummary: "Parachute Pure Coconut Oil 500ml + 3 more",
    orderValue: 7200,
    paymentMode: "COD",
    orderDate: "2026-05-18",
    orderTime: "04:05 PM",
    customerOrderId: "QWI-ORD-260518-LGX4P8",
    status: "Confirmed",
    logisticsRequested: true,
    logisticsRequestedAt: "2026-05-19T10:15:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    beatName: "SR Nagar",
    orderType: "beat",
    buyerContact: "+91 98765 43302",
    buyerCode: "BUYER-SLG-312",
    qwipoCustomerId: "QWIP6036865685971305",
    channelOrderId: "ONDC-ORD-930201",
    gstNumber: "36AAKFS7734L1ZQ",
    buyerAddress: "Plot 22, SR Nagar Main Road, Sanjeeva Reddy Nagar, Hyderabad, Telangana 500038",
    buyerLat: 17.4416,
    buyerLng: 78.4425,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-MRC-PCO500",
        productName: "Parachute Pure Coconut Oil 500ml",
        shortName: "PCO-500",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 6,
        originalPricePerUnit: 180,
        finalPricePerUnit: 162,
        discountApplied: 108,
        discountDetails: "Scheme: 10% off vs ₹180.00",
        lineTotal: 972,
      },
      {
        skuCode: "SKU-MRC-PCO250",
        productName: "Parachute Pure Coconut Oil 250ml",
        shortName: "PCO-250",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Hair Care",
        qty: 12,
        originalPricePerUnit: 98,
        finalPricePerUnit: 98,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1176,
      },
      {
        skuCode: "SKU-MRC-NHR",
        productName: "Nihar Naturals Shanti Amla Hair Oil 300ml",
        shortName: "NSA-300",
        company: "Marico Limited",
        brand: "Nihar",
        category: "Hair Care",
        qty: 12,
        originalPricePerUnit: 120,
        finalPricePerUnit: 120,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1440,
      },
      {
        skuCode: "SKU-MRC-PCO1J",
        productName: "Parachute Pure Coconut Oil 1L Jar",
        shortName: "PCO-1LJ",
        company: "Marico Limited",
        brand: "Parachute",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 361.2,
        finalPricePerUnit: 361.2,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 3612,
      },
    ],
  },
  {
    id: "QWI-ONDC-260518-LGX2D2",
    brand: "Dabur Red",
    company: "Dabur India",
    source: "DMS-Bizom",
    retailerName: "Sri Lakshmi Ganapathi Traders",
    itemsSummary: "Dabur Amla Hair Oil 275ml + 2 more",
    orderValue: 4560,
    paymentMode: "COD",
    orderDate: "2026-05-18",
    orderTime: "04:09 PM",
    customerOrderId: "QWI-ORD-260518-LGX4P8",
    status: "Confirmed",
    logisticsRequested: true,
    logisticsRequestedAt: "2026-05-19T10:15:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-22",
    deliveryType: "Regular",
    beatName: "SR Nagar",
    orderType: "beat",
    buyerContact: "+91 98765 43302",
    buyerCode: "BUYER-SLG-312",
    qwipoCustomerId: "QWIP6036865685971305",
    channelOrderId: "ONDC-ORD-930202",
    gstNumber: "36AAKFS7734L1ZQ",
    buyerAddress: "Plot 22, SR Nagar Main Road, Sanjeeva Reddy Nagar, Hyderabad, Telangana 500038",
    buyerLat: 17.4416,
    buyerLng: 78.4425,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-DAB-AMLA",
        productName: "Dabur Amla Hair Oil 275ml",
        shortName: "DAH-275",
        company: "Dabur India",
        brand: "Dabur",
        category: "Hair Care",
        qty: 12,
        originalPricePerUnit: 140,
        finalPricePerUnit: 128.8,
        discountApplied: 134.4,
        discountDetails: "Scheme: 8% off vs ₹140.00",
        lineTotal: 1545.6,
      },
      {
        skuCode: "SKU-DAB-HNY250",
        productName: "Dabur Honey 250g",
        shortName: "DHN-250",
        company: "Dabur India",
        brand: "Dabur",
        category: "Health Care",
        qty: 6,
        originalPricePerUnit: 125,
        finalPricePerUnit: 125,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 750,
      },
      {
        skuCode: "SKU-DAB-RLJ1",
        productName: "Real Fruit Power Mixed Fruit Juice 1L",
        shortName: "RMF-1L",
        company: "Dabur India",
        brand: "Real",
        category: "Beverages",
        qty: 20,
        originalPricePerUnit: 113.22,
        finalPricePerUnit: 113.22,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2264.4,
      },
    ],
  },
  {
    id: "QWI-ONDC-260518-LGS9Q1",
    brand: "Fortune",
    company: "Adani Wilmar Ltd",
    source: "DMS-Bizom",
    retailerName: "Venkateshwara Kirana",
    itemsSummary: "Fortune Sunlite Refined Sunflower Oil 1L + 3 more",
    orderValue: 6300,
    paymentMode: "COD",
    orderDate: "2026-05-18",
    orderTime: "05:30 PM",
    customerOrderId: "QWI-ORD-260518-LGS9Q1",
    status: "Confirmed",
    logisticsRequested: true,
    logisticsRequestedAt: "2026-05-19T11:00:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Urgent",
    orderType: "standard",
    buyerContact: "+91 98765 43303",
    buyerCode: "BUYER-VKK-313",
    qwipoCustomerId: "QWIP6045723748174892",
    channelOrderId: "ONDC-ORD-930203",
    buyerAddress: "H.No 8-3-214, Yousufguda Main Road, Hyderabad, Telangana 500045",
    buyerLat: 17.4344,
    buyerLng: 78.4251,
    connectivity: "Offline",
    lineItems: [
      {
        skuCode: "SKU-AWL-FSF1",
        productName: "Fortune Sunlite Refined Sunflower Oil 1L",
        shortName: "FSL-1L",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 150,
        finalPricePerUnit: 150,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1500,
      },
      {
        skuCode: "SKU-AWL-FKG1",
        productName: "Fortune Kachi Ghani Mustard Oil 1L",
        shortName: "FKG-1L",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Edible Oil",
        qty: 10,
        originalPricePerUnit: 175,
        finalPricePerUnit: 175,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1750,
      },
      {
        skuCode: "SKU-AWL-FBS1",
        productName: "Fortune Besan 1kg",
        shortName: "FBS-1K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 10,
        originalPricePerUnit: 110,
        finalPricePerUnit: 110,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1100,
      },
      {
        skuCode: "SKU-AWL-FCA5",
        productName: "Fortune Chakki Fresh Atta 5kg",
        shortName: "FCA-5K",
        company: "Adani Wilmar Ltd",
        brand: "Fortune",
        category: "Foodgrains",
        qty: 8,
        originalPricePerUnit: 243.75,
        finalPricePerUnit: 243.75,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1950,
      },
    ],
  },
  {
    id: "QWI-ONDC-260517-DLV1I1",
    brand: "Sunfeast",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Ganga Super Market",
    itemsSummary: "Sunfeast Marie Light 250g + 3 more",
    orderValue: 11250,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    orderTime: "10:20 AM",
    customerOrderId: "QWI-ORD-260517-DLV3M6",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-18",
    actualDeliveryDate: "2026-05-18",
    deliveryType: "Regular",
    beatName: "Ameerpet",
    orderType: "beat",
    buyerContact: "+91 98765 43304",
    buyerCode: "BUYER-GSM-314",
    qwipoCustomerId: "QWIP6060932331646306",
    channelOrderId: "ONDC-ORD-930301",
    gstNumber: "36AAJCG2210M1ZR",
    buyerAddress: "Shop 9, Ameerpet X Roads, Ameerpet, Hyderabad, Telangana 500016",
    buyerLat: 17.4375,
    buyerLng: 78.4482,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-ITC-SMRC",
        productName: "Sunfeast Marie Light 250g",
        shortName: "SML-250",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 72,
        originalPricePerUnit: 35,
        finalPricePerUnit: 35,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2520,
      },
      {
        skuCode: "SKU-ITC-SDF75",
        productName: "Sunfeast Dark Fantasy Choco Fills 75g",
        shortName: "SDF-75",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Biscuits",
        qty: 60,
        originalPricePerUnit: 40,
        finalPricePerUnit: 40,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2400,
      },
      {
        skuCode: "SKU-ITC-AASH1",
        productName: "Aashirvaad Whole Wheat Atta 1kg",
        shortName: "AASH-1K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 30,
        originalPricePerUnit: 62,
        finalPricePerUnit: 62,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1860,
      },
      {
        skuCode: "SKU-ITC-AASH5",
        productName: "Aashirvaad Whole Wheat Atta 5kg",
        shortName: "AASH-5K",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Foodgrains",
        qty: 15,
        originalPricePerUnit: 298,
        finalPricePerUnit: 298,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 4470,
      },
    ],
  },
  {
    id: "QWI-ONDC-260517-DLV2P2",
    brand: "Lay's",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "Ganga Super Market",
    itemsSummary: "Lay's India's Magic Masala 52g + 3 more",
    orderValue: 6400,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    orderTime: "10:24 AM",
    customerOrderId: "QWI-ORD-260517-DLV3M6",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-19",
    actualDeliveryDate: "2026-05-19",
    deliveryType: "Regular",
    beatName: "Ameerpet",
    orderType: "beat",
    buyerContact: "+91 98765 43304",
    buyerCode: "BUYER-GSM-314",
    qwipoCustomerId: "QWIP6060932331646306",
    channelOrderId: "ONDC-ORD-930302",
    gstNumber: "36AAJCG2210M1ZR",
    buyerAddress: "Shop 9, Ameerpet X Roads, Ameerpet, Hyderabad, Telangana 500016",
    buyerLat: 17.4375,
    buyerLng: 78.4482,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-PEP-LMM52",
        productName: "Lay's India's Magic Masala 52g",
        shortName: "LMM-52",
        company: "PepsiCo India",
        brand: "Lay's",
        category: "Snacks",
        qty: 50,
        originalPricePerUnit: 20,
        finalPricePerUnit: 19,
        discountApplied: 50,
        discountDetails: "Scheme: 5% off vs ₹20.00",
        lineTotal: 950,
      },
      {
        skuCode: "SKU-PEP-LCS52",
        productName: "Lay's Classic Salted Chips 52g",
        shortName: "LCS-52",
        company: "PepsiCo India",
        brand: "Lay's",
        category: "Snacks",
        qty: 70,
        originalPricePerUnit: 20,
        finalPricePerUnit: 20,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1400,
      },
      {
        skuCode: "SKU-PEP-TRP",
        productName: "Tropicana Orange Juice 1L",
        shortName: "TOJ-1L",
        company: "PepsiCo India",
        brand: "Tropicana",
        category: "Beverages",
        qty: 11,
        originalPricePerUnit: 120,
        finalPricePerUnit: 120,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1320,
      },
      {
        skuCode: "SKU-PEP-PS2L",
        productName: "Pepsi Soft Drink 2.25L",
        shortName: "PEP-2L",
        company: "PepsiCo India",
        brand: "Pepsi",
        category: "Beverages",
        qty: 28,
        originalPricePerUnit: 97.5,
        finalPricePerUnit: 97.5,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 2730,
      },
    ],
  },
  {
    id: "QWI-ONDC-260517-DLV3B3",
    brand: "Good Day",
    company: "Britannia Industries",
    source: "DMS-Bizom",
    retailerName: "Ganga Super Market",
    itemsSummary: "Britannia Good Day Cashew Cookies 200g + 2 more",
    orderValue: 3850,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    orderTime: "10:27 AM",
    customerOrderId: "QWI-ORD-260517-DLV3M6",
    status: "Delivered",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-19",
    actualDeliveryDate: "2026-05-19",
    deliveryType: "Regular",
    beatName: "Ameerpet",
    orderType: "beat",
    buyerContact: "+91 98765 43304",
    buyerCode: "BUYER-GSM-314",
    qwipoCustomerId: "QWIP6060932331646306",
    channelOrderId: "ONDC-ORD-930303",
    gstNumber: "36AAJCG2210M1ZR",
    buyerAddress: "Shop 9, Ameerpet X Roads, Ameerpet, Hyderabad, Telangana 500016",
    buyerLat: 17.4375,
    buyerLng: 78.4482,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-BRT-GDC200",
        productName: "Britannia Good Day Cashew Cookies 200g",
        shortName: "GDC-200",
        company: "Britannia Industries",
        brand: "Good Day",
        category: "Biscuits",
        qty: 36,
        originalPricePerUnit: 35,
        finalPricePerUnit: 35,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1260,
      },
      {
        skuCode: "SKU-BRT-50T",
        productName: "Britannia 50-50 Maska Chaska 120g",
        shortName: "5050-120",
        company: "Britannia Industries",
        brand: "Britannia",
        category: "Biscuits",
        qty: 48,
        originalPricePerUnit: 30,
        finalPricePerUnit: 30,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1440,
      },
      {
        skuCode: "SKU-BRT-BRB400",
        productName: "Britannia Brown Bread 400g",
        shortName: "BBR-400",
        company: "Britannia Industries",
        brand: "Britannia",
        category: "Bakery",
        qty: 23,
        originalPricePerUnit: 50,
        finalPricePerUnit: 50,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1150,
      },
    ],
  },
  {
    id: "QWI-ONDC-260518-CNL1G1",
    brand: "Cinthol",
    company: "Godrej Consumer Products",
    source: "DMS-Bizom",
    retailerName: "Sai Balaji General Stores",
    itemsSummary: "Cinthol Lime Soap 100g + 2 more",
    orderValue: 2640,
    paymentMode: "COD",
    orderDate: "2026-05-18",
    orderTime: "09:45 AM",
    customerOrderId: "QWI-ORD-260518-CNL5R4",
    status: "Cancelled",
    cancellationReason: "Ordered by mistake",
    cancelledBy: "Buyer",
    cancellationTime: "2026-05-18T11:05:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-19",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43305",
    buyerCode: "BUYER-SBG-315",
    qwipoCustomerId: "QWIP6014706095497204",
    channelOrderId: "ONDC-ORD-930401",
    buyerAddress: "Shop 2, Dilsukhnagar Main Road, Dilsukhnagar, Hyderabad, Telangana 500060",
    buyerLat: 17.3688,
    buyerLng: 78.5247,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-GCP-CLS100",
        productName: "Cinthol Lime Soap 100g",
        shortName: "CLS-100",
        company: "Godrej Consumer Products",
        brand: "Cinthol",
        category: "Personal Care",
        qty: 20,
        originalPricePerUnit: 44,
        finalPricePerUnit: 44,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 880,
      },
      {
        skuCode: "SKU-GCP-GNS100",
        productName: "Godrej No.1 Sandal Soap 100g",
        shortName: "GN1-100",
        company: "Godrej Consumer Products",
        brand: "Godrej No.1",
        category: "Personal Care",
        qty: 24,
        originalPricePerUnit: 30,
        finalPricePerUnit: 30,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 720,
      },
      {
        skuCode: "SKU-GCP-EZL",
        productName: "Godrej Ezee Liquid Detergent 1kg",
        shortName: "EZL-1K",
        company: "Godrej Consumer Products",
        brand: "Ezee",
        category: "Home Care",
        qty: 5,
        originalPricePerUnit: 208,
        finalPricePerUnit: 208,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1040,
      },
    ],
  },
  {
    id: "QWI-ONDC-260518-CNL2C2",
    brand: "Colgate",
    company: "Colgate-Palmolive India",
    source: "DMS-Bizom",
    retailerName: "Sai Balaji General Stores",
    itemsSummary: "Colgate MaxFresh Gel 150g + 2 more",
    orderValue: 3360,
    paymentMode: "COD",
    orderDate: "2026-05-18",
    orderTime: "09:48 AM",
    customerOrderId: "QWI-ORD-260518-CNL5R4",
    status: "Cancelled",
    cancellationReason: "Ordered by mistake",
    cancelledBy: "Buyer",
    cancellationTime: "2026-05-18T11:05:00+05:30",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-20",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43305",
    buyerCode: "BUYER-SBG-315",
    qwipoCustomerId: "QWIP6014706095497204",
    channelOrderId: "ONDC-ORD-930402",
    buyerAddress: "Shop 2, Dilsukhnagar Main Road, Dilsukhnagar, Hyderabad, Telangana 500060",
    buyerLat: 17.3688,
    buyerLng: 78.5247,
    connectivity: "Online",
    lineItems: [
      {
        skuCode: "SKU-CPL-CMG150",
        productName: "Colgate MaxFresh Gel 150g",
        shortName: "CMF-150",
        company: "Colgate-Palmolive India",
        brand: "Colgate",
        category: "Oral Care",
        qty: 12,
        originalPricePerUnit: 95,
        finalPricePerUnit: 95,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1140,
      },
      {
        skuCode: "SKU-CPL-CST200",
        productName: "Colgate Strong Teeth Toothpaste 200g",
        shortName: "CST-200",
        company: "Colgate-Palmolive India",
        brand: "Colgate",
        category: "Oral Care",
        qty: 12,
        originalPricePerUnit: 70,
        finalPricePerUnit: 63,
        discountApplied: 84,
        discountDetails: "Scheme: 10% off vs ₹70.00",
        lineTotal: 756,
      },
      {
        skuCode: "SKU-CPL-CFP",
        productName: "Colgate Family Pack Toothpaste 4 x 150g",
        shortName: "CFP-4X",
        company: "Colgate-Palmolive India",
        brand: "Colgate",
        category: "Oral Care",
        qty: 4,
        originalPricePerUnit: 366,
        finalPricePerUnit: 366,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1464,
      },
    ],
  },
];

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

// ---- Keep the demo data current ----
// The seed was written around SEED_TODAY. When the app loads, every
// date in it moves forward by the days between SEED_TODAY and the real
// today, so the demo always shows this month's orders with the same
// relative timing (order ages, pending days, upcoming deliveries).
// Deliveries never land on a Sunday.
const SEED_TODAY = "2026-05-20";
const LOCAL_TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();
const SEED_SHIFT_DAYS = Math.round(
  (Date.parse(`${LOCAL_TODAY}T00:00:00Z`) - Date.parse(`${SEED_TODAY}T00:00:00Z`)) / 86400000,
);
const shiftSeedDate = (iso: string): string => {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return iso;
  return new Date(t + SEED_SHIFT_DAYS * 86400000).toISOString().slice(0, 10);
};
const skipSunday = (iso: string): string => {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).getUTCDay() !== 0) return iso;
  return new Date(t + 86400000).toISOString().slice(0, 10);
};
// ISO timestamps keep their time and zone; only the date part moves.
const shiftSeedStamp = (ts: string): string =>
  /^\d{4}-\d{2}-\d{2}/.test(ts) ? shiftSeedDate(ts.slice(0, 10)) + ts.slice(10) : ts;
function shiftSeedOrder(o: Order): Order {
  if (!SEED_SHIFT_DAYS) return o;
  const delivery = skipSunday(shiftSeedDate(o.expectedDeliveryDate));
  const next: Order = { ...o, orderDate: shiftSeedDate(o.orderDate), expectedDeliveryDate: delivery };
  if (o.actualDeliveryDate) {
    next.actualDeliveryDate =
      o.actualDeliveryDate === o.expectedDeliveryDate
        ? delivery
        : skipSunday(shiftSeedDate(o.actualDeliveryDate));
  }
  if (o.cancellationTime) next.cancellationTime = shiftSeedStamp(o.cancellationTime);
  if (o.logisticsRequestedAt) next.logisticsRequestedAt = shiftSeedStamp(o.logisticsRequestedAt);
  return next;
}

let _orders: Order[] = seedOrders.map(shiftSeedOrder);
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

// ---- Customer-wise view ----
//
// One buyer-app checkout splits into one seller order per company
// (see {@link getCustomerOrderId}). The Orders list's Customer-wise
// view folds those company orders back into one row per checkout.
// Grouping is purely a read-side projection: it never creates, edits
// or merges the underlying company orders.

/** Every company order that came from one customer checkout. */
export interface CustomerCheckout {
  /** The shared checkout reference (`customerOrderId`, or the order's
   *  own id for legacy orders that were never clubbed). */
  checkoutId: string;
  orders: Order[];
}

/** Group orders by checkout, keeping the order they first appear in.
 *  Matches on the checkout reference only — two checkouts by the same
 *  customer stay separate. */
export function groupOrdersByCheckout(orders: Order[]): CustomerCheckout[] {
  const byCheckout = new Map<string, Order[]>();
  for (const o of orders) {
    const key = getCustomerOrderId(o);
    const group = byCheckout.get(key);
    if (group) group.push(o);
    else byCheckout.set(key, [o]);
  }
  return Array.from(byCheckout, ([checkoutId, group]) => ({
    checkoutId,
    orders: group,
  }));
}

/** All company orders for one checkout, across every status. */
export function getCheckoutOrders(checkoutId: string): Order[] {
  return _orders.filter((o) => getCustomerOrderId(o) === checkoutId);
}

/**
 * Product lines of an order, each carrying its company and brand.
 * Uses the order's line items when present; otherwise derives one line
 * from `itemsSummary` ("<qty> units <name>" or "<name> + N more"),
 * attributed to the order's own company / brand.
 */
export function getOrderLines(order: Order): OrderLineItem[] {
  if (order.lineItems && order.lineItems.length > 0) return order.lineItems;
  const m = /^(\d+)\s+units?\s+(.+?)\s*$/i.exec(order.itemsSummary);
  const qty = m ? Number(m[1]) : 1;
  const name = m ? m[2] : order.itemsSummary;
  const ppu = qty > 0 ? +(order.orderValue / qty).toFixed(2) : order.orderValue;
  return [
    {
      skuCode: `${order.id}-LINE-1`,
      productName: name,
      company: order.company,
      brand: order.brand,
      category: "—",
      qty,
      originalPricePerUnit: ppu,
      finalPricePerUnit: ppu,
      discountApplied: 0,
      discountDetails: "No Discount",
      lineTotal: order.orderValue,
    },
  ];
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

// ---------- Order modification ----------

/** Packing from the SKU master: "Pack Size (Inner Pack)" and "UPC
 *  (Unit Per Case)" on the SKU detail page, both in pieces. Shown
 *  read-only in the Edit Quantity popup. */
export interface SkuPackConfig {
  innerPack: number;
  upc: number;
}

// Demo stand-in for the SKU master lookup, covering the SKUs that
// appear on seed order lines. A SKU missing here has no inner pack
// configured, so its lines can be edited in single pieces.
const SKU_PACK_CONFIG: Record<string, SkuPackConfig> = {
  "180000008": { innerPack: 16, upc: 16 },
  "SKU-AASH-10": { innerPack: 1, upc: 4 },
  "SKU-SUNF-DF150": { innerPack: 10, upc: 60 },
  "SKU-CLAS-NB172": { innerPack: 6, upc: 48 },
  "SKU-BING-MA90": { innerPack: 10, upc: 80 },
  "SKU-YIPP-240": { innerPack: 5, upc: 40 },
  // Catalogue SKUs on the demo order lines.
  "SKU-ACH-CHP200": { innerPack: 10, upc: 50 },
  "SKU-ACH-CRP200": { innerPack: 10, upc: 50 },
  "SKU-ACH-SMB1": { innerPack: 1, upc: 10 },
  "SKU-AWL-FBR5": { innerPack: 1, upc: 4 },
  "SKU-AWL-FBS1": { innerPack: 10, upc: 20 },
  "SKU-AWL-FCA5": { innerPack: 1, upc: 4 },
  "SKU-AWL-FKG1": { innerPack: 10, upc: 10 },
  "SKU-AWL-FSF1": { innerPack: 10, upc: 10 },
  "SKU-BRT-50T": { innerPack: 12, upc: 72 },
  "SKU-BRT-BRB400": { innerPack: 1, upc: 12 },
  "SKU-BRT-CHZ200": { innerPack: 1, upc: 20 },
  "SKU-BRT-GDC200": { innerPack: 12, upc: 48 },
  "SKU-BRT-MGL100": { innerPack: 12, upc: 48 },
  "SKU-CPL-CFP": { innerPack: 1, upc: 12 },
  "SKU-CPL-CMG150": { innerPack: 6, upc: 48 },
  "SKU-CPL-CST200": { innerPack: 6, upc: 48 },
  "SKU-DAB-AMLA": { innerPack: 6, upc: 36 },
  "SKU-DAB-CHY500": { innerPack: 6, upc: 24 },
  "SKU-DAB-DRP200": { innerPack: 6, upc: 48 },
  "SKU-DAB-HNY250": { innerPack: 6, upc: 24 },
  "SKU-DAB-RLJ1": { innerPack: 1, upc: 12 },
  "SKU-GCP-CLS100": { innerPack: 4, upc: 72 },
  "SKU-GCP-EZL": { innerPack: 1, upc: 12 },
  "SKU-GCP-GNS100": { innerPack: 4, upc: 72 },
  "SKU-GEF-FGN1": { innerPack: 10, upc: 10 },
  "SKU-GEF-FRB1": { innerPack: 10, upc: 10 },
  "SKU-GEF-FSO1": { innerPack: 10, upc: 10 },
  "SKU-GEF-FSO5": { innerPack: 1, upc: 4 },
  "SKU-HUL-LUX": { innerPack: 4, upc: 72 },
  "SKU-HUL-SEW1": { innerPack: 6, upc: 24 },
  "SKU-HUL-SML2": { innerPack: 1, upc: 6 },
  "SKU-HUL-VIM": { innerPack: 6, upc: 72 },
  "SKU-ITC-AASH1": { innerPack: 10, upc: 20 },
  "SKU-ITC-AASH5": { innerPack: 1, upc: 4 },
  "SKU-ITC-CLNB": { innerPack: 6, upc: 48 },
  "SKU-ITC-SDF75": { innerPack: 12, upc: 96 },
  "SKU-ITC-SMRC": { innerPack: 12, upc: 48 },
  "SKU-ITC-SVLS": { innerPack: 4, upc: 72 },
  "SKU-ITC-YPN70": { innerPack: 12, upc: 96 },
  "SKU-MRC-LVT": { innerPack: 6, upc: 36 },
  "SKU-MRC-NHR": { innerPack: 6, upc: 36 },
  "SKU-MRC-PCO1J": { innerPack: 1, upc: 12 },
  "SKU-MRC-PCO250": { innerPack: 12, upc: 48 },
  "SKU-MRC-PCO500": { innerPack: 6, upc: 24 },
  "SKU-MRC-SFL1": { innerPack: 6, upc: 12 },
  "SKU-MRC-SFO1": { innerPack: 6, upc: 24 },
  "SKU-NES-KKT": { innerPack: 12, upc: 144 },
  "SKU-NES-MKS": { innerPack: 6, upc: 12 },
  "SKU-NES-MLK": { innerPack: 1, upc: 12 },
  "SKU-NES-MMN280": { innerPack: 6, upc: 48 },
  "SKU-PEP-7UP": { innerPack: 6, upc: 24 },
  "SKU-PEP-KKM": { innerPack: 10, upc: 60 },
  "SKU-PEP-LCS52": { innerPack: 10, upc: 60 },
  "SKU-PEP-LMM52": { innerPack: 10, upc: 60 },
  "SKU-PEP-PS2L": { innerPack: 1, upc: 9 },
  "SKU-PEP-PS750": { innerPack: 6, upc: 24 },
  "SKU-PEP-TRP": { innerPack: 1, upc: 12 },
  "SKU-PRL-MLB": { innerPack: 1, upc: 24 },
  "SKU-PRL-MNK": { innerPack: 12, upc: 48 },
  "SKU-SKT-CDL1": { innerPack: 10, upc: 30 },
  "SKU-SKT-SLT1": { innerPack: 10, upc: 25 },
  "SKU-SKT-SNM5": { innerPack: 1, upc: 5 },
  "SKU-SKT-TDL1": { innerPack: 10, upc: 30 },
};

export function getSkuPackConfig(skuCode: string): SkuPackConfig | undefined {
  return SKU_PACK_CONFIG[skuCode];
}

/** Line quantities can only be edited before the seller confirms. */
export function canModifyOrderLines(o: { status: string }): boolean {
  return o.status === "New";
}

/**
 * Validate the quantity a seller typed into Edit Quantity. Returns the
 * error to show, or null when the value can be saved. The value must
 * be a whole number of pieces, at least one inner pack, a multiple of
 * the inner pack, and no more than the buyer ordered.
 */
export function validateModifiedQty(
  raw: string,
  { actualQty, innerPack = 1 }: { actualQty: number; innerPack?: number },
): string | null {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return "Enter the quantity in whole pieces.";
  const qty = Number(value);
  if (qty === 0) {
    return innerPack > 1
      ? `Quantity must be at least one inner pack (${innerPack} pcs).`
      : "Quantity must be at least 1.";
  }
  if (qty % innerPack !== 0) {
    const lower = Math.floor(qty / innerPack) * innerPack;
    const nearest = [lower, lower + innerPack].filter(
      (n) => n > 0 && n <= actualQty,
    );
    return (
      `You are trying to modify a quantity which is not a multiple of the inner pack (${innerPack}). Please check the inner pack` +
      (nearest.length ? ` — try ${nearest.join(" or ")}.` : ".")
    );
  }
  if (qty > actualQty) {
    return `Quantity can't be more than the ordered quantity (${actualQty}).`;
  }
  return null;
}

/**
 * Record a seller-side quantity change on one line of a New order and
 * re-derive the order value from the as-placed value. Setting a line
 * back to its actual quantity clears that line's modification; clearing
 * the last one restores the order as placed. Callers validate with
 * {@link validateModifiedQty} first. Returns false when the order isn't
 * found or can no longer be modified.
 */
export function modifyOrderLineQty(
  orderId: string,
  skuCode: string,
  change: Omit<LineQtyModification, "modifiedAt">,
): boolean {
  let mutated = false;
  _orders = _orders.map((o) => {
    if (o.id !== orderId || !canModifyOrderLines(o)) return o;
    mutated = true;
    const mods = { ...o.qtyModifications };
    if (change.modifiedQty === change.actualQty) delete mods[skuCode];
    else mods[skuCode] = { ...change, modifiedAt: new Date().toISOString() };

    const originalOrderValue = o.originalOrderValue ?? o.orderValue;
    const {
      qtyModifications: _m,
      originalOrderValue: _v,
      ...rest
    } = o;
    void _m;
    void _v;
    const remaining = Object.values(mods);
    if (remaining.length === 0) {
      return { ...rest, orderValue: originalOrderValue };
    }
    const reduction = remaining.reduce(
      (sum, m) =>
        sum + m.actualLineTotal - Math.round(m.modifiedQty * m.pricePerUnit * 100) / 100,
      0,
    );
    return {
      ...rest,
      qtyModifications: mods,
      originalOrderValue,
      orderValue: Math.round((originalOrderValue - reduction) * 100) / 100,
    };
  });
  if (mutated) notify();
  return mutated;
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
// "Today" is the real today — the seed is shifted to it at load (see
// "Keep the demo data current"), so the seed data and the bucketing
// logic stay in sync across screens.

const DEMO_TODAY = shiftSeedDate(SEED_TODAY);

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
 * Soft-nudge threshold for VIW-2026-06911 (Implement Soft and Hard
 * Restriction for Pending Order Status Updates). Only Stage 1 — the
 * soft nudge — shipped; Stage 2's hard block on new-order access was
 * dropped before launch as it risked hurting the vendor experience.
 * A New order older than this many days gets flagged so the seller
 * notices it, but nothing about accepting newer orders is disabled.
 */
export const STALE_PENDING_NUDGE_DAYS = 2;

/** Days between an order's `orderDate` and "today" (module clock). */
export function getPendingAgeDays(order: Order): number {
  const placed = Date.parse(order.orderDate + "T00:00:00Z");
  const today = Date.parse(getOrdersToday() + "T00:00:00Z");
  if (Number.isNaN(placed) || Number.isNaN(today)) return 0;
  return Math.round((today - placed) / 86400000);
}

/** A New order the seller has sat on past the nudge threshold. */
export function isStalePendingOrder(order: Order): boolean {
  return (
    order.status === "New" &&
    getPendingAgeDays(order) > STALE_PENDING_NUDGE_DAYS
  );
}

/** All stale-pending orders in a list — powers the New-tab banner. */
export function getStalePendingOrders(orders: Order[]): Order[] {
  return orders.filter(isStalePendingOrder);
}

/**
 * Feature 9: Order Status Update Enforcement. While ANY New order is
 * older than STALE_PENDING_NUDGE_DAYS, every fresh New order is masked
 * and can't be confirmed. The lock lifts only when each of those older
 * orders has been confirmed or cancelled; there is no count or age
 * threshold that lets some of them slip through.
 */

export type AttentionReason = "unconfirmed";

export interface AttentionItem {
  order: Order;
  reason: AttentionReason;
  /** Days since the order was placed. */
  overdueDays: number;
}

export function getAttentionOrders(orders: Order[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const order of orders) {
    if (isStalePendingOrder(order)) {
      items.push({
        order,
        reason: "unconfirmed",
        overdueDays: getPendingAgeDays(order),
      });
    }
  }
  return items.sort((a, b) => b.overdueDays - a.overdueDays);
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
  shortName?: string;
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
      shortName: li.shortName,
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

// ---------- Retailer Company ID ----------
// The retailer's ID with an order's company — shown on the order view
// page and in the Customer Wise export. Taken from the order when
// the system sends it; otherwise fetched from the Customers module —
// the customer (same mobile and business name) and their link to the
// order's company. Undefined when neither has it.
const lastTen = (m?: string) => (m ?? "").replace(/\D/g, "").slice(-10);
const companyKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(limited|ltd|private|pvt|india)\b|[^a-z0-9]/g, "");

// Demo fallback: the ID the company would have given this retailer —
// company initials + "-RT-" + six digits, stable for the same retailer
// and company, so every order of a pair shows the same ID.
const COMPANY_FILLER = /^(limited|ltd|pvt|private|india|co|and|&)$/i;
function demoRetailerCompanyId(order: Order): string {
  const words = order.company.split(/[\s.]+/).filter((w) => w && !COMPANY_FILLER.test(w));
  const prefix = (
    words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join("") : (words[0] ?? "RTL").slice(0, 3)
  ).toUpperCase();
  let h = 2166136261;
  for (const ch of `${lastTen(order.buyerContact)}|${order.retailerName.trim().toLowerCase()}|${companyKey(order.company)}`) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return `${prefix}-RT-${100000 + ((h >>> 0) % 900000)}`;
}

export function getRetailerCompanyId(order: Order): string | undefined {
  if (order.retailerCompanyId) return order.retailerCompanyId;
  const mobile = lastTen(order.buyerContact);
  const customer = mobile
    ? getDemoCustomers().find(
        (c) =>
          lastTen(c.mobile) === mobile &&
          c.businessName.trim().toLowerCase() ===
            order.retailerName.trim().toLowerCase(),
      )
    : undefined;
  return (
    customer?.companies.find(
      (l) => companyKey(l.companyName) === companyKey(order.company),
    )?.retailerCompanyId ?? demoRetailerCompanyId(order)
  );
}

// ---------- Customer order status ----------
// A customer order's company orders can sit in different states — e.g.
// the seller cancels one and confirms the rest. Shared by the Customer
// Wise list and the customer order page so both read the same.
// Cancellations keep who cancelled (seller / customer), as everywhere
// else in Orders.
export type CustomerOrderStage =
  | "new"
  | "confirmed"
  | "logistics"
  | "delivered"
  | "cancelledBySeller"
  | "cancelledByCustomer";

export const CUSTOMER_ORDER_STAGES: Record<
  CustomerOrderStage,
  { label: string; dot: string; badge: string }
> = {
  new: { label: "New", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "Confirmed", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
  logistics: { label: "With 3PL", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  delivered: { label: "Delivered", dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  cancelledBySeller: { label: "Cancelled by Seller", dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  cancelledByCustomer: { label: "Cancelled by Customer", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800 border-amber-200" },
};

const CUSTOMER_ORDER_STAGE_ORDER: CustomerOrderStage[] = [
  "new",
  "confirmed",
  "logistics",
  "delivered",
  "cancelledBySeller",
  "cancelledByCustomer",
];
const isCancelledStage = (st: CustomerOrderStage) =>
  st === "cancelledBySeller" || st === "cancelledByCustomer";

export function getCustomerOrderStage(o: Order): CustomerOrderStage {
  if (o.status === "Cancelled") {
    return (o.cancelledBy ?? "Seller") === "Buyer"
      ? "cancelledByCustomer"
      : "cancelledBySeller";
  }
  if (o.status === "Delivered") return "delivered";
  if (o.status === "Confirmed") return o.logisticsRequested ? "logistics" : "confirmed";
  return "new";
}

/**
 * Status of a customer order whose company orders are NOT all in the
 * same state — "Partially Confirmed / With 3PL / Delivered" (the most
 * advanced state reached), "Partially Cancelled by Seller / Customer"
 * when the rest are still New, plus a per-state count that keeps who
 * cancelled. Null when every company order shares one state (the normal
 * status badge applies).
 */
export function getMixedCustomerOrderStatus(orders: Order[]): {
  label: string;
  badge: string;
  parts: { stage: CustomerOrderStage; count: number }[];
} | null {
  const counts = new Map<CustomerOrderStage, number>();
  for (const o of orders) {
    const st = getCustomerOrderStage(o);
    counts.set(st, (counts.get(st) ?? 0) + 1);
  }
  if (counts.size < 2) return null;
  const active = CUSTOMER_ORDER_STAGE_ORDER.filter(
    (st) => !isCancelledStage(st) && counts.has(st),
  );
  const top = active[active.length - 1];
  const bySeller = counts.has("cancelledBySeller");
  const byCustomer = counts.has("cancelledByCustomer");
  const who =
    bySeller && byCustomer ? "by Seller & Customer" : bySeller ? "by Seller" : "by Customer";
  const label = !top
    ? `Cancelled ${who}`
    : top === "new"
      ? `Partially Cancelled ${who}`
      : `Partially ${CUSTOMER_ORDER_STAGES[top].label}`;
  const badge =
    !top || top === "new"
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : CUSTOMER_ORDER_STAGES[top].badge;
  const parts = CUSTOMER_ORDER_STAGE_ORDER.filter((st) => counts.has(st)).map(
    (st) => ({ stage: st, count: counts.get(st)! }),
  );
  return { label, badge, parts };
}
