// =====================================================================
// Customers (DMS) — detail.
//
// Deliberately the same skeleton as the live Customers detail page
// (pages/customers/detail.tsx): two-column layout — Basic Information /
// Addresses / Business Information / Company Registrations on the
// left, sticky embedded map on the right. The Addresses card carries
// the per-address Company × Beat × Beat Days table, resolved LIVE from
// the shared serviceability store, and a customer can hold several
// addresses, each mapping into its own beats.
//
// What's different is the Company Registrations card: instead of the
// live module's Active/Blocked links, each company shows its DMS
// registration lifecycle (the buyer's five statuses), the issued
// company-specific customer ID, and the actions — issue an ID, reject
// with a reason, retry a failed DMS push.
//
// Opening this page for a customer with pending links marks them
// Under review (the buyer's step-2), replacing the old review drawer.
// =====================================================================

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
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
  AlertCircle,
  ArrowLeft,
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Home,
  IdCard,
  Image as ImageIcon,
  Link2,
  Lock,
  MapPin,
  MapPinned,
  Navigation,
  RefreshCw,
  Route,
  Store,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignCustomerId,
  getDmsAddresses,
  getDmsAddressServiceability,
  getDmsCompany,
  getDmsCustomer,
  getDmsPrimaryAddress,
  markUnderReview,
  registrationProgress,
  rejectRegistration,
  retrySync,
  setBlocked,
  STATUS_LABELS,
  STATUS_STYLES,
  subscribeToDmsCustomers,
  type DmsCustomer,
} from "../../lib/customers-dms-data";
import { subscribeToServiceabilityBeats } from "../../lib/serviceability-data";

/** Canned rejection reasons — the buyer sees the text verbatim. */
const REJECTION_REASONS = [
  "GSTIN could not be verified",
  "Shop image did not show the shop name board",
  "Photo ID is unclear or expired",
  "Shop address is outside our delivery area",
  "Duplicate of an existing customer",
  "Details do not match the GST record",
];

const DOC_ICONS = {
  "Shop Image": ImageIcon,
  "Shop Owner Photo ID": IdCard,
  "GST Certificate": FileText,
} as const;

export function CustomerDmsDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<DmsCustomer | null>(
    customerId ? (getDmsCustomer(customerId) ?? null) : null,
  );

  // Live updates — re-sync whenever the shared store changes so the
  // page reflects mutations we make below (register / reject / block).
  useEffect(() => {
    if (!customerId) return;
    return subscribeToDmsCustomers(() => {
      setCustomer(getDmsCustomer(customerId) ?? null);
    });
  }, [customerId]);

  // Re-render when the serviceability admin changes a beat — the Beat
  // Days column resolves from the live beat store, same as the live
  // Customers detail page.
  const [, setBeatsRev] = useState(0);
  useEffect(() => {
    return subscribeToServiceabilityBeats(() => setBeatsRev((n) => n + 1));
  }, []);

  // Landing on the page IS the pickup — pending links flip to Under
  // review, which lights up step 2 of the buyer's timeline. (The old
  // review drawer did this on open; the detail page replaced it.)
  useEffect(() => {
    if (!customerId) return;
    const c = getDmsCustomer(customerId);
    if (c && c.companies.some((l) => l.status === "pending")) {
      markUnderReview(customerId);
    }
  }, [customerId]);

  // Multi-address support — identical to the live module: the selector
  // drives the address details, the per-address serviceability table,
  // and the map.
  const addresses = customer ? getDmsAddresses(customer) : [];
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (!customer) return;
    const list = getDmsAddresses(customer);
    setSelectedAddressId((prev) =>
      prev && list.some((a) => a.id === prev)
        ? prev
        : getDmsPrimaryAddress(customer).id,
    );
  }, [customer]);
  const selectedAddress =
    addresses.find((a) => a.id === selectedAddressId) ?? addresses[0] ?? null;
  const addressServiceability =
    customer && selectedAddress
      ? getDmsAddressServiceability(customer, selectedAddress)
      : { served: [], unserved: [] };

  // Per-company ID drafts + the reject flow's dialog state.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);
  const [pendingBlockToggle, setPendingBlockToggle] = useState<
    "block" | "unblock" | null
  >(null);
  const [blockReason, setBlockReason] = useState("");

  if (!customer) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-700 font-medium mb-1">Customer not found</p>
          <p className="text-xs text-gray-500 mb-4">
            This customer may have been removed or never existed in the demo
            dataset.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/customers-dms")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers (DMS)
          </Button>
        </div>
      </div>
    );
  }

  const progress = registrationProgress(customer);
  const rejectCompany = customer.companies.find(
    (l) => l.companyId === rejectTarget,
  );

  // Embedded OpenStreetMap iframe centred on the SELECTED address; the
  // overlay link redirects to Google Maps — same pattern as the live
  // detail page so seller muscle memory stays consistent.
  const mapAddress = selectedAddress ?? getDmsPrimaryAddress(customer);
  const latDelta = 0.01;
  const lonDelta = 0.01;
  const bbox = `${mapAddress.longitude - lonDelta},${mapAddress.latitude - latDelta},${mapAddress.longitude + lonDelta},${mapAddress.latitude + latDelta}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${mapAddress.latitude},${mapAddress.longitude}`;
  const openInMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapAddress.latitude},${mapAddress.longitude}`;

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-full">
      {/* Header — shop name + registration rollup + block state. */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/customers-dms")}
          className="hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {customer.shopName}
            </h1>
            <Badge className="bg-gray-50 text-gray-600 border-gray-200 font-mono text-[11px]">
              {customer.requestId}
            </Badge>
            {customer.blocked ? (
              <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                <Ban className="h-3 w-3" />
                Blocked
              </Badge>
            ) : progress.done === progress.total ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Registered
              </Badge>
            ) : (
              <Badge
                className="bg-amber-50 text-amber-700 border-amber-200 gap-1"
                title={`${progress.done} registered · ${progress.total - progress.done} awaiting`}
              >
                In progress ({progress.done}/{progress.total})
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 truncate">
            {customer.ownerName} · {customer.classType} · {customer.mobile}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPendingBlockToggle(customer.blocked ? "unblock" : "block");
            setBlockReason("");
          }}
          className={
            customer.blocked
              ? "gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              : "gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
          }
        >
          {customer.blocked ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Ban className="h-4 w-4" />
          )}
          {customer.blocked ? "Unblock" : "Block"}
        </Button>
      </div>

      {customer.blocked && customer.blockReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <span className="font-medium">Blocked</span> — {customer.blockReason}
        </div>
      )}

      {/* Main Content Grid — left column (details) + right column (map),
          matching the live Customers detail page exactly. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left Column */}
        <div className="space-y-3">
          {/* Basic Information */}
          <Card>
            <CardHeader className="py-2.5 px-4 border-b border-gray-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-blue-600" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-[11px] text-gray-500">Shop Name</p>
                  <p className="text-sm font-medium text-gray-900">
                    {customer.shopName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Owner Name</p>
                  <p className="text-sm font-medium text-gray-900">
                    {customer.ownerName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Phone</p>
                  <p className="text-sm font-medium text-gray-900">
                    {customer.mobile}
                  </p>
                </div>
                {customer.email && (
                  <div>
                    <p className="text-[11px] text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {customer.email}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Addresses — a customer can have several delivery locations.
              The selector switches the address details, the per-address
              serviceability table, and the map on the right. Different
              addresses fall in different beats, so the company set and
              delivery days below change per address. */}
          <Card>
            <CardHeader className="py-2.5 px-4 border-b border-gray-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                Addresses ({addresses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {addresses.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {addresses.map((a) => {
                    const active = a.id === selectedAddress?.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAddressId(a.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-green-500 bg-green-50 text-green-800 ring-1 ring-green-200"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {a.isPrimary ? (
                          <Home className="h-3.5 w-3.5" />
                        ) : (
                          <MapPinned className="h-3.5 w-3.5" />
                        )}
                        {a.label}
                        {a.isPrimary && (
                          <Badge className="bg-green-600 text-white h-4 px-1 text-[9px] ml-0.5">
                            Primary
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedAddress && (
                <>
                  {selectedAddress.fullAddress && (
                    <div>
                      <p className="text-[11px] text-gray-500">
                        {selectedAddress.label}
                        {selectedAddress.isPrimary ? " · Primary" : ""}
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedAddress.fullAddress}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-5 gap-x-3 gap-y-2">
                    <div>
                      <p className="text-[11px] text-gray-500">City</p>
                      <p className="text-sm text-gray-900">
                        {selectedAddress.city}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">State</p>
                      <p className="text-sm text-gray-900">
                        {selectedAddress.state}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">Pincode</p>
                      <p className="text-sm text-gray-900">
                        {selectedAddress.pincode}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">Latitude</p>
                      <p className="text-xs font-mono text-gray-900">
                        {selectedAddress.latitude}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">Longitude</p>
                      <p className="text-xs font-mono text-gray-900">
                        {selectedAddress.longitude}
                      </p>
                    </div>
                  </div>

                  {/* Delivery serviceability at THIS address — company ×
                      beat × days, resolved live from the shared
                      serviceability store for this location. */}
                  <div className="pt-1">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
                      <Route className="h-3.5 w-3.5 text-gray-400" />
                      Delivery serviceability at {selectedAddress.label}
                    </p>
                    {addressServiceability.served.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        No company delivers to this address yet. Configure a
                        serviceability polygon covering it in Admin → Seller →
                        Serviceability.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/60 border-b border-gray-100">
                          <span>Company</span>
                          <span>Beat</span>
                          <span>Beat Days</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {addressServiceability.served.flatMap((co) =>
                            co.beats.map((beat) => (
                              <div
                                key={`${co.companyId}-${beat.id}`}
                                className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-2 px-3 py-2 items-center"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="bg-blue-100 text-blue-700 p-0.5 rounded shrink-0">
                                    <Building2 className="h-3 w-3" />
                                  </div>
                                  <span className="text-xs font-medium text-gray-900 truncate">
                                    {co.companyName}
                                  </span>
                                  {co.status !== "registered" &&
                                    co.operationMode === "distributor" && (
                                      <Badge
                                        className={`${STATUS_STYLES[co.status]} h-4 px-1 text-[9px]`}
                                      >
                                        {STATUS_LABELS[co.status]}
                                      </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 min-w-0">
                                  <Route className="h-3 w-3 text-gray-400 shrink-0" />
                                  <span className="text-xs text-gray-800 truncate">
                                    {beat.beatName}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1">
                                  {beat.deliveryDays.map((day) => (
                                    <Badge
                                      key={day}
                                      className="gap-1 bg-blue-50 text-blue-700 border-blue-200 font-medium text-[10px] h-5"
                                    >
                                      <CalendarClock className="h-2.5 w-2.5" />
                                      {day}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )),
                          )}
                        </div>
                      </div>
                    )}
                    {addressServiceability.unserved.length > 0 && (
                      <p className="text-[11px] text-gray-500 mt-1.5 flex items-start gap-1">
                        <Lock className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
                        Not served at this address:{" "}
                        <span className="text-gray-700">
                          {addressServiceability.unserved
                            .map((co) => co.companyName)
                            .join(", ")}
                        </span>
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader className="py-2.5 px-4 border-b border-gray-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-[11px] text-gray-500">Request ID</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">
                    {customer.requestId}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">GSTN Number</p>
                  {customer.gstNumber ? (
                    <p className="text-sm font-mono text-gray-900">
                      {customer.gstNumber}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      Not provided
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Shop Type</p>
                  <p className="text-sm text-gray-900">{customer.classType}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Submitted</p>
                  <p className="text-sm text-gray-900">
                    {new Date(customer.submittedAt).toLocaleDateString(
                      "en-IN",
                      { day: "2-digit", month: "short", year: "numeric" },
                    )}
                  </p>
                </div>
              </div>

              {/* KYC documents — carried over from the buyer's Qwipo
                  profile, read-only for the distributor. */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                {(
                  ["Shop Image", "Shop Owner Photo ID", "GST Certificate"] as const
                ).map((label) => {
                  const found = customer.documents.find(
                    (d) => d.label === label,
                  );
                  const Icon = DOC_ICONS[label];
                  return (
                    <div
                      key={label}
                      className={`rounded-lg border p-2.5 ${
                        found
                          ? "border-gray-200"
                          : "border-dashed border-amber-300 bg-amber-50/50"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 mb-1.5 ${
                          found ? "text-blue-600" : "text-amber-500"
                        }`}
                      />
                      <p className="text-[11px] font-medium text-gray-900">
                        {label}
                      </p>
                      <p
                        className={`text-[10px] mt-0.5 truncate ${
                          found ? "text-gray-500" : "text-amber-700"
                        }`}
                      >
                        {found ? found.fileName : "Not submitted"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Company Registrations — the DMS twist on Linked Companies.
              Status, the company-specific customer ID, and the actions
              live per company; the beat + delivery days each company
              serves are per address, in the Addresses card above. */}
          <Card>
            <CardHeader className="py-2.5 px-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Company Registrations ({customer.companies.length})
                </CardTitle>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                  {progress.done} / {progress.total} registered
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {customer.companies.map((l) => {
                const co = getDmsCompany(l.companyId);
                const exempt = l.operationMode === "wholesaler";
                const canAct =
                  !exempt &&
                  (l.status === "pending" ||
                    l.status === "under-review" ||
                    l.status === "rejected");
                return (
                  <div
                    key={l.companyId}
                    className={`rounded-lg border px-3 py-2.5 ${
                      exempt
                        ? "border-dashed border-gray-300 bg-gray-50"
                        : l.status === "rejected"
                          ? "border-red-100 bg-red-50/30"
                          : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="bg-blue-100 text-blue-700 p-1 rounded">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {l.companyName}
                          </p>
                          {l.dmsCustomerId && (
                            <p className="text-xs font-mono text-gray-600">
                              {l.dmsCustomerId}
                              {l.linkMethod === "buyer-linked" && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-blue-600 not-italic">
                                  <Link2 className="h-3 w-3" />
                                  linked by buyer
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {exempt ? (
                          <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                            No registration needed
                          </Badge>
                        ) : (
                          <Badge className={STATUS_STYLES[l.status]}>
                            {STATUS_LABELS[l.status]}
                          </Badge>
                        )}
                        {l.syncState && !exempt && (
                          <Badge
                            className={
                              l.syncState === "synced"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : l.syncState === "queued"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                            }
                          >
                            DMS {l.syncState}
                          </Badge>
                        )}
                        {l.syncState === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              retrySync(customer.id, l.companyId);
                              toast.success(
                                `Re-pushed to the ${co?.shortName} DMS.`,
                              );
                            }}
                            className="gap-1 h-7"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>

                    {l.status === "rejected" && l.rejectionReason && (
                      <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
                        {l.rejectionReason} — the buyer can re-apply with
                        updated details.
                      </p>
                    )}
                    {(l.reapplyCount ?? 0) > 0 && l.status === "pending" && (
                      <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                        Re-applied after an earlier rejection
                        {l.rejectionReason ? ` (${l.rejectionReason})` : ""}.
                      </p>
                    )}

                    {/* Issue the DMS customer ID / reject the request. */}
                    {canAct && (
                      <div className="mt-2 flex items-end gap-2">
                        <div className="flex-1">
                          <Label
                            htmlFor={`detail-id-${l.companyId}`}
                            className="text-[11px] text-gray-600"
                          >
                            {co?.shortName} Customer ID
                          </Label>
                          <Input
                            id={`detail-id-${l.companyId}`}
                            value={drafts[l.companyId] ?? ""}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [l.companyId]: e.target.value,
                              }))
                            }
                            placeholder={`e.g. ${co?.idFormatHint}`}
                            className="mt-1 h-8 font-mono text-sm"
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={!(drafts[l.companyId] ?? "").trim()}
                          onClick={() => {
                            assignCustomerId(
                              customer.id,
                              l.companyId,
                              drafts[l.companyId],
                            );
                            setDrafts((p) => ({ ...p, [l.companyId]: "" }));
                            toast.success(
                              `Registered for ${co?.name} — ID queued to the DMS.`,
                            );
                          }}
                          className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Register
                        </Button>
                        {l.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectTarget(l.companyId);
                              setRejectReason(REJECTION_REASONS[0]);
                            }}
                            className="h-8 gap-1 border-red-300 text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-[11px] text-gray-500 pt-1">
                Each company&apos;s DMS issues its <b>own customer ID</b> for
                this shop — wholesaler mappings need no registration. The{" "}
                <b>beat and delivery days</b> each company delivers on are
                resolved per address — see the Addresses card above.
              </p>
            </CardContent>
          </Card>

          {customer.internalNote && (
            <Card>
              <CardHeader className="py-2.5 px-4 border-b border-gray-100">
                <CardTitle className="text-sm">Internal note</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">{customer.internalNote}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column — Map (sticky, embedded iframe) */}
        <div>
          <Card className="lg:sticky lg:top-4 overflow-hidden">
            <CardHeader className="py-2.5 px-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-red-600" />
                  Location Map
                </CardTitle>
                <span className="text-[11px] text-gray-500 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Click map to open in Google Maps
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full h-[360px] lg:h-[480px]">
                <iframe
                  src={osmEmbedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  title="Customer location map"
                  loading="lazy"
                />
                {/* Shop name label — floats above the OSM marker */}
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                  <div
                    className="relative flex flex-col items-center"
                    style={{ marginTop: "-56px" }}
                  >
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-green-300 rounded-lg text-xs font-semibold text-green-800 shadow-md whitespace-nowrap">
                      <Store className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      {customer.shopName}
                    </span>
                    <span className="w-px h-3 bg-green-400 mt-0.5" />
                  </div>
                </div>
                {/* Transparent overlay — captures clicks and redirects
                    to Google Maps so the seller can navigate. */}
                <a
                  href={openInMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-20 cursor-pointer group"
                  aria-label="Open in Google Maps"
                >
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 shadow-md opacity-90 group-hover:opacity-100 group-hover:shadow-lg transition-all">
                    <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
                    Open in Google Maps
                  </span>
                </a>
              </div>
              {/* Compact address + coords strip — reflects the selected
                  address. */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs gap-3">
                <span className="text-gray-700 truncate">
                  <MapPin className="inline h-3.5 w-3.5 text-gray-500 mr-1" />
                  {mapAddress.label} · {mapAddress.area}, {mapAddress.city} —{" "}
                  {mapAddress.pincode}
                </span>
                <span className="font-mono text-gray-500 shrink-0">
                  {mapAddress.latitude.toFixed(4)},{" "}
                  {mapAddress.longitude.toFixed(4)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject dialog — reason is shown to the buyer verbatim. */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Reject for {rejectCompany?.companyName}?
            </DialogTitle>
            <DialogDescription>
              The buyer sees the reason verbatim and can re-apply with updated
              details — the request comes back as Pending approval.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs font-semibold text-gray-700">
              Rejection reason
            </Label>
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!rejectTarget) return;
                rejectRegistration(customer.id, [rejectTarget], rejectReason);
                toast.success(
                  `Rejected for ${rejectCompany?.companyName} — the buyer can re-apply.`,
                );
                setRejectTarget(null);
              }}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block / Unblock confirmation — customer-level: blocking stops
          orders against EVERY company. The issued DMS customer IDs are
          kept, so unblocking restores access instantly. */}
      <Dialog
        open={pendingBlockToggle !== null}
        onOpenChange={(o) => !o && setPendingBlockToggle(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingBlockToggle === "block" ? (
                <>
                  <Ban className="h-5 w-5 text-red-600" />
                  Block {customer.shopName}?
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Unblock {customer.shopName}?
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {pendingBlockToggle === "block"
                ? "Blocking stops this customer ordering from every company you serve. Their DMS customer IDs are kept, so unblocking restores access instantly."
                : "The customer will be able to place orders again immediately, using their existing DMS customer IDs."}
            </DialogDescription>
          </DialogHeader>
          {pendingBlockToggle === "block" && (
            <div>
              <Label htmlFor="dms-block-reason">Reason</Label>
              <Input
                id="dms-block-reason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Outstanding dues beyond 90 days"
                className="mt-2"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingBlockToggle(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={pendingBlockToggle === "block" && !blockReason.trim()}
              onClick={() => {
                if (pendingBlockToggle === "block") {
                  setBlocked(customer.id, true, blockReason.trim());
                  toast.success(`${customer.shopName} blocked.`);
                } else {
                  setBlocked(customer.id, false);
                  toast.success(`${customer.shopName} unblocked.`);
                }
                setPendingBlockToggle(null);
              }}
              className={
                pendingBlockToggle === "block"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {pendingBlockToggle === "block"
                ? "Yes, block customer"
                : "Yes, unblock customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
