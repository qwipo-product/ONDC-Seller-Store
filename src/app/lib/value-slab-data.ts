/**
 * Value Slab: order-value based discount tiers on one SKU (Offers & Schemes).
 *
 * Same idea as QPS, but the tiers are decided by how much money the
 * buyer spends on the SKU instead of how many units they buy:
 *   SKU value ₹2,000 – ₹9,999   → 2% off (max ₹150)
 *   SKU value ₹10,000 – ₹19,999 → 3% off (max ₹400)
 *   SKU value ₹20,000 and above → 5% off (max ₹1,000)
 *
 * ONDC mapping (RETeB2B "slab" offer, spec 0094): one offer per tier,
 * descriptor.code = "slab", item_ids = [the SKU], qualifier
 * item_value / item_value_upper, benefit value_type = percent +
 * value + value_cap, meta additive = no / auto = yes.
 *
 * Prototype storage: localStorage.
 */

export interface ValueSlabTier {
  /** SKU order value (₹) at which this tier starts. */
  minValue: number;
  /** SKU order value (₹) at which this tier ends; null means no upper limit. */
  maxValue: number | null;
  /** % off the SKU value. Protocol: benefit.value (sent as a negative). */
  discountPercent: number;
  /** Most rupees the discount can be. Protocol: benefit.value_cap. Optional. */
  maxDiscount?: number;
}

export interface ValueSlabScheme {
  id: string;
  name: string;
  skuCode: string;
  skuName: string;
  mrp: number;
  sellingPrice: number;
  tiers: ValueSlabTier[];
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive" | "Scheduled" | "Expired";
}

export interface ValueSlabError {
  field: string;
  message: string;
  /** Tier index the error belongs to, for row highlighting. */
  rowIndex?: number;
}

/** Rupees the customer saves when they buy `skuValue` worth of the SKU in this tier. */
export function tierSaving(tier: Partial<ValueSlabTier>, skuValue: number): number {
  if (typeof tier.discountPercent !== "number" || Number.isNaN(tier.discountPercent)) return 0;
  const raw = skuValue * (tier.discountPercent / 100);
  const capped =
    typeof tier.maxDiscount === "number" && tier.maxDiscount > 0
      ? Math.min(raw, tier.maxDiscount)
      : raw;
  return +capped.toFixed(2);
}

/** "3% off (max ₹400)" or "3% off". */
export function tierDiscountLabel(tier: ValueSlabTier): string {
  const base = `${tier.discountPercent}% off`;
  return typeof tier.maxDiscount === "number" && tier.maxDiscount > 0
    ? `${base} (max ₹${tier.maxDiscount.toLocaleString("en-IN")})`
    : base;
}

/** "₹2,000 – ₹9,999" or "₹20,000 and above". */
export function tierRangeLabel(tier: Pick<ValueSlabTier, "minValue" | "maxValue">): string {
  const min = `₹${tier.minValue.toLocaleString("en-IN")}`;
  return tier.maxValue === null
    ? `${min} and above`
    : `${min} – ₹${tier.maxValue.toLocaleString("en-IN")}`;
}

export function validateValueTiers(tiers: Partial<ValueSlabTier>[]): ValueSlabError[] {
  const errors: ValueSlabError[] = [];
  const push = (field: string, message: string, rowIndex?: number) =>
    errors.push({ field, message, rowIndex });

  if (tiers.length === 0) {
    push("tiers", "At least one tier is required.");
    return errors;
  }

  tiers.forEach((t, i) => {
    const n = i + 1;
    if (typeof t.minValue !== "number" || Number.isNaN(t.minValue) || t.minValue < 1) {
      push("minValue", `Tier ${n}: Min order value must be ₹1 or more.`, i);
    }
    if (t.maxValue !== null && t.maxValue !== undefined) {
      if (Number.isNaN(t.maxValue) || t.maxValue <= (t.minValue ?? 0)) {
        push("maxValue", `Tier ${n}: Max order value must be greater than Min order value.`, i);
      }
    }
    const p = t.discountPercent;
    if (typeof p !== "number" || Number.isNaN(p) || p <= 0 || p >= 100) {
      push("discountPercent", `Tier ${n}: Discount % must be above 0 and below 100.`, i);
    }
    if (t.maxDiscount !== undefined && t.maxDiscount !== null) {
      if (Number.isNaN(t.maxDiscount) || t.maxDiscount <= 0) {
        push("maxDiscount", `Tier ${n}: Max discount must be more than ₹0 (or leave it blank for no cap).`, i);
      }
    }
  });

  const sorted = tiers
    .map((t, idx) => ({ t, idx }))
    .filter((x) => typeof x.t.minValue === "number")
    .sort((a, b) => a.t.minValue! - b.t.minValue!);
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const nxt = sorted[i + 1];
    if (cur.t.maxValue === null || cur.t.maxValue === undefined) {
      push("tiers", `Tier ${cur.idx + 1} has no upper limit, so Tier ${nxt.idx + 1} can never apply.`, nxt.idx);
    } else if (nxt.t.minValue! <= cur.t.maxValue) {
      push("tiers", `Tiers ${cur.idx + 1} and ${nxt.idx + 1}: order value ranges overlap.`, nxt.idx);
    }
  }
  return errors;
}

// ---------- Storage (prototype) ----------

const STORAGE_KEY = "qwipo.valueSlabSchemes.v2";

export const seedValueSlabSchemes: ValueSlabScheme[] = [
  {
    id: "VS-180000076",
    name: "Value Slab – Sunflower Oil 1L x12",
    skuCode: "180000076",
    skuName: "FREEDOM REF.SUNFLOWER OIL 1 LTR X 12PET",
    mrp: 191,
    sellingPrice: 174,
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    status: "Active",
    tiers: [
      { minValue: 2000, maxValue: 9999, discountPercent: 2, maxDiscount: 150 },
      { minValue: 10000, maxValue: 19999, discountPercent: 3, maxDiscount: 400 },
      { minValue: 20000, maxValue: null, discountPercent: 5, maxDiscount: 1000 },
    ],
  },
];

export function getAllValueSlabs(): ValueSlabScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...seedValueSlabSchemes];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ValueSlabScheme[];
  } catch {
    /* fall through to the seed */
  }
  return [...seedValueSlabSchemes];
}

export function setAllValueSlabs(schemes: ValueSlabScheme[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
  } catch {
    /* storage unavailable: the change lasts for this session only */
  }
}
