import { useEffect, useState } from "react";
import { Switch } from "../../components/ui/switch";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Truck, Pencil } from "lucide-react";
import {
  getSellerLogistics,
  setSellerLogistics,
  subscribeToChargeConfigs,
  emptyLogistics,
  logisticsRetailerPerKg,
  logisticsRetailerPct,
  type LogisticsFeeConfig,
} from "../../lib/charges-data";
import type { Seller } from "../../lib/mock-store";
import { SellerLogisticsDialog } from "./seller-logistics-dialog";

const pct = (n: number) => `${+n.toFixed(2)}%`;
const rupee = (n: number) => `₹${+n.toFixed(2)}`;
const money = (n: number) => `₹${(+n.toFixed(0)).toLocaleString("en-IN")}`;

function methodLabel(l: LogisticsFeeConfig): string {
  if (l.method === "per_kg") return "₹ per KG";
  if (l.method === "by_category") return "By Category";
  return "Percentage of GMV";
}

function summaryText(l: LogisticsFeeConfig): string {
  if (l.method === "per_kg") {
    return `${rupee(l.qwipoTargetPerKg)}/kg Qwipo · ${rupee(logisticsRetailerPerKg(l))}/kg retailer`;
  }
  if (l.method === "by_category") {
    const n = l.categories.length;
    return `${n} categor${n === 1 ? "y" : "ies"} configured`;
  }
  return `${pct(l.qwipoTargetPct)} Qwipo · ${pct(logisticsRetailerPct(l))} retailer`;
}

// Relative "time ago" — e.g. "just now", "3 days ago", "2 weeks ago".
function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  const ago = (n: number, unit: string) => `${n} ${unit}${n > 1 ? "s" : ""} ago`;
  if (secs < 60) return "just now";
  if (mins < 60) return ago(mins, "min");
  if (hrs < 24) return ago(hrs, "hour");
  if (days < 7) return ago(days, "day");
  if (weeks < 5) return ago(weeks, "week");
  if (months < 12) return ago(months, "month");
  return ago(years, "year");
}

export function SellerChargesTab({ seller }: { seller: Seller }) {
  const [, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Re-render when the logistics config changes (toggle / dialog save).
  useEffect(() => subscribeToChargeConfigs(() => setVersion((n) => n + 1)), []);

  const config = getSellerLogistics(seller.id);
  const logistics = config?.logistics ?? emptyLogistics();
  const enabled = logistics.enabled;

  const toggleEnabled = (next: boolean) => {
    setSellerLogistics(seller.id, { ...logistics, enabled: next });
  };

  const handleSave = (next: LogisticsFeeConfig) => {
    setSellerLogistics(seller.id, next);
  };

  return (
    <div className="max-w-2xl">
      {/* Single seller-level Logistics Fee tile. */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-gray-900">
                  Logistics Fee
                </h3>
                <Badge
                  className={
                    enabled
                      ? "bg-green-50 text-green-700 border-green-200 text-[10px]"
                      : "bg-gray-100 text-gray-600 border-gray-200 text-[10px]"
                  }
                >
                  {enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Applied on 3PL logistics for next-day delivery (NDD). Configured
                at the seller level.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-sm font-medium ${
                enabled ? "text-green-700" : "text-gray-500"
              }`}
            >
              {enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} />
          </div>
        </div>

        {enabled ? (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-end justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Charging Method</span>
                <span className="font-medium text-gray-900">
                  {methodLabel(logistics)}
                </span>
              </div>
              <p className="text-xs text-gray-500">{summaryText(logistics)}</p>
              <p className="text-xs text-gray-500">
                {logistics.waiverEnabled
                  ? `Fee waived above ${money(logistics.waiverThreshold)}`
                  : "No fee waiver"}
              </p>
              {config?.updatedAt && (
                <p className="text-[11px] text-gray-400">
                  Updated {relativeTime(config.updatedAt)}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setDialogOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Enable to configure the logistics fee structure for this seller.
            </p>
          </div>
        )}
      </div>

      <SellerLogisticsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={logistics}
        sellerName={seller.name}
        onSave={handleSave}
      />
    </div>
  );
}
