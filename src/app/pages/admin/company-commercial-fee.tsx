import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Button } from "../../components/ui/button";
import { Calculator, Coins, Plus, X } from "lucide-react";
import {
  makeId,
  commercialRetailerPct,
  MAX_COMMERCE_TARGET_PCT,
  type CommercialFeeConfig,
} from "../../lib/admin-catalog";

const money = (n: number) => `₹${(+n.toFixed(2)).toLocaleString("en-IN")}`;
const pct = (n: number) => `${+n.toFixed(2)}%`;
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Commercial Fees tab used inside the company add/edit dialog. The commercial
 * fee is a company-level setting that applies to every seller/distributor
 * linked to the company. Same UI/behaviour as the old seller-level Commercial
 * Fee wizard step, just scoped to a company.
 */
export function CommercialFeeTab({
  value,
  onChange,
}: {
  value: CommercialFeeConfig;
  onChange: (next: CommercialFeeConfig) => void;
}) {
  const c = value;
  const disabled = !c.enabled;
  const retailer = commercialRetailerPct(c);
  const example = 10000;

  const patch = (p: Partial<CommercialFeeConfig>) => onChange({ ...c, ...p });

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      {/* Enable header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-2">
          <Coins className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Commercial Fee
            </h2>
            <p className="text-xs text-gray-500">
              Set at the company level — applies to all sellers and distributors
              linked to this company.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              Enable Commercial Fee
            </p>
            <p className="text-[11px] text-gray-500 max-w-[220px]">
              {c.enabled
                ? "Commercial fee is active for this company."
                : "Disabled for this company."}
            </p>
          </div>
          <Switch checked={c.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
        </div>
      </div>

      <Label className="text-xs text-gray-700">Charging Method</Label>
      <div className="flex gap-3 mt-1.5 mb-5">
        <MethodCard
          active={c.method === "gmv_percent"}
          disabled={disabled}
          title="Percentage of GMV"
          desc="Apply a fixed percentage on total order value"
          onClick={() => patch({ method: "gmv_percent" })}
        />
        <MethodCard
          active={c.method === "order_slab"}
          disabled={disabled}
          title="Order Value Slab"
          desc="Apply different charges based on order value slabs"
          onClick={() => patch({ method: "order_slab" })}
        />
      </div>

      {c.method === "gmv_percent" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeeInput
              label="Qwipo Target Fee (%)"
              value={c.qwipoTargetPct}
              onChange={(v) => patch({ qwipoTargetPct: v })}
              suffix="%"
              disabled={disabled}
              hint={`Target commerce fee for Qwipo (max ${MAX_COMMERCE_TARGET_PCT}%)`}
            />
            <FeeInput
              label="Seller Contribution (%)"
              value={c.sellerContributionPct}
              onChange={(v) => patch({ sellerContributionPct: v })}
              suffix="%"
              disabled={disabled}
              hint="Seller's contribution towards the commercial fee"
            />
            <CalcField
              label="Retailer Contribution (Calculated)"
              value={pct(retailer)}
              hint="Target Fee − Seller Contribution"
            />
          </div>
          {!disabled && (
            <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-700">
                    Example for a {money(example)} order
                  </p>
                  <p className="text-[11px] text-gray-500">
                    How the commercial fee will be split:
                  </p>
                </div>
              </div>
              <Split label="Qwipo Fee" amount={money((example * c.qwipoTargetPct) / 100)} sub={pct(c.qwipoTargetPct)} />
              <Split label="Seller Contribution" amount={money((example * c.sellerContributionPct) / 100)} sub={pct(c.sellerContributionPct)} />
              <Split label="Retailer Contribution" amount={money((example * retailer) / 100)} sub={pct(retailer)} />
            </div>
          )}
        </>
      ) : (
        <SlabEditor value={c} onChange={onChange} disabled={disabled} />
      )}
    </div>
  );
}

// ---- Local building blocks ----

function MethodCard({
  active,
  disabled,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border p-4 transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed border-gray-200"
          : active
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
  disabled,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  disabled?: boolean;
  hint?: string;
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
          disabled={disabled}
          onChange={(e) => onChange(num(e.target.value))}
          className="pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {suffix}
        </span>
      </div>
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
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

function SlabEditor({
  value,
  onChange,
  disabled,
}: {
  value: CommercialFeeConfig;
  onChange: (next: CommercialFeeConfig) => void;
  disabled: boolean;
}) {
  const slabs = value.slabs;
  const update = (id: string, patch: Partial<(typeof slabs)[number]>) =>
    onChange({
      ...value,
      slabs: value.slabs.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  const add = () =>
    onChange({
      ...value,
      slabs: [
        ...value.slabs,
        { id: makeId("slab"), minValue: 0, maxValue: 0, fee: 0 },
      ],
    });
  const remove = (id: string) =>
    onChange({ ...value, slabs: value.slabs.filter((s) => s.id !== id) });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_36px] gap-2 px-1">
        <Label className="text-xs text-gray-700">Order value from (₹)</Label>
        <Label className="text-xs text-gray-700">Order value to (₹)</Label>
        <Label className="text-xs text-gray-700">Flat fee (₹)</Label>
        <span />
      </div>
      {slabs.map((s) => (
        <div key={s.id} className="grid grid-cols-[1fr_1fr_1fr_36px] gap-2 items-center">
          <Input
            type="number"
            step="1"
            value={s.minValue === 0 ? "" : s.minValue}
            placeholder="0"
            disabled={disabled}
            onChange={(e) => update(s.id, { minValue: num(e.target.value) })}
          />
          <Input
            type="number"
            step="1"
            value={s.maxValue === 0 ? "" : s.maxValue}
            placeholder="0"
            disabled={disabled}
            onChange={(e) => update(s.id, { maxValue: num(e.target.value) })}
          />
          <Input
            type="number"
            step="1"
            value={s.fee === 0 ? "" : s.fee}
            placeholder="0"
            disabled={disabled}
            onChange={(e) => update(s.id, { fee: num(e.target.value) })}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={disabled || slabs.length <= 1}
            onClick={() => remove(s.id)}
          >
            <X className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled} onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        Add slab
      </Button>
    </div>
  );
}
