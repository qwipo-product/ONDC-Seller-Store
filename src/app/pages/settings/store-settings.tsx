import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
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
  ArrowLeft,
  Store,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Star,
  AlertCircle,
  Lock,
  Clock,
  Calendar,
  CalendarOff,
  Save,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

// ---------- Warehouses ----------
// Phase 1 rule: warehouses are append-only. Once created they can't
// be edited or deleted; the first warehouse is permanently the
// default. This keeps Location-ID references on existing SKUs stable.
interface Warehouse {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  latitude: string;
  longitude: string;
  isDefault: boolean;
}

export function StoreSettings() {
  const navigate = useNavigate();

  // ---- Accept Orders ----
  // The toggle never flips immediately — both pause and resume open a
  // confirmation dialog so the seller knows that turning it off means
  // new orders stop until they manually flip it back on.
  const [acceptOrders, setAcceptOrders] = useState(true);
  const [pendingAcceptOrders, setPendingAcceptOrders] = useState<boolean | null>(null);

  // ---- Warehouses ----
  const [warehouses, setWarehouses] = useState<Warehouse[]>([
    {
      id: "wh-1",
      name: "Warehouse 1",
      address: "Plot 14, MIDC Industrial Estate",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400072",
      latitude: "19.1100",
      longitude: "72.8800",
      isDefault: true,
    },
  ]);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [warehouseDraft, setWarehouseDraft] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
    latitude: "",
    longitude: "",
  });
  const [warehouseErrors, setWarehouseErrors] = useState<{
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    latitude?: string;
    longitude?: string;
  }>({});

  // ---- Warehouse handlers ----
  const openCreateWarehouse = () => {
    setWarehouseDraft({
      name: "",
      address: "",
      city: "",
      state: "",
      pinCode: "",
      latitude: "",
      longitude: "",
    });
    setWarehouseErrors({});
    setWarehouseDialogOpen(true);
  };

  const validateWarehouseDraft = () => {
    const errs: typeof warehouseErrors = {};
    if (!warehouseDraft.name.trim()) errs.name = "Warehouse name is required";
    if (!warehouseDraft.address.trim()) errs.address = "Address is required";
    if (!warehouseDraft.city.trim()) errs.city = "City is required";
    if (!warehouseDraft.state.trim()) errs.state = "State is required";
    if (!warehouseDraft.pinCode.trim()) {
      errs.pinCode = "PIN is required";
    } else if (!/^\d{6}$/.test(warehouseDraft.pinCode.trim())) {
      errs.pinCode = "PIN must be a 6-digit number";
    }
    const lat = parseFloat(warehouseDraft.latitude);
    if (!warehouseDraft.latitude.trim()) {
      errs.latitude = "Latitude is required";
    } else if (isNaN(lat) || lat < -90 || lat > 90) {
      errs.latitude = "Latitude must be a number between -90 and 90";
    }
    const lng = parseFloat(warehouseDraft.longitude);
    if (!warehouseDraft.longitude.trim()) {
      errs.longitude = "Longitude is required";
    } else if (isNaN(lng) || lng < -180 || lng > 180) {
      errs.longitude = "Longitude must be a number between -180 and 180";
    }
    setWarehouseErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveWarehouse = () => {
    if (!validateWarehouseDraft()) return;
    const id = `wh-${Date.now()}`;
    // First warehouse is permanently the default. Subsequent ones are
    // never the default — the rule is fixed, no override.
    const isFirst = warehouses.length === 0;
    setWarehouses((prev) => [
      ...prev,
      {
        id,
        name: warehouseDraft.name.trim(),
        address: warehouseDraft.address.trim(),
        city: warehouseDraft.city.trim(),
        state: warehouseDraft.state.trim(),
        pinCode: warehouseDraft.pinCode.trim(),
        latitude: warehouseDraft.latitude.trim(),
        longitude: warehouseDraft.longitude.trim(),
        isDefault: isFirst,
      },
    ]);
    setWarehouseDialogOpen(false);
    toast.success(
      isFirst
        ? `Created "${warehouseDraft.name.trim()}" — set as default warehouse.`
        : `Created "${warehouseDraft.name.trim()}".`,
    );
  };

  const isDraftValid =
    warehouseDraft.name.trim() !== "" &&
    warehouseDraft.address.trim() !== "" &&
    warehouseDraft.city.trim() !== "" &&
    warehouseDraft.state.trim() !== "" &&
    /^\d{6}$/.test(warehouseDraft.pinCode.trim()) &&
    warehouseDraft.latitude.trim() !== "" &&
    !isNaN(parseFloat(warehouseDraft.latitude)) &&
    Math.abs(parseFloat(warehouseDraft.latitude)) <= 90 &&
    warehouseDraft.longitude.trim() !== "" &&
    !isNaN(parseFloat(warehouseDraft.longitude)) &&
    Math.abs(parseFloat(warehouseDraft.longitude)) <= 180;

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-full">
      {/* Compact header — no page-level save; each section saves on its own */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/settings")}
          className="h-8 w-8 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Store className="h-5 w-5 text-blue-600" />
          Store Settings
        </h1>
      </div>

      <div className="max-w-5xl space-y-3">
        {/* Row 1: Store Status + Warehouses side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Store Status — Accept Orders with confirm-on-flip.
              No Save button: the confirmation dialog already commits
              the change on Confirm, so a separate Save would be a
              duplicate ask. */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Store Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-sm">Accept Orders</Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {acceptOrders
                      ? "New orders are arriving normally."
                      : "Paused. New orders won't arrive until you manually turn this back on."}
                  </p>
                </div>
                <Switch
                  checked={acceptOrders}
                  // Don't flip immediately — open the confirm dialog
                  // (covers both pause and resume) so the seller has to
                  // acknowledge what happens next.
                  onCheckedChange={(v) => setPendingAcceptOrders(v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Warehouses — append-only, first = permanent default */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <WarehouseIcon className="h-4 w-4 text-purple-600" />
                  Warehouses
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                    {warehouses.length}
                  </Badge>
                </CardTitle>
                {/* "Add Warehouse" CTA removed for Phase 1 — warehouse
                    creation is currently handled out-of-band; the
                    button will return when the create flow is wired up
                    end-to-end. The dialog markup below is kept since
                    it's a self-contained component, but no UI opens
                    it. */}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {warehouses.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">
                  No warehouses yet. Add one to publish SKUs.
                </p>
              ) : (
                warehouses.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 border border-gray-200 rounded-md p-2 bg-gray-50/50"
                    title="Warehouses can't be edited or deleted once created."
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {w.name}
                        </p>
                        {w.isDefault && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 h-5">
                            <Star className="h-2.5 w-2.5 fill-emerald-700" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {w.city}, {w.state} · {w.pinCode} · {w.latitude}, {w.longitude}
                      </p>
                    </div>
                    {/* No edit / delete — Phase 1 rule: warehouses are
                        permanent once created. The lock icon makes the
                        constraint visible. */}
                    <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  </div>
                ))
              )}
              <p className="text-[11px] text-gray-500 pt-1">
                Once added, a warehouse can't be edited or deleted. The first
                warehouse is permanently the default.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Working Hours + Fixed Holidays — Phase 1 stubs. Both
            cards render the final UI shape (so onboarding screenshots
            line up with the eventual feature) but are pointer-locked
            and visually muted, with a "Coming soon" pill called out
            over each editable region. The persistence layer in
            store-settings-data still feeds the delivery-date
            predictor from its defaults; only the seller-facing edit
            UI is parked. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="opacity-60 select-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Working Hours
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    1 weekly off
                  </Badge>
                </CardTitle>
                <Button size="sm" className="h-7 gap-1 text-xs" disabled>
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 pointer-events-none">
              <div className="relative flex items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Open</Label>
                  <Input
                    type="time"
                    defaultValue="09:00"
                    className="w-28 h-8 text-sm"
                    disabled
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Close</Label>
                  <Input
                    type="time"
                    defaultValue="20:00"
                    className="w-28 h-8 text-sm"
                    disabled
                  />
                </div>
                <p className="text-[11px] text-gray-500 pb-1.5">
                  Buyers will see the store based on the configured working
                  days.
                </p>
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm text-[11px] font-medium text-gray-700">
                  <Clock className="h-3 w-3" />
                  Coming soon
                </span>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-gray-100">
                <Label className="text-xs flex items-center gap-1.5 text-gray-700 pt-2">
                  <CalendarOff className="h-3.5 w-3.5 text-amber-600" />
                  Weekly Off
                </Label>
                <p className="text-[11px] text-gray-500">
                  Tap the days the store is always closed.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "mon", short: "Mon" },
                    { key: "tue", short: "Tue" },
                    { key: "wed", short: "Wed" },
                    { key: "thu", short: "Thu" },
                    { key: "fri", short: "Fri" },
                    { key: "sat", short: "Sat" },
                    { key: "sun", short: "Sun" },
                  ].map((d) => {
                    const on = d.key === "sun";
                    return (
                      <span
                        key={d.key}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                          on
                            ? "bg-amber-50 border-amber-300 text-amber-800"
                            : "bg-white border-gray-200 text-gray-700"
                        }`}
                      >
                        {d.short}
                      </span>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-60 select-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-rose-600" />
                  Fixed Holidays
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                    0
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 pointer-events-none">
              <div className="grid grid-cols-1 gap-1.5">
                <div className="p-2 text-center text-xs text-gray-500 border border-gray-200 rounded-md">
                  No fixed holidays configured.
                </div>
              </div>

              <div className="relative border border-dashed border-gray-300 rounded-md p-2 grid grid-cols-[1fr_140px_auto] gap-1.5 items-end">
                <Input
                  placeholder="Holiday name"
                  className="h-8 text-sm"
                  disabled
                />
                <Input
                  type="date"
                  className="h-8 text-sm"
                  disabled
                />
                <Button size="sm" className="h-8 gap-1" disabled>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
                <span className="absolute left-1/2 -translate-x-1/2 -top-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm text-[11px] font-medium text-gray-700">
                  <Clock className="h-3 w-3" />
                  Coming soon
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Store Information — read-only */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">Store Information</CardTitle>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 leading-none"
                title="Store Information comes from the seller's onboarding profile and cannot be edited here."
              >
                Read-only
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Store Name</Label>
              <Input
                readOnly
                value="ABC Distributors"
                className="bg-gray-100 cursor-not-allowed h-8 text-sm focus-visible:ring-0 focus-visible:border-input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact Number</Label>
              <Input
                readOnly
                value="+91 98765 43210"
                className="bg-gray-100 cursor-not-allowed h-8 text-sm focus-visible:ring-0 focus-visible:border-input"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Accept Orders confirmation ---- */}
      {/* Both directions get a dialog. Pausing surfaces the consequence
          ("orders won't come until you turn this back on"); resuming
          gets a lighter "are you sure?" so the flip is intentional. */}
      <Dialog
        open={pendingAcceptOrders !== null}
        onOpenChange={(o) => !o && setPendingAcceptOrders(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingAcceptOrders ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
              {pendingAcceptOrders
                ? "Start accepting orders again?"
                : "Pause new orders?"}
            </DialogTitle>
            <DialogDescription>
              {pendingAcceptOrders
                ? "Your store will start accepting new orders immediately. Buyers will see your catalog as available."
                : "Once paused, no new orders will arrive until you manually turn Accept Orders back on. Existing orders are not affected."}
            </DialogDescription>
          </DialogHeader>
          <div
            className={
              pendingAcceptOrders
                ? "bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-900"
                : "bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900"
            }
          >
            {pendingAcceptOrders ? (
              <>
                Confirm to resume order intake. You can pause again at any time
                from this page.
              </>
            ) : (
              <>
                <b>Heads up:</b> orders won't come in again until you flip this
                back on yourself. There is no auto-resume.
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingAcceptOrders(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingAcceptOrders === null) return;
                setAcceptOrders(pendingAcceptOrders);
                toast.success(
                  pendingAcceptOrders
                    ? "Store is now accepting orders."
                    : "Store paused. New orders won't arrive until you turn it back on.",
                );
                setPendingAcceptOrders(null);
              }}
              className={
                pendingAcceptOrders
                  ? ""
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }
            >
              {pendingAcceptOrders ? "Yes, accept orders" : "Yes, pause orders"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Add Warehouse dialog ---- */}
      <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WarehouseIcon className="h-5 w-5 text-purple-600" />
              Add Warehouse
            </DialogTitle>
            <DialogDescription>
              Once created, a warehouse can't be edited or deleted.
              {warehouses.length === 0
                ? " The first warehouse you add becomes the permanent default."
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Warehouse Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={warehouseDraft.name}
                onChange={(e) => {
                  setWarehouseDraft((p) => ({ ...p, name: e.target.value }));
                  if (warehouseErrors.name)
                    setWarehouseErrors((p) => ({ ...p, name: undefined }));
                }}
                placeholder="e.g. Mumbai Hub"
                aria-invalid={!!warehouseErrors.name}
              />
              {warehouseErrors.name && (
                <p className="text-[11px] text-red-600">{warehouseErrors.name}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Address <span className="text-red-500">*</span>
              </Label>
              <Input
                value={warehouseDraft.address}
                onChange={(e) => {
                  setWarehouseDraft((p) => ({ ...p, address: e.target.value }));
                  if (warehouseErrors.address)
                    setWarehouseErrors((p) => ({ ...p, address: undefined }));
                }}
                placeholder="Street, area, landmark…"
                aria-invalid={!!warehouseErrors.address}
              />
              {warehouseErrors.address && (
                <p className="text-[11px] text-red-600">{warehouseErrors.address}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={warehouseDraft.city}
                  onChange={(e) => {
                    setWarehouseDraft((p) => ({ ...p, city: e.target.value }));
                    if (warehouseErrors.city)
                      setWarehouseErrors((p) => ({ ...p, city: undefined }));
                  }}
                  placeholder="Mumbai"
                  aria-invalid={!!warehouseErrors.city}
                />
                {warehouseErrors.city && (
                  <p className="text-[11px] text-red-600">{warehouseErrors.city}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  State <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={warehouseDraft.state}
                  onChange={(e) => {
                    setWarehouseDraft((p) => ({ ...p, state: e.target.value }));
                    if (warehouseErrors.state)
                      setWarehouseErrors((p) => ({ ...p, state: undefined }));
                  }}
                  placeholder="Maharashtra"
                  aria-invalid={!!warehouseErrors.state}
                />
                {warehouseErrors.state && (
                  <p className="text-[11px] text-red-600">{warehouseErrors.state}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                PIN Code <span className="text-red-500">*</span>
              </Label>
              <Input
                inputMode="numeric"
                value={warehouseDraft.pinCode}
                onChange={(e) => {
                  setWarehouseDraft((p) => ({
                    ...p,
                    pinCode: e.target.value.replace(/\D/g, "").slice(0, 6),
                  }));
                  if (warehouseErrors.pinCode)
                    setWarehouseErrors((p) => ({ ...p, pinCode: undefined }));
                }}
                placeholder="6-digit PIN"
                className="w-32"
                aria-invalid={!!warehouseErrors.pinCode}
              />
              {warehouseErrors.pinCode && (
                <p className="text-[11px] text-red-600">{warehouseErrors.pinCode}</p>
              )}
            </div>

            {/* Lat / Long — required so the warehouse can be plotted on
                a map and used for serviceability calculations. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  Latitude <span className="text-red-500">*</span>
                </Label>
                <Input
                  inputMode="decimal"
                  value={warehouseDraft.latitude}
                  onChange={(e) => {
                    setWarehouseDraft((p) => ({ ...p, latitude: e.target.value }));
                    if (warehouseErrors.latitude)
                      setWarehouseErrors((p) => ({ ...p, latitude: undefined }));
                  }}
                  placeholder="e.g. 19.0760"
                  aria-invalid={!!warehouseErrors.latitude}
                />
                {warehouseErrors.latitude && (
                  <p className="text-[11px] text-red-600">{warehouseErrors.latitude}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Longitude <span className="text-red-500">*</span>
                </Label>
                <Input
                  inputMode="decimal"
                  value={warehouseDraft.longitude}
                  onChange={(e) => {
                    setWarehouseDraft((p) => ({ ...p, longitude: e.target.value }));
                    if (warehouseErrors.longitude)
                      setWarehouseErrors((p) => ({ ...p, longitude: undefined }));
                  }}
                  placeholder="e.g. 72.8777"
                  aria-invalid={!!warehouseErrors.longitude}
                />
                {warehouseErrors.longitude && (
                  <p className="text-[11px] text-red-600">{warehouseErrors.longitude}</p>
                )}
              </div>
            </div>

            {warehouses.length === 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2.5 text-[11px] text-emerald-900 flex items-start gap-1.5">
                <Star className="h-3.5 w-3.5 shrink-0 mt-0.5 fill-emerald-700 text-emerald-700" />
                This is your first warehouse — it'll be permanently set as
                the default.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWarehouse} disabled={!isDraftValid}>
              Add Warehouse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
