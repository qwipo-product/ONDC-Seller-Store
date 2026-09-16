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
  Truck,
  CalendarDays,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  getCompanies,
  makeId,
  ONDC_CATEGORY_NAMES,
} from "../../lib/admin-catalog";
import { getSellerById } from "../../lib/mock-store";
import {
  getSellerDistributorConfig,
  getSellerWholesaleConfig,
  emptyChargeConfig,
  upsertChargeConfig,
  logisticsRetailerPerKg,
  logisticsRetailerPct,
  categoryLogisticsRetailer,
  type ChargeConfig,
  type ChargeScope,
} from "../../lib/charges-data";

const STEPS = [
  { title: "Logistics Fee", sub: "Configure" },
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

  const setLogistics = (patch: Partial<ChargeConfig["logistics"]>) =>
    setDraft((d) => ({ ...d, logistics: { ...d.logistics, ...patch } }));

  const LAST_STEP = STEPS.length - 1; // Review

  // ---- Per-step validation ----
  const stepError = (): string | null => {
    if (step === 0 && draft.logistics.enabled) {
      const l = draft.logistics;
      if (l.method === "per_kg") {
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
    }
    if (step === LAST_STEP) {
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
    setStep((s) => Math.min(LAST_STEP, s + 1));
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
    toast.success(`Logistics charges saved for ${targetName}`);
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
                  : step === LAST_STEP
                    ? " • Review your configuration before saving"
                    : " • Set up how logistics charges are shared between Qwipo, seller and retailer"}
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
            <LogisticsStep draft={draft} setLogistics={setLogistics} setDraft={setDraft} />
          )}
          {step === 1 && (
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
            {step < LAST_STEP ? (
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

// ---- Step 1: Logistics Fee ----
function LogisticsStep({
  draft,
  setLogistics,
  setDraft,
}: {
  draft: ChargeConfig;
  setLogistics: (p: Partial<ChargeConfig["logistics"]>) => void;
  setDraft: Dispatch<SetStateAction<ChargeConfig>>;
}) {
  const l = draft.logistics;
  const disabled = !l.enabled;
  const perKg = l.method === "per_kg";
  const byCategory = l.method === "by_category";
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
            ? "Applied on 3PL logistics for next-day delivery (NDD)."
            : "Disabled for this brand."
        }
      />

      <Label className="text-xs text-gray-700">Charging Method</Label>
      <div className="flex flex-col sm:flex-row gap-3 mt-1.5 mb-5">
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
        <MethodCard
          active={byCategory}
          disabled={disabled}
          title="By Category"
          desc="Set a separate fee for each product category"
          onClick={() => setLogistics({ method: "by_category" })}
        />
      </div>

      {byCategory ? (
        <CategoryFeeEditor draft={draft} setDraft={setDraft} disabled={disabled} />
      ) : (
        <>
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
          {!disabled && l.method === "gmv_percent" && (
            <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 flex flex-wrap items-center gap-6">
              <p className="text-sm font-medium text-gray-700">Example for a {money(10000)} order</p>
              <Split label="Qwipo Charge" amount={money((10000 * l.qwipoTargetPct) / 100)} sub={pct(l.qwipoTargetPct)} />
              <Split label="Seller Contribution" amount={money((10000 * l.sellerContributionPct) / 100)} sub={pct(l.sellerContributionPct)} />
              <Split label="Retailer Pays" amount={money((10000 * retailer) / 100)} sub={pct(retailer)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Per-category logistics fee editor — add one category at a time; each row
// carries its own Qwipo target and seller contribution (retailer = target −
// seller). A category can only be added once.
function CategoryFeeEditor({
  draft,
  setDraft,
  disabled,
}: {
  draft: ChargeConfig;
  setDraft: Dispatch<SetStateAction<ChargeConfig>>;
  disabled: boolean;
}) {
  const rows = draft.logistics.categories;
  const usedCategories = new Set(rows.map((r) => r.category).filter(Boolean));
  const availableCategories = ONDC_CATEGORY_NAMES.filter(
    (name) => !usedCategories.has(name),
  );

  const update = (id: string, patch: Partial<(typeof rows)[number]>) =>
    setDraft((d) => ({
      ...d,
      logistics: {
        ...d.logistics,
        categories: d.logistics.categories.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      },
    }));
  const add = () =>
    setDraft((d) => ({
      ...d,
      logistics: {
        ...d.logistics,
        categories: [
          ...d.logistics.categories,
          { id: makeId("catfee"), category: "", qwipoTarget: 0, sellerContribution: 0 },
        ],
      },
    }));
  const remove = (id: string) =>
    setDraft((d) => ({
      ...d,
      logistics: {
        ...d.logistics,
        categories: d.logistics.categories.filter((r) => r.id !== id),
      },
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
          disabled={disabled || availableCategories.length === 0}
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
            // Categories still available PLUS this row's own current pick.
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
                  disabled={disabled}
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
                  disabled={disabled}
                  onChange={(e) => update(r.id, { qwipoTarget: num(e.target.value) })}
                />
                <Input
                  type="number"
                  step="1"
                  value={r.sellerContribution === 0 ? "" : r.sellerContribution}
                  placeholder="0"
                  disabled={disabled}
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
                  disabled={disabled}
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

// ---- Step 2: Review ----
function ReviewStep({
  draft,
  setDraft,
  companyName,
}: {
  draft: ChargeConfig;
  setDraft: Dispatch<SetStateAction<ChargeConfig>>;
  companyName: string;
}) {
  const l = draft.logistics;
  const perKg = l.method === "per_kg";
  const byCategory = l.method === "by_category";
  const logisticsRows: [string, string][] = perKg
    ? [
        ["Charging Method", "₹/kg"],
        ["Qwipo Target", `${money(l.qwipoTargetPerKg)}/kg`],
        ["Seller Contribution", `${money(l.sellerContributionPerKg)}/kg`],
        ["Retailer Contribution", `${money(logisticsRetailerPerKg(l))}/kg`],
      ]
    : byCategory
      ? [
          ["Charging Method", "By Category"],
          ["Categories Configured", `${l.categories.length}`],
        ]
      : [
          ["Charging Method", "Percentage of GMV"],
          ["Qwipo Target", pct(l.qwipoTargetPct)],
          ["Seller Contribution", pct(l.sellerContributionPct)],
          ["Retailer Contribution", pct(logisticsRetailerPct(l))],
        ];
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
            logistics charges for {companyName}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReviewCard
          icon={<Truck className="h-4 w-4 text-blue-600" />}
          title="Logistics Fee"
          enabled={l.enabled}
          rows={logisticsRows}
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

      {/* Per-category breakdown when the By Category method is used. */}
      {l.enabled && byCategory && l.categories.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">
              Logistics by Category
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left font-medium py-1.5">Category</th>
                  <th className="text-right font-medium py-1.5">Qwipo Target</th>
                  <th className="text-right font-medium py-1.5">Seller</th>
                  <th className="text-right font-medium py-1.5">Retailer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {l.categories.map((f) => (
                  <tr key={f.id}>
                    <td className="py-1.5 text-gray-900">{f.category || "—"}</td>
                    <td className="py-1.5 text-right text-gray-700">{money(f.qwipoTarget)}</td>
                    <td className="py-1.5 text-right text-gray-700">{money(f.sellerContribution)}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900">
                      {money(categoryLogisticsRetailer(f))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
