// Admin → Generate Report
// -----------------------------------------------------------------
// Filter-first report builder. The earlier version rendered the whole
// exploded (customer × beat) table inline — with real production
// rosters that's thousands of rows of DOM for no reason. Now the page
// is a download builder: pick region → sellers → delivery days (plus
// company/status), see how many rows match, and download CSV/Excel.
// The full data only ever materializes inside the exported file.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  FileSpreadsheet,
  Download,
  Users,
  Rows3,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  MapPin,
  Store,
  CalendarDays,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "../../components/empty-state";
import {
  buildReportRowsAsync,
  buildSummaryReportRows,
  EXCEL_RAW_ROW_LIMIT,
  type ReportRow,
  downloadCombinedReportXlsx,
  downloadReportCsv,
  downloadSummaryReportCsv,
  getCustomers,
  subscribeToCustomers,
} from "../../lib/customer-database";
import {
  getServiceabilityBeats,
  subscribeToServiceabilityBeats,
} from "../../lib/serviceability-data";
import { DELIVERY_DAY_OPTIONS } from "../../lib/customers-data";
import { getSellers, type Seller } from "../../lib/mock-store";

export function AdminServiceabilityReport() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState(getCustomers());
  const [beatsVersion, setBeatsVersion] = useState(0);

  useEffect(() => {
    const un1 = subscribeToCustomers(() => setCustomers([...getCustomers()]));
    const un2 = subscribeToServiceabilityBeats(() =>
      setBeatsVersion((v) => v + 1),
    );
    return () => {
      un1();
      un2();
    };
  }, []);

  // ---- Filter state ----
  const [stateFilter, setStateFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sellerSearch, setSellerSearch] = useState("");
  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(
    () => new Set(),
  );
  const [dayFilter, setDayFilter] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  // "summary" collapses to one row per (customer, seller, delivery-day
  // set); "detailed" keeps one row per company beat.
  const [reportFormat, setReportFormat] = useState<"summary" | "detailed">(
    "summary",
  );

  // ---- Every distributor, with region metadata. Sellers without any
  // delivery beats contribute no rows, but stay visible in the picker
  // (0 beats) so the roster reads complete against production. ----
  const relevantSellers = useMemo(() => {
    void beatsVersion;
    return [...getSellers()].sort((a, b) => a.name.localeCompare(b.name));
  }, [beatsVersion]);

  const beatCountBySeller = useMemo(() => {
    void beatsVersion;
    const map = new Map<string, number>();
    for (const b of getServiceabilityBeats()) {
      if (b.sellerId) map.set(b.sellerId, (map.get(b.sellerId) ?? 0) + 1);
    }
    return map;
  }, [beatsVersion]);

  const stateOptions = useMemo(
    () =>
      [...new Set(relevantSellers.map((s) => s.state).filter(Boolean))].sort() as string[],
    [relevantSellers],
  );

  const cityOptions = useMemo(
    () =>
      [
        ...new Set(
          relevantSellers
            .filter((s) => stateFilter === "all" || s.state === stateFilter)
            .map((s) => s.city)
            .filter(Boolean),
        ),
      ].sort(),
    [relevantSellers, stateFilter],
  );

  // Sellers inside the currently selected region.
  const regionSellers = useMemo(
    () =>
      relevantSellers.filter(
        (s) =>
          (stateFilter === "all" || s.state === stateFilter) &&
          (cityFilter === "all" || s.city === cityFilter),
      ),
    [relevantSellers, stateFilter, cityFilter],
  );

  // Region change re-baselines the seller selection to "everyone in
  // the region" — the natural starting point for a narrower download.
  useEffect(() => {
    setSelectedSellers(new Set(regionSellers.map((s) => s.id)));
  }, [regionSellers]);

  const visibleSellers = useMemo(() => {
    const q = sellerSearch.trim().toLowerCase();
    if (!q) return regionSellers;
    return regionSellers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.businessName.toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q),
    );
  }, [regionSellers, sellerSearch]);

  const toggleSeller = (id: string) => {
    setSelectedSellers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    regionSellers.length > 0 &&
    regionSellers.every((s) => selectedSellers.has(s.id));
  const toggleAllSellers = () => {
    setSelectedSellers(
      allSelected ? new Set() : new Set(regionSellers.map((s) => s.id)),
    );
  };

  const toggleDay = (day: string) => {
    setDayFilter((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const companyOptions = useMemo(() => {
    void beatsVersion;
    const names = new Set(getServiceabilityBeats().map((b) => b.companyName));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [beatsVersion]);

  // ---- Row building + filtering ----
  //
  // The exploded (customer × beat) table is built OFF the render path,
  // in chunks — a production roster explodes into a few hundred
  // thousand rows, and building that synchronously inside a useMemo
  // froze the page on navigation. While it runs the page shows live
  // progress; repeat visits hit the module-level cache and resolve
  // instantly.
  const [allRows, setAllRows] = useState<ReportRow[]>([]);
  const [buildProgress, setBuildProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    void beatsVersion;
    let cancelled = false;
    setBuildProgress({ done: 0, total: customers.length });
    void buildReportRowsAsync(customers, (done, total) => {
      if (!cancelled) setBuildProgress({ done, total });
    }).then((rows) => {
      if (cancelled) return;
      setAllRows(rows);
      setBuildProgress(null);
    });
    return () => {
      cancelled = true;
    };
  }, [customers, beatsVersion]);

  // Any region/seller narrowing excludes rows that carry no seller
  // (i.e. "Not Serviceable" rows) — they belong to nobody's territory.
  const sellerFilterActive =
    stateFilter !== "all" ||
    cityFilter !== "all" ||
    selectedSellers.size < relevantSellers.length;

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (statusFilter === "serviceable" && !r.serviceable) return false;
      if (statusFilter === "not-serviceable" && r.serviceable) return false;
      if (companyFilter !== "all") {
        if (!r.serviceable || r.companyName !== companyFilter) return false;
      }
      if (dayFilter.length > 0) {
        if (!r.serviceable) return false;
        if (!dayFilter.some((d) => r.deliveryDays.includes(d))) return false;
      }
      if (sellerFilterActive) {
        if (!r.sellerId || !selectedSellers.has(r.sellerId)) return false;
      }
      return true;
    });
  }, [
    allRows,
    statusFilter,
    companyFilter,
    dayFilter,
    sellerFilterActive,
    selectedSellers,
  ]);

  const summaryRows = useMemo(() => buildSummaryReportRows(rows), [rows]);
  const downloadCount =
    reportFormat === "summary" ? summaryRows.length : rows.length;

  const stats = useMemo(() => {
    const customerKey = (r: (typeof allRows)[number]) =>
      `${r.customerId}|${r.mobile}|${r.lat}|${r.lng}`;
    const serviceableCustomers = new Set(
      allRows.filter((r) => r.serviceable).map(customerKey),
    ).size;
    const selectedCustomers = new Set(rows.map(customerKey)).size;
    return {
      customers: customers.length,
      serviceableCustomers,
      selectedCustomers,
      rows: rows.length,
      totalRows: allRows.length,
    };
  }, [allRows, rows, customers]);

  // ---- Downloads ----
  const [isExporting, setIsExporting] = useState(false);

  const stamp = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  };

  const filenameHint = () => {
    const parts: string[] = [];
    if (cityFilter !== "all") parts.push(cityFilter.toLowerCase().replace(/\s+/g, "-"));
    else if (stateFilter !== "all") parts.push(stateFilter.toLowerCase().replace(/\s+/g, "-"));
    if (dayFilter.length === 1) parts.push(dayFilter[0].toLowerCase().replace(/\s+/g, "-"));
    return parts.length > 0 ? `_${parts.join("_")}` : "";
  };

  const baseFilename = () =>
    `beat-serviceability-${reportFormat === "summary" ? "summary" : "report"}${filenameHint()}_${stamp()}`;

  const exportCsv = () => {
    if (reportFormat === "summary") {
      downloadSummaryReportCsv(summaryRows, `${baseFilename()}.csv`);
    } else {
      downloadReportCsv(rows, `${baseFilename()}.csv`);
    }
    toast.success(
      `Downloaded ${downloadCount.toLocaleString("en-IN")} rows as CSV`,
    );
  };

  // Excel ships BOTH views — a "Summary" tab plus the "Raw Data" tab
  // it was built from — UNLESS the raw data is too large to build
  // in-browser (ExcelJS holds every cell in memory; past the limit it
  // crashes the tab). Then the workbook is summary-only and the raw
  // detail is available as a Detailed CSV, which has no such ceiling.
  const exportXlsx = async () => {
    setIsExporting(true);
    try {
      const includeRaw = rows.length <= EXCEL_RAW_ROW_LIMIT;
      await downloadCombinedReportXlsx(
        summaryRows,
        rows,
        `beat-serviceability-report${filenameHint()}_${stamp()}.xlsx`,
        { includeRaw },
      );
      if (includeRaw) {
        toast.success(
          `Downloaded Excel with ${summaryRows.length.toLocaleString("en-IN")} summary rows + ${rows.length.toLocaleString("en-IN")} raw rows`,
        );
      } else {
        toast.success(
          `Downloaded Excel with ${summaryRows.length.toLocaleString("en-IN")} summary rows`,
        );
        toast.info(
          `Raw Data tab skipped — ${rows.length.toLocaleString("en-IN")} rows is too large for an in-browser Excel build. Switch the format to "Detailed" and use Download CSV for the full row-level data, or narrow the filters.`,
          { duration: 10000 },
        );
      }
    } finally {
      setIsExporting(false);
    }
  };

  const resetFilters = () => {
    setStateFilter("all");
    setCityFilter("all");
    setSellerSearch("");
    setSelectedSellers(new Set(relevantSellers.map((s) => s.id)));
    setDayFilter([]);
    setCompanyFilter("all");
    setStatusFilter("all");
  };

  const filtersActive =
    sellerFilterActive ||
    dayFilter.length > 0 ||
    companyFilter !== "all" ||
    statusFilter !== "all";

  const sellerLabel = (s: Seller) =>
    [s.city, s.state].filter(Boolean).join(", ");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Beat Serviceability Report
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            One row per customer per company beat that covers them. Narrow the
            report by region, seller and delivery day, then download — the full
            data only lives in the file.
          </p>
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Reset filters
          </Button>
        )}
      </div>

      {customers.length > 0 && buildProgress ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">
                Matching customers against beat polygons…
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {buildProgress.done.toLocaleString("en-IN")} of{" "}
                {buildProgress.total.toLocaleString("en-IN")} customers
              </p>
            </div>
            <div className="w-64 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{
                  width: `${
                    buildProgress.total === 0
                      ? 0
                      : Math.round(
                          (buildProgress.done / buildProgress.total) * 100,
                        )
                  }%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileSpreadsheet}
              title="No customers to report on"
              description="Upload your customer roster in the Customer Database first — the report is generated by matching each customer's lat/long against every company's beat polygons."
              action={
                <Button onClick={() => navigate("/admin/customers")}>
                  <Upload className="h-4 w-4 mr-2" />
                  Go to Customer Database
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.customers.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-gray-500">Customers</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.serviceableCustomers.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-gray-500">Serviceable Customers</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {(stats.customers - stats.serviceableCustomers).toLocaleString(
                      "en-IN",
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Not Serviceable</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Rows3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {downloadCount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-gray-500">Rows in Download</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter builder */}
          <Card>
            <CardContent className="p-0">
              <div className="p-5 space-y-6">
                {/* 1 — Region */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      1. Region
                    </h3>
                    <span className="text-xs text-gray-500">
                      — narrow by seller state and city
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      value={stateFilter}
                      onValueChange={(v) => {
                        setStateFilter(v);
                        setCityFilter("all");
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        {stateOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="City" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Cities</SelectItem>
                        {cityOptions.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 2 — Sellers */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Store className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      2. Sellers
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {selectedSellers.size} of {regionSellers.length} selected
                    </Badge>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-w-2xl">
                    <div className="p-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer shrink-0">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAllSellers}
                        />
                        Select all
                      </label>
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          placeholder="Search sellers…"
                          value={sellerSearch}
                          onChange={(e) => setSellerSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                      {visibleSellers.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500 text-center">
                          No sellers
                          {sellerSearch ? ` match "${sellerSearch}"` : " in this region"}
                          .
                        </p>
                      ) : (
                        visibleSellers.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <Checkbox
                              checked={selectedSellers.has(s.id)}
                              onCheckedChange={() => toggleSeller(s.id)}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-gray-900 truncate">
                                {s.name}
                                <span className="font-normal text-gray-500">
                                  {" "}
                                  · {s.businessName}
                                </span>
                              </span>
                              <span className="block text-xs text-gray-500 truncate">
                                {sellerLabel(s) || "No region on record"}
                              </span>
                            </span>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {beatCountBySeller.get(s.id) ?? 0} beats
                            </Badge>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 3 — Delivery days */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      3. Delivery Days
                    </h3>
                    <span className="text-xs text-gray-500">
                      — none selected = all days
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={dayFilter.length === 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDayFilter([])}
                    >
                      All Days
                    </Button>
                    {DELIVERY_DAY_OPTIONS.map((d) => (
                      <Button
                        key={d}
                        variant={dayFilter.includes(d) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDay(d)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 4 — More filters */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      4. More Filters
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Company" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Companies</SelectItem>
                        {companyOptions.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[190px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="serviceable">
                          Serviceable only
                        </SelectItem>
                        <SelectItem value="not-serviceable">
                          Not Serviceable only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 5 — Report format */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      5. Report Format
                    </h3>
                    <span className="text-xs text-gray-500">
                      — applies to CSV; Excel always includes both tabs
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={reportFormat === "summary" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReportFormat("summary")}
                    >
                      Summary — one row per customer
                    </Button>
                    <Button
                      variant={reportFormat === "detailed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReportFormat("detailed")}
                    >
                      Detailed — one row per company beat
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {reportFormat === "summary"
                      ? "Rows sharing the same customer, seller and delivery days collapse into one (companies are counted). A customer only gets extra rows when part of their supply arrives on a different day-set."
                      : "Every (customer × company beat) match is its own row — the full data the summary is built from."}{" "}
                    {rows.length <= EXCEL_RAW_ROW_LIMIT
                      ? "The Excel download carries a Summary tab and a Raw Data tab in one workbook."
                      : `With ${rows.length.toLocaleString("en-IN")} raw rows the Excel download is summary-only (the raw tab would exceed what the browser can build) — use the Detailed CSV for full row-level data.`}
                  </p>
                </div>
              </div>

              {/* Download bar */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 flex flex-wrap items-center gap-3">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">
                    {downloadCount.toLocaleString("en-IN")}
                  </span>{" "}
                  {reportFormat === "summary" ? "summary rows" : "rows"} across{" "}
                  <span className="font-semibold">
                    {stats.selectedCustomers.toLocaleString("en-IN")}
                  </span>{" "}
                  customers match the filters
                  <span className="text-gray-500">
                    {" "}
                    (from {stats.rows.toLocaleString("en-IN")} beat matches, of{" "}
                    {stats.totalRows.toLocaleString("en-IN")} total)
                  </span>
                </p>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    onClick={exportCsv}
                    disabled={downloadCount === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                  <Button
                    onClick={() => void exportXlsx()}
                    disabled={downloadCount === 0 || isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    {rows.length <= EXCEL_RAW_ROW_LIMIT
                      ? "Download Excel (Summary + Raw)"
                      : "Download Excel (Summary only)"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
