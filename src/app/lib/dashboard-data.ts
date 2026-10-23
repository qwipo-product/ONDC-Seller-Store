// Dashboard rollups — pure functions that read every existing
// data store (admin-catalog, sampleSKUs, customers, offers, orders)
// and compute the seller-level KPIs the Dashboard surfaces.
//
// All counts are derived; nothing is persisted here. The dashboard
// re-runs `getDashboardSnapshot(range)` whenever the date range or
// the underlying stores change, so every render is consistent with
// the rest of the app.
//
// Date-range semantics:
//   - Catalog (companies / brands / SKUs)     → current snapshot.
//                                                These are master
//                                                records without a
//                                                creation date, so
//                                                "filter by range"
//                                                doesn't apply.
//   - Customers                                → current snapshot.
//                                                The customer record
//                                                has no registered-at
//                                                field today.
//   - Offers (QPS schemes)                     → schemes whose
//                                                [startDate, endDate]
//                                                OVERLAPS the range.
//   - Orders                                   → orderDate falls
//                                                within the range.

import { getCompanies, type Company } from "./admin-catalog";
import { sampleSKUs, type SKUData } from "./my-sku-data";
import { getDemoCustomers, type DemoCustomer } from "./customers-demo-data";
import { getAllSchemes } from "./offers-data";
import type { QpsScheme } from "./qps-validation";
import { getOrders, type Order } from "./orders-data";

export interface DateRange {
  /** Inclusive lower bound — YYYY-MM-DD. */
  from: string;
  /** Inclusive upper bound — YYYY-MM-DD. */
  to: string;
}

export interface StatusSplit {
  total: number;
  active: number;
  inactive: number;
}

export interface SkuKpis extends StatusSplit {
  compliant: number;
  nonCompliant: number;
}

export interface CustomerKpis {
  total: number;
  active: number;
  blocked: number;
}

export interface OfferKpis {
  total: number;
  active: number;
  inactive: number;
  scheduled: number;
  expired: number;
}

export interface OrderKpis {
  total: number;
  new: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
  totalValue: number;
}

export interface CompanyBreakdownRow {
  companyId: string;
  companyName: string;
  isActive: boolean;
  brandCount: number;
  skuCount: number;
  activeSkuCount: number;
  compliantSkuCount: number;
  customerCount: number;
  offerCount: number;
  orderCount: number;
  orderValue: number;
  categoryCount: number;
}

export interface DashboardSnapshot {
  range: DateRange;
  companies: StatusSplit;
  brands: StatusSplit;
  skus: SkuKpis;
  customers: CustomerKpis;
  offers: OfferKpis;
  orders: OrderKpis;
  companyBreakdown: CompanyBreakdownRow[];
}

export interface OrderTrendPoint {
  /** Bucket label — short, "Mon 02" / "May 04" / etc, chosen by
   *  caller. We just key by ISO date and let the page format it. */
  date: string;
  total: number;
  new: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
  value: number;
}

export interface CategorySliceRow {
  category: string;
  skuCount: number;
}

export interface CompanyDrilldown {
  range: DateRange;
  company: Company;
  brands: Array<{
    brandId: string;
    brandName: string;
    skuCount: number;
    activeSkuCount: number;
    compliantSkuCount: number;
  }>;
  skus: SkuKpis;
  categories: Array<{ name: string; skuCount: number }>;
  customers: CustomerKpis;
  offers: OfferKpis;
  orders: OrderKpis;
  recentOrders: Order[];
  recentSkus: SKUData[];
}

// ---------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------

const ISO = (d: Date) => d.toISOString().slice(0, 10);

export const todayISO = () => ISO(new Date());

const minusDays = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - days);
  return ISO(d);
};

export type PresetRangeId =
  | "today"
  | "last-7"
  | "last-30"
  | "month-to-date"
  | "year-to-date";

export function presetRange(id: PresetRangeId): DateRange {
  const today = todayISO();
  switch (id) {
    case "today":
      return { from: today, to: today };
    case "last-7":
      return { from: minusDays(today, 6), to: today };
    case "last-30":
      return { from: minusDays(today, 29), to: today };
    case "month-to-date": {
      const d = new Date(today + "T00:00:00");
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      return { from: ISO(start), to: today };
    }
    case "year-to-date": {
      const d = new Date(today + "T00:00:00");
      const start = new Date(d.getFullYear(), 0, 1);
      return { from: ISO(start), to: today };
    }
  }
}

export const PRESET_RANGE_LABELS: Record<PresetRangeId, string> = {
  today: "Today",
  "last-7": "Last 7 days",
  "last-30": "Last 30 days",
  "month-to-date": "This month",
  "year-to-date": "This year",
};

// ---------------------------------------------------------------------
// Filters — shared between the seller-wide and per-company rollups.
// ---------------------------------------------------------------------

const orderInRange = (o: Order, range: DateRange) =>
  o.orderDate >= range.from && o.orderDate <= range.to;

const schemeOverlapsRange = (s: QpsScheme, range: DateRange) =>
  s.endDate >= range.from && s.startDate <= range.to;

// Build a lookup brand → companyId. A brand is keyed in the dashboard
// by lowercased name (the SKU records store the brand name, not its
// admin-catalog id).
function buildBrandIndex(companies: Company[]) {
  const byBrandName = new Map<string, { companyId: string; brandId: string }>();
  companies.forEach((co) => {
    co.brands.forEach((b) => {
      byBrandName.set(b.name.toLowerCase(), {
        companyId: co.id,
        brandId: b.id,
      });
    });
  });
  return byBrandName;
}

// Map a SKU to a companyId via its brand name (case-insensitive).
// SKUs whose brand isn't in the catalog are bucketed as "orphan" and
// stay out of per-company rollups.
function companyIdForSku(
  sku: SKUData,
  brandIndex: ReturnType<typeof buildBrandIndex>,
): string | null {
  const hit = brandIndex.get(sku.brand.toLowerCase());
  return hit ? hit.companyId : null;
}

// ---------------------------------------------------------------------
// Seller-wide snapshot
// ---------------------------------------------------------------------

export function getDashboardSnapshot(range: DateRange): DashboardSnapshot {
  const companies = getCompanies();
  const skus = sampleSKUs;
  const customers = getDemoCustomers();
  const schemes = getAllSchemes();
  const orders = getOrders();
  const brandIndex = buildBrandIndex(companies);

  // --- Catalog ---
  const companyKpis: StatusSplit = {
    total: companies.length,
    active: companies.filter((c) => c.isActive !== false).length,
    inactive: companies.filter((c) => c.isActive === false).length,
  };

  const allBrands = companies.flatMap((c) => c.brands);
  const brandKpis: StatusSplit = {
    total: allBrands.length,
    // The Brand model doesn't carry its own active flag — inherit
    // from the parent company.
    active: companies
      .filter((c) => c.isActive !== false)
      .reduce((n, c) => n + c.brands.length, 0),
    inactive: companies
      .filter((c) => c.isActive === false)
      .reduce((n, c) => n + c.brands.length, 0),
  };

  const skuKpis: SkuKpis = {
    total: skus.length,
    active: skus.filter((s) => s.status === "Active").length,
    inactive: skus.filter((s) => s.status !== "Active").length,
    compliant: skus.filter((s) => s.ondcCompliance.isCompliant).length,
    nonCompliant: skus.filter((s) => !s.ondcCompliance.isCompliant).length,
  };

  // --- Customers (snapshot — no date field on the record) ---
  let activeCustomers = 0;
  let blockedCustomers = 0;
  customers.forEach((c) => {
    // A customer is "active" overall when at least one of their company
    // links is Active. Blocked-only customers are fully blocked.
    const anyActive = c.companies.some((co) => co.status === "Active");
    if (anyActive) activeCustomers++;
    else blockedCustomers++;
  });
  const customerKpis: CustomerKpis = {
    total: customers.length,
    active: activeCustomers,
    blocked: blockedCustomers,
  };

  // --- Offers — date-filtered ---
  const offersInWindow = schemes.filter((s) => schemeOverlapsRange(s, range));
  const offerKpis: OfferKpis = {
    total: offersInWindow.length,
    active: offersInWindow.filter((s) => s.status === "Active").length,
    inactive: offersInWindow.filter((s) => s.status === "Inactive").length,
    scheduled: offersInWindow.filter((s) => s.status === "Scheduled").length,
    expired: offersInWindow.filter((s) => s.status === "Expired").length,
  };

  // --- Orders — date-filtered ---
  const ordersInWindow = orders.filter((o) => orderInRange(o, range));
  const orderKpis: OrderKpis = {
    total: ordersInWindow.length,
    new: ordersInWindow.filter((o) => o.status === "New").length,
    confirmed: ordersInWindow.filter((o) => o.status === "Confirmed").length,
    delivered: ordersInWindow.filter((o) => o.status === "Delivered").length,
    cancelled: ordersInWindow.filter((o) => o.status === "Cancelled").length,
    totalValue: ordersInWindow.reduce((n, o) => n + o.orderValue, 0),
  };

  // --- Per-company breakdown ---
  const companyBreakdown: CompanyBreakdownRow[] = companies.map((co) => {
    const companySkus = skus.filter((s) => companyIdForSku(s, brandIndex) === co.id);
    const companyOrders = ordersInWindow.filter((o) => o.company === co.name);
    const companyCustomers = customers.filter((c) =>
      c.companies.some((cl) => cl.companyId === co.id),
    );
    const companyOffers = offersInWindow.filter((s) => {
      // QpsScheme doesn't carry a companyId — resolve via the SKU's
      // brand → company mapping.
      const sku = skus.find((x) => x.sku === s.skuCode);
      return sku && companyIdForSku(sku, brandIndex) === co.id;
    });
    const categorySet = new Set(companySkus.map((s) => s.category));
    return {
      companyId: co.id,
      companyName: co.name,
      isActive: co.isActive !== false,
      brandCount: co.brands.length,
      skuCount: companySkus.length,
      activeSkuCount: companySkus.filter((s) => s.status === "Active").length,
      compliantSkuCount: companySkus.filter(
        (s) => s.ondcCompliance.isCompliant,
      ).length,
      customerCount: companyCustomers.length,
      offerCount: companyOffers.length,
      orderCount: companyOrders.length,
      orderValue: companyOrders.reduce((n, o) => n + o.orderValue, 0),
      categoryCount: categorySet.size,
    };
  });

  return {
    range,
    companies: companyKpis,
    brands: brandKpis,
    skus: skuKpis,
    customers: customerKpis,
    offers: offerKpis,
    orders: orderKpis,
    companyBreakdown,
  };
}

// ---------------------------------------------------------------------
// Time-series + categorical helpers (charts)
// ---------------------------------------------------------------------

/**
 * Walk every day in [range.from, range.to] inclusive and roll the
 * order count + value per day. Empty days surface as zeros so the
 * line chart renders a continuous x-axis. The label is the ISO date
 * — the page picks a short formatter based on the window length.
 */
export function getOrderTrend(range: DateRange): OrderTrendPoint[] {
  const orders = getOrders();
  const buckets = new Map<string, OrderTrendPoint>();

  // Pre-fill the date range so we always have a point per day.
  const start = new Date(range.from + "T00:00:00");
  const end = new Date(range.to + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = ISO(d);
    buckets.set(iso, {
      date: iso,
      total: 0,
      new: 0,
      confirmed: 0,
      delivered: 0,
      cancelled: 0,
      value: 0,
    });
  }

  orders.forEach((o) => {
    if (!buckets.has(o.orderDate)) return;
    const point = buckets.get(o.orderDate)!;
    point.total++;
    point.value += o.orderValue;
    if (o.status === "New") point.new++;
    else if (o.status === "Confirmed") point.confirmed++;
    else if (o.status === "Delivered") point.delivered++;
    else if (o.status === "Cancelled") point.cancelled++;
  });

  return Array.from(buckets.values());
}

/**
 * Roll the seller's catalog by category — used by the bar chart that
 * shows SKU distribution. Sorted by SKU count descending so the
 * biggest categories surface first.
 */
export function getCategoryDistribution(): CategorySliceRow[] {
  const counts = new Map<string, number>();
  sampleSKUs.forEach((s) => {
    counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([category, skuCount]) => ({ category, skuCount }))
    .sort((a, b) => b.skuCount - a.skuCount);
}

// ---------------------------------------------------------------------
// Per-company drill-down
// ---------------------------------------------------------------------

export function getCompanyDrilldown(
  companyId: string,
  range: DateRange,
): CompanyDrilldown | null {
  const company = getCompanies().find((c) => c.id === companyId);
  if (!company) return null;

  const companies = getCompanies();
  const brandIndex = buildBrandIndex(companies);

  const companySkus = sampleSKUs.filter(
    (s) => companyIdForSku(s, brandIndex) === companyId,
  );

  // Brands rollup — even brands with no SKUs are included so the admin
  // sees the full company catalog shape.
  const brands = company.brands.map((b) => {
    const brandSkus = companySkus.filter(
      (s) => s.brand.toLowerCase() === b.name.toLowerCase(),
    );
    return {
      brandId: b.id,
      brandName: b.name,
      skuCount: brandSkus.length,
      activeSkuCount: brandSkus.filter((s) => s.status === "Active").length,
      compliantSkuCount: brandSkus.filter(
        (s) => s.ondcCompliance.isCompliant,
      ).length,
    };
  });

  const skuKpis: SkuKpis = {
    total: companySkus.length,
    active: companySkus.filter((s) => s.status === "Active").length,
    inactive: companySkus.filter((s) => s.status !== "Active").length,
    compliant: companySkus.filter((s) => s.ondcCompliance.isCompliant).length,
    nonCompliant: companySkus.filter((s) => !s.ondcCompliance.isCompliant)
      .length,
  };

  // Category breakdown derived from the company's SKUs.
  const categoryCounts = new Map<string, number>();
  companySkus.forEach((s) => {
    categoryCounts.set(s.category, (categoryCounts.get(s.category) ?? 0) + 1);
  });
  const categories = Array.from(categoryCounts.entries())
    .map(([name, skuCount]) => ({ name, skuCount }))
    .sort((a, b) => b.skuCount - a.skuCount);

  // Customers + status split — restricted to those who buy from this
  // company.
  const customersOfCompany = getDemoCustomers().filter((c) =>
    c.companies.some((cl) => cl.companyId === companyId),
  );
  const customerKpis: CustomerKpis = {
    total: customersOfCompany.length,
    active: customersOfCompany.filter((c) =>
      c.companies.some(
        (cl) => cl.companyId === companyId && cl.status === "Active",
      ),
    ).length,
    blocked: customersOfCompany.filter((c) =>
      c.companies.some(
        (cl) => cl.companyId === companyId && cl.status === "Blocked",
      ),
    ).length,
  };

  // Offers — schemes whose SKU resolves to this company AND that overlap
  // the window.
  const allSchemes = getAllSchemes();
  const offersInWindow = allSchemes.filter(
    (s) =>
      schemeOverlapsRange(s, range) &&
      companySkus.some((sku) => sku.sku === s.skuCode),
  );
  const offerKpis: OfferKpis = {
    total: offersInWindow.length,
    active: offersInWindow.filter((s) => s.status === "Active").length,
    inactive: offersInWindow.filter((s) => s.status === "Inactive").length,
    scheduled: offersInWindow.filter((s) => s.status === "Scheduled").length,
    expired: offersInWindow.filter((s) => s.status === "Expired").length,
  };

  // Orders for this company within the window.
  const allOrders = getOrders();
  const companyOrders = allOrders.filter(
    (o) => o.company === company.name && orderInRange(o, range),
  );
  const orderKpis: OrderKpis = {
    total: companyOrders.length,
    new: companyOrders.filter((o) => o.status === "New").length,
    confirmed: companyOrders.filter((o) => o.status === "Confirmed").length,
    delivered: companyOrders.filter((o) => o.status === "Delivered").length,
    cancelled: companyOrders.filter((o) => o.status === "Cancelled").length,
    totalValue: companyOrders.reduce((n, o) => n + o.orderValue, 0),
  };

  // 5 most-recent orders + SKUs as a contextual ribbon for the
  // drill-down. Bigger lists are still reachable via the dedicated
  // pages.
  const recentOrders = [...companyOrders]
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
    .slice(0, 5);
  const recentSkus = [...companySkus]
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, 5);

  return {
    range,
    company,
    brands,
    skus: skuKpis,
    categories,
    customers: customerKpis,
    offers: offerKpis,
    orders: orderKpis,
    recentOrders,
    recentSkus,
  };
}
