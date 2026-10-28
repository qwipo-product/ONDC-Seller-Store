/**
 * Combo / Bundle Discount: a percent-off discount for buying several SKUs
 * together (Offers & Schemes).
 *
 * The only scheme so far that spans multiple SKUs instead of one SKU with
 * tiers: a Bundle (the items the discount actually applies to) plus,
 * optionally, Companion items that must also be in the cart for the combo
 * to trigger at all.
 *
 *   Bundle: Sunflower Oil 1L, Sunflower Oil 5L
 *   Companions: Mustard Oil 1L, Groundnut Oil 1L  (must ALSO be in the cart)
 *   Benefit: 50% off the bundle items, capped at ₹200
 *
 * ONDC mapping: one "combo" offer (spec 0094 per the API Contract Detail
 * sheet; the Annexure feature list separately numbers it 0095 — the two
 * source sections disagree and this hasn't been reconciled). item_ids =
 * the bundle; qualifier.item_id = comma-separated companion item ids.
 * benefit.value_type = "percent", value + value_cap. meta.additive = no,
 * auto = yes.
 *
 * Two assumptions the draft protocol leaves unstated, made explicit here
 * rather than left silent:
 *   1. The companion list is AND logic — every companion item must be in
 *      the cart, not just one of them.
 *   2. The percent discount is computed against the bundle items' combined
 *      selling price (at qty 1 each), not the companions or the whole cart.
 *
 * Prototype storage: localStorage.
 */

export interface ComboScheme {
  id: string;
  name: string;
  /** The items the discount applies to. */
  bundleSkuCodes: string[];
  bundleSkuNames: string[];
  /** Items that must also be in the cart (AND) for the combo to trigger.
   *  Can be empty — a combo doesn't have to require anything beyond the
   *  bundle itself. */
  companionSkuCodes: string[];
  companionSkuNames: string[];
  discountPercent: number;
  maxDiscount?: number;
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive" | "Scheduled" | "Expired";
}

export interface ComboError {
  field: string;
  message: string;
}

/** Rupees off a cart containing one of each bundle item, given their combined selling price. */
export function comboSaving(bundleValue: number, discountPercent: number, maxDiscount?: number): number {
  if (typeof discountPercent !== "number" || Number.isNaN(discountPercent)) return 0;
  const raw = bundleValue * (discountPercent / 100);
  const capped = typeof maxDiscount === "number" && maxDiscount > 0 ? Math.min(raw, maxDiscount) : raw;
  return +capped.toFixed(2);
}

/** "50% off the bundle (max ₹200)" or "50% off the bundle". */
export function comboDiscountLabel(discountPercent: number, maxDiscount?: number): string {
  const base = `${discountPercent}% off the bundle`;
  return typeof maxDiscount === "number" && maxDiscount > 0
    ? `${base} (max ₹${maxDiscount.toLocaleString("en-IN")})`
    : base;
}

export function validateCombo(
  bundleSkuCodes: string[],
  companionSkuCodes: string[],
  discountPercent: number | undefined,
  maxDiscount: number | undefined,
): ComboError[] {
  const errors: ComboError[] = [];
  const push = (field: string, message: string) => errors.push({ field, message });

  if (bundleSkuCodes.length < 2) {
    push("bundle", "A combo needs at least 2 bundle items.");
  }
  const overlap = bundleSkuCodes.filter((c) => companionSkuCodes.includes(c));
  if (overlap.length > 0) {
    push("overlap", `${overlap.join(", ")} ${overlap.length === 1 ? "is" : "are"} in both the bundle and companion lists — a SKU can't be both.`);
  }
  if (
    typeof discountPercent !== "number" ||
    Number.isNaN(discountPercent) ||
    discountPercent <= 0 ||
    discountPercent >= 100
  ) {
    push("discountPercent", "Discount % must be above 0 and below 100.");
  }
  if (maxDiscount !== undefined && (Number.isNaN(maxDiscount) || maxDiscount <= 0)) {
    push("maxDiscount", "Max discount must be more than ₹0 (or leave it blank for no cap).");
  }
  return errors;
}

// ---------- Storage (prototype) ----------

const STORAGE_KEY = "qwipo.comboSchemes";

export const seedComboSchemes: ComboScheme[] = [
  {
    id: "COMBO-000001",
    name: "Sunflower Oil Combo",
    bundleSkuCodes: ["180000008", "180000076"],
    bundleSkuNames: ["FREEDOM REF. SUNFLOWER OIL 1 LTR.X16NOS.", "FREEDOM REF.SUNFLOWER OIL 1 LTR X 12PET"],
    companionSkuCodes: ["180000260"],
    companionSkuNames: ["FREEDOM K.GHANI MUSTARD OIL 1LTRX12 PET"],
    discountPercent: 10,
    maxDiscount: 200,
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    status: "Active",
  },
];

export function getAllCombos(): ComboScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...seedComboSchemes];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ComboScheme[];
  } catch {
    /* fall through to the seed */
  }
  return [...seedComboSchemes];
}

export function setAllCombos(schemes: ComboScheme[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
  } catch {
    /* storage unavailable: the change lasts for this session only */
  }
}
