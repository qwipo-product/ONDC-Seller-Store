import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
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
  Search,
  Route,
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

// Day picker — multi-select chip grid (checkbox-style). A beat can
// serve one or many weekdays; click a day to toggle it. The Next-Day
// express slot was retired from the UI on June 26, so the picker now
// shows only the seven weekdays in a 4-column grid.
function DayPicker({
  selected,
  onChange,
}: {
  selected: DeliveryDay[];
  onChange: (next: DeliveryDay[]) => void;
}) {
  const weekdays = DELIVERY_DAY_OPTIONS.filter((d) => d !== "Next Day");
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

  const groups = useMemo(() => groupBeatsByCompany(beats), [beats]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (companyId: string) =>
    setCollapsed((prev) => ({ ...prev, [companyId]: !prev[companyId] }));
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.companyId] = true;
    setCollapsed(next);
  };
  const expandAll = () => setCollapsed({});

  // ---- Edit-single dialog (click a beat to edit one record) ----
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editBeatName, setEditBeatName] = useState("");
  const [editDays, setEditDays] = useState<DeliveryDay[]>([]);
  const [editPolygon, setEditPolygon] = useState<PolygonDraft>(
    emptyPolygonDraft(),
  );

  const resetEdit = () => {
    setEditingId(null);
    setEditCompanyId("");
    setEditBeatName("");
    setEditDays([]);
    setEditPolygon(emptyPolygonDraft());
  };

  const openEdit = (beatId: string) => {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    setEditingId(beatId);
    setEditCompanyId(beat.companyId);
    setEditBeatName(beat.beatName);
    setEditDays(sortDeliveryDays(beat.deliveryDays.filter((d) => d !== "Next Day")));
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
    // must match across every company that uses it.
    const editKey = daysKey(editDays);
    const dayConflict = beats.find(
      (b) =>
        b.id !== editingId &&
        b.beatName.trim().toLowerCase() === beatName.toLowerCase() &&
        b.deliveryDays.length > 0 &&
        daysKey(b.deliveryDays) !== editKey,
    );
    if (dayConflict) {
      const conflictDays = sortDeliveryDays(dayConflict.deliveryDays).join(", ");
      toast.error(
        `"${beatName}" already delivers on ${conflictDays} for ${dayConflict.companyName}. Match those days to keep the area consistent across companies.`,
      );
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

  // ---- Unified Add Delivery Beats dialog ----
  const [addOpen, setAddOpen] = useState(false);
  const [addSelectedCompanies, setAddSelectedCompanies] = useState<
    Record<string, boolean>
  >({});
  const [addRows, setAddRows] = useState<BeatRow[]>([newBeatRow()]);
  const [addSearch, setAddSearch] = useState("");

  const resetAdd = () => {
    setAddSelectedCompanies({});
    setAddRows([newBeatRow()]);
    setAddSearch("");
  };

  const openAdd = (preset?: { companyId?: string; day?: DeliveryDay }) => {
    resetAdd();
    if (preset?.companyId) {
      setAddSelectedCompanies({ [preset.companyId]: true });
    }
    if (preset?.day) {
      setAddRows([newBeatRow({ deliveryDays: [preset.day] })]);
    }
    setAddOpen(true);
  };

  const filteredAdminCompanies = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    if (!q) return adminCompanies;
    return adminCompanies.filter((c) => c.name.toLowerCase().includes(q));
  }, [adminCompanies, addSearch]);
  const addSelectedCount =
    Object.values(addSelectedCompanies).filter(Boolean).length;
  const allVisibleSelected =
    filteredAdminCompanies.length > 0 &&
    filteredAdminCompanies.every((c) => addSelectedCompanies[c.id]);
  const anyVisibleSelected = filteredAdminCompanies.some(
    (c) => addSelectedCompanies[c.id],
  );

  const selectAllVisible = () => {
    const next = { ...addSelectedCompanies };
    for (const c of filteredAdminCompanies) next[c.id] = true;
    setAddSelectedCompanies(next);
  };
  const clearAllVisible = () => {
    const next = { ...addSelectedCompanies };
    for (const c of filteredAdminCompanies) delete next[c.id];
    setAddSelectedCompanies(next);
  };

  const validAddRows = addRows.filter(
    (r) => r.beatName.trim().length > 0 && r.deliveryDays.length > 0,
  );

  const saveAdd = () => {
    const companyIds = Object.entries(addSelectedCompanies)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (companyIds.length === 0) {
      toast.error("Select at least one company.");
      return;
    }
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

    // Cross-company day-consistency pre-check. Distributors run one
    // delivery operation per area, so a beat name's day must match
    // across every company. We check both (a) form rows against each
    // other and (b) form rows against the database before persisting.
    // First mismatch found blocks the entire save with a precise
    // error so the seller can fix the day and retry.
    const rowsByKey = new Map<string, BeatRow>();
    for (const row of validAddRows) {
      const key = row.beatName.trim().toLowerCase();
      const existing = rowsByKey.get(key);
      if (existing && daysKey(existing.deliveryDays) !== daysKey(row.deliveryDays)) {
        toast.error(
          `"${row.beatName.trim()}" appears twice in this form with different day-sets (${sortDeliveryDays(existing.deliveryDays).join(", ")} and ${sortDeliveryDays(row.deliveryDays).join(", ")}). One beat name = one day-set.`,
        );
        return;
      }
      if (!existing) rowsByKey.set(key, row);
    }
    for (const row of validAddRows) {
      const key = row.beatName.trim().toLowerCase();
      const rowKey = daysKey(row.deliveryDays);
      const dbConflict = beats.find(
        (b) =>
          b.beatName.trim().toLowerCase() === key &&
          b.deliveryDays.length > 0 &&
          daysKey(b.deliveryDays) !== rowKey,
      );
      if (dbConflict) {
        const conflictDays = sortDeliveryDays(dbConflict.deliveryDays).join(", ");
        toast.error(
          `"${row.beatName.trim()}" already delivers on ${conflictDays} for ${dbConflict.companyName}. Match those days to keep the area consistent across companies.`,
        );
        return;
      }
    }

    const created: ServiceabilityBeat[] = [];
    const skipped: string[] = [];
    const now = new Date().toISOString();
    const lookupCompany = (id: string) =>
      adminCompanies.find((c) => c.id === id);

    for (const cid of companyIds) {
      const company = lookupCompany(cid);
      if (!company) continue;
      for (const row of validAddRows) {
        const beatName = row.beatName.trim();
        const key = beatName.toLowerCase();
        // Uniqueness: one beat name per company. Same name on a
        // different company is fine — and per the day-consistency
        // rule above, every same-named beat across companies now
        // shares the same delivery day too.
        const dbCollision = beats.some(
          (b) =>
            b.companyId === cid &&
            b.beatName.trim().toLowerCase() === key,
        );
        const formCollision = created.some(
          (b) =>
            b.companyId === cid &&
            b.beatName.trim().toLowerCase() === key,
        );
        if (dbCollision || formCollision) {
          skipped.push(`${company.name} · ${beatName}`);
          continue;
        }
        created.push({
          id: makeServiceabilityBeatId(),
          companyId: cid,
          companyName: company.name,
          beatName,
          deliveryDays: sortDeliveryDays(row.deliveryDays),
          polygonFileName: row.polygon.file?.name,
          polygonData: row.polygon.file ? row.polygon.data : undefined,
          createdAt: now,
        });
      }
    }

    if (created.length === 0) {
      toast.error(
        "Nothing to add — every (company × beat name) combination already exists.",
      );
      return;
    }

    writeBeats((prev) => [...prev, ...created]);

    const summary = `Added ${created.length} delivery beat${created.length === 1 ? "" : "s"} across ${companyIds.length} compan${companyIds.length === 1 ? "y" : "ies"}.`;
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

  const downloadPolygon = (
    data: unknown,
    fileName: string | undefined,
    fallback: string,
  ) => {
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
  const previewCount = addSelectedCount * validAddRows.length;

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
                                  {beat.polygonFileName && (
                                    <MapPin className="h-3 w-3 text-emerald-600" />
                                  )}
                                  {beat.deliveryDays.length > 1 && (
                                    <span className="ml-0.5 text-[10px] text-indigo-600 font-medium">
                                      ·{beat.deliveryDays.length}d
                                    </span>
                                  )}
                                </button>
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

      {/* ---------- Unified Add Delivery Beats dialog ---------- */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetAdd();
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              Add Delivery Beats
            </DialogTitle>
            <DialogDescription>
              Pick one or many companies on the left, then list each beat
              on the right. A beat can serve <b>one or more weekdays</b>;
              the same beat name must use the same day-set across every
              company it's added to.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-1">
            <div className="md:col-span-4 border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50">
              <div className="px-3 py-2 border-b bg-white flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Companies ({addSelectedCount})
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    disabled={
                      filteredAdminCompanies.length === 0 || allVisibleSelected
                    }
                    className="text-indigo-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    type="button"
                    onClick={clearAllVisible}
                    disabled={!anyVisibleSelected}
                    className="text-indigo-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <div className="px-3 py-2 border-b bg-white">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder="Search company"
                    className="pl-7 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="h-[28rem] overflow-y-auto p-2 space-y-1">
                {filteredAdminCompanies.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-6">
                    No matches.
                  </p>
                ) : (
                  filteredAdminCompanies.map((c) => {
                    const checked = !!addSelectedCompanies[c.id];
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${
                          checked
                            ? "bg-indigo-50 border border-indigo-200"
                            : "bg-white border border-transparent hover:border-gray-200"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setAddSelectedCompanies((prev) => ({
                              ...prev,
                              [c.id]: !!v,
                            }))
                          }
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="md:col-span-8 border border-gray-200 rounded-lg overflow-hidden">
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

                    {/* Beat name + Polygon side-by-side. Beat name takes
                        most of the row; polygon sits compact next to it. */}
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
                            ? "No days picked"
                            : sortDeliveryDays(row.deliveryDays).join(", ")}
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
                      {(() => {
                        const name = row.beatName.trim().toLowerCase();
                        if (!name || row.deliveryDays.length === 0) return null;
                        const rowKey = daysKey(row.deliveryDays);
                        const conflict = beats.find(
                          (b) =>
                            b.beatName.trim().toLowerCase() === name &&
                            b.deliveryDays.length > 0 &&
                            daysKey(b.deliveryDays) !== rowKey,
                        );
                        if (!conflict) return null;
                        const conflictDays = sortDeliveryDays(
                          conflict.deliveryDays,
                        ).join(", ");
                        return (
                          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                            <span>
                              <b>{conflict.beatName}</b> already delivers on{" "}
                              <b>{conflictDays}</b> for{" "}
                              <b>{conflict.companyName}</b>. Match those days to
                              keep the area consistent across companies.
                            </span>
                          </div>
                        );
                      })()}
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
          </div>

          <div className="text-[11px] text-gray-600 bg-indigo-50/60 border border-indigo-200 rounded-md px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-indigo-600 mt-0.5 shrink-0" />
            <span>
              We&apos;ll create{" "}
              <b>
                {addSelectedCount} × {validAddRows.length} = {previewCount} beat
                {previewCount === 1 ? "" : "s"}
              </b>{" "}
              when you save. Beat names must be unique within a company —
              duplicates are skipped silently.
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
              its polygon. Beat names are unique within a company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Company <span className="text-red-500">*</span>
              </Label>
              <Select
                value={editCompanyId}
                onValueChange={setEditCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a company" />
                </SelectTrigger>
                <SelectContent>
                  {adminCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
