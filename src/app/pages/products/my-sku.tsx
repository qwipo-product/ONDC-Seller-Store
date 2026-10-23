import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { MultiSelect } from "../../components/ui/multi-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Search,
  Eye,
  Filter,
  X,
  Database,
  CheckCircle2,
  Plus,
  Download,
  Send,
  FileText,
  Building2,
  Tag,
  Package,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { PackageSearch } from "lucide-react";
import { isEmptyMode } from "../../lib/data-mode";
import { getMySkus } from "../../lib/my-sku-store";
import { EmptyState } from "../../components/empty-state";
import { CopyOnHover } from "../../components/copy-on-hover";
import { ListPagination } from "../../components/ui/list-pagination";
import {
  BulkImportDialog,
  type BulkImportValidationResult,
  type BulkImportError as BulkImportErrorRow,
} from "../../components/bulk-import-dialog";
import {
  SkuFormFields,
  type SkuFormState,
  emptySkuForm,
} from "../../components/sku-form-fields";
import { addPsRequest } from "../../lib/product-store-data";
import { addSkuRequest } from "../../lib/sku-request-store";
import { sampleSKUs, type SKUData } from "../../lib/my-sku-data";
export type { SKUData } from "../../lib/my-sku-data";
export { sampleSKUs } from "../../lib/my-sku-data";


export function MySKU() {
  const navigate = useNavigate();
  const [skus, setSkus] = useState<SKUData[]>(() =>
    isEmptyMode() ? [] : getMySkus(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const [isPriceStockBulkOpen, setIsPriceStockBulkOpen] = useState(false);

  // Request dialogs
  const [showCompanyRequestDialog, setShowCompanyRequestDialog] = useState(false);
  const [companyReqName, setCompanyReqName] = useState("");
  const [companyReqMessage, setCompanyReqMessage] = useState("");
  const [showBrandRequestDialog, setShowBrandRequestDialog] = useState(false);
  const [brandReqName, setBrandReqName] = useState("");
  const [brandReqMessage, setBrandReqMessage] = useState("");
  const [brandReqCompanyName, setBrandReqCompanyName] = useState("");
  const [showSkuRequestDialog, setShowSkuRequestDialog] = useState(false);
  const [skuReqForm, setSkuReqForm] = useState<SkuFormState>(emptySkuForm);
  const [skuReqImages, setSkuReqImages] = useState<string[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [ondcFilter, setOndcFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Get unique values for filters
  const uniqueCategories = Array.from(new Set(skus.map((s) => s.category))).sort();
  const uniqueBrands = Array.from(new Set(skus.map((s) => s.brand))).sort();

  // Filtered SKUs
  const filteredSKUs = skus.filter((sku) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      sku.name.toLowerCase().includes(q) ||
      sku.sku.toLowerCase().includes(q) ||
      sku.brand.toLowerCase().includes(q) ||
      (sku.shortName ? sku.shortName.toLowerCase().includes(q) : false);

    const matchesStatus = statusFilter === "all" || sku.status === statusFilter;
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(sku.category);
    const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(sku.brand);
    const matchesOndc =
      ondcFilter === "all" ||
      (ondcFilter === "compliant" && sku.ondcCompliance.isCompliant) ||
      (ondcFilter === "non-compliant" && !sku.ondcCompliance.isCompliant);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesCategory &&
      matchesBrand &&
      matchesOndc
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredSKUs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSKUs = filteredSKUs.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleViewDetails = (sku: SKUData) => {
    navigate(`/products/sku-detail/${sku.id}`);
  };

  const handleEditSKU = (sku: SKUData) => {
    navigate(`/products/my-sku/edit/${sku.id}`);
  };

  const clearAllFilters = () => {
    setStatusFilter("all");
    setSelectedCategories([]);
    setSelectedBrands([]);
    setOndcFilter("all");
    setCurrentPage(1);
    toast.success("All filters cleared");
  };

  // ---- Request handlers ----
  const openCompanyRequestDialog = () => {
    setCompanyReqName("");
    setCompanyReqMessage("");
    setShowCompanyRequestDialog(true);
  };
  const handleSubmitCompanyRequest = () => {
    const req = addPsRequest({
      type: "request_company",
      skuName: "—",
      brandId: "",
      brandName: "—",
      companyName: companyReqName.trim(),
      requestedBy: "You (Seller)",
      requestedByType: "seller",
      notes: companyReqMessage.trim() || undefined,
    });
    toast.success(`Company request ${req.id} submitted. Track it in My Requests.`, { duration: 4000 });
    setShowCompanyRequestDialog(false);
  };
  const openBrandRequestDialog = () => {
    setBrandReqName("");
    setBrandReqMessage("");
    setBrandReqCompanyName("");
    setShowBrandRequestDialog(true);
  };
  const handleSubmitBrandRequest = () => {
    const req = addPsRequest({
      type: "request_brand",
      skuName: "—",
      brandId: "",
      brandName: brandReqName.trim(),
      companyName: brandReqCompanyName.trim() || "—",
      requestedBy: "You (Seller)",
      requestedByType: "seller",
      notes: brandReqMessage.trim() || undefined,
    });
    toast.success(`Brand request ${req.id} submitted. Track it in My Requests.`, { duration: 4000 });
    setShowBrandRequestDialog(false);
  };
  const openSkuRequestDialog = () => {
    setSkuReqForm(emptySkuForm);
    setSkuReqImages([]);
    setShowSkuRequestDialog(true);
  };
  const onSkuReqChange = (key: keyof SkuFormState, value: string) =>
    setSkuReqForm((prev) => ({ ...prev, [key]: value }));
  const isSkuReqValid =
    skuReqForm.itemName.trim() !== "" &&
    skuReqForm.shortName.trim() !== "" &&
    skuReqForm.groupName.trim() !== "" &&
    (skuReqForm.brandId !== "" || skuReqForm.brandOther.trim() !== "") &&
    skuReqForm.brandAttribute.trim() !== "" &&
    skuReqForm.shortDesc.trim() !== "" &&
    skuReqForm.longDesc.trim() !== "" &&
    skuReqForm.measureUnit !== "" &&
    skuReqForm.measureValue.trim() !== "" &&
    skuReqForm.weightMeasure !== "" &&
    skuReqForm.skuWeight.trim() !== "" &&
    skuReqForm.unitizedCount.trim() !== "" &&
    skuReqForm.packageType.trim() !== "" &&
    skuReqForm.packageTypeValue.trim() !== "" &&
    skuReqForm.categoryId !== "" &&
    skuReqForm.hsnCode.trim() !== "" &&
    skuReqForm.countryOfOrigin.trim() !== "" &&
    skuReqForm.gstTax !== "" &&
    skuReqForm.manufacturerName.trim() !== "";
  const handleSubmitSkuRequest = () => {
    if (!isSkuReqValid) return;
    const req = addSkuRequest({
      itemName: skuReqForm.itemName,
      shortName: skuReqForm.shortName,
      groupName: skuReqForm.groupName,
      brandId: skuReqForm.brandId,
      brandOther: skuReqForm.brandOther,
      brandAttribute: skuReqForm.brandAttribute,
      shortDesc: skuReqForm.shortDesc,
      longDesc: skuReqForm.longDesc,
      measureUnit: skuReqForm.measureUnit,
      measureValue: skuReqForm.measureValue,
      weightMeasure: skuReqForm.weightMeasure,
      skuWeight: skuReqForm.skuWeight,
      unitizedCount: skuReqForm.unitizedCount,
      upc: skuReqForm.upc,
      packageType: skuReqForm.packageType,
      packageTypeValue: skuReqForm.packageTypeValue,
      productLength: skuReqForm.productLength,
      productWidth: skuReqForm.productWidth,
      productHeight: skuReqForm.productHeight,
      categoryId: skuReqForm.categoryId,
      hsnCode: skuReqForm.hsnCode,
      countryOfOrigin: skuReqForm.countryOfOrigin,
      gstTax: skuReqForm.gstTax,
      gstCess: skuReqForm.gstCess,
      manufacturerName: skuReqForm.manufacturerName,
      notes: skuReqForm.notes,
    });
    toast.success(`Request ${req.id} submitted. Track it in My Requests.`, { duration: 4000 });
    setShowSkuRequestDialog(false);
    setSkuReqForm(emptySkuForm);
    setSkuReqImages([]);
  };

  // Plain CSV parser for validatePriceStockFile. Handles quoted
  // fields with embedded commas and escaped quotes.
  const parseCsv = (t: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (inQuotes) {
        if (c === '"' && t[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ',') { row.push(field); field = ""; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && t[i + 1] === '\n') i++;
          row.push(field); rows.push(row); row = []; field = "";
        } else { field += c; }
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  };

  const readFileText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(String(ev.target?.result || ""));
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsText(file);
    });

  // ---- Price & Stock update (Story 19128) ----
  // The seller downloads a sheet pre-filled with their existing catalog
  // (every SKU + its current MRP / Selling Price / Available Stock /
  // Infinite Stock), edits only those four columns offline, and
  // re-uploads. Rows are matched by SKU Code; unknown codes are
  // REJECTED (not silently skipped — the story is explicit on that).
  // Unchanged rows are skipped silently. The cap is 500 rows per
  // upload. Apply is atomic — either every valid row's update saves
  // or none.

  /** Columns on the downloaded template — read-only identifier columns
   *  first, then the three editable columns. The header is locked by
   *  spec; the validator below rejects files with a different header.
   *  Available Stock is a Yes/No availability flag (the earlier numeric
   *  Available Stock + separate Infinite Stock column have been merged
   *  into a single Yes/No availability toggle). */
  const PS_TEMPLATE_HEADERS = [
    "SKU Code",
    "SKU Name",
    "Brand",
    "Category",
    "MRP",
    "Selling Price",
    "Available Stock",
  ] as const;

  /** Max number of data rows in one upload (BR-8 of the story). */
  const PS_MAX_ROWS = 500;

  /** Derive the current Yes/No availability of an existing SKU. A SKU is
   *  available when it's flagged as infinite stock OR has at least one
   *  unit on hand. */
  const psCurrentAvailability = (s: SKUData): "Yes" | "No" =>
    s.isInfiniteStock || (s.availableStock ?? 0) > 0 ? "Yes" : "No";

  /** Build the per-row data for the Price & Stock template (every
   *  existing SKU in the seller's catalog with its current values).
   *  Both the CSV and XLSX paths share this. */
  const buildPsTemplateRows = () =>
    skus.map((s) => [
      s.sku,
      s.name,
      s.brand,
      s.category,
      s.mrp ?? "",
      s.sellingPrice ?? "",
      psCurrentAvailability(s),
    ]);

  const triggerBrowserDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPsAsCsv = () => {
    const toCell = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = buildPsTemplateRows();
    const csv = [
      PS_TEMPLATE_HEADERS.map(toCell).join(","),
      ...rows.map((r) => r.map(toCell).join(",")),
    ].join("\r\n");
    // UTF-8 BOM so Excel opens the file with the correct encoding for
    // Indian-language SKU names.
    triggerBrowserDownload(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
      "price_stock_update_template.csv",
    );
    return rows.length;
  };

  const downloadPsAsXlsx = async () => {
    // ExcelJS is a ~900 KB chunk — dynamic-imported to keep it off the initial bundle.
    const ExcelJS = (await import("exceljs")).default;
    const rows = buildPsTemplateRows();
    const wb = new ExcelJS.Workbook();
    wb.creator = "Qwipo Seller Store";
    wb.created = new Date();
    const ws = wb.addWorksheet("Price & Stock");
    ws.addRow([...PS_TEMPLATE_HEADERS]);
    rows.forEach((r) => ws.addRow(r));
    // Header styling — bold + blue background matches the Add SKU
    // template's chrome so the two downloads feel like siblings.
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "left" };
    headerRow.height = 22;
    // Column widths sized to the typical content. Tweak if SKU names
    // get longer.
    [16, 60, 18, 18, 12, 14, 18].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const buffer = await wb.xlsx.writeBuffer();
    triggerBrowserDownload(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "price_stock_update_template.xlsx",
    );
    return rows.length;
  };

  const handleDownloadPsSample = async (format?: string) => {
    // Default to CSV when the picker isn't enabled (legacy path).
    const chosen = format ?? "csv";
    try {
      const count =
        chosen === "xlsx" ? await downloadPsAsXlsx() : downloadPsAsCsv();
      toast.success(
        `Sheet downloaded with ${count} SKU${count === 1 ? "" : "s"} pre-filled.`,
      );
    } catch (err) {
      console.error("[my-sku] price/stock template download failed", err);
      toast.error("Couldn't generate the template. Please try again.");
    }
  };

  /** Payload handed off to importPriceStockRows — the validated price
   *  values + a Yes/No availability flag. Read-only columns (SKU Name,
   *  Brand, Category) are intentionally not carried over; the importer
   *  reads them from the existing catalog. */
  type PsValidatedRow = {
    skuCode: string;
    mrp: number;
    sellingPrice: number;
    availability: "Yes" | "No";
  };

  const validatePriceStockFile = async (
    file: File,
  ): Promise<BulkImportValidationResult> => {
    const text = await readFileText(file);
    const rows = parseCsv(text);

    // File-level checks — these short-circuit the row pass.
    if (rows.length === 0) {
      return {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [
          {
            row: 1,
            field: "File",
            error:
              "The file is empty. Please add SKU updates and re-upload.",
          },
        ],
        validData: [],
      };
    }
    const header = rows[0].map((h) => h.trim());
    const expected = [...PS_TEMPLATE_HEADERS];
    const headerMismatch =
      header.length !== expected.length ||
      header.some((h, i) => h !== expected[i]);
    if (headerMismatch) {
      return {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [
          {
            row: 1,
            field: "File",
            error:
              "This file doesn't match the template. Please download the latest sheet and try again.",
          },
        ],
        validData: [],
      };
    }
    const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
    if (dataRows.length === 0) {
      return {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [
          {
            row: 1,
            field: "File",
            error:
              "The file is empty. Please add SKU updates and re-upload.",
          },
        ],
        validData: [],
      };
    }
    if (dataRows.length > PS_MAX_ROWS) {
      return {
        totalRows: dataRows.length,
        validRows: 0,
        invalidRows: dataRows.length,
        errors: [
          {
            row: 1,
            field: "File",
            error: `This file has more than ${PS_MAX_ROWS} rows. Please split it into smaller files and upload again.`,
          },
        ],
        validData: [],
      };
    }

    // Index the catalog by SKU Code so the row pass is O(1) per row.
    const byCode = new Map(skus.map((s) => [s.sku, s]));

    const errors: BulkImportErrorRow[] = [];
    const validData: PsValidatedRow[] = [];
    let noChangeRows = 0;

    dataRows.forEach((cols, idx) => {
      const rowNumber = idx + 2; // header was row 1
      const skuCode = (cols[0] ?? "").trim();
      const skuName = (cols[1] ?? "").trim();
      const mrpRaw = (cols[4] ?? "").trim();
      const spRaw = (cols[5] ?? "").trim();
      const availabilityRaw = (cols[6] ?? "").trim();

      // VAL-2 — SKU Code must exist in the catalog.
      const existing = byCode.get(skuCode);
      if (!skuCode) {
        errors.push({
          row: rowNumber,
          field: "SKU Code",
          error: "SKU Code is required.",
          skuCode,
          skuName,
          value: skuCode,
        });
        return;
      }
      if (!existing) {
        errors.push({
          row: rowNumber,
          field: "SKU Code",
          error: "SKU Code not found in your catalog.",
          skuCode,
          skuName,
          value: skuCode,
        });
        return;
      }

      const rowErrors: BulkImportErrorRow[] = [];

      // VAL-3 — MRP > 0.
      const mrp = Number(mrpRaw);
      if (mrpRaw === "" || !Number.isFinite(mrp) || mrp <= 0) {
        rowErrors.push({
          row: rowNumber,
          field: "MRP",
          error: "MRP must be a number greater than zero.",
          skuCode,
          skuName,
          value: mrpRaw,
        });
      }

      // VAL-4 — Selling Price > 0 and ≤ MRP.
      const sp = Number(spRaw);
      if (spRaw === "" || !Number.isFinite(sp) || sp <= 0) {
        rowErrors.push({
          row: rowNumber,
          field: "Selling Price",
          error: "Selling Price must be a number greater than zero.",
          skuCode,
          skuName,
          value: spRaw,
        });
      } else if (Number.isFinite(mrp) && mrp > 0 && sp > mrp) {
        rowErrors.push({
          row: rowNumber,
          field: "Selling Price",
          error: "Selling Price cannot be greater than MRP.",
          skuCode,
          skuName,
          value: spRaw,
        });
      }

      // VAL-5 — Available Stock must be Yes or No (case-insensitive
      // after trim).
      let availability: "Yes" | "No" | null = null;
      const a = availabilityRaw.toLowerCase();
      if (a === "yes") availability = "Yes";
      else if (a === "no") availability = "No";
      else {
        rowErrors.push({
          row: rowNumber,
          field: "Available Stock",
          error: "Available Stock must be Yes or No.",
          skuCode,
          skuName,
          value: availabilityRaw,
        });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        return;
      }
      if (availability === null) return; // safety — caught above

      // VAL-9 — silent-skip unchanged rows.
      const unchanged =
        existing.mrp === mrp &&
        existing.sellingPrice === sp &&
        psCurrentAvailability(existing) === availability;
      if (unchanged) {
        noChangeRows += 1;
        return;
      }

      validData.push({
        skuCode,
        mrp,
        sellingPrice: sp,
        availability,
      });
    });

    const validRows = validData.length;
    const invalidRows = dataRows.length - validRows - noChangeRows;

    return {
      totalRows: dataRows.length,
      validRows,
      invalidRows,
      errors,
      validData,
    };
  };

  const importPriceStockRows = (rows: unknown[]) => {
    const valid = rows as PsValidatedRow[];
    if (valid.length === 0) return;
    const today = new Date().toISOString().split("T")[0];
    const byCode = new Map(valid.map((r) => [r.skuCode, r]));
    setSkus((prev) =>
      prev.map((s) => {
        const r = byCode.get(s.sku);
        if (!r) return s;
        // Available Stock = Yes → SKU is available (flag the record
        // as infinite stock so the storefront shows it as in stock).
        // Available Stock = No → SKU is out of stock (clear infinite
        // flag and zero out the count). Story 19128 BR-3: only the
        // price + availability fields change — every other field is
        // left untouched.
        const isYes = r.availability === "Yes";
        return {
          ...s,
          mrp: r.mrp,
          sellingPrice: r.sellingPrice,
          isInfiniteStock: isYes,
          availableStock: isYes ? (s.availableStock ?? 0) : 0,
          lastUpdated: today,
        };
      }),
    );
  };

  const getSourceBadge = (source: string) => {
    const badgeMap: Record<string, { color: string; icon?: React.ReactNode }> = {
      "Brand Sync": {
        color: "border-purple-300 text-purple-700 bg-purple-50",
        icon: <Database className="h-3 w-3 mr-1" />,
      },
      DMS: {
        color: "border-blue-300 text-blue-700 bg-blue-50",
        icon: <Database className="h-3 w-3 mr-1" />,
      },
      Manual: { color: "border-gray-300 text-gray-700 bg-gray-50" },
      "Excel Import": { color: "border-green-300 text-green-700 bg-green-50" },
    };

    const badge = badgeMap[source] || badgeMap.Manual;

    return (
      <Badge variant="outline" className={badge.color}>
        {badge.icon}
        {source}
      </Badge>
    );
  };

  // Inception-day: when the seller has no SKUs at all, hide the
  // toolbar chrome (search, filters, bulk-import) and the pagination
  // footer so the table area surfaces only the EmptyState illustration
  // — but keep the same full-height Card container so the layout reads
  // identically to the populated state.
  const isEmpty = skus.length === 0;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Page area — Card fills the available height; only the table
          rows scroll, the search/filter header and pagination stay
          pinned to the top and bottom of the Card. */}
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
          {/* Header with Search and Actions */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by SKU Code, SKU Name, or Brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full sm:w-auto">
                {!isEmpty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="gap-2 flex-1 sm:flex-initial"
                >
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
                )}
<DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="gap-2 flex-1 sm:flex-initial bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <FileText className="h-4 w-4" />
                      Request
                      <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={openCompanyRequestDialog} className="gap-2 cursor-pointer">
                      <Building2 className="h-4 w-4 text-purple-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Request a Company</p>
                        <p className="text-[11px] text-gray-500">Ask to add a new company</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openBrandRequestDialog} className="gap-2 cursor-pointer">
                      <Tag className="h-4 w-4 text-purple-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Request a Brand</p>
                        <p className="text-[11px] text-gray-500">Ask to add a new brand</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openSkuRequestDialog} className="gap-2 cursor-pointer">
                      <Package className="h-4 w-4 text-purple-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Request a SKU</p>
                        <p className="text-[11px] text-gray-500">Submit a new SKU for the catalog</p>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/products/my-requests")}
                  className="gap-2 flex-1 sm:flex-initial text-purple-700 border-purple-200 hover:bg-purple-50"
                >
                  <Send className="h-4 w-4" />
                  My Requests
                </Button>
                {!isEmpty && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 flex-1 sm:flex-initial"
                    onClick={() => setIsPriceStockBulkOpen(true)}
                  >
                    <Database className="h-4 w-4" />
                    Update Price &amp; Stock
                  </Button>
                )}
              </div>
            </div>

            {/* Applied Filter Tags */}
            {(statusFilter !== "all" ||
              selectedCategories.length > 0 ||
              selectedBrands.length > 0 ||
              ondcFilter !== "all") && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {statusFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Status: {statusFilter}
                    <button onClick={() => { setStatusFilter("all"); setCurrentPage(1); }} className="ml-1 hover:bg-blue-200 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedCategories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-purple-50 text-purple-700 border-purple-200">
                    {cat}
                    <button onClick={() => { setSelectedCategories(selectedCategories.filter(c => c !== cat)); setCurrentPage(1); }} className="ml-1 hover:bg-purple-200 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedBrands.map((brand) => (
                  <Badge key={brand} variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-green-50 text-green-700 border-green-200">
                    {brand}
                    <button onClick={() => { setSelectedBrands(selectedBrands.filter(b => b !== brand)); setCurrentPage(1); }} className="ml-1 hover:bg-green-200 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {ondcFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-orange-50 text-orange-700 border-orange-200">
                    Compliance: {ondcFilter === "compliant" ? "Compliant" : "Non-compliant"}
                    <button onClick={() => { setOndcFilter("all"); setCurrentPage(1); }} className="ml-1 hover:bg-orange-200 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-gray-500 text-xs h-6"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* SKU Table — flex-1 so it claims all the remaining height
              inside the Card; only this region scrolls. When the
              catalog is empty, the EmptyState fills the entire region
              (no table headers) so the illustration sits centered in
              the Card. */}
          <div className="flex-1 overflow-auto">
            {isEmpty ? (
              <EmptyState
                icon={PackageSearch}
                title="No SKUs in your catalog yet"
                description="No SKUs in your catalog yet."
              />
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    SKU Code <span className="text-red-500">*</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Short Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    SKU Name <span className="text-red-500">*</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Brand
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                    MRP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Selling Price
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                    ONDC Compliance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Last Updated
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedSKUs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-3">
                      <EmptyState
                        icon={PackageSearch}
                        title="No matches"
                        description="No SKUs match your current filters — try clearing them to see everything."
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedSKUs.map((sku) => (
                    <tr key={sku.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <CopyOnHover value={sku.sku} label="SKU code">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {sku.sku}
                          </span>
                        </CopyOnHover>
                      </td>
                      <td className="px-4 py-3">
                        {sku.shortName ? (
                          <CopyOnHover value={sku.shortName} label="Short name">
                            <span className="font-mono text-sm font-medium text-gray-900">
                              {sku.shortName}
                            </span>
                          </CopyOnHover>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CopyOnHover value={sku.name} label="SKU name">
                          <p className="font-medium text-gray-900 text-sm">{sku.name}</p>
                        </CopyOnHover>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{sku.brand}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{sku.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-gray-900">
                          {sku.mrp != null
                            ? `₹${sku.mrp.toLocaleString("en-IN")}`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-gray-900">
                          {sku.sellingPrice != null
                            ? `₹${sku.sellingPrice.toLocaleString("en-IN")}`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={
                            sku.status === "Active"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-700 border-gray-300"
                          }
                        >
                          {sku.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sku.ondcCompliance.isCompliant ? (
                          <Badge
                            className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1"
                            title="All ONDC fields are filled in correctly."
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Compliant
                          </Badge>
                        ) : (
                          <Badge
                            className="bg-red-100 text-red-700 border-red-300"
                            title={`Missing / invalid fields: ${sku.ondcCompliance.missingFields.join(", ") || "—"}`}
                          >
                            Non-compliant
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{sku.lastUpdated}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Details"
                          onClick={() => handleViewDetails(sku)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>

          {!isEmpty && (
          <ListPagination
            page={currentPage}
            total={filteredSKUs.length}
            pageSize={itemsPerPage}
            onPageChange={setCurrentPage}
            itemLabel="SKU"
          />
          )}
        </Card>
      </div>

      {/* Filter Drawer */}
      <AnimatePresence>
        {isFilterDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsFilterDrawerOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Filter SKUs</h2>
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Status</Label>
                    <Select 
                      value={statusFilter} 
                      onValueChange={(value) => {
                        setStatusFilter(value);
                        handleFilterChange();
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* "All" rather than "All Status" so the option
                            isn't mistaken for the field label and the
                            phrasing matches the ONDC Compliance picker
                            below. */}
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Category</Label>
                    <MultiSelect
                      options={uniqueCategories.map((c) => ({ label: c, value: c }))}
                      selected={selectedCategories}
                      onChange={(values) => { setSelectedCategories(values); handleFilterChange(); }}
                      placeholder="All Categories"
                      className="w-full"
                    />
                  </div>

                  {/* Brand Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Brand</Label>
                    <MultiSelect
                      options={uniqueBrands.map((b) => ({ label: b, value: b }))}
                      selected={selectedBrands}
                      onChange={(values) => { setSelectedBrands(values); handleFilterChange(); }}
                      placeholder="All Brands"
                      className="w-full"
                    />
                  </div>

                  {/* ONDC Compliance Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">ONDC Compliance</Label>
                    <Select
                      value={ondcFilter}
                      onValueChange={(value) => {
                        setOndcFilter(value);
                        handleFilterChange();
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="compliant">Compliant</SelectItem>
                        <SelectItem value="non-compliant">Non-compliant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStatusFilter("all");
                    setSelectedCategories([]);
                    setSelectedBrands([]);
                    setOndcFilter("all");
                    setCurrentPage(1);
                    toast.success("All filters cleared");
                  }}
                >
                  Clear
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setIsFilterDrawerOpen(false)}
                >
                  Apply
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* Price & Stock — Bulk Import (Story 19128). The downloaded
          sheet is pre-filled with every SKU in the seller's catalog
          and its current values; the seller edits only MRP / Selling
          Price / Available Stock (Yes/No) offline and re-uploads.
          Rows whose SKU Code isn't in the catalog are REJECTED with a
          row-level error (not silently skipped). */}
      <BulkImportDialog
        open={isPriceStockBulkOpen}
        onOpenChange={setIsPriceStockBulkOpen}
        config={{
          title: "Update Price & Stock — Bulk Import",
          description:
            "Download a sheet pre-filled with your existing SKUs, edit only MRP / Selling Price / Available Stock (Yes/No) offline, then re-upload to apply the changes in bulk.",
          instructions: (
            <>
              Use this to update price and stock on SKUs that already exist in
              your catalog. Download the sheet — it comes pre-filled with your
              existing SKUs and current values — edit only the MRP, Selling
              Price, and Available Stock (Yes/No) columns, then re-upload. To
              add brand-new SKUs, use <b>Add new SKU</b> instead.
            </>
          ),
          sample: {
            // Multi-format download: the picker dialog opens on Download
            // and the chosen format ("csv" | "xlsx") is forwarded to
            // handleDownloadPsSample. Filename is omitted on purpose —
            // there's no single fixed filename when the seller picks
            // the format at download time.
            onDownload: handleDownloadPsSample,
            formats: [
              {
                value: "csv",
                label: "CSV (.csv)",
                description: "Plain text — opens in Excel, Google Sheets, or any text editor.",
              },
              {
                value: "xlsx",
                label: "Excel Workbook (.xlsx)",
                description: "Native Excel format with styled headers and frozen first row.",
              },
            ],
          },
          accept: ".csv,.xlsx,.xls",
          validate: validatePriceStockFile,
          onImport: importPriceStockRows,
          successToast: (result) =>
            `${result.validRows} SKU${result.validRows === 1 ? "" : "s"} updated.` +
            (result.invalidRows > 0
              ? ` ${result.invalidRows} row${result.invalidRows === 1 ? "" : "s"} had errors and were skipped.`
              : ""),
        }}
      />

      {/* ── Request a Company Dialog ── */}
      <Dialog open={showCompanyRequestDialog} onOpenChange={setShowCompanyRequestDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Request a New Company
            </DialogTitle>
            <DialogDescription>
              Tell us which company you'd like added to the Product Store.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="company-req-name">Company Name *</Label>
              <Input
                id="company-req-name"
                placeholder="e.g. Godrej Consumer Products"
                value={companyReqName}
                onChange={(e) => setCompanyReqName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-req-msg">Message (optional)</Label>
              <textarea
                id="company-req-msg"
                rows={3}
                placeholder="Any additional context — why this company is needed, which SKUs you expect, etc."
                value={companyReqMessage}
                onChange={(e) => setCompanyReqMessage(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setShowCompanyRequestDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitCompanyRequest}
              disabled={!companyReqName.trim()}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Send className="h-4 w-4" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Request a Brand Dialog ── */}
      <Dialog open={showBrandRequestDialog} onOpenChange={setShowBrandRequestDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Request a New Brand
            </DialogTitle>
            <DialogDescription>
              Tell us which brand you'd like added to the Product Store.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="brand-req-company">Company Name (optional)</Label>
              <Input
                id="brand-req-company"
                placeholder="e.g. Hindustan Unilever"
                value={brandReqCompanyName}
                onChange={(e) => setBrandReqCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-req-name">Brand Name *</Label>
              <Input
                id="brand-req-name"
                placeholder="e.g. Haldiram's"
                value={brandReqName}
                onChange={(e) => setBrandReqName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-req-msg">Message (optional)</Label>
              <textarea
                id="brand-req-msg"
                rows={3}
                placeholder="Any additional context — category, specific SKUs you need, etc."
                value={brandReqMessage}
                onChange={(e) => setBrandReqMessage(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setShowBrandRequestDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitBrandRequest}
              disabled={!brandReqName.trim()}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Send className="h-4 w-4" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Request a SKU Dialog ── */}
      <Dialog open={showSkuRequestDialog} onOpenChange={setShowSkuRequestDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Request a New SKU
            </DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <SkuFormFields
              mode="seller"
              form={skuReqForm}
              onChange={onSkuReqChange}
              productImages={skuReqImages}
              onProductImagesChange={setSkuReqImages}
            />
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setShowSkuRequestDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitSkuRequest}
              disabled={!isSkuReqValid}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Send className="h-4 w-4" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}