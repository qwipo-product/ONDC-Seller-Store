import { useMemo, useState, useEffect } from "react";
import { Package, Info, X } from "lucide-react";
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
  type ComboScheme,
  comboDiscountLabel,
  comboSaving,
  validateCombo,
} from "../lib/combo-data";

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

/** Add-one-at-a-time SKU picker with removable chips for the running list —
 *  the first multi-SKU picker in Offers & Schemes (every other scheme is
 *  one SKU at a time). */
function SkuMultiPicker({
  skus,
  selected,
  onChange,
  placeholder,
  chipClassName,
}: {
  skus: CatalogSku[];
  selected: string[];
  onChange: (codes: string[]) => void;
  placeholder: string;
  chipClassName: string;
}) {
  const available = skus.filter((s) => !selected.includes(s.skuCode));
  return (
    <div className="space-y-1.5">
      <SkuComboBox
        skus={available}
        value=""
        onChange={(code) => code && onChange([...selected, code])}
        placeholder={placeholder}
        emptyMessage="No matching active SKU."
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((code) => {
            const s = findSku(code);
            return (
              <Badge key={code} variant="outline" className={`gap-1 pr-1 ${chipClassName}`}>
                {s?.skuName ?? code}
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((c) => c !== code))}
                  className="hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface EditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new scheme. */
  scheme: ComboScheme | null;
  skuOptions: CatalogSku[];
  /** Every other active combo, for the bundle-overlap caution (Dialogue #4). */
  otherCombos: ComboScheme[];
  /** SKU codes carrying another active discount/free-goods scheme — same
   *  heads-up pattern as BOGO/Case Bonus, checked across every bundle item. */
  activeQpsSkuCodes?: string[];
  activeValueSlabSkuCodes?: string[];
  activeBogoSkuCodes?: string[];
  activeCaseBonusSkuCodes?: string[];
  onSave: (scheme: ComboScheme) => void;
}

export function ComboEditorDialog({
  open,
  onOpenChange,
  scheme,
  skuOptions,
  otherCombos,
  activeQpsSkuCodes = [],
  activeValueSlabSkuCodes = [],
  activeBogoSkuCodes = [],
  activeCaseBonusSkuCodes = [],
  onSave,
}: EditorProps) {
  const [bundleCodes, setBundleCodes] = useState<string[]>([]);
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [discountPercent, setDiscountPercent] = useState<number | undefined>();
  const [maxDiscount, setMaxDiscount] = useState<number | undefined>();

  useEffect(() => {
    if (!open) return;
    if (scheme) {
      setBundleCodes(scheme.bundleSkuCodes);
      setEndDate(scheme.endDate);
      setActive(scheme.status === "Active" || scheme.status === "Scheduled");
      setDiscountPercent(scheme.discountPercent);
      setMaxDiscount(scheme.maxDiscount);
    } else {
      setBundleCodes([]);
      setEndDate(new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10));
      setActive(true);
      setDiscountPercent(10);
      setMaxDiscount(undefined);
    }
  }, [open, scheme]);

  const bundleSkus = bundleCodes.map(findSku).filter((s): s is CatalogSku => !!s);
  const bundleValue = bundleSkus.reduce((sum, s) => sum + s.sellingPrice, 0);
  const errors = useMemo(
    () => validateCombo(bundleCodes, discountPercent, maxDiscount),
    [bundleCodes, discountPercent, maxDiscount],
  );
  const pastEnd = !!endDate && endDate < todayIso();
  const canSave = !!endDate && errors.length === 0;

  // Heads-up only — same non-blocking pattern as BOGO/Case Bonus, checked
  // across every bundle item instead of one SKU.
  const otherDiscounts = useMemo(() => {
    const names = new Set<string>();
    bundleCodes.forEach((code) => {
      if (activeQpsSkuCodes.includes(code)) names.add("QPS");
      if (activeValueSlabSkuCodes.includes(code)) names.add("Value Slab");
      if (activeBogoSkuCodes.includes(code)) names.add("BOGO");
      if (activeCaseBonusSkuCodes.includes(code)) names.add("Case Bonus");
    });
    return [...names];
  }, [bundleCodes, activeQpsSkuCodes, activeValueSlabSkuCodes, activeBogoSkuCodes, activeCaseBonusSkuCodes]);

  // Non-blocking: another active combo shares a bundle item with this one
  // (Dialogue #4 — the protocol gives no tie-break rule for two matching
  // combos, so surface the collision rather than silently picking one).
  const overlappingCombos = useMemo(
    () =>
      otherCombos.filter(
        (c) => c.id !== scheme?.id && c.status !== "Expired" && c.bundleSkuCodes.some((code) => bundleCodes.includes(code)),
      ),
    [otherCombos, scheme, bundleCodes],
  );

  const saving = comboSaving(bundleValue, discountPercent ?? 0, maxDiscount);

  const handleSave = () => {
    if (!canSave) return;
    const today = todayIso();
    const status: ComboScheme["status"] = endDate < today ? "Expired" : active ? "Active" : "Inactive";
    onSave({
      id: scheme?.id ?? `COMBO-${Date.now()}`,
      name: scheme?.name ?? `Combo – ${bundleSkus.map((s) => s.skuName).join(" + ")}`,
      bundleSkuCodes: bundleCodes,
      bundleSkuNames: bundleSkus.map((s) => s.skuName),
      discountPercent: discountPercent!,
      maxDiscount: maxDiscount && maxDiscount > 0 ? maxDiscount : undefined,
      startDate: today,
      endDate,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(95vw,900px)] w-[min(95vw,900px)] max-h-[92vh] overflow-y-auto p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-indigo-600" />
            {scheme ? "Edit" : "Create"} Combo
          </DialogTitle>
          <DialogDescription>
            Pick the items to sell together. The buyer gets the discount when all of them are in the
            cart.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-gray-700 mb-1 block">
              Bundle Items <span className="text-red-500">*</span> (2 or more — all must be bought together)
            </Label>
            <SkuMultiPicker
              skus={skuOptions}
              selected={bundleCodes}
              onChange={setBundleCodes}
              placeholder="Add a bundle item…"
              chipClassName="bg-indigo-50 text-indigo-700 border-indigo-200"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">
                Discount % <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={99.99}
                  step={0.01}
                  className="pr-6"
                  value={discountPercent ?? ""}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value))}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">Max Discount</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">₹</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="No cap"
                  className="pl-5"
                  value={maxDiscount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMaxDiscount(v === "" ? undefined : parseFloat(v));
                  }}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input type="date" value={endDate} min={todayIso()} onChange={(e) => setEndDate(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Starts today</p>
            </div>
          </div>

          {bundleSkus.length > 0 && !errors.some((e) => e.field === "discountPercent") && (
            <p className="text-xs text-gray-600">
              Bundle value {inr(bundleValue)} · {comboDiscountLabel(discountPercent ?? 0, maxDiscount)} ≈{" "}
              <span className="font-medium text-purple-700">{inr(saving)} off</span>
            </p>
          )}

          <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
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
          {pastEnd && (
            <p className="text-xs text-red-600">End date is in the past — this scheme will save as Expired.</p>
          )}

          {otherDiscounts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <p>
                A bundle item also has an active <span className="font-semibold">{otherDiscounts.join(" & ")}</span>{" "}
                scheme — both will apply together.
              </p>
            </div>
          )}

          {overlappingCombos.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Bundle overlaps with another active combo</p>
              <p>
                "{overlappingCombos.map((c) => c.name).join('", "')}" shares a bundle item with this combo. The
                protocol doesn't define which combo applies when two match the same cart — double check this
                is intended.
              </p>
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
            {scheme ? "Save Changes" : "Create Combo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ViewProps {
  scheme: ComboScheme | null;
  onClose: () => void;
  onEdit: (scheme: ComboScheme) => void;
}

export function ComboViewDialog({ scheme, onClose, onEdit }: ViewProps) {
  return (
    <Dialog open={scheme !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-[min(95vw,640px)] w-[min(95vw,640px)] max-h-[92vh] overflow-y-auto p-5">
        {scheme && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                {scheme.name}
              </DialogTitle>
              <DialogDescription>{scheme.id}</DialogDescription>
            </DialogHeader>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-700">Bundle Items</p>
              <div className="flex flex-wrap gap-1.5">
                {scheme.bundleSkuNames.map((name, i) => (
                  <Badge key={i} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-blue-50/60 border border-blue-200 rounded-lg p-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-gray-500">Discount</p>
                <Badge className="bg-purple-50 text-purple-700 border-purple-200">
                  {comboDiscountLabel(scheme.discountPercent, scheme.maxDiscount)}
                </Badge>
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
