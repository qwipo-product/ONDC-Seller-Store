import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
  Save,
  MapPin,
  Plus,
  Upload,
  Download,
  FileJson,
  CheckCircle2,
  AlertCircle,
  X,
  Pencil,
  Info,
  Trash2,
  Route,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import {
  getCompanies as getAdminCatalogCompanies,
  subscribeToCompanies,
  type Company as AdminCatalogCompany,
} from "../lib/admin-catalog";
import {
  DELIVERY_DAY_OPTIONS,
  type DeliveryDay,
} from "../lib/customers-data";
import {
  getServiceabilityBeats,
  setServiceabilityBeats,
  subscribeToServiceabilityBeats,
  makeServiceabilityBeatId,
  sortDeliveryDays,
  type ServiceabilityBeat,
} from "../lib/serviceability-data";

// Calendar order for chip rows. "Next Day" sits at the top because
// it's the express slot — visually distinct from the weekly grid.
const DAY_ORDER: DeliveryDay[] = [
  "Next Day",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_RANK = new Map<DeliveryDay, number>(
  DAY_ORDER.map((d, i) => [d, i]),
);

interface DayRow {
  day: DeliveryDay;
  beats: ServiceabilityBeat[];
}

// Day-first projection — one row per unique delivery day across ALL
// beats, with each beat appearing as a chip on the day(s) it serves.
// A beat that covers Monday AND Tuesday shows up under BOTH rows.
function groupBeatsByDay(beats: ServiceabilityBeat[]): DayRow[] {
  const daySet = new Set<DeliveryDay>();
  for (const b of beats) for (const d of b.deliveryDays) daySet.add(d);
  const orderedDays = Array.from(daySet).sort(
    (a, b) => (DAY_RANK.get(a) ?? 99) - (DAY_RANK.get(b) ?? 99),
  );
  return orderedDays.map((day) => ({
    day,
    beats: beats
      .filter((b) => b.deliveryDays.includes(day))
      .sort((a, b) => a.beatName.localeCompare(b.beatName)),
  }));
}

interface PolygonDraft {
  file: File | null;
  data: unknown;
  valid: boolean | null;
  existingName?: string;
}

const emptyPolygonDraft = (): PolygonDraft => ({
  file: null,
  data: null,
  valid: null,
});

interface BeatRow {
  id: string;
  beatName: string;
  deliveryDays: DeliveryDay[];
  polygon: PolygonDraft;
}

const newRowId = () =>
  `row-${Math.random().toString(36).slice(2, 8)}-${Math.random()
    .toString(36)
    .slice(2, 5)}`;

const newBeatRow = (preset?: Partial<BeatRow>): BeatRow => ({
  id: newRowId(),
  beatName: preset?.beatName ?? "",
  deliveryDays: preset?.deliveryDays ?? [],
  polygon: preset?.polygon ?? emptyPolygonDraft(),
});

async function readPolygonFile(file: File): Promise<PolygonDraft> {
  if (!file.name.endsWith(".json") && !file.name.endsWith(".geojson")) {
    toast.error(`${file.name}: not a JSON/GeoJSON file.`);
    return { file, data: null, valid: false };
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error(`${file.name}: file size exceeds 5 MB.`);
    return { file, data: null, valid: false };
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const type = (json as { type?: string }).type;
        if (
          type === "FeatureCollection" ||
          type === "Feature" ||
          type === "Polygon"
        ) {
          resolve({ file, data: json, valid: true });
        } else {
          toast.error(`${file.name}: not a valid GeoJSON shape.`);
          resolve({ file, data: null, valid: false });
        }
      } catch {
        toast.error(`${file.name}: failed to parse JSON.`);
        resolve({ file, data: null, valid: false });
      }
    };
    reader.readAsText(file);
  });
}

function downloadPolygon(
  data: unknown,
  fileName: string | undefined,
  fallback: string,
) {
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/geo+json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName ?? fallback;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function PolygonCell({
  polygon,
  onChange,
  compact,
}: {
  polygon: PolygonDraft;
  onChange: (next: PolygonDraft) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const showExisting = !polygon.file && polygon.existingName;
  const showNew = polygon.file !== null;

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const next = await readPolygonFile(file);
    onChange(next);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        type="file"
        accept=".json,.geojson"
        onChange={handle}
        className="hidden"
      />
      {showNew ? (
        <div
          className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${
            polygon.valid
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <FileJson className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate flex-1" title={polygon.file!.name}>
            {polygon.file!.name}
          </span>
          {polygon.valid && (
            <Badge className="bg-emerald-600 text-white text-[10px] h-4">
              Valid
            </Badge>
          )}
          <button
            type="button"
            onClick={() => onChange(emptyPolygonDraft())}
            className="text-red-600 hover:text-red-800"
            aria-label="Remove polygon"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : showExisting ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate flex-1" title={polygon.existingName}>
            {polygon.existingName}
          </span>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="text-emerald-700 underline-offset-2 hover:underline"
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`flex items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 ${
            compact ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-xs"
          } text-gray-600`}
        >
          <Upload className="h-3.5 w-3.5" />
          Polygon (optional)
        </button>
      )}
    </div>
  );
}

// Day picker — multi-select chip grid for delivery days. Plain
// buttons (not Radix ToggleGroup) so the selected state styles win
// cleanly — the ToggleGroup variants ship a `data-[state=on]:bg-accent`
// baseline that fights chip-style overrides.
//
// Layout: "Next Day" sits on its own full-width row (amber, express),
// then a 4-col grid for the seven weekdays — wraps naturally and
// keeps every label fully visible at any dialog width.
function DayPicker({
  selected,
  onChange,
}: {
  selected: DeliveryDay[];
  onChange: (next: DeliveryDay[]) => void;
}) {
  const weekdays = DELIVERY_DAY_OPTIONS.filter((d) => d !== "Next Day");
  const isOn = (d: DeliveryDay) => selected.includes(d);
  const toggleDay = (d: DeliveryDay) => {
    if (isOn(d)) onChange(selected.filter((x) => x !== d));
    else onChange([...selected, d]);
  };
  const clear = () => onChange([]);

  const nextDayOn = isOn("Next Day");

  return (
    <div className="space-y-2.5">
      {/* Express slot — Next Day on its own wide row. */}
      <button
        type="button"
        onClick={() => toggleDay("Next Day")}
        aria-pressed={nextDayOn}
        className={`h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors ${
          nextDayOn
            ? "bg-amber-50 border-amber-400 text-amber-900 ring-1 ring-amber-200"
            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        {nextDayOn && <CheckCircle2 className="h-3.5 w-3.5" />}
        Next Day (express)
      </button>

      {/* Weekdays — 4-column grid (Mon Tue Wed Thu / Fri Sat Sun). */}
      <div className="grid grid-cols-4 gap-1.5">
        {weekdays.map((d) => {
          const on = isOn(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              aria-pressed={on}
              className={`h-10 w-full inline-flex items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors ${
                on
                  ? "bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-200"
                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {on && <CheckCircle2 className="h-3.5 w-3.5" />}
              {d}
            </button>
          );
        })}
      </div>

      {/* Helper action — quick clear. */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 text-[11px]">
          <button
            type="button"
            onClick={clear}
            className="text-gray-500 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export function ServiceabilityManager() {
  const [adminCompanies, setAdminCompanies] = useState<AdminCatalogCompany[]>(
    () => getAdminCatalogCompanies(),
  );
  useEffect(() => {
    return subscribeToCompanies(() => {
      setAdminCompanies(getAdminCatalogCompanies());
    });
  }, []);

  const [beats, setBeatsState] = useState<ServiceabilityBeat[]>(() =>
    getServiceabilityBeats(),
  );
  useEffect(() => {
    return subscribeToServiceabilityBeats(() => {
      setBeatsState([...getServiceabilityBeats()]);
    });
  }, []);
  const writeBeats = (
    updater:
      | ((prev: ServiceabilityBeat[]) => ServiceabilityBeat[])
      | ServiceabilityBeat[],
  ) => {
    const next =
      typeof updater === "function"
        ? updater(getServiceabilityBeats())
        : updater;
    setServiceabilityBeats(next);
  };

  const dayRows = useMemo(() => groupBeatsByDay(beats), [beats]);
  const companyCount = adminCompanies.length;

  // ---- Edit-single dialog ----
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBeatName, setEditBeatName] = useState("");
  const [editDays, setEditDays] = useState<DeliveryDay[]>([]);
  const [editPolygon, setEditPolygon] = useState<PolygonDraft>(
    emptyPolygonDraft(),
  );

  const resetEdit = () => {
    setEditingId(null);
    setEditBeatName("");
    setEditDays([]);
    setEditPolygon(emptyPolygonDraft());
  };

  const openEdit = (beatId: string) => {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    setEditingId(beatId);
    setEditBeatName(beat.beatName);
    setEditDays(sortDeliveryDays(beat.deliveryDays));
    setEditPolygon({
      file: null,
      data: beat.polygonData ?? null,
      valid: beat.polygonFileName ? true : null,
      existingName: beat.polygonFileName,
    });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const beatName = editBeatName.trim();
    if (!beatName) {
      toast.error("Beat name is required.");
      return;
    }
    if (editDays.length === 0) {
      toast.error("Pick at least one delivery day.");
      return;
    }

    const nameCollision = beats.find(
      (b) =>
        b.id !== editingId &&
        b.beatName.trim().toLowerCase() === beatName.toLowerCase(),
    );
    if (nameCollision) {
      toast.error(
        `A beat called "${beatName}" already exists. Beat names must be unique.`,
      );
      return;
    }

    writeBeats((prev) =>
      prev.map((b) =>
        b.id === editingId
          ? {
              ...b,
              beatName,
              deliveryDays: sortDeliveryDays(editDays),
              polygonFileName: editPolygon.file
                ? editPolygon.file.name
                : editPolygon.existingName ?? b.polygonFileName,
              polygonData: editPolygon.file
                ? editPolygon.data
                : editPolygon.data ?? b.polygonData,
            }
          : b,
      ),
    );
    toast.success(
      `Updated "${beatName}" (${editDays.length} day${editDays.length === 1 ? "" : "s"})`,
    );
    setEditOpen(false);
    resetEdit();
  };

  // ---- Add Delivery Beats dialog ----
  const [addOpen, setAddOpen] = useState(false);
  const [addRows, setAddRows] = useState<BeatRow[]>([newBeatRow()]);

  const resetAdd = () => {
    setAddRows([newBeatRow()]);
  };

  const openAdd = (preset?: { day?: DeliveryDay }) => {
    resetAdd();
    if (preset?.day) {
      setAddRows([newBeatRow({ deliveryDays: [preset.day] })]);
    }
    setAddOpen(true);
  };

  const validAddRows = addRows.filter(
    (r) => r.beatName.trim().length > 0 && r.deliveryDays.length > 0,
  );

  const saveAdd = () => {
    if (validAddRows.length === 0) {
      toast.error(
        "Add at least one beat row with a name and at least one day.",
      );
      return;
    }
    if (validAddRows.some((r) => r.polygon.file && r.polygon.valid !== true)) {
      toast.error("Fix the invalid polygon files before saving.");
      return;
    }

    const created: ServiceabilityBeat[] = [];
    const skipped: string[] = [];
    const now = new Date().toISOString();

    for (const row of validAddRows) {
      const beatName = row.beatName.trim();
      const key = beatName.toLowerCase();
      // Uniqueness: one beat name globally. Beats are distributor-level
      // and apply to every linked company.
      const dbCollision = beats.some(
        (b) => b.beatName.trim().toLowerCase() === key,
      );
      const formCollision = created.some(
        (b) => b.beatName.trim().toLowerCase() === key,
      );
      if (dbCollision || formCollision) {
        skipped.push(beatName);
        continue;
      }
      created.push({
        id: makeServiceabilityBeatId(),
        beatName,
        deliveryDays: sortDeliveryDays(row.deliveryDays),
        polygonFileName: row.polygon.file?.name,
        polygonData: row.polygon.file ? row.polygon.data : undefined,
        createdAt: now,
      });
    }

    if (created.length === 0) {
      toast.error(
        "Nothing to add — every beat name already exists.",
      );
      return;
    }

    writeBeats((prev) => [...prev, ...created]);

    const summary = `Added ${created.length} delivery beat${created.length === 1 ? "" : "s"}.`;
    if (skipped.length > 0) {
      toast.success(
        `${summary} Skipped ${skipped.length} duplicate beat name${skipped.length === 1 ? "" : "s"}.`,
      );
    } else {
      toast.success(summary);
    }
    setAddOpen(false);
    resetAdd();
  };

  const deleteBeat = (beatId: string) => {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    if (
      !window.confirm(
        `Remove the "${beat.beatName}" beat? It will stop applying to every linked company.`,
      )
    )
      return;
    writeBeats((prev) => prev.filter((b) => b.id !== beatId));
    toast.success(`Removed beat "${beat.beatName}"`);
  };

  const noCompanies = adminCompanies.length === 0;
  const noBeats = dayRows.length === 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Delivery Beats
          </h3>
          <p className="text-sm text-gray-500 max-w-2xl">
            Configure delivery zones once — beats apply to every linked
            company. One beat per area, each beat carries the days it
            serves on (Mon, Tue …). Beat names are unique.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            className="gap-2"
            disabled={noCompanies}
            onClick={() => openAdd()}
            title={
              noCompanies
                ? "Link companies via the Companies & Brands tab first"
                : undefined
            }
          >
            <Plus className="h-4 w-4" />
            Add delivery beats
          </Button>
        </div>
      </div>

      {/* Applies-to banner — makes the distributor-level rule obvious
          at a glance. */}
      {!noCompanies && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-md border border-indigo-100 bg-indigo-50/60 text-xs text-indigo-900">
          <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-indigo-600" />
          <p>
            Beats apply to <b>all {companyCount} linked compan{companyCount === 1 ? "y" : "ies"}</b>.
            When you link a new company later, every beat configured
            here automatically extends to it — no re-upload needed.
          </p>
        </div>
      )}

      {noCompanies ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <MapPin className="h-10 w-10 mx-auto text-gray-300 mb-2" />
          <p className="font-medium text-gray-600">No companies linked yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Link Qwipo catalog companies via the Companies &amp; Brands tab
            first, then configure their delivery beats here.
          </p>
        </div>
      ) : noBeats ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <MapPin className="h-10 w-10 mx-auto text-gray-300 mb-2" />
          <p className="font-medium text-gray-600">
            No delivery beats configured yet
          </p>
          <p className="text-sm text-gray-500 mt-1 mb-4 max-w-md mx-auto">
            Add your first beat — one record per area, with the days the
            distributor visits it.
          </p>
          <Button onClick={() => openAdd()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add delivery beats
          </Button>
        </div>
      ) : (
        <Card className="border border-gray-200 p-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {/* Column header — Delivery day | Beats covering that
                  day. Day-first view: one row per unique day, with
                  each beat appearing as a chip on every day it
                  serves. A beat that covers Mon + Tue thus shows up
                  under BOTH rows — by design, so admins read the
                  schedule "day-first" without scrolling. */}
              <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/40">
                <span>Delivery Day</span>
                <span>Beats</span>
              </div>
              {dayRows.map(({ day, beats: dayBeats }) => (
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
                    {dayBeats.map((beat) => (
                      <div
                        key={beat.id}
                        className="group inline-flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-white hover:border-indigo-300 text-xs text-gray-800 transition-colors"
                        title={
                          beat.polygonFileName
                            ? `Polygon: ${beat.polygonFileName}`
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(beat.id)}
                          className="inline-flex items-center gap-1 py-0.5"
                        >
                          <Route className="h-3 w-3 text-gray-400" />
                          <span className="font-medium">
                            {beat.beatName}
                          </span>
                          {beat.polygonFileName && (
                            <MapPin className="h-3 w-3 text-emerald-600" />
                          )}
                          {beat.deliveryDays.length > 1 && (
                            <span className="ml-0.5 text-[10px] text-indigo-600 font-medium">
                              ·{beat.deliveryDays.length}d
                            </span>
                          )}
                        </button>
                        {beat.polygonData && (
                          <button
                            type="button"
                            onClick={() =>
                              downloadPolygon(
                                beat.polygonData,
                                beat.polygonFileName,
                                `${beat.beatName.toLowerCase().replace(/\s+/g, "-")}.geojson`,
                              )
                            }
                            className="inline-flex items-center justify-center h-5 w-5 rounded-full text-gray-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Download polygon"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(beat.id)}
                          className="inline-flex items-center justify-center h-5 w-5 rounded-full text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit beat"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBeat(beat.id)}
                          className="inline-flex items-center justify-center h-5 w-5 rounded-full text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove beat (all days)"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!noBeats && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-md border border-blue-100 bg-blue-50/60 text-xs text-blue-900">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Day-first view — one row per delivery day, with the beats
            covering it as chips. A beat that serves multiple days
            (e.g. <b>KPHB 1</b> on Mon + Tue) shows up under each day;
            a small <b>·Nd</b> badge on the chip flags how many days
            the beat carries. Click a chip to edit; hover for download
            and delete.
          </p>
        </div>
      )}

      {/* ---------- Add Delivery Beats dialog ---------- */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetAdd();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              Add Delivery Beats
            </DialogTitle>
            <DialogDescription>
              Add one or more beats below. Each beat picks its own
              delivery days and applies to every linked company —
              there&apos;s no per-company selection.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b bg-white flex items-center justify-between">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Delivery beats ({addRows.length})
              </div>
              <button
                type="button"
                onClick={() => setAddRows((rows) => [...rows, newBeatRow()])}
                className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add row
              </button>
            </div>
            <div className="max-h-[28rem] overflow-y-auto p-3 space-y-3 bg-gray-50/50">
              {addRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 space-y-3 shadow-sm"
                >
                  {/* Row header — Beat # label + remove button. */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                      Beat {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAddRows((rows) =>
                          rows.length === 1
                            ? rows
                            : rows.filter((r) => r.id !== row.id),
                        )
                      }
                      className={`inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600 ${
                        addRows.length === 1
                          ? "opacity-30 cursor-not-allowed"
                          : ""
                      }`}
                      aria-label={`Remove row ${idx + 1}`}
                      disabled={addRows.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  {/* Beat name + Polygon side-by-side. */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(0,220px)] gap-3">
                    <div>
                      <Label className="text-[10px] text-gray-500 mb-1 block">
                        Beat name *
                      </Label>
                      <Input
                        value={row.beatName}
                        onChange={(e) =>
                          setAddRows((rows) =>
                            rows.map((r) =>
                              r.id === row.id
                                ? { ...r, beatName: e.target.value }
                                : r,
                            ),
                          )
                        }
                        placeholder="e.g. KPHB 1"
                        className="h-9 text-sm"
                        maxLength={64}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500 mb-1 block">
                        Polygon
                      </Label>
                      <PolygonCell
                        polygon={row.polygon}
                        onChange={(p) =>
                          setAddRows((rows) =>
                            rows.map((r) =>
                              r.id === row.id ? { ...r, polygon: p } : r,
                            ),
                          )
                        }
                        compact
                      />
                    </div>
                  </div>

                  {/* Day picker — full row width so chips can breathe. */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-[10px] text-gray-500">
                        Delivery days *
                      </Label>
                      <span className="text-[10px] text-gray-500">
                        {row.deliveryDays.length === 0
                          ? "No day picked"
                          : `${row.deliveryDays.length} day${row.deliveryDays.length === 1 ? "" : "s"} picked`}
                      </span>
                    </div>
                    <DayPicker
                      selected={row.deliveryDays}
                      onChange={(days) =>
                        setAddRows((rows) =>
                          rows.map((r) =>
                            r.id === row.id
                              ? { ...r, deliveryDays: days }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAddRows((rows) => [...rows, newBeatRow()])}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 text-xs text-gray-600"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another beat
              </button>
            </div>
          </div>

          <div className="text-[11px] text-gray-600 bg-indigo-50/60 border border-indigo-200 rounded-md px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-indigo-600 mt-0.5 shrink-0" />
            <span>
              We&apos;ll create <b>{validAddRows.length} beat{validAddRows.length === 1 ? "" : "s"}</b> — applied to all {companyCount} linked compan{companyCount === 1 ? "y" : "ies"}. Beat names must be unique; duplicates are skipped silently.
            </span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAdd} className="gap-2">
              <Save className="h-4 w-4" />
              Create delivery beats
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Edit single delivery beat dialog ---------- */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) resetEdit();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-indigo-600" />
              Edit Delivery Beat
            </DialogTitle>
            <DialogDescription>
              Update the beat name, the days this beat is served on, or
              its polygon. Beat names must be unique. Changes apply to
              every linked company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Beat name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={editBeatName}
                onChange={(e) => setEditBeatName(e.target.value)}
                placeholder="e.g. KPHB 1"
                maxLength={64}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Delivery days <span className="text-red-500">*</span>
                </Label>
                <span className="text-[11px] text-gray-500">
                  {editDays.length === 0
                    ? "No day picked"
                    : `${editDays.length} day${editDays.length === 1 ? "" : "s"} picked`}
                </span>
              </div>
              <DayPicker selected={editDays} onChange={setEditDays} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Polygon (GeoJSON, optional)</Label>
              <PolygonCell polygon={editPolygon} onChange={setEditPolygon} />
              {editPolygon.existingName && !editPolygon.file && (
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                  <span>Polygon already attached.</span>
                  <button
                    type="button"
                    onClick={() =>
                      downloadPolygon(
                        editPolygon.data,
                        editPolygon.existingName,
                        "beat.geojson",
                      )
                    }
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Download current
                  </button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} className="gap-2">
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
