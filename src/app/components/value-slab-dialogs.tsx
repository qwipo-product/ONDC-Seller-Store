import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Plus, Trash2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { SkuComboBox } from "./sku-combobox";
import { type CatalogSku, findSku } from "../lib/sku-catalog";
import {
  type ValueSlabScheme,
  type ValueSlabTier,
  tierDiscountLabel,
  tierRangeLabel,
  tierSaving,
  validateValueTiers,
} from "../lib/value-slab-data";

const todayIso = () => new Date().toISOString().slice(0, 10);
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const statusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-800 border-green-200";
    case "Inactive":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "Expired":
      return "bg-gray-200 text-gray-700 border-gray-300";
    default:
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }
};

const newTier = (prev?: Partial<ValueSlabTier>): Partial<ValueSlabTier> => ({
  minValue: prev?.maxValue != null ? prev.maxValue + 1 : 2000,
  maxValue: null,
  discountPercent: 0,
  maxDiscount: undefined,
});

interface EditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new scheme. */
  scheme: ValueSlabScheme | null;
  /** SKUs the seller may pick (inactive and already-mapped SKUs are removed upstream). */
  skuOptions: CatalogSku[];
  onSave: (scheme: ValueSlabScheme) => void;
}

export function ValueSlabEditorDialog({ open, onOpenChange, scheme, skuOptions, onSave }: EditorProps) {
  const [skuCode, setSkuCode] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [tiers, setTiers] = useState<Partial<ValueSlabTier>[]>([]);

  // Load the scheme (or blank defaults) each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (scheme) {
      setSkuCode(scheme.skuCode);
      setEndDate(scheme.endDate);
      setActive(scheme.status === "Active" || scheme.status === "Scheduled");
      setTiers(scheme.tiers.map((t) => ({ ...t })));
    } else {
      setSkuCode("");
      setEndDate(new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10));
      setActive(true);
      setTiers([newTier()]);
    }
  }, [open, scheme]);

  const sku = findSku(skuCode);
  const errors = useMemo(() => validateValueTiers(tiers), [tiers]);
  const pastEnd = !!endDate && endDate < todayIso();

  const updateTier = (i: number, patch: Partial<ValueSlabTier>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const lastIsOpen = tiers.length > 0 && tiers[tiers.length - 1].maxValue == null;
  const canSave = !!sku && !!endDate && errors.length === 0;

  const handleSave = () => {
    if (!sku || !canSave) return;
    const today = todayIso();
    const status: ValueSlabScheme["status"] = endDate < today ? "Expired" : active ? "Active" : "Inactive";
    const finalTiers: ValueSlabTier[] = tiers.map((t) => ({
      minValue: t.minValue!,
      maxValue: t.maxValue ?? null,
      discountPercent: t.discountPercent!,
      maxDiscount: t.maxDiscount && t.maxDiscount > 0 ? t.maxDiscount : undefined,
    }));
    onSave({
      id: scheme?.id ?? `VS-${sku.skuCode}-${Date.now()}`,
      name: `Value Slab – ${sku.skuName}`,
      skuCode: sku.skuCode,
      skuName: sku.skuName,
      mrp: sku.mrp,
      sellingPrice: sku.sellingPrice,
      tiers: finalTiers,
      startDate: today,
      endDate,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(95vw,1000px)] w-[min(95vw,1000px)] max-h-[92vh] overflow-y-auto p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <IndianRupee className="h-5 w-5 text-emerald-600" />
            {scheme ? "Edit" : "Create"} Value Slab
          </DialogTitle>
          <DialogDescription>
            Select a SKU and set discount tiers by order value. The more money the buyer spends on
            this SKU, the bigger the discount. You can also set a maximum discount in ₹ for each tier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs font-medium text-gray-700 mb-1 block">
                SKU <span className="text-red-500">*</span>
              </Label>
              <SkuComboBox
                skus={skuOptions}
                value={skuCode}
                onChange={setSkuCode}
                placeholder="Search SKU by code, name, brand…"
                emptyMessage="No matching active SKU. Inactive SKUs and ones already mapped to a scheme are hidden."
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">Start Date</Label>
              <Input type="date" value={todayIso()} disabled readOnly />
              <p className="text-[11px] text-gray-500 mt-1">Schemes always start today.</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={endDate}
                min={todayIso()}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <div>
              <Label className="text-sm font-semibold text-gray-800">Scheme Status</Label>
              <p className="text-xs text-gray-600 mt-0.5">
                {active
                  ? "Active: the discount applies to matching orders within the validity window."
                  : "Inactive: the discount is paused."}
                {pastEnd && (
                  <span className="text-red-700 font-medium">
                    {" "}End date is in the past, so the scheme will save as Expired.
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold ${!active ? "text-orange-700" : "text-gray-400"}`}>
                Inactive
              </span>
              <Switch checked={active} onCheckedChange={setActive} disabled={pastEnd} />
              <span className={`text-xs font-semibold ${active ? "text-green-700" : "text-gray-400"}`}>
                Active
              </span>
            </div>
          </div>

          {sku && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Selected SKU</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{sku.skuName}</p>
                <p className="text-xs text-gray-600">
                  {sku.skuCode} · {sku.brand} · {sku.category}
                </p>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-right">
                  <p className="text-[10px] uppercase text-gray-500">MRP</p>
                  <p className="text-lg font-bold text-gray-700">{inr(sku.mrp)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-gray-500">Selling Price</p>
                  <p className="text-lg font-bold text-green-700">{inr(sku.sellingPrice)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Order Value Tiers ({tiers.length})</p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
                disabled={lastIsOpen}
                title={lastIsOpen ? "The last tier has no upper limit. Set a Max order value to add another tier." : "Add tier"}
                onClick={() => setTiers((prev) => [...prev, newTier(prev[prev.length - 1])])}
              >
                <Plus className="h-3.5 w-3.5" /> Add Tier
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-16">Tier</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-36">Min Order Value</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-36">Max Order Value</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-28">Discount %</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-36">Max Discount</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Example</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tiers.map((t, i) => {
                    const hasError = errors.some((e) => e.rowIndex === i);
                    const example = typeof t.minValue === "number" && !Number.isNaN(t.minValue) ? t.minValue : 0;
                    const saving = tierSaving(t, example);
                    return (
                      <tr key={i} className={hasError ? "bg-red-50/60" : ""}>
                        <td className="px-3 py-3 text-xs font-medium text-gray-700">Tier {i + 1}</td>
                        <td className="px-3 py-3">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">₹</span>
                            <Input
                              type="number"
                              min={1}
                              className="h-8 pl-5"
                              value={t.minValue ?? ""}
                              onChange={(e) => updateTier(i, { minValue: parseFloat(e.target.value) })}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">₹</span>
                            <Input
                              type="number"
                              min={1}
                              placeholder="No limit"
                              className="h-8 pl-5"
                              value={t.maxValue ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateTier(i, { maxValue: v === "" ? null : parseFloat(v) });
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              max={99.99}
                              step={0.01}
                              className="h-8 pr-6"
                              value={t.discountPercent ?? ""}
                              onChange={(e) => updateTier(i, { discountPercent: parseFloat(e.target.value) })}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">₹</span>
                            <Input
                              type="number"
                              min={1}
                              placeholder="No cap"
                              className="h-8 pl-5"
                              value={t.maxDiscount ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateTier(i, { maxDiscount: v === "" ? undefined : parseFloat(v) });
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {saving > 0 ? (
                            <>
                              <p className="text-sm font-medium text-purple-700">{inr(saving)} off</p>
                              <p className="text-[10px] text-gray-500">on {inr(example)}</p>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">-</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={tiers.length === 1}
                            title={tiers.length === 1 ? "At least one tier is required" : "Remove tier"}
                            onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-3 py-2 text-[11px] text-gray-600 border-t border-gray-100 bg-gray-50/50">
              Order value means what the buyer spends on this SKU (quantity × price). Below the first
              tier there is no discount. If a Max Discount is set, the discount never goes above it.
            </p>
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
              <p className="font-semibold">
                {errors.length} validation error{errors.length === 1 ? "" : "s"}
              </p>
              {errors.map((e, i) => (
                <p key={i}>{e.message}</p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!canSave} onClick={handleSave}>
            {scheme ? "Save Changes" : "Create Value Slab"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ViewProps {
  scheme: ValueSlabScheme | null;
  onClose: () => void;
  onEdit: (scheme: ValueSlabScheme) => void;
}

export function ValueSlabViewDialog({ scheme, onClose, onEdit }: ViewProps) {
  return (
    <Dialog open={scheme !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-[min(95vw,700px)] w-[min(95vw,700px)] max-h-[92vh] overflow-y-auto p-5">
        {scheme && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-emerald-600" />
                {scheme.name}
              </DialogTitle>
              <DialogDescription>
                {scheme.skuCode} · {scheme.skuName}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-4 gap-3 bg-blue-50/60 border border-blue-200 rounded-lg p-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-gray-500">MRP</p>
                <p className="font-bold text-gray-900">{inr(scheme.mrp)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500">Selling Price</p>
                <p className="font-bold text-green-700">{inr(scheme.sellingPrice)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500">Validity</p>
                <p className="font-medium text-gray-900 text-xs">
                  {scheme.startDate} → {scheme.endDate}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500">Status</p>
                <Badge className={`${statusColor(scheme.status)} border text-xs`}>{scheme.status}</Badge>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
                Order Value Tiers ({scheme.tiers.length})
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Tier</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Order Value</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Discount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scheme.tiers.map((t, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Tier {i + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{tierRangeLabel(t)}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200">
                          {tierDiscountLabel(t)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={scheme.status === "Expired"}
                onClick={() => onEdit(scheme)}
              >
                {scheme.status === "Expired" ? "Edit (Expired)" : "Edit Scheme"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
