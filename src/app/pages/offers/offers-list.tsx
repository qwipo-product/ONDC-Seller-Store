import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Plus,
  Search,
  Tag,
  Gift,
  Package,
  Percent,
  Filter,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Layers,
  Eye,
  Pencil,
  // Offer-type picker icons — one per scheme.
  IndianRupee,
  Boxes,
  Receipt,
  Store as StoreIcon,
  Rocket,
  Award,
  Clock,
  Download,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { catalogSkus, findSku } from "../../lib/sku-catalog";
import {
  QpsScheme,
  QpsSlab,
  SlabDiscountType,
  validateSlabs,
  computeEffectivePrice,
} from "../../lib/qps-validation";
import { isEmptyMode } from "../../lib/data-mode";
import { EmptyState } from "../../components/empty-state";
import { ListPagination } from "../../components/ui/list-pagination";
import {
  OffersFilterDrawer,
  type OfferTypeOption,
} from "../../components/filter-drawers/offers-filter-drawer";
// Shared seed + persistence for QPS schemes so the Price &
// Inventory page (and any future consumer) can read the same
// dataset to validate price updates against active schemes.
import {
  getAllSchemes,
  setAllSchemes,
} from "../../lib/offers-data";
import {
  type ValueSlabScheme,
  getAllValueSlabs,
  setAllValueSlabs,
} from "../../lib/value-slab-data";
import {
  ValueSlabEditorDialog,
  ValueSlabViewDialog,
} from "../../components/value-slab-dialogs";
import {
  type OffInvoiceScheme,
  getAllOffInvoices,
  setAllOffInvoices,
} from "../../lib/off-invoice-data";
import {
  OffInvoiceEditorDialog,
  OffInvoiceViewDialog,
} from "../../components/off-invoice-dialogs";
import { SkuComboBox } from "../../components/sku-combobox";
import { CopyOnHover } from "../../components/copy-on-hover";

// Seed QPS schemes — these populate the list on first load.
// The ten offer types surfaced on the "Create Offers" picker dialog.
// QPS is the only one wired up in Phase 1 — everything else carries
// a "Coming Soon" badge and is non-interactive in the picker UI.
//
// Icon + colour pair follow the same convention used everywhere
// else in the app (Settings hub tiles, ConnectorCard, dashboard
// shortcut cards): a Lucide icon in a tinted square. Each offer type
// gets its own tone so the grid reads at a glance.
interface OfferType {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}
const OFFER_TYPES: OfferType[] = [
  {
    id: "qps",
    label: "QPS",
    description: "Quantity-based price slabs with tiered discounts",
    icon: Layers,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    id: "value-slab",
    label: "Value Slab",
    description: "Order value-based discount tiers",
    icon: IndianRupee,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    id: "bogo",
    label: "BOGO",
    description: "Buy X quantity, get Y free units",
    icon: Gift,
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
  },
  {
    id: "case-bonus",
    label: "Case Bonus",
    description: "Extra cases free on bulk purchase",
    icon: Boxes,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    id: "off-invoice",
    label: "Off-Invoice",
    description: "Discount on the whole cart when it crosses a value",
    icon: Receipt,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    id: "display-allowance",
    label: "Display Allowance",
    description: "Incentive for in-store product display",
    icon: StoreIcon,
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-600",
  },
  {
    id: "launch-incentive",
    label: "Launch Incentive",
    description: "Special pricing for new product launches",
    icon: Rocket,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    id: "loyalty-rebate",
    label: "Loyalty Rebate",
    description: "Cashback rebate for repeat purchases",
    icon: Award,
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600",
  },
  {
    id: "combo-bundle",
    label: "Combo Bundle",
    description: "Bundled products at discounted rate",
    icon: Package,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    id: "early-payment",
    label: "Early Payment",
    description: "Discount for early invoice settlement",
    icon: Clock,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
  },
];

// Seed schemes live in `lib/offers-data.ts` so the Price &
// Inventory page can read the same dataset for its price-update
// validation. `getAllSchemes()` here will return the persisted
// set if the seller has edited any, falling back to the seed.

const getStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-800 border-green-200";
    case "Inactive":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "Scheduled":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Expired":
      return "bg-gray-200 text-gray-700 border-gray-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export function OffersList() {
  // Initial state — empty mode shows zero schemes; otherwise fall
  // back to whatever's persisted (seed on first load).
  const [qpsSchemes, setQpsSchemes] = useState<QpsScheme[]>(() =>
    isEmptyMode() ? [] : getAllSchemes(),
  );

  // Keep localStorage in sync with the in-memory state so the
  // price-update validation on Price & Inventory always reads the
  // latest. We skip persistence in empty mode — the empty-mode
  // demo deliberately starts blank on every page load.
  useEffect(() => {
    if (isEmptyMode()) return;
    setAllSchemes(qpsSchemes);
  }, [qpsSchemes]);

  // Value Slab schemes (order-value based discount tiers). Kept in a
  // separate store from QPS because they have no SKU: the discount is
  // decided by the total order value.
  const [valueSlabs, setValueSlabs] = useState<ValueSlabScheme[]>(() =>
    isEmptyMode() ? [] : getAllValueSlabs(),
  );
  useEffect(() => {
    if (isEmptyMode()) return;
    setAllValueSlabs(valueSlabs);
  }, [valueSlabs]);
  const [isValueEditorOpen, setIsValueEditorOpen] = useState(false);
  const [editingValueSlab, setEditingValueSlab] = useState<ValueSlabScheme | null>(null);
  const [viewValueSlabId, setViewValueSlabId] = useState<string | null>(null);

  // Off-Invoice schemes: a discount on the whole cart / invoice value,
  // not tied to a SKU or category.
  const [offInvoices, setOffInvoices] = useState<OffInvoiceScheme[]>(() =>
    isEmptyMode() ? [] : getAllOffInvoices(),
  );
  useEffect(() => {
    if (isEmptyMode()) return;
    setAllOffInvoices(offInvoices);
  }, [offInvoices]);
  const [isOffInvoiceEditorOpen, setIsOffInvoiceEditorOpen] = useState(false);
  const [editingOffInvoice, setEditingOffInvoice] = useState<OffInvoiceScheme | null>(null);
  const [viewOffInvoiceId, setViewOffInvoiceId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [offerTypeFilter, setOfferTypeFilter] = useState<string>("all");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  // Pagination — reset to page 1 on any filter / search change so the
  // visible window doesn't fall off the end of a shorter result set.
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Create / Edit QPS dialog (shared — editingId=null means create)
  // ---- Offer-type picker (the "Create Offers" entry-point dialog) ----
  // Shows the 10 offer types as cards with hover effects. Only QPS is
  // active in Phase 1; the rest render with a "Coming Soon" badge.
  // Picking QPS closes this dialog and opens the existing QPS editor.
  const [isOfferTypeOpen, setIsOfferTypeOpen] = useState(false);

  // Export dialog — seller picks Offer Type + a Valid From / Valid Till
  // window, the matching schemes are written to an Excel workbook with
  // one column triple per slab (Slab N range / Discount % / Discounted
  // Selling Price). Defaults: type=all, window covers the next year so
  // any currently-valid scheme falls inside.
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportOfferType, setExportOfferType] = useState<string>("all");
  const [exportValidFrom, setExportValidFrom] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [exportValidTill, setExportValidTill] = useState<string>(
    new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10),
  );
  const [isExporting, setIsExporting] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorSkuCode, setEditorSkuCode] = useState<string>("");
  const [editorStartDate, setEditorStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [editorEndDate, setEditorEndDate] = useState<string>(
    new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10),
  );
  const [editorSlabs, setEditorSlabs] = useState<Partial<QpsSlab>[]>([
    { minQty: 1, maxQty: 5, discountType: "flat", slabPrice: 0 },
  ]);
  const [editorActive, setEditorActive] = useState<boolean>(true);

  // View Details dialog
  const [viewSchemeId, setViewSchemeId] = useState<string | null>(null);

  // Delete confirmation
  // Schemes are immutable once created — no delete flow. (Sellers can mark a
  // scheme Inactive via the toggle if they want it off.)

  // Bulk Import has been removed for Phase 1 — schemes are created one at a
  // time via the Create QPS Scheme button.

  // ---- Filter + Search ----
  // One list for every offer type. QPS rows carry a SKU; Value Slab
  // rows apply to the whole order, so they show "All SKUs".
  type ListRow = {
    kind: "qps" | "value-slab" | "off-invoice";
    id: string;
    name: string;
    skuCode: string;
    skuName: string;
    startDate: string;
    endDate: string;
    status: string;
    qps?: QpsScheme;
    valueSlab?: ValueSlabScheme;
    offInvoice?: OffInvoiceScheme;
  };
  const listRows: ListRow[] = [
    ...offInvoices.map<ListRow>((o) => ({
      kind: "off-invoice",
      id: o.id,
      name: o.name,
      skuCode: "All SKUs",
      skuName: "Whole cart (invoice value)",
      startDate: o.startDate,
      endDate: o.endDate,
      status: o.status,
      offInvoice: o,
    })),
    ...valueSlabs.map<ListRow>((v) => ({
      kind: "value-slab",
      id: v.id,
      name: v.name,
      skuCode: v.skuCode,
      skuName: v.skuName,
      startDate: v.startDate,
      endDate: v.endDate,
      status: v.status,
      valueSlab: v,
    })),
    ...qpsSchemes.map<ListRow>((q) => ({
      kind: "qps",
      id: q.id,
      name: q.name,
      skuCode: q.skuCode,
      skuName: q.skuName,
      startDate: q.startDate,
      endDate: q.endDate,
      status: q.status,
      qps: q,
    })),
  ];
  const filteredSchemes = listRows.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === "" ||
      s.id.toLowerCase().includes(q) ||
      s.skuCode.toLowerCase().includes(q) ||
      s.skuName.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesType = offerTypeFilter === "all" || offerTypeFilter === s.kind;
    return matchesSearch && matchesStatus && matchesType;
  });
  // Slice the filtered list down to the current page's window.
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSchemes = filteredSchemes.slice(
    startIndex,
    startIndex + itemsPerPage,
  );


  // ---- Editor handlers (create + edit) ----
  const selectedSku = findSku(editorSkuCode);
  const spForEditor = selectedSku?.sellingPrice ?? 0;
  const mrpForEditor = selectedSku?.mrp ?? 0;

  // Build the SKU pool the combobox can search over:
  //   - drop Inactive SKUs (catalog status === "Inactive") — they're
  //     not eligible for new offer mappings.
  //   - drop SKUs that are already mapped to a non-expired QPS
  //     scheme. In edit mode we keep the SKU of the scheme we're
  //     currently editing in the list (so the seller can re-pick
  //     it without it being filtered out as "already mapped").
  const skuPickerOptions = useMemo(() => {
    const blockedCodes = new Set([
      ...qpsSchemes
        .filter((s) => s.status !== "Expired" && s.id !== editingId)
        .map((s) => s.skuCode),
      ...valueSlabs.filter((v) => v.status !== "Expired").map((v) => v.skuCode),
    ]);
    return catalogSkus.filter((c) => {
      if (c.status !== "Active") return false;
      if (blockedCodes.has(c.skuCode)) return false;
      return true;
    });
  }, [qpsSchemes, valueSlabs, editingId]);

  // Same idea for the Value Slab editor: hide Inactive SKUs and SKUs
  // that already carry a QPS or another Value Slab. The scheme being
  // edited keeps its own SKU in the list.
  const valueSlabSkuOptions = useMemo(() => {
    const blockedCodes = new Set([
      ...qpsSchemes.filter((q) => q.status !== "Expired").map((q) => q.skuCode),
      ...valueSlabs
        .filter((v) => v.status !== "Expired" && v.id !== editingValueSlab?.id)
        .map((v) => v.skuCode),
    ]);
    return catalogSkus.filter(
      (c) => c.status === "Active" && !blockedCodes.has(c.skuCode),
    );
  }, [qpsSchemes, valueSlabs, editingValueSlab]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setEditorSkuCode("");
    setEditorStartDate(new Date().toISOString().slice(0, 10));
    setEditorEndDate(new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10));
    // New slabs default to a % discount; the seller can switch a
    // slab to a flat ₹ off per unit.
    setEditorSlabs([{ minQty: 1, maxQty: 5, discountType: "percent", slabPercent: 0 }]);
    setEditorActive(true);
    setIsEditorOpen(true);
  };

  // Value Slab handlers. A SKU can carry only one non-expired slab
  // scheme (QPS or Value Slab): both publish as the ONDC "slab" offer
  // and slab offers are non-additive, so two of them on one SKU would
  // clash. The SKU pickers below enforce this.
  const handlePickValueSlab = () => {
    setIsOfferTypeOpen(false);
    setEditingValueSlab(null);
    setIsValueEditorOpen(true);
  };
  const handleOpenEditValueSlab = (scheme: ValueSlabScheme) => {
    setViewValueSlabId(null);
    setEditingValueSlab(scheme);
    setIsValueEditorOpen(true);
  };
  const handleSaveValueSlab = (scheme: ValueSlabScheme) => {
    const exists = valueSlabs.some((v) => v.id === scheme.id);
    setValueSlabs((prev) =>
      exists ? prev.map((v) => (v.id === scheme.id ? scheme : v)) : [scheme, ...prev],
    );
    toast.success(`Value Slab ${exists ? "updated" : "created"} for ${scheme.skuName}`);
    setIsValueEditorOpen(false);
  };

  // Off-Invoice handlers. The scheme covers the whole catalog, so two
  // Active ones would fight over the same cart. Only one can be Active.
  const handlePickOffInvoice = () => {
    setIsOfferTypeOpen(false);
    setEditingOffInvoice(null);
    setIsOffInvoiceEditorOpen(true);
  };
  const handleOpenEditOffInvoice = (scheme: OffInvoiceScheme) => {
    setViewOffInvoiceId(null);
    setEditingOffInvoice(scheme);
    setIsOffInvoiceEditorOpen(true);
  };
  const handleSaveOffInvoice = (scheme: OffInvoiceScheme) => {
    const clash = offInvoices.find(
      (o) => o.id !== scheme.id && o.status === "Active",
    );
    if (scheme.status === "Active" && clash) {
      toast.error(
        `"${clash.name}" is already Active. Only one Off-Invoice scheme can be Active at a time because it covers the whole cart. Make that one Inactive first, or save this one as Inactive.`,
      );
      return;
    }
    const exists = offInvoices.some((o) => o.id === scheme.id);
    setOffInvoices((prev) =>
      exists ? prev.map((o) => (o.id === scheme.id ? scheme : o)) : [scheme, ...prev],
    );
    toast.success(`Off-Invoice scheme ${exists ? "updated" : "created"}`);
    setIsOffInvoiceEditorOpen(false);
  };

  // Bridges the offer-type picker → existing QPS editor: closes the
  // type dialog first, then opens the editor for a fresh QPS scheme.
  const handlePickQps = () => {
    setIsOfferTypeOpen(false);
    handleOpenCreate();
  };

  const handleOpenEdit = (scheme: QpsScheme) => {
    setEditingId(scheme.id);
    setEditorSkuCode(scheme.skuCode);
    // Phase 1 rule — Start Date is always today, even on edit. The
    // scheme's saved startDate is ignored; if the seller wants to
    // pause an in-flight scheme they should toggle Inactive.
    setEditorStartDate(new Date().toISOString().slice(0, 10));
    setEditorEndDate(scheme.endDate);
    // Phase 1 — only "% Discount" slabs are supported. Auto-migrate
    // any legacy flat-price slabs to percent by computing the % off
    // SP they represented, so the seller's existing scheme keeps
    // its effective pricing instead of resetting to 0%.
    const sp = scheme.sellingPrice || 1;
    setEditorSlabs(
      scheme.slabs.map((s) => {
        if (s.discountType === "percent") {
          return {
            minQty: s.minQty,
            maxQty: s.maxQty,
            discountType: "percent",
            slabPercent: s.slabPercent,
          };
        }
        if (s.discountType === "amount") {
          return {
            minQty: s.minQty,
            maxQty: s.maxQty,
            discountType: "amount",
            slabAmount: s.slabAmount,
          };
        }
        // Convert flat slab → equivalent percent off SP.
        const flatPrice = s.slabPrice ?? sp;
        const percent = sp > 0
          ? +(((sp - flatPrice) / sp) * 100).toFixed(2)
          : 0;
        return {
          minQty: s.minQty,
          maxQty: s.maxQty,
          discountType: "percent",
          slabPercent: Math.max(0, Math.min(99.99, percent)),
        };
      }),
    );
    // Active toggle reflects whether the seller chose to keep the
    // scheme running. Inactive / Expired = off. Scheduled status
    // (legacy / persisted from before) is treated the same as
    // Active for editing purposes — schemes can no longer start
    // in the future.
    setEditorActive(scheme.status === "Active" || scheme.status === "Scheduled");
    setIsEditorOpen(true);
  };

  const updateSlab = (idx: number, patch: Partial<QpsSlab>) => {
    setEditorSlabs((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addSlab = () => {
    setEditorSlabs((prev) => {
      const last = prev[prev.length - 1];
      const start =
        last && typeof last.maxQty === "number" && last.maxQty !== null
          ? last.maxQty + 1
          : (last?.minQty ?? 0) + 10;
      // Phase 1 — only Discount % is offered. Always seed the new
      // slab as percent regardless of what previous slabs used (in
      // case a legacy scheme is being edited that has flat slabs).
      return [
        ...prev,
        {
          minQty: start,
          maxQty: start + 10,
          discountType: "percent",
          slabPercent: 0,
        },
      ];
    });
  };

  const removeSlab = (idx: number) => {
    setEditorSlabs((prev) => prev.filter((_, i) => i !== idx));
  };

  const editorErrors = useMemo(() => {
    if (!selectedSku) return [];
    return validateSlabs(editorSlabs, selectedSku.sellingPrice);
  }, [editorSlabs, selectedSku]);

  const handleSaveEditor = () => {
    if (!selectedSku) {
      toast.error("Please select a SKU");
      return;
    }
    if (!editorStartDate || !editorEndDate) {
      toast.error("Please set start and end dates");
      return;
    }
    if (editorStartDate > editorEndDate) {
      toast.error("Start date must be before end date");
      return;
    }
    if (editorErrors.length > 0) {
      toast.error(`Fix ${editorErrors.length} validation error${editorErrors.length === 1 ? "" : "s"} before saving`);
      return;
    }
    const finalSlabs: QpsSlab[] = editorSlabs.map((s) => ({
      minQty: s.minQty!,
      maxQty: s.maxQty ?? null,
      discountType: s.discountType!,
      slabPrice: s.slabPrice,
      slabPercent: s.slabPercent,
      slabAmount: s.slabAmount,
      effectivePrice: computeEffectivePrice(s, selectedSku.sellingPrice),
    }));

    // Resolve final status. Phase 1 rule: schemes can no longer
    // start in the future — Start Date is forced to today on the
    // editor. So the only outcomes are Expired (end date past),
    // Inactive (seller toggled off), or Active.
    const today = new Date().toISOString().slice(0, 10);
    let finalStatus: QpsScheme["status"];
    if (editorEndDate < today) finalStatus = "Expired";
    else if (!editorActive) finalStatus = "Inactive";
    else finalStatus = "Active";

    if (editingId) {
      // Edit mode — replace the existing scheme in place
      setQpsSchemes((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? {
                ...s,
                skuCode: selectedSku.skuCode,
                skuName: selectedSku.skuName,
                mrp: selectedSku.mrp,
                sellingPrice: selectedSku.sellingPrice,
                startDate: editorStartDate,
                endDate: editorEndDate,
                slabs: finalSlabs,
                status: finalStatus,
              }
            : s,
        ),
      );
      toast.success(`QPS scheme updated for ${selectedSku.skuName}`);
    } else {
      const newScheme: QpsScheme = {
        id: `QPS-${selectedSku.skuCode}-${Date.now()}`,
        name: `QPS – ${selectedSku.skuName}`,
        skuCode: selectedSku.skuCode,
        skuName: selectedSku.skuName,
        mrp: selectedSku.mrp,
        sellingPrice: selectedSku.sellingPrice,
        slabs: finalSlabs,
        startDate: editorStartDate,
        endDate: editorEndDate,
        status: finalStatus,
      };
      setQpsSchemes((prev) => [newScheme, ...prev]);
      toast.success(`QPS scheme created for ${selectedSku.skuName}`);
    }
    setIsEditorOpen(false);
  };

  const viewScheme = viewSchemeId ? qpsSchemes.find((s) => s.id === viewSchemeId) : null;

  // ---- Export Offers — Excel workbook, one row per slab ----
  // Previous shape extended the worksheet *horizontally* with
  // {Slab N / Discount % / Discounted SP} column triples — that
  // scaled poorly and was hard to read. The new shape flattens the
  // structure: each slab becomes its own row, with the parent offer's
  // identifying columns (SKU Code, SKU Name, Offer Type, Offer Code,
  // Valid From, Valid Till) repeated alongside the slab-specific
  // values (Min Qty, Max Qty, Discount Type, Discount Percentage,
  // Discounted Selling Price).
  //
  // Discount Type is always "Percentage" in the export. Flat-price
  // slabs (a legacy authoring option) are back-calculated to the
  // equivalent % off the Selling Price so the column reads
  // consistently. Discount Percentage is stored as a raw number with
  // no `%` symbol so downstream tools can sort / filter / sum it
  // straight away.
  const handleExportOffers = async () => {
    if (!exportValidFrom || !exportValidTill) {
      toast.error("Please set both Valid From and Valid Till.");
      return;
    }
    if (exportValidFrom > exportValidTill) {
      toast.error("Valid From must be on or before Valid Till.");
      return;
    }

    // Source rows = QPS schemes whose date range overlaps the window.
    // When other offer types ship they can be unioned here.
    const matchesType =
      exportOfferType === "all" || exportOfferType === "qps";
    const sourceSchemes = matchesType
      ? qpsSchemes.filter(
          (s) =>
            s.endDate >= exportValidFrom && s.startDate <= exportValidTill,
        )
      : [];

    if (sourceSchemes.length === 0) {
      toast.error(
        "No offers match the selected type and validity window. Try a wider date range.",
      );
      return;
    }

    setIsExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Qwipo Seller Store";
      wb.created = new Date();
      const ws = wb.addWorksheet("Offers");

      const headers = [
        "SKU Code",
        "SKU Name",
        "Offer Type",
        "Offer Code",
        "Min Quantity",
        "Max Quantity",
        "Discount Type",
        "Discount Percentage",
        "Discounted Selling Price",
        "Valid From",
        "Valid Till",
      ];
      ws.addRow(headers);

      const slabDiscountPct = (s: QpsSlab, sellingPrice: number) => {
        if (s.discountType === "percent" && typeof s.slabPercent === "number") {
          return s.slabPercent;
        }
        if (
          s.discountType === "amount" &&
          typeof s.slabAmount === "number" &&
          sellingPrice > 0
        ) {
          return +((s.slabAmount / sellingPrice) * 100).toFixed(2);
        }
        if (
          s.discountType === "flat" &&
          typeof s.slabPrice === "number" &&
          sellingPrice > 0
        ) {
          return +(((sellingPrice - s.slabPrice) / sellingPrice) * 100).toFixed(
            2,
          );
        }
        return 0;
      };

      // Row-per-slab: parent offer fields repeat for every slab; only
      // Min Qty / Max Qty / Discount Percentage / Discounted Selling
      // Price change between slabs.
      sourceSchemes.forEach((scheme) => {
        scheme.slabs.forEach((slab) => {
          ws.addRow([
            scheme.skuCode,
            scheme.skuName,
            "QPS",
            scheme.id,
            slab.minQty,
            // Unbounded upper slab (∞) renders as a blank Max Quantity
            // cell — leaving the cell empty is the most predictable
            // representation in Excel.
            slab.maxQty === null || slab.maxQty === undefined ? "" : slab.maxQty,
            "Percentage",
            slabDiscountPct(slab, scheme.sellingPrice),
            slab.effectivePrice,
            scheme.startDate,
            scheme.endDate,
          ]);
        });
      });

      // Header styling matches the Price & Stock / Add SKU templates so
      // the three exports feel like siblings: bold white text on blue,
      // first row frozen.
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E40AF" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "left" };
      headerRow.height = 22;
      // Column widths sized to typical content.
      const widths = [16, 60, 12, 22, 14, 14, 16, 20, 22, 12, 12];
      widths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });
      // Ensure Discount Percentage + Discounted SP read as plain
      // numbers (no %, two-decimal grouping).
      ws.getColumn(8).numFmt = "0.##"; // Discount Percentage
      ws.getColumn(9).numFmt = "0.00"; // Discounted Selling Price
      ws.views = [{ state: "frozen", ySplit: 1 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `offers_export_${exportValidFrom}_to_${exportValidTill}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExportOpen(false);
      const totalSlabs = sourceSchemes.reduce(
        (n, s) => n + s.slabs.length,
        0,
      );
      toast.success(
        `Exported ${sourceSchemes.length} offer${sourceSchemes.length === 1 ? "" : "s"} (${totalSlabs} slab row${totalSlabs === 1 ? "" : "s"}) to Excel.`,
      );
    } catch (err) {
      console.error("[offers-list] export failed", err);
      toast.error("Couldn't generate the export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Inception-day: when the seller has no QPS schemes at all, hide
  // only the toolbar chrome (search, status filter, Create CTA) and
  // the pagination footer. KPI summary stays visible (showing 0s) and
  // the same full-height Card container is preserved so the layout
  // reads identically to the populated state.
  const isEmpty =
    qpsSchemes.length === 0 && valueSlabs.length === 0 && offInvoices.length === 0;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Page area — Card stretches; only the rows scroll. Mirrors the
          My SKU page pattern. */}
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
          {/* Header with search + filters + actions — search + Create
              QPS stay visible on the empty state so the seller can
              immediately start authoring schemes; only the status
              filter (which has nothing to filter) is hidden. */}
          <div className="border-b border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto flex-wrap">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by SKU Code, SKU Name or Scheme Name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-3 h-9"
                />
              </div>
            </div>
            {/* Right-aligned actions: Filters (right-side drawer) →
                Export (xlsx download) → Create Offers. Matches the
                My SKU / Customers pattern so the toolbar reads
                consistently across list pages. */}
            <div className="flex items-center gap-2">
              {!isEmpty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {(statusFilter !== "all" || offerTypeFilter !== "all") && (
                    <Badge className="bg-blue-600 text-white border-blue-600 ml-1 h-5 px-1.5 text-[10px]">
                      {(statusFilter !== "all" ? 1 : 0) +
                        (offerTypeFilter !== "all" ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              )}
              {!isEmpty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExportOpen(true)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setIsOfferTypeOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Offers
              </Button>
            </div>
          </div>

          {/* Table — flex-1 so it fills the remaining Card height; only
              this region scrolls. When the catalog is empty, the
              EmptyState fills the entire region (no headers) so the
              illustration sits centered. */}
          <div className="flex-1 overflow-auto">
            {isEmpty ? (
              <EmptyState
                icon={Tag}
                title="No QPS schemes yet"
                description="Once you create a quantity-based pricing scheme to reward bulk buyers, they'll appear here for ongoing management."
              />
            ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Offer Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">SKU Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">SKU Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Offer Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Valid From</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Valid Till</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 text-center">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSchemes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-3">
                      <EmptyState
                        icon={Tag}
                        title="No matches"
                        description="No schemes match your search or filters. Try clearing them to see everything."
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedSchemes.map((s) => {
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-800">
                          <CopyOnHover value={s.id} label="Offer code">{s.id}</CopyOnHover>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-800">
                          <CopyOnHover value={s.skuCode} label="SKU code">{s.skuCode}</CopyOnHover>
                        </td>
                        <td className="px-4 py-3">
                          <CopyOnHover value={s.skuName} label="SKU name">
                            <p className="text-sm text-gray-900">{s.skuName}</p>
                          </CopyOnHover>
                        </td>
                        <td className="px-4 py-3">
                          {s.kind === "qps" ? (
                            <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                              <Layers className="h-3 w-3" /> QPS
                            </Badge>
                          ) : s.kind === "value-slab" ? (
                            <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                              <IndianRupee className="h-3 w-3" /> Value Slab
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200">
                              <Receipt className="h-3 w-3" /> Off-Invoice
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-700">{s.startDate}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-700">{s.endDate}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`${getStatusColor(s.status)} border font-medium text-xs`}>
                            {s.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="View Details"
                              onClick={() =>
                                s.kind === "qps"
                                  ? setViewSchemeId(s.id)
                                  : s.kind === "value-slab"
                                    ? setViewValueSlabId(s.id)
                                    : setViewOffInvoiceId(s.id)
                              }
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={s.status === "Expired" ? "Expired schemes cannot be edited" : "Edit"}
                              disabled={s.status === "Expired"}
                              onClick={() =>
                                s.kind === "qps"
                                  ? handleOpenEdit(s.qps!)
                                  : s.kind === "value-slab"
                                    ? handleOpenEditValueSlab(s.valueSlab!)
                                    : handleOpenEditOffInvoice(s.offInvoice!)
                              }
                            >
                              <Pencil className={`h-4 w-4 ${s.status === "Expired" ? "text-gray-300" : "text-gray-700"}`} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            )}
          </div>
          {!isEmpty && (
          <ListPagination
            page={currentPage}
            total={filteredSchemes.length}
            pageSize={itemsPerPage}
            onPageChange={setCurrentPage}
            itemLabel="scheme"
          />
          )}
        </Card>
      </div>

      {/* ====================== View Details Dialog ====================== */}
      <Dialog
        open={viewSchemeId !== null}
        onOpenChange={(open) => !open && setViewSchemeId(null)}
      >
        <DialogContent className="!max-w-[min(95vw,900px)] w-[min(95vw,900px)] max-h-[92vh] overflow-y-auto">
          {viewScheme && (
            <>
              <DialogHeader className="pb-2">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Layers className="h-5 w-5 text-blue-600" />
                  {viewScheme.name}
                </DialogTitle>
                <DialogDescription>
                  {viewScheme.skuCode} · {viewScheme.skuName}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* SKU + validity strip */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] text-gray-600">MRP</p>
                      <p className="font-bold text-gray-900">₹{viewScheme.mrp}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-600">Selling Price</p>
                      <p className="font-bold text-green-700">₹{viewScheme.sellingPrice}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-600">Validity</p>
                      <p className="text-sm text-gray-800">
                        {viewScheme.startDate} → {viewScheme.endDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-600">Status</p>
                      <Badge className={`${getStatusColor(viewScheme.status)} border text-xs`}>
                        {viewScheme.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Slab table with clear customer-facing pricing */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
                    <p className="text-sm font-semibold text-gray-900">
                      Pricing Slabs ({viewScheme.slabs.length})
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/50 border-b border-gray-200">
                      <tr className="text-left">
                        <th className="px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase">Slab #</th>
                        <th className="px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase">Qty Range</th>
                        <th className="px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase">Discount</th>
                        <th className="px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase text-right">Customer Pays</th>
                        <th className="px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase text-right">You Save</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewScheme.slabs.map((slab, i) => {
                        const saving = viewScheme.sellingPrice - slab.effectivePrice;
                        const savingPct = (saving / viewScheme.sellingPrice) * 100;
                        return (
                          <tr key={i}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-700">Slab {i + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-800">
                              {slab.minQty}–{slab.maxQty === null ? "∞" : slab.maxQty} units
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {slab.discountType === "percent" ? (
                                <Badge className="bg-purple-50 text-purple-700 border-purple-200">
                                  {slab.slabPercent}% off
                                </Badge>
                              ) : slab.discountType === "amount" ? (
                                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                                  ₹{slab.slabAmount} off per unit
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                                  Flat ₹{slab.slabPrice}/unit
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-base font-medium text-green-700">
                                ₹{slab.effectivePrice.toFixed(2)}
                              </p>
                              <p className="text-[10px] text-gray-500">per unit</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {saving > 0 ? (
                                <>
                                  <p className="text-sm font-medium text-purple-700">
                                    ₹{saving.toFixed(2)}
                                  </p>
                                  <p className="text-[10px] text-gray-500">
                                    ({savingPct.toFixed(1)}% off SP)
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-gray-400">—</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewSchemeId(null)}>
                  Close
                </Button>
                <Button
                  disabled={viewScheme.status === "Expired"}
                  title={
                    viewScheme.status === "Expired"
                      ? "Expired schemes cannot be edited — create a new one if needed"
                      : undefined
                  }
                  onClick={() => {
                    const s = viewScheme;
                    setViewSchemeId(null);
                    handleOpenEdit(s);
                  }}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  {viewScheme.status === "Expired" ? "Edit (Expired)" : "Edit Scheme"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ====================== Offer-Type Picker Dialog ======================
          Phase-1 entry point for "Create Offers". Surfaces all 10
          offer types as cards with hover affordances. Only QPS is
          live; the rest carry a "Coming Soon" badge and are
          non-interactive. Picking QPS bridges to the existing QPS
          editor below. */}
      <Dialog open={isOfferTypeOpen} onOpenChange={setIsOfferTypeOpen}>
        <DialogContent className="!max-w-[min(95vw,1100px)] w-[min(95vw,1100px)] max-h-[92vh] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Tag className="h-5 w-5 text-blue-600" />
              Create Offers
            </DialogTitle>
            <DialogDescription>
              Pick the type of offer you want to set up for your catalog.
              More types are rolling out — stay tuned.
            </DialogDescription>
          </DialogHeader>

          {/* Two rows of five — same shape as the dashboard shortcut
              grid. Each tile mirrors the Settings hub card: icon
              tile on the left, heading + one-line subtitle on the
              right, top-aligned. The whole card is the click target. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 py-2">
            {OFFER_TYPES.map((t) => {
              const enabled =
                t.id === "qps" || t.id === "value-slab" || t.id === "off-invoice";
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={
                    t.id === "qps"
                      ? handlePickQps
                      : t.id === "value-slab"
                        ? handlePickValueSlab
                        : t.id === "off-invoice"
                          ? handlePickOffInvoice
                          : undefined
                  }
                  disabled={!enabled}
                  className={
                    "relative text-left rounded-xl border p-4 transition-all min-h-[140px] " +
                    (enabled
                      ? "bg-white border-gray-200 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                      : "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed")
                  }
                >
                  {!enabled && (
                    <span className="absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700 border border-gray-300 leading-none">
                      Coming Soon
                    </span>
                  )}
                  <div
                    className={`${t.iconBg} ${t.iconColor} p-2 rounded-lg w-fit`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-3 leading-tight">
                    {t.label}
                  </p>
                  <p className="text-[11px] text-gray-600 leading-snug mt-1">
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOfferTypeOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====================== Export Offers Dialog ====================== */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Export Offers
            </DialogTitle>
            <DialogDescription>
              Pick the offer type and validity window. Matching offers
              download as an Excel workbook with one column triple per
              slab.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="exportOfferType" className="text-xs">
                Offer Type
              </Label>
              <Select
                value={exportOfferType}
                onValueChange={setExportOfferType}
              >
                <SelectTrigger id="exportOfferType" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All offer types</SelectItem>
                  {OFFER_TYPES.map((t) => {
                    // Phase 1: QPS is the only offer type with real data.
                    // The other 9 stay greyed-out in the dropdown — same
                    // parity treatment they get on the Create Offers
                    // picker, so the menu matches what the seller can
                    // actually act on.
                    const enabled = t.id === "qps";
                    return (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        disabled={!enabled}
                      >
                        {t.label}
                        {!enabled && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400">
                            Coming Soon
                          </span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exportValidFrom" className="text-xs">
                  Valid From <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="exportValidFrom"
                  type="date"
                  value={exportValidFrom}
                  onChange={(e) => setExportValidFrom(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exportValidTill" className="text-xs">
                  Valid Till <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="exportValidTill"
                  type="date"
                  value={exportValidTill}
                  min={exportValidFrom || undefined}
                  onChange={(e) => setExportValidTill(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed">
              Any offer whose date range overlaps with this window is
              included.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExportOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExportOffers}
              disabled={
                isExporting ||
                !exportValidFrom ||
                !exportValidTill ||
                exportValidFrom > exportValidTill
              }
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting…" : "Download Excel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====================== Create / Edit QPS Dialog ====================== */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="!max-w-[min(95vw,1150px)] w-[min(95vw,1150px)] max-h-[92vh] overflow-y-auto p-5">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Layers className="h-5 w-5 text-blue-600" />
              {editingId ? "Edit" : "Create"} Quantity Pricing Scheme (QPS)
            </DialogTitle>
            <DialogDescription>
              Select a SKU and define quantity-based pricing slabs. Each slab gives either a %
              discount or a flat ₹ amount off the Selling Price. The effective per-unit
              price the customer pays is calculated live.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* SKU + dates */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  SKU <span className="text-red-500">*</span>
                </Label>
                {/* Search-as-you-type SKU picker. The pool is
                    filtered upstream — Inactive SKUs and SKUs
                    already mapped to a non-expired scheme are
                    excluded so each scheme owns exactly one SKU.
                    See `skuPickerOptions` above. */}
                <SkuComboBox
                  skus={skuPickerOptions}
                  value={editorSkuCode}
                  onChange={setEditorSkuCode}
                  placeholder="Search SKU by code, name, brand…"
                  emptyMessage="No matching active SKU. Inactive SKUs and ones already mapped to a scheme are hidden."
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                {/* Phase 1 rule — schemes always start today.
                    Future-dating is removed; past dates are not
                    allowed. The input is locked via min/max + the
                    disabled attribute so the seller can't override
                    it from the date picker. The handlers that open
                    the editor (create + edit) always reset
                    editorStartDate to today, so this displays
                    today regardless of the underlying scheme. */}
                <Input
                  type="date"
                  value={editorStartDate}
                  min={editorStartDate}
                  max={editorStartDate}
                  disabled
                  readOnly
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Schemes always start today.
                </p>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  End Date <span className="text-red-500">*</span>
                </Label>
                {/* End Date can be any day from today onwards. The
                    `min` attribute pins the picker to the start
                    date so earlier days are disabled at the OS
                    level. */}
                <Input
                  type="date"
                  value={editorEndDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setEditorEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Scheme Status — Active / Inactive toggle */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  Scheme Status
                </Label>
                <p className="text-xs text-gray-600 mt-0.5">
                  {editorActive
                    ? "Active — slab pricing applies on matching orders within the validity window."
                    : "Inactive — slab pricing is paused. Orders use the regular Selling Price."}
                  {editorEndDate && editorEndDate < new Date().toISOString().slice(0, 10) && (
                    <span className="text-red-700 font-medium"> · End date is in the past — scheme will save as Expired.</span>
                  )}
                </p>
              </div>
              {/* Order is Inactive ← Switch → Active so the side the
                  thumb travels to (right, "checked") visually matches
                  the green "Active" label. The previous arrangement
                  (Active left / Inactive right) read as if turning ON
                  the switch was deactivating the scheme. */}
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold ${!editorActive ? "text-orange-700" : "text-gray-400"}`}
                >
                  Inactive
                </span>
                <Switch
                  checked={editorActive}
                  onCheckedChange={setEditorActive}
                  disabled={!!editorEndDate && editorEndDate < new Date().toISOString().slice(0, 10)}
                />
                <span
                  className={`text-xs font-semibold ${editorActive ? "text-green-700" : "text-gray-400"}`}
                >
                  Active
                </span>
              </div>
            </div>

            {/* Prominent MRP / SP panel once SKU is selected */}
            {selectedSku && (
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-600 uppercase tracking-wider">Selected SKU</p>
                    <p className="font-semibold text-gray-900">{selectedSku.skuName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {selectedSku.skuCode} · {selectedSku.brand} · {selectedSku.category}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[11px] text-gray-600 uppercase tracking-wider">MRP</p>
                      <p className="text-2xl font-bold text-gray-900">₹{selectedSku.mrp}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-600 uppercase tracking-wider">Selling Price</p>
                      <p className="text-2xl font-bold text-green-700">₹{selectedSku.sellingPrice}</p>
                      <p className="text-[10px] text-gray-500">base before discount</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slab editor — only visible after a SKU is selected.
                Authoring price slabs without a Selling Price reference
                is meaningless, so we hide the entire section (header
                row + table + helper banner) until a SKU is picked. */}
            {selectedSku && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {(() => {
                // The seller can only add another slab when the
                // current last slab has a finite Max Qty. If the
                // last slab has Max Qty blank (∞ / unlimited), the
                // ranges are already covered to the top — adding
                // another tier would create an overlap. The button
                // is disabled with a tooltip explaining why.
                const lastSlab = editorSlabs[editorSlabs.length - 1];
                const lastIsInfinite =
                  !lastSlab ||
                  lastSlab.maxQty === null ||
                  lastSlab.maxQty === undefined;
                return (
                  <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Pricing Slabs</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addSlab}
                      disabled={lastIsInfinite}
                      title={
                        lastIsInfinite
                          ? "Set a Max Qty on the last slab before adding a new one. Slabs without an upper bound already cover all higher quantities."
                          : "Add another slab"
                      }
                      className="gap-1 h-7 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Slab
                    </Button>
                  </div>
                );
              })()}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-16">Slab #</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-24">Min Qty</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-28">Max Qty</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-36">Discount Type</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-28">Value</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Customer Pays</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Saving</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {editorSlabs.map((slab, i) => {
                      const rowErrors = editorErrors.filter((e) => e.rowIndex === i);
                      const isError = rowErrors.length > 0;
                      const eff = computeEffectivePrice(slab, spForEditor);
                      const saving = spForEditor - eff;
                      const savingPct = spForEditor > 0 ? (saving / spForEditor) * 100 : 0;
                      return (
                        <tr key={i} className={isError ? "bg-red-50/60" : ""}>
                          <td className="px-4 py-3 text-xs font-medium text-gray-700">Slab {i + 1}</td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={1}
                              value={slab.minQty ?? ""}
                              onChange={(e) => updateSlab(i, { minQty: parseInt(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={1}
                              placeholder="∞"
                              value={slab.maxQty ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateSlab(i, { maxQty: v === "" ? null : parseInt(v) || 0 });
                              }}
                              className="h-8"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {/* Per slab the seller picks how the discount is
                                given: a percentage off the selling price,
                                or a flat rupee amount off each unit. */}
                            <Select
                              value={slab.discountType === "amount" ? "amount" : "percent"}
                              onValueChange={(v) =>
                                updateSlab(
                                  i,
                                  v === "amount"
                                    ? {
                                        discountType: "amount",
                                        slabAmount: slab.slabAmount ?? 0,
                                        slabPercent: undefined,
                                        slabPrice: undefined,
                                      }
                                    : {
                                        discountType: "percent",
                                        slabPercent: slab.slabPercent ?? 0,
                                        slabAmount: undefined,
                                        slabPrice: undefined,
                                      },
                                )
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percent">% Discount</SelectItem>
                                <SelectItem value="amount">Flat ₹ off</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            {slab.discountType === "percent" ? (
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  max={99.99}
                                  step={0.01}
                                  value={slab.slabPercent ?? ""}
                                  onChange={(e) => updateSlab(i, { slabPercent: parseFloat(e.target.value) })}
                                  className="h-8 pr-6"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                              </div>
                            ) : slab.discountType === "amount" ? (
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">₹</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  placeholder="off / unit"
                                  value={slab.slabAmount ?? ""}
                                  onChange={(e) => updateSlab(i, { slabAmount: parseFloat(e.target.value) })}
                                  className="h-8 pl-5"
                                />
                              </div>
                            ) : (
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">₹</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={slab.slabPrice ?? ""}
                                  onChange={(e) => updateSlab(i, { slabPrice: parseFloat(e.target.value) })}
                                  className="h-8 pl-5"
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-base font-medium text-green-700">₹{eff.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">per unit</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {saving > 0.01 ? (
                              <>
                                <p className="text-sm font-medium text-purple-700">
                                  ₹{saving.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-gray-500">{savingPct.toFixed(1)}% off</p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400">—</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeSlab(i)}
                              disabled={editorSlabs.length === 1}
                              title={editorSlabs.length === 1 ? "At least one slab is required" : "Remove slab"}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Effective-price explainer + last-slab fallback hint.
                  The MRP/SP figures used to be repeated on the right
                  of this strip — they're already shown prominently
                  in the Selected SKU panel above, so the duplicate
                  is removed. */}
              {selectedSku && (
                <div className="bg-gray-50 border-t border-gray-100 px-3 py-2 text-[11px] text-gray-600">
                  💡 Effective price = the per-unit price the{" "}
                  <b>customer pays</b> after the slab discount.{" "}
                  <span className="block sm:inline mt-0.5 sm:mt-0">
                    Orders above the last slab quantity will still get
                    the <b>highest slab discount</b>.
                  </span>
                </div>
              )}
            </div>
            )}

            {/* Validation errors */}
            {selectedSku && editorErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-800 mb-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {editorErrors.length} validation error{editorErrors.length === 1 ? "" : "s"}:
                </p>
                <ul className="space-y-1 text-xs text-red-700">
                  {editorErrors.map((err, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono font-semibold text-[10px] bg-red-100 text-red-800 border border-red-200 px-1 py-0.5 rounded shrink-0">
                        {err.code}
                      </span>
                      <span>{err.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditor}
              disabled={!selectedSku || editorErrors.length > 0}
              className=""
            >
              {editingId ? "Save Changes" : "Create QPS Scheme"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Right-side filter drawer — Status + Offer Type. Live page
          only ships QPS schemes, so the Offer Type dropdown surfaces
          a single option; the empty-mode demo page uses the same
          drawer with all 10 types. */}
      <ValueSlabEditorDialog
        open={isValueEditorOpen}
        onOpenChange={setIsValueEditorOpen}
        scheme={editingValueSlab}
        skuOptions={valueSlabSkuOptions}
        onSave={handleSaveValueSlab}
      />
      <ValueSlabViewDialog
        scheme={valueSlabs.find((v) => v.id === viewValueSlabId) ?? null}
        onClose={() => setViewValueSlabId(null)}
        onEdit={handleOpenEditValueSlab}
      />
      <OffInvoiceEditorDialog
        open={isOffInvoiceEditorOpen}
        onOpenChange={setIsOffInvoiceEditorOpen}
        scheme={editingOffInvoice}
        onSave={handleSaveOffInvoice}
      />
      <OffInvoiceViewDialog
        scheme={offInvoices.find((o) => o.id === viewOffInvoiceId) ?? null}
        onClose={() => setViewOffInvoiceId(null)}
        onEdit={handleOpenEditOffInvoice}
      />

      <OffersFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filterStatus={statusFilter}
        setFilterStatus={(v) => {
          setStatusFilter(v);
          setCurrentPage(1);
        }}
        filterOfferType={offerTypeFilter}
        setFilterOfferType={(v) => {
          setOfferTypeFilter(v);
          setCurrentPage(1);
        }}
        offerTypeOptions={OFFER_TYPES.filter((t) => t.id === "qps" || t.id === "value-slab" || t.id === "off-invoice").map<OfferTypeOption>((t) => ({
          value: t.id,
          label: t.label,
        }))}
        onClearFilters={() => {
          setStatusFilter("all");
          setOfferTypeFilter("all");
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
