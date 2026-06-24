// =====================================================================
// Customer Detail (Customers 2)
// ---------------------------------------------------------------------
// Two-column layout — Basic Information / Address Details / Business
// Information / Linked Companies on the left, sticky embedded map on
// the right. The Linked Companies card lists the customer's brands
// with the Beat Name and Delivery Day each one resolves to (one beat
// per company, sourced from the serviceability polygon). There is no
// per-company registration date — the auto-register flow doesn't
// track that any more. Block / Unblock is per-company so a customer
// can be Active for one brand and Blocked for another.
// =====================================================================

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  ArrowLeft,
  MapPin,
  User as UserIcon,
  CheckCircle2,
  Navigation,
  Building2,
  AlertCircle,
  ExternalLink,
  Ban,
  CalendarClock,
  Route,
  Lock,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDemoCustomerById,
  setDemoCompanyStatus,
  subscribeToDemoCustomers,
  type DemoCustomer,
} from "../../lib/customers-demo-data";
import {
  findBeatForCustomer,
  subscribeToServiceabilityBeats,
} from "../../lib/serviceability-data";

export function CustomerDemoDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<DemoCustomer | null>(
    customerId ? getDemoCustomerById(customerId) ?? null : null,
  );

  // Live updates — re-sync whenever the shared store changes so the
  // detail page reflects mutations made elsewhere (or that we make
  // ourselves below).
  useEffect(() => {
    if (!customerId) return;
    return subscribeToDemoCustomers(() => {
      setCustomer(getDemoCustomerById(customerId) ?? null);
    });
  }, [customerId]);

  // Re-render when the serviceability admin changes a bit — the
  // Delivery Day column below resolves from the live bit list, so a
  // fresh assignment needs to land here without a page reload.
  // `bitsRev` is just a tick counter; the bit lookup reads from the
  // module-level store directly.
  const [, setBeatsRev] = useState(0);
  useEffect(() => {
    return subscribeToServiceabilityBeats(() => setBeatsRev((n) => n + 1));
  }, []);

  // Block / Unblock confirmation — Block lives on a per-company link
  // now (a customer can be Active for one brand and Blocked for
  // another), so we track the target companyId alongside the action.
  const [pendingBlockToggle, setPendingBlockToggle] = useState<{
    action: "block" | "unblock";
    companyId: string;
  } | null>(null);

  const pendingBlockCompany = customer?.companies.find(
    (co) => co.companyId === pendingBlockToggle?.companyId,
  );

  const handleConfirmBlockToggle = () => {
    if (!customer || !pendingBlockToggle || !pendingBlockCompany) return;
    if (pendingBlockToggle.action === "block") {
      setDemoCompanyStatus(
        customer.customerId,
        pendingBlockToggle.companyId,
        "Blocked",
      );
      toast.success(
        `${customer.businessName} blocked for ${pendingBlockCompany.companyName} — no new orders against this brand until you unblock.`,
      );
    } else {
      setDemoCompanyStatus(
        customer.customerId,
        pendingBlockToggle.companyId,
        "Active",
      );
      toast.success(
        `${customer.businessName} unblocked for ${pendingBlockCompany.companyName}.`,
      );
    }
    setPendingBlockToggle(null);
  };

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
            onClick={() => navigate("/customers")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  // Embedded OpenStreetMap iframe centred on the customer's coords; the
  // overlay link redirects to Google Maps (same pattern as the canonical
  // detail page so seller muscle memory stays consistent).
  const latDelta = 0.01;
  const lonDelta = 0.01;
  const bbox = `${customer.longitude - lonDelta},${customer.latitude - latDelta},${customer.longitude + lonDelta},${customer.latitude + latDelta}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${customer.latitude},${customer.longitude}`;
  const openInMapsUrl = `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`;

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-full">
      {/* Header — store name + owner + phone. Customer-level Active /
          Blocked badge is gone; status is now per-company and surfaced
          in the Linked Companies card below, where Block / Unblock
          also lives. The header still rolls up the company statuses
          so the seller has an at-a-glance signal. */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/customers")}
          className="hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {customer.customerName}
            </h1>
            {(() => {
              const activeCount = customer.companies.filter(
                (co) => co.status === "Active",
              ).length;
              const blockedCount = customer.companies.length - activeCount;
              if (blockedCount === 0) {
                return (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </Badge>
                );
              }
              if (activeCount === 0) {
                return (
                  <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                    <Ban className="h-3 w-3" />
                    Blocked
                  </Badge>
                );
              }
              return (
                <Badge
                  className="bg-amber-50 text-amber-700 border-amber-200 gap-1"
                  title={`${activeCount} active · ${blockedCount} blocked`}
                >
                  Mixed ({activeCount}/{customer.companies.length})
                </Badge>
              );
            })()}
          </div>
          <p className="text-sm text-gray-600 truncate">
            {customer.businessName} · {customer.mobile}
          </p>
        </div>
      </div>

      {/* Main Content Grid — left column (details) + right column (map),
          matching the canonical detail page exactly. */}
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
                  <p className="text-[11px] text-gray-500">Store Name</p>
                  <p className="text-sm font-medium text-gray-900">
                    {customer.businessName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Owner Name</p>
                  <p className="text-sm font-medium text-gray-900">
                    {customer.customerName}
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

          {/* Address Details */}
          <Card>
            <CardHeader className="py-2.5 px-4 border-b border-gray-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                Address Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {customer.fullAddress && (
                <div>
                  <p className="text-[11px] text-gray-500">Full Address</p>
                  <p className="text-sm font-medium text-gray-900">
                    {customer.fullAddress}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-5 gap-x-3 gap-y-2">
                <div>
                  <p className="text-[11px] text-gray-500">City</p>
                  <p className="text-sm text-gray-900">{customer.city}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">State</p>
                  <p className="text-sm text-gray-900">{customer.state}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Pincode</p>
                  <p className="text-sm text-gray-900">{customer.pincode}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Latitude</p>
                  <p className="text-xs font-mono text-gray-900">
                    {customer.latitude}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Longitude</p>
                  <p className="text-xs font-mono text-gray-900">
                    {customer.longitude}
                  </p>
                </div>
              </div>
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
                  <p className="text-[11px] text-gray-500">Customer ID</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">
                    {customer.customerId.toUpperCase()}
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
                      Not applicable
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked Companies — one panel per company. Header carries
              the company name, status, and Block / Unblock; the body
              underneath lists every (Beat Name, Delivery Day) the
              customer is mapped to for that company. A single company
              with multiple delivery days renders as multiple rows in
              its panel (e.g. ITC delivers Monday for KPHB and
              Wednesday for SR Nagar). */}
          <Card>
            <CardHeader className="py-2.5 px-4 border-b border-gray-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                Linked Companies ({customer.companies.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {customer.companies.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  No companies linked to this customer yet.
                </p>
              ) : (
                <>
                  {customer.companies.map((co) => {
                    // Seller-side rule: each customer sits on ONE
                    // beat per company — the beat its location maps
                    // into. A beat can serve multiple delivery days,
                    // and the customer inherits all of them, but the
                    // row count stays at one per company.
                    const beat = findBeatForCustomer(
                      {
                        customerId: customer.customerId,
                        city: customer.city,
                        area: customer.area,
                        pincode: customer.pincode,
                        serviceabilityOverrides:
                          customer.serviceabilityOverrides,
                      },
                      co.companyId,
                    );
                    const uniqueDayCount = beat?.deliveryDays.length ?? 0;
                    return (
                      <div
                        key={co.companyId}
                        className={`rounded-lg border ${
                          co.status === "Active"
                            ? "border-gray-200"
                            : "border-red-100 bg-red-50/30"
                        } overflow-hidden`}
                      >
                        {/* Company header — Company name on the left,
                            status badge + action button on the right. */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 border-b border-gray-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="bg-blue-100 text-blue-700 p-1 rounded">
                              <Building2 className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {co.companyName}
                            </p>
                            {beat && uniqueDayCount > 0 && (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 h-5 px-1.5 text-[10px]">
                                {uniqueDayCount} delivery day
                                {uniqueDayCount === 1 ? "" : "s"}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
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
                            {co.status === "Active" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 border-red-300 text-red-700 hover:bg-red-50"
                                onClick={() =>
                                  setPendingBlockToggle({
                                    action: "block",
                                    companyId: co.companyId,
                                  })
                                }
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Block
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() =>
                                  setPendingBlockToggle({
                                    action: "unblock",
                                    companyId: co.companyId,
                                  })
                                }
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Unblock
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Beats body — ONE beat per (customer × company)
                            on the seller side. The beat name sits on
                            the left, the delivery day chips it carries
                            sit on the right (one beat can serve N
                            days). When no polygon covers this
                            customer for the company, show the empty
                            state. */}
                        {!beat ? (
                          <div className="px-3 py-3 flex items-center gap-2 text-xs text-gray-500">
                            <Lock className="h-3.5 w-3.5 text-gray-400" />
                            No serviceability polygon covers this
                            customer for {co.companyName}. Configure one
                            in Admin → Seller → Serviceability.
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/60">
                              <span>Beat Name</span>
                              <span>Delivery Days</span>
                            </div>
                            <div
                              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 px-3 py-2 items-center"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Route className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {beat.beatName}
                                </span>
                                {beat.polygonFileName && (
                                  <span
                                    title={`Polygon: ${beat.polygonFileName}`}
                                    className="text-emerald-600 shrink-0"
                                  >
                                    <MapPin className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {beat.deliveryDays.map((day) => (
                                  <TooltipProvider
                                    key={day}
                                    delayDuration={150}
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="w-fit cursor-help">
                                          <Badge className="gap-1 bg-blue-50 text-blue-700 border-blue-200 font-medium">
                                            <CalendarClock className="h-3 w-3" />
                                            {day}
                                            <Lock className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                                          </Badge>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-xs">
                                        Read-only — change this
                                        beat&apos;s delivery days in
                                        Admin → Seller →
                                        Serviceability.
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-gray-500 pt-1">
                    Status and Block / Unblock are tracked per company.
                    Each company shows the <b>one beat</b> the
                    customer&apos;s location maps into — that beat can
                    carry multiple delivery days (e.g. KPHB 1 served
                    Mon &amp; Tue). To re-route a customer or shift days,
                    edit the polygons in Admin → Seller → Serviceability.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
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
                {/* Store name label — floats above the OSM marker (centred) */}
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                  <div className="relative flex flex-col items-center" style={{ marginTop: "-56px" }}>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-green-300 rounded-lg text-xs font-semibold text-green-800 shadow-md whitespace-nowrap">
                      <Store className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      {customer.businessName}
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
              {/* Compact address + coords strip below the map */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs gap-3">
                <span className="text-gray-700 truncate">
                  <MapPin className="inline h-3.5 w-3.5 text-gray-500 mr-1" />
                  {customer.area}, {customer.city} — {customer.pincode}
                </span>
                <span className="font-mono text-gray-500 shrink-0">
                  {customer.latitude.toFixed(4)}, {customer.longitude.toFixed(4)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Block / Unblock confirmation — scoped to a single company link
          so the seller acknowledges the per-brand consequence. Block
          stops new orders against that brand only; other brands the
          customer buys from are unaffected. */}
      <Dialog
        open={pendingBlockToggle !== null}
        onOpenChange={(o) => !o && setPendingBlockToggle(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingBlockToggle?.action === "block" ? (
                <>
                  <Ban className="h-5 w-5 text-red-600" />
                  Block for {pendingBlockCompany?.companyName}?
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Unblock for {pendingBlockCompany?.companyName}?
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {pendingBlockToggle?.action === "block"
                ? `${customer.businessName} won't be able to place new orders for ${pendingBlockCompany?.companyName} until you manually unblock. Orders against other linked companies are not affected.`
                : `${customer.businessName} will be able to place orders for ${pendingBlockCompany?.companyName} again immediately.`}
            </DialogDescription>
          </DialogHeader>
          <div
            className={
              pendingBlockToggle?.action === "block"
                ? "bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900"
                : "bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-900"
            }
          >
            {pendingBlockToggle?.action === "block" ? (
              <>
                <b>Heads up:</b> there is no auto-unblock — you'll need to
                come back here and reverse this manually.
              </>
            ) : (
              <>
                The customer will see your storefront as available for
                this brand the next time they check in.
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingBlockToggle(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBlockToggle}
              className={
                pendingBlockToggle?.action === "block"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {pendingBlockToggle?.action === "block"
                ? "Yes, block for this company"
                : "Yes, unblock for this company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
