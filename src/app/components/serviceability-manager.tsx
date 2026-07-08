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
  CompanyComboBox,
  type CompanyOption,
} from "./company-combobox";
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
  ChevronDown,
  ChevronRight,
  Building2,
  Route,
  Map as MapIcon,
  Layers,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  ServiceabilityMapDialog,
  PolygonPreviewMap,
  type WarehousePoint,
} from "./serviceability-map-view";
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
  getPolygonId,
  polygonsOverlap,
  type ServiceabilityBeat,
} from "../lib/serviceability-data";
import { ErrorState } from "./error-state";

// Calendar order for chip rows — Monday-first weekly grid.
const DAY_ORDER: DeliveryDay[] = [
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

interface CompanyDayRow {
  day: DeliveryDay;
  beats: ServiceabilityBeat[];
}

interface CompanyGroup {
  companyId: string;
  companyName: string;
  beats: ServiceabilityBeat[];
  uniqueDays: DeliveryDay[];
  /**
   * Day-first projection used by the admin list view — one row per
   * unique delivery day across the company's beats, with each beat
   * appearing as a chip on the day(s) it serves. A beat that covers
   * Monday AND Tuesday shows up as a chip under BOTH rows.
   *
   * Keeps the admin view tight (max one row per day, ≤8) even when
   * the company has dozens of beats.
   */
  byDay: CompanyDayRow[];
}

function groupBeatsByCompany(beats: ServiceabilityBeat[]): CompanyGroup[] {
  const byCompany = new Map<string, ServiceabilityBeat[]>();
  for (const beat of beats) {
    const list = byCompany.get(beat.companyId) ?? [];
    list.push(beat);
    byCompany.set(beat.companyId, list);
  }
  const groups: CompanyGroup[] = [];
  byCompany.forEach((arr, companyId) => {
    const companyName = arr[0]?.companyName ?? companyId;
    const sortedBeats = [...arr].sort((a, b) => {
      const fa = a.deliveryDays[0];
      const fb = b.deliveryDays[0];
      const ra = (fa && DAY_RANK.get(fa)) ?? 99;
      const rb = (fb && DAY_RANK.get(fb)) ?? 99;
      if (ra !== rb) return ra - rb;
      return a.beatName.localeCompare(b.beatName);
    });
    const daySet = new Set<DeliveryDay>();
    for (const b of arr) for (const d of b.deliveryDays) daySet.add(d);
    const uniqueDays = sortDeliveryDays(Array.from(daySet));
    const byDay: CompanyDayRow[] = uniqueDays.map((day) => ({
      day,
      beats: sortedBeats
        .filter((b) => b.deliveryDays.includes(day))
        .sort((a, b) => a.beatName.localeCompare(b.beatName)),
    }));
    groups.push({
      companyId,
      companyName,
      beats: sortedBeats,
      uniqueDays,
      byDay,
    });
  });
  return groups.sort((a, b) => a.companyName.localeCompare(b.companyName));
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
          {polygon.data != null && (
            <button
              type="button"
              onClick={() => {
                const blob = new Blob(
                  [JSON.stringify(polygon.data, null, 2)],
                  { type: "application/geo+json;charset=utf-8;" },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = polygon.existingName ?? "beat.geojson";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-1 text-emerald-700 underline-offset-2 hover:underline"
              title="Download attached polygon"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
          )}
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
          Upload polygon
        </button>
      )}
    </div>
  );
}

// Day picker — multi-select chip grid (checkbox-style). A beat can
// serve one or many weekdays; click a day to toggle it. The Next-Day
// express slot was retired from the UI on June 26, and Sunday was
// removed on July 8 (Sundays are non-delivery days per Qwipo ops), so
// the picker now shows Monday → Saturday in a 4-column grid.
function DayPicker({
  selected,
  onChange,
}: {
  selected: DeliveryDay[];
  onChange: (next: DeliveryDay[]) => void;
}) {
  const weekdays = DELIVERY_DAY_OPTIONS.filter(
    (d) => d !== "Next Day" && d !== "Sunday",
  );
  const selectedSet = new Set(selected);
  const isOn = (d: DeliveryDay) => selectedSet.has(d);
  const toggle = (d: DeliveryDay) => {
    if (selectedSet.has(d)) {
      onChange(selected.filter((x) => x !== d));
    } else {
      onChange([...selected, d]);
    }
  };

  return (
    <div className="space-y-2.5">
      <div role="group" className="grid grid-cols-4 gap-1.5">
        {weekdays.map((d) => {
          const on = isOn(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              role="checkbox"
              aria-checked={on}
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

      <p className="text-[10px] text-gray-500">
        Pick one or more days. Click a selected day to remove it.
      </p>
    </div>
  );
}

const daysKey = (days: DeliveryDay[]) => sortDeliveryDays(days).join("|");

// Save-time conflict surfaced as a full error screen inside the
// Add/Edit dialog. Two reasons, both boil down to "this area is
// already served by another company on different days":
//   • "overlap" — the uploaded polygon geometrically overlaps another
//     company's zone that runs on a different day-set.
//   • "days"    — a beat of the same name already exists under another
//     company with a different day-set.
interface BeatConflict {
  scope: "add" | "edit";
  reason: "overlap" | "days";
  /** The existing beat that clashes. */
  companyName: string;
  beatName: string;
  existingDays: string;
  /** What the user just tried to save. */
  yourBeatName: string;
  yourDays: string;
}

function ConflictErrorView({
  conflict,
  onBack,
}: {
  conflict: BeatConflict;
  onBack: () => void;
}) {
  const isOverlap = conflict.reason === "overlap";
  return (
    <div className="py-2">
      <ErrorState
        icon={isOverlap ? Layers : AlertTriangle}
        tone="danger"
        code={isOverlap ? "Zone overlap" : "Delivery-day clash"}
        title={
          isOverlap
            ? "This zone overlaps another company"
            : "Delivery days don't match"
        }
        description={
          isOverlap
            ? `The polygon you uploaded overlaps ${conflict.companyName}'s "${conflict.beatName}" zone, which delivers on a different set of days. Overlapping areas must share the same delivery days across companies.`
            : `"${conflict.yourBeatName}" already exists for ${conflict.companyName} with different delivery days. The same beat must use the same day-set across every company that runs it.`
        }
        compact
      />
      <div className="mx-auto mt-1 max-w-md rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-red-500">
              Already configured
            </p>
            <p className="mt-1 font-semibold text-red-900">
              {conflict.companyName}
            </p>
            <p className="text-red-700">{conflict.beatName}</p>
            <p className="mt-1 text-red-700">{conflict.existingDays}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-red-500">
              Your beat
            </p>
            <p className="mt-1 font-semibold text-red-900">
              {conflict.yourBeatName}
            </p>
            <p className="mt-1 text-red-700">{conflict.yourDays}</p>
          </div>
        </div>
        <p className="mt-3 border-t border-red-200 pt-2 text-red-800">
          Fix:{" "}
          {isOverlap
            ? "adjust the polygon so it doesn't overlap, or match the delivery days above."
            : "pick the same delivery days shown above, or rename this beat."}
        </p>
      </div>
      <div className="mt-4 flex justify-center">
        <Button onClick={onBack} className="gap-2">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Go back &amp; fix
        </Button>
      </div>
    </div>
  );
}

export function ServiceabilityManager({
  warehouse,
}: {
  /** Distributor's warehouse location — pinned on the Map View. */
  warehouse?: WarehousePoint | null;
} = {}) {
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

  const groups = useMemo(() => groupBeatsByCompany(beats), [beats]);

  // ---- Map View dialog (GIS visualization of beat polygons) ----
  // Three entry points: header button (all beats), company card
  // (filtered to that company), beat chip map-pin (zoomed to that
  // beat's polygon).
  const [mapOpen, setMapOpen] = useState(false);
  const [mapCompanyId, setMapCompanyId] = useState<string | null>(null);
  const [mapFocusBeatId, setMapFocusBeatId] = useState<string | null>(null);
  const openMap = (preset?: { companyId?: string; beatId?: string }) => {
    setMapCompanyId(preset?.companyId ?? null);
    setMapFocusBeatId(preset?.beatId ?? null);
    setMapOpen(true);
  };

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (companyId: string) =>
    setCollapsed((prev) => ({ ...prev, [companyId]: !prev[companyId] }));
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.companyId] = true;
    setCollapsed(next);
  };
  const expandAll = () => setCollapsed({});

  // Save-time conflict → renders an error screen inside the active
  // dialog (overlap / delivery-day clash). Cleared on "go back".
  const [conflict, setConflict] = useState<BeatConflict | null>(null);

  // ---- Edit-single dialog (click a beat to edit one record) ----
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editBeatName, setEditBeatName] = useState("");
  const [editDays, setEditDays] = useState<DeliveryDay[]>([]);
  const [editPolygon, setEditPolygon] = useState<PolygonDraft>(
    emptyPolygonDraft(),
  );
  // Snapshot of the beat as opened — drives the "enable Save only
  // after a change" rule for the Edit dialog.
  const editOriginalRef = useRef<{
    name: string;
    days: string;
    polyId: string;
  } | null>(null);

  const resetEdit = () => {
    setEditingId(null);
    setEditCompanyId("");
    setEditBeatName("");
    setEditDays([]);
    setEditPolygon(emptyPolygonDraft());
    editOriginalRef.current = null;
    setConflict(null);
  };

  const openEdit = (beatId: string) => {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    const days = sortDeliveryDays(
      beat.deliveryDays.filter((d) => d !== "Next Day"),
    );
    setEditingId(beatId);
    setEditCompanyId(beat.companyId);
    setEditBeatName(beat.beatName);
    setEditDays(days);
    setEditPolygon({
      file: null,
      data: beat.polygonData ?? null,
      valid: beat.polygonFileName ? true : null,
      existingName: beat.polygonFileName,
    });
    editOriginalRef.current = {
      name: beat.beatName.trim().toLowerCase(),
      days: daysKey(days),
      polyId: getPolygonId({
        polygonData: beat.polygonData,
        polygonFileName: beat.polygonFileName,
      }),
    };
    setConflict(null);
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!editCompanyId) {
      toast.error("Company is required.");
      return;
    }
    const company = adminCompanies.find((c) => c.id === editCompanyId);
    if (!company) {
      toast.error("Selected company not found.");
      return;
    }
    const beatName = editBeatName.trim();
    if (!beatName) {
      toast.error("Beat name is required.");
      return;
    }
    if (editDays.length === 0) {
      toast.error("Pick at least one delivery day.");
      return;
    }
    // Polygon is mandatory (existing beats carry one; a replacement
    // upload must parse cleanly).
    const editPolygonData = editPolygon.file
      ? editPolygon.data
      : editPolygon.data ?? null;
    if (editPolygonData == null || editPolygon.valid === false) {
      toast.error("Upload a valid delivery-zone polygon to save.");
      return;
    }

    const nameCollision = beats.find(
      (b) =>
        b.id !== editingId &&
        b.companyId === editCompanyId &&
        b.beatName.trim().toLowerCase() === beatName.toLowerCase(),
    );
    if (nameCollision) {
      toast.error(
        `${company.name} already has a beat called "${beatName}". Beat names are unique per company.`,
      );
      return;
    }

    // Cross-company day-consistency check. A distributor runs one
    // delivery operation per area, so the day-set for a beat name
    // must match across every company that uses it. Surfaced as an
    // error screen (not a toast) so the clash is unmissable.
    const editKey = daysKey(editDays);
    const dayConflict = beats.find(
      (b) =>
        b.id !== editingId &&
        b.beatName.trim().toLowerCase() === beatName.toLowerCase() &&
        b.deliveryDays.length > 0 &&
        daysKey(b.deliveryDays) !== editKey,
    );
    // Geometry overlap with a DIFFERENT company running different days.
    const overlapConflict = beats.find(
      (b) =>
        b.id !== editingId &&
        b.companyId !== editCompanyId &&
        b.polygonData != null &&
        daysKey(b.deliveryDays) !== editKey &&
        polygonsOverlap(editPolygonData, b.polygonData),
    );
    const clash = dayConflict ?? overlapConflict;
    if (clash) {
      setConflict({
        scope: "edit",
        reason: dayConflict ? "days" : "overlap",
        companyName: clash.companyName,
        beatName: clash.beatName,
        existingDays: sortDeliveryDays(clash.deliveryDays).join(", "),
        yourBeatName: beatName,
        yourDays: sortDeliveryDays(editDays).join(", "),
      });
      return;
    }

    writeBeats((prev) =>
      prev.map((b) =>
        b.id === editingId
          ? {
              ...b,
              companyId: editCompanyId,
              companyName: company.name,
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
      `Updated "${beatName}" for ${company.name} (${editDays.length} day${editDays.length === 1 ? "" : "s"})`,
    );
    setEditOpen(false);
    resetEdit();
  };

  // ---- Add Delivery Beat dialog (single company, single beat) ----
  // Mirrors the Edit dialog shape on purpose — the bulk multi-company
  // multi-row form was retired in favour of a focused "one company at
  // a time" flow. The only enhancement vs the original v1 form is the
  // multi-day chip picker (a beat can serve more than one weekday).
  const [addOpen, setAddOpen] = useState(false);
  const [addCompanyId, setAddCompanyId] = useState("");
  const [addBeatName, setAddBeatName] = useState("");
  const [addDays, setAddDays] = useState<DeliveryDay[]>([]);
  const [addPolygon, setAddPolygon] = useState<PolygonDraft>(
    emptyPolygonDraft(),
  );

  const resetAdd = () => {
    setAddCompanyId("");
    setAddBeatName("");
    setAddDays([]);
    setAddPolygon(emptyPolygonDraft());
    setConflict(null);
  };

  const openAdd = (preset?: { companyId?: string; day?: DeliveryDay }) => {
    resetAdd();
    if (preset?.companyId) setAddCompanyId(preset.companyId);
    if (preset?.day) setAddDays([preset.day]);
    setConflict(null);
    setAddOpen(true);
  };

  const saveAdd = () => {
    if (!addCompanyId) {
      toast.error("Company is required.");
      return;
    }
    const company = adminCompanies.find((c) => c.id === addCompanyId);
    if (!company) {
      toast.error("Selected company not found.");
      return;
    }
    const beatName = addBeatName.trim();
    if (!beatName) {
      toast.error("Beat name is required.");
      return;
    }
    if (addDays.length === 0) {
      toast.error("Pick at least one delivery day.");
      return;
    }
    // Polygon is now mandatory for every beat.
    if (addPolygon.data == null || addPolygon.valid !== true) {
      toast.error("Upload a valid delivery-zone polygon to save.");
      return;
    }

    // Uniqueness: one beat name per company.
    const nameCollision = beats.find(
      (b) =>
        b.companyId === addCompanyId &&
        b.beatName.trim().toLowerCase() === beatName.toLowerCase(),
    );
    if (nameCollision) {
      toast.error(
        `${company.name} already has a beat called "${beatName}". Beat names are unique per company.`,
      );
      return;
    }

    // Cross-company day-consistency. Distributors run one delivery
    // operation per area, so the day-set for a beat name must match
    // across every company that uses it. A geometric overlap with a
    // different company on different days is the same violation. Both
    // are surfaced as an error screen.
    const addKey = daysKey(addDays);
    const dayConflict = beats.find(
      (b) =>
        b.beatName.trim().toLowerCase() === beatName.toLowerCase() &&
        b.deliveryDays.length > 0 &&
        daysKey(b.deliveryDays) !== addKey,
    );
    const overlapConflict = beats.find(
      (b) =>
        b.companyId !== addCompanyId &&
        b.polygonData != null &&
        daysKey(b.deliveryDays) !== addKey &&
        polygonsOverlap(addPolygon.data, b.polygonData),
    );
    const clash = dayConflict ?? overlapConflict;
    if (clash) {
      setConflict({
        scope: "add",
        reason: dayConflict ? "days" : "overlap",
        companyName: clash.companyName,
        beatName: clash.beatName,
        existingDays: sortDeliveryDays(clash.deliveryDays).join(", "),
        yourBeatName: beatName,
        yourDays: sortDeliveryDays(addDays).join(", "),
      });
      return;
    }

    const created: ServiceabilityBeat = {
      id: makeServiceabilityBeatId(),
      companyId: addCompanyId,
      companyName: company.name,
      beatName,
      deliveryDays: sortDeliveryDays(addDays),
      polygonFileName: addPolygon.file?.name,
      polygonData: addPolygon.data,
      createdAt: new Date().toISOString(),
    };

    writeBeats((prev) => [...prev, created]);
    toast.success(
      `Added "${beatName}" for ${company.name} (${addDays.length} day${addDays.length === 1 ? "" : "s"})`,
    );
    setAddOpen(false);
    resetAdd();
  };

  const deleteBeat = (beatId: string) => {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    writeBeats((prev) => prev.filter((b) => b.id !== beatId));
    toast.success(`Removed beat "${beat.beatName}"`);
  };

  const deleteCompanyAll = (companyId: string) => {
    const co = groups.find((g) => g.companyId === companyId);
    if (!co) return;
    if (
      !window.confirm(
        `Remove all ${co.beats.length} delivery beat${co.beats.length === 1 ? "" : "s"} for ${co.companyName}? This can't be undone.`,
      )
    )
      return;
    writeBeats((prev) => prev.filter((b) => b.companyId !== companyId));
    toast.success(`Cleared ${co.companyName}`);
  };

  const noCompanies = adminCompanies.length === 0;
  const noBeats = groups.length === 0;

  // Options for the searchable Company picker. Built from the seller's
  // linked admin-catalog companies; brandCount drives the small "N
  // brands" subtitle in the combobox row.
  const companyOptions: CompanyOption[] = useMemo(
    () =>
      adminCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        brandCount: c.brands?.length ?? 0,
      })),
    [adminCompanies],
  );

  // ---- Save-button gating ----
  // Save/Update stay disabled until every mandatory field is filled;
  // Update additionally requires an actual change vs the opened beat.
  const addCanSave =
    !!addCompanyId &&
    addBeatName.trim().length > 0 &&
    addDays.length > 0 &&
    addPolygon.valid === true &&
    addPolygon.data != null;

  const editCompanyName =
    adminCompanies.find((c) => c.id === editCompanyId)?.name ?? "";

  const editPolygonReady =
    editPolygon.data != null &&
    (editPolygon.file === null || editPolygon.valid === true);

  const editDirty = (() => {
    const orig = editOriginalRef.current;
    if (!orig) return false;
    const curPolyId = editPolygon.file
      ? `new:${editPolygon.file.name}`
      : getPolygonId({
          polygonData: editPolygon.data,
          polygonFileName: editPolygon.existingName,
        });
    return (
      editBeatName.trim().toLowerCase() !== orig.name ||
      daysKey(editDays) !== orig.days ||
      curPolyId !== orig.polyId
    );
  })();

  const editCanSave =
    editBeatName.trim().length > 0 &&
    editDays.length > 0 &&
    editPolygonReady &&
    editDirty;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Delivery Beats
          </h3>
          <p className="text-sm text-gray-500 max-w-2xl">
            Configure delivery zones once for any number of companies. One
            row per beat, each beat carries the days it&apos;s served on
            (Mon, Tue …). Beat names are unique within a company.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {groups.length > 1 &&
            (Object.values(collapsed).some(Boolean) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={expandAll}
                className="gap-1.5 h-8"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Expand all
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={collapseAll}
                className="gap-1.5 h-8"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Collapse all
              </Button>
            ))}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8"
            disabled={noBeats}
            onClick={() => openMap()}
            title={
              noBeats
                ? "Add delivery beats first to see them on the map"
                : "View all beat polygons on a map"
            }
          >
            <MapIcon className="h-3.5 w-3.5" />
            Map view
          </Button>
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
            Add your first beat — one record per route, with the days the
            distributor visits it.
          </p>
          <Button onClick={() => openAdd()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add delivery beats
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isCollapsed = !!collapsed[g.companyId];
            return (
              <Card
                key={g.companyId}
                className="border border-gray-200 p-0 overflow-hidden"
              >
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(g.companyId)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-indigo-100 text-indigo-700 p-1.5 rounded">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">
                          {g.companyName}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="secondary"
                            className="bg-white border border-gray-200 text-gray-700 text-[10px] h-4 px-1.5"
                          >
                            {g.beats.length} beat
                            {g.beats.length === 1 ? "" : "s"}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="bg-white border border-gray-200 text-gray-700 text-[10px] h-4 px-1.5"
                          >
                            {g.uniqueDays.length} day
                            {g.uniqueDays.length === 1 ? "" : "s"}
                          </Badge>
                          <span className="text-gray-400 truncate">
                            {g.uniqueDays.join(" · ")}
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
                          openMap({ companyId: g.companyId });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            openMap({ companyId: g.companyId });
                          }
                        }}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-indigo-50 text-xs font-medium text-gray-700 cursor-pointer"
                        title={`View ${g.companyName} beats on the map`}
                      >
                        <MapIcon className="h-3.5 w-3.5" />
                        Map
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openAdd({ companyId: g.companyId });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            openAdd({ companyId: g.companyId });
                          }
                        }}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add beats
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCompanyAll(g.companyId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteCompanyAll(g.companyId);
                          }
                        }}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 bg-white hover:bg-red-50 text-red-600 cursor-pointer"
                        aria-label={`Remove all beats for ${g.companyName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-gray-100">
                      {/* Column header — Delivery day | Beats covering
                          that day. Compact admin view: one row per
                          unique day across the company's beats, with
                          each beat appearing as a chip on every day it
                          serves. A beat that covers Mon + Tue thus
                          shows up under BOTH the Monday and Tuesday
                          rows — by design, so admins read the
                          schedule "day-first" without scrolling. */}
                      <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/40">
                        <span>Delivery Day</span>
                        <span>Beats</span>
                      </div>
                      {g.byDay.map(({ day, beats: dayBeats }) => (
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
                                  {beat.deliveryDays.length > 1 && (
                                    <span className="ml-0.5 text-[10px] text-indigo-600 font-medium">
                                      ·{beat.deliveryDays.length}d
                                    </span>
                                  )}
                                </button>
                                {beat.polygonFileName && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMap({ beatId: beat.id })
                                    }
                                    className="inline-flex items-center justify-center h-5 w-5 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    title={`View ${beat.beatName} polygon on map`}
                                  >
                                    <MapPin className="h-3 w-3" />
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
                                  title="Delete beat (all days)"
                                  aria-label="Delete beat"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!noBeats && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-md border border-blue-100 bg-blue-50/60 text-xs text-blue-900">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Admin view is day-first — one row per delivery day, with the
            beats covering it as chips. A beat that serves multiple days
            (e.g. <b>KPHB 1</b> on Mon + Tue) shows up under each day; a
            small <b>·Nd</b> badge on the chip flags how many days the
            beat carries. Click a chip to edit; hover for delete.
          </p>
        </div>
      )}

      {/* ---------- Add Delivery Beat dialog (single company) ---------- */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetAdd();
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              Add Delivery Beat
            </DialogTitle>
            <DialogDescription>
              Configure a delivery beat for a single company. A beat can
              serve <b>one or more weekdays</b>; the same beat name must
              use the same day-set across every company it's added to.
            </DialogDescription>
          </DialogHeader>

          {conflict?.scope === "add" ? (
            <ConflictErrorView
              conflict={conflict}
              onBack={() => setConflict(null)}
            />
          ) : (
          <>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Company <span className="text-red-500">*</span>
              </Label>
              <CompanyComboBox
                companies={companyOptions}
                value={addCompanyId}
                onChange={setAddCompanyId}
                placeholder="Search company linked to this seller…"
                showBrandCount={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Beat name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={addBeatName}
                onChange={(e) => setAddBeatName(e.target.value)}
                placeholder="e.g. KPHB 1"
                maxLength={64}
              />
              <p className="text-[11px] text-gray-500">
                Unique per company. Use the sales route or polygon identifier.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Delivery days <span className="text-red-500">*</span>
                </Label>
                <span className="text-[11px] text-gray-500">
                  {addDays.length === 0
                    ? "No days picked"
                    : sortDeliveryDays(addDays).join(", ")}
                </span>
              </div>
              <DayPicker selected={addDays} onChange={setAddDays} />
              {(() => {
                const name = addBeatName.trim().toLowerCase();
                if (!name || addDays.length === 0) return null;
                const addKey = daysKey(addDays);
                const conflict = beats.find(
                  (b) =>
                    b.beatName.trim().toLowerCase() === name &&
                    b.deliveryDays.length > 0 &&
                    daysKey(b.deliveryDays) !== addKey,
                );
                if (!conflict) return null;
                const conflictDays = sortDeliveryDays(
                  conflict.deliveryDays,
                ).join(", ");
                return (
                  <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      <b>{conflict.beatName}</b> already delivers on{" "}
                      <b>{conflictDays}</b> for{" "}
                      <b>{conflict.companyName}</b>. Match those days to keep
                      the area consistent across companies.
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                Polygon (GeoJSON) <span className="text-red-500">*</span>
              </Label>
              <PolygonCell polygon={addPolygon} onChange={setAddPolygon} />
              <p className="text-[11px] text-gray-500">
                Required — upload the beat&apos;s delivery-zone polygon.
              </p>
              {addPolygon.valid && addPolygon.data != null && (
                <PolygonPreviewMap data={addPolygon.data} />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAdd} disabled={!addCanSave} className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
          </>
          )}
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
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-indigo-600" />
              Edit Delivery Beat
            </DialogTitle>
            <DialogDescription>
              Update the beat name, the days this beat is served on, or
              its polygon. Beat names are unique within a company.
            </DialogDescription>
          </DialogHeader>

          {conflict?.scope === "edit" ? (
            <ConflictErrorView
              conflict={conflict}
              onBack={() => setConflict(null)}
            />
          ) : (
          <>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="font-medium truncate">
                  {editCompanyName || "—"}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
                  <Lock className="h-3 w-3" />
                  Locked
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Company can&apos;t be changed after a beat is created. Create a
                new beat to assign a different company.
              </p>
            </div>

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
                    ? "No days picked"
                    : sortDeliveryDays(editDays).join(", ")}
                </span>
              </div>
              <DayPicker selected={editDays} onChange={setEditDays} />
              {(() => {
                const name = editBeatName.trim().toLowerCase();
                if (!name || editDays.length === 0) return null;
                const editKey = daysKey(editDays);
                const conflict = beats.find(
                  (b) =>
                    b.id !== editingId &&
                    b.beatName.trim().toLowerCase() === name &&
                    b.deliveryDays.length > 0 &&
                    daysKey(b.deliveryDays) !== editKey,
                );
                if (!conflict) return null;
                const conflictDays = sortDeliveryDays(
                  conflict.deliveryDays,
                ).join(", ");
                return (
                  <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      <b>{conflict.beatName}</b> already delivers on{" "}
                      <b>{conflictDays}</b> for{" "}
                      <b>{conflict.companyName}</b>. Match those days to keep
                      the area consistent across companies.
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                Polygon (GeoJSON) <span className="text-red-500">*</span>
              </Label>
              <PolygonCell polygon={editPolygon} onChange={setEditPolygon} />
              <p className="text-[11px] text-gray-500">
                Required — replace the polygon to update this beat&apos;s
                delivery zone.
              </p>
              {editPolygon.data != null &&
                (editPolygon.file === null || editPolygon.valid) && (
                  <PolygonPreviewMap data={editPolygon.data} />
                )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={!editCanSave}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Map View — beat polygons on OSM ---------- */}
      <ServiceabilityMapDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        beats={beats}
        initialCompanyId={mapCompanyId}
        focusBeatId={mapFocusBeatId}
        warehouse={warehouse}
      />
    </div>
  );
}
