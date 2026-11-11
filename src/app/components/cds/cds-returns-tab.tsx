// Returns tab on the seller Orders page (CDS connector sellers).
// Returns are raised and updated by the delivery app. The seller sees
// what came back, why, whether the goods are back with them and how it
// affects their payout. Returns are verified with OTP by the delivery partner.

import { useMemo, useState, type ReactNode } from "react";
import { Info, Truck, Undo2, Warehouse } from "lucide-react";
import { cn } from "../ui/utils";
import { type DateRangeKey, fmtINR, inRange, returnStage, type ReturnStageKey } from "../../lib/cds/calc";
import { OPERATOR_SELLER_ID } from "../../lib/cds/master-data";
import type { CdsState, ReturnCase } from "../../lib/cds/types";
import { DateRangeSelect, Pager, SearchBox, useCdsScope, useTable } from "./cds-ui";
import { useCds } from "../../lib/cds/store";
import { DayAndTypeFilters, OrdersSummaryStrip } from "./orders-header-filters";
import { cdsOrderDates } from "../../lib/cds/order-bridge";
import { getOrdersToday } from "../../lib/orders-data";

const RETURN_TYPES: ReturnCase["type"][] = ["Retailer Return", "Delivery Failure (RTO)", "Receiving Discrepancy"];

type Filter = "all" | ReturnStageKey;
const FILTERS: { key: Filter; label: string; match: (r: ReturnCase) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "raised", label: "Return raised", match: (r) => returnStage(r).key === "raised" },
  { key: "coming", label: "Coming back to you", match: (r) => returnStage(r).key === "coming" },
  { key: "back", label: "Returned to you", match: (r) => returnStage(r).key === "back" },
];

function sellerReturns(s: CdsState): ReturnCase[] {
  return s.returns.filter((r) => r.sellerId === OPERATOR_SELLER_ID && RETURN_TYPES.includes(r.type));
}

/** Number of returns for the tab label. */
export function useCdsReturnCount(): number {
  const s = useCds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => sellerReturns(s).length, [s.rev]);
}

export function CdsReturnsTab({ renderTable }: { renderTable: (orderIds: string[], statusNotes?: Map<string, ReactNode>) => ReactNode }) {
  const { s, retailerName } = useCdsScope();
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState<DateRangeKey>("30d");
  const [q, setQ] = useState("");
  const [day, setDay] = useState("all");
  const [route, setRoute] = useState<"all" | "cds" | "3pl">("all");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => sellerReturns(s), [s.rev]);
  const needle = q.trim().toLowerCase();
  const base = all.filter(
    (r) => inRange(r.createdAt, range) && (!needle || `${r.id} ${r.orderId} ${retailerName(r.retailerId)}`.toLowerCase().includes(needle)),
  );
  const current = FILTERS.find((f) => f.key === filter)!;
  // CDS or 3PL, from the returned order's route.
  const routeOf = (r: ReturnCase) => s.orders.find((x) => x.id === r.orderId)?.route ?? "cds";
  // Delivery day of the returned order (same chips as the other tabs).
  const deliveryOf = (r: ReturnCase) => {
    const o = s.orders.find((x) => x.id === r.orderId);
    return o ? cdsOrderDates(o.id, o.placedAt).deliveryDate : "";
  };
  const dayBuckets = (() => {
    const m = new Map<string, number>();
    for (const r of base.filter(current.match)) m.set(deliveryOf(r), (m.get(deliveryOf(r)) ?? 0) + 1);
    return [...m.entries()].filter(([d]) => d).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  })();
  const dayScoped = day === "all" ? base : base.filter((r) => deliveryOf(r) === day);
  const typeCount = (k: "cds" | "3pl") => dayScoped.filter((r) => current.match(r) && routeOf(r) === k).length;
  const withDay = route === "all" ? dayScoped : dayScoped.filter((r) => routeOf(r) === route);
  const rows = withDay.filter(current.match);
  // One row per order (latest return first); its return stage shows
  // under the order status.
  const orderRows = (() => {
    const m = new Map<string, ReturnCase>();
    for (const r of [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) if (!m.has(r.orderId)) m.set(r.orderId, r);
    return [...m.values()].map((r) => ({ id: r.orderId, latest: r, count: rows.filter((x) => x.orderId === r.orderId).length }));
  })();
  const table = useTable(orderRows, { sort: { key: "at", dir: "desc" }, accessors: { at: (x) => x.latest.createdAt } });
  const notes = new Map<string, ReactNode>(
    table.paged.map((x) => {
      const st = returnStage(x.latest);
      const tone = st.key === "back" ? "text-gray-700" : st.key === "coming" ? "text-amber-700" : "text-purple-700";
      return [
        x.id,
        <span key={x.id} className={`inline-flex items-center gap-1 text-[11px] font-medium ${tone}`} title={`${x.latest.id} · ${x.latest.reason}`}>
          <Undo2 className="h-3 w-3" /> Return · {st.label}
          {x.count > 1 ? ` (+${x.count - 1})` : ""} · −{fmtINR(x.latest.value)}
        </span>,
      ];
    }),
  );

  return (
    <div className="flex h-full flex-col">
      <OrdersSummaryStrip
        customers={new Set(rows.map((r) => r.retailerId)).size}
        orders={new Set(rows.map((r) => r.orderId)).size}
        value={rows.reduce((x, r) => x + r.value, 0)}
        valueLabel="Returned Value"
      />
      <DayAndTypeFilters
        days={dayBuckets}
        day={day}
        onDayChange={(d) => {
          setDay(d);
          table.setPage(1);
        }}
        today={getOrdersToday()}
        typeLabel="Cross Dock Store"
        typeIcon={<Warehouse className="h-3 w-3" />}
        typeOptions={[
          { key: "cds", label: "Cross Dock Store", count: typeCount("cds"), icon: <Warehouse className="h-3 w-3" />, tone: "teal" },
          { key: "3pl", label: "3PL Logistics", count: typeCount("3pl"), icon: <Truck className="h-3 w-3" />, tone: "blue" },
        ]}
        typeValue={route}
        onTypeChange={(k) => {
          setRoute(k as "all" | "cds" | "3pl");
          table.setPage(1);
        }}
      />
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b px-6 pt-4 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setFilter(f.key); setDay("all"); table.setPage(1); }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              filter === f.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            {f.label} ({withDay.filter(f.match).length})
          </button>
        ))}
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b px-6 py-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="Return ID, order ID or retailer" />
        <DateRangeSelect value={range} onChange={(v) => { setRange(v); table.setPage(1); }} />
        <p className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
          <Info className="h-3.5 w-3.5" /> Returns are raised and updated by the delivery app.
        </p>
      </div>

      {/* Same table as the Confirmed tab; the return stage shows under Status. */}
      {renderTable(table.paged.map((x) => x.id), notes)}
      <Pager table={table} label="order" />

    </div>
  );
}
