// Orders → View on Map dialog.
// -----------------------------------------------------------------
// Renders an embedded Leaflet + OpenStreetMap view of retailer
// delivery locations for a set of selected orders.
//
// • Each distinct location gets one pin. Orders sharing the same
//   coordinates are grouped and listed together in the popup.
// • Clicking a pin opens a popup: retailer name, order ID, invoice
//   amount, and a "Copy Location" button that writes the Google Maps
//   URL to the clipboard (BR-7, BR-9).
// • Only one popup is visible at a time (Leaflet default, BR-10).
// • Header counts all selected orders but only pinned locations
//   (BR-4, BR-12).
import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MapPin, ShoppingBag, X, IndianRupee, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Order } from "../lib/orders-data";

// ─── Types ────────────────────────────────────────────────────────

type LocationGroup = {
  key: string;
  lat: number;
  lng: number;
  orders: Order[];
  connectivity: "Online" | "Offline" | undefined;
};

// ─── Helpers ──────────────────────────────────────────────────────

function groupByLocation(orders: Order[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>();
  for (const o of orders) {
    if (typeof o.buyerLat !== "number" || typeof o.buyerLng !== "number") continue;
    const key = `${o.buyerLat.toFixed(3)},${o.buyerLng.toFixed(3)}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        lat: o.buyerLat,
        lng: o.buyerLng,
        orders: [],
        connectivity: o.connectivity,
      });
    }
    map.get(key)!.orders.push(o);
  }
  return Array.from(map.values());
}

function copyGoogleMapsUrl(lat: number, lng: number) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  navigator.clipboard.writeText(url).then(
    () => toast.success("Link copied", { duration: 2000 }),
    () =>
      toast.error("Unable to copy link. Please copy it manually.", {
        duration: 3000,
      }),
  );
}

// ─── Marker icons ─────────────────────────────────────────────────

function buildOrderIcon(
  connectivity: "Online" | "Offline" | undefined,
): L.DivIcon {
  const color = connectivity === "Offline" ? "#f97316" : "#2563eb";
  return L.divIcon({
    className: "qwipo-order-marker",
    html: `
      <div style="
        width: 28px; height: 28px;
        background: ${color};
        border: 3px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 6px rgba(0,0,0,0.30);
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          transform: rotate(45deg);
          width: 6px; height: 6px;
          background: #ffffff;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

const buildClusterIcon = (cluster: { getChildCount: () => number }) => {
  const count = cluster.getChildCount();
  const size = count >= 5 ? 40 : 34;
  return L.divIcon({
    className: "qwipo-cluster-marker",
    html: `
      <div style="
        width: ${size}px; height: ${size}px;
        background: #2563eb;
        border: 3px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        display: flex; align-items: center; justify-content: center;
        color: white;
      ">
        <span style="
          transform: rotate(45deg);
          font-weight: 700;
          font-size: ${count >= 100 ? 11 : 13}px;
          font-family: ui-sans-serif, system-ui, sans-serif;
        ">${count}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
};

const HYDERABAD_CENTER: [number, number] = [17.385, 78.486];

// ─── Component ────────────────────────────────────────────────────

export interface OrdersMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  contextLabel: string;
}

export function OrdersMapDialog({
  open,
  onOpenChange,
  orders,
  contextLabel,
}: OrdersMapDialogProps) {
  const [tileError, setTileError] = useState(false);

  // Reset tile error state whenever the dialog reopens (EDGE-6).
  useEffect(() => {
    if (open) setTileError(false);
  }, [open]);

  const locationGroups = useMemo(() => groupByLocation(orders), [orders]);

  // Header totals — order count includes all selected orders even if
  // some have no location (BR-12). Total value covers all selected.
  const totalValue = useMemo(
    () => orders.reduce((s, o) => s + (o.orderValue || 0), 0),
    [orders],
  );

  const center = useMemo<[number, number]>(() => {
    if (locationGroups.length === 0) return HYDERABAD_CENTER;
    const lat =
      locationGroups.reduce((s, g) => s + g.lat, 0) / locationGroups.length;
    const lng =
      locationGroups.reduce((s, g) => s + g.lng, 0) / locationGroups.length;
    return [lat, lng];
  }, [locationGroups]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[min(1200px,calc(100vw-2rem))] p-0 overflow-hidden h-[80vh] flex flex-col gap-0"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-blue-600 p-2 rounded-lg flex-shrink-0">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-gray-900 leading-tight truncate">
                Orders Map View
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 truncate">
                {contextLabel}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-5 text-sm flex-shrink-0">
            <div className="inline-flex items-center gap-1.5 text-gray-700">
              <ShoppingBag className="h-4 w-4 text-blue-600" />
              <span className="font-semibold tabular-nums">{orders.length}</span>
              <span className="text-gray-500">
                {orders.length === 1 ? "order" : "orders"}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-gray-700">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="font-semibold tabular-nums">
                {locationGroups.length}
              </span>
              <span className="text-gray-500">
                {locationGroups.length === 1 ? "location" : "locations"}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-gray-700">
              <IndianRupee className="h-4 w-4 text-blue-600" />
              <span className="font-semibold tabular-nums">
                {totalValue.toLocaleString("en-IN")}
              </span>
              <span className="text-gray-500">total value</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="ml-1 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Close map view"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Map body ───────────────────────────────────────────── */}
        <div className="flex-1 relative bg-gray-100">
          {/* EDGE-4: all orders lack location data */}
          {locationGroups.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
              <MapPin className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">
                No location data available for the selected orders
              </p>
              <p className="text-xs text-gray-500 max-w-sm">
                Retailer delivery coordinates are captured by the buyer app
                when an order is placed.
              </p>
            </div>
          ) : tileError ? (
            /* ERR-MAP-01: tile load failure */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
              <MapPin className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">
                Unable to load the map. Please try again.
              </p>
              <button
                type="button"
                onClick={() => setTileError(false)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : (
            <MapContainer
              center={center}
              zoom={11}
              scrollWheelZoom
              className="h-full w-full"
              style={{ zIndex: 0 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                eventHandlers={{ tileerror: () => setTileError(true) }}
              />
              <MarkerClusterGroup
                iconCreateFunction={buildClusterIcon}
                showCoverageOnHover={false}
                maxClusterRadius={50}
                spiderfyOnMaxZoom
              >
                {locationGroups.map((group) => (
                  <Marker
                    key={group.key}
                    position={[group.lat, group.lng]}
                    icon={buildOrderIcon(group.connectivity)}
                  >
                    {/* BR-4/BR-3: popup — single order uses full detail
                        layout; multiple orders at same pin show retailer
                        name once then each order as one comma-separated
                        entry (Order ID, ₹Invoice). */}
                    <Popup minWidth={240} maxWidth={300}>
                      <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
                        {group.orders.length === 1 ? (
                          /* ── Single order: original full-detail layout ── */
                          <div>
                            <p
                              style={{
                                margin: 0,
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#111827",
                                lineHeight: 1.3,
                              }}
                            >
                              {group.orders[0].retailerName}
                            </p>
                            <p
                              style={{
                                margin: "3px 0 0",
                                fontFamily: "ui-monospace, monospace",
                                fontSize: 11,
                                color: "#6b7280",
                              }}
                            >
                              {group.orders[0].id}
                            </p>
                            <p
                              style={{
                                margin: "2px 0 0",
                                fontSize: 12,
                                color: "#374151",
                              }}
                            >
                              ₹{(group.orders[0].orderValue || 0).toLocaleString("en-IN")}
                            </p>
                          </div>
                        ) : (
                          /* ── BR-3: multiple orders — retailer name once,
                              each order as "Order ID, ₹Invoice" entry ── */
                          <div>
                            <p
                              style={{
                                margin: "0 0 6px",
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#111827",
                                lineHeight: 1.3,
                              }}
                            >
                              {group.orders[0].retailerName}
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {group.orders.map((o) => (
                                <p
                                  key={o.id}
                                  style={{ margin: 0, fontSize: 11, color: "#374151" }}
                                >
                                  <span
                                    style={{
                                      fontFamily: "ui-monospace, monospace",
                                      color: "#6b7280",
                                    }}
                                  >
                                    {o.id}
                                  </span>
                                  {", ₹"}
                                  {(o.orderValue || 0).toLocaleString("en-IN")}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* BR-9: Copy Location */}
                        <button
                          type="button"
                          onClick={() =>
                            copyGoogleMapsUrl(group.lat, group.lng)
                          }
                          style={{
                            marginTop: 10,
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#1d4ed8",
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: 6,
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "#dbeafe";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "#eff6ff";
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </svg>
                          Copy Location
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
