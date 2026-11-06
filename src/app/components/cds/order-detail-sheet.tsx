// Cross Dock Store (CDS) — order detail side panel.
// Shows only what the seller needs: product summary and payment summary.

import { useState } from "react";
import { Ban } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { cn } from "../ui/utils";
import { CANCELLABLE, fmtDateTime, fmtINR, goodQty, isPartialPickup, isPartiallyCancelled, isPickedUpStage, orderMoney, orderValue, pickupQty, returnStage, sellerOrderStage, sellerPayoutStatus } from "../../lib/cds/calc";
import { engine, run } from "../../lib/cds/store";
import type { CdsOrder } from "../../lib/cds/types";
import { FilterSelect, PaymentPill, Pill, useCdsScope } from "./cds-ui";
import { PickupSettleAction, PickupSettledPill, ReturnSettleAction } from "./settle-dialog";
import { LbnpSimulator } from "./trip-detail-sheet";

export function OrderDetailSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { s, retailerMap } = useCdsScope();
  const o = orderId ? s.orders.find((x) => x.id === orderId) : undefined;
  const [cancelOpen, setCancelOpen] = useState(false);

  return (
    <Sheet open={!!orderId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 gap-0">
        {o && (
          <OrderBody
            o={o}
            retailer={retailerMap.get(o.retailerId)?.name ?? ""}
            onCancel={() => setCancelOpen(true)}
          />
        )}
        {o && <CancelDialog o={o} open={cancelOpen} onOpenChange={setCancelOpen} />}
      </SheetContent>
    </Sheet>
  );
}

/** Order panel: product summary + payment summary, nothing else. */
function OrderBody({ o, retailer, onCancel }: { o: CdsOrder; retailer: string; onCancel: () => void }) {
  const { s } = useCdsScope();
  const m = orderMoney(o, s);
  const cancelled = o.status === "Cancelled";
  const delivered = o.status === "Delivered";
  const returns = s.returns.filter((r) => r.orderId === o.id && r.type === "Retailer Return");
  const returnedQty = (sku: string) => returns.reduce((x, r) => x + r.items.filter((i) => i.sku === sku).reduce((y, i) => y + i.qty, 0), 0);
  const editNote = s.adjustments.find((a) => a.orderId === o.id && a.type === "Partial Cancellation")?.note.split(" — ").pop() ?? (o.lines.some((l) => l.confirmedQty < l.orderedQty) ? "Edited before confirming" : undefined);
  const collection = s.collections.find((c) => c.splits.some((sp) => sp.orderId === o.id));
  const last = [...o.history].sort((x, y) => x.at.localeCompare(y.at)).pop();
  const canCancel = CANCELLABLE.includes(o.status);

  let collected: string;
  if (o.paymentType === "Credit") collected = "Credit — handled offline by you";
  else if (collection) {
    collected =
      collection.status === "Failed"
        ? "QR payment failed — agent following up"
        : `${collection.mode === "QR" ? "Paid by QR" : "Cash collected"} by ${collection.agent}`;
  } else collected = cancelled ? "Not billed" : "Collected by the delivery agent on delivery";

  const payout = sellerPayoutStatus(o, s);
  const stage = sellerOrderStage(o.status);

  return (
    <>
      <SheetHeader className="border-b border-gray-200 p-5 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={stage.tone}>{stage.label}</Pill>
          {isPartiallyCancelled(o) && <Pill tone="red">Partially cancelled</Pill>}
          {isPartialPickup(o) && <Pill tone="amber">Partial pickup</Pill>}
          {returns.length > 0 && <Pill tone="purple">Return raised</Pill>}
          <PickupSettledPill o={o} />
        </div>
        <SheetTitle className="mt-2 text-base">{retailer}</SheetTitle>
        <SheetDescription className="text-xs">
          <span className="font-mono">{o.id}</span> · placed {fmtDateTime(o.placedAt)}
        </SheetDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          {canCancel && (
            <Button size="sm" variant="outline" className="gap-1.5 text-red-700" onClick={onCancel}>
              <Ban className="h-4 w-4" /> Cancel order
            </Button>
          )}
          {isPickedUpStage(o.status) && <PickupSettleAction o={o} retailer={retailer} />}
        </div>
      </SheetHeader>

      <div className="space-y-5 p-5">
        {o.status === "Pickup Requested" && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Keep items ready — pickup agent will pick the orders soon. The pickup OTP will come to your registered mobile by SMS; share it with the agent.
          </p>
        )}

        {/* Last update */}
        {last && (
          <section className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Last update</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">{last.title}</p>
            {last.note && <p className="text-xs text-gray-600">{last.note}</p>}
            <p className="mt-0.5 text-[11px] text-gray-500">{fmtDateTime(last.at)}{last.by ? ` · ${last.by}` : ""}</p>
          </section>
        )}

        {/* Product summary */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Product summary · {o.lines.length} {o.lines.length === 1 ? "product" : "products"}</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-2 py-2 text-right font-semibold">Ordered</th>
                  <th className="px-2 py-2 text-right font-semibold">Final</th>
                  <th className="px-2 py-2 text-right font-semibold">Returned</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {o.lines.map((l) => {
                  const fin = cancelled ? 0 : goodQty(l);
                  const ret = returnedQty(l.sku);
                  const notes = [
                    !cancelled && l.confirmedQty < l.orderedQty ? `${l.orderedQty - l.confirmedQty} edited by you` : "",
                    l.pickedQty !== undefined && l.pickedQty < l.confirmedQty ? `${l.confirmedQty - l.pickedQty} short at pickup` : "",
                    l.receivedQty !== undefined && goodQty(l) < pickupQty(l) ? `${pickupQty(l) - goodQty(l)} short/damaged at CDS` : "",
                  ].filter(Boolean);
                  return (
                    <tr key={l.sku}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">{l.name}</p>
                        <p className="text-gray-500">{fmtINR(l.price)} each</p>
                        {notes.length > 0 && <p className="text-amber-700">{notes.join(" · ")}</p>}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{l.orderedQty}</td>
                      <td className={cn("px-2 py-2 text-right tabular-nums", fin < l.orderedQty && "font-semibold text-amber-700")}>{fin}</td>
                      <td className={cn("px-2 py-2 text-right tabular-nums", ret > 0 && "font-semibold text-red-700")}>{ret || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtINR(l.price * Math.max(0, fin - ret))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Payment summary */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment summary</h4>
          <div className="rounded-lg border border-gray-200 text-sm">
            <MoneyLine label="Ordered value" value={m.ordered} />
            {cancelled ? (
              <MoneyLine label="Order cancelled" note={o.cancelReason} value={-m.ordered} tone="amber" />
            ) : (
              <>
                {m.edited > 0 && <MoneyLine label="Edited by you" note={editNote} value={-m.edited} tone="amber" />}
                {m.shortPickup > 0 && <MoneyLine label="Short at pickup" value={-m.shortPickup} tone="amber" />}
                {m.shortCds > 0 && <MoneyLine label="Short / damaged at CDS" value={-m.shortCds} tone="amber" />}
              </>
            )}
            <MoneyLine label="Billed to retailer" value={m.billed} total />
            {m.returns > 0 && <MoneyLine label="Returned by retailer" note={returns.map((r) => r.reason).join(", ")} value={-m.returns} tone="red" />}
            <MoneyLine label={delivered ? "Your payout" : "Expected payout"} value={m.payout} total strong />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Paid by retailer</p>
              <div className="mt-1"><PaymentPill type={o.paymentType} /></div>
              <p className="mt-1 text-xs text-gray-600">{collected}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Paid to you</p>
              <div className="mt-1"><Pill tone={payout.tone}>{payout.label}</Pill></div>
              {payout.sub && <p className="mt-1 text-[11px] text-gray-500">{payout.sub}</p>}
            </div>
          </div>
        </section>

        {/* Returns on this order */}
        {returns.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Returns</h4>
            <div className="space-y-2">
              {returns.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs">
                  <div>
                    <p className="font-medium text-gray-900">{r.id} · {r.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</p>
                    <p className="text-gray-500">{r.reason} · −{fmtINR(r.value)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={returnStage(r).tone}>{returnStage(r).label}</Pill>
                    <ReturnSettleAction r={r} retailer={retailer} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <DeliveryPartnerSimulator o={o} />
      </div>
    </>
  );
}

function MoneyLine({
  label,
  value,
  note,
  tone,
  total,
  strong,
}: {
  label: string;
  value: number;
  note?: string;
  tone?: "amber" | "red";
  total?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 py-2", total && "border-t border-gray-200 bg-gray-50", strong && "bg-green-50")}>
      <div>
        <p className={cn(total ? "font-semibold text-gray-900" : "text-gray-700")}>{label}</p>
        {note && <p className="text-[11px] text-gray-500">{note}</p>}
      </div>
      <p
        className={cn(
          "tabular-nums",
          tone === "amber" && "text-amber-700",
          tone === "red" && "text-red-700",
          total && "font-semibold text-gray-900",
          strong && "font-bold text-green-800",
        )}
      >
        {value < 0 ? `−${fmtINR(-value)}` : fmtINR(value)}
      </p>
    </div>
  );
}

/** Prototype only: stands in for the delivery partner app and the payout
 *  system, so the demo can move an order / return forward and enable
 *  "Mark settled". Not part of the seller's real screen. */
function DeliveryPartnerSimulator({ o }: { o: CdsOrder }) {
  const { s } = useCdsScope();
  const actions: { label: string; fn: () => void; msg: string }[] = [];
  for (const r of s.returns.filter((x) => x.orderId === o.id && x.type === "Retailer Return" && !x.sellerSettledAt)) {
    if (r.status === "Open") actions.push({ label: `${r.id}: return collected from retailer`, fn: () => engine.scheduleReturnToSeller(r.id), msg: "Return collected — coming back to you" });
    if (r.status === "Return to Seller Scheduled") actions.push({ label: `${r.id}: goods returned to seller`, fn: () => engine.markReturnedToSeller(r.id), msg: "Goods returned to you" });
  }
  const own = s.settlements.find((x) => x.orderIds.includes(o.id) && x.sellerId === o.sellerId);
  const recov = s.settlements.find((x) => x.status !== "Settled" && x.recoveries?.some((v) => v.orderId === o.id));
  for (const st of [own, recov]) {
    if (st && st.status !== "Settled" && o.status === "Delivered" && o.paymentType !== "Credit" && !actions.some((a) => a.label.startsWith(st.id)))
      actions.push({ label: `${st.id}: payout sent to seller`, fn: () => engine.payoutSettlement(st.id), msg: "Payout sent to you" });
  }
  // Pickup / delivery trip updates (LBNP + delivery app), prototype only.
  const sh = s.shipments.find((x) => x.id === o.shipmentId);
  const delivery = s.trips.find((t) => t.id === sh?.deliveryTripId);
  const trip =
    delivery && ["Out for Delivery", "Delivery Failed"].includes(o.status)
      ? delivery
      : ["Pickup Requested", "Picked Up"].includes(o.status)
        ? s.trips.find((t) => t.id === o.pickupTripId)
        : undefined;
  if (!actions.length) return trip ? <LbnpSimulator t={trip} /> : null;
  return (
    <section className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Prototype only · delivery partner / payout updates</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} size="sm" variant="outline" className="h-7 border-amber-300 bg-white text-xs text-amber-900" onClick={() => run(a.fn, a.msg)}>
            {a.label}
          </Button>
        ))}
      </div>
      {trip && <div className="mt-3"><LbnpSimulator t={trip} /></div>}
    </section>
  );
}

const CANCEL_REASONS: Record<string, string[]> = {
  Retailer: ["Ordered by mistake", "Duplicate order", "Found a better price locally", "Shop closed"],
  Seller: ["Out of stock at seller", "Price revision from company", "Item discontinued"],
  CDS: ["Pickup failed — seller unavailable", "Retailer not serviceable", "Damaged in transit"],
};

export function CancelDialog({ o, open, onOpenChange }: { o: CdsOrder; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [by, setBy] = useState<"Retailer" | "Seller" | "CDS">("Retailer");
  const [reason, setReason] = useState(CANCEL_REASONS.Retailer[0]);
  const [note, setNote] = useState("");
  const goodsMoved = !["Confirmed", "Pickup Requested"].includes(o.status);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel order {o.id}</DialogTitle>
          <DialogDescription>
            Current status: {o.status}.{" "}
            {goodsMoved
              ? "Goods have already left the seller — a return-to-seller case will be created."
              : "Goods have not been picked up — the order is removed from the pickup trip."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Cancelled by</Label>
            <FilterSelect
              value={by}
              onChange={(v) => {
                setBy(v as typeof by);
                setReason(CANCEL_REASONS[v][0]);
              }}
              options={["Retailer", "Seller", "CDS"].map((x) => ({ value: x, label: x }))}
              placeholder="Cancelled by"
              width="w-full"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Reason</Label>
            <FilterSelect value={reason} onChange={setReason} options={CANCEL_REASONS[by].map((x) => ({ value: x, label: x }))} placeholder="Reason" width="w-full" />
          </div>
          <div className="grid gap-1.5">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the seller or retailer should know" />
          </div>
          <p className="text-xs text-gray-600">Financial impact: {fmtINR(orderValue(o))} removed from the retailer bill.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep order</Button>
          <Button
            variant="destructive"
            onClick={() => {
              const ok = run(() => engine.cancelOrder(o.id, by, note ? `${reason} — ${note}` : reason), `Order ${o.id} cancelled`);
              if (ok !== undefined) onOpenChange(false);
            }}
          >
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
