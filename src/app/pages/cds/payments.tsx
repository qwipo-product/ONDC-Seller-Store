// Cross Dock Store (CDS) — Payments (seller view).
//
// Follows the order flow: every change to an order changes what the
// seller is paid, and the page shows that step by step.
//
//   Ordered value
//   − Edited by you        (quantity edits / partial cancel before pickup)
//   − Short at pickup      (rider collected less than confirmed)
//   − Short / damaged at CDS
//   = Billed to retailer   (collected by the delivery agent: cash / QR; credit is handled offline)
//   − Returns              (raised after delivery, from the delivery app)
//   = Your payout
//
// Orders not yet delivered show an expected payout; fully cancelled
// orders show ₹0 so the seller can see why nothing is coming.

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, Eye, RotateCcw, Truck, Wallet, Warehouse } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  CdsPage,
  DateRangeSelect,
  EmptyRow,
  Kpi,
  Mono,
  Pager,
  Panel,
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
} from "../../components/cds/cds-ui";
import { useNavigate } from "react-router";
import { type DateRangeKey, downloadCsv, fmtDate, fmtDateTime, fmtINR, inRange, orderMoney, type OrderMoney, sellerPayoutStatus } from "../../lib/cds/calc";
import { OPERATOR_SELLER_ID } from "../../lib/cds/master-data";
import type { CdsOrder } from "../../lib/cds/types";
import { cn } from "../../components/ui/utils";

type Filter = "all" | "upcoming" | "due" | "settled" | "changes" | "issue";
type Tone = "green" | "amber" | "red" | "blue" | "gray" | "purple" | "indigo";

type Money = OrderMoney;

interface Row {
  o: CdsOrder;
  m: Money;
  when: string;
  stage: "upcoming" | "delivered" | "cancelled";
  collection: { label: string; tone: Tone; sub?: string };
  payout: { label: string; tone: Tone; sub?: string };
  group: Filter[];
  /** Money actually paid out for this order (settled orders). */
  paid: number;
  /** Return value recovered from a later payout (return came after payout). */
  recovered: number;
  editReason?: string;
  returnReason?: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

const money = orderMoney;

const lastAt = (o: CdsOrder) => o.history[o.history.length - 1]?.at ?? o.confirmedAt;

export function CdsPayments() {
  const { s, retailerName } = useCdsScope();
  const [range, setRange] = useState<DateRangeKey>("7d");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [route, setRoute] = useState<"all" | "cds" | "3pl">("all");
  const navigate = useNavigate();
  // View opens the full order page (its CDS / 3PL section has the payment summary).
  const openOrder = (id: string) => navigate(`/orders/${id}`);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const o of s.orders) {
      if (o.sellerId !== OPERATOR_SELLER_ID) continue;
      const delivered = o.status === "Delivered" && !!o.deliveredAt;
      const cancelled = o.status === "Cancelled";
      const stage: Row["stage"] = delivered ? "delivered" : cancelled ? "cancelled" : "upcoming";
      const when = delivered ? o.deliveredAt! : lastAt(o);
      // Open orders always show; finished ones follow the date range.
      if (stage !== "upcoming" && !inRange(when, range)) continue;

      const m = money(o, s);
      const group: Filter[] = ["all"];
      if (m.edited || m.shortPickup || m.shortCds || m.returns) group.push("changes");

      const editAdj = s.adjustments.find((a) => a.orderId === o.id && a.type === "Partial Cancellation");
      const editReason = cancelled ? o.cancelReason : editAdj?.note.split(" — ").pop() ?? (m.edited > 0 ? "Edited before confirming" : undefined);
      const ret = s.returns.find((r) => r.orderId === o.id && r.type === "Retailer Return");
      const st = s.settlements.find((x) => x.orderIds.includes(o.id) && x.sellerId === o.sellerId);

      let collection: Row["collection"];
      let payout: Row["payout"];
      let paid = 0;
      const recovered = round(
        s.settlements.flatMap((x) => x.recoveries ?? []).filter((x) => x.orderId === o.id).reduce((x, r) => x + r.amount, 0),
      );
      if (stage === "cancelled") {
        collection = { label: "Not billed", tone: "gray" };
        payout = { label: "No payment", tone: "gray", sub: "Order cancelled" };
      } else if (stage === "upcoming") {
        collection = { label: "On delivery", tone: "gray", sub: o.paymentType === "Credit" ? "Credit · offline" : "Agent collects" };
        payout = { label: "Awaiting delivery", tone: "blue", sub: "Expected amount" };
        group.push("upcoming");
      } else {
        const col = s.collections.find((c) => c.splits.some((sp) => sp.orderId === o.id));
        if (o.paymentType === "Credit") {
          // Credit is handled offline by the seller.
          collection = { label: "Credit · offline", tone: "gray", sub: "Collect from the retailer offline" };
          payout = { label: "Credit · handled offline", tone: "gray" };
        } else {
          if (!col) collection = { label: "Pending", tone: "gray" };
          else if (col.status === "Failed") {
            collection = { label: "QR failed", tone: "red", sub: "Agent following up" };
            group.push("issue");
          } else collection = { label: col.mode === "QR" ? "Paid by QR" : "Cash collected", tone: "green", sub: col.mode === "QR" ? col.qrRef : `by ${col.agent}` };

          if (st?.status === "Settled") {
            // A return raised after the payout went out is recovered from the next one.
            paid = round(m.payout + recovered);
            payout = recovered
              ? { label: "Settled", tone: "green", sub: `Paid ${fmtINR(paid)} · return ${fmtINR(recovered)} recovered from next payout` }
              : { label: "Settled", tone: "green", sub: `${st.utr} · ${fmtDate(st.settledAt)}` };
            group.push("settled");
          } else if (st?.status === "On Hold") {
            payout = { label: "On hold", tone: "red", sub: st.holdReason };
            group.push("due", "issue");
          } else {
            payout = { label: st?.status === "Processing" ? "Processing" : "To be settled", tone: st?.status === "Processing" ? "blue" : "amber" };
            group.push("due");
          }
        }
      }
      // One payout vocabulary on every screen (see sellerPayoutStatus).
      payout = sellerPayoutStatus(o, s);
      out.push({ o, m, when, stage, collection, payout, group, paid, recovered, editReason, returnReason: ret?.reason });
    }
    return out;
  }, [s, range]);

  const needle = q.trim().toLowerCase();
  const routeOf = (r: Row) => r.o.route ?? "cds";
  const typeCount = (k: "cds" | "3pl") => rows.filter((r) => r.group.includes(filter) && routeOf(r) === k).length;
  const shown = rows.filter(
    (r) =>
      r.group.includes(filter) &&
      (route === "all" || routeOf(r) === route) &&
      (!needle || `${r.o.id} ${retailerName(r.o.retailerId)}`.toLowerCase().includes(needle)),
  );
  const table = useTable(shown, {
    sort: { key: "at", dir: "desc" },
    accessors: { at: (r) => r.when, payout: (r) => r.m.payout },
  });

  const count = (f: Filter) => rows.filter((r) => r.group.includes(f)).length;
  const sumPayout = (f: Filter) => rows.filter((r) => r.group.includes(f)).reduce((x, r) => x + r.m.payout, 0);
  const delivered = rows.filter((r) => r.stage === "delivered");
  // Late returns are taken from the next payout, so it is smaller than the orders in it.
  const pendingRecovery = round(
    s.settlements
      .filter((x) => x.sellerId === OPERATOR_SELLER_ID && x.status !== "Settled")
      .flatMap((x) => x.recoveries ?? [])
      .reduce((x, r) => x + r.amount, 0),
  );
  const toSettle = round(sumPayout("due") - pendingRecovery);
  const settledPaid = rows.filter((r) => r.group.includes("settled")).reduce((x, r) => x + r.paid, 0);
  const total = (k: keyof Money, list = delivered) => list.reduce((x, r) => x + r.m[k], 0);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Awaiting delivery" },
    { key: "due", label: "To be paid" },
    { key: "settled", label: "Paid to you" },
    { key: "changes", label: "Edited, short or returned" },
    { key: "issue", label: "Needs attention" },
  ];


  return (
    <CdsPage
      title="CDS Payments"
      description="What you get paid for each Cross Dock Store and 3PL Logistics order — after your edits, short pickups and returns"
      showSwitcher={false}
      actions={
        <>
          <DateRangeSelect value={range} onChange={(v) => { setRange(v); table.setPage(1); }} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              downloadCsv(`cds-payments-${range}.csv`, [
                ["Order ID", "Retailer", "Date", "Ordered value", "Edited by you", "Short at pickup", "Short/damaged at CDS", "Billed to retailer", "Returns", "Your payout", "Paid by", "Collection", "Payout status", "Reference"],
                ...table.sorted.map((r) => [
                  r.o.id, retailerName(r.o.retailerId), fmtDateTime(r.when), r.m.ordered, r.m.edited, r.m.shortPickup, r.m.shortCds, r.m.billed, r.m.returns, r.m.payout,
                  r.o.paymentType, r.collection.label, r.payout.label, r.payout.sub ?? "",
                ]),
              ])
            }
          >
            <Download className="h-4 w-4" /> Export
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Awaiting delivery" value={fmtINR(sumPayout("upcoming"))} sub={`${count("upcoming")} orders · expected`} icon={<Clock className="h-4 w-4" />} tone="blue" onClick={() => setFilter("upcoming")} active={filter === "upcoming"} />
        <Kpi label="To be paid to you" value={fmtINR(toSettle)} sub={pendingRecovery ? `${count("due")} orders · after ${fmtINR(pendingRecovery)} return recovery` : `${count("due")} delivered orders`} icon={<Wallet className="h-4 w-4" />} tone="amber" onClick={() => setFilter("due")} active={filter === "due"} />
        <Kpi label="Paid to you" value={fmtINR(settledPaid)} sub={`${count("settled")} orders`} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" onClick={() => setFilter("settled")} active={filter === "settled"} />
        <Kpi label="Returns deducted" value={fmtINR(total("returns"))} sub={`${delivered.filter((r) => r.m.returns > 0).length} orders with returns`} icon={<RotateCcw className="h-4 w-4" />} tone="red" onClick={() => setFilter("changes")} active={filter === "changes"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setFilter(f.key); table.setPage(1); }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              filter === f.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-600">Order type:</span>
        {([
          { key: "all", label: `All (${typeCount("cds") + typeCount("3pl")})`, on: "border-gray-900 bg-gray-900 text-white", off: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50", icon: null },
          { key: "cds", label: `Cross Dock Store (${typeCount("cds")})`, on: "border-teal-600 bg-teal-600 text-white", off: "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100", icon: <Warehouse className="h-3 w-3" /> },
          { key: "3pl", label: `3PL Logistics (${typeCount("3pl")})`, on: "border-blue-600 bg-blue-600 text-white", off: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100", icon: <Truck className="h-3 w-3" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setRoute(t.key); table.setPage(1); }}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", route === t.key ? t.on : t.off)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <SearchBox value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="Order ID or retailer" />
        </div>
      </div>

      <Panel>
        <TableWrap>
          <THead>
            <Th>Order ID</Th>
            <Th>Retailer</Th>
            <Th sortKey="at" table={table}>Date</Th>
            <Th className="text-right">Ordered</Th>
            <Th>Changes</Th>
            <Th sortKey="payout" table={table} className="text-right">Your payout</Th>
            <Th>Paid by</Th>
            <Th>Payout status</Th>
            <Th className={STICKY_ACTIONS_TH}>Actions</Th>
          </THead>
          <tbody className="divide-y divide-gray-100">
            {table.paged.length === 0 && <EmptyRow cols={9} text="No CDS or 3PL orders here in this period." />}
            {table.paged.map((r) => (
              <tr key={r.o.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openOrder(r.o.id)}>
                <Td>
                  <Mono>{r.o.id}</Mono>
                  <p className={`mt-0.5 text-[10px] font-medium ${r.o.route === "3pl" ? "text-blue-700" : "text-teal-700"}`}>
                    {r.o.route === "3pl" ? "3PL Logistics" : "Cross Dock Store"}
                  </p>
                </Td>
                <Td>{retailerName(r.o.retailerId)}</Td>
                <Td className="whitespace-nowrap text-xs text-gray-600">
                  {fmtDateTime(r.when)}
                  <p className="text-[11px] text-gray-400">{r.stage === "delivered" ? "Delivered" : r.stage === "cancelled" ? "Cancelled" : "In progress"}</p>
                </Td>
                <Td className="text-right tabular-nums text-gray-600">{fmtINR(r.m.ordered)}</Td>
                <Td>
                  <div className="flex flex-col gap-0.5 text-[11px]">
                    {r.stage === "cancelled" ? (
                      <span className="text-gray-600">Order cancelled −{fmtINR(r.m.ordered)}</span>
                    ) : (
                      <>
                        {r.m.edited > 0 && <span className="text-amber-700">Edited by you −{fmtINR(r.m.edited)}</span>}
                        {r.m.shortPickup > 0 && <span className="text-amber-700">Short at pickup −{fmtINR(r.m.shortPickup)}</span>}
                        {r.m.shortCds > 0 && <span className="text-amber-700">Short / damaged at CDS −{fmtINR(r.m.shortCds)}</span>}
                        {r.m.returns > 0 && <span className="text-red-700">Return −{fmtINR(r.m.returns)}</span>}
                        {!r.m.edited && !r.m.shortPickup && !r.m.shortCds && !r.m.returns && <span className="text-gray-400">No changes</span>}
                      </>
                    )}
                  </div>
                </Td>
                <Td className="text-right tabular-nums font-semibold text-gray-900">{fmtINR(r.m.payout)}</Td>
                <Td>
                  <PaymentPill type={r.o.paymentType} />
                  <p className="mt-0.5 text-[11px] text-gray-500">{r.collection.label}</p>
                </Td>
                <Td>
                  <Pill tone={r.payout.tone}>{r.payout.label}</Pill>
                  {r.payout.sub && <p className="mt-0.5 text-[11px] text-gray-500">{r.payout.sub}</p>}
                </Td>
                <Td className={STICKY_ACTIONS_TD}>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); openOrder(r.o.id); }}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <Pager table={table} label="order" />
      </Panel>

    </CdsPage>
  );
}
