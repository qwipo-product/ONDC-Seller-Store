/**
 * Quantity Pricing Scheme (QPS) — Phase 1 of Offers & Schemes.
 *
 * A QPS scheme attaches quantity-based pricing slabs to a SKU. Example:
 *   SKU MRP ₹10, Selling Price ₹8
 *     1–4 qty  → ₹8       (no discount)
 *     5–9 qty  → ₹7       (flat slab price)
 *     10+ qty  → 30% off  (percentage slab → effective ₹5.60)
 *
 * Per slab the user provides ONE of: a percentage discount, a flat rupee
 * amount off per unit ("amount"), or a locked slab price ("flat", legacy).
 * We derive the effective price in every case.
 *
 * Rules prefixed QPS- (Quantity Pricing Scheme).
 */

import { catalogSkus, findSku } from "./sku-catalog";

export type SlabDiscountType = "flat" | "percent" | "amount";

export interface QpsSlab {
  minQty: number;
  maxQty: number | null; // null means unlimited upper bound
  discountType: SlabDiscountType;
  /** When discountType = "flat": the locked price for this slab (per unit). */
  slabPrice?: number;
  /** When discountType = "percent": the % off the selling price. */
  slabPercent?: number;
  /** When discountType = "amount": rupees taken off the selling price, per unit. */
  slabAmount?: number;
  /** Effective per-unit price (derived). Computed once the slab is validated. */
  effectivePrice: number;
}

export interface QpsScheme {
  id: string;
  name: string;
  skuCode: string;
  skuName: string;
  mrp: number;
  sellingPrice: number;
  slabs: QpsSlab[];
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive" | "Scheduled" | "Expired";
}

export interface QpsError {
  ruleId: string;
  code: string;
  field: string;
  message: string;
  /** Optional — the row / slab index the error applies to, for UI highlighting. */
  rowIndex?: number;
}

// ---------- Helpers ----------

/** Calculate the effective per-unit price for a single slab given the SKU's selling price. */
export function computeEffectivePrice(slab: Partial<QpsSlab>, sellingPrice: number): number {
  if (slab.discountType === "flat" && typeof slab.slabPrice === "number") {
    return slab.slabPrice;
  }
  if (slab.discountType === "percent" && typeof slab.slabPercent === "number") {
    return +(sellingPrice * (1 - slab.slabPercent / 100)).toFixed(2);
  }
  if (slab.discountType === "amount" && typeof slab.slabAmount === "number") {
    return +Math.max(0, sellingPrice - slab.slabAmount).toFixed(2);
  }
  return sellingPrice;
}

// ---------- Slab-level validation ----------

/**
 * Validate a set of slabs for a SKU. Runs single-slab checks (QPS-004..QPS-009)
 * and cross-slab checks (QPS-010..QPS-012). Returns an array of errors (empty = valid).
 */
export function validateSlabs(
  slabs: Partial<QpsSlab>[],
  sellingPrice: number,
): QpsError[] {
  const errors: QpsError[] = [];
  const push = (ruleId: string, code: string, field: string, message: string, rowIndex?: number) =>
    errors.push({ ruleId, code, field, message, rowIndex });

  if (!slabs || slabs.length === 0) {
    push("QPS-013", "ERR_QPS_013", "slabs", "At least one slab is required.");
    return errors;
  }

  slabs.forEach((slab, i) => {
    // --- QPS-004 Min Qty ---
    if (typeof slab.minQty !== "number" || slab.minQty < 1 || !Number.isInteger(slab.minQty)) {
      push("QPS-004", "ERR_QPS_004", "minQty",
        `Slab ${i + 1}: Min quantity must be an integer ≥ 1.`, i);
    }

    // --- QPS-005 Max Qty ---
    if (slab.maxQty !== null && slab.maxQty !== undefined) {
      if (!Number.isInteger(slab.maxQty) || slab.maxQty < 1) {
        push("QPS-005", "ERR_QPS_005", "maxQty",
          `Slab ${i + 1}: Max quantity must be a positive integer (or leave blank for unlimited).`, i);
      } else if (typeof slab.minQty === "number" && slab.maxQty < slab.minQty) {
        push("QPS-005", "ERR_QPS_005", "maxQty",
          `Slab ${i + 1}: Max quantity (${slab.maxQty}) must be ≥ Min quantity (${slab.minQty}).`, i);
      }
    }

    // --- QPS-006 Exactly one of slabPrice / slabPercent ---
    const hasPrice = typeof slab.slabPrice === "number";
    const hasPercent = typeof slab.slabPercent === "number";
    const hasAmount = typeof slab.slabAmount === "number" && !Number.isNaN(slab.slabAmount);
    if (slab.discountType === "amount") {
      if (!hasAmount) {
        push("QPS-006", "ERR_QPS_006", "slabAmount",
          `Slab ${i + 1}: Discount amount (₹) is required when discount type is Flat ₹ off.`, i);
      }
    } else if (slab.discountType === "flat") {
      if (!hasPrice) {
        push("QPS-006", "ERR_QPS_006", "slabPrice",
          `Slab ${i + 1}: Slab price is required when discount type is Flat.`, i);
      }
    } else if (slab.discountType === "percent") {
      if (!hasPercent) {
        push("QPS-006", "ERR_QPS_006", "slabPercent",
          `Slab ${i + 1}: Discount % is required when discount type is Percent.`, i);
      }
    } else {
      push("QPS-006", "ERR_QPS_006", "discountType",
        `Slab ${i + 1}: Discount type must be either Percent or Flat ₹ off.`, i);
    }
    if (hasPrice && hasPercent) {
      push("QPS-006", "ERR_QPS_006", "discountType",
        `Slab ${i + 1}: Provide EITHER slab price OR discount percent — not both.`, i);
    }

    // --- QPS-007 Slab price range (flat) ---
    if (slab.discountType === "flat" && hasPrice) {
      const p = slab.slabPrice!;
      if (p <= 0) {
        push("QPS-007", "ERR_QPS_007", "slabPrice",
          `Slab ${i + 1}: Slab price must be greater than 0.`, i);
      } else if (p > sellingPrice) {
        push("QPS-007", "ERR_QPS_007", "slabPrice",
          `Slab ${i + 1}: Slab price (₹${p}) cannot exceed the SKU's selling price (₹${sellingPrice}).`, i);
      }
    }

    // --- QPS-007 Flat ₹ off range (amount) ---
    if (slab.discountType === "amount" && hasAmount) {
      const a = slab.slabAmount!;
      if (a < 0) {
        push("QPS-007", "ERR_QPS_007", "slabAmount",
          `Slab ${i + 1}: Discount amount cannot be negative.`, i);
      } else if (a >= sellingPrice) {
        push("QPS-007", "ERR_QPS_007", "slabAmount",
          `Slab ${i + 1}: Discount amount (₹${a}) must be less than the SKU's selling price (₹${sellingPrice}).`, i);
      }
    }

    // --- QPS-008 Percent range ---
    if (slab.discountType === "percent" && hasPercent) {
      const pct = slab.slabPercent!;
      if (pct < 0 || pct >= 100) {
        push("QPS-008", "ERR_QPS_008", "slabPercent",
          `Slab ${i + 1}: Discount percent must be between 0 and 99.99.`, i);
      }
    }
  });

  // --- QPS-010/011/012 Cross-slab checks: contiguous, non-overlapping, monotone ---
  const sorted = [...slabs]
    .map((s, idx) => ({ ...s, _idx: idx }))
    .filter((s) => typeof s.minQty === "number")
    .sort((a, b) => (a.minQty! - b.minQty!));

  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const nxt = sorted[i + 1];
    // Overlap detection
    if (cur.maxQty !== null && cur.maxQty !== undefined && nxt.minQty! <= cur.maxQty) {
      push("QPS-010", "ERR_QPS_010", "slabs",
        `Slabs ${cur._idx + 1} and ${nxt._idx + 1}: quantity ranges overlap.`, nxt._idx);
    }
    // Contiguity — maxQty of one slab should be minQty of the next - 1
    if (
      cur.maxQty !== null &&
      cur.maxQty !== undefined &&
      nxt.minQty! > cur.maxQty + 1
    ) {
      push("QPS-011", "ERR_QPS_011", "slabs",
        `Slabs ${cur._idx + 1} and ${nxt._idx + 1}: gap in quantity ranges — slab ${nxt._idx + 1} should start at ${cur.maxQty + 1}.`, nxt._idx);
    }
  }

  // Effective-price monotone non-increasing check: higher qty should not cost more per unit
  const withEffective = sorted.map((s) => ({
    ...s,
    eff: computeEffectivePrice(s as Partial<QpsSlab>, sellingPrice),
  }));
  for (let i = 0; i < withEffective.length - 1; i++) {
    if (withEffective[i].eff < withEffective[i + 1].eff - 0.001) {
      push("QPS-012", "ERR_QPS_012", "slabs",
        `Slabs ${withEffective[i]._idx + 1} → ${withEffective[i + 1]._idx + 1}: effective price increases with higher quantity (₹${withEffective[i].eff} → ₹${withEffective[i + 1].eff}). Higher-qty slabs must be cheaper or equal.`, withEffective[i + 1]._idx);
    }
  }

  // Last slab should either have maxQty = null or be explicitly bounded
  const last = sorted[sorted.length - 1];
  if (!last) return errors;
  // (No error — bounded last slab is valid too)

  return errors;
}

// ---------- Bulk import row ----------

export interface BulkQpsRow {
  rowNumber: number;
  skuId: string;
  skuName: string;
  mrp: string;
  sp: string;
  slabStart: string;
  slabEnd: string;
  slabPrice: string;
  slabPercent: string;
  effectiveValue: string; // recomputed by the server; shown for reference
  errors: QpsError[];
  parsed?: {
    skuCode: string;
    minQty: number;
    maxQty: number | null;
    discountType: SlabDiscountType;
    slabPrice?: number;
    slabPercent?: number;
    effectivePrice: number;
  };
  status: "valid" | "invalid";
}

export interface BulkQpsResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: BulkQpsRow[];
  /** Grouped by SKU — each group is a scheme ready to import. */
  schemes: QpsScheme[];
  fileLevelErrors: QpsError[];
}

/** Required headers in the QPS bulk-import file (exact names). */
export const BULK_QPS_HEADERS = [
  "SKU ID",
  "SKU Name",
  "MRP",
  "SP",
  "Slab Start (Min Qty)",
  "Slab End (Max Qty)",
  "Slab Price",
  "Slab Discount %",
  "Effective Value",
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else { field += c; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function importQpsCsv(text: string): BulkQpsResult {
  const fileLevelErrors: QpsError[] = [];
  const rows = parseCsv(text);
  if (rows.length === 0) {
    fileLevelErrors.push({
      ruleId: "QPS-014",
      code: "ERR_QPS_014",
      field: "file",
      message: "File is empty.",
    });
    return { totalRows: 0, validRows: 0, invalidRows: 0, rows: [], schemes: [], fileLevelErrors };
  }

  const headers = rows[0].map((h) => h.trim());
  const missing = BULK_QPS_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    fileLevelErrors.push({
      ruleId: "QPS-014",
      code: "ERR_QPS_014",
      field: "headers",
      message: `Missing required column(s): ${missing.join(", ")}.`,
    });
  }
  const col = (name: string) => headers.indexOf(name);
  const iSkuId = col("SKU ID");
  const iSkuName = col("SKU Name");
  const iMrp = col("MRP");
  const iSp = col("SP");
  const iStart = col("Slab Start (Min Qty)");
  const iEnd = col("Slab End (Max Qty)");
  const iPrice = col("Slab Price");
  const iPct = col("Slab Discount %");
  const iEff = col("Effective Value");

  const dataRows = rows.slice(1);
  const bulkRows: BulkQpsRow[] = dataRows.map((cells, idx): BulkQpsRow => {
    const rowNumber = idx + 2;
    const errors: QpsError[] = [];
    const push = (ruleId: string, code: string, field: string, message: string) =>
      errors.push({ ruleId, code, field, message });

    const skuId = (cells[iSkuId] || "").trim();
    const skuName = (cells[iSkuName] || "").trim();
    const mrp = (cells[iMrp] || "").trim();
    const sp = (cells[iSp] || "").trim();
    const slabStart = (cells[iStart] || "").trim();
    const slabEnd = (cells[iEnd] || "").trim();
    const slabPrice = (cells[iPrice] || "").trim();
    const slabPercent = (cells[iPct] || "").trim();
    const effectiveValue = (cells[iEff] || "").trim();

    // --- QPS-001 SKU required & exists in catalog ---
    let catalog = findSku(skuId);
    if (!skuId) {
      push("QPS-001", "ERR_QPS_001", "SKU ID", "SKU ID is required.");
    } else if (!catalog) {
      push("QPS-001", "ERR_QPS_001", "SKU ID",
        `SKU "${skuId}" is not in the seller catalog.`);
    }

    // --- QPS-002 / QPS-003 MRP / SP sanity ---
    const mrpNum = parseFloat(mrp);
    const spNum = parseFloat(sp);
    if (mrp === "" || isNaN(mrpNum) || mrpNum < 0) {
      push("QPS-002", "ERR_QPS_002", "MRP", "MRP must be a non-negative number.");
    }
    if (sp === "" || isNaN(spNum) || spNum <= 0) {
      push("QPS-003", "ERR_QPS_003", "SP", "Selling price must be greater than 0.");
    } else if (!isNaN(mrpNum) && mrpNum > 0 && spNum > mrpNum) {
      push("QPS-003", "ERR_QPS_003", "SP", "Selling price cannot exceed MRP.");
    }

    // --- QPS-004 Slab start ---
    const minQty = parseInt(slabStart, 10);
    if (slabStart === "" || !/^\d+$/.test(slabStart) || minQty < 1) {
      push("QPS-004", "ERR_QPS_004", "Slab Start (Min Qty)",
        "Slab Start must be an integer ≥ 1.");
    }

    // --- QPS-005 Slab end ---
    let maxQty: number | null = null;
    if (slabEnd !== "") {
      if (!/^\d+$/.test(slabEnd)) {
        push("QPS-005", "ERR_QPS_005", "Slab End (Max Qty)",
          "Slab End must be a positive integer or blank (for unlimited).");
      } else {
        maxQty = parseInt(slabEnd, 10);
        if (!isNaN(minQty) && maxQty < minQty) {
          push("QPS-005", "ERR_QPS_005", "Slab End (Max Qty)",
            `Slab End (${maxQty}) must be ≥ Slab Start (${minQty}).`);
        }
      }
    }

    // --- QPS-006 Exactly one of slabPrice / slabPercent ---
    const hasPrice = slabPrice !== "";
    const hasPct = slabPercent !== "";
    let discountType: SlabDiscountType | null = null;
    if (hasPrice && hasPct) {
      push("QPS-006", "ERR_QPS_006", "Slab Price",
        "Provide EITHER Slab Price OR Slab Discount % — not both.");
    } else if (!hasPrice && !hasPct) {
      push("QPS-006", "ERR_QPS_006", "Slab Price",
        "Either Slab Price or Slab Discount % must be provided.");
    } else {
      discountType = hasPrice ? "flat" : "percent";
    }

    // --- QPS-007 Slab Price range ---
    const priceNum = parseFloat(slabPrice);
    if (hasPrice) {
      if (isNaN(priceNum) || priceNum <= 0) {
        push("QPS-007", "ERR_QPS_007", "Slab Price", "Slab Price must be > 0.");
      } else if (!isNaN(spNum) && priceNum > spNum) {
        push("QPS-007", "ERR_QPS_007", "Slab Price",
          `Slab Price (₹${priceNum}) cannot exceed Selling Price (₹${spNum}).`);
      }
    }

    // --- QPS-008 Percent range ---
    const pctNum = parseFloat(slabPercent);
    if (hasPct) {
      if (isNaN(pctNum) || pctNum < 0 || pctNum >= 100) {
        push("QPS-008", "ERR_QPS_008", "Slab Discount %",
          "Slab Discount % must be between 0 and 99.99.");
      }
    }

    let effectivePrice = spNum;
    if (discountType === "flat" && !isNaN(priceNum)) effectivePrice = priceNum;
    else if (discountType === "percent" && !isNaN(pctNum) && !isNaN(spNum)) {
      effectivePrice = +(spNum * (1 - pctNum / 100)).toFixed(2);
    }

    return {
      rowNumber,
      skuId,
      skuName: skuName || (catalog?.skuName ?? ""),
      mrp,
      sp,
      slabStart,
      slabEnd,
      slabPrice,
      slabPercent,
      effectiveValue,
      errors,
      parsed: errors.length === 0 && discountType !== null
        ? {
            skuCode: skuId,
            minQty,
            maxQty,
            discountType,
            slabPrice: discountType === "flat" ? priceNum : undefined,
            slabPercent: discountType === "percent" ? pctNum : undefined,
            effectivePrice,
          }
        : undefined,
      status: errors.length === 0 ? "valid" : "invalid",
    };
  });

  // ---- Aggregate valid rows into schemes (one per SKU) and run cross-slab validation ----
  const bySku = new Map<string, BulkQpsRow[]>();
  for (const row of bulkRows) {
    if (row.status !== "valid" || !row.parsed) continue;
    const key = row.parsed.skuCode;
    if (!bySku.has(key)) bySku.set(key, []);
    bySku.get(key)!.push(row);
  }

  const schemes: QpsScheme[] = [];
  for (const [skuCode, rowsForSku] of bySku) {
    const catalog = findSku(skuCode);
    if (!catalog) continue;
    const slabs: QpsSlab[] = rowsForSku.map((r) => ({
      minQty: r.parsed!.minQty,
      maxQty: r.parsed!.maxQty,
      discountType: r.parsed!.discountType,
      slabPrice: r.parsed!.slabPrice,
      slabPercent: r.parsed!.slabPercent,
      effectivePrice: r.parsed!.effectivePrice,
    }));

    // Cross-slab validation on the aggregated set
    const crossErrors = validateSlabs(slabs, catalog.sellingPrice);
    if (crossErrors.length > 0) {
      // Attach cross errors to each contributing row (pick first row as representative)
      for (const err of crossErrors) {
        rowsForSku.forEach((r) => {
          r.errors.push(err);
          r.status = "invalid";
        });
      }
      continue;
    }

    schemes.push({
      id: `QPS-${skuCode}`,
      name: `QPS – ${catalog.skuName}`,
      skuCode,
      skuName: catalog.skuName,
      mrp: catalog.mrp,
      sellingPrice: catalog.sellingPrice,
      slabs,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10),
      status: "Active",
    });
  }

  const validRows = bulkRows.filter((r) => r.status === "valid").length;
  const invalidRows = bulkRows.filter((r) => r.status === "invalid").length;

  return {
    totalRows: bulkRows.length,
    validRows,
    invalidRows,
    rows: bulkRows,
    schemes,
    fileLevelErrors,
  };
}

/** Generate a sample CSV template for the QPS bulk import. */
export function buildQpsSampleCsv(): string {
  const headers = [...BULK_QPS_HEADERS];
  // Two SKUs × 3 slabs each showing both flat price and % discount usage
  const first = catalogSkus[0]; // 180000005 Freedom 15KG
  const second = catalogSkus[2]; // 180000008 Freedom 1L x16
  const rows: string[][] = [
    // SKU 1 — flat prices across slabs
    [first.id, first.skuName, String(first.mrp), String(first.sellingPrice), "1", "4", String(first.sellingPrice), "", String(first.sellingPrice)],
    [first.id, first.skuName, String(first.mrp), String(first.sellingPrice), "5", "9", String(first.sellingPrice - 50), "", String(first.sellingPrice - 50)],
    [first.id, first.skuName, String(first.mrp), String(first.sellingPrice), "10", "", String(first.sellingPrice - 120), "", String(first.sellingPrice - 120)],
    // SKU 2 — percent discounts
    [second.id, second.skuName, String(second.mrp), String(second.sellingPrice), "1", "11", "", "0", String(second.sellingPrice)],
    [second.id, second.skuName, String(second.mrp), String(second.sellingPrice), "12", "47", "", "5", String(+(second.sellingPrice * 0.95).toFixed(2))],
    [second.id, second.skuName, String(second.mrp), String(second.sellingPrice), "48", "", "", "10", String(+(second.sellingPrice * 0.9).toFixed(2))],
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\r\n");
}
