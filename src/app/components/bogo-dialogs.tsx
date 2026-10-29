import { useEffect, useMemo, useState } from "react";
import { Gift, Info, Plus, Trash2 } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { SkuComboBox } from "./sku-combobox";
import { type CatalogSku, findSku } from "../lib/sku-catalog";
import {
  type BogoScheme,
  type BogoTier,
  tierFreeUnitsFor,
  tierFreeValue,
  tierLabel,
  tierPackSizeCaution,
  validateBogoTiers,
} from "../lib/bogo-data";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

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

const newTier = (prev?: Partial<BogoTier>): Partial<BogoTier> => ({
  buyQty: prev?.buyQty != null ? prev.buyQty * 2 : 10,
  freeQty: 1,
});

interface EditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new scheme. */
  scheme: BogoScheme | null;
  /** SKUs the seller may pick as the SKU being bought (inactive and
   *  already-mapped SKUs are removed upstream). */
  skuOptions: CatalogSku[];
  /** SKUs the seller may pick as the free item, for a cross-SKU scheme.
   *  Not exclusivity-filtered — a SKU can be the free item on any number
   *  of schemes, it isn't "mapped" the way a bought SKU is. */
  freeSkuOptions: CatalogSku[];
  /** SKU codes that carry another active discount/free-goods scheme —
   *  surfaced as a heads-up (not a block): nothing in the protocol stops
   *  these from stacking, but the seller should see it coming. */
  activeQpsSkuCodes?: string[];
  activeValueSlabSkuCodes?: string[];
  activeCaseBonusSkuCodes?: string[];
  onSave: (scheme: BogoScheme) => void;
}

export function BogoEditorDialog({
  open,
  onOpenChange,
  scheme,
  skuOptions,
  freeSkuOptions,
  activeQpsSkuCodes = [],
  activeValueSlabSkuCodes = [],
  activeCaseBonusSkuCodes = [],
  onSave,
}: EditorProps) {
  const [skuCode, setSkuCode] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [tiers, setTiers] = useState<Partial<BogoTier>[]>([]);
  // Whether free units repeat for every full set of the Buy quantity. The
  // distributor must say so; the protocol leaves it undefined.
  const [repeat, setRepeat] = useState(false);
  // Cross-SKU: the free item can be a different SKU from the one the buyer
  // pays for — protocol-legal (benefit.item_id is independent of the
  // qualifier's item), but off by default since same-SKU is the common case.
  const [crossSku, setCrossSku] = useState(false);
  const [freeSkuCode, setFreeSkuCode] = useState("");

  // Load the scheme (or blank defaults) each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (scheme) {
      setSkuCode(scheme.skuCode);
      setEndDate(scheme.endDate);
      setActive(scheme.status === "Active" || scheme.status === "Scheduled");
      setTiers(scheme.tiers.map((t) => ({ ...t })));
      setRepeat(!!scheme.repeatOnMultiples);
      const isCross = !!scheme.freeSkuCode && scheme.freeSkuCode !== scheme.skuCode;
      setCrossSku(isCross);
      setFreeSkuCode(isCross ? scheme.freeSkuCode! : "");
    } else {
      setSkuCode("");
      setEndDate(new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10));
      setActive(true);
      setTiers([newTier()]);
      setRepeat(false);
      setCrossSku(false);
      setFreeSkuCode("");
    }
  }, [open, scheme]);

  const sku = findSku(skuCode);
  const freeSku = crossSku ? findSku(freeSkuCode) : sku;
  const errors = useMemo(() => validateBogoTiers(tiers), [tiers]);
  const pastEnd = !!endDate && endDate < todayIso();

  // Heads-up only — BOGO is protocol-additive with QPS/Value Slab (different
  // benefit mechanism: free units vs. price reduction), so this never blocks
  // saving. It just makes the combined margin impact visible up front.
  const otherDiscounts = [
    activeQpsSkuCodes.includes(skuCode) ? "QPS" : null,
    activeValueSlabSkuCodes.includes(skuCode) ? "Value Slab" : null,
    activeCaseBonusSkuCodes.includes(skuCode) ? "Case Bonus" : null,
  ].filter((x): x is string => x !== null);

  // Non-blocking caution: since the protocol never defines what unit
  // item_count uses, check that Buy Quantity is a whole number of cases for
  // this SKU, so "Buy 10" on a case-of-12 SKU doesn't silently mean
  // something different to the seller than to the buyer app. Free quantity
  // is never second-guessed: Buy 1 get 2 is a legitimate scheme.
  const cautions = useMemo(
    () =>
      tiers
        .map((t, i) => {
          const messages = [tierPackSizeCaution(t.buyQty, sku?.caseSize ?? 1)].filter(
            (m): m is string => m !== null,
          );
          return { i, messages };
        })
        .filter((c) => c.messages.length > 0),
    [tiers, sku],
  );

  const updateTier = (i: number, patch: Partial<BogoTier>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const canSave = !!sku && !!endDate && errors.length === 0 && (!crossSku || !!freeSku);

  const handleSave = () => {
    if (!sku || !canSave) return;
    const today = todayIso();
    const status: BogoScheme["status"] = endDate < today ? "Expired" : active ? "Active" : "Inactive";
    const finalTiers: BogoTier[] = tiers.map((t) => ({
      buyQty: t.buyQty!,
      freeQty: t.freeQty!,
    }));
    const resolvedFreeSku = crossSku && freeSku ? freeSku : sku;
    onSave({
      id: scheme?.id ?? `BOGO-${sku.skuCode}-${Date.now()}`,
      name:
        crossSku && freeSku
          ? `BOGO – ${sku.skuName} → ${freeSku.skuName}`
          : `BOGO – ${sku.skuName}`,
      skuCode: sku.skuCode,
      skuName: sku.skuName,
      mrp: sku.mrp,
      sellingPrice: sku.sellingPrice,
      tiers: finalTiers,
      repeatOnMultiples: repeat,
      startDate: today,
      endDate,
      status,
      freeSkuCode: resolvedFreeSku.skuCode,
      freeSkuName: resolvedFreeSku.skuName,
      freeSkuSellingPrice: resolvedFreeSku.sellingPrice,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(95vw,900px)] w-[min(95vw,900px)] max-h-[92vh] overflow-y-auto p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Gift className="h-5 w-5 text-red-600" />
            {scheme ? "Edit" : "Create"} BOGO Scheme
          </DialogTitle>
          <DialogDescription>
            Pick a SKU and set buy-quantity tiers that give free units on qualifying orders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs font-medium text-gray-700 mb-1 block">
                SKU <span className="text-red-500">*</span>
              </Label>
              <SkuComboBox
                skus={skuOptions}
                value={skuCode}
                onChange={setSkuCode}
                placeholder="Search SKU by code, name, brand…"
                emptyMessage="No matching active SKU. Inactive SKUs and ones already mapped to a BOGO scheme are hidden."
              />
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
              <p className="text-xs text-gray-500 mt-1">Starts today</p>
            </div>
          </div>

          {sku && (
            <p className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">{sku.skuName}</span> · {sku.skuCode} · MRP{" "}
              {inr(sku.mrp)} · SP {inr(sku.sellingPrice)}
              {sku.caseSize > 1 && ` · case of ${sku.caseSize}`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
            <div className="flex items-center justify-between gap-2 pr-3 border-r border-gray-200">
              <Label className="text-xs font-medium text-gray-700">Status</Label>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${!active ? "text-orange-700" : "text-gray-400"}`}>
                  Inactive
                </span>
                <Switch checked={active} onCheckedChange={setActive} disabled={pastEnd} />
                <span className={`text-xs font-medium ${active ? "text-green-700" : "text-gray-400"}`}>
                  Active
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pl-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-help">
                      <Label className="text-xs font-medium text-gray-700">Free item is a different SKU</Label>
                      <Info className="h-3 w-3 text-gray-400" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Off: free units are the same SKU the buyer pays for. On: pick a different SKU below to
                    give away free.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Switch checked={crossSku} onCheckedChange={setCrossSku} />
            </div>
          </div>
          {pastEnd && (
            <p className="text-xs text-red-600">End date is in the past — this scheme will save as Expired.</p>
          )}

          {crossSku && (
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">
                Free SKU <span className="text-red-500">*</span>
              </Label>
              <SkuComboBox
                skus={freeSkuOptions}
                value={freeSkuCode}
                onChange={setFreeSkuCode}
                placeholder="Search the SKU to give away free…"
                emptyMessage="No matching active SKU."
              />
              {freeSku && (
                <p className="text-xs text-gray-500 mt-1">
                  {freeSku.skuName} · SP {inr(freeSku.sellingPrice)}
                  {freeSku.caseSize > 1 && ` · case of ${freeSku.caseSize}`}
                </p>
              )}
            </div>
          )}

          {sku && otherDiscounts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <p>
                Also has an active <span className="font-semibold">{otherDiscounts.join(" & ")}</span> scheme —
                both will apply together.
              </p>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-900">Buy-Get Tiers ({tiers.length})</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      Evaluated fresh per order — quantities don't carry over between orders. Only the
                      highest qualifying tier applies; tiers don't stack.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
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
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-36">Buy Quantity</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase w-36">Free Quantity</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Example</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tiers.map((t, i) => {
                    const hasError = errors.some((e) => e.rowIndex === i);
                    const hasCaution = !hasError && cautions.some((c) => c.i === i);
                    const freeValue = tierFreeValue(t, freeSku?.sellingPrice ?? 0);
                    return (
                      <tr
                        key={i}
                        className={hasError ? "bg-red-50/60" : hasCaution ? "bg-amber-50/60" : ""}
                      >
                        <td className="px-3 py-3 text-xs font-medium text-gray-700">Tier {i + 1}</td>
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            min={1}
                            className="h-8"
                            value={t.buyQty ?? ""}
                            onChange={(e) => updateTier(i, { buyQty: parseFloat(e.target.value) })}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            min={1}
                            className="h-8"
                            value={t.freeQty ?? ""}
                            onChange={(e) => updateTier(i, { freeQty: parseFloat(e.target.value) })}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="text-sm font-medium text-purple-700">
                            {tierLabel(t, crossSku ? freeSku?.skuName : undefined)}
                          </p>
                          {freeSku && freeValue > 0 && (
                            <p className="text-xs text-gray-500">≈ {inr(freeValue)} of free goods</p>
                          )}
                          {typeof t.buyQty === "number" && t.buyQty >= 1 && typeof t.freeQty === "number" && (
                            <p className="text-xs text-gray-500">
                              Order {t.buyQty * 2} → {tierFreeUnitsFor(t, t.buyQty * 2, repeat)} free
                            </p>
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
          </div>

          <div className="border border-gray-200 rounded-lg px-3 py-2.5 space-y-2">
            <p className="text-sm font-semibold text-gray-900">When the buyer orders more than the Buy quantity</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                {
                  value: false,
                  title: "Give the free units once",
                  example: "Buy 10, get 1 free: ordering 20 still gives 1 free.",
                },
                {
                  value: true,
                  title: "Repeat for every full set",
                  example: "Buy 10, get 1 free: ordering 20 gives 2 free, 30 gives 3.",
                },
              ].map((o) => (
                <label
                  key={String(o.value)}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer text-xs ${
                    repeat === o.value ? "border-blue-500 bg-blue-50/60" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="bogo-repeat"
                    className="mt-0.5"
                    checked={repeat === o.value}
                    onChange={() => setRepeat(o.value)}
                  />
                  <span>
                    <span className="block font-medium text-gray-900">{o.title}</span>
                    <span className="block text-gray-600">{o.example}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {cautions.length > 0 && errors.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">
                {cautions.length} tier{cautions.length === 1 ? "" : "s"} worth double-checking
              </p>
              {cautions.map((c) =>
                c.messages.map((message, mi) => (
                  <p key={`${c.i}-${mi}`}>
                    Tier {c.i + 1}: {message}
                  </p>
                )),
              )}
            </div>
          )}

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
            {scheme ? "Save Changes" : "Create BOGO Scheme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ViewProps {
  scheme: BogoScheme | null;
  onClose: () => void;
  onEdit: (scheme: BogoScheme) => void;
}

export function BogoViewDialog({ scheme, onClose, onEdit }: ViewProps) {
  const isCrossSku = !!scheme?.freeSkuCode && scheme.freeSkuCode !== scheme.skuCode;
  return (
    <Dialog open={scheme !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-[min(95vw,700px)] w-[min(95vw,700px)] max-h-[92vh] overflow-y-auto p-5">
        {scheme && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-red-600" />
                {scheme.name}
              </DialogTitle>
              <DialogDescription>
                {scheme.skuCode} · {scheme.skuName}
                {isCrossSku && ` · free item: ${scheme.freeSkuName} (${scheme.freeSkuCode})`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-4 gap-3 bg-blue-50/60 border border-blue-200 rounded-lg p-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-gray-500">MRP</p>
                <p className="font-bold text-gray-900">₹{scheme.mrp}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500">Selling Price</p>
                <p className="font-bold text-green-700">₹{scheme.sellingPrice}</p>
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
                Buy-Get Tiers ({scheme.tiers.length})
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Tier</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Offer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scheme.tiers.map((t, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Tier {i + 1}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200">
                          {tierLabel(t, isCrossSku ? scheme.freeSkuName : undefined)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">Larger orders:</span>{" "}
              {scheme.repeatOnMultiples
                ? "free units repeat for every full set of the Buy quantity."
                : "free units are given once when a tier is reached."}
            </p>

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
