import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  UserX,
  Building2,
  Tag,
  Users,
  ShieldCheck,
  Phone,
  X,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { psCompanies, psBrands } from "../../lib/product-store-data";

interface BrandManager {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  companyIds: string[];
  brandIds: string[];
  status: "active" | "inactive";
  createdAt: string;
  /** When true, brand and SKU requests from sellers are routed to this manager instead of Catalog Admin */
  routeRequestsToBrandManager: boolean;
}

const initialManagers: BrandManager[] = [
  {
    id: "BM-001",
    name: "Arjun Mehta",
    mobile: "5500000002",
    email: "arjun.mehta@itc.in",
    companyIds: ["ITC"],
    brandIds: ["AASH", "SUNF", "BINGO", "YIPP"],
    status: "active",
    createdAt: "2026-01-15",
    routeRequestsToBrandManager: false,
  },
  {
    id: "BM-002",
    name: "Sneha Kapoor",
    mobile: "5500000003",
    email: "sneha.kapoor@nestle.in",
    companyIds: ["NEST"],
    brandIds: ["MAGGI", "NESTEA", "KITKAT"],
    status: "active",
    createdAt: "2026-02-10",
    routeRequestsToBrandManager: true,
  },
  {
    id: "BM-003",
    name: "Ravi Sharma",
    mobile: "5500000004",
    email: "ravi.sharma@hul.in",
    companyIds: ["HUL"],
    brandIds: ["SURF", "LUX", "DOVE", "LIPT", "KNORR"],
    status: "inactive",
    createdAt: "2026-03-05",
    routeRequestsToBrandManager: false,
  },
];

const emptyForm = {
  name: "",
  mobile: "",
  email: "",
  companyIds: [] as string[],
  brandIds: [] as string[],
  routeRequestsToBrandManager: false,
};

interface PickerOption {
  id: string;
  label: string;
  sublabel?: string;
}

function SearchPicker({
  label,
  icon,
  options,
  selected,
  onAdd,
  onRemove,
  placeholder,
  badgeColor = "teal",
  required,
}: {
  label: string;
  icon: React.ReactNode;
  options: PickerOption[];
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  placeholder: string;
  badgeColor?: "teal" | "indigo";
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unselected = options.filter(
    (o) => !selected.includes(o.id) && o.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const tealChip = "bg-teal-50 text-teal-800 border-teal-200";
  const indigoChip = "bg-indigo-50 text-indigo-800 border-indigo-200";
  const chipClass = badgeColor === "teal" ? tealChip : indigoChip;

  const tealRow = "bg-teal-600 text-white";
  const indigoRow = "bg-indigo-600 text-white";

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const opt = options.find((o) => o.id === id);
            return (
              <span
                key={id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${chipClass}`}
              >
                {opt?.label ?? id}
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            placeholder={placeholder}
            className="pl-8 pr-8 h-8 text-sm"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {unselected.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-2">
                {options.length === selected.length ? "All options selected" : "No results"}
              </p>
            ) : (
              unselected.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onAdd(opt.id); setQuery(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between group transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                    {opt.sublabel && <p className="text-[11px] text-gray-400">{opt.sublabel}</p>}
                  </div>
                  <Plus className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500" />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CatalogAdminBrandManagers() {
  const [managers, setManagers] = useState<BrandManager[]>(initialManagers);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = managers.filter((m) => {
    const q = search.toLowerCase();
    return (
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.mobile.includes(q) ||
      (m.email ?? "").toLowerCase().includes(q) ||
      m.companyIds.some((id) =>
        psCompanies.find((c) => c.id === id)?.name.toLowerCase().includes(q)
      )
    );
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: BrandManager) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      mobile: m.mobile,
      email: m.email ?? "",
      companyIds: [...m.companyIds],
      brandIds: [...m.brandIds],
      routeRequestsToBrandManager: m.routeRequestsToBrandManager,
    });
    setDialogOpen(true);
  };

  const addCompany = (id: string) => {
    setForm((prev) => ({ ...prev, companyIds: [...prev.companyIds, id] }));
  };

  const removeCompany = (id: string) => {
    setForm((prev) => {
      const companyIds = prev.companyIds.filter((c) => c !== id);
      const brandIds = prev.brandIds.filter((bid) => {
        const brand = psBrands.find((b) => b.id === bid);
        return brand && companyIds.includes(brand.companyId);
      });
      return { ...prev, companyIds, brandIds };
    });
  };

  const addBrand = (id: string) => {
    setForm((prev) => ({ ...prev, brandIds: [...prev.brandIds, id] }));
  };

  const removeBrand = (id: string) => {
    setForm((prev) => ({ ...prev, brandIds: prev.brandIds.filter((b) => b !== id) }));
  };

  const availableBrands = psBrands.filter((b) =>
    form.companyIds.includes(b.companyId)
  );

  const companyOptions: PickerOption[] = psCompanies.map((c) => ({ id: c.id, label: c.name }));
  const brandOptions: PickerOption[] = availableBrands.map((b) => ({
    id: b.id,
    label: b.name,
    sublabel: psCompanies.find((c) => c.id === b.companyId)?.name,
  }));

  const isValid = form.name.trim() && form.mobile.trim().length >= 10 && form.companyIds.length > 0;

  const handleSave = () => {
    if (!isValid) return;
    if (editingId) {
      setManagers((prev) =>
        prev.map((m) =>
          m.id === editingId
            ? { ...m, name: form.name, mobile: form.mobile, email: form.email, companyIds: form.companyIds, brandIds: form.brandIds, routeRequestsToBrandManager: form.routeRequestsToBrandManager }
            : m
        )
      );
      toast.success(`Brand Manager "${form.name}" updated.`);
    } else {
      const newManager: BrandManager = {
        id: `BM-${Date.now()}`,
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        companyIds: form.companyIds,
        brandIds: form.brandIds,
        status: "active",
        createdAt: new Date().toISOString().slice(0, 10),
        routeRequestsToBrandManager: form.routeRequestsToBrandManager,
      };
      setManagers((prev) => [newManager, ...prev]);
      toast.success(`Brand Manager "${form.name}" created successfully.`);
    }
    setDialogOpen(false);
  };

  const toggleStatus = (m: BrandManager) => {
    setManagers((prev) =>
      prev.map((bm) =>
        bm.id === m.id
          ? { ...bm, status: bm.status === "active" ? "inactive" : "active" }
          : bm
      )
    );
    toast.success(
      m.status === "active"
        ? `"${m.name}" deactivated.`
        : `"${m.name}" reactivated.`
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600" />
            Brand Managers
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Create and manage Brand Manager logins. Map each manager to their companies and brands.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4" />
          Add Brand Manager
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, mobile, company..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="font-medium">No brand managers found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mobile</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Companies</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Brands</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Routes to BM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const companies = psCompanies.filter((c) => m.companyIds.includes(c.id));
                  const brands = psBrands.filter((b) => m.brandIds.includes(b.id));
                  return (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{m.name}</p>
                        {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                        <code className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded font-mono">{m.id}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-700">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {m.mobile}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {companies.map((c) => (
                            <Badge key={c.id} className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] gap-1">
                              <Building2 className="h-2.5 w-2.5" />
                              {c.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {brands.slice(0, 3).map((b) => (
                            <Badge key={b.id} className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                              {b.name}
                            </Badge>
                          ))}
                          {brands.length > 3 && (
                            <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]">
                              +{brands.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {m.routeRequestsToBrandManager ? (
                          <span className="flex items-center gap-1.5 text-xs text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.status === "active" ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
                            <ShieldCheck className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(m)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit / Remap
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={m.status === "active" ? "text-red-600 focus:text-red-700" : ""}
                              onClick={() => toggleStatus(m)}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              {m.status === "active" ? "Deactivate" : "Reactivate"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              {editingId ? "Edit Brand Manager" : "Add Brand Manager"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this manager's details or company/brand mappings."
                : "Create a login and map the manager to their companies and brands."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g. Arjun Mehta"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* Mobile */}
            <div className="space-y-1.5">
              <Label>Mobile Number *</Label>
              <Input
                placeholder="10-digit mobile"
                value={form.mobile}
                onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label>Email <span className="text-xs text-gray-400 font-normal">(optional)</span></Label>
              <Input
                placeholder="manager@company.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            {/* Route requests to Brand Manager */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <Checkbox
                id="routeRequests"
                checked={form.routeRequestsToBrandManager}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, routeRequestsToBrandManager: !!checked }))
                }
                className="mt-0.5"
              />
              <div className="space-y-1">
                <label htmlFor="routeRequests" className="text-sm font-medium text-gray-900 cursor-pointer">
                  Route brand &amp; SKU requests to Brand Manager
                </label>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  When enabled, seller requests for <strong>brands and SKUs</strong> under this manager's companies will be sent directly to them for approval.
                  <br />
                  <span className="text-gray-400">Company onboarding requests always go to Catalog Admin regardless of this setting.</span>
                </p>
              </div>
            </div>

            {/* Companies */}
            <SearchPicker
              label="Map to Companies"
              icon={<Building2 className="h-3.5 w-3.5 text-teal-600" />}
              options={companyOptions}
              selected={form.companyIds}
              onAdd={addCompany}
              onRemove={removeCompany}
              placeholder="Search companies..."
              badgeColor="teal"
              required
            />

            {/* Brands */}
            {form.companyIds.length > 0 && (
              <div className="space-y-1">
                <SearchPicker
                  label="Map to Brands"
                  icon={<Tag className="h-3.5 w-3.5 text-indigo-600" />}
                  options={brandOptions}
                  selected={form.brandIds}
                  onAdd={addBrand}
                  onRemove={removeBrand}
                  placeholder="Search brands..."
                  badgeColor="indigo"
                />
                <p className="text-[11px] text-gray-400">
                  {form.brandIds.length === 0
                    ? "No specific brands selected — manager will see all brands under mapped companies."
                    : `${form.brandIds.length} brand${form.brandIds.length === 1 ? "" : "s"} selected.`}
                </p>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!isValid}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {editingId ? "Save Changes" : "Create Brand Manager"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
