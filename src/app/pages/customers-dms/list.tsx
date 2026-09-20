import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
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
import { ListPagination } from "../../components/ui/list-pagination";
import {
  BulkImportDialog,
  type BulkImportValidationResult,
} from "../../components/bulk-import-dialog";
import { EmptyState } from "../../components/empty-state";
import {
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  applyBulkUpload,
  buildBulkTemplateCsv,
  DISTRIBUTOR_COMPANIES,
  DMS_COMPANIES,
  downloadCsv,
  getCustomerTab,
  getDmsCustomers,
  registrationProgress,
  setBlocked,
  subscribeToDmsCustomers,
  validateBulkUpload,
  type DmsCustomer,
  type DmsTab,
  type ParsedBulkRow,
} from "../../lib/customers-dms-data";

// =====================================================================
// Customers (DMS) — list.
//
// Three tabs, single-homed (see getCustomerTab): New Registrations,
// Registered, Blocked. The New Registrations tab is a work queue, so it
// carries the two bulk affordances that make 200 requests survivable:
//
//   Download  → CSV with one "<Company> Customer ID" column per
//               distributor company. Take it to the DMS, create the
//               customers, paste the IDs down the column.
//   Upload    → same file back. Every filled cell registers that
//               (customer × company) link in one shot.
//
// The per-row View action opens the detail page — the single-customer
// path for the same job (issue IDs, reject, retry sync) plus the
// address × beat serviceability view. Both write through the same
// store mutators.
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

  const [activeTab, setActiveTab] = useState<DmsTab>("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<DmsCustomer | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const tabCount = (tab: DmsTab) =>
    customers.filter((c) => getCustomerTab(c) === tab).length;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (getCustomerTab(c) !== activeTab) return false;
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
  }, [customers, activeTab, searchQuery, companyFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedRows = customers.filter((c) => selected.includes(c.id));

  const switchTab = (tab: DmsTab) => {
    setActiveTab(tab);
    setPage(1);
    setSelected([]);
  };

  // ---- Bulk download ----
  const handleDownload = () => {
    const rows = selectedRows.length > 0 ? selectedRows : filtered;
    if (rows.length === 0) {
      toast.error("Nothing to download.");
      return;
    }
    downloadCsv(
      `dms-registration-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      buildBulkTemplateCsv(rows),
    );
    toast.success(
      `${rows.length} ${rows.length === 1 ? "request" : "requests"} downloaded — fill the customer ID columns and upload the file back.`,
    );
  };

  // ---- Bulk upload ----
  const validateUpload = async (
    file: File,
  ): Promise<BulkImportValidationResult> => {
    const text = await file.text();
    const { issues, valid, totalRows } = validateBulkUpload(text);
    return {
      totalRows,
      validRows: valid.length,
      invalidRows: issues.length,
      errors: issues.map((i) => ({
        row: i.row,
        field: i.field,
        error: i.error,
        value: i.value,
        skuCode: i.requestId,
        skuName: i.shopName,
      })),
      validData: valid,
    };
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* ---- Header ---- */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Customers (DMS)
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Buyer-app registration requests, reviewed here and issued a
              customer ID per company from your DMS.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {[
              {
                label: "Awaiting action",
                value: tabCount("new"),
                tone: "text-amber-600",
              },
              {
                label: "Registered",
                value: tabCount("registered"),
                tone: "text-green-600",
              },
              {
                label: "IDs to issue",
                value: customers
                  .filter((c) => getCustomerTab(c) === "new")
                  .reduce(
                    (n, c) =>
                      n +
                      c.companies.filter(
                        (l) =>
                          l.operationMode === "distributor" &&
                          l.status !== "registered",
                      ).length,
                    0,
                  ),
                tone: "text-blue-600",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-gray-200 px-4 py-2 min-w-28"
              >
                <p className={`text-xl font-semibold ${s.tone}`}>{s.value}</p>
                <p className="text-[11px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
          {/* ---- Tabs ---- */}
          <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(
                [
                  {
                    key: "new",
                    label: "New Registrations",
                    icon: Clock,
                    color: "amber",
                  },
                  {
                    key: "registered",
                    label: "Registered",
                    icon: CheckCircle2,
                    color: "green",
                  },
                  { key: "blocked", label: "Blocked", icon: Ban, color: "red" },
                ] as const
              ).map(({ key, label, icon: Icon, color }) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchTab(key)}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        color === "amber"
                          ? "text-amber-600"
                          : color === "green"
                            ? "text-green-600"
                            : "text-red-600"
                      }`}
                    />
                    {label}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        active
                          ? color === "amber"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : color === "green"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}
                    >
                      {tabCount(key)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- Search + bulk actions ---- */}
          <div className="border-b border-gray-200 p-4 flex-shrink-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-1 gap-2 min-w-0">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search shop, owner, mobile or request ID..."
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
                <Select
                  value={companyFilter}
                  onValueChange={(v) => {
                    setCompanyFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="All companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                    {DMS_COMPANIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.operationMode === "wholesaler" ? " (wholesale)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeTab === "new" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                    {selectedRows.length > 0 && ` (${selectedRows.length})`}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setUploadOpen(true)}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload customer IDs
                  </Button>
                </div>
              )}
            </div>

            {activeTab === "new" && selectedRows.length > 0 && (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
                <span className="text-blue-800">
                  {selectedRows.length} selected
                </span>
                <button
                  onClick={() => setSelected([])}
                  className="text-blue-700 hover:underline text-xs"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>

          {/* ---- Table ---- */}
          <div className="flex-1 overflow-y-auto">
            {paged.length === 0 ? (
              <EmptyState
                icon={Users}
                title={
                  activeTab === "new"
                    ? "No pending registrations"
                    : activeTab === "registered"
                      ? "No registered customers yet"
                      : "No blocked customers"
                }
                description={
                  activeTab === "new"
                    ? "New registration requests from the buyer app will land here for review."
                    : activeTab === "registered"
                      ? "Approve a registration request to see the customer here with their company customer IDs."
                      : "Customers you block will be listed here with the reason."
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr className="text-left text-xs font-semibold text-gray-600">
                    {activeTab === "new" && (
                      <th className="px-4 py-3 w-10">
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
                    )}
                    <th className="px-4 py-3">Shop / Owner</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Companies</th>
                    <th className="px-4 py-3">
                      {activeTab === "blocked" ? "Blocked" : "Submitted"}
                    </th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((c) => {
                    const progress = registrationProgress(c);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        {activeTab === "new" && (
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
                        )}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/customers-dms/${c.id}`)}
                            className="font-medium text-gray-900 hover:text-blue-600 text-left"
                          >
                            {c.shopName}
                          </button>
                          <p className="text-xs text-gray-500">
                            {c.ownerName} · {c.classType}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            {c.requestId}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-900">{c.mobile}</p>
                          <p className="text-xs text-gray-500">
                            {c.gstNumber ?? (
                              <span className="italic text-gray-400">
                                No GSTIN
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-900">{c.city}</p>
                          <p className="text-xs text-gray-500">
                            {c.area} · {c.pincode}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                            <Building2 className="h-3.5 w-3.5" />
                            {c.companies.length}{" "}
                            {c.companies.length === 1 ? "company" : "companies"}
                          </span>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {progress.done} of {progress.total} registered
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {new Date(
                            activeTab === "blocked" && c.blockedAt
                              ? c.blockedAt
                              : c.submittedAt,
                          ).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          {activeTab === "blocked" && c.blockReason && (
                            <p className="text-[11px] text-red-600 mt-1 max-w-48">
                              {c.blockReason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {activeTab === "new" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate(`/customers-dms/${c.id}`)
                                }
                                className="gap-1"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            )}
                            {activeTab === "registered" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigate(`/customers-dms/${c.id}`)
                                  }
                                  className="gap-1"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setBlockTarget(c);
                                    setBlockReason("");
                                  }}
                                  className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Block
                                </Button>
                              </>
                            )}
                            {activeTab === "blocked" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setBlocked(c.id, false);
                                  toast.success(
                                    `${c.shopName} unblocked — they can order again.`,
                                  );
                                }}
                                className="gap-1 text-green-700 border-green-200 hover:bg-green-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Unblock
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ---- Pagination ---- */}
          <div className="border-t border-gray-200 flex-shrink-0">
            <ListPagination
              page={page}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="customer"
            />
          </div>
        </Card>
      </div>

      {/* ---- Bulk upload ---- */}
      <BulkImportDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        config={{
          title: "Upload customer IDs",
          description:
            "Upload the filled template to register customers against each company in bulk.",
          entityColumns: {
            codeLabel: "Request ID",
            nameLabel: "Shop Name",
          },
          instructions: (
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                Download the request template first, create those customers in
                each company's DMS, then paste the generated IDs into the
                matching <span className="font-medium">Customer ID</span>{" "}
                column.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>
                  One column per company you distribute for:{" "}
                  {DISTRIBUTOR_COMPANIES.map((c) => c.shortName).join(", ")}.
                </li>
                <li>
                  Leave a cell blank to skip it — you can fill the file across
                  several passes.
                </li>
                <li>
                  Cells marked <span className="font-mono">Not requested</span>{" "}
                  are companies this shop did not ask for. Typing an ID there is
                  rejected.
                </li>
                <li>
                  Wholesale-only companies are not in the file — wholesale needs
                  no DMS registration.
                </li>
              </ul>
            </div>
          ),
          accept: ".csv",
          sample: {
            fileName: "dms-registration-requests.csv",
            onDownload: () => {
              const rows = getDmsCustomers().filter(
                (c) => getCustomerTab(c) === "new",
              );
              downloadCsv(
                "dms-registration-requests.csv",
                buildBulkTemplateCsv(rows),
              );
            },
          },
          validate: validateUpload,
          onImport: (validData) => {
            applyBulkUpload(validData as ParsedBulkRow[]);
          },
          successToast: (r) =>
            `${r.validRows} ${r.validRows === 1 ? "customer" : "customers"} registered — IDs queued to the DMS connectors.`,
          simulateValidationDelayMs: 1200,
        }}
      />

      {/* ---- Block dialog ---- */}
      <Dialog
        open={blockTarget !== null}
        onOpenChange={(v) => !v && setBlockTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block {blockTarget?.shopName}?</DialogTitle>
            <DialogDescription>
              Blocking stops this customer ordering from every company you
              serve. Their DMS customer IDs are kept, so unblocking restores
              access instantly.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="block-reason">Reason</Label>
            <Textarea
              id="block-reason"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="e.g. Outstanding dues beyond 90 days"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={!blockReason.trim()}
              onClick={() => {
                if (!blockTarget) return;
                setBlocked(blockTarget.id, true, blockReason.trim());
                toast.success(`${blockTarget.shopName} blocked.`);
                setBlockTarget(null);
              }}
            >
              Block customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
