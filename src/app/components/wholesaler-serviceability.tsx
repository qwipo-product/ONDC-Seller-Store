import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileJson,
  Map as MapIcon,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCompanies as getAdminCatalogCompanies,
  subscribeToCompanies,
  type Company as AdminCatalogCompany,
} from "../lib/admin-catalog";
import {
  clearSellerWholesalerPolygons,
  getSellerWholesalerPolygons,
  makeWholesalerPolygonId,
  removeSellerWholesalerPolygon,
  upsertSellerWholesalerPolygon,
  type Seller,
  type WholesalerPolygon,
} from "../lib/mock-store";
import {
  DayPicker,
  PolygonCell,
  emptyPolygonDraft,
  type PolygonDraft,
} from "./serviceability-manager";
import { PolygonPreviewMap } from "./serviceability-map-view";
import { sortDeliveryDays } from "../lib/serviceability-data";
import { type DeliveryDay } from "../lib/customers-data";

/**
 * Delivery Beats – Wholesaler — DAY-WISE polygons for one seller,
 * rendered exactly like a distributor company group: one collapsible
 * card, day-first rows (Delivery Day | Zones), each zone as a chip.
 * The wholesaler can upload several zones (e.g. one for Monday, one
 * for Tuesday), but none is company-specific: every polygon applies
 * to ALL companies mapped with Operation Mode = Wholesaler, including
 * companies linked later. The Upload Polygon dialog mirrors Add
 * Delivery Beat minus beat name + company (days + polygon only).
 */
export function WholesalerServiceability({
  seller,
  onChange,
}: {
  seller: Seller;
  onChange: (s: Seller) => void;
}) {
  const [companies, setCompanies] = useState<AdminCatalogCompany[]>(() =>
    getAdminCatalogCompanies(),
  );
  useEffect(
    () => subscribeToCompanies(() => setCompanies(getAdminCatalogCompanies())),
    [],
  );

  const wholesalerCompanies = (seller.companyBrandSelections ?? [])
    .filter((s) => s.operationMode === "wholesaler")
    .map((s) => companies.find((c) => c.id === s.companyId))
    .filter((c): c is AdminCatalogCompany => !!c);

  const polygons = getSellerWholesalerPolygons(seller);

  // Day-first projection — one row per unique delivery day, each zone
  // appearing as a chip on every day it serves (same shape as the
  // distributor company group).
  const uniqueDays = useMemo(() => {
    const set = new Set<DeliveryDay>();
    for (const p of polygons) for (const d of p.deliveryDays ?? []) set.add(d);
    return sortDeliveryDays(Array.from(set));
  }, [polygons]);
  const byDay = useMemo(
    () =>
      uniqueDays.map((day) => ({
        day,
        zones: polygons
          .filter((p) => (p.deliveryDays ?? []).includes(day))
          .sort((a, b) => a.fileName.localeCompare(b.fileName)),
      })),
    [uniqueDays, polygons],
  );

  const [collapsed, setCollapsed] = useState(false);

  // ---- Upload / Edit Polygon dialog (delivery days + polygon only) ----
  // One dialog serves both flows: editingId === null → add a new zone,
  // otherwise a chip's edit action pre-fills that zone's days + file.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDays, setDraftDays] = useState<DeliveryDay[]>([]);
  const [draftPolygon, setDraftPolygon] = useState<PolygonDraft>(
    emptyPolygonDraft(),
  );

  const openAdd = () => {
    setEditingId(null);
    setDraftDays([]);
    setDraftPolygon(emptyPolygonDraft());
    setDialogOpen(true);
  };

  const openEdit = (polygonId: string) => {
    const p = polygons.find((x) => x.id === polygonId);
    if (!p) return;
    setEditingId(polygonId);
    setDraftDays(sortDeliveryDays(p.deliveryDays ?? []));
    setDraftPolygon({
      file: null,
      data: p.data ?? null,
      valid: p.data != null ? true : null,
      existingName: p.fileName,
    });
    setDialogOpen(true);
  };

  const draftPolygonReady =
    draftPolygon.data != null &&
    (draftPolygon.file === null || draftPolygon.valid === true);
  const canSave = draftDays.length > 0 && draftPolygonReady;

  const saveDialog = () => {
    if (draftDays.length === 0) {
      toast.error("Pick at least one delivery day.");
      return;
    }
    if (!draftPolygonReady) {
      toast.error("Upload a valid delivery-zone polygon to save.");
      return;
    }
    const record: WholesalerPolygon = {
      id: editingId ?? makeWholesalerPolygonId(),
      fileName:
        draftPolygon.file?.name ??
        draftPolygon.existingName ??
        "wholesaler-zone.geojson",
      data: draftPolygon.data,
      updatedAt: new Date().toISOString(),
      deliveryDays: sortDeliveryDays(draftDays),
    };
    const updated = upsertSellerWholesalerPolygon(seller.id, record);
    if (updated) {
      onChange(updated);
      toast.success(
        editingId
          ? `Wholesaler polygon updated — applies to ${wholesalerCompanies.length} wholesaler compan${wholesalerCompanies.length === 1 ? "y" : "ies"}.`
          : `Wholesaler polygon added — applies to ${wholesalerCompanies.length} wholesaler compan${wholesalerCompanies.length === 1 ? "y" : "ies"}.`,
      );
    }
    setDialogOpen(false);
  };

  // ---- Map view dialog — one zone, or every zone combined ----
  const [mapPolygonId, setMapPolygonId] = useState<string | "all" | null>(
    null,
  );
  const mapData = useMemo(() => {
    if (mapPolygonId === null) return null;
    if (mapPolygonId !== "all") {
      return polygons.find((p) => p.id === mapPolygonId)?.data ?? null;
    }
    const withData = polygons.filter((p) => p.data != null);
    if (withData.length === 0) return null;
    // Merge every zone into one FeatureCollection for the all-zones view.
    const features = withData.flatMap((p) => {
      const d = p.data as { type?: string; features?: unknown[] };
      if (d?.type === "FeatureCollection") return d.features ?? [];
      if (d?.type === "Feature") return [d];
      return [{ type: "Feature", geometry: d, properties: {} }];
    });
    return { type: "FeatureCollection", features };
  }, [mapPolygonId, polygons]);
  const mapPolygon =
    mapPolygonId !== null && mapPolygonId !== "all"
      ? polygons.find((p) => p.id === mapPolygonId)
      : undefined;

  const handleRemove = (polygonId: string) => {
    const updated = removeSellerWholesalerPolygon(seller.id, polygonId);
    if (updated) {
      onChange(updated);
      toast.success("Wholesaler polygon removed.");
    }
  };

  const handleRemoveAll = () => {
    if (
      !window.confirm(
        `Remove all ${polygons.length} wholesaler polygon${polygons.length === 1 ? "" : "s"}? Wholesaler companies will have no serviceable area until a new zone is uploaded. This can't be undone.`,
      )
    )
      return;
    const updated = clearSellerWholesalerPolygons(seller.id);
    if (updated) {
      onChange(updated);
      toast.success("Cleared wholesaler zones");
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-amber-600" />
            Delivery Beats – Wholesaler
          </h3>
          <p className="text-sm text-gray-500 max-w-2xl">
            Day-wise delivery polygons that cover <b>all</b> companies mapped
            as Wholesaler — no per-company zones. Companies linked as
            Wholesaler later inherit every zone automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8"
            disabled={polygons.length === 0}
            onClick={() => setMapPolygonId("all")}
            title={
              polygons.length > 0
                ? "View every wholesaler zone on a map"
                : "Upload a polygon first to see it on the map"
            }
          >
            <MapIcon className="h-3.5 w-3.5" />
            Map view
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Upload className="h-4 w-4" />
            Upload polygon
          </Button>
        </div>
      </div>

      {/* Companies covered by every polygon */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mr-1">
          Applies to
        </span>
        {wholesalerCompanies.length === 0 ? (
          <span className="text-xs text-gray-500">
            No companies mapped as Wholesaler yet.
          </span>
        ) : (
          wholesalerCompanies.map((c) => (
            <Badge
              key={c.id}
              className="bg-amber-50 text-amber-800 border-amber-200 gap-1"
            >
              <Building2 className="h-3 w-3" />
              {c.name}
            </Badge>
          ))
        )}
      </div>

      {polygons.length > 0 ? (
        /* ONE collapsible card — mirrors the distributor company group:
           header row with icon + title + summary badges on the left and
           Map / Upload / delete-all / chevron on the right; expanded
           content is day-first rows (Delivery Day | Zones) with each
           zone as a chip on every day it serves. */
        <Card className="border border-gray-200 p-0 overflow-hidden">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-amber-100 text-amber-700 p-1.5 rounded">
                  <Warehouse className="h-4 w-4" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">
                    Wholesaler Zones
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="bg-white border border-gray-200 text-gray-700 text-[10px] h-4 px-1.5"
                    >
                      {polygons.length} zone
                      {polygons.length === 1 ? "" : "s"}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-white border border-gray-200 text-gray-700 text-[10px] h-4 px-1.5"
                    >
                      {uniqueDays.length} day
                      {uniqueDays.length === 1 ? "" : "s"}
                    </Badge>
                    <span className="text-gray-400 truncate">
                      {uniqueDays.join(" · ")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMapPolygonId("all");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setMapPolygonId("all");
                    }
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-amber-50 text-xs font-medium text-gray-700 cursor-pointer"
                  title="View every wholesaler zone on the map"
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Map
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAdd();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      openAdd();
                    }
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Upload polygon
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAll();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveAll();
                    }
                  }}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 bg-white hover:bg-red-50 text-red-600 cursor-pointer"
                  aria-label="Remove all wholesaler zones"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
                {collapsed ? (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </div>
            </button>

            {!collapsed && (
              <div className="divide-y divide-gray-100">
                {/* Column header — Delivery day | Zones covering that
                    day. Same day-first projection as the distributor
                    view: a zone serving Mon + Tue shows a chip under
                    BOTH rows. */}
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/40">
                  <span>Delivery Day</span>
                  <span>Zones</span>
                </div>
                {byDay.map(({ day, zones }) => (
                  <div
                    key={day}
                    className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-2.5 items-start"
                  >
                    <div className="pt-0.5">
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-medium">
                        {day}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {zones.map((p) => {
                        const dayCount = p.deliveryDays?.length ?? 0;
                        return (
                          <div
                            key={p.id}
                            className="group inline-flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-white hover:border-amber-300 text-xs text-gray-800 transition-colors"
                            title={`Polygon: ${p.fileName}`}
                          >
                            <button
                              type="button"
                              onClick={() => openEdit(p.id)}
                              className="inline-flex items-center gap-1 py-0.5"
                            >
                              <FileJson className="h-3 w-3 text-gray-400" />
                              <span className="font-medium max-w-[260px] truncate">
                                {p.fileName}
                              </span>
                              {dayCount > 1 && (
                                <span className="ml-0.5 text-[10px] text-amber-600 font-medium">
                                  ·{dayCount}d
                                </span>
                              )}
                            </button>
                            {p.data != null && (
                              <button
                                type="button"
                                onClick={() => setMapPolygonId(p.id)}
                                className="inline-flex items-center justify-center h-5 w-5 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title={`View ${p.fileName} polygon on map`}
                              >
                                <MapPin className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(p.id)}
                              className="inline-flex items-center justify-center h-5 w-5 rounded-full text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Edit zone"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(p.id)}
                              className="inline-flex items-center justify-center h-5 w-5 rounded-full text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete zone (all days)"
                              aria-label="Delete zone"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-6 border-2 border-dashed rounded-lg">
          <Warehouse className="h-8 w-8 mx-auto text-gray-300 mb-1.5" />
          <p className="text-sm font-medium text-gray-600">
            No wholesaler polygon uploaded yet
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Use <b>Upload polygon</b> above — add one zone per set of delivery
            days; every zone covers all Wholesaler-mode companies.
          </p>
        </div>
      )}

      {/* ---------- Upload / Edit Polygon dialog ---------- */}
      {/* Mirrors Add Delivery Beat, minus beat name + company — zones
          are seller-wide, so only the delivery days and the polygon
          itself are collected. Editing pre-fills the zone. */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? (
                <Pencil className="h-5 w-5 text-amber-600" />
              ) : (
                <Upload className="h-5 w-5 text-amber-600" />
              )}
              {editingId
                ? "Edit Wholesaler Polygon"
                : "Upload Wholesaler Polygon"}
            </DialogTitle>
            <DialogDescription>
              One zone per set of delivery days — pick the days and upload the
              GeoJSON polygon. Every zone applies to all Wholesaler-mode
              companies; no beat name or company selection needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Delivery days <span className="text-red-500">*</span>
                </Label>
                <span className="text-[11px] text-gray-500">
                  {draftDays.length === 0
                    ? "No days picked"
                    : sortDeliveryDays(draftDays).join(", ")}
                </span>
              </div>
              <DayPicker selected={draftDays} onChange={setDraftDays} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                Polygon (GeoJSON) <span className="text-red-500">*</span>
              </Label>
              <PolygonCell polygon={draftPolygon} onChange={setDraftPolygon} />
              <p className="text-[11px] text-gray-500">
                Required — the zone applies to{" "}
                {wholesalerCompanies.length === 0
                  ? "all wholesaler-mode companies"
                  : `${wholesalerCompanies.length} wholesaler compan${wholesalerCompanies.length === 1 ? "y" : "ies"}`}{" "}
                at once.
              </p>
              {draftPolygon.data != null &&
                (draftPolygon.file === null || draftPolygon.valid) && (
                  <PolygonPreviewMap data={draftPolygon.data} />
                )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveDialog}
              disabled={!canSave}
              className="gap-2"
            >
              {editingId ? (
                <Save className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "Save changes" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Map view dialog — one zone or all zones ---------- */}
      <Dialog
        open={mapPolygonId !== null}
        onOpenChange={(o) => !o && setMapPolygonId(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-amber-600" />
              {mapPolygonId === "all"
                ? "Wholesaler Zones — Map View"
                : "Wholesaler Zone — Map View"}
            </DialogTitle>
            <DialogDescription>
              {mapPolygonId === "all"
                ? `Every wholesaler zone (${polygons.length}) — all apply to every Wholesaler-mode company.`
                : mapPolygon
                  ? `${mapPolygon.fileName}${
                      (mapPolygon.deliveryDays?.length ?? 0) > 0
                        ? ` · Delivered on ${sortDeliveryDays(mapPolygon.deliveryDays ?? []).join(", ")}`
                        : ""
                    }`
                  : ""}
            </DialogDescription>
          </DialogHeader>
          {mapData != null && <PolygonPreviewMap data={mapData} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
