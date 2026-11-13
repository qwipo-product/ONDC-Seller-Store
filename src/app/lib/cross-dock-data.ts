// Cross-dock delivery for a CDS-covered seller.
//
// The model (agreed in the 10 Nov 2026 product meetings and built out on
// the logistics side in the Logistics Tech app):
//   - The retailer orders and the distributor confirms here, exactly as
//     today. Ordering serviceability doesn't change.
//   - Delivery serviceability decides how the order travels. If the
//     retailer sits inside a LIVE Cross Dock Store (CDS) area the order is
//     a cross-dock order; otherwise it's a 3PL Direct order, delivered by
//     the distributor themselves or through the 3PL network (Logistics
//     Tech).
//   - Cross-dock orders are collected from the distributor by the CDS
//     Service Centre in fixed pickup rounds. At the pickup the distributor
//     checks the load and gives the driver a pickup OTP; the driver enters
//     it in their app, which closes the pickup. The truck drops the goods
//     at the Cross Dock Stores, each store checks them in (GRN) and its
//     two-wheeler riders deliver to the retailers the next day.
//
// We never call the store a "dark store" on screen — it holds no stock.
//
// This seller ("Sri Venkata Lakshmi Distributors", Balanagar) is the same
// distributor the Logistics Tech demo uses, so both demos tell one story.
// Everything here is in-memory demo state, like lib/orders-data.

import {
  type Order,
  type OrderLineItem,
  getOrders,
  getOrdersDataset,
  getOrdersToday,
  registerOrdersDataset,
  setOrders,
  subscribeToOrders,
  switchOrdersDataset,
} from "./orders-data";

// ---------------------------------------------------------------- seller

export const CDS_SELLER_ID = "seller-cds-svl";
export const CDS_DATASET = "cds-seller";

export const CDS_SELLER = {
  id: CDS_SELLER_ID,
  name: "Ravi Kumar",
  businessName: "Sri Venkata Lakshmi Distributors",
  mobile: "9900000003",
  email: "svl.distributors@qwipo.com",
  address: "Plot 12, IDA Balanagar, Hyderabad 500037",
  code: "SELLER-SVL-001",
  contact: "+91 99000 00003",
};

export function isCdsSeller(user?: { id: string } | null): boolean {
  return user?.id === CDS_SELLER_ID;
}

export const SERVICE_CENTRE = {
  name: "Qwipo CDS Service Centre - Hyderabad",
  contactName: "Suresh Reddy",
  phone: "9876543211",
};

// ------------------------------------------------------- cross dock stores

export interface CrossDockStore {
  code: string;
  name: string;
  shortName: string;
  operatorName: string;
  phone: string;
  locality: string;
  lat: number;
  lng: number;
  /** Delivery area radius around the store. */
  radiusKm: number;
  status: "LIVE" | "ONBOARDING";
}

// Same stores, centres and areas as the Logistics Tech sample day.
export const CROSS_DOCK_STORES: CrossDockStore[] = [
  { code: "CDS-KPHB", name: "Cross Dock Store - KPHB", shortName: "KPHB", operatorName: "Mahesh Goud", phone: "9876543212", locality: "KPHB Colony, Kukatpally", lat: 17.4875, lng: 78.391, radiusKm: 2.3, status: "LIVE" },
  { code: "CDS-MSP", name: "Cross Dock Store - Moosapet", shortName: "Moosapet", operatorName: "Praveen Rao", phone: "9848012345", locality: "Moosapet", lat: 17.463, lng: 78.431, radiusKm: 2.2, status: "LIVE" },
  { code: "CDS-NZP", name: "Cross Dock Store - Nizampet", shortName: "Nizampet", operatorName: "Srinivas Chary", phone: "9848023456", locality: "Nizampet", lat: 17.53, lng: 78.387, radiusKm: 2.2, status: "LIVE" },
  { code: "CDS-ALW", name: "Cross Dock Store - Alwal", shortName: "Alwal", operatorName: "Anil Kumar", phone: "9848034567", locality: "Old Alwal, Secunderabad", lat: 17.504, lng: 78.509, radiusKm: 2.4, status: "ONBOARDING" },
];

export function getCrossDockStore(code?: string): CrossDockStore | undefined {
  return CROSS_DOCK_STORES.find((s) => s.code === code);
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// ------------------------------------------------------------ delivery route

export type DeliveryRoute = "cross-dock" | "direct";

export interface RouteInfo {
  route: DeliveryRoute;
  /** The Cross Dock Store a cross-dock order goes through. */
  store?: CrossDockStore;
  /** Why the order took this route — shown as a tooltip and on the detail page. */
  reason: string;
}

/**
 * Cross-dock when the retailer is inside a LIVE store's area, else 3PL
 * Direct. An explicit `deliveryRoute` / `cdsCode` on the order wins.
 */
export function getRouteInfo(order: Order): RouteInfo {
  if (order.deliveryRoute === "direct") {
    return { route: "direct", reason: "Delivered directly by you or your 3PL partner." };
  }
  const pinned = getCrossDockStore(order.cdsCode);
  if (pinned) {
    return { route: "cross-dock", store: pinned, reason: `Inside the ${pinned.name} delivery area.` };
  }
  if (typeof order.buyerLat !== "number" || typeof order.buyerLng !== "number") {
    return { route: "direct", reason: "No customer location on the order, so it can't be routed through a Cross Dock Store." };
  }
  const lat = order.buyerLat;
  const lng = order.buyerLng;
  const within = CROSS_DOCK_STORES.map((s) => ({ s, d: distanceKm(lat, lng, s.lat, s.lng) }))
    .filter((x) => x.d <= x.s.radiusKm)
    .sort((a, b) => a.d - b.d);
  const live = within.find((x) => x.s.status === "LIVE");
  if (live) {
    return {
      route: "cross-dock",
      store: live.s,
      reason: `Inside the ${live.s.name} delivery area (${live.d.toFixed(1)} km from the store).`,
    };
  }
  const onboarding = within.find((x) => x.s.status === "ONBOARDING");
  if (onboarding) {
    return {
      route: "direct",
      reason: `${onboarding.s.name} covers this customer but is still onboarding, so it's delivered directly for now.`,
    };
  }
  return { route: "direct", reason: "Outside every live Cross Dock Store area." };
}

// ---------------------------------------------------------------- catalogue

interface CatalogueItem {
  name: string;
  company: string;
  brand: string;
  category: string;
  price: number;
  unitWeightKg: number;
  slab?: { minQty: number; price: number; label: string };
}

// SKU codes shared with the default seed keep their pack configs
// (order-quantity edits in inner packs).
const CATALOGUE: Record<string, CatalogueItem> = {
  "SKU-AASH-10": { name: "Aashirvaad Atta 10kg", company: "ITC Limited", brand: "Aashirvaad", category: "Foodgrains", price: 450, unitWeightKg: 10.2, slab: { minQty: 10, price: 420, label: "Slab 2: 10–24 qty • 6.67% off vs ₹450.00" } },
  "180000008": { name: "Freedom Refined Sunflower Oil 1L", company: "Gemini Edibles & Fats India", brand: "Freedom", category: "Edible Oil", price: 171, unitWeightKg: 0.92, slab: { minQty: 48, price: 153.9, label: "Slab 3: 48+ qty • 10% off vs ₹171.00" } },
  "SKU-SUNF-DF150": { name: "Sunfeast Dark Fantasy 150g", company: "ITC Limited", brand: "Sunfeast", category: "Biscuits", price: 35, unitWeightKg: 0.16 },
  "SKU-BING-MA90": { name: "Bingo Mad Angles 90g", company: "ITC Limited", brand: "Bingo", category: "Snacks", price: 20, unitWeightKg: 0.1 },
  "SKU-YIPP-240": { name: "Yippee Noodles 240g", company: "ITC Limited", brand: "Yippee", category: "Noodles", price: 12, unitWeightKg: 0.25 },
  "SKU-CLAS-NB172": { name: "Classmate Notebook 172 Pages", company: "ITC Limited", brand: "Classmate", category: "Stationery", price: 45, unitWeightKg: 0.3 },
  "SKU-TATA-SALT1": { name: "Tata Salt 1kg", company: "Tata Consumer Products", brand: "Tata Salt", category: "Salt & Sugar", price: 28, unitWeightKg: 1.0 },
  "SKU-TTEA-G500": { name: "Tata Tea Gold 500g", company: "Tata Consumer Products", brand: "Tata Tea", category: "Tea", price: 285, unitWeightKg: 0.52 },
  "SKU-PARL-G800": { name: "Parle-G Biscuits 800g", company: "Parle Products", brand: "Parle-G", category: "Biscuits", price: 90, unitWeightKg: 0.82 },
  "SKU-GHDI-DT1K": { name: "Ghadi Detergent Powder 1kg", company: "RSPL Limited", brand: "Ghadi", category: "Detergents", price: 75, unitWeightKg: 1.0 },
  "SKU-FORT-RB5L": { name: "Fortune Rice Bran Oil 5L", company: "Adani Wilmar", brand: "Fortune", category: "Edible Oil", price: 780, unitWeightKg: 4.6 },
};

function lineFor(sku: string, qty: number): OrderLineItem {
  const c = CATALOGUE[sku];
  const onSlab = c.slab && qty >= c.slab.minQty;
  const finalPrice = onSlab ? c.slab!.price : c.price;
  return {
    skuCode: sku,
    productName: c.name,
    company: c.company,
    brand: c.brand,
    category: c.category,
    qty,
    originalPricePerUnit: c.price,
    finalPricePerUnit: finalPrice,
    discountApplied: Math.round((c.price - finalPrice) * qty * 100) / 100,
    discountDetails: onSlab ? c.slab!.label : "—",
    lineTotal: Math.round(finalPrice * qty * 100) / 100,
  };
}

/** Weight of an order's goods, from the line items (falls back to 0.5 kg a unit). */
export function orderWeightKg(order: Order): number {
  const kg = (order.lineItems ?? []).reduce(
    (sum, l) => sum + l.qty * (CATALOGUE[l.skuCode]?.unitWeightKg ?? 0.5),
    0,
  );
  return Math.round(kg * 10) / 10;
}

export function orderUnits(order: Order): number {
  return (order.lineItems ?? []).reduce((sum, l) => sum + l.qty, 0);
}

export const formatKg = (kg: number) =>
  `${kg.toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`;

// ----------------------------------------------------------- seed orders

interface Retailer {
  name: string;
  address: string;
  lat: number;
  lng: number;
  contact: string;
  code: string;
  gst: string;
  beat: string;
}

const R: Record<string, Retailer> = {
  // Inside Cross Dock Store - KPHB
  sriLakshmi: { name: "Sri Lakshmi Kirana", address: "Shop 4, Road No. 1, KPHB Phase 3, Kukatpally, Hyderabad 500072", lat: 17.493, lng: 78.3985, contact: "+91 98490 41122", code: "BUYER-SLK-201", gst: "36AKLPS4421K1ZT", beat: "KPHB 1" },
  vasavi: { name: "Vasavi Provisions", address: "H.No 15-31, KPHB Phase 6, Kukatpally, Hyderabad 500072", lat: 17.4842, lng: 78.387, contact: "+91 98490 52233", code: "BUYER-VSP-202", gst: "36BMNPV7712Q1ZD", beat: "KPHB 2" },
  balaji: { name: "Balaji General Stores", address: "Plot 77, Vivekananda Nagar Colony, Kukatpally, Hyderabad 500072", lat: 17.4905, lng: 78.404, contact: "+91 98490 63344", code: "BUYER-BGS-203", gst: "36CQRPB3390M1ZA", beat: "KPHB 1" },
  mythri: { name: "Mythri Kirana", address: "Shop 9, Allwyn Colony Main Road, Kukatpally, Hyderabad 500072", lat: 17.499, lng: 78.393, contact: "+91 98490 74455", code: "BUYER-MYK-204", gst: "36DTUPM5521H1ZK", beat: "KPHB 2" },
  amma: { name: "Amma Kirana", address: "LIG 212, KPHB Phase 1, Kukatpally, Hyderabad 500072", lat: 17.485, lng: 78.396, contact: "+91 98490 85566", code: "BUYER-AMK-205", gst: "36EVWPA8834J1ZN", beat: "KPHB 1" },
  harsha: { name: "Harsha General Stores", address: "2-55, Hydernagar Main Road, Kukatpally, Hyderabad 500085", lat: 17.496, lng: 78.383, contact: "+91 98490 96677", code: "BUYER-HGS-206", gst: "36FXYPH2245P1ZC", beat: "KPHB 2" },
  // Inside Cross Dock Store - Moosapet
  krishna: { name: "Krishna Kirana", address: "8-12, Bharat Nagar Road, Moosapet, Hyderabad 500018", lat: 17.4598, lng: 78.4385, contact: "+91 98491 07788", code: "BUYER-KRK-207", gst: "36GZAPK6678R1ZE", beat: "Moosapet 1" },
  royal: { name: "Royal Kirana", address: "3-41/2, Moosapet Main Road, Hyderabad 500018", lat: 17.466, lng: 78.426, contact: "+91 98491 18899", code: "BUYER-RYK-208", gst: "36HBCPR9901T1ZG", beat: "Moosapet 1" },
  sunrise: { name: "Sunrise General Store", address: "Shop 3, Erragadda Market, Hyderabad 500018", lat: 17.4575, lng: 78.437, contact: "+91 98491 29900", code: "BUYER-SGS-209", gst: "36JDEPS3312V1ZJ", beat: "Moosapet 2" },
  kabir: { name: "Kabir Stores", address: "5-9, Kabir Nagar, Moosapet, Hyderabad 500018", lat: 17.4665, lng: 78.4355, contact: "+91 98491 32211", code: "BUYER-KBS-210", gst: "36KFGPK7745W1ZM", beat: "Moosapet 2" },
  // Inside Cross Dock Store - Nizampet
  sreeDurga: { name: "Sree Durga Bhavani Stores", address: "H.No 5-118, Nizampet Main Road, Hyderabad 500090", lat: 17.5265, lng: 78.383, contact: "+91 98491 43322", code: "BUYER-SDB-211", gst: "36LHJPS2278X1ZP", beat: "Nizampet 1" },
  pragathi: { name: "Pragathi Super Market", address: "Plot 21, Pragathi Nagar, Hyderabad 500090", lat: 17.5215, lng: 78.3965, contact: "+91 98491 54433", code: "BUYER-PSM-212", gst: "36MKMPP5590Y1ZR", beat: "Nizampet 1" },
  // Outside every live store — 3PL Direct
  greenLeaf: { name: "Green Leaf Mart", address: "12-4/1, Old Bowenpally, Secunderabad 500011", lat: 17.4745, lng: 78.484, contact: "+91 98491 65544", code: "BUYER-GLM-213", gst: "36NPNPG8823Z1ZU", beat: "Bowenpally 1" },
  dailyNeeds: { name: "Daily Needs Store", address: "Shed Road, IDA Jeedimetla, Hyderabad 500055", lat: 17.5105, lng: 78.456, contact: "+91 98491 76655", code: "BUYER-DNS-214", gst: "36PQRPD3356A1ZW", beat: "Jeedimetla 1" },
  cityMart: { name: "City Mart Provisions", address: "Opp. Alwal Bus Stop, Old Alwal, Secunderabad 500010", lat: 17.5045, lng: 78.5075, contact: "+91 98491 87766", code: "BUYER-CMP-215", gst: "36QSTPC6689B1ZY", beat: "Alwal 1" },
  star: { name: "Star Provisions", address: "Suchitra Circle, Quthbullapur, Hyderabad 500067", lat: 17.5, lng: 78.47, contact: "+91 98491 98877", code: "BUYER-STP-216", gst: "36RUVPS9912C1ZB", beat: "Suchitra 1" },
  nandini: { name: "Nandini Kirana", address: "Hasmathpet Road, New Bowenpally, Secunderabad 500011", lat: 17.48, lng: 78.479, contact: "+91 98492 09988", code: "BUYER-NDK-217", gst: "36SWXPN2245D1ZD", beat: "Bowenpally 1" },
  shivaShakti: { name: "Shiva Shakti Stores", address: "Chintal Main Road, Hyderabad 500054", lat: 17.506, lng: 78.452, contact: "+91 98492 10099", code: "BUYER-SSS-218", gst: "36TYZPS5578E1ZF", beat: "Jeedimetla 1" },
  aditya: { name: "Aditya Mart", address: "Fathe Nagar Road, Balanagar, Hyderabad 500037", lat: 17.484, lng: 78.448, contact: "+91 98492 21100", code: "BUYER-ADM-219", gst: "36UABPA8801F1ZH", beat: "Balanagar 1" },
  swathi: { name: "Swathi Provisions", address: "Kompally Main Road, Hyderabad 500100", lat: 17.537, lng: 78.485, contact: "+91 98492 32211", code: "BUYER-SWP-220", gst: "36VCDPS3334G1ZK", beat: "Kompally 1" },
  freshBasket: { name: "Fresh Basket", address: "Quthbullapur Main Road, Hyderabad 500055", lat: 17.519, lng: 78.462, contact: "+91 98492 43322", code: "BUYER-FRB-221", gst: "36WEFPF6667H1ZM", beat: "Jeedimetla 1" },
};

type SeedSpec = {
  id: string;
  retailer: Retailer;
  orderDate: string;
  orderTime: string;
  delivery: string;
  items: [string, number][];
  status: Order["status"];
  payment?: Order["paymentMode"];
  extra?: Partial<Order>;
};

let channelSeq = 640210;

function buildOrder(s: SeedSpec): Order {
  const lineItems = s.items.map(([sku, qty]) => lineFor(sku, qty));
  const first = lineItems[0];
  const orderValue = Math.round(lineItems.reduce((n, l) => n + l.lineTotal, 0) * 100) / 100;
  return {
    id: s.id,
    brand: first.brand,
    company: first.company,
    source: "Qwipo Buyer App",
    retailerName: s.retailer.name,
    itemsSummary:
      lineItems.length > 1 ? `${first.productName} + ${lineItems.length - 1} more` : first.productName,
    orderValue,
    paymentMode: s.payment ?? "COD",
    orderDate: s.orderDate,
    orderTime: s.orderTime,
    status: s.status,
    marketplace: "ONDC",
    buyerContact: s.retailer.contact,
    buyerAddress: s.retailer.address,
    buyerCode: s.retailer.code,
    channelOrderId: `ONDC-ORD-${channelSeq++}`,
    gstNumber: s.retailer.gst,
    lineItems,
    expectedDeliveryDate: s.delivery,
    deliveryType: "Regular",
    beatName: s.retailer.beat,
    orderType: "beat",
    buyerLat: s.retailer.lat,
    buyerLng: s.retailer.lng,
    connectivity: "Online",
    ...s.extra,
  };
}

const YESTERDAY_PICKUP = "Yadagiri · PK-190526-02";

function seedCdsOrders(): Order[] {
  channelSeq = 640210;
  const specs: SeedSpec[] = [
    // ---- New (placed today, delivery tomorrow) ----
    { id: "QWI-ONDC-260520-K7P3XA", retailer: R.sriLakshmi, orderDate: "2026-05-20", orderTime: "09:12 AM", delivery: "2026-05-21", status: "New", items: [["SKU-AASH-10", 6], ["180000008", 24], ["SKU-SUNF-DF150", 60]] },
    { id: "QWI-ONDC-260520-V4M8QD", retailer: R.vasavi, orderDate: "2026-05-20", orderTime: "09:47 AM", delivery: "2026-05-21", status: "New", items: [["SKU-TATA-SALT1", 40], ["SKU-TTEA-G500", 12], ["SKU-PARL-G800", 24]] },
    { id: "QWI-ONDC-260520-R9T2HC", retailer: R.krishna, orderDate: "2026-05-20", orderTime: "10:05 AM", delivery: "2026-05-21", status: "New", items: [["SKU-FORT-RB5L", 6], ["SKU-AASH-10", 4], ["SKU-YIPP-240", 40]] },
    { id: "QWI-ONDC-260520-D6W5NE", retailer: R.royal, orderDate: "2026-05-20", orderTime: "10:31 AM", delivery: "2026-05-21", status: "New", items: [["SKU-GHDI-DT1K", 30], ["SKU-BING-MA90", 80]] },
    { id: "QWI-ONDC-260520-H3Y7GB", retailer: R.sreeDurga, orderDate: "2026-05-20", orderTime: "11:02 AM", delivery: "2026-05-21", status: "New", items: [["180000008", 48], ["SKU-SUNF-DF150", 40], ["SKU-CLAS-NB172", 24]] },
    { id: "QWI-ONDC-260520-T8J4MF", retailer: R.greenLeaf, orderDate: "2026-05-20", orderTime: "11:20 AM", delivery: "2026-05-21", status: "New", items: [["SKU-AASH-10", 8], ["SKU-TATA-SALT1", 30]] },
    { id: "QWI-ONDC-260520-P5C9RK", retailer: R.dailyNeeds, orderDate: "2026-05-20", orderTime: "11:48 AM", delivery: "2026-05-21", status: "New", items: [["SKU-PARL-G800", 36], ["SKU-YIPP-240", 60], ["SKU-TTEA-G500", 6]] },
    { id: "QWI-ONDC-260520-W2N6ZS", retailer: R.cityMart, orderDate: "2026-05-20", orderTime: "12:15 PM", delivery: "2026-05-21", status: "New", items: [["SKU-FORT-RB5L", 4], ["SKU-GHDI-DT1K", 20]] },

    // ---- Confirmed, cross-dock: today's Round 1 pickup (driver at the store) ----
    { id: "QWI-ONDC-260520-B7K3VT", retailer: R.balaji, orderDate: "2026-05-20", orderTime: "08:40 AM", delivery: "2026-05-21", status: "Confirmed", items: [["SKU-AASH-10", 5], ["180000008", 32], ["SKU-BING-MA90", 50]] },
    { id: "QWI-ONDC-260520-M4R8PU", retailer: R.mythri, orderDate: "2026-05-20", orderTime: "08:55 AM", delivery: "2026-05-21", status: "Confirmed", items: [["SKU-TATA-SALT1", 25], ["SKU-SUNF-DF150", 48], ["SKU-YIPP-240", 40]] },
    { id: "QWI-ONDC-260520-G9X2DW", retailer: R.sunrise, orderDate: "2026-05-20", orderTime: "09:20 AM", delivery: "2026-05-21", status: "Confirmed", items: [["SKU-FORT-RB5L", 5], ["SKU-PARL-G800", 24]] },
    { id: "QWI-ONDC-260520-F6H5QY", retailer: R.pragathi, orderDate: "2026-05-20", orderTime: "09:34 AM", delivery: "2026-05-21", status: "Confirmed", items: [["SKU-AASH-10", 10], ["SKU-TTEA-G500", 10], ["SKU-GHDI-DT1K", 20]] },
    // ---- Confirmed, cross-dock: today's Round 2 pickup (scheduled) ----
    { id: "QWI-ONDC-260520-Z3T7KA", retailer: R.amma, orderDate: "2026-05-20", orderTime: "12:40 PM", delivery: "2026-05-21", status: "Confirmed", items: [["SKU-AASH-10", 3], ["180000008", 16], ["SKU-CLAS-NB172", 30]] },
    { id: "QWI-ONDC-260520-N8V4CE", retailer: R.kabir, orderDate: "2026-05-20", orderTime: "01:10 PM", delivery: "2026-05-21", status: "Confirmed", items: [["SKU-TATA-SALT1", 30], ["SKU-BING-MA90", 60]] },
    // ---- Confirmed, cross-dock: picked up yesterday, being delivered today ----
    {
      id: "QWI-ONDC-260519-S5D9MH", retailer: R.vasavi, orderDate: "2026-05-19", orderTime: "10:15 AM", delivery: "2026-05-20", status: "Confirmed",
      items: [["SKU-AASH-10", 4], ["SKU-PARL-G800", 30]],
      extra: { xdStage: "AT_CDS", xdEvents: [
        { stage: "PICKED_UP", at: "19 May, 2:52 PM", by: YESTERDAY_PICKUP },
        { stage: "AT_CDS", at: "20 May, 9:40 AM", by: "GRN by Mahesh Goud, Cross Dock Store - KPHB" },
      ] },
    },
    {
      id: "QWI-ONDC-260519-Q2G6RJ", retailer: R.krishna, orderDate: "2026-05-19", orderTime: "10:42 AM", delivery: "2026-05-20", status: "Confirmed",
      items: [["180000008", 48], ["SKU-YIPP-240", 50]],
      extra: { xdStage: "OUT_FOR_DELIVERY", xdEvents: [
        { stage: "PICKED_UP", at: "19 May, 2:52 PM", by: YESTERDAY_PICKUP },
        { stage: "AT_CDS", at: "20 May, 10:05 AM", by: "GRN by Praveen Rao, Cross Dock Store - Moosapet" },
        { stage: "OUT_FOR_DELIVERY", at: "20 May, 12:30 PM", by: "Rider Arjun Rao" },
      ] },
    },
    {
      id: "QWI-ONDC-260519-U7W3TN", retailer: R.sreeDurga, orderDate: "2026-05-19", orderTime: "11:05 AM", delivery: "2026-05-20", status: "Confirmed",
      items: [["SKU-TTEA-G500", 8], ["SKU-SUNF-DF150", 60], ["SKU-TATA-SALT1", 20]],
      extra: { xdStage: "OUT_FOR_DELIVERY", xdEvents: [
        { stage: "PICKED_UP", at: "19 May, 2:52 PM", by: YESTERDAY_PICKUP },
        { stage: "AT_CDS", at: "20 May, 10:20 AM", by: "GRN by Srinivas Chary, Cross Dock Store - Nizampet" },
        { stage: "OUT_FOR_DELIVERY", at: "20 May, 12:45 PM", by: "Rider Vinod Kumar" },
      ] },
    },

    // ---- Confirmed, 3PL Direct ----
    { id: "QWI-ONDC-260519-E4K8YP", retailer: R.star, orderDate: "2026-05-19", orderTime: "03:30 PM", delivery: "2026-05-20", status: "Confirmed", items: [["SKU-AASH-10", 6], ["SKU-GHDI-DT1K", 24]] },
    { id: "QWI-ONDC-260520-J9M2XB", retailer: R.nandini, orderDate: "2026-05-20", orderTime: "08:20 AM", delivery: "2026-05-21", status: "Confirmed", items: [["SKU-PARL-G800", 30], ["SKU-YIPP-240", 40], ["SKU-TATA-SALT1", 20]] },
    {
      id: "QWI-ONDC-260519-Y6P5FC", retailer: R.shivaShakti, orderDate: "2026-05-19", orderTime: "04:10 PM", delivery: "2026-05-20", status: "Confirmed",
      items: [["SKU-FORT-RB5L", 6], ["SKU-SUNF-DF150", 40]],
      extra: { logisticsRequested: true, logisticsRequestedAt: "2026-05-20T09:10:00+05:30" },
    },

    // ---- Delivered ----
    {
      id: "QWI-ONDC-260519-A3R7WG", retailer: R.royal, orderDate: "2026-05-19", orderTime: "09:50 AM", delivery: "2026-05-20", status: "Delivered",
      items: [["SKU-AASH-10", 3], ["SKU-BING-MA90", 40]],
      extra: { actualDeliveryDate: "2026-05-20", cdsCode: "CDS-MSP", xdEvents: [
        { stage: "PICKED_UP", at: "19 May, 2:52 PM", by: YESTERDAY_PICKUP },
        { stage: "AT_CDS", at: "20 May, 10:05 AM", by: "GRN by Praveen Rao, Cross Dock Store - Moosapet" },
        { stage: "OUT_FOR_DELIVERY", at: "20 May, 12:30 PM", by: "Rider Arjun Rao" },
        { stage: "DELIVERED", at: "20 May, 1:15 PM", by: "Rider Arjun Rao · delivery OTP verified" },
      ] },
    },
    {
      id: "QWI-ONDC-260518-C8T4HK", retailer: R.pragathi, orderDate: "2026-05-18", orderTime: "11:30 AM", delivery: "2026-05-19", status: "Delivered",
      items: [["180000008", 32], ["SKU-TTEA-G500", 6]],
      extra: { actualDeliveryDate: "2026-05-19", cdsCode: "CDS-NZP", xdEvents: [
        { stage: "PICKED_UP", at: "18 May, 6:20 PM", by: "Shankar Babu · PK-180526-04" },
        { stage: "AT_CDS", at: "19 May, 9:55 AM", by: "GRN by Srinivas Chary, Cross Dock Store - Nizampet" },
        { stage: "OUT_FOR_DELIVERY", at: "19 May, 12:40 PM", by: "Rider Harish Goud" },
        { stage: "DELIVERED", at: "19 May, 1:30 PM", by: "Rider Harish Goud · delivery OTP verified" },
      ] },
    },
    { id: "QWI-ONDC-260518-K5V9NM", retailer: R.aditya, orderDate: "2026-05-18", orderTime: "02:15 PM", delivery: "2026-05-19", status: "Delivered", items: [["SKU-GHDI-DT1K", 40], ["SKU-TATA-SALT1", 30]], extra: { actualDeliveryDate: "2026-05-19" } },
    { id: "QWI-ONDC-260517-X2F6DQ", retailer: R.swathi, orderDate: "2026-05-17", orderTime: "10:05 AM", delivery: "2026-05-18", status: "Delivered", payment: "Prepaid", items: [["SKU-AASH-10", 5], ["SKU-PARL-G800", 24]], extra: { actualDeliveryDate: "2026-05-18" } },

    // ---- Cancelled ----
    { id: "QWI-ONDC-260519-H7B3US", retailer: R.freshBasket, orderDate: "2026-05-19", orderTime: "05:20 PM", delivery: "2026-05-20", status: "Cancelled", items: [["SKU-YIPP-240", 60], ["SKU-BING-MA90", 40]], extra: { cancelledBy: "Buyer", cancellationReason: "Ordered by mistake", cancellationTime: "2026-05-19T18:02:00+05:30" } },
    { id: "QWI-ONDC-260518-R4Z8EV", retailer: R.harsha, orderDate: "2026-05-18", orderTime: "01:40 PM", delivery: "2026-05-19", status: "Cancelled", items: [["SKU-FORT-RB5L", 8]], extra: { cancelledBy: "Seller", cancellationReason: "Out of Stock", cancellationTime: "2026-05-18T15:12:00+05:30" } },
  ];
  return specs.map(buildOrder);
}

registerOrdersDataset(CDS_DATASET, seedCdsOrders, {
  name: CDS_SELLER.businessName,
  contact: CDS_SELLER.contact,
  code: CDS_SELLER.code,
});

// ------------------------------------------------------------------ pickups

export type PickupRound = "R1" | "R2" | "EARLY_AM";

export const PICKUP_ROUNDS: Record<PickupRound, { label: string; window: string }> = {
  R1: { label: "Round 1", window: "2:00 – 5:00 PM" },
  R2: { label: "Round 2", window: "5:00 – 8:00 PM" },
  EARLY_AM: { label: "Early-morning top-up", window: "6:00 – 11:00 AM" },
};

/** SCHEDULED → ARRIVED (driver at the seller) → PICKED_UP. RELEASED = every order held back. */
export type PickupStatus = "SCHEDULED" | "ARRIVED" | "PICKED_UP" | "RELEASED";

export interface PickupVehicle {
  regNo: string;
  model: string;
  type: "3-wheeler" | "4-wheeler";
  capacityKg: number;
}

export interface HeldBackOrder {
  orderId: string;
  reason: string;
  movedToTripNo: string;
  at: string;
}

export interface Pickup {
  id: string;
  /** Service Centre trip number, same format as Logistics Tech. */
  tripNo: string;
  date: string;
  round: PickupRound;
  vehicle: PickupVehicle;
  driver: { name: string; phone: string };
  status: PickupStatus;
  plannedAt: string;
  eta: string;
  arrivedAt?: string;
  pickedUpAt?: string;
  orderIds: string[];
  /** Orders the seller has ticked as loaded on the vehicle. */
  loadedIds: string[];
  heldBack: HeldBackOrder[];
  /** Pickup OTP the seller gives the driver once the load is checked. */
  otp: string;
  otpShown: boolean;
}

const V = {
  ace: { regNo: "TS 08 UF 2234", model: "Tata Ace Gold", type: "4-wheeler", capacityKg: 750 },
  ape: { regNo: "TS 07 UE 3345", model: "Piaggio Ape Xtra LDX", type: "3-wheeler", capacityKg: 500 },
  supro: { regNo: "TS 10 UB 9087", model: "Mahindra Supro Maxitruck", type: "4-wheeler", capacityKg: 1000 },
  ape2: { regNo: "TS 09 UC 4521", model: "Piaggio Ape Xtra LDX", type: "3-wheeler", capacityKg: 500 },
} satisfies Record<string, PickupVehicle>;

const D = {
  yadagiri: { name: "Yadagiri", phone: "9701344556" },
  venkatesh: { name: "Venkatesh Kumar", phone: "9701566778" },
  shankar: { name: "Shankar Babu", phone: "9701455667" },
  ramesh: { name: "Ramesh Naik", phone: "9701122334" },
};

function seedPickups(): Pickup[] {
  return [
    {
      id: "pk-200526-03", tripNo: "PK-200526-03", date: "2026-05-20", round: "R1",
      vehicle: V.ace, driver: D.yadagiri, status: "ARRIVED",
      plannedAt: "20 May, 2:05 PM", eta: "3:40 PM", arrivedAt: "20 May, 3:38 PM",
      orderIds: ["QWI-ONDC-260520-B7K3VT", "QWI-ONDC-260520-M4R8PU", "QWI-ONDC-260520-G9X2DW", "QWI-ONDC-260520-F6H5QY"],
      loadedIds: [], heldBack: [], otp: "4827", otpShown: false,
    },
    {
      id: "pk-200526-07", tripNo: "PK-200526-07", date: "2026-05-20", round: "R2",
      vehicle: V.ape, driver: D.venkatesh, status: "SCHEDULED",
      plannedAt: "20 May, 2:40 PM", eta: "5:45 PM",
      orderIds: ["QWI-ONDC-260520-Z3T7KA", "QWI-ONDC-260520-N8V4CE"],
      loadedIds: [], heldBack: [], otp: "6153", otpShown: false,
    },
    {
      id: "pk-190526-02", tripNo: "PK-190526-02", date: "2026-05-19", round: "R1",
      vehicle: V.ace, driver: D.yadagiri, status: "PICKED_UP",
      plannedAt: "19 May, 2:04 PM", eta: "2:40 PM", arrivedAt: "19 May, 2:41 PM", pickedUpAt: "19 May, 2:52 PM",
      orderIds: ["QWI-ONDC-260519-S5D9MH", "QWI-ONDC-260519-Q2G6RJ", "QWI-ONDC-260519-U7W3TN", "QWI-ONDC-260519-A3R7WG"],
      loadedIds: ["QWI-ONDC-260519-S5D9MH", "QWI-ONDC-260519-Q2G6RJ", "QWI-ONDC-260519-U7W3TN", "QWI-ONDC-260519-A3R7WG"],
      heldBack: [], otp: "3390", otpShown: true,
    },
    {
      id: "pk-180526-04", tripNo: "PK-180526-04", date: "2026-05-18", round: "R2",
      vehicle: V.supro, driver: D.shankar, status: "PICKED_UP",
      plannedAt: "18 May, 4:50 PM", eta: "6:10 PM", arrivedAt: "18 May, 6:08 PM", pickedUpAt: "18 May, 6:20 PM",
      orderIds: ["QWI-ONDC-260518-C8T4HK"], loadedIds: ["QWI-ONDC-260518-C8T4HK"],
      heldBack: [], otp: "7182", otpShown: true,
    },
  ];
}

let _pickups: Pickup[] = seedPickups();
const _pickupListeners = new Set<() => void>();
const notifyPickups = () => _pickupListeners.forEach((cb) => cb());

export function subscribeToPickups(cb: () => void): () => void {
  _pickupListeners.add(cb);
  return () => {
    _pickupListeners.delete(cb);
  };
}

export function getPickups(): Pickup[] {
  return _pickups;
}

export function getPickup(id?: string): Pickup | undefined {
  return _pickups.find((p) => p.id === id);
}

export function getPickupForOrder(orderId: string): Pickup | undefined {
  return _pickups.find((p) => p.orderIds.includes(orderId));
}

/** Pickups still to happen (today's and the next morning's top-up). */
export function getOpenPickups(): Pickup[] {
  return _pickups.filter((p) => p.status === "SCHEDULED" || p.status === "ARRIVED");
}

const ROUND_ORDER: Record<PickupRound, number> = { R1: 1, R2: 2, EARLY_AM: 3 };
const byWhen = (a: Pickup, b: Pickup) =>
  a.date.localeCompare(b.date) || ROUND_ORDER[a.round] - ROUND_ORDER[b.round];

export function sortPickups(list: Pickup[]): Pickup[] {
  return [...list].sort(byWhen);
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Demo clock: the orders module's fixed "today" with the real time of day. */
export function nowLabel(): string {
  const today = getOrdersToday();
  const d = new Date();
  const h = d.getHours();
  const time = `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
  return `${Number(today.slice(8, 10))} ${MONTHS[Number(today.slice(5, 7)) - 1]}, ${time}`;
}

/** "20 May, 3:38 PM" + n minutes. The demo clock is fixed, so pickup
 *  events follow the pickup's own times rather than the real clock. */
function laterBy(label: string, minutes: number): string {
  const m = label.match(/^(.*), (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!m) return label;
  let mins = ((Number(m[2]) % 12) + (m[4] === "PM" ? 12 : 0)) * 60 + Number(m[3]) + minutes;
  mins = Math.min(mins, 23 * 60 + 59);
  const h = Math.floor(mins / 60);
  return `${m[1]}, ${h % 12 || 12}:${pad(mins % 60)} ${h < 12 ? "AM" : "PM"}`;
}

/** "20 May" for an ISO date. */
function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

export function dayLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
}

/**
 * The pickup a newly confirmed (or held-back) order joins: the next
 * scheduled pickup after `after`, else a fresh early-morning top-up.
 * Stands in for the Service Centre's pickup planning.
 */
function nextScheduledPickup(after?: Pickup): Pickup {
  const candidates = sortPickups(_pickups.filter((p) => p.status === "SCHEDULED"))
    .filter((p) => !after || byWhen(p, after) > 0);
  if (candidates[0]) return candidates[0];
  const date = addDays(getOrdersToday(), 1);
  const yymmdd = `${date.slice(8, 10)}${date.slice(5, 7)}${date.slice(2, 4)}`;
  const seq = _pickups.filter((p) => p.date === date).length + 1;
  const topUp: Pickup = {
    id: `pk-${yymmdd}-${pad(seq)}`,
    tripNo: `PK-${yymmdd}-${pad(seq)}`,
    date,
    round: "EARLY_AM",
    vehicle: V.ape2,
    driver: D.ramesh,
    status: "SCHEDULED",
    plannedAt: nowLabel(),
    eta: "7:30 AM",
    orderIds: [],
    loadedIds: [],
    heldBack: [],
    otp: String(1000 + Math.floor(Math.random() * 9000)),
    otpShown: false,
  };
  _pickups = [..._pickups, topUp];
  return topUp;
}

function updatePickup(id: string, patch: (p: Pickup) => Pickup) {
  _pickups = _pickups.map((p) => (p.id === id ? patch(p) : p));
  notifyPickups();
}

export class PickupRuleError extends Error {}

/** Demo stand-in for the driver reporting at the seller's gate. */
export function markDriverArrived(id: string) {
  const p = getPickup(id);
  if (!p || p.status !== "SCHEDULED") return;
  // The driver turns up at the pickup's ETA (the demo clock is fixed).
  updatePickup(id, (x) => ({ ...x, status: "ARRIVED", arrivedAt: `${shortDate(x.date)}, ${x.eta}` }));
}

export function setOrderLoaded(id: string, orderId: string, loaded: boolean) {
  updatePickup(id, (p) => {
    if (p.status === "PICKED_UP" || p.otpShown) return p;
    const others = p.loadedIds.filter((x) => x !== orderId);
    return { ...p, loadedIds: loaded ? [...others, orderId] : others };
  });
}

export function setAllLoaded(id: string, loaded: boolean) {
  updatePickup(id, (p) =>
    p.status === "PICKED_UP" || p.otpShown ? p : { ...p, loadedIds: loaded ? [...p.orderIds] : [] },
  );
}

/** Keep an order off this vehicle; it rides the next pickup instead. */
export function holdBackOrder(id: string, orderId: string, reason: string): Pickup {
  const p = getPickup(id);
  if (!p || p.status === "PICKED_UP") throw new PickupRuleError("This pickup is already closed.");
  if (p.otpShown) throw new PickupRuleError("The OTP has already been given to the driver. Ask the driver to cancel it before changing the load.");
  const target = nextScheduledPickup(p);
  _pickups = _pickups.map((x) => {
    if (x.id === p.id) {
      const orderIds = x.orderIds.filter((o) => o !== orderId);
      return {
        ...x,
        orderIds,
        loadedIds: x.loadedIds.filter((o) => o !== orderId),
        heldBack: [...x.heldBack, { orderId, reason, movedToTripNo: target.tripNo, at: nowLabel() }],
        status: orderIds.length === 0 ? "RELEASED" : x.status,
      };
    }
    if (x.id === target.id) return { ...x, orderIds: [...x.orderIds, orderId] };
    return x;
  });
  notifyPickups();
  return target;
}

/** Reveal the pickup OTP — only once the driver is here and every order is loaded. */
export function showPickupOtp(id: string) {
  const p = getPickup(id);
  if (!p) return;
  if (p.status !== "ARRIVED") throw new PickupRuleError("The driver hasn't reached your store yet.");
  const missing = p.orderIds.filter((o) => !p.loadedIds.includes(o));
  if (missing.length) throw new PickupRuleError(`Tick ${missing.length} more order${missing.length === 1 ? "" : "s"} as loaded first, or hold them back.`);
  updatePickup(id, (x) => ({ ...x, otpShown: true }));
}

/** The driver types the seller's OTP into their app (simulated on screen). */
export function driverEntersOtp(id: string, otp: string): Pickup {
  const p = getPickup(id);
  if (!p) throw new PickupRuleError("Pickup not found.");
  if (p.status !== "ARRIVED" || !p.otpShown) throw new PickupRuleError("The seller hasn't shared the OTP yet.");
  if (otp.trim() !== p.otp) throw new PickupRuleError("That OTP doesn't match. Check the OTP shown to the seller.");
  // Loading takes a few minutes after the driver arrives.
  const at = laterBy(p.arrivedAt ?? `${shortDate(p.date)}, ${p.eta}`, 12);
  const ids = new Set(p.orderIds);
  setOrders(
    getOrders().map((o) =>
      ids.has(o.id)
        ? {
            ...o,
            xdStage: "PICKED_UP" as const,
            xdEvents: [...(o.xdEvents ?? []), { stage: "PICKED_UP" as const, at, by: `${p.driver.name} · ${p.tripNo}` }],
          }
        : o,
    ),
  );
  updatePickup(id, (x) => ({ ...x, status: "PICKED_UP", pickedUpAt: at }));
  return getPickup(id)!;
}

export function pickupWeightKg(p: Pickup): number {
  const orders = getOrders().filter((o) => p.orderIds.includes(o.id));
  return Math.round(orders.reduce((n, o) => n + orderWeightKg(o), 0) * 10) / 10;
}

/** Cross Dock Stores this pickup drops at. */
export function pickupStores(p: Pickup): CrossDockStore[] {
  const codes = new Set<string>();
  for (const o of getOrders()) {
    if (!p.orderIds.includes(o.id)) continue;
    const s = getRouteInfo(o).store;
    if (s) codes.add(s.code);
  }
  return CROSS_DOCK_STORES.filter((s) => codes.has(s.code));
}

export interface PickupProductLine {
  skuCode: string;
  productName: string;
  company: string;
  qty: number;
  orders: number;
  weightKg: number;
}

/** Product view of a pickup's load: totals per SKU across its orders. */
export function pickupProducts(p: Pickup): PickupProductLine[] {
  const map = new Map<string, PickupProductLine>();
  for (const o of getOrders()) {
    if (!p.orderIds.includes(o.id)) continue;
    for (const l of o.lineItems ?? []) {
      const row = map.get(l.skuCode) ?? { skuCode: l.skuCode, productName: l.productName, company: l.company, qty: 0, orders: 0, weightKg: 0 };
      row.qty += l.qty;
      row.orders += 1;
      row.weightKg = Math.round((row.weightKg + l.qty * (CATALOGUE[l.skuCode]?.unitWeightKg ?? 0.5)) * 10) / 10;
      map.set(l.skuCode, row);
    }
  }
  return [...map.values()].sort((a, b) => b.weightKg - a.weightKg);
}

// ------------------------------------------------------------- order stage

export type CrossDockStage = "AWAITING_PICKUP" | "PICKED_UP" | "AT_CDS" | "OUT_FOR_DELIVERY" | "DELIVERED";

export const STAGE_META: Record<CrossDockStage, { label: string; className: string }> = {
  AWAITING_PICKUP: { label: "Awaiting pickup", className: "bg-amber-50 text-amber-800 border-amber-200" },
  PICKED_UP: { label: "Picked up · to store", className: "bg-sky-50 text-sky-800 border-sky-200" },
  AT_CDS: { label: "At Cross Dock Store", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", className: "bg-violet-50 text-violet-700 border-violet-200" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const ACTIVE_STAGES: CrossDockStage[] = ["AWAITING_PICKUP", "PICKED_UP", "AT_CDS", "OUT_FOR_DELIVERY"];

export function getCrossDockStage(order: Order): CrossDockStage {
  if (order.status === "Delivered") return "DELIVERED";
  if (order.xdStage) return order.xdStage;
  return getPickupForOrder(order.id)?.status === "PICKED_UP" ? "PICKED_UP" : "AWAITING_PICKUP";
}

export interface TimelineStep {
  key: string;
  label: string;
  detail?: string;
  at?: string;
  state: "done" | "current" | "todo";
}

/** The cross-dock journey of a confirmed order, for the order detail page. */
export function getCrossDockTimeline(order: Order): TimelineStep[] {
  const route = getRouteInfo(order);
  const store = route.store;
  const stage = getCrossDockStage(order);
  const pickup = getPickupForOrder(order.id);
  const ev = (s: string) => order.xdEvents?.find((e) => e.stage === s);
  const rank: Record<CrossDockStage, number> = { AWAITING_PICKUP: 0, PICKED_UP: 1, AT_CDS: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4 };
  const r = rank[stage];
  const state = (i: number): TimelineStep["state"] => (r >= i ? "done" : r + 1 === i ? "current" : "todo");
  const pickupDetail = pickup
    ? `${PICKUP_ROUNDS[pickup.round].label} (${dayLabel(pickup.date)}, ${PICKUP_ROUNDS[pickup.round].window}) · ${pickup.tripNo} · ${pickup.vehicle.regNo} · driver ${pickup.driver.name}`
    : "Waiting for the Service Centre to plan the pickup";
  return [
    { key: "confirmed", label: "Confirmed by you", detail: `Routed through ${store?.name ?? "a Cross Dock Store"}`, state: "done" },
    {
      key: "pickup",
      label: r >= 1 ? "Picked up by the Service Centre" : pickup?.status === "ARRIVED" ? "Driver at your store for pickup" : "Pickup scheduled",
      detail: pickupDetail,
      at: ev("PICKED_UP")?.at ?? pickup?.pickedUpAt,
      state: r >= 1 ? "done" : "current",
    },
    { key: "store", label: `Received at ${store?.name ?? "the Cross Dock Store"}`, detail: ev("AT_CDS")?.by ?? "The store checks the goods in (GRN) before delivery planning", at: ev("AT_CDS")?.at, state: state(2) },
    { key: "out", label: "Out for delivery", detail: ev("OUT_FOR_DELIVERY")?.by ?? "A two-wheeler rider from the store", at: ev("OUT_FOR_DELIVERY")?.at, state: state(3) },
    { key: "delivered", label: "Delivered to the retailer", detail: ev("DELIVERED")?.by ?? "Confirmed with the retailer's delivery OTP", at: ev("DELIVERED")?.at, state: state(4) },
  ];
}

// --------------------------------------------------- confirmed → pickup

/**
 * Keep pickups in step with the order book: a newly confirmed cross-dock
 * order joins the next scheduled pickup, and a cancelled order comes off
 * any pickup that hasn't happened yet. Runs on every order-store write, so
 * it covers confirmations from the list, the detail page and the gate.
 */
function syncPickups() {
  if (getOrdersDataset() !== CDS_DATASET) return;
  const orders = getOrders();
  const cancelled = new Set(orders.filter((o) => o.status === "Cancelled").map((o) => o.id));
  let changed = false;
  if (cancelled.size) {
    _pickups = _pickups.map((p) => {
      if (p.status === "PICKED_UP" || !p.orderIds.some((id) => cancelled.has(id))) return p;
      changed = true;
      return {
        ...p,
        orderIds: p.orderIds.filter((id) => !cancelled.has(id)),
        loadedIds: p.loadedIds.filter((id) => !cancelled.has(id)),
      };
    });
  }
  const assigned = new Set(_pickups.flatMap((p) => p.orderIds));
  const waiting = orders.filter(
    (o) =>
      o.status === "Confirmed" &&
      !o.xdStage &&
      !assigned.has(o.id) &&
      getRouteInfo(o).route === "cross-dock",
  );
  if (waiting.length) {
    const target = nextScheduledPickup();
    _pickups = _pickups.map((p) =>
      p.id === target.id ? { ...p, orderIds: [...p.orderIds, ...waiting.map((o) => o.id)] } : p,
    );
    changed = true;
  }
  if (changed) notifyPickups();
}

subscribeToOrders(syncPickups);

/** Point the order store at the right persona's order book on sign-in. */
export function applyOrdersDatasetFor(user?: { id: string } | null) {
  switchOrdersDataset(isCdsSeller(user) ? CDS_DATASET : "default");
}
