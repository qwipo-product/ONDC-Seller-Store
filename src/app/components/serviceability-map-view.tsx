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
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
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

function beatPopupHtml(beat: ServiceabilityBeat, color: string): string {
  const days = sortDeliveryDays(beat.deliveryDays).join(", ");
  return `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; min-width: 180px;">
      <p style="margin:0; font-weight:700; font-size:13px; color:#111827; display:flex; align-items:center; gap:6px;">
        <span style="width:10px; height:10px; border-radius:3px; background:${color}; display:inline-block;"></span>
        ${esc(beat.beatName)}
      </p>
      <p style="margin:3px 0 0; font-size:11px; color:#6b7280;">${esc(beat.companyName)}</p>
      <p style="margin:4px 0 0; font-size:11px; color:#374151;"><b>Days:</b> ${esc(days)}</p>
      ${
        beat.polygonFileName
          ? `<p style="margin:2px 0 0; font-size:10px; color:#9ca3af; font-family:ui-monospace,monospace;">${esc(beat.polygonFileName)}</p>`
          : ""
      }
    </div>
  `;
}

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
}

const WEEKDAYS = DELIVERY_DAY_OPTIONS.filter((d) => d !== "Next Day");

export function ServiceabilityMapDialog({
  open,
  onOpenChange,
  beats,
  initialCompanyId,
  focusBeatId,
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

  // Target bounds: the focused beat when set, else everything drawn.
  const { bounds, boundsKey } = useMemo(() => {
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
    return {
      bounds: combined,
      boundsKey: `all:${companyFilter}:${dayFilter}:${drawn.length}:${fitAllNonce}`,
    };
  }, [focusedBeat, drawn, companyFilter, dayFilter, fitAllNonce]);

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
            {withPolygon.length === 0 ? (
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
                {drawn.map((beat) => {
                  const color = colorByBeatId.get(beat.id) ?? "#2563eb";
                  const isFocused = focusedId === beat.id;
                  return (
                    <GeoJSON
                      key={`${beat.id}:${isFocused ? "f" : "n"}`}
                      data={beat.polygonData as GeoJsonObject}
                      style={{
                        color,
                        weight: isFocused ? 3.5 : 2,
                        fillColor: color,
                        fillOpacity: isFocused ? 0.4 : 0.24,
                      }}
                      onEachFeature={(_feature, layer) => {
                        layer.bindPopup(beatPopupHtml(beat, color));
                      }}
                      eventHandlers={{
                        click: () => setFocusedId(beat.id),
                      }}
                    />
                  );
                })}
              </MapContainer>
            )}

            {withPolygon.length > 0 && (
              <div className="absolute bottom-2 left-2 z-[400] rounded-md bg-white/90 backdrop-blur px-2.5 py-1.5 text-[10px] text-gray-600 border border-gray-200 shadow-sm max-w-xs">
                Overlapping shading = area covered by more than one beat.
                Click a polygon for its beat details.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
