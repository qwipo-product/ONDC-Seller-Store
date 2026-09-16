import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck, Plus, X } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { makeId, ONDC_CATEGORY_NAMES } from "../../lib/admin-catalog";
import {
  logisticsRetailerPerKg,
  logisticsRetailerPct,
  categoryLogisticsRetailer,
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
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const l = draft;
  const perKg = l.method === "per_kg";
  const byCategory = l.method === "by_category";
  const retailer = perKg ? logisticsRetailerPerKg(l) : logisticsRetailerPct(l);
  const kg = 24;

  const setLogistics = (patch: Partial<LogisticsFeeConfig>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const validate = (): string | null => {
    if (perKg) {
      if (l.sellerContributionPerKg > l.qwipoTargetPerKg)
        return "Seller contribution cannot exceed the Qwipo target fee.";
    } else if (l.method === "gmv_percent") {
      if (l.sellerContributionPct > l.qwipoTargetPct)
        return "Seller contribution cannot exceed the Qwipo target fee.";
    } else {
      // by_category
      if (l.categories.length === 0)
        return "Add at least one category fee, or choose another charging method.";
      if (l.categories.some((f) => !f.category))
        return "Pick a category for every fee row.";
      if (l.categories.some((f) => f.sellerContribution > f.qwipoTarget))
        return "Seller contribution cannot exceed the Qwipo target fee for a category.";
    }
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
    onSave({ ...draft, enabled: true });
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
              active={l.method === "gmv_percent"}
              title="Percentage of GMV"
              desc="Apply a fixed percentage on total order value"
              onClick={() => setLogistics({ method: "gmv_percent" })}
            />
            <MethodCard
              active={perKg}
              title="₹ per KG"
              desc="Charge a flat rate for every kilogram shipped"
              onClick={() => setLogistics({ method: "per_kg" })}
            />
            <MethodCard
              active={byCategory}
              title="By Category"
              desc="Set a separate fee for each product category"
              onClick={() => setLogistics({ method: "by_category" })}
            />
          </div>

          {byCategory ? (
            <CategoryFeeEditor draft={draft} setDraft={setDraft} />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FeeInput
                  label={perKg ? "Qwipo Target Fee (₹/kg)" : "Qwipo Target Fee (%)"}
                  value={perKg ? l.qwipoTargetPerKg : l.qwipoTargetPct}
                  onChange={(v) =>
                    setLogistics(perKg ? { qwipoTargetPerKg: v } : { qwipoTargetPct: v })
                  }
                  suffix={perKg ? "₹" : "%"}
                />
                <FeeInput
                  label={perKg ? "Seller Contribution (₹/kg)" : "Seller Contribution (%)"}
                  value={perKg ? l.sellerContributionPerKg : l.sellerContributionPct}
                  onChange={(v) =>
                    setLogistics(
                      perKg ? { sellerContributionPerKg: v } : { sellerContributionPct: v },
                    )
                  }
                  suffix={perKg ? "₹" : "%"}
                />
                <CalcField
                  label="Retailer Contribution (Calculated)"
                  value={perKg ? `${money(retailer)}/kg` : pct(retailer)}
                  hint="Target Fee − Seller Contribution"
                />
              </div>

              {perKg && (
                <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 flex flex-wrap items-center gap-6">
                  <p className="text-sm font-medium text-gray-700">Example for {kg} kg order</p>
                  <Split label="Qwipo Charge" amount={money(kg * l.qwipoTargetPerKg)} sub={`${kg} kg × ${money(l.qwipoTargetPerKg)}`} />
                  <Split label="Seller Contribution" amount={money(kg * l.sellerContributionPerKg)} sub={`${kg} kg × ${money(l.sellerContributionPerKg)}`} />
                  <Split label="Retailer Pays" amount={money(kg * retailer)} sub={`${kg} kg × ${money(retailer)}`} />
                </div>
              )}
              {l.method === "gmv_percent" && (
                <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 flex flex-wrap items-center gap-6">
                  <p className="text-sm font-medium text-gray-700">Example for a {money(10000)} order</p>
                  <Split label="Qwipo Charge" amount={money((10000 * l.qwipoTargetPct) / 100)} sub={pct(l.qwipoTargetPct)} />
                  <Split label="Seller Contribution" amount={money((10000 * l.sellerContributionPct) / 100)} sub={pct(l.sellerContributionPct)} />
                  <Split label="Retailer Pays" amount={money((10000 * retailer) / 100)} sub={pct(retailer)} />
                </div>
              )}
            </>
          )}

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
  onClick: () => void;
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

// Per-category logistics fee editor — add one category at a time; each row
// carries its own Qwipo target and seller contribution (retailer = target −
// seller). A category can only be added once.
function CategoryFeeEditor({
  draft,
  setDraft,
}: {
  draft: LogisticsFeeConfig;
  setDraft: React.Dispatch<React.SetStateAction<LogisticsFeeConfig>>;
}) {
  const rows = draft.categories;
  const usedCategories = new Set(rows.map((r) => r.category).filter(Boolean));
  const availableCategories = ONDC_CATEGORY_NAMES.filter(
    (name) => !usedCategories.has(name),
  );

  const update = (id: string, patch: Partial<(typeof rows)[number]>) =>
    setDraft((d) => ({
      ...d,
      categories: d.categories.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  const add = () =>
    setDraft((d) => ({
      ...d,
      categories: [
        ...d.categories,
        { id: makeId("catfee"), category: "", qwipoTarget: 0, sellerContribution: 0 },
      ],
    }));
  const remove = (id: string) =>
    setDraft((d) => ({
      ...d,
      categories: d.categories.filter((r) => r.id !== id),
    }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600">
          Add a logistics fee for each product category individually.
          {rows.length > 0 &&
            ` ${rows.length} of ${ONDC_CATEGORY_NAMES.length} categories configured.`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={availableCategories.length === 0}
          onClick={add}
        >
          <Plus className="h-3.5 w-3.5" />
          Add category fee
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg text-sm text-gray-500">
          No category fees yet. Click “Add category fee” to configure one.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_36px] gap-2 px-1">
            <Label className="text-xs text-gray-700">Category</Label>
            <Label className="text-xs text-gray-700">Qwipo Target (₹)</Label>
            <Label className="text-xs text-gray-700">Seller (₹)</Label>
            <Label className="text-xs text-gray-700">Retailer (₹)</Label>
            <span />
          </div>
          {rows.map((r) => {
            const options = ONDC_CATEGORY_NAMES.filter(
              (name) => !usedCategories.has(name) || name === r.category,
            );
            return (
              <div
                key={r.id}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr_36px] gap-2 items-center"
              >
                <Select
                  value={r.category || undefined}
                  onValueChange={(v) => update(r.id, { category: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="1"
                  value={r.qwipoTarget === 0 ? "" : r.qwipoTarget}
                  placeholder="0"
                  onChange={(e) => update(r.id, { qwipoTarget: num(e.target.value) })}
                />
                <Input
                  type="number"
                  step="1"
                  value={r.sellerContribution === 0 ? "" : r.sellerContribution}
                  placeholder="0"
                  onChange={(e) =>
                    update(r.id, { sellerContribution: num(e.target.value) })
                  }
                />
                <div className="h-9 rounded-md bg-blue-50/60 border border-blue-100 flex items-center justify-center text-sm font-medium text-blue-900">
                  {money(categoryLogisticsRetailer(r))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => remove(r.id)}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
