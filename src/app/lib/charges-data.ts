// Per-company charge configuration for the admin "Charges & Fees" area.
// Each company can have a commerce fee, a logistics fee and a beat small-order
// charge, plus a validity window. In-memory demo store with a subscribe hook,
// mirroring admin-catalog. Company ids reference src/app/lib/admin-catalog.ts.

import { makeId } from "./admin-catalog";

export type CommerceMethod = "gmv_percent" | "order_slab";
export type LogisticsMethod = "gmv_percent" | "per_kg";
export type ChargeStatus = "active" | "inactive";

/** One order-value band for the "Order Value Slab" commerce method. */
export interface OrderSlab {
  id: string;
  minValue: number; // ₹ — order value lower bound
  maxValue: number; // ₹ — order value upper bound
  fee: number; // ₹ — flat fee charged for orders in this band
}

export interface CommerceFeeConfig {
  enabled: boolean;
  method: CommerceMethod;
  /** GMV %: Qwipo target fee (capped at 0.5%). Retailer = target − seller. */
  qwipoTargetPct: number;
  sellerContributionPct: number;
  /** Order Value Slab method. */
  slabs: OrderSlab[];
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
}

export interface BeatSmallOrderConfig {
  enabled: boolean;
  freeDeliveryThreshold: number; // ₹
  flatFeeBelowThreshold: number; // ₹
}

export interface ChargeConfig {
  companyId: string;
  status: ChargeStatus;
  commerce: CommerceFeeConfig;
  logistics: LogisticsFeeConfig;
  beat: BeatSmallOrderConfig;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveUntil: string; // YYYY-MM-DD
  updatedAt?: string; // ISO datetime
  updatedBy?: string;
}

/** Hard cap on the Qwipo commerce target fee. */
export const MAX_COMMERCE_TARGET_PCT = 0.5;

// ---- Derived helpers ----

export function commerceRetailerPct(c: CommerceFeeConfig): number {
  return Math.max(0, +(c.qwipoTargetPct - c.sellerContributionPct).toFixed(4));
}
export function logisticsRetailerPerKg(l: LogisticsFeeConfig): number {
  return Math.max(0, +(l.qwipoTargetPerKg - l.sellerContributionPerKg).toFixed(4));
}
export function logisticsRetailerPct(l: LogisticsFeeConfig): number {
  return Math.max(0, +(l.qwipoTargetPct - l.sellerContributionPct).toFixed(4));
}

/** A blank config for a company that hasn't been configured yet. */
export function emptyChargeConfig(companyId: string): ChargeConfig {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  return {
    companyId,
    status: "inactive",
    commerce: {
      enabled: true,
      method: "gmv_percent",
      qwipoTargetPct: 0.5,
      sellerContributionPct: 0.3,
      slabs: [{ id: makeId("slab"), minValue: 0, maxValue: 500, fee: 5 }],
    },
    logistics: {
      enabled: true,
      method: "per_kg",
      qwipoTargetPerKg: 3,
      sellerContributionPerKg: 2,
      qwipoTargetPct: 0.5,
      sellerContributionPct: 0.3,
    },
    beat: {
      enabled: true,
      freeDeliveryThreshold: 500,
      flatFeeBelowThreshold: 15,
    },
    effectiveFrom: iso(now),
    effectiveUntil: iso(yearEnd),
  };
}

// ---- Seed (demo) ----
// A handful of catalog companies pre-configured so the table looks populated.
const SEED_CONFIGS: ChargeConfig[] = [
  {
    companyId: "co-itc",
    status: "active",
    commerce: {
      enabled: true,
      method: "gmv_percent",
      qwipoTargetPct: 0.5,
      sellerContributionPct: 0.3,
      slabs: [],
    },
    logistics: {
      enabled: true,
      method: "per_kg",
      qwipoTargetPerKg: 3,
      sellerContributionPerKg: 2,
      qwipoTargetPct: 0.5,
      sellerContributionPct: 0.3,
    },
    beat: { enabled: true, freeDeliveryThreshold: 500, flatFeeBelowThreshold: 15 },
    effectiveFrom: "2026-01-01",
    effectiveUntil: "2026-12-31",
    updatedAt: "2026-08-12T00:00:00Z",
    updatedBy: "Rakesh Singh",
  },
  {
    companyId: "co-adani",
    status: "active",
    commerce: {
      enabled: true,
      method: "order_slab",
      qwipoTargetPct: 0.5,
      sellerContributionPct: 0.3,
      slabs: [
        { id: "slab-a1", minValue: 0, maxValue: 500, fee: 5 },
        { id: "slab-a2", minValue: 500, maxValue: 2000, fee: 12 },
        { id: "slab-a3", minValue: 2000, maxValue: 100000, fee: 20 },
      ],
    },
    logistics: {
      enabled: true,
      method: "gmv_percent",
      qwipoTargetPerKg: 3,
      sellerContributionPerKg: 2,
      qwipoTargetPct: 2.5,
      sellerContributionPct: 2,
    },
    beat: { enabled: false, freeDeliveryThreshold: 500, flatFeeBelowThreshold: 15 },
    effectiveFrom: "2026-01-01",
    effectiveUntil: "2026-12-31",
    updatedAt: "2026-08-10T00:00:00Z",
    updatedBy: "Admin",
  },
  {
    companyId: "co-freedom",
    status: "active",
    commerce: {
      enabled: true,
      method: "gmv_percent",
      qwipoTargetPct: 0.4,
      sellerContributionPct: 0.3,
      slabs: [],
    },
    logistics: {
      enabled: true,
      method: "per_kg",
      qwipoTargetPerKg: 2,
      sellerContributionPerKg: 1.5,
      qwipoTargetPct: 0.4,
      sellerContributionPct: 0.3,
    },
    beat: { enabled: true, freeDeliveryThreshold: 1000, flatFeeBelowThreshold: 20 },
    effectiveFrom: "2026-01-01",
    effectiveUntil: "2026-12-31",
    updatedAt: "2026-08-08T00:00:00Z",
    updatedBy: "Omkar",
  },
  {
    companyId: "co-mahadev-allbrands",
    status: "active",
    commerce: {
      enabled: true,
      method: "gmv_percent",
      qwipoTargetPct: 0.3,
      sellerContributionPct: 0.2,
      slabs: [],
    },
    logistics: {
      enabled: true,
      method: "per_kg",
      qwipoTargetPerKg: 2.5,
      sellerContributionPerKg: 1.5,
      qwipoTargetPct: 0.3,
      sellerContributionPct: 0.2,
    },
    beat: { enabled: true, freeDeliveryThreshold: 750, flatFeeBelowThreshold: 10 },
    effectiveFrom: "2026-01-01",
    effectiveUntil: "2026-12-31",
    updatedAt: "2026-08-05T00:00:00Z",
    updatedBy: "Admin",
  },
  {
    // A started-but-not-configured company (mirrors the reference's inactive row).
    companyId: "co-srikrupa",
    status: "inactive",
    commerce: {
      enabled: false,
      method: "gmv_percent",
      qwipoTargetPct: 0.5,
      sellerContributionPct: 0.3,
      slabs: [],
    },
    logistics: {
      enabled: false,
      method: "per_kg",
      qwipoTargetPerKg: 3,
      sellerContributionPerKg: 2,
      qwipoTargetPct: 0.5,
      sellerContributionPct: 0.3,
    },
    beat: { enabled: false, freeDeliveryThreshold: 500, flatFeeBelowThreshold: 15 },
    effectiveFrom: "2026-01-01",
    effectiveUntil: "2026-12-31",
  },
];

let configs: ChargeConfig[] = SEED_CONFIGS.map((c) => ({ ...c }));

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

export function getChargeConfigs(): ChargeConfig[] {
  return configs;
}
export function getChargeConfig(companyId: string): ChargeConfig | undefined {
  return configs.find((c) => c.companyId === companyId);
}
export function upsertChargeConfig(next: ChargeConfig): void {
  const stamped: ChargeConfig = {
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy: next.updatedBy ?? "Admin",
  };
  const idx = configs.findIndex((c) => c.companyId === next.companyId);
  configs =
    idx >= 0
      ? configs.map((c) => (c.companyId === next.companyId ? stamped : c))
      : [stamped, ...configs];
  notify();
}
export function subscribeToChargeConfigs(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
