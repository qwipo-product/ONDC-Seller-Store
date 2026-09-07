import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Search, Receipt, Plus, Building2, Pencil } from "lucide-react";
import { EmptyState } from "../../components/empty-state";
import { ListPagination, paginate } from "../../components/ui/list-pagination";
import {
  getCompanies,
  subscribeToCompanies,
  type Company,
} from "../../lib/admin-catalog";
import {
  getChargeConfigs,
  subscribeToChargeConfigs,
  upsertChargeConfig,
  commerceRetailerPct,
  logisticsRetailerPerKg,
  logisticsRetailerPct,
  type ChargeConfig,
  type CommerceFeeConfig,
  type LogisticsFeeConfig,
  type BeatSmallOrderConfig,
} from "../../lib/charges-data";

const PAGE_SIZE = 10;
type StatusFilter = "all" | "active" | "inactive";

const pct = (n: number) => `${+n.toFixed(2)}%`;
const rupee = (n: number) => `₹${+n.toFixed(2)}`;

// Column text for each fee section. A disabled section reads "Disabled" on an
// active config and "Not Configured" on an inactive (stub) config.
function commerceText(c: CommerceFeeConfig, status: ChargeConfig["status"]): string {
  if (!c.enabled) return status === "inactive" ? "Not Configured" : "Disabled";
  if (c.method === "order_slab") {
    if (c.slabs.length === 0) return "Order Slab";
    const fees = c.slabs.map((s) => s.fee);
    return `Order Slab (${rupee(Math.min(...fees))} - ${rupee(Math.max(...fees))})`;
  }
  return `${pct(c.qwipoTargetPct)} / ${pct(commerceRetailerPct(c))}`;
}
function logisticsText(l: LogisticsFeeConfig, status: ChargeConfig["status"]): string {
  if (!l.enabled) return status === "inactive" ? "Not Configured" : "Disabled";
  if (l.method === "per_kg") {
    return `${rupee(l.qwipoTargetPerKg)}/kg / ${rupee(logisticsRetailerPerKg(l))}/kg`;
  }
  return `${pct(l.qwipoTargetPct)} / ${pct(logisticsRetailerPct(l))}`;
}
function beatText(b: BeatSmallOrderConfig, status: ChargeConfig["status"]): string {
  if (!b.enabled) return status === "inactive" ? "Not Configured" : "Disabled";
  return `${rupee(b.flatFeeBelowThreshold)} < ${rupee(b.freeDeliveryThreshold)}`;
}

// Relative "time ago" — e.g. "just now", "3 days ago", "2 weeks ago".
function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  const ago = (n: number, unit: string) => `${n} ${unit}${n > 1 ? "s" : ""} ago`;
  if (secs < 60) return "just now";
  if (mins < 60) return ago(mins, "min");
  if (hrs < 24) return ago(hrs, "hour");
  if (days < 7) return ago(days, "day");
  if (weeks < 5) return ago(weeks, "week");
  if (months < 12) return ago(months, "month");
  return ago(years, "year");
}

function Th({
  title,
  sub,
  align = "left",
}: {
  title: string;
  sub?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2.5 text-${align} text-xs font-semibold uppercase tracking-wider text-gray-600 align-bottom`}
    >
      <span className="whitespace-nowrap">{title}</span>
      {sub && (
        <span className="block normal-case font-normal text-[10px] text-gray-400">
          {sub}
        </span>
      )}
    </th>
  );
}

export function AdminCharges() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>(getCompanies());
  const [configs, setConfigs] = useState<ChargeConfig[]>(getChargeConfigs());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  // "Configure Brand" — pick a company to configure.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickCompanyId, setPickCompanyId] = useState("");

  useEffect(() => subscribeToCompanies(() => setCompanies([...getCompanies()])), []);
  useEffect(
    () => subscribeToChargeConfigs(() => setConfigs([...getChargeConfigs()])),
    [],
  );

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );

  const rows = useMemo(() => {
    return configs
      .map((cfg) => ({ cfg, company: companyById.get(cfg.companyId) }))
      .filter((r): r is { cfg: ChargeConfig; company: Company } => !!r.company)
      .filter((r) => {
        if (statusFilter !== "all" && r.cfg.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          return r.company.name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      });
  }, [configs, companyById, statusFilter, searchQuery]);

  const pageRows = paginate(rows, page, PAGE_SIZE);

  const toggleStatus = (cfg: ChargeConfig) => {
    upsertChargeConfig({
      ...cfg,
      status: cfg.status === "active" ? "inactive" : "active",
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {rows.length} brand{rows.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search brand (e.g. ITC, Adani)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="gap-2"
              onClick={() => {
                setPickCompanyId("");
                setPickerOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Configure Brand
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
          {rows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Receipt}
                title={
                  configs.length === 0
                    ? "No charges configured yet"
                    : "No brands found"
                }
                description={
                  configs.length === 0
                    ? "Configure a brand to set its commerce, logistics and beat charges."
                    : searchQuery
                      ? "No brands found — try a different search term."
                      : "No brands match the selected status."
                }
                action={
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setPickCompanyId("");
                      setPickerOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Configure Brand
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <Th title="Company" />
                      <Th title="Commerce Fee" />
                      <Th title="Logistics Fee" />
                      <Th title="Beat Small Order" />
                      <Th title="Status" />
                      <Th title="Last Updated" />
                      <Th title="Actions" align="right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageRows.map(({ cfg, company }) => {
                      const muted = (s: string) =>
                        s === "Not Configured" || s === "Disabled"
                          ? "text-gray-400"
                          : "text-gray-700";
                      const cText = commerceText(cfg.commerce, cfg.status);
                      const lText = logisticsText(cfg.logistics, cfg.status);
                      const bText = beatText(cfg.beat, cfg.status);
                      return (
                        <tr key={cfg.companyId} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-md border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                                {company.imageUrl ? (
                                  <img
                                    src={company.imageUrl}
                                    alt={company.name}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <Building2 className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                              <p
                                className="font-medium text-gray-900 text-sm truncate max-w-[140px]"
                                title={company.name}
                              >
                                {company.name}
                              </p>
                            </div>
                          </td>
                          <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${muted(cText)}`}>
                            {cText}
                          </td>
                          <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${muted(lText)}`}>
                            {lText}
                          </td>
                          <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${muted(bText)}`}>
                            {bText}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={cfg.status === "active"}
                                onCheckedChange={() => toggleStatus(cfg)}
                                aria-label={`Toggle ${company.name} active`}
                              />
                              <span
                                className={`text-xs font-medium ${
                                  cfg.status === "active"
                                    ? "text-green-700"
                                    : "text-gray-500"
                                }`}
                              >
                                {cfg.status === "active" ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                            {relativeTime(cfg.updatedAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Edit configuration"
                                onClick={() =>
                                  navigate(
                                    `/admin/charges/configure/${cfg.companyId}`,
                                  )
                                }
                              >
                                <Pencil className="h-4 w-4 text-gray-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ListPagination
                page={page}
                total={rows.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="brand"
              />
            </>
          )}
        </Card>
      </div>

      {/* Configure Brand — pick a company from the master catalog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              Configure Brand
            </DialogTitle>
            <DialogDescription>
              Pick a company from the Companies &amp; Brands catalog to set up its
              commerce, logistics and beat charges.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <label className="text-xs text-gray-700">Company</label>
            <Select value={pickCompanyId} onValueChange={setPickCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a company..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pickCompanyId}
              onClick={() => {
                setPickerOpen(false);
                navigate(`/admin/charges/configure/${pickCompanyId}`);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
