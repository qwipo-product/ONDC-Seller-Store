import { useState } from "react";
import { CalendarClock, Info } from "lucide-react";
import { toast } from "sonner";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  BEAT_VISIBILITY_OPTIONS,
  beatVisibilityLabel,
  getBeatVisibilityDays,
  setBeatVisibilityDays,
} from "../lib/beat-visibility";

/**
 * Seller-wide Beat-Day Visibility Window, shown at the top of the admin
 * Serviceability tab. One value covers every beat the seller runs —
 * wholesale and distribution alike — so it sits above both sections.
 * Saves on change, like the beat sections below it.
 */
export function BeatVisibilitySetting({ sellerId }: { sellerId: string }) {
  const [days, setDays] = useState(() => getBeatVisibilityDays(sellerId));

  const save = (value: string) => {
    const next = Number(value);
    if (next === days) return;
    setBeatVisibilityDays(sellerId, next);
    setDays(next);
    toast.success(`Beat-day visibility set to "${beatVisibilityLabel(next)}".`);
  };

  return (
    <section className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[260px]">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-blue-600" />
            Beat-Day Visibility Window
          </h3>
        </div>
        <div className="w-full sm:w-72 shrink-0">
          <Label htmlFor="beat-visibility" className="text-xs text-gray-600 mb-1 block">
            Show beat-day option
          </Label>
          <Select value={String(days)} onValueChange={save}>
            <SelectTrigger id="beat-visibility" className="bg-white w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BEAT_VISIBILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-3 flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-px shrink-0" />
        Counted in calendar days from the day the retailer is ordering;
        Next-Day Delivery keeps its own MOV and rules.
      </p>
    </section>
  );
}
