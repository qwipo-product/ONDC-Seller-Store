// Per-SELLER LOGISTICS charge configuration for the "Charges & Fees" tab on
// the Manage Seller screen. Charges are scoped to a seller and to the seller's
// linked companies:
//
//   • Distributor companies  → each configured INDIVIDUALLY (one config per
//                              (seller, company) pair).
//   • Wholesaler companies   → all wholesaler companies linked to the seller
//                              share ONE common structure (a single config
//                              per seller, keyed by WHOLESALE_TARGET).
//
// NOTE: the commercial (commerce) fee now lives at the COMPANY level
// (admin-catalog Company.commercialFee) and is managed from the Companies &
// Brands dialog. The old "Beat Small Order" step has been removed. This module
// only owns the per-seller LOGISTICS fee.
//
// In-memory demo store with a subscribe hook, mirroring admin-catalog.
// Company ids reference src/app/lib/admin-catalog.ts; seller ids reference
// src/app/lib/mock-store.ts.

import { makeId, getCompanies } from "./admin-catalog";
import {
  DEMO_DISTRIBUTOR_ID,
  DEMO_WHOLESALER_ID,
  DEMO_HYBRID_ID,
} from "./mock-store";

export type LogisticsMethod = "gmv_percent" | "per_kg" | "by_category";
export type ChargeStatus = "active" | "inactive";

/** A charge config is either an individual distributor company config or the
 *  single shared wholesale config for the seller. */
export type ChargeScope = "distributor" | "wholesaler";

/** Sentinel companyId for the single, seller-wide wholesale config that
 *  covers every wholesaler-mode company linked to the seller. */
export const WHOLESALE_TARGET = "__wholesale__";

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
}

export interface ChargeConfig {
  sellerId: string;
  scope: ChargeScope;
  /** Distributor: the linked company's id. Wholesaler: WHOLESALE_TARGET. */
  companyId: string;
  status: ChargeStatus;
  logistics: LogisticsFeeConfig;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveUntil: string; // YYYY-MM-DD
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

/** Stable storage key for a config. Wholesale configs collapse to a single
 *  per-seller key regardless of which companies are mapped as wholesaler. */
export function chargeKey(
  sellerId: string,
  scope: ChargeScope,
  companyId: string,
): string {
  return scope === "wholesaler"
    ? `${sellerId}::wholesaler::${WHOLESALE_TARGET}`
    : `${sellerId}::distributor::${companyId}`;
}

/** A blank config for a (seller, scope, company) that hasn't been configured. */
export function emptyChargeConfig(
  sellerId: string,
  scope: ChargeScope,
  companyId: string,
): ChargeConfig {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  return {
    sellerId,
    scope,
    companyId: scope === "wholesaler" ? WHOLESALE_TARGET : companyId,
    status: "inactive",
    logistics: {
      enabled: true,
      method: "per_kg",
      qwipoTargetPerKg: 3,
      sellerContributionPerKg: 2,
      qwipoTargetPct: 0.5,
      sellerContributionPct: 0.3,
      categories: [],
    },
    effectiveFrom: iso(now),
    effectiveUntil: iso(yearEnd),
  };
}

// ---- Store (in-memory, per-seller) ----
// The Charges tab derives its rows from the seller's linked companies, so an
// unconfigured company renders as "Not Configured" until set up here. We
// pre-seed a handful of configs for the three demo sellers (see mock-store)
// so their tabs land populated and every case is explorable out of the box.
function buildSeed(): ChargeConfig[] {
  const companies = getCompanies();
  if (companies.length === 0) return [];
  const out: ChargeConfig[] = [];
  const active = (cfg: ChargeConfig, updatedAt: string): ChargeConfig => ({
    ...cfg,
    status: "active",
    updatedAt,
    updatedBy: "Admin",
  });

  // Distributor demo — configure the first four companies individually,
  // varying the logistics method so all variants show in the table.
  companies.slice(0, 4).forEach((c, i) => {
    const cfg = emptyChargeConfig(DEMO_DISTRIBUTOR_ID, "distributor", c.id);
    const method: LogisticsMethod =
      i === 1 ? "gmv_percent" : i === 2 ? "by_category" : "per_kg";
    out.push(
      active(
        {
          ...cfg,
          logistics: {
            ...cfg.logistics,
            method,
            categories:
              method === "by_category"
                ? [
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
                  ]
                : [],
          },
        },
        "2026-09-12T00:00:00Z",
      ),
    );
  });

  // Wholesaler demo — one shared config across all wholesaler companies.
  out.push(
    active(
      emptyChargeConfig(DEMO_WHOLESALER_ID, "wholesaler", "_all"),
      "2026-09-13T00:00:00Z",
    ),
  );

  // Hybrid demo — a couple of distributor companies (indices 0-1 fall in the
  // seller's distributor half) plus the shared wholesale config.
  companies.slice(0, 2).forEach((c) => {
    out.push(
      active(
        emptyChargeConfig(DEMO_HYBRID_ID, "distributor", c.id),
        "2026-09-14T00:00:00Z",
      ),
    );
  });
  out.push(
    active(
      emptyChargeConfig(DEMO_HYBRID_ID, "wholesaler", "_all"),
      "2026-09-14T00:00:00Z",
    ),
  );

  return out;
}

let configs: ChargeConfig[] = buildSeed();

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

/** All configs belonging to a seller (distributor rows + the wholesale row). */
export function getChargeConfigsForSeller(sellerId: string): ChargeConfig[] {
  return configs.filter((c) => c.sellerId === sellerId);
}

/** The individual config for one distributor company under a seller. */
export function getSellerDistributorConfig(
  sellerId: string,
  companyId: string,
): ChargeConfig | undefined {
  return configs.find(
    (c) =>
      c.sellerId === sellerId &&
      c.scope === "distributor" &&
      c.companyId === companyId,
  );
}

/** The single shared wholesale config for a seller (covers all wholesaler
 *  companies linked to them). */
export function getSellerWholesaleConfig(
  sellerId: string,
): ChargeConfig | undefined {
  return configs.find(
    (c) => c.sellerId === sellerId && c.scope === "wholesaler",
  );
}

export function upsertChargeConfig(next: ChargeConfig): void {
  const stamped: ChargeConfig = {
    ...next,
    companyId:
      next.scope === "wholesaler" ? WHOLESALE_TARGET : next.companyId,
    updatedAt: new Date().toISOString(),
    updatedBy: next.updatedBy ?? "Admin",
  };
  const key = chargeKey(stamped.sellerId, stamped.scope, stamped.companyId);
  const idx = configs.findIndex(
    (c) => chargeKey(c.sellerId, c.scope, c.companyId) === key,
  );
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
