// Admin → Connectors → Digidukaan Darkstore Connector → Manage
// -----------------------------------------------------------------
// Every dark store of the connector, in the live portal's columns: name,
// area, logistics account (ONDC LBNP + LSP), serviced area (the polygon,
// under the live "Serviced Pincodes" header), mobile, status. Add / Update
// opens the store dialog — the store details, then the service area as
// an uploaded GeoJSON polygon instead of a pincode list (the same upload
// control as a seller's delivery beats). The polygon also connects the
// sellers: every active seller whose delivery beats reach into it is a
// connected account. A retailer inside the polygon is routed to the
// store.
//
// ?edit=<storeId> opens that store's dialog (the dashboard's Edit Store).
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { EmptyState } from "../../components/empty-state";
import {
  emptyPolygonDraft,
  PolygonCell,
  type PolygonDraft,
} from "../../components/serviceability-manager";
import { PolygonPreviewMap } from "../../components/serviceability-map-view";
import {
  ArrowLeft,
  CheckCircle,
  Hexagon,
  Pencil,
  Plus,
  Search,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { polygonOuterRings } from "../../lib/serviceability-data";
import {
  isLogisticsProvisioned,
  saveDarkStore,
  STORE_FORMATS,
  storeZoneLabel,
  toDarkStoreInput,
  useDarkStores,
  type DarkStore,
  type DarkStoreInput,
} from "../../lib/dark-store-data";

const { mobile: MOBILE, email: EMAIL, ondcCityCode: ONDC_CITY } = STORE_FORMATS;

export function AdminDarkstoreConnector() {
  const navigate = useNavigate();
  const stores = useDarkStores();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // The dialog's store comes from the URL so the dashboard can deep-link.
  const editId = searchParams.get("edit");
  const editing = editId ? stores.find((s) => s.id === editId) : undefined;
  const dialogOpen = creating || editing != null;
  const closeDialog = () => {
    setCreating(false);
    if (editId) setSearchParams({}, { replace: true });
  };

  const q = search.trim().toLowerCase();
  const rows = stores.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || s.areaName.toLowerCase().includes(q),
  );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <button
          type="button"
          onClick={() => navigate("/admin/connectors")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Connectors
        </button>

        {/* Connector header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-lg">
              <Warehouse className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Digidukaan Darkstore Connector</h2>
              <p className="text-sm text-gray-500">
                Qwipo last-mile dark stores deliver on the seller's behalf. Orders route by the
                customer's location inside each store's polygon.
              </p>
            </div>
          </div>
          <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        </div>

        <Card className="overflow-hidden gap-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by dark store name or area name"
                className="pl-10"
              />
            </div>
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Dark Store
            </Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title={stores.length === 0 ? "No dark stores yet" : "No dark stores found"}
              description={
                stores.length === 0
                  ? "Add a dark store, draw its service area and connect seller accounts."
                  : "No dark store matches — try a different name or area."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs uppercase text-gray-500">Dark store name</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500">Area name</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500">Logistics account</TableHead>
                    {/* Header kept as on the live portal; the cell shows the polygon. */}
                    <TableHead className="text-xs uppercase text-gray-500">Serviced pincodes</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500">Mobile number</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500">Status</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-gray-900">{s.name}</TableCell>
                      <TableCell className="text-sm text-gray-700">{s.areaName}</TableCell>
                      <TableCell>
                        {isLogisticsProvisioned(s) ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                            LBNP + LSP
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-700 border-amber-200 bg-amber-50 text-xs"
                            title="Fill the store's mobile, email, address and location to provision it"
                          >
                            Provisioning incomplete
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs text-violet-700">
                          <Hexagon className="h-3 w-3" />
                          Polygon · {storeZoneLabel(s)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{s.mobile || "—"}</TableCell>
                      <TableCell>
                        {s.isActive ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Update dark store"
                          onClick={() => setSearchParams({ edit: s.id }, { replace: true })}
                        >
                          <Pencil className="h-4 w-4 text-gray-700" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        {dialogOpen && (
          // Keyed so switching stores starts a fresh form.
          <DarkStoreDialog key={editing?.id ?? "new"} store={editing} onDone={closeDialog} />
        )}
      </Dialog>
    </div>
  );
}

// ---- Add / Update Dark Store dialog ----

/** Text fields — numbers kept as typed text until save. */
type FormValues = Omit<DarkStoreInput, "latitude" | "longitude" | "zone" | "zoneFileName"> & {
  latitude: string;
  longitude: string;
};

type Errors = Partial<Record<keyof FormValues | "zone", string>>;

const BLANK: FormValues = {
  name: "",
  areaName: "",
  gstNumber: "",
  mobile: "",
  email: "",
  address: "",
  pincode: "",
  city: "",
  state: "Telangana",
  latitude: "",
  longitude: "",
  ondcCityCode: "std:040",
  isActive: true,
};

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function DarkStoreDialog({ store, onDone }: { store?: DarkStore; onDone: () => void }) {
  const stores = useDarkStores();
  const [form, setForm] = useState<FormValues>(() => {
    if (!store) return BLANK;
    const { zone: _z, zoneFileName: _f, latitude, longitude, ...rest } = toDarkStoreInput(store);
    return {
      ...rest,
      latitude: latitude != null ? String(latitude) : "",
      longitude: longitude != null ? String(longitude) : "",
    };
  });
  // The service-area polygon — same upload control as a seller's beats.
  const [polygon, setPolygon] = useState<PolygonDraft>(() =>
    store
      ? {
          file: null,
          data: store.zone,
          valid: true,
          existingName: store.zoneFileName || `${store.areaName} polygon.geojson`,
        }
      : emptyPolygonDraft(),
  );
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const onPolygonChange = (next: PolygonDraft) => {
    setPolygon(next);
    setErrors((e) => ({ ...e, zone: undefined }));
  };
  const zone = polygon.valid ? polygon.data : null;

  // ---- Save ----
  const validate = (): Errors => {
    const e: Errors = {};
    const t = (v: string) => v.trim();
    if (!t(form.name)) e.name = "Enter the dark store name";
    if (!t(form.areaName)) e.areaName = "Enter the area name";
    else if (
      stores.some(
        (s) => s.id !== store?.id && s.areaName.trim().toLowerCase() === t(form.areaName).toLowerCase(),
      )
    )
      e.areaName = "Another dark store already uses this area name";
    if (t(form.gstNumber) && !GSTIN.test(t(form.gstNumber).toUpperCase()))
      e.gstNumber = "Enter a valid 15-character GSTIN";
    if (!MOBILE.test(form.mobile)) e.mobile = "Enter a 10-digit mobile number";
    if (!EMAIL.test(t(form.email))) e.email = "Enter a valid email";
    if (!t(form.address)) e.address = "Enter the store address";
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = "Enter the 6-digit PIN";
    if (!t(form.city)) e.city = "Enter the city";
    if (!t(form.state)) e.state = "Enter the state";
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (form.latitude === "" || !Number.isFinite(lat) || Math.abs(lat) > 90) e.latitude = "Enter a latitude";
    if (form.longitude === "" || !Number.isFinite(lng) || Math.abs(lng) > 180) e.longitude = "Enter a longitude";
    if (!ONDC_CITY.test(t(form.ondcCityCode))) e.ondcCityCode = "Use the format std:040";
    if (!zone) e.zone = "Upload the dark store's service-area polygon";
    else if (polygonOuterRings(zone).length === 0) e.zone = "This file has no polygon — upload a Polygon GeoJSON";
    return e;
  };

  const save = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Fix the highlighted fields before saving");
      return;
    }
    try {
      const saved = saveDarkStore(
        {
          ...form,
          name: form.name.trim(),
          areaName: form.areaName.trim(),
          gstNumber: form.gstNumber.trim().toUpperCase(),
          email: form.email.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          ondcCityCode: form.ondcCityCode.trim(),
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          zone,
          zoneFileName: polygon.file?.name ?? polygon.existingName,
        },
        store?.id,
      );
      toast.success(store ? `Updated ${saved.name}` : `Added ${saved.name}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the dark store.");
    }
  };

  const text = (key: keyof FormValues, label: string, opts: { required?: boolean; placeholder?: string; inputMode?: "numeric" | "decimal" | "email"; maxLength?: number; digits?: boolean } = {}) => (
    <Field label={label} required={opts.required} error={errors[key]}>
      <Input
        value={form[key] as string}
        placeholder={opts.placeholder}
        inputMode={opts.inputMode}
        maxLength={opts.maxLength}
        aria-invalid={!!errors[key]}
        onChange={(e) =>
          set(key, (opts.digits ? e.target.value.replace(/\D/g, "") : e.target.value) as never)
        }
      />
    </Field>
  );

  return (
    <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{store ? "Update Dark Store" : "Add Dark Store"}</DialogTitle>
        <DialogDescription>
          Store details and the polygon it serves. Every retailer inside the polygon is routed to
          this store.
        </DialogDescription>
      </DialogHeader>

      <section className="space-y-4">
          {text("name", "Dark Store Name", { required: true, placeholder: "e.g. Manvik Stores" })}
          <div className="grid grid-cols-2 gap-3">
            {text("areaName", "Area Name", { required: true, placeholder: "e.g. KPHB" })}
            {text("gstNumber", "GST Number", { placeholder: "Optional", maxLength: 15 })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {text("mobile", "Mobile Number", { required: true, placeholder: "10-digit mobile", inputMode: "numeric", maxLength: 10, digits: true })}
            {text("email", "Email", { required: true, placeholder: "store@example.com", inputMode: "email" })}
          </div>
          {text("address", "Store Address", { required: true, placeholder: "Building, street, landmark" })}
          <div className="grid grid-cols-3 gap-3">
            {text("pincode", "Store Pincode", { required: true, placeholder: "500072", inputMode: "numeric", maxLength: 6, digits: true })}
            {text("city", "City", { required: true })}
            {text("state", "State", { required: true })}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {text("latitude", "Latitude", { required: true, inputMode: "decimal", placeholder: "17.4948" })}
            {text("longitude", "Longitude", { required: true, inputMode: "decimal", placeholder: "78.3996" })}
            {text("ondcCityCode", "ONDC City Code", { required: true, placeholder: "std:040" })}
          </div>

          {/* Service area — replaces the pincode list */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              Polygon (GeoJSON) <span className="text-red-500">*</span>
            </Label>
            <PolygonCell polygon={polygon} onChange={onPolygonChange} />
            {errors.zone ? (
              <p className="text-[11px] text-red-600">{errors.zone}</p>
            ) : (
              <p className="text-[11px] text-gray-500">
                Required — upload the dark store&apos;s service-area polygon.
              </p>
            )}
            {zone != null && (
              <PolygonPreviewMap
                data={zone}
                caption="Map preview of the attached polygon — verify it covers the dark store's service area before saving."
              />
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Active</p>
              <p className="text-xs text-gray-500">Inactive stores keep their setup but receive no orders.</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
          </div>
      </section>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save}>{store ? "Update Dark Store" : "Add Dark Store"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
