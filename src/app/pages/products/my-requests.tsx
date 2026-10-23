import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import {
  Dialog,
  DialogContent,
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
  ArrowLeft,
  Search,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Package,
  Tag,
  Ruler,
  ShieldCheck,
  Send,
  Info,
  AlertCircle,
  Calendar,
  RefreshCw,
  Building2,
  Layers,
} from "lucide-react";
import {
  getSkuRequests,
  type SkuRequest,
  type RequestStatus,
} from "../../lib/sku-request-store";

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; icon: React.ReactNode; badge: string; dot: string }
> = {
  submitted: {
    label: "Submitted",
    icon: <Clock className="h-3.5 w-3.5" />,
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-100",
  },
  in_progress: {
    label: "In Progress",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-100",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    badge: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-100",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="h-3.5 w-3.5" />,
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-100",
  },
};

const REQUEST_TYPE_CONFIG = {
  sku: { label: "SKU Request", icon: <Package className="h-3 w-3" />, badge: "bg-purple-50 text-purple-700 border-purple-200" },
  company: { label: "Company Request", icon: <Building2 className="h-3 w-3" />, badge: "bg-teal-50 text-teal-700 border-teal-200" },
  brand: { label: "Brand Request", icon: <Layers className="h-3 w-3" />, badge: "bg-orange-50 text-orange-700 border-orange-200" },
};

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
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

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function RequestDetailDialog({
  request,
  onClose,
}: {
  request: SkuRequest;
  onClose: () => void;
}) {
  const f = request.form;
  const status = STATUS_CONFIG[request.status];
  const typeConfig = REQUEST_TYPE_CONFIG[request.requestType ?? "sku"];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-base">{f.itemName || "—"}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <code className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                  {request.id}
                </code>
                <Badge className={`gap-1 text-xs ${typeConfig.badge}`}>
                  {typeConfig.icon}
                  {typeConfig.label}
                </Badge>
                <Badge className={`gap-1 text-xs ${status.badge}`}>
                  {status.icon}
                  {status.label}
                </Badge>
              </div>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Submitted {request.submittedAt}
              </p>
            </div>
          </div>
          {request.status === "rejected" && request.rejectionReason && (
            <div className="flex items-start gap-2 mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-medium">Rejection reason</p>
                <p className="mt-0.5">{request.rejectionReason}</p>
              </div>
            </div>
          )}
          {request.status === "in_progress" && (
            <div className="flex items-start gap-2 mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
              <p>Your request is being reviewed by the Catalog team.</p>
            </div>
          )}
          {request.status === "approved" && (
            <div className="flex items-start gap-2 mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-green-600" />
              <p>This SKU has been added to the Product Store. You can now browse and add it to your My SKU.</p>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {(request.requestType === "company") && (
            <>
              <Section title="Company Details" icon={<Building2 className="h-3 w-3" />}>
                <DetailRow label="Company Name" value={f.itemName} />
              </Section>
            </>
          )}

          {(request.requestType === "brand") && (
            <>
              <Section title="Brand Details" icon={<Layers className="h-3 w-3" />}>
                <DetailRow label="Brand Name" value={f.itemName} />
                <DetailRow label="Company Name" value={f.brandOther} />
              </Section>
            </>
          )}

          {(!request.requestType || request.requestType === "sku") && (
            <>
              <Section title="Descriptor" icon={<FileText className="h-3 w-3" />}>
                <DetailRow label="SKU Name" value={f.itemName} />
                <DetailRow label="Short Name" value={f.shortName} />
                <DetailRow label="Brand" value={f.brandId || f.brandOther} />
                <DetailRow label="Brand Attribute" value={f.brandAttribute} />
              </Section>

              {(f.shortDesc || f.longDesc) && (
                <>
                  <Separator />
                  <Section title="Descriptions" icon={<FileText className="h-3 w-3" />}>
                    {f.shortDesc && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Short</p>
                        <p className="text-xs text-gray-800 leading-relaxed">{f.shortDesc}</p>
                      </div>
                    )}
                    {f.longDesc && (
                      <div className="space-y-1 mt-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Long</p>
                        <p className="text-xs text-gray-800 leading-relaxed">{f.longDesc}</p>
                      </div>
                    )}
                  </Section>
                </>
              )}

              {(f.measureUnit || f.skuWeight || f.upc) && (
                <>
                  <Separator />
                  <Section title="Quantity & Packaging" icon={<Package className="h-3 w-3" />}>
                    <DetailRow
                      label="Measure"
                      value={f.measureValue && f.measureUnit ? `${f.measureValue} ${f.measureUnit}` : null}
                    />
                    <DetailRow
                      label="Weight"
                      value={f.skuWeight && f.weightMeasure ? `${f.skuWeight} ${f.weightMeasure}` : null}
                    />
                    <DetailRow label="Pack Size" value={f.unitizedCount} />
                    <DetailRow label="UPC / Barcode" value={f.upc} mono />
                  </Section>
                </>
              )}

              {(f.productLength || f.productWidth || f.productHeight) && (
                <>
                  <Separator />
                  <Section title="Dimensions" icon={<Ruler className="h-3 w-3" />}>
                    <DetailRow
                      label="L × W × H (cm)"
                      value={`${f.productLength} × ${f.productWidth} × ${f.productHeight}`}
                    />
                  </Section>
                </>
              )}

              {(f.categoryId || f.hsnCode || f.countryOfOrigin || f.manufacturerName) && (
                <>
                  <Separator />
                  <Section title="Compliance & Taxonomy" icon={<ShieldCheck className="h-3 w-3" />}>
                    <DetailRow label="ONDC Category" value={f.categoryId} />
                    <DetailRow label="HSN Code" value={f.hsnCode} mono />
                    <DetailRow label="GST Rate" value={f.gstTax} />
                    <DetailRow label="Country of Origin" value={f.countryOfOrigin} />
                    <DetailRow label="Manufacturer" value={f.manufacturerName} />
                  </Section>
                </>
              )}
            </>
          )}

          {f.notes && (
            <>
              <Separator />
              <Section title="Notes to Catalog Team" icon={<AlertCircle className="h-3 w-3" />}>
                <p className="text-xs text-gray-700 leading-relaxed bg-amber-50 border border-amber-100 rounded p-2.5">
                  {f.notes}
                </p>
              </Section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MyRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState(() => getSkuRequests());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all");
  const [detailRequest, setDetailRequest] = useState<SkuRequest | null>(null);

  const filtered = requests.filter((r) => {
    const matchSearch =
      r.form.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.form.brandOther || r.form.brandId || r.form.brandAttribute)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: requests.length,
    submitted: requests.filter((r) => r.status === "submitted").length,
    in_progress: requests.filter((r) => r.status === "in_progress").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/products/my-sku")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to MySKU
        </button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Send className="h-6 w-6 text-purple-600" />
              My Requests
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Track the status of SKUs you've requested to be added to the Product Store.
            </p>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-3">
        {(["all", "submitted", "in_progress", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`p-3 rounded-lg border text-left transition-all ${
              statusFilter === s
                ? "border-purple-400 bg-purple-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <p className={`text-xl font-bold ${
              s === "submitted" ? "text-amber-600"
              : s === "in_progress" ? "text-blue-600"
              : s === "approved" ? "text-green-600"
              : s === "rejected" ? "text-red-600"
              : "text-gray-900"
            }`}>
              {counts[s]}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {s === "all" ? "All requests"
              : s === "in_progress" ? "In Progress"
              : s.charAt(0).toUpperCase() + s.slice(1)}
            </p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by SKU name, brand, or request ID..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Request list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <Send className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="font-medium">
              {requests.length === 0 ? "No requests yet" : "No requests match your filters"}
            </p>
            {requests.length === 0 && (
              <p className="text-sm mt-1">
                Can't find a SKU in the Product Store?{" "}
                <button
                  className="text-purple-600 hover:underline font-medium"
                  onClick={() => navigate("/products/my-sku")}
                >
                  Submit a request →
                </button>
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {filtered.map((req) => {
                const status = STATUS_CONFIG[req.status];
                const brandLabel =
                  req.form.brandOther || req.form.brandAttribute || req.form.brandId || "—";
                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setDetailRequest(req)}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${STATUS_CONFIG[req.status].dot}`}>
                      {req.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : req.status === "rejected" ? <XCircle className="h-4 w-4 text-red-500" />
                      : req.status === "in_progress" ? <RefreshCw className="h-4 w-4 text-blue-500" />
                      : <Clock className="h-4 w-4 text-amber-500" />}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 text-sm">
                          {req.form.itemName || "Unnamed request"}
                        </p>
                        <Badge className={`gap-1 text-xs ${REQUEST_TYPE_CONFIG[req.requestType ?? "sku"].badge}`}>
                          {REQUEST_TYPE_CONFIG[req.requestType ?? "sku"].icon}
                          {REQUEST_TYPE_CONFIG[req.requestType ?? "sku"].label}
                        </Badge>
                        <Badge className={`gap-1 text-xs ${status.badge}`}>
                          {status.icon}
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {req.id}
                        </code>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {req.submittedAt}
                        </span>
                      </div>
                      {req.status === "rejected" && req.rejectionReason && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <Info className="h-3 w-3 flex-shrink-0" />
                          {req.rejectionReason}
                        </p>
                      )}
                    </div>

                    {/* Packaging + chevron */}
                    <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 flex-shrink-0">
                      {req.form.measureValue && req.form.measureUnit && (
                        <span>{req.form.measureValue} {req.form.measureUnit}</span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      {detailRequest && (
        <RequestDetailDialog
          request={detailRequest}
          onClose={() => setDetailRequest(null)}
        />
      )}
    </div>
  );
}
