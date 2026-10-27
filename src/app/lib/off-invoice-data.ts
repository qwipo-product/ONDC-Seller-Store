/**
 * Off-Invoice: one discount rule on the whole cart / invoice (Offers & Schemes).
 *
 * Applies to the seller's whole catalog, not to one SKU or category.
 * One rule per scheme:
 *   "Orders of ₹10,000 and above get 5% off (max ₹1,000)"
 *   "Orders of ₹50,000 and above get ₹2,500 off"
 *
 * ONDC mapping (RETeB2B "discount" offer, spec 0091), one offer:
 *   descriptor.code = "discount"
 *   qualifier min_value        = minValue
 *   benefit value_type         = "percent" | "amount"
 *   benefit value              = the % or the flat ₹ (sent as a negative)
 *   benefit value_cap          = maxDiscount (percent only)
 *   meta additive / auto       = yes / yes (open question with ONDC)
 *   item_ids / category_ids    = not used: the offer covers the whole catalog
 * The offer shows as a negative "offer" line in the order quote.
 *
 * Prototype storage: localStorage.
 */

export type OffInvoiceDiscountType = "percent" | "amount";

export interface OffInvoiceScheme {
  id: string;
  name: string;
  /** Cart value (₹) from which the discount applies. Protocol: qualifier.min_value. */
  minValue: number;
  discountType: OffInvoiceDiscountType;
  /** discountType = "percent": % off the cart value. */
  discountPercent?: number;
  /** discountType = "percent": most rupees the discount can be. Protocol: value_cap. */
  maxDiscount?: number;
  /** discountType = "amount": flat rupees off the cart (once per order). */
  discountAmount?: number;
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive" | "Scheduled" | "Expired";
}

export interface OffInvoiceError {
  field: string;
  message: string;
}

type RuleFields = Partial<
  Pick<
    OffInvoiceScheme,
    "minValue" | "discountType" | "discountPercent" | "maxDiscount" | "discountAmount"
  >
>;

/** Rupees the buyer saves on a cart worth `cartValue` (0 if the cart is below the minimum). */
export function ruleSaving(rule: RuleFields, cartValue: number): number {
  if (typeof rule.minValue !== "number" || cartValue < rule.minValue) return 0;
  if (rule.discountType === "amount") {
    const a = rule.discountAmount;
    return typeof a === "number" && !Number.isNaN(a) ? +Math.min(a, cartValue).toFixed(2) : 0;
  }
  const p = rule.discountPercent;
  if (typeof p !== "number" || Number.isNaN(p)) return 0;
  const raw = cartValue * (p / 100);
  const capped =
    typeof rule.maxDiscount === "number" && rule.maxDiscount > 0
      ? Math.min(raw, rule.maxDiscount)
      : raw;
  return +capped.toFixed(2);
}

/** "5% off (max ₹1,000)", "5% off" or "₹2,500 off". */
export function ruleDiscountLabel(rule: RuleFields): string {
  if (rule.discountType === "amount") {
    return `₹${(rule.discountAmount ?? 0).toLocaleString("en-IN")} off`;
  }
  const base = `${rule.discountPercent ?? 0}% off`;
  return typeof rule.maxDiscount === "number" && rule.maxDiscount > 0
    ? `${base} (max ₹${rule.maxDiscount.toLocaleString("en-IN")})`
    : base;
}

/** "Orders of ₹10,000 and above get 5% off (max ₹1,000)". */
export function ruleSentence(rule: RuleFields): string {
  return `Orders of ₹${(rule.minValue ?? 0).toLocaleString("en-IN")} and above get ${ruleDiscountLabel(rule)}`;
}

export function validateOffInvoiceRule(rule: RuleFields): OffInvoiceError[] {
  const errors: OffInvoiceError[] = [];
  const push = (field: string, message: string) => errors.push({ field, message });

  if (typeof rule.minValue !== "number" || Number.isNaN(rule.minValue) || rule.minValue < 1) {
    push("minValue", "Minimum cart value must be ₹1 or more.");
  }
  if (rule.discountType === "amount") {
    const a = rule.discountAmount;
    if (typeof a !== "number" || Number.isNaN(a) || a <= 0) {
      push("discountAmount", "Discount amount must be more than ₹0.");
    } else if (typeof rule.minValue === "number" && a >= rule.minValue) {
      push("discountAmount", `Discount amount (₹${a}) must be less than the minimum cart value (₹${rule.minValue}).`);
    }
  } else {
    const p = rule.discountPercent;
    if (typeof p !== "number" || Number.isNaN(p) || p <= 0 || p >= 100) {
      push("discountPercent", "Discount % must be above 0 and below 100.");
    }
    if (rule.maxDiscount !== undefined && rule.maxDiscount !== null) {
      if (Number.isNaN(rule.maxDiscount) || rule.maxDiscount <= 0) {
        push("maxDiscount", "Max discount must be more than ₹0 (or leave it blank for no cap).");
      }
    }
  }
  return errors;
}

// ---------- Storage (prototype) ----------

const STORAGE_KEY = "qwipo.offInvoiceSchemes.v2";

export const seedOffInvoiceSchemes: OffInvoiceScheme[] = [
  {
    id: "OFI-000001",
    name: "Cart Value Discount",
    minValue: 10000,
    discountType: "percent",
    discountPercent: 5,
    maxDiscount: 1000,
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    status: "Active",
  },
];

export function getAllOffInvoices(): OffInvoiceScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...seedOffInvoiceSchemes];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as OffInvoiceScheme[];
  } catch {
    /* fall through to the seed */
  }
  return [...seedOffInvoiceSchemes];
}

export function setAllOffInvoices(schemes: OffInvoiceScheme[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
  } catch {
    /* storage unavailable: the change lasts for this session only */
  }
}
