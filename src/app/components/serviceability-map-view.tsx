// Serviceability → Map View
// -----------------------------------------------------------------
// GIS visualization of delivery-beat polygons on Leaflet + OSM.
// Motivation (July 2026 review): polygons were uploaded as opaque
// JSON, so mistakes only surfaced downstream. Instead of building
// heavy overlap validation, give admins *visibility* — render every
// beat's polygon on a real map so they can verify coverage, spot
// overlaps and self-correct.
//
// Two exports:
// • ServiceabilityMapDialog — full map view with company/day filters
//   and a beat legend (click a beat to zoom to its polygon).
// • PolygonPreviewMap — small inline map used inside the Add/Edit
//   beat dialogs so an uploaded polygon is verified BEFORE saving.
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject } from "geojson";
import {
  Map as MapIcon,
  MapPin,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Maximize2,
  Building2,
  Warehouse,
} from "lucide-react";
import {
  getPolygonId,
  sortDeliveryDays,
  type ServiceabilityBeat,
} from "../lib/serviceability-data";
import {
  DELIVERY_DAY_OPTIONS,
  type DeliveryDay,
} from "../lib/customers-data";

// ─── Colors ───────────────────────────────────────────────────────
// Distinct fills so adjacent/overlapping beats stay tellable apart.
// Assigned by the beat's stable position among ALL polygon-carrying
// beats (not the filtered subset) so a beat keeps its color while
// the user flips filters.
const BEAT_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#059669", // emerald
  "#d97706", // amber
  "#7c3aed", // violet
  "#db2777", // pink
  "#0891b2", // cyan
  "#65a30d", // lime
  "#ea580c", // orange
  "#4f46e5", // indigo
  "#0d9488", // teal
  "#9333ea", // purple
];

const HYDERABAD_CENTER: [number, number] = [17.44, 78.4];

// ─── GeoJSON helpers ──────────────────────────────────────────────

function getGeoJsonBounds(data: unknown): L.LatLngBounds | null {
  try {
    const bounds = L.geoJSON(data as GeoJsonObject).getBounds();
    return bounds.isValid() ? bounds : null;
  } catch {
    return null;
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Planar shoelace on an equirectangular projection — plenty accurate
// for city-scale delivery zones.
function ringAreaKm2(ring: [number, number][]): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const lat0 =
    (ring.reduce((s, p) => s + p[1], 0) / ring.length) * rad;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = R * ring[i][0] * rad * Math.cos(lat0);
    const y1 = R * ring[i][1] * rad;
    const x2 = R * ring[i + 1][0] * rad * Math.cos(lat0);
    const y2 = R * ring[i + 1][1] * rad;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function polygonAreaKm2(data: unknown): number | null {
  try {
    let total = 0;
    const walkGeometry = (geom: {
      type?: string;
      coordinates?: unknown;
    }) => {
      if (!geom) return;
      if (geom.type === "Polygon") {
        total += ringAreaKm2(
          (geom.coordinates as [number, number][][])[0],
        );
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates as [number, number][][][]) {
          total += ringAreaKm2(poly[0]);
        }
      }
    };
    const d = data as {
      type?: string;
      features?: { geometry: { type?: string } }[];
      geometry?: { type?: string };
    };
    if (d.type === "FeatureCollection") {
      for (const f of d.features ?? []) walkGeometry(f.geometry);
    } else if (d.type === "Feature") {
      walkGeometry(d.geometry ?? {});
    } else {
      walkGeometry(d as { type?: string });
    }
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

// Beat details card shown when a polygon is clicked.
function beatPopupHtml(beat: ServiceabilityBeat, color: string): string {
  const dayChips = sortDeliveryDays(beat.deliveryDays)
    .map(
      (d) =>
        `<span style="display:inline-block; padding:1px 7px; border-radius:999px; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; font-size:10px; font-weight:600;">${esc(d)}</span>`,
    )
    .join(" ");
  const area = polygonAreaKm2(beat.polygonData);
  return `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; min-width: 200px; max-width: 260px;">
      <p style="margin:0; font-weight:700; font-size:13px; color:#111827; display:flex; align-items:center; gap:6px;">
        <span style="width:10px; height:10px; border-radius:3px; background:${color}; display:inline-block; flex-shrink:0;"></span>
        ${esc(beat.beatName)}
      </p>
      <p style="margin:3px 0 0; font-size:11px; color:#6b7280;">${esc(beat.companyName)}</p>
      <div style="margin:7px 0 0; display:flex; flex-wrap:wrap; gap:3px;">${dayChips}</div>
      <div style="margin:8px 0 0; padding-top:7px; border-top:1px solid #f3f4f6; font-size:11px; color:#374151; display:flex; flex-direction:column; gap:2px;">
        ${
          area != null
            ? `<span><b>Coverage:</b> ≈ ${area < 10 ? area.toFixed(1) : Math.round(area)} km²</span>`
            : ""
        }
        <span><b>Delivery days:</b> ${beat.deliveryDays.length}/week</span>
        ${
          beat.polygonFileName
            ? `<span style="font-size:10px; color:#9ca3af; font-family:ui-monospace,monospace;">${esc(beat.polygonFileName)}</span>`
            : ""
        }
      </div>
    </div>
  `;
}

// ─── Point-in-polygon (click inspection) ──────────────────────────
// Ray casting against the outer ring(s). Holes are ignored — demo
// zones don't carry any, and a false positive inside a hole is
// harmless for an inspection popup.

function pointInRing(
  lng: number,
  lat: number,
  ring: [number, number][],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function geoJsonContainsPoint(
  data: unknown,
  lat: number,
  lng: number,
): boolean {
  try {
    let hit = false;
    const walkGeometry = (geom: {
      type?: string;
      coordinates?: unknown;
    }) => {
      if (!geom || hit) return;
      if (geom.type === "Polygon") {
        hit = pointInRing(
          lng,
          lat,
          (geom.coordinates as [number, number][][])[0],
        );
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates as [number, number][][][]) {
          if (pointInRing(lng, lat, poly[0])) {
            hit = true;
            return;
          }
        }
      }
    };
    const d = data as {
      type?: string;
      features?: { geometry: { type?: string } }[];
      geometry?: { type?: string };
    };
    if (d.type === "FeatureCollection") {
      for (const f of d.features ?? []) {
        walkGeometry(f.geometry);
        if (hit) break;
      }
    } else if (d.type === "Feature") {
      walkGeometry(d.geometry ?? {});
    } else {
      walkGeometry(d as { type?: string });
    }
    return hit;
  } catch {
    return false;
  }
}

// Combined card when the clicked point sits inside SEVERAL beats —
// typically the same physical area served by multiple companies, or
// two zones overlapping. Lists every company by name.
function multiBeatPopupHtml(
  matches: ServiceabilityBeat[],
  colorOf: (beatId: string) => string,
): string {
  const rows = matches
    .map((beat, i) => {
      const days = sortDeliveryDays(beat.deliveryDays).join(", ");
      return `
        <div style="display:flex; gap:7px; align-items:flex-start; ${
          i > 0 ? "margin-top:7px; padding-top:7px; border-top:1px solid #f3f4f6;" : ""
        }">
          <span style="width:10px; height:10px; border-radius:3px; background:${colorOf(beat.id)}; display:inline-block; flex-shrink:0; margin-top:2px;"></span>
          <div style="min-width:0;">
            <p style="margin:0; font-size:12px; color:#111827;">
              <b>${esc(beat.companyName)}</b>
            </p>
            <p style="margin:1px 0 0; font-size:11px; color:#6b7280;">
              ${esc(beat.beatName)} · ${esc(days)}
            </p>
          </div>
        </div>
      `;
    })
    .join("");
  return `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; min-width: 210px; max-width: 270px;">
      <p style="margin:0 0 8px; font-weight:700; font-size:12px; color:#111827;">
        ${matches.length} companies serve this area
      </p>
      ${rows}
    </div>
  `;
}

// Map-level click handler: collect EVERY visible beat whose polygon
// contains the clicked point and open one popup — a single-beat card
// when only one matches, the multi-company list when several do.
function ClickToInspect({
  beats,
  colorOf,
}: {
  beats: ServiceabilityBeat[];
  colorOf: (beatId: string) => string;
}) {
  const map = useMapEvents({
    click(e) {
      const matches = beats.filter((b) =>
        geoJsonContainsPoint(b.polygonData, e.latlng.lat, e.latlng.lng),
      );
      if (matches.length === 0) return;
      const html =
        matches.length === 1
          ? beatPopupHtml(matches[0], colorOf(matches[0].id))
          : multiBeatPopupHtml(matches, colorOf);
      L.popup({ minWidth: 210, maxWidth: 300 })
        .setLatLng(e.latlng)
        .setContent(html)
        .openOn(map);
    },
  });
  return null;
}

// ─── Distributor warehouse marker ─────────────────────────────────

export interface WarehousePoint {
  lat: number;
  lng: number;
  /** Distributor (seller) display name. */
  name: string;
  businessName?: string;
  address?: string;
}

// Dark rounded-square badge with a warehouse glyph — visually distinct
// from the colored beat polygons so the operating base stands out.
const WAREHOUSE_ICON = L.divIcon({
  className: "qwipo-warehouse-marker",
  html: `
    <div style="
      width: 34px; height: 34px;
      background: #1e293b;
      border: 3px solid #ffffff;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/>
        <path d="M6 18h12"/><path d="M6 14h12"/><path d="M6 10h12"/>
      </svg>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -21],
});

// Imperatively refit the map when the target bounds change. The
// boundsKey dependency (not the bounds object, which is rebuilt every
// render) decides when a refit actually happens.
function FitBounds({
  bounds,
  boundsKey,
}: {
  bounds: L.LatLngBounds | null;
  boundsKey: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [16, 16], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, map]);
  return null;
}

// ─── Inline preview (Add/Edit dialogs) ────────────────────────────

export function PolygonPreviewMap({ data }: { data: unknown }) {
  const bounds = useMemo(() => getGeoJsonBounds(data), [data]);
  const dataKey = useMemo(() => getPolygonId({ polygonData: data }), [data]);

  if (!bounds) {
    return (
      <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
        <span>
          This file parses as GeoJSON but has no drawable geometry — check
          its coordinates before saving.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="overflow-hidden rounded-md border border-gray-200">
        <MapContainer
          key={dataKey}
          bounds={bounds}
          boundsOptions={{ padding: [16, 16] }}
          zoomSnap={0.5}
          scrollWheelZoom={false}
          className="h-44 w-full"
          style={{ zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            data={data as GeoJsonObject}
            style={{ color: "#4f46e5", weight: 2, fillOpacity: 0.25 }}
          />
        </MapContainer>
      </div>
      <p className="text-[10px] text-gray-500">
        Map preview of the attached polygon — verify the area covers the
        intended beat before saving.
      </p>
    </div>
  );
}

// ─── Full map dialog ──────────────────────────────────────────────

export interface ServiceabilityMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beats: ServiceabilityBeat[];
  /** Preselect the company filter (per-company entry point). */
  initialCompanyId?: string | null;
  /** Zoom straight to one beat's polygon (beat-chip entry point). */
  focusBeatId?: string | null;
  /** Distributor's warehouse / operating base — shown as a pin. */
  warehouse?: WarehousePoint | null;
}

const WEEKDAYS = DELIVERY_DAY_OPTIONS.filter((d) => d !== "Next Day");

// Sentinel focus id for the warehouse pin (beat ids never collide —
// they all start with "beat-").
const WAREHOUSE_FOCUS_ID = "__warehouse__";

export function ServiceabilityMapDialog({
  open,
  onOpenChange,
  beats,
  initialCompanyId,
  focusBeatId,
  warehouse,
}: ServiceabilityMapDialogProps) {
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<DeliveryDay | "all">("all");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [fitAllNonce, setFitAllNonce] = useState(0);

  // Re-arm the view each time the dialog opens with fresh entry-point
  // context (header → all beats, company card → that company, beat
  // chip → zoomed to that beat).
  useEffect(() => {
    if (open) {
      setCompanyFilter(initialCompanyId ?? "all");
      setDayFilter("all");
      setHiddenIds(new Set());
      setFocusedId(focusBeatId ?? null);
      setFitAllNonce(0);
    }
  }, [open, initialCompanyId, focusBeatId]);

  // Stable color per beat, assigned over the full polygon-carrying
  // list so colors survive filter changes.
  const colorByBeatId = useMemo(() => {
    const m = new Map<string, string>();
    let i = 0;
    for (const b of beats) {
      if (b.polygonData != null) {
        m.set(b.id, BEAT_COLORS[i % BEAT_COLORS.length]);
        i++;
      }
    }
    return m;
  }, [beats]);

  const companies = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of beats) if (!m.has(b.companyId)) m.set(b.companyId, b.companyName);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [beats]);

  const filtered = useMemo(() => {
    return beats
      .filter((b) => companyFilter === "all" || b.companyId === companyFilter)
      .filter(
        (b) => dayFilter === "all" || b.deliveryDays.includes(dayFilter),
      )
      .sort(
        (a, b) =>
          a.companyName.localeCompare(b.companyName) ||
          a.beatName.localeCompare(b.beatName),
      );
  }, [beats, companyFilter, dayFilter]);

  const withPolygon = useMemo(
    () => filtered.filter((b) => b.polygonData != null),
    [filtered],
  );
  const withoutPolygon = useMemo(
    () => filtered.filter((b) => b.polygonData == null),
    [filtered],
  );
  const drawn = useMemo(
    () => withPolygon.filter((b) => !hiddenIds.has(b.id)),
    [withPolygon, hiddenIds],
  );

  const focusedBeat =
    (focusedId && drawn.find((b) => b.id === focusedId)) || null;

  // Target bounds: warehouse pin or focused beat when set, else
  // everything drawn (warehouse included so the base never falls
  // outside the initial view).
  const { bounds, boundsKey } = useMemo(() => {
    if (focusedId === WAREHOUSE_FOCUS_ID && warehouse) {
      return {
        bounds: L.latLng(warehouse.lat, warehouse.lng).toBounds(2400),
        boundsKey: `wh:${fitAllNonce}`,
      };
    }
    if (focusedBeat) {
      return {
        bounds: getGeoJsonBounds(focusedBeat.polygonData),
        boundsKey: `beat:${focusedBeat.id}:${fitAllNonce}`,
      };
    }
    let combined: L.LatLngBounds | null = null;
    for (const b of drawn) {
      const bb = getGeoJsonBounds(b.polygonData);
      if (!bb) continue;
      combined = combined ? combined.extend(bb) : bb;
    }
    if (warehouse) {
      const wh = L.latLng(warehouse.lat, warehouse.lng);
      combined = combined ? combined.extend(wh) : wh.toBounds(2400);
    }
    return {
      bounds: combined,
      boundsKey: `all:${companyFilter}:${dayFilter}:${drawn.length}:${fitAllNonce}`,
    };
  }, [
    focusedId,
    focusedBeat,
    drawn,
    companyFilter,
    dayFilter,
    fitAllNonce,
    warehouse,
  ]);

  const toggleHidden = (beatId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(beatId)) next.delete(beatId);
      else next.add(beatId);
      return next;
    });
    if (focusedId === beatId) setFocusedId(null);
  };

  const focusBeat = (beatId: string) => {
    setHiddenIds((prev) => {
      if (!prev.has(beatId)) return prev;
      const next = new Set(prev);
      next.delete(beatId);
      return next;
    });
    setFocusedId((prev) => (prev === beatId ? null : beatId));
  };

  // Legend grouped by company for scanability when "All companies".
  const legendGroups = useMemo(() => {
    const m = new Map<string, ServiceabilityBeat[]>();
    for (const b of filtered) {
      const list = m.get(b.companyName) ?? [];
      list.push(b);
      m.set(b.companyName, list);
    }
    return Array.from(m, ([companyName, list]) => ({ companyName, list }));
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[min(1200px,calc(100vw-2rem))] p-0 overflow-hidden h-[82vh] flex flex-col gap-0"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-indigo-600 p-2 rounded-lg flex-shrink-0">
              <MapIcon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-gray-900 leading-tight truncate">
                Serviceability Map
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 truncate">
                Delivery-beat polygons — verify coverage and spot overlaps
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm flex-shrink-0">
            <div className="inline-flex items-center gap-1.5 text-gray-700">
              <Building2 className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold tabular-nums">
                {legendGroups.length}
              </span>
              <span className="text-gray-500">
                {legendGroups.length === 1 ? "company" : "companies"}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-gray-700">
              <MapPin className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold tabular-nums">
                {withPolygon.length}
              </span>
              <span className="text-gray-500">
                of {filtered.length} beat{filtered.length === 1 ? "" : "s"}{" "}
                mapped
              </span>
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

        {/* ── Filter bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0 flex-wrap">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="h-8 w-56 bg-white text-xs">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDayFilter("all")}
              className={`h-7 px-2.5 rounded-full border text-[11px] font-medium transition-colors ${
                dayFilter === "all"
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              All days
            </button>
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDayFilter(d)}
                className={`h-7 px-2.5 rounded-full border text-[11px] font-medium transition-colors ${
                  dayFilter === d
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setFocusedId(null);
              setFitAllNonce((n) => n + 1);
            }}
            className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-[11px] font-medium text-gray-700"
            title="Fit the map to every visible polygon"
          >
            <Maximize2 className="h-3 w-3" />
            Fit all
          </button>
        </div>

        {/* ── Body: legend + map ─────────────────────────────────── */}
        <div className="flex-1 flex min-h-0">
          {/* Legend */}
          <div className="w-72 border-r border-gray-200 bg-white overflow-y-auto flex-shrink-0">
            {warehouse && (
              <button
                type="button"
                onClick={() =>
                  setFocusedId((prev) =>
                    prev === WAREHOUSE_FOCUS_ID ? null : WAREHOUSE_FOCUS_ID,
                  )
                }
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-100 transition-colors ${
                  focusedId === WAREHOUSE_FOCUS_ID
                    ? "bg-indigo-50"
                    : "hover:bg-gray-50"
                }`}
                title={
                  focusedId === WAREHOUSE_FOCUS_ID
                    ? "Click to unfocus"
                    : "Click to zoom to the warehouse"
                }
              >
                <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-800 text-white shrink-0">
                  <Warehouse className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-gray-900 truncate">
                    {warehouse.businessName ?? warehouse.name}
                  </span>
                  <span className="block text-[10px] text-gray-500 truncate">
                    Distributor warehouse · operating base
                  </span>
                </span>
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="p-4 text-xs text-gray-500">
                No beats match the current filters.
              </div>
            ) : (
              <div className="py-1">
                {legendGroups.map(({ companyName, list }) => (
                  <div key={companyName}>
                    <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider font-semibold text-gray-400 flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      {companyName}
                    </div>
                    {list.map((beat) => {
                      const color = colorByBeatId.get(beat.id);
                      const hasPolygon = beat.polygonData != null;
                      const hidden = hiddenIds.has(beat.id);
                      const isFocused = focusedId === beat.id;
                      return (
                        <div
                          key={beat.id}
                          className={`group flex items-center gap-2 px-3 py-1.5 text-xs ${
                            isFocused ? "bg-indigo-50" : "hover:bg-gray-50"
                          } ${hasPolygon ? "cursor-pointer" : ""}`}
                          onClick={
                            hasPolygon ? () => focusBeat(beat.id) : undefined
                          }
                          title={
                            hasPolygon
                              ? isFocused
                                ? "Click to unfocus"
                                : "Click to zoom to this polygon"
                              : "No polygon uploaded for this beat yet"
                          }
                        >
                          <span
                            className={`h-3 w-3 rounded-sm shrink-0 ${
                              hasPolygon
                                ? hidden
                                  ? "opacity-25"
                                  : ""
                                : "border border-dashed border-gray-300 bg-transparent"
                            }`}
                            style={
                              hasPolygon ? { background: color } : undefined
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-medium truncate ${
                                hasPolygon
                                  ? hidden
                                    ? "text-gray-400"
                                    : "text-gray-800"
                                  : "text-gray-400"
                              }`}
                            >
                              {beat.beatName}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              {hasPolygon
                                ? sortDeliveryDays(beat.deliveryDays).join(
                                    " · ",
                                  )
                                : "No polygon yet"}
                            </div>
                          </div>
                          {hasPolygon && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHidden(beat.id);
                              }}
                              className={`shrink-0 text-gray-400 hover:text-gray-700 ${
                                hidden
                                  ? ""
                                  : "opacity-0 group-hover:opacity-100"
                              } transition-opacity`}
                              title={
                                hidden ? "Show on map" : "Hide from map"
                              }
                              aria-label={
                                hidden
                                  ? `Show ${beat.beatName} on map`
                                  : `Hide ${beat.beatName} from map`
                              }
                            >
                              {hidden ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {withoutPolygon.length > 0 && (
              <div className="mx-3 my-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                <span>
                  {withoutPolygon.length} beat
                  {withoutPolygon.length === 1 ? " has" : "s have"} no polygon
                  uploaded — their coverage can&apos;t be verified on the map.
                </span>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="flex-1 relative bg-gray-100">
            {withPolygon.length === 0 && !warehouse ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 z-10">
                <MapIcon className="h-8 w-8 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">
                  No polygons to display
                </p>
                <p className="text-xs text-gray-500 max-w-sm">
                  None of the beats matching the current filters carry a
                  polygon. Upload a GeoJSON polygon on a beat to see its
                  delivery area here.
                </p>
              </div>
            ) : (
              <MapContainer
                center={HYDERABAD_CENTER}
                zoom={12}
                zoomSnap={0.5}
                scrollWheelZoom
                className="h-full w-full"
                style={{ zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds bounds={bounds} boundsKey={boundsKey} />
                <ClickToInspect
                  beats={drawn}
                  colorOf={(id) => colorByBeatId.get(id) ?? "#2563eb"}
                />
                {warehouse && (
                  <Marker
                    position={[warehouse.lat, warehouse.lng]}
                    icon={WAREHOUSE_ICON}
                    zIndexOffset={1000}
                  >
                    <Popup minWidth={210} maxWidth={280}>
                      <div
                        style={{
                          fontFamily:
                            "ui-sans-serif, system-ui, sans-serif",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#111827",
                          }}
                        >
                          {warehouse.businessName ?? warehouse.name}
                        </p>
                        <p
                          style={{
                            margin: "3px 0 0",
                            fontSize: 11,
                            color: "#6b7280",
                          }}
                        >
                          Distributor warehouse · {warehouse.name}
                        </p>
                        {warehouse.address && (
                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: 11,
                              color: "#374151",
                              lineHeight: 1.4,
                            }}
                          >
                            {warehouse.address}
                          </p>
                        )}
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: 10,
                            color: "#9ca3af",
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          {warehouse.lat.toFixed(4)},{" "}
                          {warehouse.lng.toFixed(4)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                {drawn.map((beat) => {
                  const color = colorByBeatId.get(beat.id) ?? "#2563eb";
                  const isFocused = focusedId === beat.id;
                  return (
                    <GeoJSON
                      // Key stays focus-independent: react-leaflet
                      // applies style changes in place, and a remount
                      // here would destroy the popup as it opens.
                      key={beat.id}
                      data={beat.polygonData as GeoJsonObject}
                      style={{
                        color,
                        weight: isFocused ? 3.5 : 2,
                        fillColor: color,
                        fillOpacity: isFocused ? 0.4 : 0.24,
                      }}
                    />
                  );
                })}
              </MapContainer>
            )}

            {withPolygon.length > 0 && (
              <div className="absolute bottom-2 left-2 z-[400] rounded-md bg-white/90 backdrop-blur px-2.5 py-1.5 text-[10px] text-gray-600 border border-gray-200 shadow-sm max-w-xs">
                Overlapping shading = area covered by more than one beat.
                Click anywhere inside a zone to see every company serving
                that spot.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
