import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  getHolidays,
  getWeekOff,
  setHolidays as persistHolidays,
  setWeekOff as persistWeekOff,
  type FixedHoliday as PersistedHoliday,
  type WeekDay as PersistedWeekDay,
} from "../../lib/store-settings-data";
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
  Save,
  Store,
  Calendar,
  Clock,
  Trash2,
  Plus,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Star,
  AlertCircle,
  Lock,
  CalendarOff,
} from "lucide-react";
import { toast } from "sonner";

// ---------- Working Hours ----------
// Phase 1: a single open/close window applies to every working day.
// Day-of-week splits move to a later phase if a seller actually
// needs them — most distributors keep one schedule.

type FixedHoliday = PersistedHoliday;

// ---------- Weekly Off ----------
// Recurring weekly closures. The seller picks one or more weekdays
// that are always closed, regardless of working hours. The persisted
// store-settings-data lib owns the source of truth; this page reads
// from it on mount and writes back via Save handlers.
type WeekDay = PersistedWeekDay;
const WEEK_DAYS: { key: WeekDay; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

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

  // ---- Working Hours (single window) ----
  // One open/close pair applies to every working day. Per-day splits
  // were removed — sellers told us they keep one schedule.
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("21:00");

  // ---- Weekly Off ----
  // Initial value read from the persisted store-settings lib so a
  // weekOff change made elsewhere (or from a prior session) survives.
  const initialWeekOff = getWeekOff();
  const [weekOff, setWeekOff] = useState<Set<WeekDay>>(
    () => new Set(initialWeekOff),
  );
  // Last-saved snapshot for the whole Working Hours section
  // (open + close + weekly off). Save is gated on dirty.
  const [savedWorkingHours, setSavedWorkingHours] = useState({
    openTime: "09:00",
    closeTime: "21:00",
    weekOff: initialWeekOff,
  });
  const isWorkingHoursDirty =
    openTime !== savedWorkingHours.openTime ||
    closeTime !== savedWorkingHours.closeTime ||
    savedWorkingHours.weekOff.length !== weekOff.size ||
    savedWorkingHours.weekOff.some((d) => !weekOff.has(d));
  const toggleWeekOff = (key: WeekDay) =>
    setWeekOff((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ---- Fixed Holidays ----
  // Source of truth is store-settings-data (persisted to localStorage).
  // We read on mount and call the persistor on every mutation so other
  // pages (delivery-date predictor, orders list) see the change live.
  const [holidays, setHolidaysState] = useState<FixedHoliday[]>(() =>
    getHolidays(),
  );
  const setHolidays = (
    updater: FixedHoliday[] | ((prev: FixedHoliday[]) => FixedHoliday[]),
  ) => {
    setHolidaysState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistHolidays(next);
      return next;
    });
  };
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");

  // Persist weekOff whenever the saved snapshot changes. Centralised in
  // an effect so every code path that ends up calling
  // setSavedWorkingHours also flushes to localStorage without each
  // caller having to remember.
  useEffect(() => {
    persistWeekOff(savedWorkingHours.weekOff);
  }, [savedWorkingHours.weekOff]);

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

  // ---- Section save handlers ----
  // Each card has its own Save button; there's no longer a global
  // "Save Changes" at the page level. Sellers can change one section
  // and persist it without touching the others.
  const handleSaveWorkingHours = () => {
    if (openTime >= closeTime) {
      toast.error("Closing time must be after opening time");
      return;
    }
    if (weekOff.size === 7) {
      toast.error("At least one working day is required");
      return;
    }
    setSavedWorkingHours({
      openTime,
      closeTime,
      weekOff: Array.from(weekOff),
    });
    toast.success("Working hours saved.");
  };

  const handleAddHoliday = () => {
    if (!newHolidayName.trim() || !newHolidayDate) {
      toast.error("Please enter both the holiday name and date");
      return;
    }
    if (holidays.some((h) => h.date === newHolidayDate)) {
      toast.error("A holiday already exists on this date");
      return;
    }
    setHolidays((prev) =>
      [
        ...prev,
        { id: `h-${Date.now()}`, name: newHolidayName.trim(), date: newHolidayDate },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    );
    setNewHolidayName("");
    setNewHolidayDate("");
    toast.success("Holiday added.");
  };

  const handleRemoveHoliday = (id: string) => {
    const h = holidays.find((x) => x.id === id);
    setHolidays((prev) => prev.filter((x) => x.id !== id));
    if (h) toast.success(`Removed "${h.name}"`);
  };

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

  const formatHolidayDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

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

        {/* Weekly Off + Fixed Holidays — recurring days off and one-off
            holidays, kept side-by-side. Open/close working hours moved
            out — sellers told us the per-day window was overkill, so
            the only schedule control left is which weekdays are closed. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Working Hours — open/close pair + weekly off chips. Weekly
              off persists to store-settings-data so the delivery-date
              predictor + orders list pick up the change live. */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Working Hours
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    {weekOff.size} weekly off
                  </Badge>
                </CardTitle>
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={handleSaveWorkingHours}
                  disabled={!isWorkingHoursDirty}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Open</Label>
                  <Input
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Close</Label>
                  <Input
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                </div>
                <p className="text-[11px] text-gray-500 pb-1.5">
                  Buyers will see the store based on the configured working
                  days.
                </p>
              </div>
              <div className="space-y-1.5 pt-1 border-t border-gray-100">
                <Label className="text-xs flex items-center gap-1.5 text-gray-700 pt-2">
                  <CalendarOff className="h-3.5 w-3.5 text-amber-600" />
                  Weekly Off
                </Label>
                <p className="text-[11px] text-gray-500">
                  Tap the days the store is always closed. Sundays are
                  off by default.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEK_DAYS.map((d) => {
                    const on = weekOff.has(d.key);
                    return (
                      <button
                        type="button"
                        key={d.key}
                        onClick={() => toggleWeekOff(d.key)}
                        aria-pressed={on}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          on
                            ? "bg-amber-50 border-amber-300 text-amber-800"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fixed Holidays — distributor-configured closures. Persisted
              via store-settings-data so the delivery-date predictor
              skips these dates when assigning expected delivery. */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-rose-600" />
                  Fixed Holidays
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                    {holidays.length}
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {holidays.length === 0 && (
                  <div className="p-2 text-center text-xs text-gray-500 border border-gray-200 rounded-md">
                    No fixed holidays configured.
                  </div>
                )}
                {holidays.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-2 border border-gray-200 rounded-md px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                        {formatHolidayDate(h.date)}
                      </span>
                      <p className="text-sm text-gray-900 truncate">{h.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-600 hover:bg-red-50"
                      onClick={() => handleRemoveHoliday(h.id)}
                      aria-label={`Remove ${h.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border border-dashed border-gray-300 rounded-md p-2 grid grid-cols-[1fr_140px_auto] gap-1.5 items-end">
                <Input
                  placeholder="Holiday name"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={handleAddHoliday}
                  disabled={!newHolidayName.trim() || !newHolidayDate}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
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
