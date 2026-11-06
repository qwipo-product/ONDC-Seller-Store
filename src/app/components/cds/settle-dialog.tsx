// Seller-side "Mark settled" — the same button and confirm box on every
// screen (Orders · CDS tab, Returns, Payments, order panel).
//
// The button is always shown. It stays disabled (hover says why) until
// the delivery partner / payout updates make the order or return ready,
// and turns into a "Settled" tag once the seller confirms.

import { useState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { fmtINR, orderMoney, paymentSettleCheck, pickupSettleCheck, returnSettleCheck, type SettleCheck } from "../../lib/cds/calc";
import { engine, run, useCds } from "../../lib/cds/store";
import type { CdsOrder, ReturnCase } from "../../lib/cds/types";
import { cn } from "../ui/utils";
import { Pill } from "./cds-ui";

export function SettleConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" /> {title}
          </DialogTitle>
          <DialogDescription>Once marked settled it is closed on your side and can't be changed.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Not yet</Button>
          <Button className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={onConfirm}>
            <CheckCircle2 className="h-4 w-4" /> Yes, mark settled
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Always-visible row button: enabled when ready, disabled with the reason, "Settled" once done. */
export function SettleButton({ check, onClick, className }: { check: SettleCheck; onClick: () => void; className?: string }) {
  if (check.done) {
    return (
      <span className={cn("inline-flex h-7 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700", className)}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Settled
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!check.ready}
      title={check.ready ? "Mark as settled" : check.reason}
      className={cn("h-7 gap-1 px-2 text-xs disabled:pointer-events-auto disabled:cursor-not-allowed", check.ready && "border-green-300 text-green-700 hover:bg-green-50", className)}
      onClick={(e) => {
        e.stopPropagation();
        if (check.ready) onClick();
      }}
    >
      <CheckCircle2 className="h-3.5 w-3.5" /> Mark settled
    </Button>
  );
}

export function SettledPill() {
  return <Pill tone="green">Settled</Pill>;
}

/** Pickup settled tag — says when the system marked it because the seller missed it. */
export function PickupSettledPill({ o }: { o: CdsOrder }) {
  if (!o.pickupSettledAt) return null;
  return o.pickupSettledBy === "system" ? (
    <span title="You didn't mark it — the system settled it when the delivery app updated the order">
      <Pill tone="gray">Pickup settled · System</Pill>
    </span>
  ) : (
    <Pill tone="green">Pickup settled · By you</Pill>
  );
}

/** Mark settled for one order's payment (button + confirm). */
export function PaymentSettleAction({ o, retailer }: { o: CdsOrder; retailer: string }) {
  const s = useCds();
  const [open, setOpen] = useState(false);
  const check = paymentSettleCheck(o, s);
  const payout = orderMoney(o, s).payout;
  // Clicks inside the dialog must not reach the table row (React bubbles through portals).
  return (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <SettleButton check={check} onClick={() => setOpen(true)} />
      {open && (
        <SettleConfirmDialog
          open
          onOpenChange={setOpen}
          title="Mark payment as settled?"
          onConfirm={() => {
            const ok = run(() => engine.sellerSettlePayment(o.id), `${o.id} marked settled`);
            if (ok !== undefined) setOpen(false);
          }}
        >
          <p className="font-medium text-gray-900"><span className="font-mono text-xs">{o.id}</span> · {retailer}</p>
          <p className="mt-1 text-xs text-gray-500">Confirm you received {fmtINR(payout)} and nothing is pending on this order.</p>
        </SettleConfirmDialog>
      )}
    </span>
  );
}

/** Mark settled for the pickup handover (button + confirm). */
export function PickupSettleAction({ o, retailer }: { o: CdsOrder; retailer: string }) {
  const s = useCds();
  const [open, setOpen] = useState(false);
  const units = o.lines.reduce((x, l) => x + (l.pickedQty ?? l.confirmedQty), 0);
  // Clicks inside the dialog must not reach the table row (React bubbles through portals).
  return (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <SettleButton check={pickupSettleCheck(o, s)} onClick={() => setOpen(true)} />
      {open && (
        <SettleConfirmDialog
          open
          onOpenChange={setOpen}
          title="Mark pickup as settled?"
          onConfirm={() => {
            const ok = run(() => engine.sellerSettlePickup(o.id), `${o.id} pickup marked settled`);
            if (ok !== undefined) setOpen(false);
          }}
        >
          <p className="font-medium text-gray-900"><span className="font-mono text-xs">{o.id}</span> · {retailer}</p>
          <p className="mt-1 text-xs text-gray-500">Confirm the pickup agent collected {units} units after OTP and nothing is pending at your end.</p>
        </SettleConfirmDialog>
      )}
    </span>
  );
}

/** Mark settled for one return (button + confirm). */
export function ReturnSettleAction({ r, retailer }: { r: ReturnCase; retailer: string }) {
  const [open, setOpen] = useState(false);
  // Clicks inside the dialog must not reach the table row (React bubbles through portals).
  return (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <SettleButton check={returnSettleCheck(r)} onClick={() => setOpen(true)} />
      {open && (
        <SettleConfirmDialog
          open
          onOpenChange={setOpen}
          title="Mark return as settled?"
          onConfirm={() => {
            const ok = run(() => engine.sellerSettleReturn(r.id), `${r.id} marked settled`);
            if (ok !== undefined) setOpen(false);
          }}
        >
          <p className="font-medium text-gray-900">{r.id} · {retailer}</p>
          <p>{r.items.map((i) => `${i.qty} × ${i.name}`).join(", ")} · {fmtINR(r.value)}</p>
          <p className="mt-1 text-xs text-gray-500">Confirm the goods are back with you and the {fmtINR(r.value)} deduction is accepted.</p>
        </SettleConfirmDialog>
      )}
    </span>
  );
}
