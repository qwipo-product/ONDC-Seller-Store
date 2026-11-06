// Cross Dock Store (CDS) tab on the seller Orders page.
//
// The connector seller's confirmed orders (they join the CDS on confirm):
//   Ready for logistics → request an LBNP pickup (one trip, many orders)
//   Pickup requested    → cancel if needed (quantities are edited on the New tab, before confirming)
//   Picked up           → mark the pickup settled; partial pickups are flagged
//   Delivered / returns → updated by the delivery app (read-only here)
// Clicking a row opens the full order journey.

import { useMemo, useState } from "react";
import { Ban, Eye, Send, Truck, Warehouse } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import {
  CANCELLABLE,
  fmtDate,
  fmtINR,
  inRange,
  isModified,
  isPartialPickup,
  isPartiallyCancelled,
  orderUnits,
  isPickedUpStage,
  orderValue,
  sellerOrderStage,
  type DateRangeKey,
} from "../../lib/cds/calc";
import { OPERATOR_SELLER_ID } from "../../lib/cds/master-data";
import { cdsOrderDates } from "../../lib/cds/order-bridge";
import { engine, run } from "../../lib/cds/store";
import type { CdsOrder } from "../../lib/cds/types";
import {
  DateRangeSelect,
  EmptyRow,
  FilterSelect,
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
import { CancelDialog, OrderDetailSheet } from "./order-detail-sheet";
import { PickupSettleAction, PickupSettledPill } from "./settle-dialog";

type StageKey = "ready" | "requested" | "picked" | "delivered" | "issues" | "all";

const STAGES: { key: StageKey; label: string; match: (o: CdsOrder, hasReturn: boolean) => boolean }[] = [
  { key: "ready", label: "Ready for logistics", match: (o) => o.status === "Confirmed" },
  { key: "requested", label: "Pickup requested", match: (o) => o.status === "Pickup Requested" },
  // After pickup the CDS and the delivery app own the order; the seller just tracks it here.
  { key: "picked", label: "Picked up", match: (o) => ["Picked Up", "In Transit to CDS", "Received", "Received Short", "Sorting", "Ready for Dispatch", "Transferred to CDS", "Out for Delivery"].includes(o.status) },
  { key: "delivered", label: "Delivered", match: (o) => o.status === "Delivered" },
  { key: "issues", label: "Cancelled", match: (o) => o.status === "Cancelled" || isPartiallyCancelled(o) },
  { key: "all", label: "All", match: () => true },
];

export function CdsOrdersTab() {
  const { s, retailerName, retailerMap, cdsName } = useCdsScope();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mine = useMemo(() => s.orders.filter((o) => o.sellerId === OPERATOR_SELLER_ID), [s.rev]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const returnOrderIds = useMemo(() => new Set(s.returns.filter((r) => r.type === "Retailer Return").map((r) => r.orderId)), [s.rev]);
  const [stage, setStage] = useState<StageKey>(() => (mine.some((o) => o.status === "Confirmed") ? "ready" : "all"));
  const [range, setRange] = useState<DateRangeKey>("7d");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orderId, setOrderId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [dialog, setDialog] = useState<{ kind: "cancel"; o: CdsOrder } | null>(null);

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
  const rows = base.filter((o) => current.match(o, returnOrderIds.has(o.id)));
  const table = useTable(rows, {
    sort: { key: "updated", dir: "desc" },
    accessors: {
      updated: (o) => o.history[o.history.length - 1]?.at ?? o.placedAt,
      orderDate: (o) => cdsOrderDates(o.id, o.placedAt).orderDate,
      value: (o) => orderValue(o),
      retailer: (o) => retailerName(o.retailerId),
    },
  });

  const ready = rows.filter((o) => o.status === "Confirmed");
  const selOrders = ready.filter((o) => selected.has(o.id));
  const allSelected = ready.length > 0 && ready.every((o) => selected.has(o.id));


  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b px-6 py-2.5">
        {STAGES.map((st) => {
          const count = base.filter((o) => st.match(o, returnOrderIds.has(o.id))).length;
          return (
            <button
              key={st.key}
              type="button"
              onClick={() => {
                setStage(st.key);
                setSelected(new Set());
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
        {stage === "ready" && (
          <div className="ml-auto flex items-center gap-2">
            {selOrders.length > 0 && <span className="text-sm text-gray-600">{selOrders.length} selected</span>}
            <Button size="sm" className="gap-2 bg-teal-600 hover:bg-teal-700" disabled={!selOrders.length} onClick={() => setRequestOpen(true)}>
              <Send className="h-4 w-4" /> Request logistics
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <TableWrap>
          <THead>
            {stage === "ready" && (
              <Th className="w-8">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => setSelected(v === true ? new Set(ready.map((o) => o.id)) : new Set())}
                  aria-label="Select all orders ready for logistics"
                />
              </Th>
            )}
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
              <EmptyRow
                cols={stage === "ready" ? 10 : 9}
                text={stage === "ready" ? "No orders waiting. Orders you confirm appear here automatically." : "No CDS orders here."}
              />
            )}
            {table.paged.map((o) => {
              const dates = cdsOrderDates(o.id, o.placedAt);
              return (
                <tr key={o.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOrderId(o.id)}>
                  {stage === "ready" && (
                    <Td>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(o.id)}
                          onCheckedChange={(v) => {
                            const n = new Set(selected);
                            v === true ? n.add(o.id) : n.delete(o.id);
                            setSelected(n);
                          }}
                          aria-label={`Select ${o.id}`}
                        />
                      </span>
                    </Td>
                  )}
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
                      <PickupSettledPill o={o} />
                    </div>
                  </Td>
                  <Td>
                    <p className="font-medium text-gray-900">{retailerName(o.retailerId)}</p>
                    <p className="text-xs text-gray-500">{retailerMap.get(o.retailerId)?.area}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{orderUnits(o)} units</Td>
                  <Td className="text-right tabular-nums font-medium">{fmtINR(orderValue(o))}</Td>
                  <Td><PaymentPill type={o.paymentType} /></Td>
                  <Td>
                    <Pill tone={sellerOrderStage(o.status).tone}>{sellerOrderStage(o.status).label}</Pill>
                    <p className="mt-0.5 text-[11px] text-gray-500">{cdsName(o.cdsId)}</p>
                  </Td>
                  <Td className={STICKY_ACTIONS_TD}>
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setOrderId(o.id)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      {CANCELLABLE.includes(o.status) && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-red-700" onClick={() => setDialog({ kind: "cancel", o })}>
                          <Ban className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                      {isPickedUpStage(o.status) && <PickupSettleAction o={o} retailer={retailerName(o.retailerId)} />}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>
      <Pager table={table} label="order" />

      <RequestLogisticsDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        orders={selOrders}
        onDone={(id) => {
          setSelected(new Set());
          setStage("requested");
          void id; // no side panel — "Keep items ready" shows in the order View
        }}
      />
      {dialog?.kind === "cancel" && <CancelDialog o={dialog.o} open onOpenChange={(v) => !v && setDialog(null)} />}
      <OrderDetailSheet orderId={orderId} onClose={() => setOrderId(null)} />
    </div>
  );
}

const SLOTS = ["Morning · 08:00 – 11:00", "Midday · 11:00 – 13:00", "Afternoon · 13:00 – 15:00", "Evening · 16:00 – 19:00"];

function RequestLogisticsDialog({
  open,
  onOpenChange,
  orders,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orders: CdsOrder[];
  onDone: (tripId: string) => void;
}) {
  const { sellerMap, locationMap, retailerName } = useCdsScope();
  const [slot, setSlot] = useState(SLOTS[1]);
  const [note, setNote] = useState("");
  if (!orders.length) return null;
  const seller = sellerMap.get(OPERATOR_SELLER_ID);
  const cds = locationMap.get(orders[0].cdsId);
  const units = orders.reduce((x, o) => x + orderUnits(o), 0);
  const value = orders.reduce((x, o) => x + orderValue(o), 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-teal-600" /> Request logistics</DialogTitle>
          <DialogDescription>LBNP will send one rider to pick up these orders and drop them at the CDS.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Pickup from</p>
            <p className="font-medium text-gray-900">{seller?.name}</p>
            <p className="text-xs text-gray-600">{seller?.area} · {seller?.phone}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500"><Warehouse className="h-3 w-3" /> Drop at</p>
            <p className="font-medium text-gray-900">{cds?.name}</p>
            <p className="text-xs text-gray-600">{cds?.locality}</p>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200">
          <div className="flex justify-between border-b border-gray-100 px-3 py-2 text-xs text-gray-600">
            <span>{orders.length} orders · {units} units · ~{Math.max(1, Math.round(units / 6))} packages</span>
            <span className="font-semibold text-gray-900">{fmtINR(value)}</span>
          </div>
          <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex justify-between gap-2 px-3 py-1.5">
                <span className="truncate">{retailerName(o.retailerId)}</span>
                <span className="tabular-nums text-gray-600">{orderUnits(o)} units</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-1.5">
          <Label>Pickup slot</Label>
          <FilterSelect value={slot} onChange={setSlot} options={SLOTS.map((x) => ({ value: x, label: x }))} placeholder="Slot" width="w-full" />
        </div>
        <div className="grid gap-1.5">
          <Label>Note for the rider (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Godown gate 2, closes at 1 PM" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="gap-2 bg-teal-600 hover:bg-teal-700"
            onClick={() => {
              const id = run(() => engine.requestPickupTrip(orders.map((o) => o.id), { slot, note: note || undefined }), () => "Logistics requested — keep items ready. The pickup OTP will come to you by SMS.");
              if (id) {
                onOpenChange(false);
                setNote("");
                onDone(id as string);
              }
            }}
          >
            <Send className="h-4 w-4" /> Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
