/**
 * Shared SKU catalog — the same 12 Freedom / Sri Krupa / First Klass SKUs that
 * appear on Price & Inventory and My SKU, aggregated from the Bizom DMS export.
 *
 * This is intentionally a lightweight summary (just the fields that offers/schemes
 * need to reference) so that the offers module doesn't depend on the full
 * Price & Inventory product model.
 */

export interface CatalogSku {
  id: string;
  skuCode: string;
  skuName: string;
  brand: string;
  category: string;
  mrp: number;
  sellingPrice: number;
  /** Catalog-level status. Inactive SKUs are hidden from offers
   *  pickers and other "this is selectable for new work" surfaces. */
  status: "Active" | "Inactive";
  /** Pieces per case/pack for this SKU (1 = sold as a single unit,
   *  e.g. a tin). Quantity-based offer rules (QPS, BOGO) are
   *  authored and qualified in this unit — surfaced in the UI so a
   *  "Buy 10" field says what 10 actually means for this SKU. */
  caseSize: number;
}

// Two SKUs marked Inactive (180000437 and 180000490) so the offers
// SKU search has a meaningful "hidden because inactive" signal in
// the demo dataset. The 10 remaining are Active and selectable.
export const catalogSkus: CatalogSku[] = [
  { id: "180000005", skuCode: "180000005", skuName: "FREEDOM REF. SUNFLOWER OIL 15 KG. TIN", brand: "Freedom", category: "Edible Oil", mrp: 3091, sellingPrice: 2810, status: "Active", caseSize: 1 },
  { id: "180000006", skuCode: "180000006", skuName: "FREEDOM REF. SUNFLOWER OIL 15 LTR. TIN", brand: "Freedom", category: "Edible Oil", mrp: 2838, sellingPrice: 2580, status: "Active", caseSize: 1 },
  { id: "180000008", skuCode: "180000008", skuName: "FREEDOM REF. SUNFLOWER OIL 1 LTR.X16NOS.", brand: "Freedom", category: "Edible Oil", mrp: 188, sellingPrice: 171, status: "Active", caseSize: 16 },
  { id: "180000076", skuCode: "180000076", skuName: "FREEDOM REF.SUNFLOWER OIL 1 LTR X 12PET", brand: "Freedom", category: "Edible Oil", mrp: 191, sellingPrice: 174, status: "Active", caseSize: 12 },
  { id: "180000179", skuCode: "180000179", skuName: "FREEDOM REF.SUNFLOWER OIL 2 LTR X 6 PET", brand: "Freedom", category: "Edible Oil", mrp: 388, sellingPrice: 353, status: "Active", caseSize: 6 },
  { id: "180000248", skuCode: "180000248", skuName: "FREEDOM FILTE. GROUNDNUT OIL 1 LTRX10NOS", brand: "Freedom", category: "Edible Oil", mrp: 190, sellingPrice: 173, status: "Active", caseSize: 10 },
  { id: "180000249", skuCode: "180000249", skuName: "FREEDOM REF.SUNFLOWEROIL 5LTRX4JARS-NEW", brand: "Freedom", category: "Edible Oil", mrp: 963, sellingPrice: 875, status: "Active", caseSize: 4 },
  { id: "180000260", skuCode: "180000260", skuName: "FREEDOM K.GHANI MUSTARD OIL 1LTRX12 PET", brand: "Freedom", category: "Edible Oil", mrp: 194, sellingPrice: 176, status: "Active", caseSize: 12 },
  { id: "180000377", skuCode: "180000377", skuName: "Sri Krupa 1Ltr X 12 Pet", brand: "Sri Krupa", category: "Edible Oil", mrp: 172, sellingPrice: 156, status: "Active", caseSize: 12 },
  { id: "180000419", skuCode: "180000419", skuName: "FREEDOM FILTE. GROUNDNUT OIL 1 LTRX10NOS-OFFER", brand: "Freedom", category: "Edible Oil", mrp: 190, sellingPrice: 173, status: "Active", caseSize: 10 },
  { id: "180000437", skuCode: "180000437", skuName: "FREEDOM REF. RICE BRAN OIL 1 LTR.X16 NOS", brand: "Freedom", category: "Edible Oil", mrp: 179, sellingPrice: 163, status: "Inactive", caseSize: 16 },
  { id: "180000490", skuCode: "180000490", skuName: "FIRST KLASS REF PALMOLEIN 750G X 15 NOS", brand: "First Klass", category: "Edible Oil", mrp: 129, sellingPrice: 117.4, status: "Inactive", caseSize: 15 },
];

export function findSku(codeOrId: string): CatalogSku | undefined {
  const s = codeOrId.trim();
  return catalogSkus.find((x) => x.skuCode === s || x.id === s);
}
