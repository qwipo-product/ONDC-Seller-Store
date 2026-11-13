// Pickups — CDS-covered seller only.
//
// The CDS Service Centre collects the seller's cross-dock orders in fixed
// rounds and drops them at the Cross Dock Stores. This list shows every
// pickup planned for the seller: when it's due, which vehicle and driver
// are coming, what goes on it and where it drops. The handover itself
// (load check + pickup OTP) happens on the pickup's page.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Info, KeyRound, Package, Phone, Truck, Weight } from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { EmptyState } from "../../components/empty-state";
import { useAuth } from "../../lib/auth-context";
import { subscribeToOrders } from "../../lib/orders-data";
import {
  PICKUP_ROUNDS,
  SERVICE_CENTRE,
  type Pickup,
  dayLabel,
  formatKg,
  getPickups,
  isCdsSeller,
  pickupStores,
  pickupWeightKg,
  sortPickups,
  subscribeToPickups,
} from "../../lib/cross-dock-data";
import { PickupStatusBadge } from "./status-badge";

type PickupTab = "open" | "done";

export function Pickups() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeToPickups(() => setVersion((v) => v + 1)), []);
  useEffect(() => subscribeToOrders(() => setVersion((v) => v + 1)), []);
  const [tab, setTab] = useState<PickupTab>("open");

  const all = useMemo(() => {
    void version;
    return getPickups();
  }, [version]);
  const open = sortPickups(all.filter((p) => p.status === "SCHEDULED" || p.status === "ARRIVED"));
  const done = sortPickups(all.filter((p) => p.status === "PICKED_UP" || p.status === "RELEASED")).reverse();
  const rows = tab === "open" ? open : done;

  if (!isCdsSeller(user)) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-gray-50">
        <EmptyState
          icon={Truck}
          title="No pickups for your store"
          description="Pickups are for sellers whose retailers are covered by Cross Dock Stores. The Service Centre collects cross-dock orders from them in pickup rounds."
          action={<Button onClick={() => navigate("/orders")}>Go to Orders</Button>}
        />
      </div>
    );
  }

  const arrived = open.filter((p) => p.status === "ARRIVED").length;
  const ordersToHand = open.reduce((n, p) => n + p.orderIds.length, 0);
  const kgToLoad = Math.round(open.reduce((n, p) => n + pickupWeightKg(p), 0) * 10) / 10;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
          <div className="border-b border-gray-200 p-3 flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
            <Tabs value={tab} onValueChange={(v) => setTab(v as PickupTab)}>
              <TabsList className="bg-gray-100 p-1 rounded-lg inline-flex gap-1 h-auto">
                <TabsTrigger
                  value="open"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 whitespace-nowrap"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  <span className="font-medium">Upcoming ({open.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="done"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 whitespace-nowrap"
                >
                  <Package className="h-4 w-4 mr-2" />
                  <span className="font-medium">Completed ({done.length})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-gray-500">
              Collected by <span className="font-medium text-gray-700">{SERVICE_CENTRE.name}</span>
            </p>
          </div>

          {/* Summary strip — same shape as the Orders page's. */}
          <div className="px-6 py-2.5 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 via-white to-amber-50/40 flex-shrink-0 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Stat label="Driver at your store" value={arrived} tone={arrived ? "text-amber-700" : "text-gray-900"} />
            <span className="h-3 w-px bg-gray-200" />
            <Stat label="Orders to hand over" value={ordersToHand} />
            <span className="h-3 w-px bg-gray-200" />
            <Stat label="Weight to load" value={formatKg(kgToLoad)} />
            <span className="ml-auto text-[10px] text-gray-500 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Round 1 {PICKUP_ROUNDS.R1.window} · Round 2 {PICKUP_ROUNDS.R2.window} · Top-up {PICKUP_ROUNDS.EARLY_AM.window}
            </span>
          </div>

          <div className="px-6 py-3 border-b flex-shrink-0 text-xs text-gray-600 flex items-start gap-2">
            <KeyRound className="h-3.5 w-3.5 mt-0.5 text-indigo-600 shrink-0" />
            <p>
              When the driver arrives, open the pickup, tick each order as it goes on the vehicle, then give
              the driver the pickup OTP. The driver enters it in their app to confirm the pickup, and the orders
              move to <span className="font-medium">Picked up</span> in Orders → Cross-Dock.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <EmptyState
                icon={Truck}
                title={tab === "open" ? "No pickups due" : "No completed pickups yet"}
                description={
                  tab === "open"
                    ? "When you confirm cross-dock orders, the Service Centre plans a pickup and it shows up here."
                    : "Pickups move here once the driver has confirmed them with your OTP."
                }
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    {["Trip No", "Pickup", "Vehicle", "Driver", "Orders", "Load", "Drops at", "Status", ""].map((h, i) => (
                      <th
                        key={i}
                        className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap ${
                          h === "Orders" ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <PickupRow key={p.id} pickup={p} onOpen={() => navigate(`/pickups/${p.id}`)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-gray-900" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

function PickupRow({ pickup: p, onOpen }: { pickup: Pickup; onOpen: () => void }) {
  const kg = pickupWeightKg(p);
  const stores = pickupStores(p);
  const pct = Math.min(100, Math.round((kg / p.vehicle.capacityKg) * 100));
  const isOpen = p.status === "SCHEDULED" || p.status === "ARRIVED";
  return (
    <tr
      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
        p.status === "ARRIVED" ? "bg-amber-50/40" : ""
      }`}
      onClick={onOpen}
    >
      <td className="px-3 py-2.5 whitespace-nowrap">
        <code className="text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">{p.tripNo}</code>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <p className="text-sm font-medium text-gray-900">{PICKUP_ROUNDS[p.round].label}</p>
        <p className="text-[11px] text-gray-500">
          {dayLabel(p.date)} · {PICKUP_ROUNDS[p.round].window}
        </p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <p className="text-sm font-medium text-gray-900 font-mono">{p.vehicle.regNo}</p>
        <p className="text-[11px] text-gray-500">
          {p.vehicle.model} · {p.vehicle.type}
        </p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <p className="text-sm text-gray-900">{p.driver.name}</p>
        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          <Phone className="h-3 w-3" />
          {p.driver.phone}
        </p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-right">
        <p className="text-sm font-semibold text-gray-900 tabular-nums">{p.orderIds.length}</p>
        {p.heldBack.length > 0 && (
          <p className="text-[10px] text-amber-700">{p.heldBack.length} held back</p>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <p className="text-sm text-gray-900 tabular-nums flex items-center gap-1">
          <Weight className="h-3.5 w-3.5 text-gray-400" />
          {formatKg(kg)}
          <span className="text-[11px] text-gray-500">/ {formatKg(p.vehicle.capacityKg)}</span>
        </p>
        <div className="mt-1 h-1 w-28 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full ${pct > 90 ? "bg-red-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {stores.length === 0 ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            stores.map((s) => (
              <span
                key={s.code}
                className="inline-flex items-center px-2 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-[11px] font-medium text-indigo-700"
                title={s.name}
              >
                {s.shortName}
              </span>
            ))
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <PickupStatusBadge pickup={p} />
        <p className="text-[10px] text-gray-500 mt-1">
          {p.status === "SCHEDULED"
            ? `ETA ${p.eta}`
            : p.status === "ARRIVED"
              ? `Arrived ${p.arrivedAt?.split(", ")[1] ?? ""}`
              : p.status === "PICKED_UP"
                ? p.pickedUpAt
                : ""}
        </p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-right">
        <Button
          size="sm"
          variant={p.status === "ARRIVED" ? "default" : "ghost"}
          className={`gap-1.5 h-8 ${p.status === "ARRIVED" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {p.status === "ARRIVED" ? "Hand over" : isOpen ? "Open" : "View"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
