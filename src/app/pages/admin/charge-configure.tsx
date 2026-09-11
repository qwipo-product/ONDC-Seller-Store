import {
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Save,
  Calculator,
  Info,
  Coins,
  Truck,
  ShoppingCart,
  CalendarDays,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import { getCompanies, makeId } from "../../lib/admin-catalog";
import { getSellerById } from "../../lib/mock-store";
import {
  getSellerDistributorConfig,
  getSellerWholesaleConfig,
  emptyChargeConfig,
  upsertChargeConfig,
  commerceRetailerPct,
  logisticsRetailerPerKg,
  logisticsRetailerPct,
  getBeatThresholds,
  MAX_COMMERCE_TARGET_PCT,
  type ChargeConfig,
  type ChargeScope,
} from "../../lib/charges-data";

const STEPS = [
  { title: "Commercial Fee", sub: "Configure" },
  { title: "Logistics Fee", sub: "Configure" },
  { title: "Beat Small Order", sub: "Configure" },
  { title: "Review", sub: "Review & Save" },
];

const money = (n: number) => `₹${(+n.toFixed(2)).toLocaleString("en-IN")}`;
const pct = (n: number) => `${+n.toFixed(2)}%`;
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};
const fmtDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export function AdminChargeConfigure() {
  const navigate = useNavigate();
  const params = useParams<{
    sellerId: string;
    scope: string;
    companyId: string;
  }>();
  const sellerId = params.sellerId;
  const scope: ChargeScope =
    params.scope === "wholesaler" ? "wholesaler" : "distributor";
  const companyId = params.companyId;

  const seller = useMemo(
    () => (sellerId ? getSellerById(sellerId) : undefined),
    [sellerId],
  );
  // Distributor: the single company being configured.
  const company = useMemo(
    () =>
      scope === "distributor" && companyId
        ? getCompanies().find((c) => c.id === companyId)
        : undefined,
    [scope, companyId],
  );
  // Wholesale: every wholesaler-mode company linked to this seller — they all
  // share the one config being edited.
  const wholesalerCompanies = useMemo(() => {
    if (scope !== "wholesaler" || !seller) return [];
    const ids = new Set(
      (seller.companyBrandSelections ?? [])
        .filter((s) => s.operationMode === "wholesaler")
        .map((s) => s.companyId),
    );
    return getCompanies().filter((c) => ids.has(c.id));
  }, [scope, seller]);

  const backTo = `/admin/users/${sellerId ?? ""}?tab=charges`;

  const targetName = scope === "wholesaler" ? "Wholesale" : company?.name ?? "";
  const targetLogo = scope === "distributor" ? company?.imageUrl : undefined;

  const [draft, setDraft] = useState<ChargeConfig>(() => {
    if (!sellerId) return emptyChargeConfig("__none__", "distributor", "__none__");
    if (scope === "wholesaler")
      return (
        getSellerWholesaleConfig(sellerId) ??
        emptyChargeConfig(sellerId, "wholesaler", "_all")
      );
    return (
      getSellerDistributorConfig(sellerId, companyId ?? "") ??
      emptyChargeConfig(sellerId, "distributor", companyId ?? "")
    );
  });
  const [step, setStep] = useState(0);

  // Guard: need a seller, and for distributor scope a resolvable company.
  if (!seller || (scope === "distributor" && !company)) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate(backTo)}
          className="text-sm text-blue-600 flex items-center gap-1.5 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Charges &amp; Fees
        </button>
        <p className="text-gray-600">
          {!seller
            ? "Seller not found."
            : "Company not found. Pick a company from the seller's Charges & Fees tab."}
        </p>
      </div>
    );
  }

  const setCommerce = (patch: Partial<ChargeConfig["commerce"]>) =>
    setDraft((d) => ({ ...d, commerce: { ...d.commerce, ...patch } }));
  const setLogistics = (patch: Partial<ChargeConfig["logistics"]>) =>
    setDraft((d) => ({ ...d, logistics: { ...d.logistics, ...patch } }));
  const setBeat = (patch: Partial<ChargeConfig["beat"]>) =>
    setDraft((d) => ({ ...d, beat: { ...d.beat, ...patch } }));

  // ---- Per-step validation ----
  const stepError = (): string | null => {
    if (step === 0 && draft.commerce.enabled) {
      if (draft.commerce.method === "gmv_percent") {
        if (draft.commerce.qwipoTargetPct > MAX_COMMERCE_TARGET_PCT)
          return `Qwipo target fee cannot exceed ${MAX_COMMERCE_TARGET_PCT}%.`;
        if (draft.commerce.sellerContributionPct > draft.commerce.qwipoTargetPct)
          return "Seller contribution cannot exceed the Qwipo target fee.";
      } else if (draft.commerce.slabs.length === 0) {
        return "Add at least one order-value slab.";
      }
    }
    if (step === 1 && draft.logistics.enabled) {
      if (draft.logistics.method === "per_kg") {
        if (draft.logistics.sellerContributionPerKg > draft.logistics.qwipoTargetPerKg)
          return "Seller contribution cannot exceed the Qwipo target fee.";
      } else if (
        draft.logistics.sellerContributionPct > draft.logistics.qwipoTargetPct
      ) {
        return "Seller contribution cannot exceed the Qwipo target fee.";
      }
    }
    if (step === 3) {
      if (!draft.effectiveFrom || !draft.effectiveUntil)
        return "Set both an effective-from and effective-until date.";
      if (draft.effectiveUntil < draft.effectiveFrom)
        return "Effective-until must be after effective-from.";
    }
    return null;
  };
  const error = stepError();

  const goNext = () => {
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };
  const goBack = () => {
    if (step === 0) navigate(backTo);
    else setStep((s) => s - 1);
  };

  const handleSave = () => {
    if (error) {
      toast.error(error);
      return;
    }
    upsertChargeConfig({ ...draft, status: "active" });
    toast.success(`Charges saved for ${targetName}`);
    navigate(backTo);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate(backTo)}
            className="text-sm text-blue-600 flex items-center gap-1.5 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Charges &amp; Fees
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
              {targetLogo ? (
                <img
                  src={targetLogo}
                  alt={targetName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-gray-900">
                  {targetName}
                </h1>
                {scope === "wholesaler" && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]">
                    Shared · all wholesaler companies
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {seller?.name}
                {scope === "wholesaler"
                  ? ` • Applies to all ${wholesalerCompanies.length} wholesaler compan${
                      wholesalerCompanies.length === 1 ? "y" : "ies"
                    }`
                  : step === 3
                    ? " • Review your configuration before saving"
                    : " • Set up how charges are shared between Qwipo, seller and retailer"}
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                    i < step
                      ? "bg-blue-600 text-white"
                      : i === step
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i < step ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </div>
                <p
                  className={`mt-1.5 text-xs font-medium ${
                    i <= step ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {s.title}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 -mt-6 ${
                    i < step ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step body */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {step === 0 && (
            <CommerceStep draft={draft} setCommerce={setCommerce} setDraft={setDraft} />
          )}
          {step === 1 && <LogisticsStep draft={draft} setLogistics={setLogistics} />}
          {step === 2 && <BeatStep draft={draft} setBeat={setBeat} />}
          {step === 3 && (
            <ReviewStep draft={draft} setDraft={setDraft} companyName={targetName} />
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between pb-8">
          <Button variant="outline" onClick={goBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(backTo)}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button onClick={goNext} className="gap-1.5">
                Save &amp; Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSave} className="gap-1.5">
                <Save className="h-4 w-4" />
                Save Configuration
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Shared bits ----

function StepHeader({
  icon,
  title,
  subtitle,
  enabled,
  onToggle,
  toggleLabel,
  toggleHint,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  toggleLabel: string;
  toggleHint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{toggleLabel}</p>
          <p className="text-[11px] text-gray-500 max-w-[220px]">{toggleHint}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}

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
          step="0.01"
          value={value}
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

// ---- Step 1: Commercial Fee ----
function CommerceStep({
  draft,
  setCommerce,
  setDraft,
}: {
  draft: ChargeConfig;
  setCommerce: (p: Partial<ChargeConfig["commerce"]>) => void;
  setDraft: Dispatch<SetStateAction<ChargeConfig>>;
}) {
  const c = draft.commerce;
  const disabled = !c.enabled;
  const retailer = commerceRetailerPct(c);
  const example = 10000;
  return (
    <div>
      <StepHeader
        icon={<Coins className="h-5 w-5 text-blue-600 mt-1" />}
        title="Commercial Fee Configuration"
        subtitle="Set up how the commercial fee will be shared between Qwipo, seller and retailer."
        enabled={c.enabled}
        onToggle={(v) => setCommerce({ enabled: v })}
        toggleLabel="Enable Commercial Fee"
        toggleHint={
          c.enabled ? "Commercial fee is active for this brand." : "Disabled for this brand."
        }
      />

      <Label className="text-xs text-gray-700">Charging Method</Label>
      <div className="flex gap-3 mt-1.5 mb-5">
        <MethodCard
          active={c.method === "gmv_percent"}
          disabled={disabled}
          title="Percentage of GMV"
          desc="Apply a fixed percentage on total order value"
          onClick={() => setCommerce({ method: "gmv_percent" })}
        />
        <MethodCard
          active={c.method === "order_slab"}
          disabled={disabled}
          title="Order Value Slab"
          desc="Apply different charges based on order value slabs"
          onClick={() => setCommerce({ method: "order_slab" })}
        />
      </div>

      {c.method === "gmv_percent" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeeInput
              label="Qwipo Target Fee (%)"
              value={c.qwipoTargetPct}
              onChange={(v) => setCommerce({ qwipoTargetPct: v })}
              suffix="%"
              disabled={disabled}
              hint={`Target commerce fee for Qwipo (max ${MAX_COMMERCE_TARGET_PCT}%)`}
            />
            <FeeInput
              label="Seller Contribution (%)"
              value={c.sellerContributionPct}
              onChange={(v) => setCommerce({ sellerContributionPct: v })}
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
        <SlabEditor draft={draft} setDraft={setDraft} disabled={disabled} />
      )}
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
  draft,
  setDraft,
  disabled,
}: {
  draft: ChargeConfig;
  setDraft: Dispatch<SetStateAction<ChargeConfig>>;
  disabled: boolean;
}) {
  const slabs = draft.commerce.slabs;
  const update = (id: string, patch: Partial<(typeof slabs)[number]>) =>
    setDraft((d) => ({
      ...d,
      commerce: {
        ...d.commerce,
        slabs: d.commerce.slabs.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
    }));
  const add = () =>
    setDraft((d) => ({
      ...d,
      commerce: {
        ...d.commerce,
        slabs: [
          ...d.commerce.slabs,
          { id: makeId("slab"), minValue: 0, maxValue: 0, fee: 0 },
        ],
      },
    }));
  const remove = (id: string) =>
    setDraft((d) => ({
      ...d,
      commerce: { ...d.commerce, slabs: d.commerce.slabs.filter((s) => s.id !== id) },
    }));

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
            value={s.minValue}
            disabled={disabled}
            onChange={(e) => update(s.id, { minValue: num(e.target.value) })}
          />
          <Input
            type="number"
            value={s.maxValue}
            disabled={disabled}
            onChange={(e) => update(s.id, { maxValue: num(e.target.value) })}
          />
          <Input
            type="number"
            value={s.fee}
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

// ---- Step 2: Logistics Fee ----
function LogisticsStep({
  draft,
  setLogistics,
}: {
  draft: ChargeConfig;
  setLogistics: (p: Partial<ChargeConfig["logistics"]>) => void;
}) {
  const l = draft.logistics;
  const disabled = !l.enabled;
  const perKg = l.method === "per_kg";
  const retailer = perKg ? logisticsRetailerPerKg(l) : logisticsRetailerPct(l);
  const kg = 24;
  return (
    <div>
      <StepHeader
        icon={<Truck className="h-5 w-5 text-blue-600 mt-1" />}
        title="Logistics Fee"
        subtitle="Configure how logistics charges are applied for this brand."
        enabled={l.enabled}
        onToggle={(v) => setLogistics({ enabled: v })}
        toggleLabel="Enable Logistics Fee"
        toggleHint={
          l.enabled
            ? "Logistics fee will be applied on all orders for this brand."
            : "Disabled for this brand."
        }
      />

      <Label className="text-xs text-gray-700">Charging Method</Label>
      <div className="flex gap-3 mt-1.5 mb-5">
        <MethodCard
          active={l.method === "gmv_percent"}
          disabled={disabled}
          title="Percentage of GMV"
          desc="Apply a fixed percentage on total order value"
          onClick={() => setLogistics({ method: "gmv_percent" })}
        />
        <MethodCard
          active={perKg}
          disabled={disabled}
          title="₹ per KG"
          desc="Charge a flat rate for every kilogram shipped"
          onClick={() => setLogistics({ method: "per_kg" })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeeInput
          label={perKg ? "Qwipo Target Fee (₹/kg)" : "Qwipo Target Fee (%)"}
          value={perKg ? l.qwipoTargetPerKg : l.qwipoTargetPct}
          onChange={(v) => setLogistics(perKg ? { qwipoTargetPerKg: v } : { qwipoTargetPct: v })}
          suffix={perKg ? "₹" : "%"}
          disabled={disabled}
        />
        <FeeInput
          label={perKg ? "Seller Contribution (₹/kg)" : "Seller Contribution (%)"}
          value={perKg ? l.sellerContributionPerKg : l.sellerContributionPct}
          onChange={(v) =>
            setLogistics(perKg ? { sellerContributionPerKg: v } : { sellerContributionPct: v })
          }
          suffix={perKg ? "₹" : "%"}
          disabled={disabled}
        />
        <CalcField
          label="Retailer Contribution (Calculated)"
          value={perKg ? `${money(retailer)}/kg` : pct(retailer)}
          hint="Target Fee − Seller Contribution"
        />
      </div>

      {!disabled && perKg && (
        <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 flex flex-wrap items-center gap-6">
          <p className="text-sm font-medium text-gray-700">Example for {kg} kg order</p>
          <Split label="Qwipo Charge" amount={money(kg * l.qwipoTargetPerKg)} sub={`${kg} kg × ${money(l.qwipoTargetPerKg)}`} />
          <Split label="Seller Contribution" amount={money(kg * l.sellerContributionPerKg)} sub={`${kg} kg × ${money(l.sellerContributionPerKg)}`} />
          <Split label="Retailer Pays" amount={money(kg * retailer)} sub={`${kg} kg × ${money(retailer)}`} />
        </div>
      )}
      {!disabled && !perKg && (
        <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 flex flex-wrap items-center gap-6">
          <p className="text-sm font-medium text-gray-700">Example for a {money(10000)} order</p>
          <Split label="Qwipo Charge" amount={money((10000 * l.qwipoTargetPct) / 100)} sub={pct(l.qwipoTargetPct)} />
          <Split label="Seller Contribution" amount={money((10000 * l.sellerContributionPct) / 100)} sub={pct(l.sellerContributionPct)} />
          <Split label="Retailer Pays" amount={money((10000 * retailer) / 100)} sub={pct(retailer)} />
        </div>
      )}
    </div>
  );
}

// ---- Step 3: Beat Small Order ----
function BeatStep({
  draft,
  setBeat,
}: {
  draft: ChargeConfig;
  setBeat: (p: Partial<ChargeConfig["beat"]>) => void;
}) {
  const b = draft.beat;
  const disabled = !b.enabled;
  const { beat: beatThreshold, nonBeat: nonBeatThreshold } = getBeatThresholds();
  return (
    <div>
      <StepHeader
        icon={<ShoppingCart className="h-5 w-5 text-blue-600 mt-1" />}
        title="Beat Small Order Configuration"
        subtitle="Additional charge for small orders to make them viable. Thresholds are inherited from the seller's Order Settings (view-only); only the flat fees are editable here."
        enabled={b.enabled}
        onToggle={(v) => setBeat({ enabled: v })}
        toggleLabel="Enable Beat Small Order"
        toggleHint={
          b.enabled ? "Applies to beat and non-beat small orders." : "Disabled for this brand."
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Beat orders */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Beat Orders</p>
            <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">
              From seller settings
            </Badge>
          </div>
          <CalcField
            label="Beat Threshold (MOV)"
            value={money(beatThreshold)}
            hint="Minimum order value for beat orders — set in the seller's Order Settings."
          />
          <FeeInput
            label="Flat Fee Below Threshold (₹)"
            value={b.flatFeeBelowBeatThreshold}
            onChange={(v) => setBeat({ flatFeeBelowBeatThreshold: v })}
            suffix="₹"
            disabled={disabled}
            hint={`Charged when a beat order is below ${money(beatThreshold)}.`}
          />
        </div>

        {/* Non-beat orders */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Non-Beat Orders</p>
            <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">
              From seller settings
            </Badge>
          </div>
          <CalcField
            label="Non-Beat Threshold (MOV)"
            value={money(nonBeatThreshold)}
            hint="Minimum order value for non-beat (off-route) orders — set in the seller's Order Settings."
          />
          <FeeInput
            label="Flat Fee Below Threshold (₹)"
            value={b.flatFeeBelowNonBeatThreshold}
            onChange={(v) => setBeat({ flatFeeBelowNonBeatThreshold: v })}
            suffix="₹"
            disabled={disabled}
            hint={`Charged when a non-beat order is below ${money(nonBeatThreshold)}.`}
          />
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-900 space-y-1">
          <p className="font-medium">How it works</p>
          <p>
            If a <b>beat</b> order is below {money(beatThreshold)}, the retailer pays{" "}
            {money(b.flatFeeBelowBeatThreshold)} as an additional charge.
          </p>
          <p>
            If a <b>non-beat</b> order is below {money(nonBeatThreshold)}, the retailer
            pays {money(b.flatFeeBelowNonBeatThreshold)} as an additional charge.
          </p>
          <p>Orders at or above the threshold have no additional charge.</p>
        </div>
      </div>
    </div>
  );
}

// ---- Step 4: Review ----
function ReviewStep({
  draft,
  setDraft,
  companyName,
}: {
  draft: ChargeConfig;
  setDraft: Dispatch<SetStateAction<ChargeConfig>>;
  companyName: string;
}) {
  const c = draft.commerce;
  const l = draft.logistics;
  const b = draft.beat;
  const perKg = l.method === "per_kg";
  const beatThresholds = getBeatThresholds();
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">
            Your configuration is ready to be saved
          </p>
          <p className="text-xs text-green-700">
            Review the details below, then click “Save Configuration” to apply these
            charges for {companyName}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReviewCard
          icon={<Coins className="h-4 w-4 text-blue-600" />}
          title="Commercial Fee"
          enabled={c.enabled}
          rows={
            c.method === "gmv_percent"
              ? [
                  ["Charging Method", "Percentage of GMV"],
                  ["Qwipo Target", pct(c.qwipoTargetPct)],
                  ["Seller Contribution", pct(c.sellerContributionPct)],
                  ["Retailer Contribution", pct(commerceRetailerPct(c))],
                ]
              : [
                  ["Charging Method", "Order Value Slab"],
                  ["Slabs", `${c.slabs.length} configured`],
                ]
          }
        />
        <ReviewCard
          icon={<Truck className="h-4 w-4 text-blue-600" />}
          title="Logistics Fee"
          enabled={l.enabled}
          rows={
            perKg
              ? [
                  ["Charging Method", "₹/kg"],
                  ["Qwipo Target", `${money(l.qwipoTargetPerKg)}/kg`],
                  ["Seller Contribution", `${money(l.sellerContributionPerKg)}/kg`],
                  ["Retailer Contribution", `${money(logisticsRetailerPerKg(l))}/kg`],
                ]
              : [
                  ["Charging Method", "Percentage of GMV"],
                  ["Qwipo Target", pct(l.qwipoTargetPct)],
                  ["Seller Contribution", pct(l.sellerContributionPct)],
                  ["Retailer Contribution", pct(logisticsRetailerPct(l))],
                ]
          }
        />
        <ReviewCard
          icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
          title="Beat Small Order"
          enabled={b.enabled}
          rows={[
            ["Beat Threshold (MOV)", money(beatThresholds.beat)],
            ["Flat Fee · Beat", money(b.flatFeeBelowBeatThreshold)],
            ["Non-Beat Threshold (MOV)", money(beatThresholds.nonBeat)],
            ["Flat Fee · Non-Beat", money(b.flatFeeBelowNonBeatThreshold)],
          ]}
        />
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">Validity</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-700">Effective From</Label>
              <Input
                type="date"
                value={draft.effectiveFrom}
                onChange={(e) => setDraft((d) => ({ ...d, effectiveFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-700">Effective Until</Label>
              <Input
                type="date"
                value={draft.effectiveUntil}
                onChange={(e) => setDraft((d) => ({ ...d, effectiveUntil: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            {fmtDate(draft.effectiveFrom)} → {fmtDate(draft.effectiveUntil)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  icon,
  title,
  enabled,
  rows,
}: {
  icon: ReactNode;
  title: string;
  enabled: boolean;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold text-gray-900">{title}</p>
        </div>
        {enabled ? (
          <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">
            Enabled
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">
            Disabled
          </Badge>
        )}
      </div>
      {enabled ? (
        <div className="space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{k}</span>
              <span className="font-medium text-gray-900">{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Not enabled for this brand.</p>
      )}
    </div>
  );
}
