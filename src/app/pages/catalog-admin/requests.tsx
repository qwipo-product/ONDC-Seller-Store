import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Plus,
  Tag,
  AlertTriangle,
  Inbox,
  Calendar,
  Building2,
  PowerOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  psRequests as initialRequests,
  type PSRequest,
  type PSRequestType,
  type PSRequestStatus,
} from "../../lib/product-store-data";
import {
  SkuFormFields,
  SkuFormState,
  emptySkuForm,
} from "../../components/sku-form-fields";

type FilterStatus = PSRequestStatus | "all";
type FilterType = PSRequestType | "all";

export function CatalogAdminRequests() {
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState<PSRequest[]>(initialRequests);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [typeFilter, setTypeFilter] = useState<FilterType>(
    (searchParams.get("type") as FilterType) ?? "all"
  );

  const [viewRequest, setViewRequest] = useState<PSRequest | null>(null);
  const [editedRequest, setEditedRequest] = useState<PSRequest | null>(null);
  const [editedSkuForm, setEditedSkuForm] = useState<SkuFormState>(emptySkuForm);
  const [actionDialog, setActionDialog] = useState<{
    type: "approve" | "reject";
    request: PSRequest;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.skuName.toLowerCase().includes(q) ||
          r.brandName.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q) ||
          r.requestedBy.toLowerCase().includes(q) ||
          (r.type === "request_company" && r.companyName.toLowerCase().includes(q)) ||
          (r.type === "request_brand" && r.brandName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, search]);

  const pendingCount = requests.filter(
    (r) => r.status === "submitted" || r.status === "in_progress"
  ).length;

  const openRequest = (req: PSRequest) => {
    let updated = req;
    if (req.status === "submitted") {
      updated = { ...req, status: "in_progress" };
      setRequests((prev) =>
        prev.map((r) => r.id === req.id ? updated : r)
      );
    }
    setViewRequest(updated);
    setEditedRequest(updated);
    if (updated.form) {
      setEditedSkuForm({ ...emptySkuForm, ...(updated.form as Partial<SkuFormState>) });
    }
  };

  const handleAction = (type: "approve" | "reject") => {
    setActionDialog({ type, request: editedRequest ?? viewRequest! });
    setActionNotes("");
  };

  const confirmAction = () => {
    if (!actionDialog) return;
    const { type, request } = actionDialog;
    setRequests((prev) =>
      prev.map((r) =>
        r.id === request.id
          ? {
              ...(editedRequest ?? r),
              ...(editedRequest?.form ? { form: editedSkuForm } : {}),
              status: type === "approve" ? "approved" : "rejected",
              updatedAt: new Date().toISOString().slice(0, 10),
              reason: type === "reject" ? actionNotes : undefined,
            }
          : r
      )
    );
    toast.success(
      type === "approve"
        ? `Request "${request.skuName}" approved.`
        : `Request "${request.skuName}" rejected.`
    );
    setActionDialog(null);
    setViewRequest(null);
    setEditedRequest(null);
  };

  const getTypeBadge = (type: PSRequest["type"]) => {
    if (type === "create_sku")
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs">
          <Plus className="h-3 w-3" />
          Create SKU
        </Badge>
      );
    if (type === "edit_sku")
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
          <Tag className="h-3 w-3" />
          Edit SKU
        </Badge>
      );
    if (type === "inactivate_sku")
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs">
          <PowerOff className="h-3 w-3" />
          Make Inactive
        </Badge>
      );
    if (type === "activate_sku")
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
          <Zap className="h-3 w-3" />
          Activate SKU
        </Badge>
      );
    if (type === "request_company")
      return (
        <Badge className="bg-violet-50 text-violet-700 border-violet-200 gap-1 text-xs">
          <Building2 className="h-3 w-3" />
          New Company
        </Badge>
      );
    return (
      <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 text-xs">
        <Tag className="h-3 w-3" />
        New Brand
      </Badge>
    );
  };

  const getStatusBadge = (status: PSRequest["status"]) => {
    if (status === "submitted")
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
          <Clock className="h-3 w-3" />
          Submitted
        </Badge>
      );
    if (status === "in_progress")
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs">
          <RefreshCw className="h-3 w-3" />
          In Progress
        </Badge>
      );
    if (status === "approved")
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </Badge>
      );
    return (
      <Badge className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs">
        <XCircle className="h-3 w-3" />
        Rejected
      </Badge>
    );
  };

  const getRequesterTypeBadge = (type: PSRequest["requestedByType"]) => {
    if (type === "seller")
      return <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Seller</span>;
    return <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">System</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          Requests
          {pendingCount > 0 && (
            <Badge className="bg-red-500 text-white rounded-full text-xs px-2">
              {pendingCount}
            </Badge>
          )}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Review and approve requests from sellers — new companies, brands, and SKUs.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by SKU, brand, or requester..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as FilterType)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="request_company">New Company</SelectItem>
            <SelectItem value="request_brand">New Brand</SelectItem>
            <SelectItem value="create_sku">Create SKU</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as FilterStatus)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="font-medium">No requests found</p>
              <p className="text-sm">Adjust your filters or wait for new requests.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    SKU / Brand
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Requested By
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      {req.type === "request_company" ? (
                        <>
                          <p className="font-medium text-gray-900 text-sm">{req.companyName}</p>
                          <p className="text-xs text-gray-400">New company</p>
                        </>
                      ) : req.type === "request_brand" ? (
                        <>
                          <p className="font-medium text-gray-900 text-sm">{req.brandName}</p>
                          <p className="text-xs text-gray-500">{req.companyName}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900 text-sm">{req.skuName}</p>
                          <p className="text-xs text-gray-500">
                            {req.brandName} · {req.companyName}
                          </p>
                          {req.skuCode && (
                            <code className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded font-mono">
                              {req.skuCode}
                            </code>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(req.type)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700">
                        {req.requestedBy}
                      </p>
                      <div className="mt-0.5">
                        {getRequesterTypeBadge(req.requestedByType)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {req.createdAt}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(req.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          title="View details"
                          onClick={() => openRequest(req)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* View Request Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={() => setViewRequest(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base">
                  {viewRequest?.type === "request_company"
                    ? viewRequest.companyName
                    : viewRequest?.type === "request_brand"
                    ? `${viewRequest.brandName} — ${viewRequest.companyName}`
                    : viewRequest?.form?.itemName || viewRequest?.skuName || "—"}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <code className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                    {viewRequest?.id}
                  </code>
                  {viewRequest && getTypeBadge(viewRequest.type)}
                  {viewRequest && getStatusBadge(viewRequest.status)}
                  {viewRequest && getRequesterTypeBadge(viewRequest.requestedByType)}
                </div>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {viewRequest?.requestedBy} · {viewRequest?.createdAt}
                </p>
              </div>
            </div>

            {/* Status banners */}
            {viewRequest?.status === "in_progress" && (
              <div className="flex items-start gap-2 mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
                <p>Request is currently being reviewed.</p>
              </div>
            )}
            {viewRequest?.status === "approved" && (
              <div className="flex items-start gap-2 mt-3 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-green-600" />
                <p>Approved and added to the Product Store.</p>
              </div>
            )}
            {viewRequest?.reason && (
              <div className="flex items-start gap-2 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-500" />
                <div>
                  <p className="font-medium">Rejection reason</p>
                  <p className="mt-0.5">{viewRequest.reason}</p>
                </div>
              </div>
            )}
          </DialogHeader>

          {viewRequest && (() => {
            const isPending = viewRequest.status === "submitted" || viewRequest.status === "in_progress";
            return (
            <div className="space-y-5 pt-2">

              {/* ── Request a Company form ── */}
              {viewRequest.type === "request_company" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Company Name</Label>
                    {isPending ? (
                      <Input
                        value={editedRequest?.companyName ?? ""}
                        onChange={(e) => setEditedRequest((prev) => prev ? { ...prev, companyName: e.target.value } : prev)}
                      />
                    ) : (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                        {viewRequest.companyName || "—"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Message</Label>
                    {isPending ? (
                      <Textarea
                        rows={3}
                        placeholder="Notes from requester..."
                        value={editedRequest?.notes ?? ""}
                        onChange={(e) => setEditedRequest((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                      />
                    ) : viewRequest.notes ? (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                        {viewRequest.notes}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* ── Request a Brand form ── */}
              {viewRequest.type === "request_brand" && (
                <div className="space-y-3">
                  {viewRequest.companyName && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                      <span className="text-xs text-violet-600 font-medium">Company</span>
                      <span className="text-sm font-semibold text-violet-900">{viewRequest.companyName}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Brand Name</Label>
                    {isPending ? (
                      <Input
                        value={editedRequest?.brandName ?? ""}
                        onChange={(e) => setEditedRequest((prev) => prev ? { ...prev, brandName: e.target.value } : prev)}
                      />
                    ) : (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                        {viewRequest.brandName || "—"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Message</Label>
                    {isPending ? (
                      <Textarea
                        rows={3}
                        placeholder="Notes from requester..."
                        value={editedRequest?.notes ?? ""}
                        onChange={(e) => setEditedRequest((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                      />
                    ) : viewRequest.notes ? (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                        {viewRequest.notes}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* ── Full seller-filled form (create_sku requests) ── */}
              {viewRequest.form && (
                <SkuFormFields
                  mode="seller"
                  readOnly={!isPending}
                  form={isPending ? editedSkuForm : { ...emptySkuForm, ...(viewRequest.form as Partial<SkuFormState>) }}
                  onChange={(key, value) => setEditedSkuForm((prev) => ({ ...prev, [key]: value }))}
                  productImages={[]}
                  onProductImagesChange={() => {}}
                />
              )}

              {/* ── Edit SKU — proposed changes ── */}
              {viewRequest.changes && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 border-b">
                    Proposed Changes
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-500">Field</th>
                        <th className="text-left px-3 py-2 text-gray-500">Current</th>
                        <th className="text-left px-3 py-2 text-gray-500">Proposed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(isPending ? (editedRequest?.changes ?? viewRequest.changes) : viewRequest.changes).map(([field, { old: oldVal, new: newVal }]) => (
                        <tr key={field} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium text-gray-700">{field}</td>
                          <td className="px-3 py-2 text-red-600 line-through">{oldVal}</td>
                          <td className="px-3 py-2 text-green-700 font-medium">
                            {isPending ? (
                              <Input
                                className="h-7 text-xs"
                                value={newVal}
                                onChange={(e) =>
                                  setEditedRequest((prev) => {
                                    if (!prev?.changes) return prev;
                                    return {
                                      ...prev,
                                      changes: {
                                        ...prev.changes,
                                        [field]: { old: oldVal, new: e.target.value },
                                      },
                                    };
                                  })
                                }
                              />
                            ) : (
                              newVal
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes for non-create/non-company/non-brand requests */}
              {!viewRequest.form &&
                viewRequest.type !== "request_company" &&
                viewRequest.type !== "request_brand" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Notes</Label>
                  {isPending ? (
                    <Textarea
                      rows={3}
                      placeholder="Add notes..."
                      value={editedRequest?.notes ?? ""}
                      onChange={(e) => setEditedRequest((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                    />
                  ) : viewRequest.notes ? (
                    <div className="p-3 bg-gray-50 rounded border text-xs text-gray-800">
                      {viewRequest.notes}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            );
          })()}

          {(viewRequest?.status === "submitted" || viewRequest?.status === "in_progress") && (
            <DialogFooter className="gap-2 pt-3 border-t mt-4">
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                onClick={() => handleAction("reject")}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 gap-1"
                onClick={() => handleAction("approve")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirm Dialog */}
      <Dialog
        open={!!actionDialog}
        onOpenChange={() => setActionDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog?.type === "approve" ? (
                <CheckCircle2 className="h-5 w-5 text-teal-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              {actionDialog?.type === "approve"
                ? "Approve Request"
                : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.type === "approve"
                ? "Approving this request will update the Product Store accordingly."
                : "Please provide a reason for rejection."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded border text-sm">
              <p className="font-medium text-gray-900">
                {actionDialog?.request.skuName}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {actionDialog?.request.brandName} ·{" "}
                {actionDialog?.request.companyName}
              </p>
            </div>
            {actionDialog?.type === "reject" && (
              <div className="space-y-1.5">
                <Label>Rejection Reason *</Label>
                <Textarea
                  placeholder="Explain why this request is being rejected..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={
                actionDialog?.type === "reject" && !actionNotes.trim()
              }
              className={
                actionDialog?.type === "approve"
                  ? "bg-teal-600 hover:bg-teal-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {actionDialog?.type === "approve" ? "Confirm Approve" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
