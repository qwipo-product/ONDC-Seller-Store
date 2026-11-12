// Header used by the CDS and Returns tabs so every Orders tab has the same
// top section: the summary strip (Customers · Orders · Total Value) and
// the Delivery day / Order type filter rows. Styling mirrors the main
// Orders tabs.

import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

export function OrdersSummaryStrip({
  customers,
  orders,
  value,
  ordersLabel = "Orders",
  valueLabel = "Total Value",
}: {
  customers: number;
  orders: number;
  value: number;
  ordersLabel?: string;
  valueLabel?: string;
}) {
  const Item = ({ label, children, tone }: { label: string; children: ReactNode; tone?: string }) => (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tone ?? "text-gray-900"}`}>{children}</span>
    </div>
  );
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-gray-100 bg-gradient-to-r from-purple-50/40 via-white to-emerald-50/40 px-6 py-2.5">
      <Item label="Customers">{customers.toLocaleString()}</Item>
      <span className="h-3 w-px bg-gray-200" />
      <Item label={ordersLabel}>{orders.toLocaleString()}</Item>
      <span className="h-3 w-px bg-gray-200" />
      <Item label={valueLabel} tone="text-emerald-700">
        ₹{Math.round(value).toLocaleString("en-IN")}
      </Item>
      <span className="ml-auto text-[10px] text-gray-500">Updates with active filters</span>
    </div>
  );
}

const dayLabel = (iso: string) => {
  const d = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(d)) return iso;
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
};

export type TypeOption = { key: string; label: string; count: number; icon: ReactNode; tone: "teal" | "blue" };

const TYPE_TONE = {
  teal: { on: "border-teal-600 bg-teal-600 text-white", off: "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100" },
  blue: { on: "border-blue-600 bg-blue-600 text-white", off: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100" },
};

/** Delivery day chips + Order type. One fixed chip when the tab holds a
 *  single type (CDS / 3PL tabs), or selectable All / type chips when it
 *  mixes both (Returns). */
export function DayAndTypeFilters({
  days,
  day,
  onDayChange,
  today,
  typeLabel,
  typeIcon,
  typeTone = "teal",
  typeOptions,
  typeValue = "all",
  onTypeChange,
}: {
  days: { date: string; count: number }[];
  day: string;
  onDayChange: (d: string) => void;
  /** Orders-calendar "today", highlighted red like the main tabs. */
  today: string;
  typeLabel: string;
  typeIcon: ReactNode;
  /** teal = CDS, blue = 3PL. */
  typeTone?: "teal" | "blue";
  /** Selectable types — replaces the single fixed chip. */
  typeOptions?: TypeOption[];
  typeValue?: string;
  onTypeChange?: (key: string) => void;
}) {
  const total = days.reduce((s, d) => s + d.count, 0);
  const scoped = day === "all" ? total : days.find((d) => d.date === day)?.count ?? 0;
  return (
    <div className="flex-shrink-0 space-y-2 border-b px-6 pb-2 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-600">Delivery day:</span>
        <button
          type="button"
          onClick={() => onDayChange("all")}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            day === "all" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          All days ({total})
        </button>
        {days.map((b) => {
          const active = day === b.date;
          const tone =
            b.date === today
              ? active
                ? "bg-red-600 text-white border-red-600"
                : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
              : active
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100";
          return (
            <button
              key={b.date}
              type="button"
              onClick={() => onDayChange(b.date)}
              title={b.date}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${tone}`}
            >
              <CalendarDays className="h-3 w-3" />
              {dayLabel(b.date)} ({b.count})
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-600">Delivery Type:</span>
        {typeOptions ? (
          <>
            <button
              type="button"
              onClick={() => onTypeChange?.("all")}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                typeValue === "all" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All ({typeOptions.reduce((x, t) => x + t.count, 0)})
            </button>
            {typeOptions.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onTypeChange?.(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${TYPE_TONE[t.tone][typeValue === t.key ? "on" : "off"]}`}
              >
                {t.icon}
                {t.label} ({t.count})
              </button>
            ))}
          </>
        ) : (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-white ${typeTone === "blue" ? "border-blue-600 bg-blue-600" : "border-teal-600 bg-teal-600"}`}>
            {typeIcon}
            {typeLabel} ({scoped})
          </span>
        )}
      </div>
    </div>
  );
}
