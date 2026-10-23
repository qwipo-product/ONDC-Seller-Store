// =====================================================================
// My SKU bulk import — Phase 2 template + parser
// ---------------------------------------------------------------------
// Phase 2 makes the SKU bulk import cover every field on the SKU
// detail page. The downloaded template is a real .xlsx with three
// tabs — Main / Validation / Master — and dropdown columns on the
// Main sheet pull from named ranges on the Master sheet so Excel
// rejects free-text entries.
//
// Why a separate module? The template + parser logic is meaty
// (~300 lines) and the My SKU page is already heavy. Keeping it here
// also lets the upcoming Excel-template tests target a small surface.
// =====================================================================

// ExcelJS is heavy (~900 KB unbundled). It's only needed when the
// seller actively downloads the template OR uploads a file, so we
// import it dynamically inside the two consumer functions —
// downloadSkuTemplate and parseSkuImportFile. Types are imported
// statically (erased at compile time).
//
// Phase 1 used SheetJS (xlsx) for the read path. We dropped that
// dependency — the unpublished xlsx CVEs (prototype pollution +
// ReDoS) had no fix on npm — and rebuilt the reader on top of the
// same ExcelJS instance the writer already uses.
import type ExcelJSType from "exceljs";

/** Per-field schema shared by the template generator and the parser. */
export interface SkuFieldDef {
  /** Stable key used by the parser when it returns parsed rows. */
  key: string;
  /** Header label shown on the Main sheet (without the trailing `*`). */
  header: string;
  /** Whether the field is required for a valid SKU row. */
  mandatory: boolean;
  /** Short hint shown in the frozen helper row under the header. */
  format: string;
  /** Long-form description shown on the Validation sheet. */
  rules: string;
  /** Optional dropdown options. When set, the column gets cell-level
   *  data validation and the values are listed on the Master sheet. */
  options?: string[];
  /** Example value shown on the Validation sheet. */
  example?: string;
  /** When true the column is rendered greyed-out in the template
   *  and tagged "Auto" on the Validation sheet — the importer
   *  computes the value from other fields (currently used for
   *  Weight in KG which we derive from Measure Unit × SKU Weight). */
  computed?: boolean;
  /**
   * 1 = Product Store managed — taken from the Product Store catalog.
   *     Included in the Catalog Admin / Brand Manager bulk import template.
   * 2 = Seller managed — filled in by the seller (pricing, fulfilment,
   *     customer care, etc.). Only included in the My SKU seller template.
   */
  fieldCategory: 1 | 2;
}

/**
 * Convert a (unit, value) pair into kilograms. Used for two callers:
 *  - Bulk import: Weight Measure (Gram/Kilogram) × SKU Weight, the
 *    canonical source for Weight in KG since the latest spec gave the
 *    physical weight its own dedicated dropdown.
 *  - SKU Detail page (manual form): Measure Unit (Gram/Kilogram/
 *    Liter/Milliliter) × SKU Weight. Volume units use a water-density
 *    approximation (1 mL ≈ 1 g, 1 L ≈ 1 kg) so the kg column is still
 *    meaningful for liquids on that screen.
 * Unknown units return null and surface "—" in the read-only column.
 */
export function measureToKg(
  measureUnit: string | undefined | null,
  value: number,
): number | null {
  if (!measureUnit || !Number.isFinite(value)) return null;
  switch (measureUnit.trim().toLowerCase()) {
    case "gram":
      return value / 1000;
    case "kilogram":
      return value;
    case "milliliter":
      return value / 1000;
    case "liter":
      return value;
    default:
      return null;
  }
}

/** Display helper for the computed Weight in KG column: format the
 *  kg number with sensible decimals or surface "—" for non-mass
 *  units. */
export function formatKgValue(kg: number | null): string {
  if (kg === null || !Number.isFinite(kg)) return "—";
  // Three decimals are enough to represent 1g (0.001 kg) without
  // turning whole-kg values into "5.000 kg".
  const rounded = Math.round(kg * 1000) / 1000;
  return `${rounded} kg`;
}

// Categories — pulled from the SKU detail page's CATEGORY_OPTIONS so
// the template stays in sync. Kept inline to avoid circular imports.
const CATEGORY_OPTIONS: string[] = [
  "Atta, Flours & Sooji",
  "Bakery, Cakes & Dairy",
  "Beauty & Hygiene",
  "Beverages",
  "Biscuits, Snacks & Namkeen",
  "Cooking Oils & Ghee",
  "Dairy & Cheese",
  "Dals & Pulses",
  "Detergents",
  "Dry Fruits",
  "Eggs, Meat & Fish",
  "Foodgrains, Oil & Masala",
  "Fruit Juices",
  "Frozen Snacks",
  "Frozen Vegetables",
  "Fruits and Vegetables",
  "Gift Voucher",
  "Gourmet & World Foods",
  "Indian Sweets",
  "Kitchen Accessories",
  "Masala & Seasoning",
  "Oats & Noodles",
  "Oil & Ghee",
  "Pasta & Soup",
  "Pet Care",
  "Pickles & Podis",
  "Ready to Cook",
  "Rice",
  "Salt & Sugar",
  "Snacks, Dry Fruits & Nuts",
  "Sugar & Spices",
  "Snacks & Branded Foods",
  "Spreads, Sauces & Ketchups",
  "Tea & Coffee",
  "Tinned & Processed Foods",
];

// Measure Unit covers mass (Gram/Kilogram), volume (Liter/Milliliter),
// count-based packaging (Pc, Pcs, Pouch, Bottle, …) and apparel sizes
// (New Born → Medium). Only Gram/Kilogram/Liter/Milliliter feed the
// Weight in KG conversion in measureToKg — every other unit returns
// null there and surfaces as "—" in the computed column.
const MEASURE_UNITS = [
  "Gram",
  "Kilogram",
  "Liter",
  "Milliliter",
  "Pc",
  "Pcs",
  "Pouch",
  "Pack",
  "Sachet",
  "Bag",
  "Lamination Bag",
  "Bottle",
  "Pet Bottle",
  "Jar",
  "Pet Jar",
  "Box",
  "Tin",
  "Can",
  "Case",
  "Tube",
  "Tetra Pack",
  "Sheet",
  "Set",
  "Pad",
  "Refill",
  "Nons",
  "Ladi",
  "Bundle",
  "Loose",
  "Plastic Jar",
  "Container",
  "Glass Jar",
  "New Born",
  "Small",
  "Medium",
];
// Weight Measure is intentionally narrower than Measure Unit — the
// physical weight only ever rolls up to grams or kilograms, and the
// importer uses the value here to compute the read-only Weight in KG
// column. Volume measures stay on Measure Unit alone.
const WEIGHT_MEASURES = ["Gram", "Kilogram"];
// Package Type — the physical container the SKU ships in. Paired
// with Package Type Value (a numeric companion column) so the seller
// can say e.g. "Bottle × 12". Free-text would let sellers spell the
// same container three different ways, so this is a closed dropdown.
const PACKAGE_TYPES = [
  "Pc",
  "Pcs",
  "Pouch",
  "Pack",
  "Sachet",
  "Bag",
  "Lamination Bag",
  "Bottle",
  "Pet Bottle",
  "Jar",
  "Pet Jar",
  "Box",
  "Tin",
  "Can",
  "Case",
  "Tube",
  "Tetra Pack",
  "Sheet",
  "Set",
  "Pad",
  "Refill",
  "Nons",
  "Ladi",
  "Bundle",
  "Loose",
  "Plastic Jar",
  "Container",
  "Glass Jar",
  "New Born",
  "Small",
  "Medium",
  "Large",
  "Extra Large",
  "XXL",
  "XXXL",
];
const COUNTRIES = ["India", "Bangladesh", "Sri Lanka", "Nepal", "Bhutan", "China", "Other"];
const TIME_TO_SHIP = ["24 hours", "36 hours", "48 hours"];
const YES_NO = ["Yes", "No"];
const ITEM_STATUS = ["Active", "Inactive"];

/** The full schema. Order = column order on the Main sheet. */
export const SKU_FIELDS: SkuFieldDef[] = [
  // --- Identity ---
  {
    key: "skuCode",
    header: "SKU Code",
    mandatory: true,
    format: "Letters/digits/-/_",
    rules: "Required. Alphanumeric (letters, digits, dashes, underscores). Must be unique within the file and not collide with an existing SKU.",
    example: "180000005",
    fieldCategory: 1,
  },
  {
    key: "skuName",
    header: "SKU Name",
    mandatory: true,
    format: "3–100 chars",
    rules: "Required. 3 to 100 characters. Plain text.",
    example: "FREEDOM REF. SUNFLOWER OIL 15 KG. TIN",
    fieldCategory: 1,
  },
  {
    key: "shortName",
    header: "Short Name",
    mandatory: false,
    format: "Max 20 chars — letters/digits/-/_",
    rules: "Optional. Up to 20 characters. Letters, digits, hyphens and underscores only — no spaces. Must be unique within the seller's catalog. Leave blank for no short name. In the Update Price & Stock template, enter CLEAR to explicitly remove an existing short name.",
    example: "FFR1",
    fieldCategory: 1,
  },
  // Group Name lets the seller cluster variants of the same product
  // family (e.g. "Freedom Model" groups Freedom Model 50ml / 100ml /
  // 200ml) so the list page can render them together and downstream
  // analytics roll up per family. Optional — single-variant SKUs
  // simply leave it blank. The list of known group names becomes
  // the dropdown source for the manual Add SKU form.
  {
    key: "groupName",
    header: "Group Name",
    mandatory: false,
    format: "Up to 100 chars",
    rules:
      "Optional. Up to 100 characters. Pick an existing group from the dropdown OR type a new one — new values get added to the group master.",
    example: "Freedom Model",
    fieldCategory: 1,
  },
  {
    key: "shortDesc",
    header: "Short Description",
    mandatory: true,
    format: "10–150 chars",
    rules: "Required. 10 to 150 characters. Plain text only — no links or HTML.",
    example: "Premium refined sunflower oil, 15 kg tin",
    fieldCategory: 1,
  },
  {
    key: "longDesc",
    header: "Long Description",
    mandatory: false,
    format: "Up to 200 chars",
    rules: "Optional. Up to 200 characters. Plain text only.",
    example: "Filtered for clarity, suitable for high-temperature cooking.",
    fieldCategory: 1,
  },

  // --- Quantity & Inventory ---
  {
    key: "measureUnit",
    header: "Measure Unit",
    mandatory: true,
    format: "Dropdown",
    rules: "Required. Pick the SKU's measurement unit from the dropdown.",
    options: MEASURE_UNITS,
    example: "Liter",
    fieldCategory: 1,
  },
  // Free-text companion to Measure Unit. Captures the pack size value
  // (e.g. "1.5" for a 1.5 L bottle); kept free-text because volume
  // SKUs can carry fractional values like 0.5 L that a whole-number
  // rule would reject.
  {
    key: "unitValue",
    header: "Unit value",
    mandatory: true,
    format: "Free text",
    rules: "Required. The pack size value paired with Measure Unit (e.g. 1.5 for a 1.5 L bottle).",
    example: "1.5",
    fieldCategory: 1,
  },
  // Weight Measure + SKU Weight drive the auto-calculated Weight in KG.
  // Restricted to Gram / Kilogram because the kg conversion is exact
  // and the seller's actual physical weight only rolls up that way.
  {
    key: "weightMeasure",
    header: "Weight Measure",
    mandatory: true,
    format: "Dropdown",
    rules: "Required. Pick the unit for SKU Weight — Gram or Kilogram.",
    options: WEIGHT_MEASURES,
    example: "Kilogram",
    fieldCategory: 1,
  },
  {
    key: "measureValue",
    header: "SKU Weight",
    mandatory: true,
    format: "Positive number > 0",
    rules: "Required. Positive number (decimals allowed). Paired with Weight Measure (e.g. 15 + Kilogram = 15 kg).",
    example: "15",
    fieldCategory: 1,
  },
  {
    key: "skuWeight",
    header: "Weight in KG",
    mandatory: false,
    format: "Auto-calculated (kg)",
    rules: "Auto-calculated from Weight Measure × SKU Weight. Do not fill — the importer computes this value.",
    example: "15",
    computed: true,
    fieldCategory: 1,
  },
  {
    key: "unitizedCount",
    header: "Pack Size",
    mandatory: false,
    format: "Whole number ≥ 1",
    rules: "Optional. Positive whole number when filled.",
    example: "1",
    fieldCategory: 1,
  },
  // Package Type + Package Type Value go side-by-side so the seller
  // can describe the physical container (Pouch, Bottle, Jar, …) and
  // the numeric count for it (e.g. Bottle × 12) in one shot.
  {
    key: "packageType",
    header: "Package Type",
    mandatory: false,
    format: "Dropdown",
    rules:
      "Optional. Pick the physical container the SKU ships in (Pouch, Bottle, Tin, etc.).",
    options: PACKAGE_TYPES,
    example: "Bottle",
    fieldCategory: 1,
  },
  {
    key: "packageTypeValue",
    header: "Package Type Value",
    mandatory: false,
    format: "Positive number",
    rules:
      "Optional. Numeric value paired with Package Type (e.g. 12 for a 12-bottle case). Decimals allowed.",
    example: "12",
    fieldCategory: 1,
  },
  {
    key: "upc",
    header: "UPC",
    mandatory: false,
    format: "Numeric",
    rules: "Optional. Numeric value.",
    example: "8901234567890",
    fieldCategory: 1,
  },
  {
    key: "productCode",
    header: "Product Code",
    mandatory: false,
    format: "Letters/digits/-/_",
    rules: "Optional. External product / EAN code assigned by the manufacturer. Alphanumeric, hyphens and underscores allowed.",
    example: "ITC-SUNF-001",
    fieldCategory: 1,
  },
  {
    key: "productLength",
    header: "Length",
    mandatory: false,
    format: "Positive number (cm)",
    rules: "Optional. Product length in centimetres. Positive number, decimals allowed. Used together with Width and Height to auto-calculate Volumetric Weight.",
    example: "32",
    fieldCategory: 1,
  },
  {
    key: "productWidth",
    header: "Width",
    mandatory: false,
    format: "Positive number (cm)",
    rules: "Optional. Product width in centimetres. Positive number, decimals allowed.",
    example: "20",
    fieldCategory: 1,
  },
  {
    key: "productHeight",
    header: "Height",
    mandatory: false,
    format: "Positive number (cm)",
    rules: "Optional. Product height in centimetres. Positive number, decimals allowed.",
    example: "10",
    fieldCategory: 1,
  },
  {
    key: "volumetricWeight",
    header: "Volumetric Weight",
    mandatory: false,
    format: "Auto-calculated (kg)",
    rules: "Auto-calculated from Length × Width × Height ÷ 5000. Do not fill — the importer computes this from the three dimension columns.",
    example: "1.28",
    computed: true,
    fieldCategory: 1,
  },
  {
    key: "productImages",
    header: "Product Images",
    mandatory: false,
    format: "Comma-separated image URLs",
    rules: "Optional. One or more publicly accessible image URLs, comma-separated. First URL becomes the primary display image.",
    example: "https://cdn.example.com/sku-front.jpg,https://cdn.example.com/sku-back.jpg",
    fieldCategory: 1,
  },
  {
    key: "minimumOrderQty",
    header: "Min Order Quantity",
    mandatory: true,
    format: "Whole number ≥ 1",
    rules: "Required. Positive whole number. Cannot be greater than Max Order Quantity.",
    example: "1",
    fieldCategory: 2,
  },
  {
    key: "maximumOrderQty",
    header: "Max Order Quantity",
    mandatory: true,
    format: "Whole number ≥ 1",
    rules: "Required. Positive whole number. Cannot be less than Min Order Quantity.",
    example: "100",
    fieldCategory: 2,
  },

  // --- Category ---
  // Fulfillment and Location were removed from the bulk-import flow —
  // they're managed centrally per seller rather than per SKU and were
  // forcing every import row to repeat the same value.
  {
    key: "categoryId",
    header: "Category",
    mandatory: true,
    format: "Dropdown",
    rules: "Required. Pick a category from the admin-managed list.",
    options: CATEGORY_OPTIONS,
    example: "Cooking Oils & Ghee",
    fieldCategory: 1,
  },

  // --- ONDC attributes ---
  {
    key: "returnable",
    header: "Returnable",
    mandatory: true,
    format: "Yes / No",
    rules: "Required. Phase 1 default: No.",
    options: YES_NO,
    example: "No",
    fieldCategory: 2,
  },
  {
    key: "cancellable",
    header: "Cancellable",
    mandatory: true,
    format: "Yes / No",
    rules: "Required. Phase 1 default: No.",
    options: YES_NO,
    example: "No",
    fieldCategory: 2,
  },
  {
    key: "availableOnCod",
    header: "Available on COD",
    mandatory: true,
    format: "Yes / No",
    rules: "Required. Phase 1 default: Yes.",
    options: YES_NO,
    example: "Yes",
    fieldCategory: 2,
  },
  {
    key: "timeToShip",
    header: "Time to Ship",
    mandatory: true,
    format: "Dropdown",
    rules: "Required. Pick the dispatch window.",
    options: TIME_TO_SHIP,
    example: "24 hours",
    fieldCategory: 2,
  },

  // --- Customer Care ---
  {
    key: "consumerCareContactName",
    header: "Customer Care Name",
    mandatory: true,
    format: "Letters only",
    rules: "Required. Alphabetical characters only.",
    example: "Customer Support",
    fieldCategory: 2,
  },
  {
    key: "consumerCareContactEmail",
    header: "Customer Care Email",
    mandatory: true,
    format: "Valid email",
    rules: "Required. Valid email address (name@domain.tld).",
    example: "support@example.com",
    fieldCategory: 2,
  },
  {
    key: "consumerCareContactPhone",
    header: "Customer Care Phone",
    mandatory: true,
    format: "10 digits",
    rules: "Required. Exactly 10 digits, numeric only.",
    example: "9876543210",
    fieldCategory: 2,
  },

  // --- Manufacturer ---
  {
    key: "manufacturerName",
    header: "Manufacturer",
    mandatory: true,
    format: "Linked company",
    rules: "Required. Must match a company linked to your seller account (see Manage Seller → Companies & Brands).",
    example: "ITC Limited",
    fieldCategory: 1,
  },
  {
    key: "brandAttribute",
    header: "Brand",
    mandatory: true,
    format: "Linked brand",
    rules: "Required. Must be a brand under the selected Manufacturer.",
    example: "Aashirvaad",
    fieldCategory: 1,
  },
  {
    key: "manufacturerAddress",
    header: "Manufacturer Address",
    mandatory: false,
    format: "10–250 chars",
    rules: "Optional. 10 to 250 characters when filled. Should include a 6-digit PIN.",
    example: "Plot 14, MIDC, Mumbai 400072",
    fieldCategory: 2,
  },
  {
    key: "countryOfOrigin",
    header: "Country of Origin",
    mandatory: true,
    format: "Dropdown",
    rules: "Required. Default: India.",
    options: COUNTRIES,
    example: "India",
    fieldCategory: 1,
  },

  // --- Status ---
  {
    key: "itemStatus",
    header: "Status",
    mandatory: true,
    format: "Dropdown",
    rules: "Required. Active SKUs are visible to buyers; Inactive SKUs are hidden.",
    options: ITEM_STATUS,
    example: "Active",
    fieldCategory: 2,
  },

  // --- Selling Unit ---
  // Comma-separated list of positive whole numbers describing the
  // pack sizes (in pieces) buyers can order the SKU in. Example:
  // "1,16,96" → buyer can order singles, an inner pack of 16, or a
  // case of 96. Optional. Each value must be a positive integer; no
  // duplicates within the same row.
  {
    key: "sellingUnits",
    header: "Selling Unit",
    mandatory: false,
    format: "Comma-separated positive whole numbers",
    rules:
      "Optional. Comma-separated list of positive whole numbers (e.g. 1,23,122). Each value must be ≥ 1. Duplicates within the same row are not allowed.",
    example: "1,16,96",
    fieldCategory: 2,
  },

  // --- Tax ---
  {
    key: "hsnCode",
    header: "HSN Code",
    mandatory: false,
    format: "8-digit code",
    rules: "Optional. 8-digit Harmonised System Nomenclature code for this product.",
    example: "15121900",
    fieldCategory: 1,
  },
  {
    key: "gstTax",
    header: "GST Tax %",
    mandatory: false,
    format: "Dropdown",
    rules: "Optional. GST slab applicable on this product.",
    options: ["0%", "3%", "5%", "12%", "18%", "28%"],
    example: "18%",
    fieldCategory: 1,
  },
  {
    key: "gstCess",
    header: "GST Cess %",
    mandatory: false,
    format: "Dropdown",
    rules: "Optional. Additional cess on top of GST, if applicable.",
    options: ["0%", "1%", "3%", "5%", "12%", "22%"],
    example: "0%",
    fieldCategory: 1,
  },
];

/**
 * Subset of SKU_FIELDS containing only Field Category 1 —
 * fields managed by the Product Store / Catalog Admin.
 * Used for the Catalog Admin and Brand Manager bulk import template.
 */
export const CATALOG_SKU_FIELDS: SkuFieldDef[] = SKU_FIELDS.filter(
  (f) => f.fieldCategory === 1,
);

/** Convert a 0-based column index to its Excel letter (A, B, …, AA, AB). */
const colToLetter = (idx: number): string => {
  let n = idx;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
};

/** Escape a sheet name for cross-sheet formula references (single
 *  quotes around any name with whitespace, doubled apostrophes). */
const escapeSheetName = (name: string) =>
  /[^A-Za-z0-9_]/.test(name)
    ? `'${name.replace(/'/g, "''")}'`
    : name;

/**
 * Build the .xlsx workbook (3 sheets) and trigger a download.
 *
 * Why ExcelJS instead of SheetJS for writing? SheetJS Community
 * doesn't persist data validations on write — they're a Pro feature.
 * That meant the dropdowns we configured never made it into the
 * downloaded file. ExcelJS is open-source and writes proper
 * <dataValidations> XML, so the user actually sees the dropdown
 * arrows in Excel / Google Sheets / LibreOffice.
 *
 * SheetJS still owns the parser side because its sheet_to_json and
 * cell-resolution logic is best-in-class.
 */
export const downloadSkuTemplate = async (
  prefillRows?: ParsedSkuRow[],
  fields?: SkuFieldDef[],
) => {
  const activeFields = fields ?? SKU_FIELDS;
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Qwipo Seller Store";
  wb.created = new Date();

  const HEADER_FILL: ExcelJSType.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" }, // blue-800
  };
  const HEADER_FONT: Partial<ExcelJSType.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
  };
  const HELPER_FILL: ExcelJSType.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6FF" }, // blue-50
  };
  const HELPER_FONT: Partial<ExcelJSType.Font> = {
    italic: true,
    color: { argb: "FF1E3A8A" }, // blue-900
    size: 10,
  };
  const BORDER: ExcelJSType.Border = { style: "thin", color: { argb: "FFCBD5E1" } };
  const ALL_BORDERS: Partial<ExcelJSType.Borders> = {
    top: BORDER,
    left: BORDER,
    right: BORDER,
    bottom: BORDER,
  };

  // ---------- Sheet 3 — Master Data (built first so the Main sheet
  //            can reference it via named ranges). ----------
  const masterSheet = wb.addWorksheet("Master Data");
  const masterColumns: { label: string; values: string[]; key: string }[] = [];
  const seenLabels = new Set<string>();
  activeFields.forEach((f) => {
    if (!f.options || seenLabels.has(f.header)) return;
    masterColumns.push({ label: f.header, values: f.options, key: f.key });
    seenLabels.add(f.header);
  });
  // Header row.
  masterSheet.addRow(masterColumns.map((c) => c.label));
  const maxRows = Math.max(...masterColumns.map((c) => c.values.length));
  for (let r = 0; r < maxRows; r++) {
    masterSheet.addRow(masterColumns.map((c) => c.values[r] ?? ""));
  }
  // Style the master header row + freeze it.
  const masterHeaderRow = masterSheet.getRow(1);
  masterHeaderRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = ALL_BORDERS;
  });
  masterHeaderRow.height = 22;
  masterSheet.views = [{ state: "frozen", ySplit: 1 }];
  masterColumns.forEach((c, idx) => {
    masterSheet.getColumn(idx + 1).width = Math.max(
      c.label.length + 4,
      ...c.values.map((v) => v.length + 4),
    );
  });

  // Define a workbook-level named range for every option column on the
  // Master sheet. Cell dropdowns on the Main sheet point at these
  // names — that way if the user reorders columns later the formulas
  // stay valid.
  const namedRanges = new Map<string, string>();
  masterColumns.forEach((c, idx) => {
    const colLetter = colToLetter(idx);
    const range = `${escapeSheetName("Master Data")}!$${colLetter}$2:$${colLetter}$${c.values.length + 1}`;
    const name = `MASTER_${c.key.toUpperCase()}`;
    wb.definedNames.add(range, name);
    namedRanges.set(c.key, name);
  });

  // ---------- Sheet 1 — Main SKU Upload ----------
  const main = wb.addWorksheet("Main SKU Upload");
  // Row 1 = headers (mandatory carry a trailing *).
  main.addRow(activeFields.map((f) => f.header + (f.mandatory ? " *" : "")));
  // Row 2 = frozen helper row with Mandatory/Optional + format.
  // Computed columns get the "Auto-calculated" tag so reviewers
  // know not to type a value there.
  main.addRow(
    activeFields.map((f) =>
      f.computed
        ? `Auto-calculated · ${f.format}`
        : `${f.mandatory ? "Mandatory" : "Optional"} · ${f.format}`,
    ),
  );

  // Style header row.
  const headerRow = main.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell, col) => {
    const f = activeFields[col - 1];
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = ALL_BORDERS;
    if (f && f.mandatory) {
      cell.font = { ...HEADER_FONT };
    }
  });

  // Style helper row.
  const helperRow = main.getRow(2);
  helperRow.height = 20;
  helperRow.eachCell((cell) => {
    cell.font = HELPER_FONT;
    cell.fill = HELPER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = ALL_BORDERS;
  });

  // Column widths.
  activeFields.forEach((f, idx) => {
    main.getColumn(idx + 1).width = Math.max(
      20,
      f.header.length + 4,
      f.format.length + 4,
    );
  });

  // Freeze header + helper row.
  main.views = [{ state: "frozen", ySplit: 2 }];

  // Cell-level data validation. ExcelJS persists these properly so
  // Excel renders a dropdown arrow on every option-bearing column.
  // For long lists (categories) we point at a named range on the
  // Master sheet — Excel rejects inline lists over 255 chars.
  const FIRST_DATA_ROW = 3;
  const LAST_DATA_ROW = 1000;
  activeFields.forEach((f, idx) => {
    if (!f.options || f.options.length === 0) return;
    const colLetter = colToLetter(idx);
    // Use a named range when present, otherwise inline literal list.
    const inlineList = `"${f.options
      .map((o) => o.replace(/"/g, '""'))
      .join(",")}"`;
    const namedRangeName = namedRanges.get(f.key);
    const formula =
      namedRangeName && inlineList.length > 250
        ? `=${namedRangeName}`
        : inlineList;
    for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
      main.getCell(`${colLetter}${r}`).dataValidation = {
        type: "list",
        allowBlank: !f.mandatory,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Invalid value",
        error: `Pick one of: ${f.options.slice(0, 6).join(", ")}${f.options.length > 6 ? ", …" : ""}.`,
      };
    }
  });

  // Computed columns (currently just Weight in KG) get a grey fill +
  // italic helper text so the seller can see at a glance not to
  // fill them. Cell-level data validation rejects any typed value
  // with the explanatory message — the importer ignores whatever
  // shows up here regardless, but the picker feedback is friendlier
  // than a silent overwrite.
  const COMPUTED_FILL: ExcelJSType.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" }, // slate-100
  };
  const COMPUTED_FONT: Partial<ExcelJSType.Font> = {
    italic: true,
    color: { argb: "FF64748B" }, // slate-500
    size: 10,
  };
  activeFields.forEach((f, idx) => {
    if (!f.computed) return;
    const colLetter = colToLetter(idx);
    for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
      const cell = main.getCell(`${colLetter}${r}`);
      cell.fill = COMPUTED_FILL;
      cell.font = COMPUTED_FONT;
      cell.dataValidation = {
        type: "custom",
        allowBlank: true,
        formulae: ["FALSE"],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Auto-calculated",
        error:
          "This column is auto-calculated by the importer from Measure Unit × SKU Weight. Anything you type here is ignored on upload.",
      };
    }
  });

  // ---------- Sheet 2 — Validation ----------
  const validation = wb.addWorksheet("Validation");
  validation.addRow([
    "Field",
    "Mandatory / Optional",
    "Format",
    "Validation Rules",
    "Example",
  ]);
  activeFields.forEach((f) => {
    validation.addRow([
      f.header,
      f.mandatory ? "Mandatory" : "Optional",
      f.format,
      f.rules,
      f.example ?? "",
    ]);
  });
  validation.getColumn(1).width = 28;
  validation.getColumn(2).width = 22;
  validation.getColumn(3).width = 22;
  validation.getColumn(4).width = 64;
  validation.getColumn(5).width = 36;
  const valHeaderRow = validation.getRow(1);
  valHeaderRow.height = 22;
  valHeaderRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = ALL_BORDERS;
  });
  // Wrap text in the Rules column.
  for (let r = 2; r <= validation.rowCount; r++) {
    validation.getCell(r, 4).alignment = { wrapText: true, vertical: "top" };
  }
  validation.views = [{ state: "frozen", ySplit: 1 }];

  // Pre-fill example rows when provided (e.g. Product Store lookup template).
  if (prefillRows && prefillRows.length > 0) {
    const PRE_FILL: ExcelJSType.FillPattern = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0FDF4" }, // green-50
    };
    prefillRows.forEach((row) => {
      const values = activeFields.map((f) => row[f.key] ?? "");
      const addedRow = main.addRow(values);
      addedRow.eachCell((cell) => {
        cell.fill = PRE_FILL;
      });
    });
  }

  // Reorder sheets so the user lands on Main SKU Upload first when
  // they open the workbook.
  wb.eachSheet((sheet) => {
    if (sheet.name !== "Main SKU Upload") return;
    sheet.orderNo = 0;
  });

  // ---------- Trigger download ----------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "SKU_Import_Template.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Parsed SKU row, keyed by SkuFieldDef.key. */
export type ParsedSkuRow = Record<string, string>;

export interface ParseFileResult {
  /** Header row from the Main sheet (without trailing `*`). */
  headers: string[];
  /** Data rows starting from row 3 (after header + helper). */
  rows: ParsedSkuRow[];
  /** True when the file is missing the Main sheet or required headers. */
  fatalError?: string;
}

/**
 * Lightweight CSV parser. We only use this on the read path for
 * plain-text CSV uploads — ExcelJS' CSV reader is Node-stream-based
 * and doesn't run cleanly in the browser. The grammar handles the
 * common dialect: comma separator, double-quote quoting with `""`
 * escape, and \r / \n / \r\n line endings.
 */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-blank rows so blank gaps in the file don't show up
  // as ghost data rows downstream.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Coerce an ExcelJS cell value to its display string, mirroring
 * SheetJS' `raw: false` behaviour. Handles plain strings/numbers,
 * formula cells (the cached `result`), rich-text cells, dates, and
 * hyperlinks. Falls back to `String(value)` for anything exotic.
 */
function cellToString(value: ExcelJSType.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    // ISO format matches what users typically expect when they pull
    // a date out of Excel as text.
    return value.toISOString().slice(0, 10);
  }
  const v = value as Record<string, unknown>;
  if ("text" in v && typeof v.text === "string") return v.text;
  if ("richText" in v && Array.isArray(v.richText)) {
    return (v.richText as Array<{ text: string }>)
      .map((r) => r.text ?? "")
      .join("");
  }
  if ("result" in v) {
    const r = v.result;
    if (r === null || r === undefined) return "";
    if (typeof r === "string" || typeof r === "number" || typeof r === "boolean") {
      return String(r);
    }
    return cellToString(r as ExcelJSType.CellValue);
  }
  if ("hyperlink" in v && typeof v.hyperlink === "string") {
    return ("text" in v && typeof v.text === "string" ? v.text : v.hyperlink) as string;
  }
  return String(value);
}

/** Parse an uploaded .xlsx / .csv file using ExcelJS (plus an
 *  inline CSV reader for plain-text uploads). */
export const parseSkuImportFile = async (
  file: File,
): Promise<ParseFileResult> => {
  const buffer = await file.arrayBuffer();
  let aoa: string[][] = [];

  // CSV path — text-decode and parse inline. ExcelJS' CSV reader is
  // Node-stream-based and doesn't run cleanly in the browser, and
  // CSV grammar is simple enough to roll ourselves.
  if (/\.csv$/i.test(file.name)) {
    const text = new TextDecoder("utf-8").decode(buffer);
    aoa = parseCsvText(text);
  } else {
    // XLSX path — defer-load ExcelJS so the heavy dependency stays
    // out of the main bundle for users who never bulk-import.
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer);
    } catch {
      return {
        headers: [],
        rows: [],
        fatalError:
          "Couldn't read the file. Make sure it's a valid .xlsx export.",
      };
    }
    if (wb.worksheets.length === 0) {
      return { headers: [], rows: [], fatalError: "File has no sheets." };
    }

    // Prefer the "Main SKU Upload" sheet when present (xlsx
    // template); fall back to the first sheet otherwise.
    const sheet =
      wb.worksheets.find((w) =>
        /main\s*sku\s*upload/i.test(w.name),
      ) ?? wb.worksheets[0];

    // Walk the sheet and emit a tidy array-of-arrays. ExcelJS rows
    // are 1-indexed and row.values has an empty slot at index 0; we
    // slice that off when we materialise each row.
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as ExcelJSType.CellValue[];
      const maxCol = Math.max(values.length - 1, 0);
      const cells: string[] = [];
      for (let c = 1; c <= maxCol; c++) {
        cells.push(cellToString(row.getCell(c).value).trim());
      }
      // Drop fully-blank rows — mirrors SheetJS' `blankrows: false`.
      if (cells.some((c) => c !== "")) aoa.push(cells);
    });
  }

  if (aoa.length === 0) {
    return { headers: [], rows: [], fatalError: "Sheet is empty." };
  }

  const rawHeaders = aoa[0].map((h) => String(h).replace(/\*+\s*$/, "").trim());

  // Detect helper row vs data row. If row index 1 starts with
  // "Mandatory" / "Optional" we treat it as the helper row and skip it.
  const looksLikeHelper = (cells: string[]) =>
    cells.length > 0 && /^(mandatory|optional)\b/i.test((cells[0] ?? "").trim());
  const dataStart = aoa[1] && looksLikeHelper(aoa[1]) ? 2 : 1;
  const dataRows = aoa.slice(dataStart);

  // Map header → SkuFieldDef.key. We try exact header match first, then
  // a relaxed match (lowercase, strip non-alphanumerics) so users can
  // bring legacy CSVs without the template.
  //
  // Two-pass insertion so that user-facing headers always win on a
  // collision. Without this, normalize("SKU Weight") (the header for
  // the measureValue field) and normalize("skuWeight") (the key of the
  // computed Weight in KG field) both produce "skuweight" — and a
  // single-pass loop lets the later-defined key entry shadow the
  // earlier header entry, routing CSV "SKU Weight" columns into the
  // wrong field. Headers reflect what the seller actually typed in the
  // file, so they take precedence.
  const headerToKey = new Map<string, string>();
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  SKU_FIELDS.forEach((f) => {
    headerToKey.set(normalize(f.key), f.key);
  });
  SKU_FIELDS.forEach((f) => {
    headerToKey.set(normalize(f.header), f.key);
  });
  // Also accept some legacy aliases — keeps older exported templates
  // and hand-edited CSVs parseable. Removed columns (Fulfillment /
  // Location) intentionally have no alias because we want those values
  // to disappear silently rather than re-enter the payload.
  headerToKey.set(normalize("Item Code"), "skuCode");
  headerToKey.set(normalize("Item Name"), "skuName");
  headerToKey.set(normalize("Name"), "skuName");
  headerToKey.set(normalize("SKU Weight (kg)"), "skuWeight");

  const colKey: (string | undefined)[] = rawHeaders.map((h) =>
    headerToKey.get(normalize(h)),
  );

  const rows: ParsedSkuRow[] = dataRows
    .filter((r) => r.some((c) => String(c).trim() !== ""))
    .map((cols) => {
      const row: ParsedSkuRow = {};
      cols.forEach((cell, i) => {
        const key = colKey[i];
        if (!key) return;
        row[key] = String(cell ?? "").trim();
      });
      // Auto-fill every computed column from its source fields so
      // downstream validators see the system value rather than
      // whatever the seller may have typed by accident.
      //   skuWeight ← measureToKg(weightMeasure, measureValue)
      // The kg conversion is driven by Weight Measure × SKU Weight —
      // Measure Unit is intentionally NOT used here because the latest
      // spec gave the physical weight its own dedicated dropdown.
      SKU_FIELDS.forEach((f) => {
        if (!f.computed) return;
        if (f.key === "skuWeight") {
          const numericValue = parseFloat(row.measureValue ?? "");
          const kg = measureToKg(row.weightMeasure, numericValue);
          row.skuWeight = kg === null ? "" : String(kg);
        }
        if (f.key === "volumetricWeight") {
          const l = parseFloat(row.productLength ?? "");
          const w = parseFloat(row.productWidth ?? "");
          const h = parseFloat(row.productHeight ?? "");
          if (Number.isFinite(l) && Number.isFinite(w) && Number.isFinite(h)) {
            row.volumetricWeight = String(Math.round((l * w * h / 5000) * 1000) / 1000);
          } else {
            row.volumetricWeight = "";
          }
        }
      });
      return row;
    });

  return { headers: rawHeaders, rows };
};
