// Cross Dock Store (CDS) and 3PL Logistics tabs on the seller Orders page.
//
// Confirming an order routes it here and requests the pickup from LBNP:
//   Pickup requested → Picked up (agent OTP) → Delivered; Cancelled.
// The table is the same as the Confirmed tab (rendered by the Orders page);
// this component supplies the summary, filters and which orders to show.

import { useMemo, useState, type ReactNode } from "react";
import { Truck, Warehouse } from "lucide-react";
import { cn } from "../ui/utils";
import { inRange, isPartiallyCancelled, orderValue, type DateRangeKey } from "../../lib/cds/calc";
import { OPERATOR_SELLER_ID } from "../../lib/cds/master-data";
import { cdsOrderDates } from "../../lib/cds/order-bridge";
import type { CdsOrder, Route } from "../../lib/cds/types";
import { DateRangeSelect, Pager, SearchBox, useCdsScope, useTable } from "./cds-ui";
import { DayAndTypeFilters, OrdersSummaryStrip } from "./orders-header-filters";
import { getOrdersToday } from "../../lib/orders-data";

type StageKey = "requested" | "picked" | "delivered" | "issues" | "all";

const STAGES: { key: StageKey; label: string; match: (o: CdsOrder, hasReturn: boolean) => boolean }[] = [
  { key: "requested", label: "Pickup requested", match: (o) => o.status === "Pickup Requested" },
  // After pickup the CDS and the delivery app own the order; the seller just tracks it here.
  { key: "picked", label: "Picked up", match: (o) => ["Picked Up", "In Transit to CDS", "Received", "Received Short", "Sorting", "Ready for Dispatch", "Transferred to CDS", "Out for Delivery"].includes(o.status) },
  { key: "delivered", label: "Delivered", match: (o) => o.status === "Delivered" },
  { key: "issues", label: "Cancelled", match: (o) => o.status === "Cancelled" || isPartiallyCancelled(o) },
  { key: "all", label: "All", match: () => true },
];

/** Orders for one delivery route: "cds" (CDS tab) or "3pl" (3PL Logistics
 *  tab). Confirming an order sends it here and to LBNP in one step, so both
 *  start at Pickup requested → Picked up → Delivered. 3PL orders go straight
 *  to the retailer. */
export function CdsOrdersTab({ route = "cds", renderTable }: { route?: Route; renderTable: (orderIds: string[]) => ReactNode }) {
  const { s, retailerName } = useCdsScope();
  const isThreePl = route === "3pl";
  const mine = useMemo(
    () => s.orders.filter((o) => o.sellerId === OPERATOR_SELLER_ID && (o.route ?? "cds") === route),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.rev, route],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const returnOrderIds = useMemo(() => new Set(s.returns.filter((r) => r.type === "Retailer Return").map((r) => r.orderId)), [s.rev]);
  const [stage, setStage] = useState<StageKey>("requested");
  const [range, setRange] = useState<DateRangeKey>("7d");
  const [q, setQ] = useState("");
  const [day, setDay] = useState("all");

  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return mine.filter(
      (o) =>
        // open work is always shown; finished orders follow the date filter
        (["Confirmed", "Pickup Requested", "Picked Up", "In Transit to CDS"].includes(o.status) || inRange(o.waveDate, range)) &&
        (!needle || `${o.id} ${retailerName(o.retailerId)}`.toLowerCase().includes(needle)),
    );
  }, [mine, range, q, retailerName]);

  const current = STAGES.find((x) => x.key === stage)!;
  // Delivery day filter (same chips as the other Orders tabs).
  const deliveryOf = (o: CdsOrder) => cdsOrderDates(o.id, o.placedAt).deliveryDate;
  const dayBuckets = (() => {
    const m = new Map<string, number>();
    for (const o of base.filter((x) => current.match(x, returnOrderIds.has(x.id)))) m.set(deliveryOf(o), (m.get(deliveryOf(o)) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  })();
  const withDay = day === "all" ? base : base.filter((o) => deliveryOf(o) === day);
  const rows = withDay.filter((o) => current.match(o, returnOrderIds.has(o.id)));
  const table = useTable(rows, {
    sort: { key: "updated", dir: "desc" },
    accessors: {
      updated: (o) => o.history[o.history.length - 1]?.at ?? o.placedAt,
      orderDate: (o) => cdsOrderDates(o.id, o.placedAt).orderDate,
      value: (o) => orderValue(o),
      retailer: (o) => retailerName(o.retailerId),
    },
  });



  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <OrdersSummaryStrip
        customers={new Set(rows.map((o) => o.retailerId)).size}
        orders={rows.length}
        value={rows.reduce((x, o) => x + orderValue(o), 0)}
      />
      <DayAndTypeFilters
        days={dayBuckets}
        day={day}
        onDayChange={(d) => {
          setDay(d);
          table.setPage(1);
        }}
        today={getOrdersToday()}
        typeLabel={isThreePl ? "3PL Logistics" : "Cross Dock Store"}
        typeIcon={isThreePl ? <Truck className="h-3 w-3" /> : <Warehouse className="h-3 w-3" />}
        typeTone={isThreePl ? "blue" : "teal"}
      />
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b px-6 py-2.5">
        {STAGES.map((st) => {
          const count = withDay.filter((o) => st.match(o, returnOrderIds.has(o.id))).length;
          return (
            <button
              key={st.key}
              type="button"
              onClick={() => {
                setStage(st.key);
                setDay("all");
                table.setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                stage === st.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
              )}
            >
              {st.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b px-6 py-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="Order ID or retailer" />
        <DateRangeSelect value={range} onChange={(v) => { setRange(v); table.setPage(1); }} />
      </div>

      {/* Same table as the Confirmed tab (columns, badges, actions). */}
      {renderTable(table.paged.map((o) => o.id))}
      <Pager table={table} label="order" />

    </div>
  );
}
