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
  getBeatMov,
  setBeatMov,
  getNonBeatMov,
  setNonBeatMov,
  getBeatCutoffTime,
  setBeatCutoffTime,
} from "../../lib/order-settings-data";

export function OrderSettings() {
  const navigate = useNavigate();

  // ---- Minimum Order Value — Beat vs Non-Beat ----
  // Per the June review the single MOV split into two: Beat orders
  // (ride the serviceability schedule, lower MOV) and Non-Beat
  // orders (ad-hoc, higher MOV). Sellers configure both here.
  const [beatMov, setBeatMovInput] = useState(() => String(getBeatMov()));
  const [nonBeatMov, setNonBeatMovInput] = useState(() =>
    String(getNonBeatMov()),
  );
  const [savedBeatMov, setSavedBeatMov] = useState(beatMov);
  const [savedNonBeatMov, setSavedNonBeatMov] = useState(nonBeatMov);
  const isOrderValueDirty =
    beatMov !== savedBeatMov || nonBeatMov !== savedNonBeatMov;
  // Inline errors keyed by field — surfaces under the relevant input
  // instead of a toast.
  const [orderValueErrors, setOrderValueErrors] = useState<{
    beat?: string;
    nonBeat?: string;
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
    const beat = parseFloat(beatMov);
    const nonBeat = parseFloat(nonBeatMov);
    const errs: { beat?: string; nonBeat?: string } = {};
    if (beatMov.trim() === "" || isNaN(beat) || beat < 0) {
      errs.beat = "Enter a non-negative number";
    }
    if (nonBeatMov.trim() === "" || isNaN(nonBeat) || nonBeat < 0) {
      errs.nonBeat = "Enter a non-negative number";
    }
    if (errs.beat || errs.nonBeat) {
      setOrderValueErrors(errs);
      return;
    }
    setOrderValueErrors({});
    setBeatMov(beat);
    setNonBeatMov(nonBeat);
    setSavedBeatMov(beatMov);
    setSavedNonBeatMov(nonBeatMov);
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
          {/* Order Value — Beat + Non-Beat minimums. Sales Beat orders
              ride the configured serviceability schedule and clear a
              lower floor; non-beat (ad-hoc) orders clear the higher
              standard floor. Both values feed downstream MOV checks. */}
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
                <Label className="text-xs">Sales Beat Minimum (₹)</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={beatMov}
                  onChange={(e) => {
                    setBeatMovInput(e.target.value);
                    if (orderValueErrors.beat)
                      setOrderValueErrors((prev) => ({ ...prev, beat: undefined }));
                  }}
                  className="h-8 text-sm"
                  aria-invalid={!!orderValueErrors.beat}
                />
                {orderValueErrors.beat ? (
                  <p className="text-[11px] text-red-600">
                    {orderValueErrors.beat}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    Floor for orders riding a Sales Beat.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Non-Beat Minimum (₹)</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={nonBeatMov}
                  onChange={(e) => {
                    setNonBeatMovInput(e.target.value);
                    if (orderValueErrors.nonBeat)
                      setOrderValueErrors((prev) => ({
                        ...prev,
                        nonBeat: undefined,
                      }));
                  }}
                  className="h-8 text-sm"
                  aria-invalid={!!orderValueErrors.nonBeat}
                />
                {orderValueErrors.nonBeat ? (
                  <p className="text-[11px] text-red-600">
                    {orderValueErrors.nonBeat}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    Floor for ad-hoc / standard orders.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Processing — Default Processing Time + Cancellation Window */}
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
