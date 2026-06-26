import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
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
  ShoppingCart,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProcessingTimeHours,
  setProcessingTimeHours,
  getOrderValueMin,
  setOrderValueMin,
  getOrderValueMax,
  setOrderValueMax,
  getBeatCutoffTime,
  setBeatCutoffTime,
} from "../../lib/order-settings-data";

export function OrderSettings() {
  const navigate = useNavigate();

  // ---- Order Value — Minimum + optional Maximum ----
  // Single MOV floor (Minimum) plus an optional ceiling (Maximum).
  // Orders under the minimum are rejected; the maximum caps a single
  // order's value when set. Both persist via order-settings-data.
  const [orderMin, setOrderMinInput] = useState(() => String(getOrderValueMin()));
  const [orderMax, setOrderMaxInput] = useState(() => String(getOrderValueMax()));
  const [savedOrderMin, setSavedOrderMin] = useState(orderMin);
  const [savedOrderMax, setSavedOrderMax] = useState(orderMax);
  const isOrderValueDirty =
    orderMin !== savedOrderMin || orderMax !== savedOrderMax;
  // Inline errors keyed by field — surfaces under the relevant input
  // instead of a toast.
  const [orderValueErrors, setOrderValueErrors] = useState<{
    min?: string;
    max?: string;
  }>({});

  // ---- Order Processing ----
  // Processing Time is persisted via the shared lib so the SKU Detail
  // page (and any other downstream consumer) can read the seller's
  // configured value as the source of truth.
  const [processingTime, setProcessingTime] = useState(() =>
    getProcessingTimeHours(),
  );
  // Beat order acceptance cut-off. Default 17:00 per the June review.
  // Stored as `HH:MM` so it pairs cleanly with `<input type="time">`.
  const [beatCutoffTime, setBeatCutoffTimeInput] = useState(() =>
    getBeatCutoffTime(),
  );
  const [savedProcessing, setSavedProcessing] = useState({
    processingTime: getProcessingTimeHours(),
    beatCutoffTime: getBeatCutoffTime(),
  });
  const isProcessingDirty =
    processingTime !== savedProcessing.processingTime ||
    beatCutoffTime !== savedProcessing.beatCutoffTime;

  // ---- Order Return ----
  // No section Save button — the toggle pop-up commits the change
  // directly. When the seller enables returns, the pop-up makes them
  // pick the Return Window inside the dialog (mandatory). Disabling
  // is a simple acknowledgement.
  const [returnsEnabled, setReturnsEnabled] = useState(true);
  const [returnWindow, setReturnWindow] = useState("24");
  // Pending toggle direction for the confirm dialog. null = closed.
  const [pendingReturnsToggle, setPendingReturnsToggle] = useState<boolean | null>(null);
  // In-dialog state for the return window picker (only used when
  // enabling). Pre-seeded with the current value so re-enabling
  // remembers the last setting.
  const [draftReturnWindow, setDraftReturnWindow] = useState("24");
  const [draftReturnWindowError, setDraftReturnWindowError] = useState<string | null>(null);

  // ---- Section save handlers ----
  const handleSaveOrderValue = () => {
    const min = parseFloat(orderMin);
    const max = orderMax.trim() === "" ? 0 : parseFloat(orderMax);
    const errs: { min?: string; max?: string } = {};
    if (orderMin.trim() === "" || isNaN(min) || min < 0) {
      errs.min = "Enter a non-negative number";
    }
    if (orderMax.trim() !== "" && (isNaN(max) || max < 0)) {
      errs.max = "Enter a non-negative number";
    } else if (!errs.min && orderMax.trim() !== "" && max > 0 && max < min) {
      errs.max = "Maximum can't be below the minimum";
    }
    if (errs.min || errs.max) {
      setOrderValueErrors(errs);
      return;
    }
    setOrderValueErrors({});
    setOrderValueMin(min);
    setOrderValueMax(max);
    setSavedOrderMin(orderMin);
    setSavedOrderMax(orderMax);
    toast.success("Order value saved.");
  };

  const handleSaveProcessing = () => {
    setSavedProcessing({ processingTime, beatCutoffTime });
    setProcessingTimeHours(processingTime);
    setBeatCutoffTime(beatCutoffTime);
    toast.success("Order processing saved.");
  };

  const openReturnsToggle = (next: boolean) => {
    setPendingReturnsToggle(next);
    if (next) {
      // Seed the picker with the last chosen window so the seller
      // doesn't have to re-pick if they're toggling on/off/on.
      setDraftReturnWindow(returnWindow || "24");
      setDraftReturnWindowError(null);
    }
  };

  const handleConfirmReturnsToggle = () => {
    if (pendingReturnsToggle === null) return;
    if (pendingReturnsToggle) {
      // Enabling — must pick a window.
      if (!draftReturnWindow) {
        setDraftReturnWindowError("Please select a return window");
        return;
      }
      setDraftReturnWindowError(null);
      setReturnsEnabled(true);
      setReturnWindow(draftReturnWindow);
      toast.success(
        `Returns enabled. Buyers can request a return within ${draftReturnWindow} hours of delivery.`,
      );
    } else {
      setReturnsEnabled(false);
      toast.success(
        "Returns disabled. Buyers won't see the return option on delivered orders.",
      );
    }
    setPendingReturnsToggle(null);
  };

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-full">
      {/* Compact header — single line, no page-level save (each section
          owns its own). */}
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
          <ShoppingCart className="h-5 w-5 text-purple-600" />
          Order Settings
        </h1>
      </div>

      <div className="max-w-5xl space-y-3">
        {/* Row 1: Order Value + Processing side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Order Value — Minimum (mandatory floor) + Maximum
              (optional per-order ceiling). The minimum is the MOV
              guard for downstream checks; the maximum is "0 = no
              cap" otherwise it's the hard upper bound on any single
              order. */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                  Order Value
                </CardTitle>
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={handleSaveOrderValue}
                  disabled={!isOrderValueDirty}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Minimum (₹)</Label>
                <Input
                  type="number"
                  placeholder="2500"
                  value={orderMin}
                  onChange={(e) => {
                    setOrderMinInput(e.target.value);
                    if (orderValueErrors.min)
                      setOrderValueErrors((prev) => ({ ...prev, min: undefined }));
                  }}
                  className="h-8 text-sm"
                  aria-invalid={!!orderValueErrors.min}
                />
                {orderValueErrors.min ? (
                  <p className="text-[11px] text-red-600">
                    {orderValueErrors.min}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    Orders below this aren&apos;t accepted.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Maximum (₹)</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={orderMax}
                  onChange={(e) => {
                    setOrderMaxInput(e.target.value);
                    if (orderValueErrors.max)
                      setOrderValueErrors((prev) => ({
                        ...prev,
                        max: undefined,
                      }));
                  }}
                  className="h-8 text-sm"
                  aria-invalid={!!orderValueErrors.max}
                />
                {orderValueErrors.max ? (
                  <p className="text-[11px] text-red-600">
                    {orderValueErrors.max}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    Optional cap per order.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Processing — Default Processing Time + Order Acceptance Time */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Order Processing
                </CardTitle>
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={handleSaveProcessing}
                  disabled={!isProcessingDirty}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Processing Time</Label>
                <Select value={processingTime} onValueChange={setProcessingTime}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="72">72 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-500">
                  Time to prepare orders for shipment.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Order Acceptance Time</Label>
                <Input
                  type="time"
                  value={beatCutoffTime}
                  onChange={(e) => setBeatCutoffTimeInput(e.target.value)}
                  className="h-8 text-sm"
                />
                <p className="text-[11px] text-gray-500">
                  Orders received after this roll to the next delivery cycle.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Return — toggle commits via the popup; no card-level
            Save button. The popup carries the Return Window picker,
            which is mandatory when enabling. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-purple-600" />
              Order Return
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-start justify-between gap-3 border border-gray-200 rounded-md p-2.5 bg-gray-50/50">
              <div>
                <Label className="text-sm">Allow Returns</Label>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {returnsEnabled
                    ? `Enabled · Return window: ${returnWindow} hours from delivery.`
                    : "Disabled · buyers don't see a return option on delivered orders."}
                </p>
              </div>
              <Switch
                checked={returnsEnabled}
                // Don't flip immediately — the popup commits the change
                // (and asks for the Return Window when enabling).
                onCheckedChange={(v) => openReturnsToggle(v)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Return Type</Label>
              <Select value="full-order" disabled>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-order">Full Order Return Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500">
                Phase 1: full-order returns only.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Allow Returns dialog — when enabling, asks the seller to pick
          the Return Window inline (mandatory). When disabling, just
          confirms. Closing without confirming reverts the toggle. */}
      <Dialog
        open={pendingReturnsToggle !== null}
        onOpenChange={(o) => !o && setPendingReturnsToggle(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingReturnsToggle ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
              {pendingReturnsToggle
                ? "Allow buyers to raise returns?"
                : "Stop accepting return requests?"}
            </DialogTitle>
            <DialogDescription>
              {pendingReturnsToggle
                ? "Pick how long buyers have after delivery to request a full-order return."
                : "Buyers will no longer see a Return option on delivered orders. In-flight return requests already submitted continue through their normal flow."}
            </DialogDescription>
          </DialogHeader>

          {/* Inline return-window picker — only when enabling. */}
          {pendingReturnsToggle && (
            <div className="space-y-1">
              <Label className="text-xs">
                Return Window <span className="text-red-500">*</span>
              </Label>
              <Select
                value={draftReturnWindow}
                onValueChange={(v) => {
                  setDraftReturnWindow(v);
                  if (draftReturnWindowError) setDraftReturnWindowError(null);
                }}
              >
                <SelectTrigger
                  className="h-9 text-sm"
                  aria-invalid={!!draftReturnWindowError}
                >
                  <SelectValue placeholder="Choose a window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                </SelectContent>
              </Select>
              {draftReturnWindowError ? (
                <p className="text-[11px] text-red-600">{draftReturnWindowError}</p>
              ) : (
                <p className="text-[11px] text-gray-500">
                  Time from delivery to raise a return.
                </p>
              )}
            </div>
          )}

          {!pendingReturnsToggle && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900">
              <b>Heads up:</b> buyers will see returns disabled across all
              delivered orders the moment you confirm.
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingReturnsToggle(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReturnsToggle}
              className={
                pendingReturnsToggle
                  ? ""
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }
            >
              {pendingReturnsToggle ? "Yes, allow returns" : "Yes, disable returns"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
