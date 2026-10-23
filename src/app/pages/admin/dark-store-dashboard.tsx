// Admin → Dark Store → <Store> Dashboard
// -----------------------------------------------------------------
// How today's distributor network covers a dark store's zone. Only
// ACTIVE sellers' beats count, and only ACTIVE customers (Business
// Status "Active-User" + Status "Active") inside the zone are
// analysed. KPIs and distributions up top, the zone map, then
// seller / company / cluster / customer tables — each exportable —
// and the customer-level Beat Serviceability Report for the zone in
// the same format as Generate Report.
//
// Two coverage views (?view=full): Dark Store Only — customers inside
// the zone — and Dark Store + Seller Coverage — the zone plus the full
// reach of every beat touching it, split inside / outside the zone.
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { ListPagination } from "../../components/ui/list-pagination";
import { EmptyState } from "../../components/empty-state";
import { DarkStoreZoneMap, EXPOSURE_BANDS } from "../../components/dark-store-zone-map";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  Network,
  Search,
  Store,
  Target,
  UserCheck,
  Users,
  Warehouse,
  Waypoints,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildReportRowsUncached,
  buildSummaryReportRows,
  downloadCombinedReportXlsx,
  downloadReportCsv,
  downloadSummaryReportCsv,
  EXCEL_RAW_ROW_LIMIT,
  getCustomers,
  subscribeToCustomers,
} from "../../lib/customer-database";
import { subscribeToServiceabilityBeats } from "../../lib/serviceability-data";
import {
  buildDarkStoreAnalysis,
  clusterTable,
  companyTable,
  customerTable,
  downloadAnalyticsXlsx,
  downloadTableCsv,
  getDarkStore,
  SCOPE_LABEL,
  sellerTable,
  type Bucket,
  type CoverageScope,
  type DarkStoreAnalysis,
} from "../../lib/dark-store-data";

const fmt = (n: number) => n.toLocaleString("en-IN");

const DAY_SHORT: Record<string, string> = {
  "Next Day": "NDD",
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};
const shortDays = (days: string[]) =>
  days.length ? days.map((d) => DAY_SHORT[d] ?? d).join(", ") : "—";

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

type TabKey = "sellers" | "companies" | "clusters" | "customers";
const PAGE_SIZE = 20;

export function AdminDarkStoreDashboard() {
  const navigate = useNavigate();
  const { storeId = "" } = useParams();
  const store = getDarkStore(storeId);
  const [searchParams, setSearchParams] = useSearchParams();
  const scope: CoverageScope = searchParams.get("view") === "full" ? "full" : "zone";
  const setScope = (next: CoverageScope) =>
    setSearchParams(next === "full" ? { view: "full" } : {}, { replace: true });

  const [customers, setCustomers] = useState(getCustomers());
  const [beatsVersion, setBeatsVersion] = useState(0);
  useEffect(() => {
    const un1 = subscribeToCustomers(() => setCustomers([...getCustomers()]));
    const un2 = subscribeToServiceabilityBeats(() => setBeatsVersion((v) => v + 1));
    return () => {
      un1();
      un2();
    };
  }, []);

  // Both views, built off the render path so the loader paints before
  // the point-in-polygon pass runs: the zone first (the default view),
  // then the wider full-coverage pass — which the toggle also needs for
  // its counts.
  const [analyses, setAnalyses] = useState<
    Partial<Record<CoverageScope, DarkStoreAnalysis>>
  >({});
  useEffect(() => {
    if (!store) return;
    setAnalyses({});
    let tFull: ReturnType<typeof setTimeout> | undefined;
    const tZone = setTimeout(() => {
      setAnalyses({ zone: buildDarkStoreAnalysis(store, customers, "zone") });
      tFull = setTimeout(
        () =>
          setAnalyses((prev) => ({
            ...prev,
            full: buildDarkStoreAnalysis(store, customers, "full"),
          })),
        50,
      );
    }, 0);
    return () => {
      clearTimeout(tZone);
      clearTimeout(tFull);
    };
  }, [store, customers, beatsVersion]);
  const analysis = analyses[scope] ?? null;
  const full = scope === "full";

  // ---- Table state ----
  const [tab, setTab] = useState<TabKey>("sellers");
  const [search, setSearch] = useState("");
  const [exposure, setExposure] = useState("all");
  const [customerSort, setCustomerSort] = useState("nearest");
  const [location, setLocation] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [tab, search, exposure, customerSort, location, scope]);
  const [isExporting, setIsExporting] = useState(false);
  // Detailed report size = one row per matched beat (one for an
  // unmatched customer) — decides whether Excel can carry Raw Data.
  const rawRowCount = useMemo(
    () =>
      (analysis?.customers ?? []).reduce((n, z) => n + Math.max(1, z.beats.length), 0),
    [analysis],
  );
  const excelHasRaw = rawRowCount <= EXCEL_RAW_ROW_LIMIT;

  const q = search.trim().toLowerCase();
  const sellerRows = useMemo(
    () =>
      (analysis?.sellers ?? []).filter(
        (s) =>
          !q ||
          s.businessName.toLowerCase().includes(q) ||
          s.sellerName.toLowerCase().includes(q),
      ),
    [analysis, q],
  );
  const companyRows = useMemo(
    () =>
      (analysis?.companies ?? []).filter(
        (c) => !q || c.companyName.toLowerCase().includes(q),
      ),
    [analysis, q],
  );
  const clusterRows = useMemo(
    () =>
      (analysis?.clusters ?? []).filter((c) => !q || c.cluster.toLowerCase().includes(q)),
    [analysis, q],
  );
  const customerRows = useMemo(() => {
    const band = EXPOSURE_BANDS.find((b) => b.label === exposure);
    const rows = (analysis?.customers ?? []).filter((z) => {
      if (band && (z.companyNames.length < band.min || z.companyNames.length > band.max))
        return false;
      if (full && location !== "all" && z.insideZone !== (location === "inside")) return false;
      if (!q) return true;
      const c = z.customer;
      return (
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        c.customerId.toLowerCase().includes(q) ||
        c.cluster.toLowerCase().includes(q)
      );
    });
    const by =
      customerSort === "most"
        ? (a: (typeof rows)[number], b: (typeof rows)[number]) =>
            b.companyNames.length - a.companyNames.length
        : customerSort === "fewest"
          ? (a: (typeof rows)[number], b: (typeof rows)[number]) =>
              a.companyNames.length - b.companyNames.length
          : (a: (typeof rows)[number], b: (typeof rows)[number]) =>
              a.distanceKm - b.distanceKm;
    return [...rows].sort(by);
  }, [analysis, q, exposure, customerSort, full, location]);

  if (!store) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Store}
              title="Dark store not found"
              description="This dark store isn't configured. Pick one from the Dark Store menu."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Downloads ----
  const filePrefix = `${store.shortName.toLowerCase()}-dark-store${full ? "-full-coverage" : ""}`;

  const serviceabilityRows = () => {
    const zoneCustomers = analysis?.customers ?? [];
    const zoneBeatIds = new Set((analysis?.zoneBeats ?? []).map((b) => b.id));
    return buildReportRowsUncached(
      zoneCustomers.filter((z) => z.insideZone).map((z) => z.customer),
    ).concat(
      // Outside the zone only the beats touching it count — as on the page.
      buildReportRowsUncached(
        zoneCustomers.filter((z) => !z.insideZone).map((z) => z.customer),
        (b) => zoneBeatIds.has(b.id),
      ),
    );
  };

  const exportServiceabilityXlsx = async () => {
    setIsExporting(true);
    try {
      const rows = serviceabilityRows();
      const summary = buildSummaryReportRows(rows);
      const includeRaw = excelHasRaw;
      await downloadCombinedReportXlsx(
        summary,
        rows,
        `${filePrefix}_beat-serviceability-report_${stamp()}.xlsx`,
        { includeRaw },
      );
      toast.success(
        includeRaw
          ? `Downloaded Excel with ${fmt(summary.length)} summary rows + ${fmt(rows.length)} raw rows`
          : `Downloaded Excel with ${fmt(summary.length)} summary rows — use the Detailed CSV for raw rows`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  const exportServiceabilityCsv = (format: "summary" | "detailed") => {
    const rows = serviceabilityRows();
    if (format === "summary") {
      const summary = buildSummaryReportRows(rows);
      downloadSummaryReportCsv(
        summary,
        `${filePrefix}_beat-serviceability-summary_${stamp()}.csv`,
      );
      toast.success(`Downloaded ${fmt(summary.length)} summary rows as CSV`);
    } else {
      downloadReportCsv(rows, `${filePrefix}_beat-serviceability-detailed_${stamp()}.csv`);
      toast.success(`Downloaded ${fmt(rows.length)} rows as CSV`);
    }
  };

  const exportAnalytics = async () => {
    if (!analysis) return;
    setIsExporting(true);
    try {
      await downloadAnalyticsXlsx(analysis, `${filePrefix}_analytics_${stamp()}.xlsx`);
      toast.success(`Downloaded ${SCOPE_LABEL[scope]} analytics workbook`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportTab = () => {
    const name = (slug: string) => `${filePrefix}_${slug}_${stamp()}.csv`;
    if (tab === "sellers")
      downloadTableCsv(sellerTable(scope), sellerRows, name("seller-wise"));
    if (tab === "companies")
      downloadTableCsv(companyTable(scope), companyRows, name("company-wise"));
    if (tab === "clusters")
      downloadTableCsv(clusterTable(scope), clusterRows, name("cluster-wise"));
    if (tab === "customers")
      downloadTableCsv(customerTable(scope), customerRows, name("customer-exposure"));
    const count = {
      sellers: sellerRows.length,
      companies: companyRows.length,
      clusters: clusterRows.length,
      customers: customerRows.length,
    }[tab];
    toast.success(`Downloaded ${fmt(count)} rows as CSV`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{store.name}</h2>
            <Badge variant="secondary" className="text-xs">
              {store.radiusKm.toFixed(1)} km radius
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {store.locality} — how today's distributor network covers the zone. Only
            active sellers and active customers (Business Status Active-User, Status
            Active) are counted.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={!analysis || isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Report
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="text-xs text-gray-500 font-medium">
              Customer-level beat serviceability
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void exportServiceabilityXlsx()}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {excelHasRaw ? "Excel — Summary + Raw Data" : "Excel — Summary"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportServiceabilityCsv("summary")}>
              <Download className="h-4 w-4 mr-2" />
              CSV — Summary (one row per customer)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportServiceabilityCsv("detailed")}>
              <Download className="h-4 w-4 mr-2" />
              CSV — Detailed (one row per company beat)
            </DropdownMenuItem>
            {!excelHasRaw && (
              <p className="px-2 pb-1.5 text-[11px] text-gray-500 leading-snug">
                {fmt(rawRowCount)} detailed rows is more than an in-browser Excel build
                can hold — the Detailed CSV carries them.
              </p>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-gray-500 font-medium">
              Dashboard analytics
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void exportAnalytics()}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel — every table on this page
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Coverage view */}
      <div role="radiogroup" aria-label="Coverage view" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ScopeOption
          active={!full}
          onSelect={() => setScope("zone")}
          icon={Target}
          title={SCOPE_LABEL.zone}
          description={`Active customers inside the ${store.radiusKm.toFixed(1)} km zone`}
          stat={
            analyses.zone
              ? `${fmt(analyses.zone.customers.length)} active customers`
              : undefined
          }
        />
        <ScopeOption
          active={full}
          onSelect={() => setScope("full")}
          icon={Waypoints}
          title={SCOPE_LABEL.full}
          description="The zone plus the full reach of every seller beat that touches it"
          stat={
            analyses.full
              ? `${fmt(analyses.full.customers.length)} active customers · ${fmt(analyses.full.outsideCount)} outside the zone`
              : undefined
          }
        />
      </div>

      {!analysis ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-gray-900">
              {full
                ? "Following every zone beat past the boundary…"
                : "Matching zone customers against beat polygons…"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Users}
              tone="blue"
              value={fmt(analysis.customers.length)}
              label={full ? "Active Customers in Coverage" : "Active Customers in Zone"}
              hint={
                full
                  ? `${fmt(analysis.insideCount)} inside the zone · ${fmt(analysis.outsideCount)} outside`
                  : `of ${fmt(analysis.totalInZone)} customers in the zone`
              }
            />
            <KpiCard
              icon={CheckCircle2}
              tone="emerald"
              value={fmt(analysis.covered)}
              label="Active Customers Covered"
              hint={`${analysis.coveragePct}% see at least one company`}
            />
            <KpiCard
              icon={XCircle}
              tone="red"
              value={fmt(analysis.notCovered)}
              label="Not Covered"
              hint={
                full
                  ? "inside the zone, no active seller's beat reaches them"
                  : "no active seller's beat reaches them"
              }
            />
            <KpiCard
              icon={Store}
              tone="purple"
              value={fmt(analysis.sellers.length)}
              label="Sellers Covering Zone"
              hint={`${analysis.sellersReachingCustomers} reach active customers · ${analysis.activeSellerTotal} active sellers in network`}
            />
            <KpiCard
              icon={Building2}
              tone="indigo"
              value={fmt(analysis.companies.length)}
              label="Companies Available"
              hint={`across ${fmt(analysis.beatsInZone)} beats overlapping the zone · ${fmt(analysis.beatsExtendingOutside)} extend past it`}
            />
            <KpiCard
              icon={Layers}
              tone="amber"
              value={analysis.avgCompanies.toString()}
              label="Avg Companies / Customer"
              hint={`median ${analysis.medianCompanies} · max ${analysis.maxCompanies}`}
            />
            <KpiCard
              icon={Network}
              tone="sky"
              value={analysis.avgSellers.toString()}
              label="Avg Sellers / Customer"
              hint={`${fmt(analysis.sellerBuckets.find((b) => b.label === "1")?.count ?? 0)} customers rely on one seller`}
            />
            <KpiCard
              icon={UserCheck}
              tone="teal"
              value={fmt(analysis.avgCustomersPerSeller)}
              label="Avg Customers / Seller"
              hint="among sellers reaching active customers"
            />
          </div>

          {full && (
            <InsideOutsideCard
              inside={analysis.insideCount}
              outside={analysis.outsideCount}
              beats={analysis.beatsInZone}
              beatsExtending={analysis.beatsExtendingOutside}
              sellersOutside={analysis.sellers.filter((s) => s.customersOutside > 0).length}
              sellers={analysis.sellers.length}
            />
          )}

          {/* Map + exposure distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardContent className="p-4 flex flex-col gap-3 flex-1">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {full ? "Coverage Map" : "Zone Map"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {full
                      ? "The zone and the outline of every beat touching it; customers outside the zone are faded. Click a dot or warehouse for details."
                      : "Active customers coloured by how many companies they can order from; click a dot or warehouse for details."}
                  </p>
                </div>
                <DarkStoreZoneMap
                  key={scope}
                  analysis={analysis}
                  className="flex-1 min-h-[420px]"
                />
              </CardContent>
            </Card>
            <div className="space-y-4">
              <DistributionCard
                title="Companies visible per customer"
                caption="Active customers by the number of companies they see"
                buckets={analysis.companyBuckets}
                total={analysis.customers.length}
              />
              <DistributionCard
                title="Sellers per customer"
                caption="Active customers by the number of sellers serving them"
                buckets={analysis.sellerBuckets}
                total={analysis.customers.length}
              />
            </div>
          </div>

          {/* Day-wise reach */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Delivery-day reach</h3>
                <span className="text-xs text-gray-500">
                  — active customers with at least one company delivering that day
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {analysis.dayReach.map((d) => (
                  <div key={d.day} className="flex flex-col items-center gap-1.5">
                    <div className="h-24 w-full max-w-[56px] bg-gray-100 rounded-md flex items-end overflow-hidden">
                      <div
                        className="w-full bg-blue-500 rounded-md"
                        style={{ height: `${d.pct}%` }}
                        title={`${fmt(d.customers)} customers`}
                      />
                    </div>
                    <p className="text-xs font-medium text-gray-900">{d.pct}%</p>
                    <p className="text-[11px] text-gray-500">{DAY_SHORT[d.day] ?? d.day}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tables */}
          <Card>
            <CardContent className="p-0">
              <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
                <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                  <TabsList className="bg-gray-100 p-1 rounded-lg inline-flex gap-1 h-auto">
                    {(
                      [
                        ["sellers", "Seller-wise", analysis.sellers.length],
                        ["companies", "Company-wise", analysis.companies.length],
                        ["clusters", "Cluster-wise", analysis.clusters.length],
                        ["customers", "Customers", analysis.customers.length],
                      ] as const
                    ).map(([key, label, count]) => (
                      <TabsTrigger
                        key={key}
                        value={key}
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm"
                      >
                        {label}
                        <span className="ml-1.5 text-xs text-gray-500">{fmt(count)}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <div className="relative w-56">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={
                          tab === "customers"
                            ? "Search name, mobile, cluster…"
                            : tab === "companies"
                              ? "Search companies…"
                              : tab === "clusters"
                                ? "Search clusters…"
                                : "Search sellers…"
                        }
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {tab === "customers" && (
                      <>
                        {full && (
                          <Select value={location} onValueChange={setLocation}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Location" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All locations</SelectItem>
                              <SelectItem value="inside">Inside zone</SelectItem>
                              <SelectItem value="outside">Outside zone</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Select value={exposure} onValueChange={setExposure}>
                          <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Exposure" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All exposure</SelectItem>
                            {EXPOSURE_BANDS.map((b) => (
                              <SelectItem key={b.label} value={b.label}>
                                {b.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={customerSort} onValueChange={setCustomerSort}>
                          <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Sort" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nearest">Nearest first</SelectItem>
                            <SelectItem value="most">Most companies</SelectItem>
                            <SelectItem value="fewest">Fewest companies</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    <Button variant="outline" onClick={exportTab}>
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV
                    </Button>
                  </div>
                </div>

                <TabsContent value="sellers" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Seller</TableHead>
                        <TableHead>Customers Reached</TableHead>
                        {full && <TableHead>Inside / Outside Zone</TableHead>}
                        <TableHead className="text-right">Sole Seller For</TableHead>
                        <TableHead className="text-right">Beats in Zone</TableHead>
                        <TableHead className="text-right">Companies</TableHead>
                        <TableHead>Delivery Days</TableHead>
                        <TableHead>Warehouse</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellerRows.map((s) => (
                        <TableRow
                          key={s.sellerId}
                          className="cursor-pointer"
                          onClick={() => s.sellerId && navigate(`/admin/users/${s.sellerId}`)}
                        >
                          <TableCell>
                            <p className="font-medium text-gray-900">{s.businessName}</p>
                            <p className="text-xs text-gray-500">{s.sellerName || "—"}</p>
                          </TableCell>
                          <TableCell className="min-w-[180px]">
                            <ShareBar value={s.customersReached} pct={s.coveragePct} />
                          </TableCell>
                          {full && (
                            <TableCell>
                              <SplitBar inside={s.customersInside} outside={s.customersOutside} />
                            </TableCell>
                          )}
                          <TableCell className="text-right text-gray-700">
                            {fmt(s.soleSellerCustomers)}
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            {s.beatsInZone}
                            {s.beatsExtendingOutside > 0 && (
                              <p className="text-[11px] text-gray-400 whitespace-nowrap">
                                {s.beatsExtendingOutside} extend out
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className="text-gray-900 font-medium"
                              title={s.companyNames.join(", ")}
                            >
                              {s.companyNames.length}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">
                            {shortDays(s.deliveryDays)}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                            {s.warehouseKm != null ? `${s.warehouseKm} km` : "—"}
                            {s.warehouseInZone && (
                              <Badge className="ml-2 bg-violet-50 text-violet-700 hover:bg-violet-50">
                                <Warehouse className="h-3 w-3 mr-1" />
                                In zone
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      <NoRows show={sellerRows.length === 0} cols={full ? 8 : 7} />
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="companies" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Customers Reached</TableHead>
                        {full && <TableHead>Inside / Outside Zone</TableHead>}
                        <TableHead className="text-right">Sellers</TableHead>
                        <TableHead>Seller Names</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyRows.map((c) => (
                        <TableRow key={c.companyId}>
                          <TableCell className="font-medium text-gray-900">
                            {c.companyName}
                          </TableCell>
                          <TableCell className="min-w-[180px]">
                            <ShareBar value={c.customersReached} pct={c.coveragePct} />
                          </TableCell>
                          {full && (
                            <TableCell>
                              <SplitBar inside={c.customersInside} outside={c.customersOutside} />
                            </TableCell>
                          )}
                          <TableCell className="text-right text-gray-700">
                            {c.sellerNames.length}
                          </TableCell>
                          <TableCell
                            className="text-xs text-gray-600 max-w-[420px] truncate"
                            title={c.sellerNames.join(", ")}
                          >
                            {c.sellerNames.join(", ") || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <NoRows show={companyRows.length === 0} cols={full ? 5 : 4} />
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="clusters" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cluster</TableHead>
                        <TableHead className="text-right">Active Customers</TableHead>
                        {full && <TableHead>Inside / Outside Zone</TableHead>}
                        <TableHead className="text-right">Covered</TableHead>
                        <TableHead className="text-right">Not Covered</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead className="text-right">Avg Companies</TableHead>
                        <TableHead className="text-right">Avg Sellers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clusterRows.map((c) => (
                        <TableRow key={c.cluster}>
                          <TableCell className="font-medium text-gray-900">
                            {c.cluster}
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            {fmt(c.activeCustomers)}
                          </TableCell>
                          {full && (
                            <TableCell>
                              <SplitBar inside={c.inside} outside={c.outside} />
                            </TableCell>
                          )}
                          <TableCell className="text-right text-gray-700">
                            {fmt(c.covered)}
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            {fmt(c.activeCustomers - c.covered)}
                          </TableCell>
                          <TableCell className="min-w-[160px]">
                            <ShareBar pct={c.coveragePct} />
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            {c.avgCompanies}
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            {c.avgSellers}
                          </TableCell>
                        </TableRow>
                      ))}
                      <NoRows show={clusterRows.length === 0} cols={full ? 8 : 7} />
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="customers" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Business Type</TableHead>
                        <TableHead>Cluster</TableHead>
                        {full && <TableHead>Location</TableHead>}
                        <TableHead className="text-right">Distance</TableHead>
                        <TableHead className="text-right">Sellers</TableHead>
                        <TableHead>Companies</TableHead>
                        <TableHead>Delivery Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerRows
                        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                        .map((z) => (
                          <TableRow
                            key={z.customer.id}
                            className="cursor-pointer"
                            onClick={() => navigate(`/admin/customers/${z.customer.id}`)}
                          >
                            <TableCell>
                              <p className="font-medium text-gray-900">{z.customer.name}</p>
                              <p className="text-xs text-gray-500">
                                {z.customer.mobile || "—"}
                              </p>
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {z.customer.businessType || "—"}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {z.customer.cluster || "—"}
                            </TableCell>
                            {full && (
                              <TableCell>
                                {z.insideZone ? (
                                  <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50">
                                    Inside zone
                                  </Badge>
                                ) : (
                                  <Badge className="bg-sky-50 text-sky-700 hover:bg-sky-50">
                                    Outside zone
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="text-right text-gray-600 whitespace-nowrap">
                              {z.distanceKm} km
                            </TableCell>
                            <TableCell className="text-right text-gray-700">
                              {z.sellerIds.length}
                            </TableCell>
                            <TableCell>
                              {z.companyNames.length > 0 ? (
                                <Badge
                                  className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  title={z.companyNames.join(", ")}
                                >
                                  {z.companyNames.length}{" "}
                                  {z.companyNames.length === 1 ? "company" : "companies"}
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                                  Not covered
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600">
                              {shortDays(z.deliveryDays)}
                            </TableCell>
                          </TableRow>
                        ))}
                      <NoRows show={customerRows.length === 0} cols={full ? 8 : 7} />
                    </TableBody>
                  </Table>
                  <ListPagination
                    page={page}
                    total={customerRows.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    itemLabel="customer"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---- Pieces ----

const TONES = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
  indigo: "bg-indigo-50 text-indigo-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  teal: "bg-teal-50 text-teal-600",
} as const;

function KpiCard({
  icon: Icon,
  tone,
  value,
  label,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof TONES;
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DistributionCard({
  title,
  caption,
  buckets,
  total,
}: {
  title: string;
  caption: string;
  buckets: Bucket[];
  total: number;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{caption}</p>
        </div>
        <div className="space-y-2">
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3 text-xs">
              <span className="w-12 shrink-0 text-gray-600">{b.label}</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    b.label === "None" ? "bg-red-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-gray-700">
                {fmt(b.count)}
                <span className="text-gray-400">
                  {" "}
                  · {total ? Math.round((b.count / total) * 100) : 0}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Count (optional) + a thin share-of-zone bar with its percentage. */
function ShareBar({ value, pct }: { value?: number; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      {value !== undefined && (
        <span className="w-12 shrink-0 text-sm font-medium text-gray-900">{fmt(value)}</span>
      )}
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-xs text-gray-500">{pct}%</span>
    </div>
  );
}

/** One of the two coverage-view buttons above the KPIs. */
function ScopeOption({
  active,
  onSelect,
  icon: Icon,
  title,
  description,
  stat,
}: {
  active: boolean;
  onSelect: () => void;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  /** Undefined while that view is still being calculated. */
  stat?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={title}
      onClick={onSelect}
      className={`text-left rounded-xl border p-4 flex items-start gap-3 transition-colors ${
        active
          ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
        <p className="text-xs font-medium text-gray-700 mt-1.5 flex items-center gap-1.5">
          {stat ?? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Calculating…
            </>
          )}
        </p>
      </div>
      <span
        className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${
          active ? "border-blue-600 bg-blue-600 shadow-[inset_0_0_0_2px_white]" : "border-gray-300"
        }`}
      />
    </button>
  );
}

/** Full-coverage view: how the reached customers split across the zone boundary. */
function InsideOutsideCard({
  inside,
  outside,
  beats,
  beatsExtending,
  sellersOutside,
  sellers,
}: {
  inside: number;
  outside: number;
  beats: number;
  beatsExtending: number;
  sellersOutside: number;
  sellers: number;
}) {
  const total = inside + outside;
  const insidePct = total ? Math.round((inside / total) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Inside vs outside the dark store zone
          </h3>
          <p className="text-xs text-gray-500">
            Active customers reached by the {fmt(beats)} seller beats that touch the zone —
            beats cross the boundary, so they also serve customers outside it.
          </p>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
          <div className="bg-violet-500" style={{ width: `${insidePct}%` }} />
          {total > 0 && <div className="bg-sky-400 flex-1" />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-500 shrink-0" />
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {fmt(inside)} <span className="text-sm font-normal text-gray-500">· {insidePct}%</span>
              </p>
              <p className="text-xs text-gray-500">Inside the zone</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-400 shrink-0" />
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {fmt(outside)}{" "}
                <span className="text-sm font-normal text-gray-500">
                  · {total ? 100 - insidePct : 0}%
                </span>
              </p>
              <p className="text-xs text-gray-500">Outside the zone</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Waypoints className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {fmt(beatsExtending)}{" "}
                <span className="text-sm font-normal text-gray-500">of {fmt(beats)} beats</span>
              </p>
              <p className="text-xs text-gray-500">
                extend past the boundary · {sellersOutside} of {sellers} sellers reach outside
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Two-tone inside (violet) / outside (sky) bar with both counts. */
function SplitBar({ inside, outside }: { inside: number; outside: number }) {
  const total = inside + outside;
  const insidePct = total ? (inside / total) * 100 : 0;
  return (
    <div className="min-w-[140px]">
      <div className="flex h-1.5 max-w-[140px] rounded-full overflow-hidden bg-gray-100">
        <div className="bg-violet-500" style={{ width: `${insidePct}%` }} />
        {total > 0 && <div className="bg-sky-400 flex-1" />}
      </div>
      <p className="text-[11px] text-gray-500 mt-1 whitespace-nowrap">
        <span className="font-medium text-violet-700">{fmt(inside)}</span> in ·{" "}
        <span className="font-medium text-sky-700">{fmt(outside)}</span> out
      </p>
    </div>
  );
}

function NoRows({ show, cols }: { show: boolean; cols: number }) {
  if (!show) return null;
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-sm text-gray-500">
        Nothing matches the search.
      </TableCell>
    </TableRow>
  );
}
