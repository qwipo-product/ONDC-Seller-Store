// Returns tab on the seller Orders page (CDS connector sellers).
// Returns are raised and updated by the delivery app. The seller sees
// what came back, why, whether the goods are back with them and how it
// affects their payout. Returns are verified with OTP by the delivery partner.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Eye, Info } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { type DateRangeKey, fmtDateTime, fmtINR, inRange, returnStage, type ReturnStageKey } from "../../lib/cds/calc";
import { OPERATOR_SELLER_ID } from "../../lib/cds/master-data";
import type { CdsState, ReturnCase } from "../../lib/cds/types";
import { DateRangeSelect, EmptyRow, Mono, Pager, Pill, SearchBox, Td, Th, THead, TableWrap, STICKY_ACTIONS_TD, STICKY_ACTIONS_TH, useCdsScope, useTable } from "./cds-ui";
import { useCds } from "../../lib/cds/store";
import { DayAndTypeFilters, OrdersSummaryStrip } from "./orders-header-filters";
import { cdsOrderDates } from "../../lib/cds/order-bridge";
import { getOrdersToday } from "../../lib/orders-data";
import { Truck, Warehouse } from "lucide-react";

const RETURN_TYPES: ReturnCase["type"][] = ["Retailer Return", "Delivery Failure (RTO)", "Receiving Discrepancy"];

const TYPE_LABEL: Partial<Record<ReturnCase["type"], string>> = {
  "Retailer Return": "Returned by retailer",
  "Delivery Failure (RTO)": "Not delivered (RTO)",
  "Receiving Discrepancy": "Damaged / short at CDS",
};

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

function payoutImpact(r: ReturnCase, s: CdsState): { text: string; tone: "red" | "purple" | "gray" } {
  if (r.type !== "Retailer Return") return { text: "Not billed to retailer", tone: "gray" };
  const o = s.orders.find((x) => x.id === r.orderId);
  if (o?.paymentType === "Credit") return { text: `Credit note −${fmtINR(r.value)}`, tone: "purple" };
  if (s.settlements.some((x) => x.status !== "Settled" && x.recoveries?.some((v) => v.returnId === r.id))) return { text: `−${fmtINR(r.value)} due in next payout`, tone: "red" };
  return { text: `−${fmtINR(r.value)} from payout`, tone: "red" };
}

export function CdsReturnsTab() {
  const { s, retailerName } = useCdsScope();
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState<DateRangeKey>("30d");
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const openOrder = (id: string) => navigate(`/orders/${id}`);
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
  const table = useTable(rows, {
    sort: { key: "at", dir: "desc" },
    accessors: { at: (r) => r.createdAt, value: (r) => r.value },
  });

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

      <div className="flex-1 overflow-auto">
        <TableWrap>
          <THead>
            <Th>Return ID</Th>
            <Th>Order ID</Th>
            <Th>Retailer</Th>
            <Th>Type</Th>
            <Th>Items</Th>
            <Th sortKey="value" table={table} className="text-right">Value</Th>
            <Th>Reason</Th>
            <Th sortKey="at" table={table}>Raised on</Th>
            <Th>Payout impact</Th>
            <Th>Status</Th>
            <Th className={STICKY_ACTIONS_TH}>Actions</Th>
          </THead>
          <tbody className="divide-y divide-gray-100">
            {table.paged.length === 0 && <EmptyRow cols={11} text="No returns in this period." />}
            {table.paged.map((r) => {
              const impact = payoutImpact(r, s);
              return (
                <tr key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openOrder(r.orderId)}>
                  <Td><Mono>{r.id}</Mono></Td>
                  <Td><Mono>{r.orderId}</Mono></Td>
                  <Td>{retailerName(r.retailerId)}</Td>
                  <Td className="text-xs text-gray-700">{TYPE_LABEL[r.type] ?? r.type}</Td>
                  <Td className="text-xs text-gray-700">
                    {r.items.map((i) => (
                      <p key={i.sku}>{i.qty} × {i.name}</p>
                    ))}
                  </Td>
                  <Td className="text-right tabular-nums font-medium">{fmtINR(r.value)}</Td>
                  <Td className="max-w-[200px] text-xs text-gray-600">{r.reason}</Td>
                  <Td className="whitespace-nowrap text-xs text-gray-600">{fmtDateTime(r.createdAt)}</Td>
                  <Td><Pill tone={impact.tone}>{impact.text}</Pill></Td>
                  <Td>
                    <Pill tone={returnStage(r).tone}>{returnStage(r).label}</Pill>
                    <p className="mt-0.5 text-[11px] text-gray-500">{fmtDateTime(r.sellerSettledAt ?? r.updatedAt)}</p>
                  </Td>
                  <Td className={STICKY_ACTIONS_TD}>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); openOrder(r.orderId); }}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>
      <Pager table={table} label="return" />

    </div>
  );
}
