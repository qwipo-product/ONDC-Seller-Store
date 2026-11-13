// Pickup handover — CDS-covered seller only.
//
// 1. The Service Centre's driver reports at the seller's store.
// 2. The seller checks the load: each order is ticked as it goes on the
//    vehicle (a product view gives the totals to pick). An order that
//    isn't ready is held back and rides the next pickup instead.
// 3. With everything loaded, the seller reveals the pickup OTP and tells
//    the driver.
// 4. The driver enters it in their app, which closes the pickup; the
//    orders move to "Picked up" on their way to the Cross Dock Stores.
//
// The driver's app is a separate product, so step 4 is simulated in a
// clearly marked "Driver app (demo)" panel, the same way the Logistics
// Tech demo simulates the store's OTP at the drop.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Eye,
  KeyRound,
  Lock,
  MapPin,
  Package,
  PauseCircle,
  Phone,
  Smartphone,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { EmptyState } from "../../components/empty-state";
import { useAuth } from "../../lib/auth-context";
import { type Order, getOrders, subscribeToOrders } from "../../lib/orders-data";
import {
  PICKUP_ROUNDS,
  PickupRuleError,
  SERVICE_CENTRE,
  dayLabel,
  driverEntersOtp,
  formatKg,
  getPickup,
  getRouteInfo,
  holdBackOrder,
  isCdsSeller,
  markDriverArrived,
  orderUnits,
  orderWeightKg,
  pickupProducts,
  pickupStores,
  pickupWeightKg,
  setAllLoaded,
  setOrderLoaded,
  showPickupOtp,
  subscribeToPickups,
} from "../../lib/cross-dock-data";
import { PickupStatusBadge } from "./status-badge";

const HOLD_REASONS = [
  "Stock not ready",
  "Packing not complete",
  "Retailer asked to hold",
  "Other",
];

export function PickupDetail() {
  const { pickupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeToPickups(() => setVersion((v) => v + 1)), []);
  useEffect(() => subscribeToOrders(() => setVersion((v) => v + 1)), []);

  const pickup = useMemo(() => {
    void version;
    return getPickup(pickupId);
  }, [pickupId, version]);
  const orders = useMemo(() => {
    void version;
    if (!pickup) return [] as Order[];
    const byId = new Map(getOrders().map((o) => [o.id, o]));
    return pickup.orderIds.map((id) => byId.get(id)).filter((o): o is Order => !!o);
  }, [pickup, version]);
  const heldOrders = useMemo(() => {
    void version;
    const byId = new Map(getOrders().map((o) => [o.id, o]));
    return (pickup?.heldBack ?? []).map((h) => ({ ...h, order: byId.get(h.orderId) }));
  }, [pickup, version]);

  const [holdTarget, setHoldTarget] = useState<Order | null>(null);
  const [holdReason, setHoldReason] = useState(HOLD_REASONS[0]);
  const [holdNote, setHoldNote] = useState("");
  const [driverOtp, setDriverOtp] = useState("");
  const [driverError, setDriverError] = useState<string | null>(null);

  if (!isCdsSeller(user) || !pickup) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-gray-50">
        <EmptyState
          icon={Truck}
          title="Pickup not found"
          description="This pickup doesn't exist or isn't one of yours."
          action={<Button onClick={() => navigate("/pickups")}>Back to Pickups</Button>}
        />
      </div>
    );
  }

  const round = PICKUP_ROUNDS[pickup.round];
  const kg = pickupWeightKg(pickup);
  const stores = pickupStores(pickup);
  const products = pickupProducts(pickup);
  const loaded = pickup.orderIds.filter((id) => pickup.loadedIds.includes(id)).length;
  const allLoaded = pickup.orderIds.length > 0 && loaded === pickup.orderIds.length;
  const closed = pickup.status === "PICKED_UP" || pickup.status === "RELEASED";
  const loadLocked = closed || pickup.otpShown;
  const value = orders.reduce((n, o) => n + o.orderValue, 0);

  // Steps: driver arrives → check the load → give OTP → picked up.
  const step =
    pickup.status === "PICKED_UP"
      ? 4
      : pickup.otpShown
        ? 3
        : pickup.status === "ARRIVED"
          ? 2
          : 1;
  const STEPS = [
    "Driver arrives",
    "Check the load",
    "Give OTP to driver",
    "Picked up",
  ];

  const run = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      if (e instanceof PickupRuleError) toast.error(e.message);
      else throw e;
    }
  };

  const confirmHold = () => {
    if (!holdTarget) return;
    const reason = holdReason === "Other" ? holdNote.trim() || "Other" : holdReason;
    run(() => {
      const target = holdBackOrder(pickup.id, holdTarget.id, reason);
      toast.success(`${holdTarget.retailerName} held back.`, {
        description: `It moves to the ${PICKUP_ROUNDS[target.round].label} pickup ${target.tripNo} (${dayLabel(target.date)}, ${PICKUP_ROUNDS[target.round].window}).`,
      });
      setHoldTarget(null);
      setHoldNote("");
      setHoldReason(HOLD_REASONS[0]);
    });
  };

  const submitDriverOtp = () => {
    try {
      const done = driverEntersOtp(pickup.id, driverOtp);
      setDriverError(null);
      setDriverOtp("");
      toast.success(`Pickup ${done.tripNo} confirmed by ${done.driver.name}.`, {
        description: `${done.orderIds.length} order${done.orderIds.length === 1 ? " is" : "s are"} on the way to the Cross Dock Store${stores.length === 1 ? "" : "s"}.`,
      });
    } catch (e) {
      if (e instanceof PickupRuleError) setDriverError(e.message);
      else throw e;
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Sticky header — same shape as the order detail page. */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/pickups")} className="gap-1.5 h-8">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900">Pickup {pickup.tripNo}</h1>
                <PickupStatusBadge pickup={pickup} className="text-sm px-3 py-0.5" />
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {round.label} · {dayLabel(pickup.date)} · {round.window} · {SERVICE_CENTRE.name}
              </p>
            </div>
          </div>
          {pickup.status === "SCHEDULED" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => markDriverArrived(pickup.id)}
              title="Demo: stands in for the driver reporting at your gate"
            >
              <MapPin className="h-3.5 w-3.5" />
              Driver has arrived (demo)
            </Button>
          )}
        </div>
        {/* Progress */}
        {pickup.status !== "RELEASED" && (
          <div className="px-4 pb-2.5 flex items-center gap-2 overflow-x-auto">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step || (n === 4 && step === 4);
              const current = n === step && step !== 4;
              return (
                <div key={label} className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                      done
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : current
                          ? "bg-amber-50 text-amber-800 border-amber-300 font-medium"
                          : "bg-white text-gray-500 border-gray-200"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {n}. {label}
                  </span>
                  {n < STEPS.length && <span className="h-px w-4 bg-gray-300" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Vehicle / driver / drops */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-3 text-sm space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-indigo-600" />
                Vehicle
              </p>
              <p className="font-semibold text-gray-900 font-mono">{pickup.vehicle.regNo}</p>
              <p className="text-xs text-gray-600">
                {pickup.vehicle.model} · {pickup.vehicle.type} · up to {formatKg(pickup.vehicle.capacityKg)}
              </p>
              <div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Load</span>
                  <span className="tabular-nums">
                    {formatKg(kg)} of {formatKg(pickup.vehicle.capacityKg)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full ${kg > pickup.vehicle.capacityKg * 0.9 ? "bg-red-500" : "bg-indigo-500"}`}
                    style={{ width: `${Math.min(100, Math.round((kg / pickup.vehicle.capacityKg) * 100))}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-sm space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
                Driver
              </p>
              <p className="font-semibold text-gray-900">{pickup.driver.name}</p>
              <p className="text-xs text-gray-700 flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-gray-400" />
                <a href={`tel:${pickup.driver.phone}`} className="hover:underline">
                  {pickup.driver.phone}
                </a>
              </p>
              <p className="text-xs text-gray-600">
                {pickup.status === "SCHEDULED"
                  ? `Expected around ${pickup.eta}`
                  : pickup.arrivedAt
                    ? `Arrived ${pickup.arrivedAt}`
                    : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-sm space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                Drops at
              </p>
              {stores.length === 0 ? (
                <p className="text-xs text-gray-500">No orders on this pickup.</p>
              ) : (
                <ul className="space-y-1">
                  {stores.map((s) => {
                    const n = orders.filter((o) => getRouteInfo(o).store?.code === s.code).length;
                    return (
                      <li key={s.code} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-900 font-medium truncate">{s.name}</span>
                        <span className="text-gray-500 shrink-0">
                          {n} order{n === 1 ? "" : "s"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-[11px] text-gray-500">The store&rsquo;s riders deliver to the retailers.</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-3 items-start">
          {/* Load check */}
          <Card className="lg:col-span-2 gap-0">
            <CardHeader className="pt-2.5 pb-2.5! px-3 border-b border-gray-100">
              <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600" />
                  Load check
                  <span className="text-xs font-normal text-gray-500">
                    {orders.length} order{orders.length === 1 ? "" : "s"} · {formatKg(kg)} · ₹{value.toLocaleString("en-IN")}
                  </span>
                </span>
                {!loadLocked && orders.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setAllLoaded(pickup.id, !allLoaded)}
                  >
                    {allLoaded ? "Untick all" : "Tick all as loaded"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-0!">
              <Tabs defaultValue="orders" className="gap-0">
                <div className="px-3 pt-2.5">
                  <TabsList className="bg-gray-100 p-1 rounded-lg h-auto">
                    <TabsTrigger value="orders" className="data-[state=active]:bg-white rounded-md px-3 py-1.5 text-xs">
                      Order view ({orders.length})
                    </TabsTrigger>
                    <TabsTrigger value="products" className="data-[state=active]:bg-white rounded-md px-3 py-1.5 text-xs">
                      Product view ({products.length})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="orders" className="mt-2">
                  {orders.length === 0 ? (
                    <p className="px-3 pb-4 text-sm text-gray-500">No orders left on this pickup.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-100">
                          <tr>
                            {["Loaded", "Order ID", "Retailer", "Cross Dock Store", "Units", "Weight", "Value", ""].map((h, i) => (
                              <th
                                key={i}
                                className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap ${
                                  h === "Units" || h === "Weight" || h === "Value" ? "text-right" : "text-left"
                                }`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o) => {
                            const isLoaded = pickup.loadedIds.includes(o.id);
                            return (
                              <tr
                                key={o.id}
                                className={`border-b border-gray-100 ${isLoaded ? "bg-emerald-50/40" : ""}`}
                              >
                                <td className="px-3 py-2">
                                  <Checkbox
                                    checked={isLoaded || pickup.status === "PICKED_UP"}
                                    disabled={loadLocked}
                                    onCheckedChange={(c) => setOrderLoaded(pickup.id, o.id, c === true)}
                                    aria-label={`Loaded ${o.retailerName}`}
                                  />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <button
                                    className="text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono hover:bg-gray-200"
                                    onClick={() => navigate(`/orders/${o.id}`)}
                                    title="Open the order"
                                  >
                                    {o.id}
                                  </button>
                                </td>
                                <td className="px-3 py-2">
                                  <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{o.retailerName}</p>
                                  <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{o.itemsSummary}</p>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-indigo-700">
                                  {getRouteInfo(o).store?.shortName ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-right text-sm tabular-nums">{orderUnits(o)}</td>
                                <td className="px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap">{formatKg(orderWeightKg(o))}</td>
                                <td className="px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap">₹{o.orderValue.toLocaleString("en-IN")}</td>
                                <td className="px-3 py-2 text-right">
                                  {!loadLocked && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 gap-1 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                                      onClick={() => setHoldTarget(o)}
                                    >
                                      <PauseCircle className="h-3.5 w-3.5" />
                                      Hold back
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="products" className="mt-2">
                  <p className="px-3 pb-2 text-[11px] text-gray-500">
                    Totals to pick across every order on this pickup.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-y border-gray-100">
                        <tr>
                          {["SKU", "Product", "Company", "Quantity", "In orders", "Weight"].map((h) => (
                            <th
                              key={h}
                              className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap ${
                                h === "Quantity" || h === "In orders" || h === "Weight" ? "text-right" : "text-left"
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={p.skuCode} className="border-b border-gray-100">
                            <td className="px-3 py-2 text-[11px] font-mono text-gray-600 whitespace-nowrap">{p.skuCode}</td>
                            <td className="px-3 py-2 text-sm text-gray-900">{p.productName}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{p.company}</td>
                            <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">{p.qty}</td>
                            <td className="px-3 py-2 text-right text-sm tabular-nums">{p.orders}</td>
                            <td className="px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap">{formatKg(p.weightKg)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>

              {heldOrders.length > 0 && (
                <div className="border-t border-gray-100 px-3 py-2.5 bg-amber-50/40">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <PauseCircle className="h-3.5 w-3.5" />
                    Held back from this pickup
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {heldOrders.map((h) => (
                      <li key={h.orderId} className="text-xs text-gray-700 flex flex-wrap gap-x-2">
                        <span className="font-medium">{h.order?.retailerName ?? h.orderId}</span>
                        <span className="text-gray-500">· {h.reason}</span>
                        <span className="text-gray-500">· moved to {h.movedToTripNo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Handover OTP + simulated driver app */}
          <div className="space-y-3">
            <Card className="gap-0">
              <CardHeader className="pt-2.5 pb-2.5! px-3 border-b border-gray-100">
                <CardTitle className="text-sm flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-indigo-600" />
                  Pickup OTP
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 text-sm space-y-3">
                {pickup.status === "PICKED_UP" ? (
                  <div className="flex items-start gap-2 text-emerald-800">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Picked up</p>
                      <p className="text-xs text-emerald-900/80 mt-0.5">
                        {pickup.driver.name} confirmed the pickup with your OTP at {pickup.pickedUpAt}. The orders are on
                        their way to the Cross Dock Store{stores.length === 1 ? "" : "s"}.
                      </p>
                    </div>
                  </div>
                ) : pickup.status === "RELEASED" ? (
                  <p className="text-xs text-gray-600">
                    Every order was held back, so there was nothing to hand over and the vehicle was released.
                  </p>
                ) : pickup.otpShown ? (
                  <>
                    <div className="flex justify-center gap-2" aria-label={`Pickup OTP ${pickup.otp}`}>
                      {pickup.otp.split("").map((d, i) => (
                        <span
                          key={i}
                          className="h-12 w-10 rounded-md border-2 border-indigo-300 bg-indigo-50 text-2xl font-bold text-indigo-800 flex items-center justify-center tabular-nums"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 text-center">
                      Tell {pickup.driver.name} this OTP. The pickup closes when they enter it in their app.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-center gap-2">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="h-12 w-10 rounded-md border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center"
                        >
                          <Lock className="h-4 w-4 text-gray-300" />
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p className="flex items-center gap-1.5">
                        {pickup.status === "ARRIVED" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-gray-300" />
                        )}
                        Driver at your store
                        {pickup.status === "SCHEDULED" && <span className="text-gray-400">· ETA {pickup.eta}</span>}
                      </p>
                      <p className="flex items-center gap-1.5">
                        {allLoaded ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-gray-300" />
                        )}
                        Every order loaded ({loaded} of {pickup.orderIds.length})
                      </p>
                    </div>
                    <Button
                      className="w-full gap-2"
                      disabled={pickup.status !== "ARRIVED" || !allLoaded}
                      onClick={() => run(() => showPickupOtp(pickup.id))}
                    >
                      <Eye className="h-4 w-4" />
                      Show pickup OTP
                    </Button>
                    <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-px" />
                      Give the OTP only after every order is on the vehicle. Once it&rsquo;s shown, the load can&rsquo;t be changed.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {pickup.status === "ARRIVED" && pickup.otpShown && (
              <Card className="gap-0 border-dashed border-gray-300 bg-white/70">
                <CardHeader className="pt-2.5 pb-2.5! px-3 border-b border-gray-100">
                  <CardTitle className="text-sm flex items-center gap-2 text-gray-700">
                    <Smartphone className="h-4 w-4 text-gray-500" />
                    Driver app (demo)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  <p className="text-[11px] text-gray-500">
                    In real use {pickup.driver.name} types the OTP in the Service Centre driver app. This panel stands in
                    for it.
                  </p>
                  <Label htmlFor="driver-otp" className="text-xs">
                    OTP from the seller
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="driver-otp"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="4-digit OTP"
                      value={driverOtp}
                      onChange={(e) => {
                        setDriverOtp(e.target.value.replace(/\D/g, ""));
                        setDriverError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && driverOtp.length === 4) submitDriverOtp();
                      }}
                      aria-invalid={!!driverError}
                    />
                    <Button disabled={driverOtp.length !== 4} onClick={submitDriverOtp} className="shrink-0">
                      Confirm pickup
                    </Button>
                  </div>
                  {driverError && <p className="text-xs text-red-600">{driverError}</p>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Hold back an order — it rides the next pickup instead. */}
      <Dialog open={!!holdTarget} onOpenChange={(o) => !o && setHoldTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-amber-600" />
              Hold back this order?
            </DialogTitle>
            <DialogDescription>
              {holdTarget?.retailerName} ({holdTarget?.id}) stays with you and goes on the next pickup instead of this
              one. Delivery to the retailer may move by a day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Select value={holdReason} onValueChange={setHoldReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLD_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {holdReason === "Other" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Details</Label>
                <Textarea
                  value={holdNote}
                  onChange={(e) => setHoldNote(e.target.value)}
                  placeholder="Why is this order not going today?"
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldTarget(null)}>
              Keep on this pickup
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={holdReason === "Other" && !holdNote.trim()}
              onClick={confirmHold}
            >
              Hold back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
