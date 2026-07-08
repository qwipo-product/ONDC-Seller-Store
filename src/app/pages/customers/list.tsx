import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
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
import {
  Search,
  Filter,
  Download,
  Building2,
  Ban,
  CheckCircle2,
  X,
  ChevronRight,
  Eye,
  Users,
  Sparkles,
  MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ListPagination } from "../../components/ui/list-pagination";
import {
  getDemoCustomers,
  setDemoCompanyStatus,
  subscribeToDemoCustomers,
  getAddressCount,
  type CompanyLink as SharedCompanyLink,
  type DemoCustomer as SharedDemoCustomer,
} from "../../lib/customers-demo-data";
import { isEmptyMode } from "../../lib/data-mode";
import { EmptyState } from "../../components/empty-state";
import { CopyOnHover } from "../../components/copy-on-hover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";

// =====================================================================
// Customers — auto-register flow.
//
// In this model, customers don't go through a Pending → Approved
// approval queue. They auto-register on their first order and land in
// the list as Active immediately. The only post-registration state
// change is Block / Unblock, handled on the detail page.
//
// Each row represents ONE customer. Customers who buy across multiple
// companies surface a count badge ("2 companies" / "3 companies") in
// the Company column — clicking the badge opens a Linked Companies
// popup that shows each company name + per-company registration date.
// Brands no longer render in the row (they were noisy at row scale);
// the company is the identity that matters for scheduling.
//
// Routed at /customers. The legacy Pending/Approved/Rejected flow is
// preserved at /customers-demo for empty-mode reviewers.
// =====================================================================

// Types and seed live in lib/customers-demo-data.ts so the list page and
// the detail page (customer-demo-detail.tsx) share the same store.
type CompanyLink = SharedCompanyLink;
type DemoCustomer = SharedDemoCustomer;

// Seed data — 7 customers, two of whom span multiple companies so the
// count badge has interesting cases.

// CSV escape helper (one row per customer, with company list joined).
const escapeCsv = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function CustomersDemo() {
  const navigate = useNavigate();
  // Source of truth lives in lib/customers-demo-data.ts. We mirror it
  // in local state and re-pull on every store-change notification so
  // mutations from the detail page (or anywhere else) re-render here.
  //
  // Empty-mode (seller persona "Seller (Empty)") forces a zero-row
  // dataset for the inception-day screenshot. We seed `customers`
  // as [] and skip the store subscription so demo data never leaks
  // into the empty screen.
  const isEmpty = isEmptyMode();
  const [customers, setCustomersState] = useState<DemoCustomer[]>(() =>
    isEmpty ? [] : getDemoCustomers(),
  );
  useEffect(() => {
    if (isEmpty) return;
    return subscribeToDemoCustomers(() =>
      setCustomersState([...getDemoCustomers()]),
    );
  }, [isEmpty]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Per-row checkbox + bulk-action strip were retired in earlier
  // sweeps. The list is read-only at the row level; row-level
  // mutations (Block / Unblock) live on the detail page now.

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Linked Companies popup — shows the per-company breakdown for one
  // customer. Triggered by clicking the count badge in the Company
  // column. Hold only the id so per-company Block / Unblock mutations
  // re-flow through the latest `customers` state into the open popup.
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null);
  const linkedCustomer = useMemo(
    () =>
      linkedCustomerId
        ? customers.find((c) => c.customerId === linkedCustomerId) ?? null
        : null,
    [customers, linkedCustomerId],
  );

  // Companies derived from the dataset so the filter dropdown only
  // surfaces real values.
  const companyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    customers.forEach((c) =>
      c.companies.forEach((co) => seen.set(co.companyId, co.companyName)),
    );
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers.filter((c) => {
      const matchesSearch =
        q === "" ||
        c.customerName.toLowerCase().includes(q) ||
        c.businessName.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q) ||
        c.pincode.includes(q) ||
        c.companies.some((co) => co.companyName.toLowerCase().includes(q));
      // Status is per-company now — a customer matches the filter when at
      // least one of their company links is in the selected state.
      const matchesStatus =
        statusFilter === "all" ||
        c.companies.some((co) => co.status === statusFilter);
      const matchesCompany =
        companyFilter === "all" ||
        c.companies.some((co) => co.companyId === companyFilter);
      return matchesSearch && matchesStatus && matchesCompany;
    });
  }, [customers, searchQuery, statusFilter, companyFilter]);

  // Pagination slice
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filteredCustomers.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const filtersActive =
    statusFilter !== "all" || companyFilter !== "all";
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (companyFilter !== "all" ? 1 : 0);

  const handleClearFilters = () => {
    setStatusFilter("all");
    setCompanyFilter("all");
    setCurrentPage(1);
  };

  // Block / Unblock now lives on the detail page (lib/customers-demo-
  // data.ts → setDemoStatus). No list-side handlers needed.

  // ---- Export ----
  // CSV stays at line-item resolution (one row per (customer ×
  // company)) so downstream operations teams can still reconcile by
  // company.
  const handleExport = () => {
    const headers = [
      "Customer ID",
      "Customer Name",
      "Business Name",
      "Mobile",
      "Area",
      "PIN",
      // Geo coords from the customer record — surface them in the
      // export so downstream tooling (route planning, beat sheet
      // generation, etc.) can consume them without a join.
      "Lat",
      "Long",
      "Company",
      "Status",
      "Origin",
    ];
    const lines = [headers.join(",")];
    filteredCustomers.forEach((c) => {
      c.companies.forEach((co) => {
        lines.push(
          [
            c.customerId.toUpperCase(),
            c.customerName,
            c.businessName,
            c.mobile,
            c.area,
            c.pincode,
            c.latitude,
            c.longitude,
            co.companyName,
            co.status,
            c.origin ?? "first-order",
          ]
            .map(escapeCsv)
            .join(","),
        );
      });
    });
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-demo-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredCustomers.length} customer(s).`);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* KPI tiles removed per Phase 2 spec — the list page now starts
          directly with the toolbar + table. */}

      {/* Page area — Card stretches; only the rows scroll. */}
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
          {/* Header — search left, Export + Filters right */}
          <div className="border-b border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto flex-wrap">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, business, mobile, company, area, PIN…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-3 h-9"
                />
              </div>
            </div>
            {/* Filters + Export only render when there's data
                to filter or export. The empty-mode screen keeps
                the search bar (so the chrome reads as a real
                page) but drops these CTAs since neither has
                anything to act on. */}
            {!isEmpty && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {filtersActive && (
                    <Badge className="bg-blue-600 text-white border-blue-600 ml-1 h-5 px-1.5 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleExport}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            )}
          </div>

          {/* Bulk action bar was removed alongside the row checkbox
              column — Block lives on the detail page now, so the
              list has no bulk actions left. */}

          {/* Empty-mode short-circuit. The seller (Empty) persona
              should see no table chrome at all — just the search
              bar above and a clean empty state where the rows
              would go. The pagination underneath is also hidden
              in the same branch. */}
          {isEmpty ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Once retailers register against your brands from the buyer app, they'll auto-register as Active here and appear in this list."
              />
            </div>
          ) : (
            <>
          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Business Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Mobile
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Company
                  </th>
                  {/* Beat + Delivery Day columns were removed in the
                      June 2026 simplification sweep — those values now
                      live exclusively on the customer detail page,
                      under Linked Companies, where the per-company
                      breakdown belongs. The list keeps a clean
                      Identity → Company → Status → Action read. */}
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      No customers match your search or filters.
                    </td>
                  </tr>
                ) : (
                  paginated.map((c) => {
                    // Status is per-company — roll up for the row badge.
                    // All-Active and All-Blocked render the single state;
                    // anything else shows a "Mixed" amber badge so
                    // the seller knows to open the popup for detail.
                    const activeCount = c.companies.filter(
                      (co) => co.status === "Active",
                    ).length;
                    const blockedCount = c.companies.length - activeCount;
                    const allBlocked = activeCount === 0 && blockedCount > 0;
                    return (
                      <tr
                        key={c.customerId}
                        className={
                          (allBlocked ? "opacity-70 " : "") +
                          "hover:bg-gray-50 transition-colors"
                        }
                      >
                        {/* Business Name only — Customer Name was
                            dropped per Phase 2 spec so the row carries
                            one identity, not two. An "Auto-onboarded"
                            chip rides alongside the name when the row
                            originated from a polygon-sync sweep (vs.
                            the legacy first-order auto-register flow)
                            so the seller can tell at a glance which
                            customers exist *before* placing an order. */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CopyOnHover value={c.businessName} label="Business name">
                              <button
                                type="button"
                                className="text-left hover:underline focus:outline-none focus-visible:underline"
                                onClick={() =>
                                  navigate(`/customers/${c.customerId}`)
                                }
                                title={`View details for ${c.businessName}`}
                              >
                                <p className="font-medium text-gray-900 text-sm">
                                  {c.businessName}
                                </p>
                              </button>
                            </CopyOnHover>
                            {c.origin === "polygon-sync" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 h-5 px-1.5 text-[10px] cursor-help"
                                    >
                                      <Sparkles className="h-3 w-3" />
                                      Auto-onboarded
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    Created automatically when an admin
                                    configured serviceability covering
                                    this customer&apos;s location. No
                                    order required.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {/* Multi-address flag — the customer has more
                                than one delivery location, each mapping
                                to its own beats/days on the detail page. */}
                            {(() => {
                              const n = getAddressCount(c);
                              if (n <= 1) return null;
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex cursor-help">
                                        <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 h-5 px-1.5 text-[10px]">
                                          <MapPin className="h-3 w-3" />
                                          {n} addresses
                                        </Badge>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      This customer has {n} delivery
                                      addresses — each can be served by
                                      different companies and delivery
                                      days. Open the customer to see all.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <CopyOnHover value={c.mobile} label="Mobile number">
                            <p className="text-sm text-gray-700 font-mono">
                              {c.mobile}
                            </p>
                          </CopyOnHover>
                        </td>
                        {/* Company — count badge that opens the
                            Linked Companies popup. Mirrors the
                            "Approved" tab's pattern in the canonical
                            Customers page. */}
                        <td className="px-4 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                            onClick={() => setLinkedCustomerId(c.customerId)}
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            {c.companies.length}{" "}
                            {c.companies.length === 1 ? "company" : "companies"}
                            <ChevronRight className="h-3 w-3 opacity-60" />
                          </Button>
                        </td>
                        {/* Beat + Delivery Day cells removed — those
                            now live on the detail page (Linked
                            Companies card), since they're per-company
                            facts and don't roll up cleanly to a single
                            row. */}
                        <td className="px-4 py-3 text-center">
                          {blockedCount === 0 ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : allBlocked ? (
                            <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                              <Ban className="h-3 w-3" />
                              Blocked
                            </Badge>
                          ) : (
                            <Badge
                              className="bg-amber-50 text-amber-700 border-amber-200 gap-1"
                              title={`${activeCount} active · ${blockedCount} blocked`}
                            >
                              Mixed
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-blue-700 hover:bg-blue-50 hover:text-blue-700 h-8"
                              onClick={() =>
                                navigate(`/customers/${c.customerId}`)
                              }
                              title={`View details for ${c.businessName}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            {/* Block / Unblock has moved to per-company
                                rows — the seller acts inside the Linked
                                Companies popup or on the detail page. */}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <ListPagination
            page={currentPage}
            total={filteredCustomers.length}
            pageSize={itemsPerPage}
            onPageChange={setCurrentPage}
            itemLabel="customer"
          />
            </>
          )}
        </Card>
      </div>

      {/* Filters drawer — Status + Company */}
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
                    Status
                  </Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Company
                  </Label>
                  <Select
                    value={companyFilter}
                    onValueChange={(v) => {
                      setCompanyFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companyOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border-t border-gray-200 p-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleClearFilters();
                  }}
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

      {/* Block / Unblock dialogs are gone from the list page — they
          live on the detail page now. */}

      {/* Linked Companies popup — per-company breakdown for one
          customer. Mirrors the canonical "Linked Companies" popup
          on the Customers page. */}
      <Dialog
        open={linkedCustomer !== null}
        onOpenChange={(o) => !o && setLinkedCustomerId(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Linked Companies
            </DialogTitle>
            <DialogDescription>
              {linkedCustomer ? (
                <>
                  <b className="text-gray-900">{linkedCustomer.businessName}</b>
                  {" · "}
                  {linkedCustomer.companies.length}{" "}
                  {linkedCustomer.companies.length === 1 ? "company" : "companies"}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {linkedCustomer && (
            <div className="py-2 max-h-[60vh] overflow-y-auto">
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {/* Beat + Delivery Day were stripped from the popup
                    in June 2026 — the popup is for fast per-company
                    Block / Unblock, not a serviceability summary. The
                    detail page (Linked Companies card) is the canonical
                    place for beat + day. */}
                <div className="grid grid-cols-[minmax(0,1fr)_120px_130px] gap-3 px-3 py-2 bg-gray-50 text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                  <span>Company</span>
                  <span className="text-center">Status</span>
                  <span className="text-right">Action</span>
                </div>
                {linkedCustomer.companies.map((co) => {
                  return (
                  <div
                    key={co.companyId}
                    className="grid grid-cols-[minmax(0,1fr)_120px_130px] gap-3 px-3 py-2.5 items-center"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 text-gray-500 shrink-0" />
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {co.companyName}
                      </p>
                    </div>
                    <div className="flex justify-center">
                      {co.status === "Active" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                          <Ban className="h-3 w-3" />
                          Blocked
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-end">
                      {co.status === "Active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDemoCompanyStatus(
                              linkedCustomer.customerId,
                              co.companyId,
                              "Blocked",
                            );
                            toast.success(
                              `${linkedCustomer.businessName} blocked for ${co.companyName}.`,
                            );
                          }}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Block
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            setDemoCompanyStatus(
                              linkedCustomer.customerId,
                              co.companyId,
                              "Active",
                            );
                            toast.success(
                              `${linkedCustomer.businessName} unblocked for ${co.companyName}.`,
                            );
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Unblock
                        </Button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500 mt-2 px-1">
                Status and Block / Unblock are tracked per company. To
                see the beat name &amp; delivery day per address, open
                this customer&apos;s detail page.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setLinkedCustomerId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
