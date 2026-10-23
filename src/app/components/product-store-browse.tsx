import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Search,
  ChevronRight,
  ArrowLeft,
  Plus,
  CheckCircle2,
  Package,
  Building2,
  Tag,
  Info,
  Eye,
  X,
  MoreVertical,
  Pencil,
  PowerOff,
  Weight,
  MapPin,
  Factory,
  Hash,
  FileText,
  ShieldCheck,
  Ruler,
} from "lucide-react";
import {
  psCompanies,
  psBrands,
  psCategories,
  psSkus as defaultSkus,
  getSkusByBrand,
  getSkusByCompany,
  type PSCompany,
  type PSBrand,
  type PSSku,
  type PSSkuStatus,
} from "../lib/product-store-data";

type BrowseLevel = "companies" | "brands" | "skus";

export interface ProductStoreBrowseProps {
  mode?: "seller" | "admin";
  addedSkuIds?: Set<string>;
  skuList?: PSSku[];
  companyList?: PSCompany[];
  brandList?: PSBrand[];
  onAddSku?: (sku: PSSku) => void;
  onBulkImportCompany?: (company: PSCompany, e: React.MouseEvent) => void;
  onBulkImportBrand?: (brand: PSBrand, e: React.MouseEvent) => void;
  onEditSku?: (sku: PSSku) => void;
  onInactivateSku?: (sku: PSSku) => void;
  onRequestCompany?: () => void;
  onRequestBrand?: (company: PSCompany | null) => void;
  onRequestSku?: (company: PSCompany | null, brand: PSBrand | null) => void;
}

// ── SKU Detail Panel helpers ─────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0 w-36">{label}</span>
      <span
        className={`text-xs font-medium text-gray-900 text-right flex-1 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-3">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function SkuDetailPanel({
  sku,
  mode,
  isAdded,
  onAdd,
  onEdit,
  getCategory,
}: {
  sku: PSSku;
  mode: "seller" | "admin";
  isAdded: boolean;
  onAdd: () => void;
  onEdit?: () => void;
  getCategory: (id: string) => string;
}) {
  const brand = psBrands.find((b) => b.id === sku.brandId);
  const company = psCompanies.find((c) => c.id === sku.companyId);

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="px-5 pt-5 pb-4 border-b bg-gray-50">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 bg-white rounded-xl border-2 border-gray-200 flex items-center justify-center text-3xl flex-shrink-0">
            {sku.image}
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base font-semibold text-gray-900 leading-tight">
              {sku.name}
            </SheetTitle>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <code className="text-[11px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                {sku.skuCode}
              </code>
              {sku.status === "active" ? (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                  Active
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{sku.shortDescription}</p>
          </div>
        </div>

        <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
          <span>
            <strong>Read-only fields</strong> — managed by Catalog Admin,
            not editable by sellers.
          </span>
        </div>

        <div className="mt-3">
          {mode === "seller" ? (
            isAdded ? (
              <Badge className="w-full justify-center py-1.5 bg-green-50 text-green-700 border-green-200 gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Already in My SKU
              </Badge>
            ) : (
              <Button onClick={onAdd} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add to My SKU
              </Button>
            )
          ) : (
            <Button
              variant="outline"
              onClick={onEdit}
              className="w-full gap-2 text-teal-700 border-teal-300 hover:bg-teal-50"
            >
              <Pencil className="h-4 w-4" />
              Edit SKU
            </Button>
          )}
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto">
        {/* Descriptor (Product Identity) — matches sku-detail section name */}
        <DetailSection
          title="Descriptor (Product Identity)"
          icon={<Package className="h-3 w-3" />}
        >
          {sku.shortName && <DetailRow label="Short Name" value={sku.shortName} mono />}
          {sku.groupName && <DetailRow label="Group Name" value={sku.groupName} />}
          <DetailRow label="Short Description" value={sku.shortDescription} />
          <DetailRow label="Long Description" value={sku.longDescription} />
        </DetailSection>

        {/* Quantity & Inventory — matches sku-detail section name */}
        <DetailSection
          title="Quantity & Inventory"
          icon={<Weight className="h-3 w-3" />}
        >
          <DetailRow
            label="Pack Size (Inner Pack)"
            value={`${sku.packagingSize} ${sku.packagingUnit}`}
          />
          {sku.packageType && (
            <DetailRow
              label="Package Type"
              value={
                sku.packageTypeValue
                  ? `${sku.packageType} — ${sku.packageTypeValue}`
                  : sku.packageType
              }
            />
          )}
          <DetailRow label="Weight in KG" value={`${sku.productWeight} kg`} />
          {sku.upc && <DetailRow label="UPC (Unit Per Case)" value={sku.upc} mono />}
        </DetailSection>

        {/* Dimensions — matches sku-detail section name */}
        {(sku.productLength || sku.productWidth || sku.productHeight) && (
          <DetailSection
            title="Dimensions"
            icon={<Ruler className="h-3 w-3" />}
          >
            {sku.productLength && (
              <DetailRow label="Length" value={`${sku.productLength} cm`} />
            )}
            {sku.productWidth && (
              <DetailRow label="Width" value={`${sku.productWidth} cm`} />
            )}
            {sku.productHeight && (
              <DetailRow label="Height" value={`${sku.productHeight} cm`} />
            )}
            {sku.productLength && sku.productWidth && sku.productHeight && (
              <DetailRow
                label="Volumetric Weight"
                value={`${((sku.productLength * sku.productWidth * sku.productHeight) / 5000).toFixed(3)} kg`}
              />
            )}
          </DetailSection>
        )}

        {/* Category, Fulfillment & Location — matches sku-detail section name */}
        <DetailSection
          title="Category, Fulfillment & Location"
          icon={<ShieldCheck className="h-3 w-3" />}
        >
          <DetailRow label="Category ID" value={getCategory(sku.categoryId)} />
        </DetailSection>

        {/* Tax — matches sku-detail section name */}
        <DetailSection
          title="Tax"
          icon={<ShieldCheck className="h-3 w-3" />}
        >
          <DetailRow label="HSN Code" value={sku.hsnCode} mono />
          {sku.gstTax && <DetailRow label="GST Tax %" value={sku.gstTax} />}
          {sku.gstCess !== undefined && (
            <DetailRow label="GST Cess %" value={sku.gstCess ?? "0%"} />
          )}
        </DetailSection>

        {/* Company & Brand Information — matches sku-detail section name */}
        <DetailSection
          title="Company & Brand Information"
          icon={<ShieldCheck className="h-3 w-3" />}
        >
          <DetailRow label="Brand" value={brand?.name} />
          <DetailRow label="Company" value={company?.name} />
          <DetailRow label="Manufacturer / Packer Name" value={sku.manufacturerName} />
        </DetailSection>

        {/* Tags (Discovery & Attribute Enrichment) — matches sku-detail section name */}
        <DetailSection
          title="Tags (Discovery & Attribute Enrichment)"
          icon={<ShieldCheck className="h-3 w-3" />}
        >
          <DetailRow label="Country of Origin" value={sku.countryOfOrigin} />
        </DetailSection>

        <DetailSection
          title="Catalog Metadata"
          icon={<Hash className="h-3 w-3" />}
        >
          <DetailRow label="Created" value={sku.createdAt} />
          <DetailRow label="Last Updated" value={sku.updatedAt} />
        </DetailSection>
      </div>
    </div>
  );
}

// ── Main shared browse component ─────────────────────────────────────────────

export function ProductStoreBrowse({
  mode = "seller",
  addedSkuIds = new Set<string>(),
  skuList,
  companyList,
  brandList,
  onAddSku,
  onBulkImportCompany,
  onBulkImportBrand,
  onEditSku,
  onInactivateSku,
  onRequestCompany,
  onRequestBrand,
  onRequestSku,
}: ProductStoreBrowseProps) {
  const effectiveSkus = skuList ?? defaultSkus;
  const effectiveCompanies = companyList ?? psCompanies;
  const effectiveBrands = brandList ?? psBrands;

  // USER STORY NOTE: Currently shows ALL companies and brands from the Product Store.
  // When implementing the real API, this should be filtered to only show companies and
  // brands that are mapped to this seller in Seller Admin (i.e. the seller's approved
  // brand/company associations). psCompanies and psBrands below should be replaced with
  // seller-scoped lists fetched server-side. This filter must be enforced at the API
  // level, not just in the UI, to prevent sellers from browsing unmapped brands.

  const [level, setLevel] = useState<BrowseLevel>("companies");
  const [selectedCompany, setSelectedCompany] = useState<PSCompany | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<PSBrand | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PSSkuStatus>("all");
  const [detailSku, setDetailSku] = useState<PSSku | null>(null);

  const getCategory = (id: string) =>
    psCategories.find((c) => c.id === id)?.name ?? id;

  // Global cross-level search — active when query has 2+ chars
  const globalSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return null;
    const matchedCompanies = effectiveCompanies.filter((c) =>
      c.name.toLowerCase().includes(q)
    );
    const matchedBrands = effectiveBrands.filter((b) =>
      b.name.toLowerCase().includes(q)
    );
    const matchedSkus = effectiveSkus
      .filter((s) => (mode === "seller" ? s.status === "active" : true))
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) || s.skuCode.toLowerCase().includes(q)
      );
    return { companies: matchedCompanies, brands: matchedBrands, skus: matchedSkus };
  }, [searchQuery, effectiveSkus, effectiveCompanies, effectiveBrands, mode]);

  const isGlobalSearch = globalSearch !== null;

  const visibleCompanies = useMemo(
    () =>
      effectiveCompanies.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery, effectiveCompanies]
  );

  const visibleBrands = useMemo(() => {
    const brands = selectedCompany
      ? effectiveBrands.filter((b) => b.companyId === selectedCompany.id)
      : effectiveBrands;
    return brands.filter((b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [selectedCompany, searchQuery, effectiveBrands]);

  const visibleSkus = useMemo(() => {
    let skus = selectedBrand
      ? effectiveSkus.filter((s) => s.brandId === selectedBrand.id)
      : effectiveSkus;
    if (mode === "seller") skus = skus.filter((s) => s.status === "active");
    return skus.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.skuCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory =
        mode === "admin" || categoryFilter === "all" || s.categoryId === categoryFilter;
      const matchStatus =
        mode === "seller" || statusFilter === "all" || s.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [selectedBrand, effectiveSkus, searchQuery, categoryFilter, statusFilter, mode]);

  const goToCompanies = () => {
    setLevel("companies");
    setSelectedCompany(null);
    setSelectedBrand(null);
    setSearchQuery("");
  };
  const goToBrands = (company: PSCompany) => {
    setSelectedCompany(company);
    setSelectedBrand(null);
    setLevel("brands");
    setSearchQuery("");
  };
  const goToSkus = (brand: PSBrand) => {
    setSelectedBrand(brand);
    setLevel("skus");
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  const breadcrumbs = [
    { label: "All Companies", level: "companies" as BrowseLevel },
    ...(selectedCompany
      ? [{ label: selectedCompany.name, level: "brands" as BrowseLevel }]
      : []),
    ...(selectedBrand
      ? [{ label: selectedBrand.name, level: "skus" as BrowseLevel }]
      : []),
  ];

  const accentHover =
    mode === "admin" ? "hover:border-teal-400" : "hover:border-purple-400";
  const accentText =
    mode === "admin" ? "text-teal-600" : "text-purple-600";
  const accentChevron =
    mode === "admin"
      ? "text-teal-400 group-hover:text-teal-400"
      : "text-purple-400 group-hover:text-purple-400";
  const accentBg =
    mode === "admin" ? "hover:bg-teal-50" : "hover:bg-purple-50";
  const accentBreadcrumb =
    mode === "admin" ? "hover:text-teal-600" : "hover:text-purple-600";
  const accentDetails =
    mode === "admin"
      ? "text-teal-600 hover:text-teal-700 hover:bg-teal-50"
      : "text-purple-600 hover:text-purple-700 hover:bg-purple-50";

  // Metrics strip data
  const totalSkus = effectiveSkus.length;
  const activeSkus = effectiveSkus.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-4">
      {/* Metrics strip — companies level only */}
      {!isGlobalSearch && level === "companies" && (
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">
                {effectiveCompanies.length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Companies</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Tag className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">
                {effectiveBrands.length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Brands</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <Package className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">
                {mode === "admin" ? totalSkus : activeSkus}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {mode === "admin" ? "Total SKUs" : "SKUs"}
              </p>
            </div>
          </div>
          {mode === "seller" && (
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 leading-none">
                  {addedSkuIds.size}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">In My SKU</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info banner — seller only */}
      {mode === "seller" && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <Info className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-purple-900">
            <span className="font-medium">How it works:</span> Browse Company →
            Brand → SKU. Click <strong>Add to My SKU</strong> to import a product.
            If a Company, Brand, or SKU isn't listed, raise a request — our catalog team will add it.
          </p>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by SKU name, brand or company..."
            className="pl-10 pr-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!isGlobalSearch && level === "skus" && mode === "seller" && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {psCategories
                .filter((c) => !c.parentId)
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
        {!isGlobalSearch && level === "skus" && mode === "admin" && (
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "all" | PSSkuStatus)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        )}
        {mode === "seller" && !isGlobalSearch && level === "companies" && (
          <Button
            variant="outline"
            className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50"
            onClick={onRequestCompany}
          >
            <Building2 className="h-4 w-4" />
            Request a Company
          </Button>
        )}
        {mode === "seller" && !isGlobalSearch && level === "brands" && (
          <Button
            variant="outline"
            className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50"
            onClick={() => onRequestBrand?.(selectedCompany)}
          >
            <Tag className="h-4 w-4" />
            Request a Brand
          </Button>
        )}
        {mode === "seller" && (isGlobalSearch || level === "skus") && (
          <Button
            variant="outline"
            className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50"
            onClick={() => onRequestSku?.(selectedCompany, selectedBrand)}
          >
            <Package className="h-4 w-4" />
            Request a SKU
          </Button>
        )}
      </div>

      {/* Breadcrumbs */}
      {!isGlobalSearch && breadcrumbs.length > 1 && (
        <div className="flex items-center gap-1 text-sm text-gray-500">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {i < breadcrumbs.length - 1 ? (
                <button
                  className={`${accentBreadcrumb} hover:underline`}
                  onClick={() => {
                    if (crumb.level === "companies") goToCompanies();
                    else if (crumb.level === "brands" && selectedCompany)
                      goToBrands(selectedCompany);
                  }}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="font-medium text-gray-800">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Global search results ── */}
      {isGlobalSearch && globalSearch && (
        <Card>
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-sm flex items-center gap-2`}>
                <Search className={`h-4 w-4 ${accentText}`} />
                Search results for{" "}
                <span className={accentText}>"{searchQuery}"</span>
              </CardTitle>
              <span className="text-xs text-gray-400">
                {globalSearch.skus.length +
                  globalSearch.brands.length +
                  globalSearch.companies.length}{" "}
                results
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {/* SKU results */}
            {globalSearch.skus.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  SKUs ({globalSearch.skus.length})
                </p>
                <div className="divide-y divide-gray-100 rounded-lg border overflow-hidden">
                  {globalSearch.skus.map((sku) => {
                    const brand = effectiveBrands.find((b) => b.id === sku.brandId);
                    const company = brand
                      ? effectiveCompanies.find((c) => c.id === brand.companyId)
                      : null;
                    const isAdded = addedSkuIds.has(sku.id);
                    return (
                      <div
                        key={sku.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                          {sku.image}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm leading-tight truncate">
                            {sku.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                            <code className="bg-gray-100 px-1 rounded font-mono">
                              {sku.skuCode}
                            </code>
                            <span>·</span>
                            <span>
                              {company?.logo} {company?.name}
                            </span>
                            <span>›</span>
                            <span>
                              {brand?.logo} {brand?.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailSku(sku)}
                            className={`gap-1 h-7 text-xs ${accentDetails}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Button>
                          {mode === "seller" ? (
                            isAdded ? (
                              <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                In My SKU
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => onAddSku?.(sku)}
                                className="gap-1 h-7 text-xs"
                              >
                                <Plus className="h-3 w-3" />
                                Add
                              </Button>
                            )
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEditSku?.(sku)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit SKU
                                </DropdownMenuItem>
                                {sku.status !== "inactive" && (
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-700"
                                    onClick={() => onInactivateSku?.(sku)}
                                  >
                                    <PowerOff className="h-4 w-4 mr-2" />
                                    Make Inactive
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Brand results */}
            {globalSearch.brands.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  Brands ({globalSearch.brands.length})
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {globalSearch.brands.map((brand) => {
                    const company = effectiveCompanies.find(
                      (c) => c.id === brand.companyId
                    );
                    return (
                      <button
                        key={brand.id}
                        onClick={() => goToSkus(brand)}
                        className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 ${accentHover} hover:shadow-sm transition-all text-left group`}
                      >
                        <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1 flex-shrink-0 overflow-hidden">
                          <img
                            src={brand.imageUrl}
                            alt={brand.name}
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              const t = e.currentTarget;
                              t.style.display = "none";
                              const fb =
                                t.nextElementSibling as HTMLElement | null;
                              if (fb) fb.style.display = "block";
                            }}
                          />
                          <span className="hidden text-xl">{brand.logo}</span>
                        </div>
                        <div className="min-w-0">
                          <p className={`font-semibold text-sm text-gray-900 group-hover:${accentText} truncate`}>
                            {brand.name}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {company?.name} ·{" "}
                            <span className="font-medium">{brand.skuCount} SKUs</span>
                          </p>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-gray-300 ${accentChevron} ml-auto flex-shrink-0`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Company results */}
            {globalSearch.companies.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  Companies ({globalSearch.companies.length})
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {globalSearch.companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => goToBrands(company)}
                      className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 ${accentHover} hover:shadow-sm transition-all text-left group`}
                    >
                      <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1 flex-shrink-0 overflow-hidden">
                        <img
                          src={company.imageUrl}
                          alt={company.name}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            const t = e.currentTarget;
                            t.style.display = "none";
                            const fb =
                              t.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = "block";
                          }}
                        />
                        <span className="hidden text-xl">{company.logo}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm text-gray-900 group-hover:${accentText} truncate`}>
                          {company.name}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {company.activeBrands} brands · {company.skuCount} SKUs
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-gray-300 ${accentChevron} ml-auto flex-shrink-0`} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {globalSearch.skus.length === 0 &&
              globalSearch.brands.length === 0 &&
              globalSearch.companies.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  <Search className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="font-medium">No results for "{searchQuery}"</p>
                  {mode === "seller" && (
                    <p className="text-sm mt-1">
                      Can't find the SKU?{" "}
                      <button
                        className="text-purple-600 hover:underline font-medium"
                        onClick={() => onRequestSku?.(selectedCompany, selectedBrand)}
                      >
                        Request it from Catalog Admin →
                      </button>
                    </p>
                  )}
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* ── Level: Companies ── */}
      {!isGlobalSearch && level === "companies" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className={`text-base flex items-center gap-2`}>
              <Building2 className={`h-4 w-4 ${accentText}`} />
              Companies ({visibleCompanies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleCompanies.map((company) => {
                const companyActiveSkus = getSkusByCompany(company.id).filter(
                  (s) => s.status === "active"
                );
                const allAdded =
                  mode === "seller" &&
                  companyActiveSkus.length > 0 &&
                  companyActiveSkus.every((s) => addedSkuIds.has(s.id));
                const addedCount =
                  mode === "seller"
                    ? companyActiveSkus.filter((s) => addedSkuIds.has(s.id)).length
                    : 0;
                return (
                  <div
                    key={company.id}
                    className={`relative rounded-xl border-2 border-gray-200 ${accentHover} hover:shadow-md transition-all group overflow-hidden flex flex-col`}
                  >
                    <button
                      onClick={() => goToBrands(company)}
                      className="w-full text-left flex-1"
                    >
                      <div className="h-28 bg-white flex items-center justify-center p-5 border-b border-gray-100 relative">
                        <img
                          src={company.imageUrl}
                          alt={company.name}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            const t = e.currentTarget;
                            t.style.display = "none";
                            const fb =
                              t.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                        <div
                          className="hidden absolute inset-0 items-center justify-center"
                          style={{ background: company.color + "18" }}
                        >
                          <span
                            className="text-2xl font-bold tracking-tight"
                            style={{ color: company.color }}
                          >
                            {company.abbr}
                          </span>
                        </div>
                        <div className={`absolute top-2 right-2 ${accentText} opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="px-4 pt-3 pb-2">
                        <p className={`font-semibold text-gray-900 group-hover:${accentText} text-sm leading-tight`}>
                          {company.name}
                        </p>
                        <div className="flex gap-4 text-xs text-gray-500 mt-1">
                          <span>
                            <span className="font-bold text-gray-700">
                              {company.activeBrands}
                            </span>{" "}
                            brands
                          </span>
                          <span>
                            <span className="font-bold text-gray-700">
                              {company.skuCount}
                            </span>{" "}
                            SKUs
                          </span>
                        </div>
                      </div>
                    </button>
                    {mode === "seller" && (
                      <div className="px-4 pb-3 pt-2 border-t border-gray-100">
                        {allAdded ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            All {addedCount} SKUs in My SKU
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => onBulkImportCompany?.(company, e)}
                            className="w-full gap-1.5 h-7 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                          >
                            <Plus className="h-3 w-3" />
                            Import All SKUs
                            {addedCount > 0 && (
                              <span className="text-gray-400 font-normal">
                                ({addedCount}/{companyActiveSkus.length} added)
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {visibleCompanies.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No companies match your search.</p>
                {mode === "seller" && (
                  <p className="text-sm mt-1">
                    <button
                      className="text-purple-600 hover:underline font-medium"
                      onClick={onRequestCompany}
                    >
                      Request a Company →
                    </button>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Level: Brands ── */}
      {!isGlobalSearch && level === "brands" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToCompanies}
                className="gap-1 text-gray-500 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className={`h-4 w-4 ${accentText}`} />
                Brands under {selectedCompany?.name} ({visibleBrands.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleBrands.map((brand) => {
                const brandActiveSkus = getSkusByBrand(brand.id).filter(
                  (s) => s.status === "active"
                );
                const allAdded =
                  mode === "seller" &&
                  brandActiveSkus.length > 0 &&
                  brandActiveSkus.every((s) => addedSkuIds.has(s.id));
                const addedCount =
                  mode === "seller"
                    ? brandActiveSkus.filter((s) => addedSkuIds.has(s.id)).length
                    : 0;
                return (
                  <div
                    key={brand.id}
                    className={`relative rounded-xl border-2 border-gray-200 ${accentHover} hover:shadow-md transition-all group overflow-hidden flex flex-col`}
                  >
                    <button
                      onClick={() => goToSkus(brand)}
                      className="w-full text-left flex-1"
                    >
                      <div className="h-28 bg-white flex items-center justify-center p-5 border-b border-gray-100 relative">
                        <img
                          src={brand.imageUrl}
                          alt={brand.name}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            const t = e.currentTarget;
                            t.style.display = "none";
                            const fb =
                              t.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                        <div
                          className="hidden absolute inset-0 items-center justify-center"
                          style={{ background: brand.color + "18" }}
                        >
                          <span
                            className="text-2xl font-bold tracking-tight"
                            style={{ color: brand.color }}
                          >
                            {brand.abbr}
                          </span>
                        </div>
                        <div className={`absolute top-2 right-2 ${accentText} opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="px-4 pt-3 pb-2">
                        <p className={`font-semibold text-gray-900 group-hover:${accentText} text-sm leading-tight`}>
                          {brand.name}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          <span className="font-medium text-gray-700">{brand.skuCount}</span> SKUs
                        </p>
                      </div>
                    </button>
                    <div className="px-4 pb-3 pt-2 border-t border-gray-100">
                      {mode === "seller" ? (
                        allAdded ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            All {addedCount} SKUs in My SKU
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => onBulkImportBrand?.(brand, e)}
                            className="w-full gap-1.5 h-7 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                          >
                            <Plus className="h-3 w-3" />
                            Import All SKUs
                            {addedCount > 0 && (
                              <span className="text-gray-400 font-normal">
                                ({addedCount}/{brandActiveSkus.length} added)
                              </span>
                            )}
                          </Button>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {visibleBrands.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No brands found.</p>
                {mode === "seller" && (
                  <p className="text-sm mt-1">
                    <button
                      className="text-purple-600 hover:underline font-medium"
                      onClick={() => onRequestBrand?.(selectedCompany)}
                    >
                      Request a Brand →
                    </button>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Level: SKUs ── */}
      {!isGlobalSearch && level === "skus" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLevel("brands");
                  setSelectedBrand(null);
                  setSearchQuery("");
                }}
                className="gap-1 text-gray-500 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className={`h-4 w-4 ${accentText}`} />
                {selectedBrand?.name} SKUs ({visibleSkus.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {visibleSkus.length === 0 ? (
              <div className="text-center py-16 text-gray-500 px-6">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium">No SKUs found</p>
                {mode === "seller" && (
                  <p className="text-sm mt-1">
                    Can't find what you're looking for?{" "}
                    <button
                      className="text-purple-600 hover:underline font-medium"
                      onClick={() => onRequestSku?.(selectedCompany, selectedBrand)}
                    >
                      Request a SKU
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-16">
                      Image
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      SKU Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Category
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Packaging
                    </th>
                    {mode === "admin" && (
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                    )}
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Details
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {mode === "seller" ? "Action" : "Manage"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSkus.map((sku) => {
                    const isAdded = addedSkuIds.has(sku.id);
                    return (
                      <tr
                        key={sku.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-2xl shadow-sm">
                            {sku.image}
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="font-medium text-gray-900 leading-tight">
                            {sku.name}
                          </p>
                          <code className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono mt-0.5 inline-block">
                            {sku.skuCode}
                          </code>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                            {sku.shortDescription}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-700">
                            {getCategory(sku.categoryId)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-700">
                            {sku.packagingSize} {sku.packagingUnit}
                          </span>
                        </td>
                        {mode === "admin" && (
                          <>
                            <td className="px-4 py-3 text-center">
                              {sku.status === "active" ? (
                                <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-600 border-gray-300 gap-1 text-xs">
                                  Inactive
                                </Badge>
                              )}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailSku(sku)}
                            className={`gap-1 h-7 text-xs ${accentDetails}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {mode === "seller" ? (
                            isAdded ? (
                              <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                In My SKU
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => onAddSku?.(sku)}
                                className="gap-1 h-7 text-xs"
                              >
                                <Plus className="h-3 w-3" />
                                Add to My SKU
                              </Button>
                            )
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEditSku?.(sku)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit SKU
                                </DropdownMenuItem>
                                {sku.status !== "inactive" && (
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-700"
                                    onClick={() => onInactivateSku?.(sku)}
                                  >
                                    <PowerOff className="h-4 w-4 mr-2" />
                                    Make Inactive
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {visibleSkus.length > 0 && mode === "seller" && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Showing {visibleSkus.length} SKUs from {selectedBrand?.name}
                </span>
                <button
                  className="text-purple-600 hover:underline"
                  onClick={() => onRequestSku?.(selectedCompany, selectedBrand)}
                >
                  Can't find a SKU? Request it →
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── SKU Detail Sheet ── */}
      <Sheet open={!!detailSku} onOpenChange={() => setDetailSku(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          {detailSku && (
            <SkuDetailPanel
              sku={detailSku}
              mode={mode}
              isAdded={addedSkuIds.has(detailSku.id)}
              onAdd={() => {
                onAddSku?.(detailSku);
                setDetailSku(null);
              }}
              onEdit={() => {
                onEditSku?.(detailSku);
                setDetailSku(null);
              }}
              getCategory={getCategory}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
