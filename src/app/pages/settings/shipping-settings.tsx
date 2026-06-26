import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ArrowLeft, Save, Truck, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getDeliveryFeeSlabs,
  setDeliveryFeeSlabs,
  type DeliveryFeeSlab,
} from "../../lib/shipping-settings-data";

// Phase 1 caps the seller at a single Delivery Fee Slab. The "Add
// slab" button is rendered (and disabled with a tooltip) so the
// seller knows multi-slab support is on the roadmap without us
// having to redesign this screen later.
const MAX_SLABS_PHASE_1 = 1;

interface DraftSlab {
  min: string;
  max: string;
  charges: string;
}

const toDraft = (s: DeliveryFeeSlab): DraftSlab => ({
  min: String(s.minOrderValue),
  max: String(s.maxOrderValue),
  charges: String(s.deliveryCharges),
});

const parseDraft = (d: DraftSlab): DeliveryFeeSlab => ({
  minOrderValue: Number(d.min),
  maxOrderValue: Number(d.max),
  deliveryCharges: Number(d.charges),
});

export function ShippingSettings() {
  const navigate = useNavigate();

  const initialSlabs = useMemo(() => getDeliveryFeeSlabs(), []);
  const [drafts, setDrafts] = useState<DraftSlab[]>(() =>
    initialSlabs.map(toDraft),
  );
  const [saved, setSaved] = useState<DraftSlab[]>(() =>
    initialSlabs.map(toDraft),
  );
  // Inline validation errors keyed by slab index + field.
  const [errors, setErrors] = useState<
    Record<number, Partial<Record<keyof DraftSlab, string>>>
  >({});

  const isDirty = useMemo(
    () =>
      drafts.length !== saved.length ||
      drafts.some(
        (d, i) =>
          d.min !== saved[i]?.min ||
          d.max !== saved[i]?.max ||
          d.charges !== saved[i]?.charges,
      ),
    [drafts, saved],
  );

  const updateField = (
    idx: number,
    field: keyof DraftSlab,
    value: string,
  ) => {
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
    );
    setErrors((prev) => {
      const slabErrs = { ...(prev[idx] ?? {}) };
      delete slabErrs[field];
      return { ...prev, [idx]: slabErrs };
    });
  };

  const handleSave = () => {
    const newErrors: typeof errors = {};
    const parsed: DeliveryFeeSlab[] = [];

    drafts.forEach((d, i) => {
      const slabErrs: Partial<Record<keyof DraftSlab, string>> = {};
      const min = Number(d.min);
      const max = Number(d.max);
      const charges = Number(d.charges);
      if (d.min.trim() === "" || !Number.isFinite(min) || min < 0)
        slabErrs.min = "Enter a non-negative number";
      if (d.max.trim() === "" || !Number.isFinite(max) || max <= 0)
        slabErrs.max = "Enter a positive number";
      if (d.charges.trim() === "" || !Number.isFinite(charges) || charges < 0)
        slabErrs.charges = "Enter a non-negative number";
      if (!slabErrs.min && !slabErrs.max && max <= min)
        slabErrs.max = "Max must be greater than Min";
      if (Object.keys(slabErrs).length > 0) {
        newErrors[i] = slabErrs;
      } else {
        parsed.push({
          minOrderValue: min,
          maxOrderValue: max,
          deliveryCharges: charges,
        });
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Fix the highlighted fields before saving.");
      return;
    }

    setDeliveryFeeSlabs(parsed);
    setSaved(parsed.map(toDraft));
    setErrors({});
    toast.success("Shipping settings saved.");
  };

  const addSlab = () => {
    if (drafts.length >= MAX_SLABS_PHASE_1) return;
    setDrafts((prev) => [
      ...prev,
      { min: "0", max: "1000", charges: "50" },
    ]);
  };

  const atPhaseCap = drafts.length >= MAX_SLABS_PHASE_1;

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-full">
      {/* Compact header — single line, same shape as Order Settings. */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/settings")}
          className="h-8 w-8 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="h-5 w-5 text-amber-600" />
          Shipping Settings
        </h1>
      </div>

      <div className="max-w-3xl space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Delivery Fee Slabs</CardTitle>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Order value range → flat delivery fee. Phase 1 supports a
                  single slab per distributor.
                </p>
              </div>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={handleSave}
                disabled={!isDirty}
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {drafts.map((d, idx) => {
              const slabErrs = errors[idx] ?? {};
              return (
                <div
                  key={idx}
                  className="rounded-md border border-gray-200 bg-gray-50/40 p-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Min Order Value (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={d.min}
                        onChange={(e) =>
                          updateField(idx, "min", e.target.value)
                        }
                        className="h-8 text-sm"
                        aria-invalid={!!slabErrs.min}
                      />
                      {slabErrs.min ? (
                        <p className="text-[11px] text-red-600">
                          {slabErrs.min}
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500">
                          Inclusive lower bound.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Order Value (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={d.max}
                        onChange={(e) =>
                          updateField(idx, "max", e.target.value)
                        }
                        className="h-8 text-sm"
                        aria-invalid={!!slabErrs.max}
                      />
                      {slabErrs.max ? (
                        <p className="text-[11px] text-red-600">
                          {slabErrs.max}
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500">
                          Inclusive upper bound.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Delivery Charges (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={d.charges}
                        onChange={(e) =>
                          updateField(idx, "charges", e.target.value)
                        }
                        className="h-8 text-sm"
                        aria-invalid={!!slabErrs.charges}
                      />
                      {slabErrs.charges ? (
                        <p className="text-[11px] text-red-600">
                          {slabErrs.charges}
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500">
                          Flat fee applied to orders in this range.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={addSlab}
              disabled={atPhaseCap}
              title={
                atPhaseCap
                  ? "Phase 1 supports a single slab. Multi-slab support is on the roadmap."
                  : "Add another slab"
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add slab
            </Button>

            {atPhaseCap && (
              <div className="flex items-start gap-2 p-2.5 rounded border border-blue-100 bg-blue-50/60 text-[11px] text-blue-900">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>
                  Phase 1 ships a single delivery fee slab per distributor.
                  Multi-slab support is on the roadmap.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
