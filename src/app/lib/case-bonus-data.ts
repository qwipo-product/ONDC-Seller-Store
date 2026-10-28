/**
 * Case Bonus: extra cases free on bulk purchase of one SKU (Offers & Schemes).
 *
 * Same free-quantity-on-threshold mechanic as BOGO, authored in case units
 * instead of individual units — built for distributors who order by the
 * case:
 *   Buy 5 cases → get 1 case free
 *   Buy 10 cases → get 3 cases free
 *
 * ONDC mapping: a "freebie" offer (spec 0093) per tier — qualifier.item_count
 * = buyCases × the SKU's case size (published in base units, not cases —
 * the protocol has no case-level qualifier), benefit.item_count/item_id =
 * the free quantity/item. meta.additive = no (two freebie offers on one SKU
 * don't stack with each other), meta.auto = yes.
 *
 * Prototype storage: localStorage.
 */

export interface CaseBonusTier {
  /** Cases the buyer must order to unlock this tier. */
  buyCases: number;
  /** Free cases granted once `buyCases` is reached. */
  freeCases: number;
}

export interface CaseBonusScheme {
  id: string;
  name: string;
  skuCode: string;
  skuName: string;
  mrp: number;
  sellingPrice: number;
  tiers: CaseBonusTier[];
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive" | "Scheduled" | "Expired";
  /** The SKU given away free. Protocol-legal to differ from `skuCode`. Equal
   *  to `skuCode` means same-SKU case bonus (the common case). */
  freeSkuCode?: string;
  freeSkuName?: string;
  freeSkuSellingPrice?: number;
}

export interface CaseBonusError {
  field: string;
  message: string;
  /** Tier index the error belongs to, for row highlighting. */
  rowIndex?: number;
}

/** "Buy 5 cases, get 1 case free" or, cross-SKU, "...get 1 case free of <other SKU>". */
export function tierLabel(tier: Partial<CaseBonusTier>, freeSkuName?: string): string {
  const base = `Buy ${tier.buyCases ?? 0} case${(tier.buyCases ?? 0) === 1 ? "" : "s"}, get ${tier.freeCases ?? 0} case${(tier.freeCases ?? 0) === 1 ? "" : "s"} free`;
  return freeSkuName ? `${base} of ${freeSkuName}` : base;
}

/** Rupee value of the free cases this tier grants, given the free SKU's per-piece selling price and case size. */
export function tierFreeValue(tier: Partial<CaseBonusTier>, sellingPrice: number, caseSize: number): number {
  if (typeof tier.freeCases !== "number" || Number.isNaN(tier.freeCases)) return 0;
  return +(tier.freeCases * caseSize * sellingPrice).toFixed(2);
}

/**
 * Non-blocking sanity check: giving away as many (or more) free cases than
 * the buyer had to pay for is almost certainly a seller mistake.
 */
export function tierCaution(tier: Partial<CaseBonusTier>): string | null {
  if (
    typeof tier.buyCases !== "number" ||
    typeof tier.freeCases !== "number" ||
    Number.isNaN(tier.buyCases) ||
    Number.isNaN(tier.freeCases)
  ) {
    return null;
  }
  if (tier.freeCases >= tier.buyCases) {
    return `Free cases (${tier.freeCases}) is the same as or more than Buy cases (${tier.buyCases}) — double check this is intended.`;
  }
  return null;
}

/** "5 cases = 60 pieces" — the protocol's qualifier.item_count is published in
 *  base units, not cases, so sellers authoring in cases need the conversion
 *  made explicit rather than guessing what a bare case count means on publish. */
export function casesToPiecesLabel(cases: number | undefined, caseSize: number): string | null {
  if (typeof cases !== "number" || Number.isNaN(cases) || caseSize <= 1) return null;
  return `${cases} case${cases === 1 ? "" : "s"} = ${cases * caseSize} pieces`;
}

/** Free cases a buyer gets when ordering `cases`, given the tiers (highest qualifying tier wins). */
export function freeCasesFor(tiers: Partial<CaseBonusTier>[], cases: number): number {
  let best = 0;
  for (const t of tiers) {
    if (typeof t.buyCases === "number" && typeof t.freeCases === "number" && cases >= t.buyCases) {
      best = Math.max(best, t.freeCases);
    }
  }
  return best;
}

export function validateCaseBonusTiers(tiers: Partial<CaseBonusTier>[]): CaseBonusError[] {
  const errors: CaseBonusError[] = [];
  const push = (field: string, message: string, rowIndex?: number) =>
    errors.push({ field, message, rowIndex });

  if (tiers.length === 0) {
    push("tiers", "At least one tier is required.");
    return errors;
  }

  tiers.forEach((t, i) => {
    const n = i + 1;
    if (typeof t.buyCases !== "number" || Number.isNaN(t.buyCases) || t.buyCases < 1) {
      push("buyCases", `Tier ${n}: Buy cases must be 1 or more.`, i);
    }
    if (typeof t.freeCases !== "number" || Number.isNaN(t.freeCases) || t.freeCases < 1) {
      push("freeCases", `Tier ${n}: Free cases must be 1 or more.`, i);
    }
  });

  const sorted = tiers
    .map((t, idx) => ({ t, idx }))
    .filter((x) => typeof x.t.buyCases === "number")
    .sort((a, b) => a.t.buyCases! - b.t.buyCases!);
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const nxt = sorted[i + 1];
    if (cur.t.buyCases === nxt.t.buyCases) {
      push("tiers", `Tiers ${cur.idx + 1} and ${nxt.idx + 1} have the same Buy cases.`, nxt.idx);
    }
  }
  return errors;
}

// ---------- Storage (prototype) ----------

const STORAGE_KEY = "qwipo.caseBonusSchemes";

export const seedCaseBonusSchemes: CaseBonusScheme[] = [
  {
    id: "CB-180000249",
    name: "Case Bonus – Sunflower Oil 5Lx4 Jars",
    skuCode: "180000249",
    skuName: "FREEDOM REF.SUNFLOWEROIL 5LTRX4JARS-NEW",
    mrp: 963,
    sellingPrice: 875,
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    status: "Active",
    tiers: [
      { buyCases: 5, freeCases: 1 },
      { buyCases: 10, freeCases: 3 },
    ],
  },
];

export function getAllCaseBonusSchemes(): CaseBonusScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...seedCaseBonusSchemes];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as CaseBonusScheme[];
  } catch {
    /* fall through to the seed */
  }
  return [...seedCaseBonusSchemes];
}

export function setAllCaseBonusSchemes(schemes: CaseBonusScheme[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
  } catch {
    /* storage unavailable: the change lasts for this session only */
  }
}
