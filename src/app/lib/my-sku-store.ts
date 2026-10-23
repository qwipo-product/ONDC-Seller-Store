/**
 * Module-level mutable SKU store shared between Product Store and My SKU.
 *
 * This is intentionally a simple in-memory store (no React state) because the
 * two pages never render simultaneously — navigation causes My SKU to re-mount
 * and re-read from here on every visit, so the module-level array is always
 * the source of truth without needing a context or event bus.
 */

import { sampleSKUs, type SKUData } from "./my-sku-data";
import { type PSSku, psBrands, psCompanies, psCategories } from "./product-store-data";

// Mutable store — initialised once from the demo seed.
let _skus: SKUData[] = [...sampleSKUs];

// IDs already imported from Product Store this session (prevents re-add).
const _importedPsIds = new Set<string>(
  sampleSKUs
    .filter((s) => s.source === "Product Store")
    .map((s) => s.productStoreId ?? "")
    .filter(Boolean)
);

export function getMySkus(): SKUData[] {
  return _skus;
}

export function isImportedFromPS(psSkuId: string): boolean {
  return _importedPsIds.has(psSkuId);
}

/** Map a Product Store SKU → SKUData, status Inactive, FC1 fields only. */
export function addFromProductStore(psSku: PSSku): SKUData {
  if (_importedPsIds.has(psSku.id)) {
    return _skus.find((s) => s.productStoreId === psSku.id)!;
  }

  const brand = psBrands.find((b) => b.id === psSku.brandId);
  const company = psCompanies.find((c) => c.id === psSku.companyId);
  const category = psCategories.find((c) => c.id === psSku.categoryId);

  const measureUnit = psSku.packagingUnit === "kg" ? "kilogram"
    : psSku.packagingUnit === "g" ? "gram"
    : psSku.packagingUnit === "L" ? "litre"
    : psSku.packagingUnit === "ml" ? "millilitre"
    : psSku.packagingUnit;

  // Volumetric weight (cm³ ÷ 5000 standard divisor)
  const volWeight = psSku.productLength && psSku.productWidth && psSku.productHeight
    ? ((psSku.productLength * psSku.productWidth * psSku.productHeight) / 5000).toFixed(3)
    : "";

  // Field Category 1 — all fields sourced from Product Store, shown read-only in sku-detail
  const ondcPrefilled = {
    itemStatus: "disable" as const,
    // Descriptor (FC1)
    skuName: psSku.name,
    shortName: psSku.shortName ?? "",
    productCode: psSku.skuCode,
    groupName: psSku.groupName ?? "",
    brandAttribute: brand?.name ?? "",
    // Descriptions (FC1)
    shortDesc: psSku.shortDescription,
    longDesc: psSku.longDescription,
    // Images (FC1)
    image: psSku.image,
    // Taxonomy (FC1)
    categoryId: category?.name ?? "",
    // Quantity & Packaging (FC1)
    measureUnit,
    measureValue: psSku.packagingSize,
    upc: psSku.upc ?? "",
    weightMeasure: "Kilogram",
    skuWeight: String(psSku.productWeight),
    // Dimensions (FC1)
    productLength: String(psSku.productLength ?? ""),
    productWidth: String(psSku.productWidth ?? ""),
    productHeight: String(psSku.productHeight ?? ""),
    volumetricWeight: volWeight,
    // Package (FC1)
    packageType: psSku.packageType ?? "",
    packageTypeValue: psSku.packageTypeValue ?? "",
    // Compliance (FC1)
    manufacturerName: company?.name ?? psSku.manufacturerName,
    countryOfOrigin: psSku.countryOfOrigin,
    // Tax (FC1)
    hsnCode: psSku.hsnCode,
    gstTax: psSku.gstTax ?? "",
    gstCess: psSku.gstCess ?? "0%",
    // FC2 left blank — seller fills these in sku-detail
    fulfillmentId: "",
    locationId: "",
    minOrderQty: "",
    maxOrderQty: "",
    returnable: false,
    cancellable: false,
    timeToShip: "",
    availableOnCod: false,
    consumerCareContactName: "",
    consumerCareContactEmail: "",
    consumerCareContactPhone: "",
    manufacturerAddress: "",
  };

  // FC2 fields the seller must complete before going live
  const missingFields = [
    "MRP",
    "Selling Price",
    "Fulfillment ID",
    "Location ID",
    "Min Order Qty",
    "Time to Ship",
    "Returnable",
    "Cancellable",
    "Consumer Care Contact",
  ];

  const newSku: SKUData = {
    id: `PS-IMP-${psSku.id}-${Date.now()}`,
    productStoreId: psSku.id,
    name: psSku.name,
    category: category?.name ?? "",
    brand: brand?.name ?? "",
    source: "Product Store",
    status: "Inactive",
    lastUpdated: new Date().toISOString().split("T")[0],
    sku: psSku.skuCode,
    shortName: psSku.shortName ?? "",
    // MRP is FC2 — seller sets their own MRP; not inherited from Product Store.
    // These start undefined (renders as 0/blank in the UI). Until the seller
    // fills them in, the SKU must NOT be marked ONDC compliant — see the TODO
    // note in sku-detail.tsx doSaveOndc() when implementing the user story.
    mrp: undefined,
    sellingPrice: undefined,
    availableStock: 0,
    isInfiniteStock: false,
    thresholdLevel: 0,
    reservedStock: 0,
    ondcPrefilled,
    tax: {
      hsnCode: psSku.hsnCode,
      gstTax: psSku.gstTax ?? "",
      gstCess: psSku.gstCess ?? "0%",
    },
    ondcCompliance: {
      isCompliant: false,
      missingFields,
      ondcData: {},
    },
  };

  _skus = [newSku, ..._skus];
  _importedPsIds.add(psSku.id);
  return newSku;
}
