// Cross Dock Store (CDS) tab on the seller Orders page.
//
// The connector seller's confirmed orders (they join the CDS on confirm):
//   Ready for logistics → request an LBNP pickup (one trip, many orders)
//   Pickup requested    → cancel if needed (quantities are edited on the New tab, before confirming)
//   Picked up           → pickup agent verified with OTP; partial pickups are flagged
//   Delivered / returns → updated by the delivery app (read-only here)
// Clicking a row opens the full order journey.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Ban, Eye, Send, Truck, Warehouse } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import {
  SELLER_CANCELLABLE,
  fmtDate,
  fmtINR,
  inRange,
  isModified,
  isPartialPickup,
  isPartiallyCancelled,
  orderUnits,
  orderValue,
  sellerOrderStage,
  type DateRangeKey,
} from "../../lib/cds/calc";
import { OPERATOR_SELLER_ID } from "../../lib/cds/master-data";
import { cdsOrderDates } from "../../lib/cds/order-bridge";
import { engine, run } from "../../lib/cds/store";
import type { CdsOrder, Route } from "../../lib/cds/types";
import {
  DateRangeSelect,
  EmptyRow,
  Mono,
  Pager,
  PaymentPill,
  Pill,
  SearchBox,
  Td,
  Th,
  THead,
  TableWrap,
  STICKY_ACTIONS_TD,
  STICKY_ACTIONS_TH,
  useCdsScope,
  useTable,
} from "./cds-ui";
import { CancelDialog } from "./order-detail-sheet";
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
export function CdsOrdersTab({ route = "cds" }: { route?: Route }) {
  const { s, retailerName, retailerMap, cdsName } = useCdsScope();
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
  const navigate = useNavigate();
  const openOrder = (id: string) => navigate(`/orders/${id}`);
  const [dialog, setDialog] = useState<{ kind: "cancel"; o: CdsOrder } | null>(null);
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

      <div className="flex-1 overflow-auto">
        <TableWrap>
          <THead>
            <Th sortKey="orderDate" table={table}>Order date</Th>
            <Th>Delivery date</Th>
            <Th>Order ID</Th>
            <Th sortKey="retailer" table={table}>Retailer</Th>
            <Th className="text-right">Items</Th>
            <Th sortKey="value" table={table} className="text-right">Value</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
            <Th className={STICKY_ACTIONS_TH}>Actions</Th>
          </THead>
          <tbody className="divide-y divide-gray-100">
            {table.paged.length === 0 && (
              <EmptyRow cols={9} text="No orders here. Orders you confirm land here automatically, already sent to LBNP." />
            )}
            {table.paged.map((o) => {
              const dates = cdsOrderDates(o.id, o.placedAt);
              return (
                <tr key={o.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openOrder(o.id)}>
                  <Td className="whitespace-nowrap text-xs text-gray-700">{fmtDate(dates.orderDate)}</Td>
                  <Td className="whitespace-nowrap text-xs text-gray-700">
                    {fmtDate(dates.deliveryDate)}
                    {dates.deliveredOn && dates.deliveredOn !== dates.deliveryDate && (
                      <p className="text-[11px] text-gray-500">Delivered {fmtDate(dates.deliveredOn)}</p>
                    )}
                  </Td>
                  <Td>
                    <Mono>{o.id}</Mono>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {isModified(o) && <Pill tone="amber">Qty changed</Pill>}
                      {isPartiallyCancelled(o) && <Pill tone="red">Part cancelled</Pill>}
                      {isPartialPickup(o) && <Pill tone="amber">Partial pickup</Pill>}
                      {returnOrderIds.has(o.id) && <Pill tone="purple">Return raised</Pill>}
                    </div>
                  </Td>
                  <Td>
                    <p className="font-medium text-gray-900">{retailerName(o.retailerId)}</p>
                    <p className="text-xs text-gray-500">{retailerMap.get(o.retailerId)?.area}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{orderUnits(o)} {orderUnits(o) === 1 ? "unit" : "units"}</Td>
                  <Td className="text-right tabular-nums font-medium">{fmtINR(orderValue(o))}</Td>
                  <Td><PaymentPill type={o.paymentType} /></Td>
                  <Td>
                    <Pill tone={sellerOrderStage(o.status).tone}>{sellerOrderStage(o.status).label}</Pill>
                    <p className="mt-0.5 text-[11px] text-gray-500">{isThreePl ? "3PL · direct to retailer" : cdsName(o.cdsId)}</p>
                  </Td>
                  <Td className={STICKY_ACTIONS_TD}>
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => openOrder(o.id)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      {SELLER_CANCELLABLE.includes(o.status) && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-red-700" onClick={() => setDialog({ kind: "cancel", o })}>
                          <Ban className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>
      <Pager table={table} label="order" />

      {dialog?.kind === "cancel" && <CancelDialog o={dialog.o} open onOpenChange={(v) => !v && setDialog(null)} />}
    </div>
  );
}
