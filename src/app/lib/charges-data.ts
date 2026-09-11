// Per-SELLER charge configuration for the "Charges & Fees" tab on the
// Manage Seller screen. Charges are scoped to a seller and to the seller's
// linked companies:
//
//   • Distributor companies  → each configured INDIVIDUALLY (one config per
//                              (seller, company) pair).
//   • Wholesaler companies   → all wholesaler companies linked to the seller
//                              share ONE common structure (a single config
//                              per seller, keyed by WHOLESALE_TARGET).
//
// In-memory demo store with a subscribe hook, mirroring admin-catalog.
// Company ids reference src/app/lib/admin-catalog.ts; seller ids reference
// src/app/lib/mock-store.ts.

import { makeId, getCompanies } from "./admin-catalog";
import { getOrderValueMin, getOrderValueNonBeat } from "./order-settings-data";
import {
  DEMO_DISTRIBUTOR_ID,
  DEMO_WHOLESALER_ID,
  DEMO_HYBRID_ID,
} from "./mock-store";

export type CommerceMethod = "gmv_percent" | "order_slab";
export type LogisticsMethod = "gmv_percent" | "per_kg";
export type ChargeStatus = "active" | "inactive";

/** A charge config is either an individual distributor company config or the
 *  single shared wholesale config for the seller. */
export type ChargeScope = "distributor" | "wholesaler";

/** Sentinel companyId for the single, seller-wide wholesale config that
 *  covers every wholesaler-mode company linked to the seller. */
export const WHOLESALE_TARGET = "__wholesale__";

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

// The two order-value thresholds (beat MOV and non-beat MOV) are NOT stored
// on the charge config — they are read-only, sourced from the seller's Order
// Settings (see getBeatThresholds). Only the two flat fees below each
// threshold are editable here.
export interface BeatSmallOrderConfig {
  enabled: boolean;
  /** Flat fee charged when a BEAT order's value is below the seller's beat
   *  MOV threshold. Editable. */
  flatFeeBelowBeatThreshold: number; // ₹
  /** Flat fee charged when a NON-BEAT order's value is below the seller's
   *  non-beat MOV threshold. Editable. */
  flatFeeBelowNonBeatThreshold: number; // ₹
}

export interface ChargeConfig {
  sellerId: string;
  scope: ChargeScope;
  /** Distributor: the linked company's id. Wholesaler: WHOLESALE_TARGET. */
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

/** The read-only beat / non-beat order-value thresholds surfaced in the Beat
 *  Small Order step. Sourced from the seller's Order Settings, never edited
 *  from the charges wizard. */
export function getBeatThresholds(): { beat: number; nonBeat: number } {
  return { beat: getOrderValueMin(), nonBeat: getOrderValueNonBeat() };
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
      flatFeeBelowBeatThreshold: 15,
      flatFeeBelowNonBeatThreshold: 20,
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
  // alternating commerce method so both variants show in the table.
  companies.slice(0, 4).forEach((c, i) => {
    const cfg = emptyChargeConfig(DEMO_DISTRIBUTOR_ID, "distributor", c.id);
    out.push(
      active(
        {
          ...cfg,
          commerce: {
            ...cfg.commerce,
            method: i % 2 === 0 ? "gmv_percent" : "order_slab",
          },
        },
        "2026-09-05T00:00:00Z",
      ),
    );
  });

  // Wholesaler demo — one shared config across all wholesaler companies.
  out.push(
    active(
      emptyChargeConfig(DEMO_WHOLESALER_ID, "wholesaler", "_all"),
      "2026-09-07T00:00:00Z",
    ),
  );

  // Hybrid demo — a couple of distributor companies (indices 0-1 fall in the
  // seller's distributor half) plus the shared wholesale config.
  companies.slice(0, 2).forEach((c) => {
    out.push(
      active(
        emptyChargeConfig(DEMO_HYBRID_ID, "distributor", c.id),
        "2026-09-08T00:00:00Z",
      ),
    );
  });
  out.push(
    active(
      emptyChargeConfig(DEMO_HYBRID_ID, "wholesaler", "_all"),
      "2026-09-08T00:00:00Z",
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
