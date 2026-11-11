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

import { sampleSKUs } from "./my-sku-data";

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
        skuCode: "190000001",
        productName: "Aashirvaad Whole Wheat Atta 10 kg",
        company: "ITC Limited",
        brand: "Aashirvaad",
        category: "Cooking and Baking Needs",
        qty: 20,
        originalPricePerUnit: 450,
        finalPricePerUnit: 420,
        discountApplied: 600,
        discountDetails: "Slab 2: 10–24 qty • 6.67% off vs ₹450.00",
        lineTotal: 8400,
      },
      {
        skuCode: "200000002",
        productName: "Sunfeast Dark Fantasy Choco Fills 75 g",
        company: "ITC Limited",
        brand: "Sunfeast",
        category: "Chocolates and Biscuits",
        qty: 50,
        originalPricePerUnit: 35,
        finalPricePerUnit: 35,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1750,
      },
      {
        skuCode: "260000004",
        productName: "Tata Tea Gold 250 g",
        company: "Tata Consumer Products",
        brand: "Tata Tea",
        category: "Tea and Coffee",
        qty: 30,
        originalPricePerUnit: 45,
        finalPricePerUnit: 45,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 1350,
      },
      {
        skuCode: "210000001",
        productName: "Bingo Mad Angles Achaari Masti 80 g",
        company: "ITC Limited",
        brand: "Bingo",
        category: "Snacks and Namkeen",
        qty: 40,
        originalPricePerUnit: 20,
        finalPricePerUnit: 20,
        discountApplied: 0,
        discountDetails: "—",
        lineTotal: 800,
      },
      {
        skuCode: "220000001",
        productName: "Yippee Magic Masala Noodles 4-pack 280 g",
        company: "ITC Limited",
        brand: "Yippee",
        category: "Pasta, Soup and Noodles",
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
    itemsSummary: "Britannia Good Day + 3 more",
    orderValue: 3260,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    customerOrderId: "QWI-ORD-260517-N4WQ2S",
    orderTime: "04:05 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-18",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Madhapur",
    buyerContact: "+91 98765 43230",
    channelOrderId: "ONDC-ORD-118823",
    buyerCode: "BUYER-GGS-441",
    gstNumber: "36AAJCG2210K1ZP",
  },
  {
    id: "QWI-ONDC-260517-R8T3LM",
    brand: "Dabur",
    company: "Dabur India",
    source: "DMS-Bizom",
    retailerName: "Lakshmi Super Bazaar",
    itemsSummary: "Dabur Honey + 2 more",
    orderValue: 2140,
    paymentMode: "Prepaid",
    orderDate: "2026-05-17",
    customerOrderId: "QWI-ORD-260517-R8T3LM",
    orderTime: "11:20 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-18",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "KPHB 1",
    buyerContact: "+91 98765 43231",
    channelOrderId: "ONDC-ORD-118902",
    buyerCode: "BUYER-LSB-552",
    gstNumber: "36AADCD1140M1ZQ",
  },
  {
    id: "QWI-ONDC-260516-H5V9PK",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Botery",
    retailerName: "Krishna Kirana Store",
    itemsSummary: "Parachute Coconut Oil + 1 more",
    orderValue: 1860,
    paymentMode: "COD",
    orderDate: "2026-05-16",
    customerOrderId: "QWI-ORD-260516-H5V9PK",
    orderTime: "09:50 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-17",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Banjara Hills",
    buyerContact: "+91 98765 43232",
    channelOrderId: "ONDC-ORD-119014",
    buyerCode: "BUYER-KKS-663",
    gstNumber: "36AAECK9021N1ZR",
  },
  {
    id: "QWI-ONDC-260515-Q2X6BN",
    brand: "PepsiCo",
    company: "PepsiCo India",
    source: "DMS-Bizom",
    retailerName: "New Bombay Mart",
    itemsSummary: "Lay's Chips + 4 more",
    orderValue: 4720,
    paymentMode: "COD",
    orderDate: "2026-05-15",
    customerOrderId: "QWI-ORD-260515-Q2X6BN",
    orderTime: "03:35 PM",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-16",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "SR Nagar",
    buyerContact: "+91 98765 43233",
    channelOrderId: "FLPK-ORD-661377",
    buyerCode: "BUYER-NBM-774",
    gstNumber: "36AAFCN5502P1ZS",
  },
  {
    id: "QWI-ONDC-260513-W7C1DZ",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Sai Ram Traders",
    itemsSummary: "Aashirvaad Atta + Sunfeast Biscuits",
    orderValue: 5380,
    paymentMode: "Prepaid",
    orderDate: "2026-05-13",
    customerOrderId: "QWI-ORD-260513-W7C1DZ",
    orderTime: "01:10 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-14",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Ameerpet",
    buyerContact: "+91 98765 43234",
    channelOrderId: "ONDC-ORD-119203",
    buyerCode: "BUYER-SRT-885",
    gstNumber: "36AAGCS7734Q1ZT",
  },
  {
    id: "QWI-ONDC-260517-D3F8KT",
    brand: "Nestle",
    company: "Nestle India",
    source: "DMS-Bizom",
    retailerName: "Annapurna Provisions",
    itemsSummary: "Maggi Noodles + 2 more",
    orderValue: 2480,
    paymentMode: "COD",
    orderDate: "2026-05-17",
    customerOrderId: "QWI-ORD-260517-D3F8KT",
    orderTime: "11:45 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-18",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Madhapur",
    buyerContact: "+91 98765 43240",
    channelOrderId: "ONDC-ORD-119310",
    buyerCode: "BUYER-APP-120",
    gstNumber: "36AAKCA3321B1ZV",
  },
  {
    id: "QWI-ONDC-260516-M9B2VC",
    brand: "Hindustan Unilever",
    company: "Hindustan Unilever Ltd",
    source: "DMS-Bizom",
    retailerName: "Sri Venkateswara Stores",
    itemsSummary: "Surf Excel + Dove Soap",
    orderValue: 3915,
    paymentMode: "Prepaid",
    orderDate: "2026-05-16",
    customerOrderId: "QWI-ORD-260516-M9B2VC",
    orderTime: "05:20 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-17",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Hyderabad West",
    buyerContact: "+91 98765 43241",
    channelOrderId: "ONDC-ORD-119355",
    buyerCode: "BUYER-SVS-301",
    gstNumber: "36AAHCS6618C1ZW",
  },
  {
    id: "QWI-ONDC-260515-P6L4XE",
    brand: "Parle",
    company: "Parle Products",
    source: "DMS-Bizom",
    retailerName: "Balaji Kirana",
    itemsSummary: "Parle-G + Monaco",
    orderValue: 1325,
    paymentMode: "COD",
    orderDate: "2026-05-15",
    customerOrderId: "QWI-ORD-260515-P6L4XE",
    orderTime: "10:05 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-16",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "KPHB 1",
    buyerContact: "+91 98765 43242",
    channelOrderId: "ONDC-ORD-119401",
    buyerCode: "BUYER-BKR-212",
    gstNumber: "36AAFCB1409D1ZX",
  },
  {
    id: "QWI-ONDC-260514-T1R7NH",
    brand: "Colgate",
    company: "Colgate Palmolive",
    source: "DMS-Bizom",
    retailerName: "Hanuman General Stores",
    itemsSummary: "Colgate Strong Teeth + 3 more",
    orderValue: 2760,
    paymentMode: "COD",
    orderDate: "2026-05-14",
    customerOrderId: "QWI-ORD-260514-T1R7NH",
    orderTime: "03:40 PM",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-15",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Banjara Hills",
    buyerContact: "+91 98765 43243",
    channelOrderId: "FLPK-ORD-661502",
    buyerCode: "BUYER-HGS-458",
    gstNumber: "36AAGCH7742E1ZY",
  },
  {
    id: "QWI-ONDC-260512-K8W5QZ",
    brand: "Dabur",
    company: "Dabur India",
    source: "DMS-Bizom",
    retailerName: "Gayatri Super Market",
    itemsSummary: "Dabur Chyawanprash + 2 more",
    orderValue: 4210,
    paymentMode: "Prepaid",
    orderDate: "2026-05-12",
    customerOrderId: "QWI-ORD-260512-K8W5QZ",
    orderTime: "12:30 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-13",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Hyderabad North",
    buyerContact: "+91 98765 43244",
    channelOrderId: "ONDC-ORD-119488",
    buyerCode: "BUYER-GSM-519",
    gstNumber: "36AAHCG8855F1ZZ",
  },
  {
    id: "QWI-ONDC-260511-V2N9JD",
    brand: "Britannia",
    company: "Britannia Industries",
    source: "DMS-Bizom",
    retailerName: "Sai Krishna Traders",
    itemsSummary: "Britannia Marie Gold + 4 more",
    orderValue: 1890,
    paymentMode: "COD",
    orderDate: "2026-05-11",
    customerOrderId: "QWI-ORD-260511-V2N9JD",
    orderTime: "09:15 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-12",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "SR Nagar",
    buyerContact: "+91 98765 43245",
    channelOrderId: "ONDC-ORD-119520",
    buyerCode: "BUYER-SKT-620",
    gstNumber: "36AAICS9966G1Z1",
  },
  {
    id: "QWI-ONDC-260510-Z4C6LU",
    brand: "ITC",
    company: "ITC Limited",
    source: "DMS-Bizom",
    retailerName: "Lakshmi Narasimha Stores",
    itemsSummary: "Aashirvaad Atta 10kg + 2 more",
    orderValue: 6340,
    paymentMode: "COD",
    orderDate: "2026-05-10",
    customerOrderId: "QWI-ORD-260510-Z4C6LU",
    orderTime: "04:50 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-11",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Ameerpet",
    buyerContact: "+91 98765 43246",
    channelOrderId: "ONDC-ORD-119577",
    buyerCode: "BUYER-LNS-731",
    gstNumber: "36AAJCL1077H1Z2",
  },
  {
    id: "QWI-ONDC-260509-Y7H3PA",
    brand: "Marico",
    company: "Marico Limited",
    source: "DMS-Bizom",
    retailerName: "Venkata Ramana Mart",
    itemsSummary: "Saffola Gold + Parachute",
    orderValue: 3055,
    paymentMode: "Prepaid",
    orderDate: "2026-05-09",
    customerOrderId: "QWI-ORD-260509-Y7H3PA",
    orderTime: "02:25 PM",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-10",
    deliveryType: "Regular",
    orderType: "standard",
    beatName: "Madhapur",
    buyerContact: "+91 98765 43247",
    channelOrderId: "FLPK-ORD-661590",
    buyerCode: "BUYER-VRM-842",
    gstNumber: "36AAKCV2188J1Z3",
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
  },
  // ---- Fresh New orders for CDS demos (today / yesterday) ----
  // [New · fresh demo order · KPHB Colony]
  {
    id: "QWI-ONDC-260520-NA1KPH",
    brand: "Aashirvaad",
    company: "ITC Limited",
    source: "ONDC",
    retailerName: "Sri Lakshmi Kirana",
    itemsSummary: "Aashirvaad Whole Wheat Atta 10 kg + 2 more",
    orderValue: 4878,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-NA1KPH",
    orderTime: "08:40 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43351",
    channelOrderId: "ONDC-ORD-790051",
    buyerAddress: "Main Road, KPHB Colony, Hyderabad, Telangana",
    buyerLat: 17.4935,
    buyerLng: 78.3996,
    connectivity: "Online",
    lineItems: [
      { skuCode: "190000001", productName: "Aashirvaad Whole Wheat Atta 10 kg", company: "ITC Limited", brand: "Aashirvaad", category: "Cooking and Baking Needs", qty: 6, originalPricePerUnit: 525, finalPricePerUnit: 525, discountApplied: 0, discountDetails: "No Discount", lineTotal: 3150 },
      { skuCode: "200000001", productName: "Sunfeast Marie Light 200 g", company: "ITC Limited", brand: "Sunfeast", category: "Chocolates and Biscuits", qty: 24, originalPricePerUnit: 27, finalPricePerUnit: 27, discountApplied: 0, discountDetails: "No Discount", lineTotal: 648 },
      { skuCode: "220000001", productName: "Yippee Magic Masala Noodles 4-pack 280 g", company: "ITC Limited", brand: "Yippee", category: "Pasta, Soup and Noodles", qty: 20, originalPricePerUnit: 54, finalPricePerUnit: 54, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1080 },
    ],
  },
  // [New · fresh demo order · Madhapur]
  {
    id: "QWI-ONDC-260520-NA2MDP",
    brand: "Saffola",
    company: "Marico Limited",
    source: "ONDC",
    retailerName: "Hitech Daily Needs",
    itemsSummary: "Saffola Gold Refined Oil 1 L + 1 more",
    orderValue: 3120,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-NA2MDP",
    orderTime: "09:05 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43352",
    channelOrderId: "ONDC-ORD-790052",
    buyerAddress: "Main Road, Madhapur, Hyderabad, Telangana",
    buyerLat: 17.4483,
    buyerLng: 78.3915,
    connectivity: "Online",
    lineItems: [
      { skuCode: "270000001", productName: "Saffola Gold Refined Oil 1 L", company: "Marico Limited", brand: "Saffola", category: "Oil & Ghee", qty: 10, originalPricePerUnit: 192, finalPricePerUnit: 192, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1920 },
      { skuCode: "270000003", productName: "Parachute Coconut Oil 200 ml", company: "Marico Limited", brand: "Parachute", category: "Beauty & Hygiene", qty: 12, originalPricePerUnit: 100, finalPricePerUnit: 100, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1200 },
    ],
  },
  // [New · fresh demo order · Gachibowli]
  {
    id: "QWI-FLPK-260520-NA3GCB",
    brand: "Bingo",
    company: "ITC Limited",
    source: "ONDC",
    retailerName: "Gachibowli Fresh Mart",
    itemsSummary: "Bingo Tedhe Medhe Tomato Twist 80 g + 2 more",
    orderValue: 25440,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-NA3GCB",
    orderTime: "09:50 AM",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43353",
    channelOrderId: "FLIPKART-ORD-790053",
    buyerAddress: "Main Road, Gachibowli, Hyderabad, Telangana",
    buyerLat: 17.4401,
    buyerLng: 78.3489,
    connectivity: "Online",
    lineItems: [
      { skuCode: "210000002", productName: "Bingo Tedhe Medhe Tomato Twist 80 g", company: "ITC Limited", brand: "Bingo", category: "Snacks and Namkeen", qty: 60, originalPricePerUnit: 27, finalPricePerUnit: 27, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1620 },
      { skuCode: "200000002", productName: "Sunfeast Dark Fantasy Choco Fills 75 g", company: "ITC Limited", brand: "Sunfeast", category: "Chocolates and Biscuits", qty: 60, originalPricePerUnit: 45, finalPricePerUnit: 45, discountApplied: 0, discountDetails: "No Discount", lineTotal: 2700 },
      { skuCode: "300000002", productName: "Pepsi PET 600 ml (Case of 24)", company: "PepsiCo India", brand: "Pepsi", category: "Beverages", qty: 24, originalPricePerUnit: 880, finalPricePerUnit: 880, discountApplied: 0, discountDetails: "No Discount", lineTotal: 21120 },
    ],
  },
  // [New · fresh demo order · Kukatpally]
  {
    id: "QWI-ONDC-260520-NA4KKP",
    brand: "Tata Sampann",
    company: "Tata Consumer Products",
    source: "ONDC",
    retailerName: "Venkateswara Provisions",
    itemsSummary: "Tata Sampann Toor Dal Unpolished 1 kg + 1 more",
    orderValue: 2712,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-NA4KKP",
    orderTime: "10:20 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43354",
    channelOrderId: "ONDC-ORD-790054",
    buyerAddress: "Main Road, Kukatpally, Hyderabad, Telangana",
    buyerLat: 17.4849,
    buyerLng: 78.4138,
    connectivity: "Online",
    lineItems: [
      { skuCode: "260000002", productName: "Tata Sampann Toor Dal Unpolished 1 kg", company: "Tata Consumer Products", brand: "Tata Sampann", category: "Dals and Pulses", qty: 4, originalPricePerUnit: 165, finalPricePerUnit: 165, discountApplied: 0, discountDetails: "No Discount", lineTotal: 660 },
      { skuCode: "180000008", productName: "FREEDOM REF. SUNFLOWER OIL 1 LTR.X16NOS.", company: "Gemini Edibles & Fats India", brand: "Freedom", category: "Edible Oil", qty: 12, originalPricePerUnit: 171, finalPricePerUnit: 171, discountApplied: 0, discountDetails: "No Discount", lineTotal: 2052 },
    ],
  },
  // [New · fresh demo order · Ameerpet]
  {
    id: "QWI-AMZN-260520-NA5AMP",
    brand: "Britannia",
    company: "Britannia Industries",
    source: "ONDC",
    retailerName: "Ameerpet Super Bazaar",
    itemsSummary: "Britannia Good Day Cashew 200 g + 1 more",
    orderValue: 3684,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-NA5AMP",
    orderTime: "11:35 AM",
    status: "New",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43355",
    channelOrderId: "AMAZON-ORD-790055",
    buyerAddress: "Main Road, Ameerpet, Hyderabad, Telangana",
    buyerLat: 17.4375,
    buyerLng: 78.4482,
    connectivity: "Online",
    lineItems: [
      { skuCode: "230000002", productName: "Britannia Good Day Cashew 200 g", company: "Britannia Industries", brand: "Britannia", category: "Chocolates and Biscuits", qty: 48, originalPricePerUnit: 46, finalPricePerUnit: 46, discountApplied: 0, discountDetails: "No Discount", lineTotal: 2208 },
      { skuCode: "230000001", productName: "Britannia Marie Gold 250 g", company: "Britannia Industries", brand: "Britannia", category: "Chocolates and Biscuits", qty: 36, originalPricePerUnit: 41, finalPricePerUnit: 41, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1476 },
    ],
  },
  // [New · fresh demo order · Begumpet]
  {
    id: "QWI-ONDC-260519-NA6BGP",
    brand: "Tata Tea",
    company: "Tata Consumer Products",
    source: "ONDC",
    retailerName: "Begumpet General Store",
    itemsSummary: "Tata Tea Premium 500 g + 1 more",
    orderValue: 3630,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-NA6BGP",
    orderTime: "04:15 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-20",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43356",
    channelOrderId: "ONDC-ORD-790056",
    buyerAddress: "Main Road, Begumpet, Hyderabad, Telangana",
    buyerLat: 17.444,
    buyerLng: 78.467,
    connectivity: "Online",
    lineItems: [
      { skuCode: "260000003", productName: "Tata Tea Premium 500 g", company: "Tata Consumer Products", brand: "Tata Tea", category: "Tea and Coffee", qty: 6, originalPricePerUnit: 255, finalPricePerUnit: 255, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1530 },
      { skuCode: "190000001", productName: "Aashirvaad Whole Wheat Atta 10 kg", company: "ITC Limited", brand: "Aashirvaad", category: "Cooking and Baking Needs", qty: 4, originalPricePerUnit: 525, finalPricePerUnit: 525, discountApplied: 0, discountDetails: "No Discount", lineTotal: 2100 },
    ],
  },
  // [New · fresh demo order · Miyapur]
  {
    id: "QWI-ONDC-260519-NA7MYP",
    brand: "Bingo",
    company: "ITC Limited",
    source: "ONDC",
    retailerName: "Miyapur Kirana Point",
    itemsSummary: "Bingo Mad Angles Achaari Masti 80 g + 1 more",
    orderValue: 3780,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-NA7MYP",
    orderTime: "05:30 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-20",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43357",
    channelOrderId: "ONDC-ORD-790057",
    buyerAddress: "Main Road, Miyapur, Hyderabad, Telangana",
    buyerLat: 17.4968,
    buyerLng: 78.3575,
    connectivity: "Online",
    lineItems: [
      { skuCode: "210000001", productName: "Bingo Mad Angles Achaari Masti 80 g", company: "ITC Limited", brand: "Bingo", category: "Snacks and Namkeen", qty: 80, originalPricePerUnit: 27, finalPricePerUnit: 27, discountApplied: 0, discountDetails: "No Discount", lineTotal: 2160 },
      { skuCode: "220000001", productName: "Yippee Magic Masala Noodles 4-pack 280 g", company: "ITC Limited", brand: "Yippee", category: "Pasta, Soup and Noodles", qty: 30, originalPricePerUnit: 54, finalPricePerUnit: 54, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1620 },
    ],
  },
  // [New · fresh demo order · Kondapur]
  {
    id: "QWI-FLPK-260519-NA8KDP",
    brand: "Freedom",
    company: "Gemini Edibles & Fats India",
    source: "ONDC",
    retailerName: "Kondapur Mini Mart",
    itemsSummary: "FREEDOM REF. SUNFLOWER OIL 1 LTR.X16NOS. + 2 more",
    orderValue: 2736,
    paymentMode: "Prepaid",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-NA8KDP",
    orderTime: "06:10 PM",
    status: "New",
    marketplace: "Flipkart",
    expectedDeliveryDate: "2026-05-20",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43358",
    channelOrderId: "FLIPKART-ORD-790058",
    buyerAddress: "Main Road, Kondapur, Hyderabad, Telangana",
    buyerLat: 17.4618,
    buyerLng: 78.357,
    connectivity: "Online",
    lineItems: [
      { skuCode: "180000008", productName: "FREEDOM REF. SUNFLOWER OIL 1 LTR.X16NOS.", company: "Gemini Edibles & Fats India", brand: "Freedom", category: "Edible Oil", qty: 8, originalPricePerUnit: 171, finalPricePerUnit: 171, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1368 },
      { skuCode: "270000003", productName: "Parachute Coconut Oil 200 ml", company: "Marico Limited", brand: "Parachute", category: "Beauty & Hygiene", qty: 6, originalPricePerUnit: 100, finalPricePerUnit: 100, discountApplied: 0, discountDetails: "No Discount", lineTotal: 600 },
      { skuCode: "270000001", productName: "Saffola Gold Refined Oil 1 L", company: "Marico Limited", brand: "Saffola", category: "Oil & Ghee", qty: 4, originalPricePerUnit: 192, finalPricePerUnit: 192, discountApplied: 0, discountDetails: "No Discount", lineTotal: 768 },
    ],
  },
  // [New · fresh demo order · Uppal]
  {
    id: "QWI-ONDC-260520-NB1UPL",
    brand: "Aashirvaad",
    company: "ITC Limited",
    source: "ONDC",
    retailerName: "Uppal Traders",
    itemsSummary: "Aashirvaad Whole Wheat Atta 10 kg + 1 more",
    orderValue: 2955,
    paymentMode: "COD",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-NB1UPL",
    orderTime: "10:00 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43359",
    channelOrderId: "ONDC-ORD-790059",
    buyerAddress: "Main Road, Uppal, Hyderabad, Telangana",
    buyerLat: 17.4058,
    buyerLng: 78.5591,
    connectivity: "Online",
    lineItems: [
      { skuCode: "190000001", productName: "Aashirvaad Whole Wheat Atta 10 kg", company: "ITC Limited", brand: "Aashirvaad", category: "Cooking and Baking Needs", qty: 5, originalPricePerUnit: 525, finalPricePerUnit: 525, discountApplied: 0, discountDetails: "No Discount", lineTotal: 2625 },
      { skuCode: "260000002", productName: "Tata Sampann Toor Dal Unpolished 1 kg", company: "Tata Consumer Products", brand: "Tata Sampann", category: "Dals and Pulses", qty: 2, originalPricePerUnit: 165, finalPricePerUnit: 165, discountApplied: 0, discountDetails: "No Discount", lineTotal: 330 },
    ],
  },
  // [New · fresh demo order · LB Nagar]
  {
    id: "QWI-ONDC-260520-NB2LBN",
    brand: "Bingo",
    company: "ITC Limited",
    source: "ONDC",
    retailerName: "LB Nagar Kirana",
    itemsSummary: "Bingo Tedhe Medhe Tomato Twist 80 g + 1 more",
    orderValue: 16920,
    paymentMode: "Prepaid",
    orderDate: "2026-05-20",
    customerOrderId: "QWI-ORD-260520-NB2LBN",
    orderTime: "11:10 AM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-21",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43360",
    channelOrderId: "ONDC-ORD-790060",
    buyerAddress: "Main Road, LB Nagar, Hyderabad, Telangana",
    buyerLat: 17.3457,
    buyerLng: 78.5522,
    connectivity: "Online",
    lineItems: [
      { skuCode: "210000002", productName: "Bingo Tedhe Medhe Tomato Twist 80 g", company: "ITC Limited", brand: "Bingo", category: "Snacks and Namkeen", qty: 40, originalPricePerUnit: 27, finalPricePerUnit: 27, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1080 },
      { skuCode: "300000002", productName: "Pepsi PET 600 ml (Case of 24)", company: "PepsiCo India", brand: "Pepsi", category: "Beverages", qty: 18, originalPricePerUnit: 880, finalPricePerUnit: 880, discountApplied: 0, discountDetails: "No Discount", lineTotal: 15840 },
    ],
  },
  // [New · fresh demo order · Kompally]
  {
    id: "QWI-AMZN-260519-NB3KMP",
    brand: "Britannia",
    company: "Britannia Industries",
    source: "ONDC",
    retailerName: "Kompally Fresh Store",
    itemsSummary: "Britannia Good Day Cashew 200 g + 1 more",
    orderValue: 2400,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-NB3KMP",
    orderTime: "03:45 PM",
    status: "New",
    marketplace: "Amazon",
    expectedDeliveryDate: "2026-05-20",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43361",
    channelOrderId: "AMAZON-ORD-790061",
    buyerAddress: "Main Road, Kompally, Hyderabad, Telangana",
    buyerLat: 17.5384,
    buyerLng: 78.4862,
    connectivity: "Online",
    lineItems: [
      { skuCode: "230000002", productName: "Britannia Good Day Cashew 200 g", company: "Britannia Industries", brand: "Britannia", category: "Chocolates and Biscuits", qty: 30, originalPricePerUnit: 46, finalPricePerUnit: 46, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1380 },
      { skuCode: "260000003", productName: "Tata Tea Premium 500 g", company: "Tata Consumer Products", brand: "Tata Tea", category: "Tea and Coffee", qty: 4, originalPricePerUnit: 255, finalPricePerUnit: 255, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1020 },
    ],
  },
  // [New · fresh demo order · Shamshabad]
  {
    id: "QWI-ONDC-260519-NB4SSB",
    brand: "Freedom",
    company: "Gemini Edibles & Fats India",
    source: "ONDC",
    retailerName: "Shamshabad Supermarket",
    itemsSummary: "FREEDOM REF. SUNFLOWER OIL 1 LTR.X16NOS. + 1 more",
    orderValue: 2862,
    paymentMode: "COD",
    orderDate: "2026-05-19",
    customerOrderId: "QWI-ORD-260519-NB4SSB",
    orderTime: "07:20 PM",
    status: "New",
    marketplace: "ONDC",
    expectedDeliveryDate: "2026-05-20",
    deliveryType: "Regular",
    orderType: "standard",
    buyerContact: "+91 98765 43362",
    channelOrderId: "ONDC-ORD-790062",
    buyerAddress: "Main Road, Shamshabad, Hyderabad, Telangana",
    buyerLat: 17.2632,
    buyerLng: 78.3965,
    connectivity: "Online",
    lineItems: [
      { skuCode: "180000008", productName: "FREEDOM REF. SUNFLOWER OIL 1 LTR.X16NOS.", company: "Gemini Edibles & Fats India", brand: "Freedom", category: "Edible Oil", qty: 10, originalPricePerUnit: 171, finalPricePerUnit: 171, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1710 },
      { skuCode: "270000001", productName: "Saffola Gold Refined Oil 1 L", company: "Marico Limited", brand: "Saffola", category: "Oil & Ghee", qty: 6, originalPricePerUnit: 192, finalPricePerUnit: 192, discountApplied: 0, discountDetails: "No Discount", lineTotal: 1152 },
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
  // Retailers outside the Kukatpally CDS area (outer Hyderabad) — these
  // orders are "3PL Logistics Delivery" for CDS sellers.
  "QWI-ONDC-260517-N4WQ2S": {
    lat: 17.6295,
    lng: 78.4812,
    address: "Main Road, Medchal, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260517-R8T3LM": {
    lat: 17.4058,
    lng: 78.5591,
    address: "Main Road, Uppal, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260516-H5V9PK": {
    lat: 17.3457,
    lng: 78.5522,
    address: "Main Road, LB Nagar, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260515-Q2X6BN": {
    lat: 17.4138,
    lng: 78.5783,
    address: "Main Road, Boduppal, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260513-W7C1DZ": {
    lat: 17.3687,
    lng: 78.5268,
    address: "Main Road, Dilsukhnagar, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260517-D3F8KT": {
    lat: 17.3752,
    lng: 78.5663,
    address: "Main Road, Nagole, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260516-M9B2VC": {
    lat: 17.5487,
    lng: 78.3881,
    address: "Main Road, Bachupally, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260515-P6L4XE": {
    lat: 17.2632,
    lng: 78.3965,
    address: "Main Road, Shamshabad, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260514-T1R7NH": {
    lat: 17.5384,
    lng: 78.4862,
    address: "Main Road, Kompally, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260512-K8W5QZ": {
    lat: 17.5332,
    lng: 78.2645,
    address: "Main Road, Patancheru, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260511-V2N9JD": {
    lat: 17.4504,
    lng: 78.6855,
    address: "Main Road, Ghatkesar, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260510-Z4C6LU": {
    lat: 17.3268,
    lng: 78.6046,
    address: "Main Road, Hayathnagar, Hyderabad, Telangana",
    connectivity: "Online",
  },
  "QWI-ONDC-260509-Y7H3PA": {
    lat: 17.5186,
    lng: 78.3845,
    address: "Main Road, Nizampet, Hyderabad, Telangana",
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
  "190000001": { innerPack: 1, upc: 4 },
  "200000002": { innerPack: 10, upc: 60 },
  "260000004": { innerPack: 6, upc: 48 },
  "210000001": { innerPack: 10, upc: 80 },
  "220000001": { innerPack: 5, upc: 40 },
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
}


// ---- Product lines for orders without explicit lineItems ----
// Every order shows real products from the seller's SKU catalogue (My SKU),
// so the order page, CDS / 3PL tabs, Payments and the export all list the
// same SKU codes, names and short names.

const BRAND_COMPANY: Record<string, string> = {
  Aashirvaad: "ITC Limited", Sunfeast: "ITC Limited", Bingo: "ITC Limited", Yippee: "ITC Limited",
  Freedom: "Gemini Edibles & Fats India", "Sri Krupa": "Sri Krupa Oils", "First Klass": "Gemini Edibles & Fats India",
  Britannia: "Britannia Industries", Nestle: "Nestle India",
  "Surf Excel": "Hindustan Unilever", Wheel: "Hindustan Unilever", Lifebuoy: "Hindustan Unilever", Dove: "Hindustan Unilever", Lux: "Hindustan Unilever",
  Tata: "Tata Consumer Products", "Tata Sampann": "Tata Consumer Products", "Tata Tea": "Tata Consumer Products",
  Saffola: "Marico Limited", Parachute: "Marico Limited", "Hair & Care": "Marico Limited",
  Cadbury: "Mondelez India", Bournvita: "Mondelez India",
  Tide: "Procter & Gamble", Ariel: "Procter & Gamble", Pantene: "Procter & Gamble", Whisper: "Procter & Gamble",
  "Coca-Cola": "Coca-Cola India", Sprite: "Coca-Cola India", "Thumbs Up": "Coca-Cola India", Pepsi: "PepsiCo India",
  Amul: "Amul (GCMMF)", "Mother Dairy": "Mother Dairy", "Kellogg's": "Kellogg India", "Bagrry's": "Bagrry's India",
  Pedigree: "Mars Petcare", Whiskas: "Mars Petcare",
};

type CatalogItem = { sku: string; name: string; brand: string; company: string; category: string; price: number; words: Set<string> };

const STOP = new Set(["units", "unit", "pack", "packs", "of", "the", "and", "with", "mixed", "skus", "sku", "wholesale", "assorted", "items", "case", "pet", "ltr", "nos"]);
const wordsOf = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^\d/.test(w) && !STOP.has(w)),
  );

let catalogCache: CatalogItem[] | undefined;
const catalog = (): CatalogItem[] =>
  (catalogCache ??= sampleSKUs
    .filter((s) => (s.sellingPrice ?? 0) > 0)
    .map((s) => ({
      sku: s.sku,
      name: s.name,
      brand: s.brand,
      company: BRAND_COMPANY[s.brand] ?? s.brand,
      category: s.category,
      price: s.sellingPrice ?? 100,
      words: wordsOf(`${s.name} ${s.brand}`),
    })));

const hashOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Best catalogue match for a product name from the order summary. */
function matchCatalog(name: string, used: Set<string>): CatalogItem | undefined {
  const want = wordsOf(name);
  let best: CatalogItem | undefined;
  let bestScore = 0;
  for (const c of catalog()) {
    if (used.has(c.sku)) continue;
    let score = 0;
    for (const w of want) if (c.words.has(w)) score++;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/** A related catalogue product: same brand → same company → same
 *  category as the order's first line → anything (deterministic). */
function pickRelated(order: Order, anchor: CatalogItem | undefined, used: Set<string>, salt: number): CatalogItem {
  const free = catalog().filter((c) => !used.has(c.sku));
  const pools = [
    free.filter((c) => anchor && c.brand === anchor.brand),
    free.filter((c) => c.company === order.company || (anchor && c.company === anchor.company)),
    free.filter((c) => anchor && c.category === anchor.category),
    free.filter((c) => wordsOf(`${order.brand} ${order.company}`).size && [...wordsOf(`${order.brand} ${order.company}`)].some((w) => c.words.has(w))),
    free,
  ];
  const pool = pools.find((p) => p.length) ?? catalog();
  return pool[hashOf(`${order.id}#${salt}`) % pool.length];
}

/** Product lines (lineItems shape) for any order — the stored lineItems
 *  when present, otherwise catalogue products built from itemsSummary.
 *  Lines describe the order as placed (edits sit in qtyModifications);
 *  line totals add up to the original order value exactly. */
export function orderLines(order: Order): OrderLineItem[] {
  if (order.lineItems && order.lineItems.length > 0) return order.lineItems;

  // Parse the summary: "<qty> units <name>", "<name> × <qty>",
  // "<A> + <B>", "<A> + N more".
  const summary = order.itemsSummary.trim();
  const unitsM = /^(\d+)\s+units?\s+(.+)$/i.exec(summary);
  const timesM = /^(.+?)\s*[×x]\s*(\d+)$/i.exec(summary);
  let names: string[];
  let fixedQty: number | undefined;
  let extra = 0;
  if (unitsM) {
    names = [unitsM[2]];
    fixedQty = Number(unitsM[1]);
  } else if (timesM) {
    names = [timesM[1].trim()];
    fixedQty = Number(timesM[2]);
  } else {
    const moreM = /^(.+?)\s*\+\s*(\d+)\s+more$/i.exec(summary);
    if (moreM) {
      names = [moreM[1].trim()];
      extra = Number(moreM[2]);
    } else {
      names = summary.split("+").map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!names.length) names = [summary];
  // A single-product summary still gets 2–3 lines, like a real retailer order.
  if (names.length === 1 && extra === 0) extra = 1 + (hashOf(order.id) % 2);

  const used = new Set<string>();
  const items: CatalogItem[] = [];
  for (const n of names) {
    const c = matchCatalog(n, used) ?? pickRelated(order, items[0], used, items.length);
    used.add(c.sku);
    items.push(c);
  }
  for (let k = 0; k < extra; k++) {
    const c = pickRelated(order, items[0], used, items.length);
    used.add(c.sku);
    items.push(c);
  }

  // Split the value into whole-rupee line totals that add up exactly.
  const total = Math.round(order.originalOrderValue ?? order.orderValue);
  const weights = [1.4, 0.8, 1.1, 0.65, 0.95, 1.2].slice(0, items.length);
  const wSum = weights.reduce((x, w) => x + w, 0);
  // Fixed unit count ("100 units …") is shared across the lines.
  const qtyShare = fixedQty
    ? (() => {
        const q = weights.map((w) => Math.max(1, Math.floor((fixedQty * w) / wSum)));
        q[q.length - 1] = Math.max(1, fixedQty - q.slice(0, -1).reduce((x, n) => x + n, 0));
        return q;
      })()
    : undefined;
  let left = total;
  return items.map((c, i) => {
    const last = i === items.length - 1;
    const target = last ? left : Math.floor((total * weights[i]) / wSum);
    let qty = qtyShare ? qtyShare[i] : Math.max(1, Math.round(target / c.price));
    let lineTotal: number;
    if (!last) {
      const unit = Math.max(1, Math.round(target / qty));
      lineTotal = unit * qty;
    } else {
      lineTotal = left;
      if (!qtyShare) {
        // nearest quantity that divides the remainder into a whole-rupee price
        for (let d = 0; d <= Math.ceil(qty * 0.3); d++) {
          if (qty - d >= 1 && left % (qty - d) === 0) { qty = qty - d; break; }
          if (left % (qty + d) === 0) { qty = qty + d; break; }
        }
      }
    }
    left -= lineTotal;
    const ppu = +(lineTotal / qty).toFixed(2);
    return {
      skuCode: c.sku,
      productName: c.name,
      company: c.company,
      brand: c.brand,
      category: c.category,
      qty,
      originalPricePerUnit: ppu,
      finalPricePerUnit: ppu,
      discountApplied: 0,
      discountDetails: "No Discount",
      lineTotal,
    };
  });
}

export function synthesizeProducts(order: Order): SynthesizedOrderProduct[] {
  return orderLines(order).map((li, idx) => ({
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

// Orders without stored lineItems take their products from the catalogue
// (orderLines), so the order-level Company / Brand follow the first product
// — the Company column, its filter and the order page then agree with the
// product lines. Runs last: orderLines needs the catalogue constants above.
{
  const fix = (o: Order): Order => {
    if (o.lineItems && o.lineItems.length > 0) return o;
    const first = orderLines(o)[0];
    return first ? { ...o, company: first.company, brand: first.brand } : o;
  };
  for (let i = 0; i < seedOrders.length; i++) seedOrders[i] = fix(seedOrders[i]);
  _orders = _orders.map(fix);
}
