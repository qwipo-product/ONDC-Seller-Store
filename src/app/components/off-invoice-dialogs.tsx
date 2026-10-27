import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  type OffInvoiceDiscountType,
  type OffInvoiceScheme,
  ruleDiscountLabel,
  ruleSaving,
  ruleSentence,
  validateOffInvoiceRule,
} from "../lib/off-invoice-data";

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

interface EditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new scheme. */
  scheme: OffInvoiceScheme | null;
  onSave: (scheme: OffInvoiceScheme) => void;
}

export function OffInvoiceEditorDialog({ open, onOpenChange, scheme, onSave }: EditorProps) {
  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [minValue, setMinValue] = useState<number | undefined>();
  const [discountType, setDiscountType] = useState<OffInvoiceDiscountType>("percent");
  const [discountPercent, setDiscountPercent] = useState<number | undefined>();
  const [maxDiscount, setMaxDiscount] = useState<number | undefined>();
  const [discountAmount, setDiscountAmount] = useState<number | undefined>();

  // Load the scheme (or blank defaults) each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (scheme) {
      setName(scheme.name);
      setEndDate(scheme.endDate);
      setActive(scheme.status === "Active" || scheme.status === "Scheduled");
      setMinValue(scheme.minValue);
      setDiscountType(scheme.discountType);
      setDiscountPercent(scheme.discountPercent);
      setMaxDiscount(scheme.maxDiscount);
      setDiscountAmount(scheme.discountAmount);
    } else {
      setName("Cart Value Discount");
      setEndDate(new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10));
      setActive(true);
      setMinValue(10000);
      setDiscountType("percent");
      setDiscountPercent(0);
      setMaxDiscount(undefined);
      setDiscountAmount(undefined);
    }
  }, [open, scheme]);

  const rule = { minValue, discountType, discountPercent, maxDiscount, discountAmount };
  const errors = useMemo(
    () => validateOffInvoiceRule({ minValue, discountType, discountPercent, maxDiscount, discountAmount }),
    [minValue, discountType, discountPercent, maxDiscount, discountAmount],
  );
  const pastEnd = !!endDate && endDate < todayIso();
  const canSave = name.trim().length > 0 && !!endDate && errors.length === 0;
  const isAmount = discountType === "amount";

  // Two live examples: a cart right at the minimum, and one 2x bigger.
  const examples =
    typeof minValue === "number" && !Number.isNaN(minValue) && minValue > 0
      ? [minValue, minValue * 2]
      : [];

  const handleSave = () => {
    if (!canSave || minValue === undefined) return;
    const today = todayIso();
    const status: OffInvoiceScheme["status"] = endDate < today ? "Expired" : active ? "Active" : "Inactive";
    onSave({
      id: scheme?.id ?? `OFI-${Date.now()}`,
      name: name.trim(),
      minValue,
      discountType,
      discountPercent: isAmount ? undefined : discountPercent,
      maxDiscount: !isAmount && maxDiscount && maxDiscount > 0 ? maxDiscount : undefined,
      discountAmount: isAmount ? discountAmount : undefined,
      startDate: today,
      endDate,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(95vw,720px)] w-[min(95vw,720px)] max-h-[92vh] overflow-y-auto p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5 text-purple-600" />
            {scheme ? "Edit" : "Create"} Off-Invoice Discount
          </DialogTitle>
          <DialogDescription>
            A discount on the buyer's whole cart with you, not on one SKU or category. If the cart
            value reaches the minimum, the buyer gets the discount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">
                Scheme Name <span className="text-red-500">*</span>
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <p className="text-[11px] text-gray-500 mt-1">
                Applies to: <span className="font-medium text-gray-700">Whole catalog (cart value)</span>
              </p>
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
                  ? "Active: the discount applies to matching carts within the validity window."
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

          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Discount Rule</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  Minimum Cart Value <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">₹</span>
                  <Input
                    type="number"
                    min={1}
                    className="pl-5"
                    value={minValue ?? ""}
                    onChange={(e) => setMinValue(parseFloat(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">Discount Type</Label>
                <Select
                  value={discountType}
                  onValueChange={(v) => {
                    const t = v as OffInvoiceDiscountType;
                    setDiscountType(t);
                    if (t === "amount") {
                      setDiscountAmount((a) => a ?? 0);
                    } else {
                      setDiscountPercent((p) => p ?? 0);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">% Discount</SelectItem>
                    <SelectItem value="amount">Flat ₹ off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  {isAmount ? "Amount off" : "Discount %"} <span className="text-red-500">*</span>
                </Label>
                {isAmount ? (
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">₹</span>
                    <Input
                      type="number"
                      min={0}
                      className="pl-5"
                      value={discountAmount ?? ""}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value))}
                    />
                  </div>
                ) : (
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
                )}
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">Max Discount</Label>
                {isAmount ? (
                  <p className="text-xs text-gray-400 pt-2" title="A flat amount comes off once, so it needs no cap.">
                    Not needed for flat ₹
                  </p>
                ) : (
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
                )}
              </div>
            </div>

            {errors.length === 0 && examples.length > 0 && (
              <div className="rounded-md bg-purple-50/60 border border-purple-100 px-3 py-2 text-xs text-gray-700 space-y-0.5">
                <p className="font-medium text-purple-800">{ruleSentence(rule)}</p>
                {examples.map((c) => (
                  <p key={c}>
                    Cart of {inr(c)}: buyer saves <span className="font-semibold">{inr(ruleSaving(rule, c))}</span>
                  </p>
                ))}
                <p className="text-gray-500">A cart below the minimum gets no discount.</p>
              </div>
            )}
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
            {scheme ? "Save Changes" : "Create Off-Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ViewProps {
  scheme: OffInvoiceScheme | null;
  onClose: () => void;
  onEdit: (scheme: OffInvoiceScheme) => void;
}

export function OffInvoiceViewDialog({ scheme, onClose, onEdit }: ViewProps) {
  return (
    <Dialog open={scheme !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-[min(95vw,560px)] w-[min(95vw,560px)] max-h-[92vh] overflow-y-auto p-5">
        {scheme && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-purple-600" />
                {scheme.name}
              </DialogTitle>
              <DialogDescription>
                {scheme.id} · Discount on the whole cart (whole catalog)
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 bg-blue-50/60 border border-blue-200 rounded-lg p-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-gray-500">Validity</p>
                <p className="font-medium text-gray-900">
                  {scheme.startDate} → {scheme.endDate}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500">Status</p>
                <Badge className={`${statusColor(scheme.status)} border text-xs`}>{scheme.status}</Badge>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 space-y-2">
              <p className="text-[10px] uppercase text-gray-500">Discount Rule</p>
              <p className="text-sm font-medium text-gray-900">{ruleSentence(scheme)}</p>
              <div className="flex gap-2 pt-1">
                <Badge variant="outline" className="text-xs">
                  Minimum cart: {inr(scheme.minValue)}
                </Badge>
                <Badge
                  className={
                    scheme.discountType === "amount"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  }
                >
                  {ruleDiscountLabel(scheme)}
                </Badge>
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
