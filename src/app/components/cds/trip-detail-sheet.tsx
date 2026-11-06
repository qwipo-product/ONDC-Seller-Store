// Cross Dock Store (CDS) — LBNP trip detail panel + dispatch handover.
//
// Trips belong to LBNP. CDS sees stop-by-stop progress and performs
// only the CDS-side steps: inward on arrival, and handover to the
// rider (OTP confirmed in the FA App) for delivery / transfer trips.
// The "Simulate LBNP update" block stands in for live LBNP / FA App
// events in this prototype.

import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Clock, KeyRound, MapPin, PackageCheck, Phone, Truck, XCircle, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../ui/utils";
import { fmtDateTime, fmtTime } from "../../lib/cds/calc";
import { engine, run } from "../../lib/cds/store";
import type { CdsTrip } from "../../lib/cds/types";
import { Mono, Pill, TripStatusPill, useCdsScope } from "./cds-ui";

const FAIL_REASONS = ["Shop closed — shutter down at delivery time", "Retailer not reachable on phone", "Cash not ready with retailer", "Retailer asked to deliver tomorrow"];

export function TripDetailSheet({
  tripId,
  onClose,
  onOpenOrder,
}: {
  tripId: string | null;
  onClose: () => void;
  onOpenOrder?: (id: string) => void;
}) {
  const { s, sellerName, retailerName, cdsName } = useCdsScope();
  const navigate = useNavigate();
  const t = tripId ? s.trips.find((x) => x.id === tripId) : undefined;
  const [handover, setHandover] = useState(false);

  return (
    <Sheet open={!!tripId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 gap-0">
        {t && (
          <>
            <SheetHeader className="border-b border-gray-200 p-5 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <TripStatusPill status={t.status} />
                <Pill tone={t.kind === "Pickup" ? "indigo" : t.kind === "Transfer" ? "purple" : "blue"}>
                  {t.kind === "Pickup" ? "Multi-pickup · seller → CDS" : t.kind === "Transfer" ? `Transfer → ${cdsName(t.targetCdsId!)}` : "Multi-delivery · CDS → retailers"}
                </Pill>
              </div>
              <SheetTitle className="mt-2 font-mono text-base">{t.id}</SheetTitle>
              <SheetDescription className="text-xs">
                LBNP trip · {cdsName(t.cdsId)} · {t.stops.length} stop(s) · ~{t.distanceKm} km · {t.slot}
              </SheetDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {t.kind === "Pickup" && t.status === "Arrived at CDS" && (
                  <Button size="sm" className="gap-1.5" onClick={() => navigate(`/cds/inward?trip=${t.id}`)}>
                    <PackageCheck className="h-4 w-4" /> Start inward check
                  </Button>
                )}
                {t.kind !== "Pickup" && t.status === "Rider Assigned" && (
                  <Button size="sm" className="gap-1.5" onClick={() => setHandover(true)}>
                    <KeyRound className="h-4 w-4" /> Hand over to rider
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <section className="grid gap-3 sm:grid-cols-2 text-xs text-gray-600">
                <div className="rounded-lg border border-gray-200 p-3 space-y-0.5">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Rider (FA App)</p>
                  {t.rider ? (
                    <>
                      <p className="font-medium text-gray-900">{t.rider.name}</p>
                      <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{t.rider.phone}</p>
                      <p className="flex items-center gap-1"><Truck className="h-3 w-3" />{t.rider.vehicle}</p>
                    </>
                  ) : (
                    <p>Waiting for LBNP to assign a rider</p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 p-3 space-y-0.5">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Timeline</p>
                  <p>Requested {fmtDateTime(t.requestedAt)}</p>
                  {t.assignedAt && <p>Rider assigned {fmtTime(t.assignedAt)}</p>}
                  {t.handoverAt && <p>Handover at CDS {fmtTime(t.handoverAt)} · OTP {t.handoverOtp} · {t.handoverUnits} units</p>}
                  {t.startedAt && !t.handoverAt && <p>Started {fmtTime(t.startedAt)}</p>}
                  {t.arrivedAt && <p>Arrived at CDS {fmtTime(t.arrivedAt)}</p>}
                  {t.completedAt && <p>Completed {fmtTime(t.completedAt)}</p>}
                  {t.note && <p className="text-gray-500">Note: {t.note}</p>}
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Stops</h4>
                <ol className="space-y-2">
                  {t.stops.map((st) => (
                    <li key={st.id} className={cn("rounded-lg border p-3", st.status === "Failed" ? "border-red-200 bg-red-50" : "border-gray-200")}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                              st.status === "Done" ? "bg-green-500 text-white" : st.status === "Failed" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700",
                            )}
                          >
                            {st.seq}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {st.type === "Pickup" ? sellerName(st.sellerId!) : st.type === "Transfer Drop" ? `${cdsName(st.targetCdsId!)} (for ${retailerName(st.retailerId!)})` : retailerName(st.retailerId!)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {st.type} · {st.orderIds.length} order(s) · {st.expectedUnits} units
                              {st.collectedUnits !== undefined && st.collectedUnits !== st.expectedUnits && (
                                <span className="font-semibold text-amber-700"> · collected {st.collectedUnits}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          {st.status === "Done" ? (
                            <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />{fmtTime(st.doneAt)}</span>
                          ) : st.status === "Failed" ? (
                            <span className="inline-flex items-center gap-1 text-red-700"><XCircle className="h-3.5 w-3.5" />Failed {fmtTime(st.doneAt)}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-600"><Clock className="h-3.5 w-3.5" />ETA {fmtTime(st.eta)}</span>
                          )}
                          {st.otpVerified && <p className="text-gray-500">{st.type === "Pickup" ? "Seller OTP ✓" : `Retailer OTP ✓ · ${st.podRef}`}</p>}
                        </div>
                      </div>
                      {(st.exception || st.failReason) && (
                        <p className="mt-2 text-xs text-amber-800">{st.exception ?? st.failReason}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {st.orderIds.map((id) => (
                          <button key={id} type="button" onClick={() => onOpenOrder?.(id)} className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700 hover:bg-blue-50">
                            {id}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <LbnpSimulator t={t} />
            </div>
            <HandoverDialog t={t} open={handover} onOpenChange={setHandover} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function LbnpSimulator({ t }: { t: CdsTrip }) {
  const { s: state } = useCdsScope();
  const lineFor = (orderId: string) => state.orders.find((o) => o.id === orderId)?.lines.find((l) => l.confirmedQty >= 1)?.sku;
  const pending = t.stops.find((x) => x.status === "Pending");
  const actions: { label: string; fn: () => void; variant?: "outline" | "destructive" }[] = [];
  if (t.status === "Requested") {
    actions.push({ label: "LBNP assigns rider", fn: () => run(() => engine.lbnpAssignRider(t.id), "Rider assigned by LBNP") });
  } else if (t.kind === "Pickup" && (t.status === "Rider Assigned" || t.status === "In Progress")) {
    if (pending) {
      actions.push({ label: "Rider picks up next seller (OTP ✓)", fn: () => run(() => engine.lbnpCompletePickupStop(t.id, pending.id), "Pickup confirmed with seller OTP") });
      const firstOrder = pending.orderIds[0];
      const firstLine = lineFor(firstOrder);
      if (firstLine) {
        actions.push({
          label: "Partial pickup (1 unit short)",
          variant: "outline",
          fn: () => run(() => engine.lbnpCompletePickupStop(t.id, pending.id, { shortLines: [{ orderId: firstOrder, sku: firstLine, qty: 1 }] }), "Partial pickup recorded"),
        });
      }
    } else {
      actions.push({ label: "Vehicle arrives at CDS", fn: () => run(() => engine.lbnpArriveAtCds(t.id), "Vehicle arrived — ready for inward") });
    }
  } else if (t.status === "In Progress" && pending) {
    if (t.kind === "Transfer") {
      actions.push({ label: "Arrives at target CDS", fn: () => run(() => engine.lbnpCompleteDropStop(t.id, pending.id, { delivered: true }), "Transfer received at target CDS") });
    } else {
      actions.push({ label: "Deliver next stop (OTP ✓)", fn: () => run(() => engine.lbnpCompleteDropStop(t.id, pending.id, { delivered: true }), "Delivered — retailer OTP verified") });
      actions.push({ label: "Deliver, QR payment fails", variant: "outline", fn: () => run(() => engine.lbnpCompleteDropStop(t.id, pending.id, { delivered: true, qrFailed: true }), "Delivered — QR payment failed") });
      actions.push({
        label: "Fail next stop",
        variant: "destructive",
        fn: () => run(() => engine.lbnpCompleteDropStop(t.id, pending.id, { delivered: false, reason: FAIL_REASONS[Math.floor(Math.random() * FAIL_REASONS.length)] }), "Delivery attempt failed"),
      });
    }
  }
  if (!actions.length) return null;
  return (
    <section className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <Zap className="h-3.5 w-3.5" /> Simulate LBNP / FA App update (prototype only)
      </p>
      <p className="mt-0.5 text-xs text-amber-800">In production these events arrive from LBNP and the FA App. Use them here to move the trip forward.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} size="sm" variant={a.variant ?? "default"} onClick={a.fn}>
            {a.label}
          </Button>
        ))}
      </div>
    </section>
  );
}

export function HandoverDialog({ t, open, onOpenChange }: { t: CdsTrip; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { retailerName, cdsName } = useCdsScope();
  const expected = t.stops.reduce((s, x) => s + x.expectedUnits, 0);
  const [units, setUnits] = useState(expected);
  const [otp] = useState(() => String(1000 + Math.floor(Math.random() * 9000)));
  const [riderConfirmed, setRiderConfirmed] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setRiderConfirmed(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hand over {t.id} to {t.rider?.name}</DialogTitle>
          <DialogDescription>
            Count the crates against the list, share the OTP with the rider, and complete the handover once the rider confirms it in the FA App.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 text-xs">
            {t.stops.map((st) => (
              <li key={st.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-gray-400" />
                  {st.seq}. {st.type === "Transfer Drop" ? `${cdsName(st.targetCdsId!)} · ${retailerName(st.retailerId!)}` : retailerName(st.retailerId!)}
                </span>
                <span className="tabular-nums text-gray-600">{st.expectedUnits} units</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="units">Units verified</Label>
              <Input id="units" type="number" value={units} onChange={(e) => setUnits(Number(e.target.value) || 0)} />
              <p className={cn("text-xs", units === expected ? "text-gray-500" : "text-amber-700")}>Expected {expected}</p>
            </div>
            <div className="grid gap-1.5">
              <Label>Handover OTP for rider</Label>
              <div className="flex h-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 font-mono text-lg font-semibold tracking-[0.3em] text-blue-700">{otp}</div>
              <button type="button" onClick={() => setRiderConfirmed(true)} className="text-left text-xs text-blue-700 underline">
                {riderConfirmed ? "✓ Rider confirmed OTP in FA App" : "Simulate: rider enters OTP in FA App"}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!riderConfirmed || units <= 0}
            onClick={() => {
              const ok = run(() => engine.confirmHandover(t.id, units, undefined, otp), `${t.id} handed over — ${t.kind === "Transfer" ? "in transfer" : "out for delivery"}`);
              if (ok !== undefined) onOpenChange(false);
            }}
          >
            Complete handover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
