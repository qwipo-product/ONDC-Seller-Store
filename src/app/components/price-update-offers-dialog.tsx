import { AlertTriangle, Layers, TrendingDown, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import {
  type QpsScheme,
  type QpsSlab,
  computeEffectivePrice,
} from "../lib/qps-validation";

/**
 * Confirmation dialog shown when the seller updates the base
 * selling price of a SKU that has active offers/schemes mapped to
 * it. Mirrors the spec from the product team:
 *
 *   1. Warn that active schemes are mapped
 *   2. Show a side-by-side current vs updated price comparison
 *   3. For each slab, show the existing discount and BOTH the
 *      current and updated effective per-unit price so the seller
 *      can see exactly how their change cascades
 *   4. Capture explicit confirmation before saving
 *
 * The dialog is read-only — the seller doesn't edit slab values
 * here; they go to Offers & Schemes for that. This view is purely
 * "are you sure you want this?".
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name for the SKU at the top of the dialog. */
  skuName: string;
  skuCode: string;
  /** Active + Scheduled schemes mapped to this SKU. */
  schemes: QpsScheme[];
  /** Selling price BEFORE the edit. */
  currentPrice: number;
  /** Selling price the seller has just typed. */
  updatedPrice: number;
  /** Confirm callback — runs the original save closure. */
  onConfirm: () => void;
}

const fmt = (v: number) =>
  `₹${v.toLocaleString("en-IN", { minimumFractionDigits: v % 1 ? 2 : 0 })}`;

const slabRangeLabel = (s: QpsSlab) =>
  s.maxQty === null || s.maxQty === undefined
    ? `${s.minQty}+ Qty`
    : `${s.minQty}–${s.maxQty} Qty`;

const slabDiscountLabel = (s: QpsSlab) => {
  if (s.discountType === "amount") {
    return `${fmt(s.slabAmount ?? 0)} off`;
  }
  if (s.discountType === "flat") {
    return `Flat ${fmt(s.slabPrice ?? 0)}`;
  }
  return `${s.slabPercent ?? 0}%`;
};

export function PriceUpdateOffersDialog({
  open,
  onOpenChange,
  skuName,
  skuCode,
  schemes,
  currentPrice,
  updatedPrice,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Active or Inactive offers mapped to this SKU
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-gray-900">{skuName}</span>{" "}
            <span className="text-gray-500">· {skuCode}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Top warning callout — verbatim from the product spec so
            sellers see the consistent copy. */}
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                This SKU is currently mapped with active offers/schemes.
              </p>
              <p className="text-xs mt-1 leading-relaxed">
                The updated base price will be considered for all mapped
                quantity slabs and discounts. Please review the updated
                effective prices before proceeding.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2">
            <TrendingDown className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Please review and update the associated pricing slabs/offers
              in <b>Offers &amp; Schemes</b> if required to ensure the
              expected discount behaviour.
            </p>
          </div>
        </div>

        {/* Top-line price comparison strip — compact, easy to scan. */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-stretch gap-3 mt-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Current Base Price
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {fmt(currentPrice)}
            </p>
          </div>
          <div className="hidden sm:flex items-center justify-center text-gray-400">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-3">
            <p className="text-[11px] uppercase tracking-wider text-blue-700 font-semibold mb-1">
              Updated Base Price
            </p>
            <p className="text-2xl font-semibold text-blue-700">
              {fmt(updatedPrice)}
            </p>
          </div>
        </div>

        {/* Per-scheme slab breakdown — for each scheme mapped to the
            SKU, show its slabs with current + updated effective
            price side-by-side. */}
        <div className="space-y-4 mt-2">
          {schemes.map((scheme) => (
            <div
              key={scheme.id}
              className="rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-600" />
                  <p className="text-sm font-semibold text-gray-900">
                    {scheme.name}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    scheme.status === "Active"
                      ? "bg-green-50 text-green-700 border-green-200 text-[11px]"
                      : "bg-yellow-50 text-yellow-800 border-yellow-200 text-[11px]"
                  }
                >
                  {scheme.status}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                        Quantity Slab
                      </th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                        Existing Discount
                      </th>
                      <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                        Current Effective Price
                      </th>
                      <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                        Updated Effective Price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scheme.slabs.map((slab, i) => {
                      const currentEff = computeEffectivePrice(
                        slab,
                        currentPrice,
                      );
                      const updatedEff = computeEffectivePrice(
                        slab,
                        updatedPrice,
                      );
                      const delta = updatedEff - currentEff;
                      return (
                        <tr key={i} className="bg-white">
                          <td className="px-3 py-2 text-gray-900">
                            {slabRangeLabel(slab)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {slabDiscountLabel(slab)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">
                            {fmt(currentEff)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="font-mono font-semibold text-blue-700">
                              {fmt(updatedEff)}
                            </span>
                            {Math.abs(delta) > 0.005 && (
                              <span
                                className={
                                  "ml-2 text-[10px] " +
                                  (delta < 0
                                    ? "text-emerald-600"
                                    : "text-red-600")
                                }
                              >
                                {delta < 0 ? "↓" : "↑"} {fmt(Math.abs(delta))}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Confirm &amp; Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
