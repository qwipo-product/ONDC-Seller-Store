/**
 * BOGO (Buy X, Get Y free): quantity-triggered free units on one SKU (Offers & Schemes).
 *
 * One or more tiers on a single SKU, each a buy-quantity trigger:
 *   Buy 10 units → get 1 free
 *   Buy 24 units → get 3 free
 *
 * Unlike QPS/Value Slab (which discount the price), a BOGO tier gives extra
 * free units of the same SKU — the price per unit doesn't change.
 *
 * ONDC mapping: a "buyXgetY" style catalog offer per tier, item_ids = [the
 * SKU], qualifier min_qty = buyQty, benefit = freeQty free units of the
 * same item, meta additive = yes (it stacks with slab/value discounts).
 *
 * Prototype storage: localStorage.
 */

export interface BogoTier {
  /** Units the buyer must order to unlock this tier. */
  buyQty: number;
  /** Free units granted once `buyQty` is reached. */
  freeQty: number;
}

export interface BogoScheme {
  id: string;
  name: string;
  skuCode: string;
  skuName: string;
  mrp: number;
  sellingPrice: number;
  tiers: BogoTier[];
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive" | "Scheduled" | "Expired";
  /** The SKU given away free. Protocol-legal to differ from `skuCode` — the
   *  free item doesn't have to be the purchased item. Absent/equal to
   *  `skuCode` means same-SKU BOGO (the common case, and the only shape
   *  this scheme supported before cross-SKU was added). */
  freeSkuCode?: string;
  freeSkuName?: string;
  freeSkuSellingPrice?: number;
}

export interface BogoError {
  field: string;
  message: string;
  /** Tier index the error belongs to, for row highlighting. */
  rowIndex?: number;
}

/** "Buy 10, get 1 free" or, for a cross-SKU scheme, "Buy 10, get 1 free unit of <other SKU>". */
export function tierLabel(tier: Partial<BogoTier>, freeSkuName?: string): string {
  const base = `Buy ${tier.buyQty ?? 0}, get ${tier.freeQty ?? 0} free`;
  return freeSkuName ? `${base} unit${(tier.freeQty ?? 0) === 1 ? "" : "s"} of ${freeSkuName}` : base;
}

/**
 * Non-blocking sanity check: the Buy Quantity isn't a whole multiple of the
 * SKU's case size, so a seller authoring "Buy 10" on a SKU sold in cases of
 * 12 may be thinking in pieces when the qualifier is really case-denominated
 * (or vice versa) — the protocol itself never defines which unit item_count
 * uses, so this has to be caught in the editor rather than left ambiguous.
 */
export function tierPackSizeCaution(buyQty: number | undefined, caseSize: number): string | null {
  if (typeof buyQty !== "number" || Number.isNaN(buyQty) || caseSize <= 1) return null;
  if (buyQty % caseSize !== 0) {
    const lower = Math.floor(buyQty / caseSize) * caseSize;
    const upper = lower + caseSize;
    return `${buyQty} isn't a full case (case size ${caseSize}) — nearest full cases are ${lower || caseSize} or ${upper}.`;
  }
  return null;
}

/** Rupee value of the free units this tier grants, at the SKU's selling price. */
export function tierFreeValue(tier: Partial<BogoTier>, sellingPrice: number): number {
  if (typeof tier.freeQty !== "number" || Number.isNaN(tier.freeQty)) return 0;
  return +(tier.freeQty * sellingPrice).toFixed(2);
}

/**
 * Non-blocking sanity check: a tier giving away as many (or more) free units
 * than the buyer had to pay for is almost certainly a seller mistake, but it
 * isn't invalid — the scheme can still be saved. Surfaced as a caution, not
 * a validation error.
 */
export function tierCaution(tier: Partial<BogoTier>): string | null {
  if (
    typeof tier.buyQty !== "number" ||
    typeof tier.freeQty !== "number" ||
    Number.isNaN(tier.buyQty) ||
    Number.isNaN(tier.freeQty)
  ) {
    return null;
  }
  if (tier.freeQty >= tier.buyQty) {
    return `Free quantity (${tier.freeQty}) is the same as or more than Buy quantity (${tier.buyQty}) — double check this is intended.`;
  }
  return null;
}

/** Free units a buyer gets when ordering `qty` units, given the tiers (highest qualifying tier wins). */
export function freeUnitsFor(tiers: Partial<BogoTier>[], qty: number): number {
  let best = 0;
  for (const t of tiers) {
    if (typeof t.buyQty === "number" && typeof t.freeQty === "number" && qty >= t.buyQty) {
      best = Math.max(best, t.freeQty);
    }
  }
  return best;
}

export function validateBogoTiers(tiers: Partial<BogoTier>[]): BogoError[] {
  const errors: BogoError[] = [];
  const push = (field: string, message: string, rowIndex?: number) =>
    errors.push({ field, message, rowIndex });

  if (tiers.length === 0) {
    push("tiers", "At least one tier is required.");
    return errors;
  }

  tiers.forEach((t, i) => {
    const n = i + 1;
    if (typeof t.buyQty !== "number" || Number.isNaN(t.buyQty) || t.buyQty < 1) {
      push("buyQty", `Tier ${n}: Buy quantity must be 1 or more.`, i);
    }
    if (typeof t.freeQty !== "number" || Number.isNaN(t.freeQty) || t.freeQty < 1) {
      push("freeQty", `Tier ${n}: Free quantity must be 1 or more.`, i);
    }
  });

  const sorted = tiers
    .map((t, idx) => ({ t, idx }))
    .filter((x) => typeof x.t.buyQty === "number")
    .sort((a, b) => a.t.buyQty! - b.t.buyQty!);
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const nxt = sorted[i + 1];
    if (cur.t.buyQty === nxt.t.buyQty) {
      push("tiers", `Tiers ${cur.idx + 1} and ${nxt.idx + 1} have the same Buy quantity.`, nxt.idx);
    }
  }
  return errors;
}

// ---------- Storage (prototype) ----------

const STORAGE_KEY = "qwipo.bogoSchemes";

export const seedBogoSchemes: BogoScheme[] = [
  {
    id: "BOGO-180000076",
    name: "BOGO – Sunflower Oil 1L x12",
    skuCode: "180000076",
    skuName: "FREEDOM REF.SUNFLOWER OIL 1 LTR X 12PET",
    mrp: 191,
    sellingPrice: 174,
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    status: "Active",
    tiers: [
      { buyQty: 10, freeQty: 1 },
      { buyQty: 24, freeQty: 3 },
    ],
  },
];

export function getAllBogoSchemes(): BogoScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...seedBogoSchemes];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as BogoScheme[];
  } catch {
    /* fall through to the seed */
  }
  return [...seedBogoSchemes];
}

export function setAllBogoSchemes(schemes: BogoScheme[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
  } catch {
    /* storage unavailable: the change lasts for this session only */
  }
}
