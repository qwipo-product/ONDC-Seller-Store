// Per-SELLER LOGISTICS fee configuration for the "Charges & Fees" tab on the
// Manage Seller screen.
//
// Logistics fee is a SELLER-LEVEL setting (one config per seller — NOT per
// company). It is enabled/disabled and edited from a single tile on the tab.
// The commercial fee lives at the COMPANY level (admin-catalog Company
// .commercialFee); the old "Beat Small Order" step has been removed.
//
// In-memory demo store with a subscribe hook, mirroring admin-catalog.
// Seller ids reference src/app/lib/mock-store.ts.

import { makeId } from "./admin-catalog";
import {
  DEMO_DISTRIBUTOR_ID,
  DEMO_WHOLESALER_ID,
  DEMO_HYBRID_ID,
} from "./mock-store";

export type LogisticsMethod = "gmv_percent" | "per_kg" | "by_category";

/** One per-category logistics fee row for the "By Category" method. Each ONDC
 *  category is added individually with its own Qwipo target and seller
 *  contribution; retailer = target − seller. */
export interface CategoryLogisticsFee {
  id: string;
  category: string; // ONDC category name (from ONDC_CATEGORY_NAMES)
  qwipoTarget: number; // ₹
  sellerContribution: number; // ₹
}

export interface LogisticsFeeConfig {
  enabled: boolean;
  method: LogisticsMethod;
  /** ₹/kg method. Retailer = target − seller. */
  qwipoTargetPerKg: number;
  sellerContributionPerKg: number;
  /** GMV % method. */
  qwipoTargetPct: number;
  sellerContributionPct: number;
  /** By-category method — one fee row per ONDC category, added individually. */
  categories: CategoryLogisticsFee[];
  /** Logistics fee waiver. When enabled, the logistics fee is waived for an
   *  order once the retailer's total order value across ALL of this seller's
   *  companies crosses `waiverThreshold` (₹). Managed at the seller level. */
  waiverEnabled: boolean;
  waiverThreshold: number; // ₹
}

/** One seller's logistics fee configuration. */
export interface SellerLogisticsConfig {
  sellerId: string;
  logistics: LogisticsFeeConfig;
  updatedAt?: string; // ISO datetime
  updatedBy?: string;
}

// ---- Derived helpers ----

export function logisticsRetailerPerKg(l: LogisticsFeeConfig): number {
  return Math.max(0, +(l.qwipoTargetPerKg - l.sellerContributionPerKg).toFixed(4));
}
export function logisticsRetailerPct(l: LogisticsFeeConfig): number {
  return Math.max(0, +(l.qwipoTargetPct - l.sellerContributionPct).toFixed(4));
}
/** Retailer contribution for one category fee row. */
export function categoryLogisticsRetailer(f: CategoryLogisticsFee): number {
  return Math.max(0, +(f.qwipoTarget - f.sellerContribution).toFixed(2));
}

/** A blank, disabled logistics config for a seller that hasn't set one up. */
export function emptyLogistics(): LogisticsFeeConfig {
  return {
    enabled: false,
    method: "per_kg",
    qwipoTargetPerKg: 3,
    sellerContributionPerKg: 2,
    qwipoTargetPct: 0.5,
    sellerContributionPct: 0.3,
    categories: [],
    waiverEnabled: false,
    waiverThreshold: 30000,
  };
}

// ---- Store (in-memory, one config per seller) ----
// Pre-seed the three demo sellers (see mock-store) with an enabled logistics
// config each, varying the method so every variant is explorable.
function buildSeed(): SellerLogisticsConfig[] {
  return [
    {
      sellerId: DEMO_DISTRIBUTOR_ID,
      logistics: {
        ...emptyLogistics(),
        enabled: true,
        method: "per_kg",
        waiverEnabled: true,
        waiverThreshold: 30000,
      },
      updatedAt: "2026-09-12T00:00:00Z",
      updatedBy: "Admin",
    },
    {
      sellerId: DEMO_WHOLESALER_ID,
      logistics: {
        ...emptyLogistics(),
        enabled: true,
        method: "gmv_percent",
      },
      updatedAt: "2026-09-13T00:00:00Z",
      updatedBy: "Admin",
    },
    {
      sellerId: DEMO_HYBRID_ID,
      logistics: {
        ...emptyLogistics(),
        enabled: true,
        method: "by_category",
        categories: [
          {
            id: makeId("catfee"),
            category: "Oil & Ghee",
            qwipoTarget: 4,
            sellerContribution: 2.5,
          },
          {
            id: makeId("catfee"),
            category: "Foodgrains",
            qwipoTarget: 3,
            sellerContribution: 2,
          },
        ],
      },
      updatedAt: "2026-09-14T00:00:00Z",
      updatedBy: "Admin",
    },
  ];
}

let configs: SellerLogisticsConfig[] = buildSeed();

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

/** The logistics config for a seller, or undefined if never configured. */
export function getSellerLogistics(
  sellerId: string,
): SellerLogisticsConfig | undefined {
  return configs.find((c) => c.sellerId === sellerId);
}

/** Upsert a seller's logistics config (stamps updatedAt/updatedBy). */
export function setSellerLogistics(
  sellerId: string,
  logistics: LogisticsFeeConfig,
): void {
  const stamped: SellerLogisticsConfig = {
    sellerId,
    logistics,
    updatedAt: new Date().toISOString(),
    updatedBy: "Admin",
  };
  const idx = configs.findIndex((c) => c.sellerId === sellerId);
  configs =
    idx >= 0
      ? configs.map((c, i) => (i === idx ? stamped : c))
      : [stamped, ...configs];
  notify();
}

export function subscribeToChargeConfigs(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
