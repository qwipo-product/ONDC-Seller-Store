// Delivery route card on the order detail page, for the CDS-covered
// seller. Cross-dock orders show their journey (pickup → Cross Dock Store
// → rider → retailer); 3PL Direct orders say why they're direct and who
// delivers them.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Circle, Route, Truck } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import type { Order } from "../lib/orders-data";
import {
  STAGE_META,
  getCrossDockStage,
  getCrossDockTimeline,
  getPickupForOrder,
  getRouteInfo,
  subscribeToPickups,
} from "../lib/cross-dock-data";

export function CrossDockRouteCard({ order }: { order: Order }) {
  const navigate = useNavigate();
  // Pickup progress changes the stage without an order write.
  const [, setVersion] = useState(0);
  useEffect(() => subscribeToPickups(() => setVersion((v) => v + 1)), []);

  const info = getRouteInfo(order);

  if (info.route === "direct") {
    return (
      <Card>
        <CardContent className="p-3 flex items-start gap-3 text-sm">
          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4 text-slate-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">3PL Direct delivery</p>
            <p className="text-xs text-gray-600 mt-0.5">{info.reason}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {order.status === "New"
                ? "Once confirmed it moves to Orders → 3PL Direct, where you deliver it yourself or request 3PL Logistics."
                : order.status === "Confirmed" && order.logisticsRequested
                  ? "With your 3PL partner. It moves to Delivered once the partner completes it."
                  : order.status === "Confirmed"
                    ? "Deliver it yourself or request 3PL Logistics from Orders → 3PL Direct."
                    : "Delivered directly."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const store = info.store;

  if (order.status === "New") {
    return (
      <Card>
        <CardContent className="p-3 flex items-start gap-3 text-sm">
          <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
            <Route className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">
              Cross-Dock delivery via {store?.name}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{info.reason}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Once you confirm it, the Service Centre collects it from you on the next
              pickup round. You hand it over with the pickup OTP, and the store&rsquo;s
              rider delivers it.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stage = getCrossDockStage(order);
  const steps = getCrossDockTimeline(order);
  const pickup = getPickupForOrder(order.id);
  const pickupOpen = pickup && (pickup.status === "SCHEDULED" || pickup.status === "ARRIVED");

  return (
    <Card className="gap-0">
      <CardContent className="p-3 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
              <Route className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                Cross-Dock delivery via {store?.name}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${STAGE_META[stage].className}`}
                >
                  {STAGE_META[stage].label}
                </span>
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{info.reason}</p>
            </div>
          </div>
          {pickupOpen && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              onClick={() => navigate(`/pickups/${pickup.id}`)}
            >
              <Truck className="h-3.5 w-3.5" />
              {pickup.status === "ARRIVED" ? "Hand over to driver" : "View pickup"}
            </Button>
          )}
        </div>

        <ol className="grid gap-2 md:grid-cols-5">
          {steps.map((s) => (
            <li
              key={s.key}
              className={`rounded-md border p-2.5 ${
                s.state === "done"
                  ? "border-emerald-200 bg-emerald-50/50"
                  : s.state === "current"
                    ? "border-amber-300 bg-amber-50/60"
                    : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {s.state === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <Circle
                    className={`h-4 w-4 shrink-0 ${s.state === "current" ? "text-amber-600" : "text-gray-300"}`}
                  />
                )}
                <p
                  className={`text-xs font-semibold leading-tight ${
                    s.state === "todo" ? "text-gray-500" : "text-gray-900"
                  }`}
                >
                  {s.label}
                </p>
              </div>
              {s.detail && (
                <p className="text-[11px] text-gray-600 mt-1 leading-snug">{s.detail}</p>
              )}
              {s.at && <p className="text-[11px] text-gray-500 mt-1 tabular-nums">{s.at}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
