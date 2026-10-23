// Dark Store → zone map. The store's zone outline, its centre, every
// active customer inside it (coloured by how many companies they can
// order from) and the warehouses of the sellers covering it. In the
// full-coverage view it also outlines every beat touching the zone and
// shows the customers those beats reach outside it, faded. Canvas
// rendering keeps several thousand customer dots smooth.
import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection, GeoJsonObject } from "geojson";
import { getSellers } from "../lib/mock-store";
import { polygonOuterRings } from "../lib/serviceability-data";
import type { DarkStoreAnalysis } from "../lib/dark-store-data";

/** Companies-visible bands for the customer dots, low → high. */
export const EXPOSURE_BANDS = [
  { label: "Not covered", min: 0, max: 0, color: "#dc2626" },
  { label: "1–20 companies", min: 1, max: 20, color: "#f97316" },
  { label: "21–40 companies", min: 21, max: 40, color: "#facc15" },
  { label: "41–60 companies", min: 41, max: 60, color: "#4ade80" },
  { label: "61+ companies", min: 61, max: Infinity, color: "#15803d" },
] as const;

const bandColor = (companies: number) =>
  EXPOSURE_BANDS.find((b) => companies >= b.min && companies <= b.max)?.color ??
  "#6b7280";

const STORE_ICON = L.divIcon({
  className: "qwipo-dark-store-marker",
  html: `
    <div style="
      width: 36px; height: 36px;
      background: #7c3aed;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

const WAREHOUSE_ICON = L.divIcon({
  className: "qwipo-warehouse-marker",
  html: `
    <div style="
      width: 26px; height: 26px;
      background: #1e293b;
      border: 2px solid #ffffff;
      border-radius: 7px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/>
        <path d="M6 18h12"/><path d="M6 14h12"/><path d="M6 10h12"/>
      </svg>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -15],
});

export function DarkStoreZoneMap({
  analysis,
  className = "h-[420px]",
}: {
  analysis: DarkStoreAnalysis;
  /** Sizing — the map fills this box. */
  className?: string;
}) {
  const { store } = analysis;
  const full = analysis.scope === "full";

  // Full view: every zone beat's outline as one layer.
  const beatOutlines = useMemo<FeatureCollection | null>(
    () =>
      full
        ? {
            type: "FeatureCollection",
            features: analysis.zoneBeats.flatMap((b) =>
              polygonOuterRings(b.polygonData).map((ring) => ({
                type: "Feature" as const,
                properties: {},
                geometry: { type: "Polygon" as const, coordinates: [ring] },
              })),
            ),
          }
        : null,
    [full, analysis.zoneBeats],
  );

  const bounds = useMemo(() => {
    const zoneBounds = L.geoJSON(store.zone as GeoJsonObject).getBounds();
    if (beatOutlines?.features.length) {
      zoneBounds.extend(L.geoJSON(beatOutlines).getBounds());
    }
    return zoneBounds.pad(0.05);
  }, [store.zone, beatOutlines]);

  // Outside-zone dots first so the zone's own customers draw on top.
  const dots = useMemo(
    () => [
      ...analysis.customers.filter((z) => !z.insideZone),
      ...analysis.customers.filter((z) => z.insideZone),
    ],
    [analysis.customers],
  );

  const warehouses = useMemo(() => {
    const byId = new Map(getSellers().map((s) => [s.id, s]));
    return analysis.sellers.flatMap((row) => {
      const s = byId.get(row.sellerId);
      return s?.latitude != null && s?.longitude != null
        ? [{ row, lat: s.latitude, lng: s.longitude }]
        : [];
    });
  }, [analysis.sellers]);

  return (
    <div className={`relative rounded-lg overflow-hidden border border-gray-200 ${className}`}>
      <MapContainer
        bounds={bounds}
        preferCanvas
        scrollWheelZoom={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {beatOutlines && (
          <GeoJSON
            data={beatOutlines}
            interactive={false}
            style={{ color: "#0284c7", weight: 1, opacity: 0.35, fill: false }}
          />
        )}
        {dots.map((z) => (
          <CircleMarker
            key={z.customer.id}
            center={[z.customer.lat, z.customer.lng]}
            radius={z.insideZone ? 4 : 3}
            pathOptions={{
              color: "#ffffff",
              weight: z.insideZone ? 0.75 : 0.5,
              fillColor: bandColor(z.companyNames.length),
              fillOpacity: z.insideZone ? 0.9 : 0.4,
            }}
          >
            <Popup>
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-gray-900">{z.customer.name}</p>
                <p className="text-gray-600">
                  {[z.customer.businessType, z.customer.cluster]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-gray-700">
                  {z.companyNames.length} companies · {z.sellerIds.length} sellers
                </p>
                <p className="text-gray-500">
                  {full && (z.insideZone ? "Inside the zone · " : "Outside the zone · ")}
                  {z.distanceKm} km from the dark store
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {/* Zone on top of the dots so its boundary stays visible; not
            interactive, so clicks still reach the dots beneath. */}
        <GeoJSON
          data={store.zone as GeoJsonObject}
          interactive={false}
          style={{
            color: "#7c3aed",
            weight: full ? 3 : 2,
            dashArray: "6 4",
            fillColor: "#7c3aed",
            fillOpacity: 0.04,
          }}
        />
        {warehouses.map(({ row, lat, lng }) => (
          <Marker key={row.sellerId} position={[lat, lng]} icon={WAREHOUSE_ICON}>
            <Popup>
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-gray-900">{row.businessName}</p>
                <p className="text-gray-600">
                  Reaches {row.customersReached.toLocaleString("en-IN")} active customers
                  {full &&
                    ` (${row.customersInside.toLocaleString("en-IN")} inside, ${row.customersOutside.toLocaleString("en-IN")} outside)`}
                </p>
                <p className="text-gray-500">
                  {row.companyNames.length} companies · {row.warehouseKm} km from the dark
                  store
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        <Marker position={[store.centre.lat, store.centre.lng]} icon={STORE_ICON}>
          <Popup>
            <div className="text-xs">
              <p className="font-semibold text-gray-900">{store.name}</p>
              <p className="text-gray-600">
                {store.radiusKm.toFixed(1)} km radius zone
              </p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 rounded-md shadow border border-gray-200 px-2.5 py-1.5 space-y-0.5 text-[11px]">
        {EXPOSURE_BANDS.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-gray-700">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            {b.label}
          </div>
        ))}
        {full && (
          <>
            <div className="flex items-center gap-2 text-gray-700 pt-1 border-t border-gray-100">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-500 opacity-40" />
              Faded — outside the zone
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-sky-600" />
              Seller beat outline
            </div>
          </>
        )}
        <div className="flex items-center gap-2 text-gray-700 pt-1 border-t border-gray-100">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-slate-800" />
          Seller warehouse
        </div>
        <div className="flex items-center gap-2 text-gray-700">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
          Dark store
        </div>
      </div>
    </div>
  );
}
