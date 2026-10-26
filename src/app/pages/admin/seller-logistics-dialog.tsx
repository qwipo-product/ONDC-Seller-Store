import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import {
  logisticsRetailerPct,
  type LogisticsFeeConfig,
} from "../../lib/charges-data";

const money = (n: number) => `₹${(+n.toFixed(2)).toLocaleString("en-IN")}`;
const pct = (n: number) => `${+n.toFixed(2)}%`;
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Seller-level Logistics Fee editor. Opened from the single Logistics tile on
 * the Manage Seller → Charges & Fees tab. Shows only the charging method and
 * its related fields (no review step, no validity). Saving closes the dialog.
 */
export function SellerLogisticsDialog({
  open,
  onOpenChange,
  initial,
  sellerName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LogisticsFeeConfig;
  sellerName: string;
  onSave: (logistics: LogisticsFeeConfig) => void;
}) {
  const [draft, setDraft] = useState<LogisticsFeeConfig>(initial);

  // Reset the draft to the latest saved config each time the dialog opens.
  // Percentage of GMV is the only charging method, so coerce any legacy
  // method on the way in.
  useEffect(() => {
    if (open) setDraft({ ...initial, method: "gmv_percent" });
  }, [open, initial]);

  const l = draft;
  const retailer = logisticsRetailerPct(l);

  const setLogistics = (patch: Partial<LogisticsFeeConfig>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const validate = (): string | null => {
    if (l.sellerContributionPct > l.qwipoTargetPct)
      return "Seller contribution cannot exceed the Qwipo target fee.";
    if (l.waiverEnabled && l.waiverThreshold <= 0)
      return "Set a waiver order value greater than ₹0.";
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    onSave({ ...draft, enabled: true, method: "gmv_percent" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(95vw,760px)] w-[min(95vw,760px)] max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Logistics Fee
          </DialogTitle>
          <DialogDescription>
            {sellerName} • Applied on 3PL logistics for next-day delivery (NDD).
            Configure how the logistics fee is shared between Qwipo, seller and
            retailer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-1">
          <Label className="text-xs text-gray-700">Charging Method</Label>
          <div className="flex flex-col sm:flex-row gap-3 mt-1.5 mb-5">
            <MethodCard
              active
              title="Percentage of GMV"
              desc="Apply a fixed percentage on total order value"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeeInput
              label="Qwipo Target Fee (%)"
              value={l.qwipoTargetPct}
              onChange={(v) => setLogistics({ qwipoTargetPct: v })}
              suffix="%"
            />
            <FeeInput
              label="Seller Contribution (%)"
              value={l.sellerContributionPct}
              onChange={(v) => setLogistics({ sellerContributionPct: v })}
              suffix="%"
            />
            <CalcField
              label="Retailer Contribution (Calculated)"
              value={pct(retailer)}
              hint="Target Fee − Seller Contribution"
            />
          </div>

          <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 flex flex-wrap items-center gap-6">
            <p className="text-sm font-medium text-gray-700">Example for a {money(10000)} order</p>
            <Split label="Qwipo Charge" amount={money((10000 * l.qwipoTargetPct) / 100)} sub={pct(l.qwipoTargetPct)} />
            <Split label="Seller Contribution" amount={money((10000 * l.sellerContributionPct) / 100)} sub={pct(l.sellerContributionPct)} />
            <Split label="Retailer Pays" amount={money((10000 * retailer) / 100)} sub={pct(retailer)} />
          </div>

          {/* Logistics Fee Waiver — waive the fee above an order-value
              threshold (aggregated across all of the seller's companies). */}
          <div className="mt-6 pt-5 border-t border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Logistics Fee Waiver
                </h3>
                <p className="text-xs text-gray-500 max-w-md">
                  Waive the logistics fee once a retailer's total order value —
                  across all of this seller's companies — crosses a threshold.
                </p>
              </div>
              <Switch
                checked={l.waiverEnabled}
                onCheckedChange={(v) => setLogistics({ waiverEnabled: v })}
              />
            </div>
            {l.waiverEnabled && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <FeeInput
                  label="Waive-off Order Value (₹)"
                  value={l.waiverThreshold}
                  onChange={(v) => setLogistics({ waiverThreshold: v })}
                  suffix="₹"
                />
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-[11px] text-blue-900">
                  If a retailer's total order value across all of this seller's
                  companies crosses {money(l.waiverThreshold)}, the logistics fee
                  is waived for that order.
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Logistics Fee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Local building blocks ----

function MethodCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border p-4 transition-colors ${
        active
          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
            active ? "border-blue-600" : "border-gray-300"
          }`}
        >
          {active && <span className="w-2 h-2 rounded-full bg-blue-600" />}
        </span>
        <span className="text-sm font-medium text-gray-900">{title}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1 pl-6">{desc}</p>
    </button>
  );
}

function FeeInput({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-700">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="1"
          value={value === 0 ? "" : value}
          placeholder="0"
          onChange={(e) => onChange(num(e.target.value))}
          className="pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function CalcField({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="space-y-1 rounded-lg bg-blue-50/60 border border-blue-100 p-3">
      <Label className="text-xs text-blue-700">{label}</Label>
      <p className="text-lg font-semibold text-blue-900">{value}</p>
      <p className="text-[11px] text-blue-600/80">{hint}</p>
    </div>
  );
}

function Split({ label, amount, sub }: { label: string; amount: string; sub: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-base font-semibold text-gray-900">{amount}</p>
      <p className="text-[11px] text-gray-400">({sub})</p>
    </div>
  );
}
