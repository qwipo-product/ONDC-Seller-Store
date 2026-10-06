import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ListPagination } from "../../components/ui/list-pagination";
import { EmptyState } from "../../components/empty-state";
import { CopyOnHover } from "../../components/copy-on-hover";
import {
  Building2,
  Clock,
  Download,
  Eye,
  Filter,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  buildCustomerExportCsv,
  DMS_COMPANIES,
  downloadCsv,
  getCustomerTab,
  getDmsCustomers,
  registrationProgress,
  subscribeToDmsCustomers,
  type DmsCustomer,
} from "../../lib/customers-dms-data";

// =====================================================================
// Customer Onboarding — list.
//
// New-customer requests from the buyer app. A single New Registrations
// tab: the distributor downloads the requests (see EXPORT_COLUMNS),
// hands the file to the company, and the company creates the customers
// in its DMS. There is no approval workflow on this page.
//
// Follows the design-system List Page Anatomy (Orders pattern): tab
// strip with Filters + Download on the right, applied-filter chips,
// search row with the "N selected" caption, table, pagination. The
// company filter lives in the standard right-side Filters drawer.
// =====================================================================

const PAGE_SIZE = 8;

export function CustomersDms() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<DmsCustomer[]>(() =>
    getDmsCustomers(),
  );
  useEffect(
    () => subscribeToDmsCustomers(() => setCustomers([...getDmsCustomers()])),
    [],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  // Only open requests are listed — fully registered and blocked
  // customers are out of scope for onboarding.
  const requests = useMemo(
    () => customers.filter((c) => getCustomerTab(c) === "new"),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((c) => {
      if (
        companyFilter !== "all" &&
        !c.companies.some((l) => l.companyId === companyFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        c.shopName.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        c.requestId.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.pincode.includes(q) ||
        c.companies.some((l) =>
          (l.dmsCustomerId ?? "").toLowerCase().includes(q),
        )
      );
    });
  }, [requests, searchQuery, companyFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedRows = requests.filter((c) => selected.includes(c.id));
  const activeCompany = DMS_COMPANIES.find((c) => c.id === companyFilter);

  const setCompany = (value: string) => {
    setCompanyFilter(value);
    setPage(1);
  };

  // ---- Download ----
  const handleDownload = () => {
    const rows = selectedRows.length > 0 ? selectedRows : filtered;
    if (rows.length === 0) {
      toast.error("Nothing to download.");
      return;
    }
    downloadCsv(
      `new-customer-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCustomerExportCsv(rows),
    );
    toast.success(
      `${rows.length} ${rows.length === 1 ? "request" : "requests"} downloaded.`,
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
          {/* Tab strip — Filters + Download right */}
          <div className="border-b border-gray-200 p-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-4 overflow-x-auto">
              <Tabs value="new">
                <TabsList className="bg-gray-100 p-1 rounded-lg inline-flex gap-1 h-auto flex-shrink-0">
                  <TabsTrigger
                    value="new"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    <span className="font-medium">
                      New Registrations ({requests.length})
                    </span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setIsFilterDrawerOpen(true)}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeCompany && (
                    <Badge className="bg-blue-600 text-white border-blue-600 ml-1 h-5 px-1.5 text-[10px]">
                      1
                    </Badge>
                  )}
                </Button>
                <Button className="gap-2" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  Download
                  {selectedRows.length > 0 && ` (${selectedRows.length})`}
                </Button>
              </div>
            </div>
          </div>

          {/* Applied filter chips */}
          {activeCompany && (
            <div className="px-6 py-2 border-b flex flex-wrap items-center gap-2 flex-shrink-0">
              <Badge
                variant="secondary"
                className="gap-1 pl-2 pr-1 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200"
              >
                {activeCompany.name}
                <button
                  onClick={() => setCompany("all")}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  aria-label={`Remove ${activeCompany.name} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompany("all")}
                className="text-gray-500 text-xs h-6"
              >
                Clear all
              </Button>
            </div>
          )}

          {requests.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={UserPlus}
                title="No new registrations"
                description="New customer requests from the buyer app will land here, ready to download and share with the company."
              />
            </div>
          ) : (
            <>
              {/* Search + selection caption */}
              <div className="px-6 py-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by shop, owner, mobile or request ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10 pr-10"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {selectedRows.length > 0 && (
                    <span className="text-sm text-gray-600">
                      {selectedRows.length} selected
                    </span>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <Checkbox
                          checked={
                            paged.length > 0 &&
                            paged.every((c) => selected.includes(c.id))
                          }
                          onCheckedChange={(v) =>
                            setSelected(
                              v
                                ? Array.from(
                                    new Set([
                                      ...selected,
                                      ...paged.map((c) => c.id),
                                    ]),
                                  )
                                : selected.filter(
                                    (id) => !paged.some((c) => c.id === id),
                                  ),
                            )
                          }
                          aria-label="Select all on this page"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Shop / Owner
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Companies
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Submitted
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paged.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-sm text-gray-500"
                        >
                          No registration requests match your search or
                          filters.
                        </td>
                      </tr>
                    ) : (
                      paged.map((c) => {
                        const progress = registrationProgress(c);
                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <Checkbox
                                checked={selected.includes(c.id)}
                                onCheckedChange={(v) =>
                                  setSelected((prev) =>
                                    v
                                      ? [...prev, c.id]
                                      : prev.filter((id) => id !== c.id),
                                  )
                                }
                                aria-label={`Select ${c.shopName}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <CopyOnHover value={c.shopName} label="Shop name">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(`/customer-onboarding/${c.id}`)
                                  }
                                  className="text-left hover:underline focus:outline-none focus-visible:underline"
                                  title={`View details for ${c.shopName}`}
                                >
                                  <p className="font-medium text-gray-900 text-sm">
                                    {c.shopName}
                                  </p>
                                </button>
                              </CopyOnHover>
                              <p className="text-xs text-gray-500">
                                {c.ownerName} · {c.classType}
                              </p>
                              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                {c.requestId}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <CopyOnHover value={c.mobile} label="Mobile number">
                                <p className="text-sm text-gray-700 font-mono">
                                  {c.mobile}
                                </p>
                              </CopyOnHover>
                              <p className="text-xs text-gray-500">
                                {c.gstNumber ?? (
                                  <span className="italic text-gray-400">
                                    No GSTIN
                                  </span>
                                )}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-900">{c.city}</p>
                              <p className="text-xs text-gray-500">
                                {c.area} · {c.pincode}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                <Building2 className="h-3.5 w-3.5" />
                                {c.companies.length}{" "}
                                {c.companies.length === 1
                                  ? "company"
                                  : "companies"}
                              </span>
                              <p className="text-[11px] text-gray-500 mt-1">
                                {progress.done} of {progress.total} registered
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {new Date(c.submittedAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-blue-700 hover:bg-blue-50 hover:text-blue-700 h-8"
                                onClick={() =>
                                  navigate(`/customer-onboarding/${c.id}`)
                                }
                                title={`View details for ${c.shopName}`}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <ListPagination
                page={page}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="request"
              />
            </>
          )}
        </Card>
      </div>

      {/* Filters drawer — Company */}
      <AnimatePresence>
        {isFilterDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsFilterDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close filters"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Company
                  </Label>
                  <Select value={companyFilter} onValueChange={setCompany}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {DMS_COMPANIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.operationMode === "wholesaler" ? " (wholesale)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border-t border-gray-200 p-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCompany("all")}
                  className="flex-1"
                >
                  Clear Filters
                </Button>
                <Button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="flex-1"
                >
                  Apply
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
