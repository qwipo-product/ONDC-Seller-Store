import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Plus,
  Building2,
  Tag,
  Pencil,
  X,
  Search,
  AlertCircle,
  LayoutGrid,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { toast } from "sonner";
import {
  AdminCategory,
  Brand,
  Company,
  getCompanies,
  makeCompanyCategorySeed,
  makeId,
  revokeImage,
  setCompanies,
  subscribeToCompanies,
} from "../../lib/admin-catalog";
import { EmptyState } from "../../components/empty-state";
import { ImageUploader } from "../../components/ui/image-uploader";

interface DraftBrand {
  id: string;
  name: string;
  imageUrl: string | null;
  /** True for brands already saved on the company. They cannot be removed
   *  during edit — only new draft brands added in the current session may
   *  be deleted. */
  isExisting?: boolean;
}

export function AdminCompanies() {
  const navigate = useNavigate();
  const [companies, setCompaniesState] = useState<Company[]>(getCompanies());
  const [search, setSearch] = useState("");

  // Subscribe so seller-add (or anything else) keeps us in sync.
  useEffect(() => {
    return subscribeToCompanies(() => setCompaniesState([...getCompanies()]));
  }, []);

  // Create / Edit dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftBrand[]>([
    { id: makeId("br"), name: "", imageUrl: null },
  ]);
  // Per-company ONDC category list (37 entries — auto-seeded for new companies)
  const [draftCategories, setDraftCategories] = useState<AdminCategory[]>(
    makeCompanyCategorySeed(),
  );
  const [categorySearch, setCategorySearch] = useState("");
  const [activeTab, setActiveTab] = useState("brands");
  // Inline form errors. Surfaces in red text under the relevant field
  // instead of a popup, so users see what to fix without losing context.
  const [errors, setErrors] = useState<{ name?: string; brands?: string }>({});

  // Edit-mode dirty tracking. In Edit, the Save button starts disabled —
  // pre-filled fields satisfy the validity check, but until the admin
  // actually changes something there's nothing to save. Any logo swap,
  // new brand row, brand-name edit, brand-logo upload, or category cover
  // change flips this to true. Reset every time the dialog re-opens.
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);

  // Derived: form is submittable only when there is a name AND at least one
  // non-empty brand. In Edit mode we additionally require something has
  // changed; in Create mode every keystroke counts as progress.
  const trimmedName = name.trim();
  const hasValidBrand = drafts.some((b) => b.name.trim() !== "");
  const canSubmit =
    trimmedName !== "" && hasValidBrand && (!editingId || isDirty);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setImageUrl(null);
    setDrafts([{ id: makeId("br"), name: "", imageUrl: null }]);
    // New companies start with all 37 ONDC categories (no images yet)
    setDraftCategories(makeCompanyCategorySeed());
    setCategorySearch("");
    setActiveTab("brands");
    setErrors({});
    setIsDirty(false);
    setIsOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditingId(c.id);
    setName(c.name);
    setImageUrl(c.imageUrl);
    setDrafts(
      c.brands.length > 0
        ? c.brands.map((b) => ({
            id: b.id,
            name: b.name,
            imageUrl: b.imageUrl,
            isExisting: true, // existing brands are locked from deletion
          }))
        : [{ id: makeId("br"), name: "", imageUrl: null }],
    );
    // Edit existing categories (or seed from scratch if missing on legacy records)
    setDraftCategories(
      c.categories && c.categories.length > 0
        ? c.categories.map((cat) => ({ ...cat }))
        : makeCompanyCategorySeed(),
    );
    setCategorySearch("");
    setActiveTab("brands");
    setErrors({});
    setIsDirty(false);
    setIsOpen(true);
  };

  // Category image handler — operate on the in-dialog draft only;
  // persisted to the company record on Save. `file === null` clears.
  const handleCategoryImage = (catName: string, file: File | null) => {
    setDraftCategories((prev) =>
      prev.map((c) => {
        if (c.name !== catName) return c;
        revokeImage(c.imageUrl);
        return {
          ...c,
          imageUrl: file ? URL.createObjectURL(file) : null,
        };
      }),
    );
    markDirty();
  };

  const handleCompanyImage = (file: File | null) => {
    revokeImage(imageUrl);
    setImageUrl(file ? URL.createObjectURL(file) : null);
    markDirty();
  };

  const handleBrandImage = (idx: number, file: File | null) => {
    setDrafts((prev) => {
      const next = [...prev];
      revokeImage(next[idx].imageUrl);
      next[idx] = {
        ...next[idx],
        imageUrl: file ? URL.createObjectURL(file) : null,
      };
      return next;
    });
    markDirty();
  };

  const updateBrandName = (idx: number, value: string) => {
    setDrafts((prev) => prev.map((b, i) => (i === idx ? { ...b, name: value } : b)));
    markDirty();
  };

  const addBrandRow = () => {
    setDrafts((prev) => [...prev, { id: makeId("br"), name: "", imageUrl: null }]);
    markDirty();
  };

  const removeBrandRow = (idx: number) => {
    setDrafts((prev) => {
      revokeImage(prev[idx].imageUrl);
      return prev.filter((_, i) => i !== idx);
    });
    markDirty();
  };

  const handleSave = () => {
    const nextErrors: { name?: string; brands?: string } = {};
    if (!name.trim()) nextErrors.name = "Company Name is required.";
    const validBrands = drafts.filter((b) => b.name.trim() !== "");
    if (validBrands.length === 0)
      nextErrors.brands = "Add at least one brand for this company.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    const existing = editingId ? companies.find((c) => c.id === editingId) : undefined;
    const company: Company = {
      id: editingId ?? makeId("co"),
      name: name.trim(),
      imageUrl,
      isActive: existing?.isActive ?? true,
      brands: validBrands.map<Brand>((b) => ({
        id: b.id,
        name: b.name.trim(),
        imageUrl: b.imageUrl,
      })),
      categories: draftCategories.map((c) => ({ ...c })),
    };
    const next = editingId
      ? companies.map((c) => (c.id === editingId ? company : c))
      : [company, ...companies];
    setCompanies(next);
    toast.success(`Company "${company.name}" ${editingId ? "updated" : "created"}`);
    setIsOpen(false);
  };

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return (
      q === "" ||
      c.name.toLowerCase().includes(q) ||
      c.brands.some((b) => b.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Toolbar — same shape as the Sellers page so admin pages feel
          uniform: a count on the left, search + primary CTA on the right.
          The page title comes from the topbar (RootLayout). */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {filtered.length} compan{filtered.length === 1 ? "y" : "ies"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company name or brand name..."
                className="pl-10"
              />
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Company
            </Button>
          </div>
        </div>
      </div>

      {/* List — when empty the Card stretches to fill the viewport;
          when there are companies the inner list scrolls within the
          page area. Mirrors the Sellers / Error Screens shape. */}
      <div className="flex-1 overflow-hidden p-6">
        {filtered.length === 0 ? (
          <Card className="h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Building2}
                title={
                  companies.length === 0
                    ? "No companies yet"
                    : "No companies found"
                }
                description={
                  companies.length === 0
                    ? "No companies yet — click + Add Company to onboard the first one."
                    : "No companies found — try a different search term."
                }
                action={
                  companies.length === 0 ? (
                    <Button onClick={openCreate} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Company
                    </Button>
                  ) : undefined
                }
              />
            </div>
          </Card>
        ) : (
          <div className="h-full overflow-y-auto space-y-3">
            {filtered.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      {c.brands.length} brand{c.brands.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.brands.map((b) => (
                      <div
                        key={b.id}
                        className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-2 py-0.5 text-xs"
                      >
                        <div className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                          {b.imageUrl ? (
                            <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                          ) : (
                            <Tag className="h-2.5 w-2.5 text-gray-400" />
                          )}
                        </div>
                        <span className="text-gray-800">{b.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Edit">
                    <Pencil className="h-4 w-4 text-gray-700" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {/* Flex column: header stays pinned at the top, body scrolls if it
            overflows, footer is sticky at the bottom. This stops the Save
            button from going off-screen as more brand rows are added. */}
        <DialogContent className="!max-w-[min(95vw,800px)] w-[min(95vw,800px)] max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              {editingId ? "Edit Company" : "Add Company"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the logo, add new brands, refresh brand logos, or change category cover images. Names are read-only."
                : "Add the company name, logo, and at least one brand. You can add more brands now or later."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
            {/* Company name + logo. Grid column matches the ImageUploader
                tile width (96px @ size="md") so the logo never spills over
                onto the Company Name input. */}
            <div className="grid grid-cols-1 md:grid-cols-[96px_1fr] gap-4 items-start">
              <div className="space-y-1">
                <Label className="text-xs">Logo</Label>
                <ImageUploader
                  value={imageUrl}
                  onChange={handleCompanyImage}
                  size="md"
                  alt="Company logo"
                  placeholder="Upload"
                  helper={null}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Company Name {!editingId && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                  }}
                  placeholder="e.g. ITC Limited"
                  // Company name is fixed once created; only the logo, brand
                  // list (extend) and category covers can be modified on Edit.
                  readOnly={!!editingId}
                  disabled={!!editingId}
                  className={editingId ? "bg-gray-50" : undefined}
                  aria-invalid={!!errors.name}
                />
                {errors.name ? (
                  <p className="text-[11px] text-red-600">{errors.name}</p>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    {editingId
                      ? "Company name is read-only — it cannot be changed once created."
                      : "This is the legal entity. Brands sit under it."}
                  </p>
                )}
              </div>
            </div>

            {/* Brands / Categories tabs — every company has its own copy of
                the 37 ONDC categories with company-specific images. */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-gray-100 p-1 rounded-lg inline-flex gap-1 h-auto">
                <TabsTrigger
                  value="brands"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm"
                >
                  <Tag className="h-4 w-4 mr-2 text-purple-600" />
                  Brands
                  <Badge className="ml-2 bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                    {drafts.filter((b) => b.name.trim() !== "").length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 text-sm"
                >
                  <LayoutGrid className="h-4 w-4 mr-2 text-pink-600" />
                  Categories
                  <Badge className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    {draftCategories.filter((c) => c.imageUrl).length}/{draftCategories.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Brands tab */}
              <TabsContent value="brands" className="mt-3">
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-3 py-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Tag className="h-4 w-4 text-purple-600" />
                      Brands
                      <span className="text-red-500">*</span>
                    </p>
                    <Button variant="outline" size="sm" onClick={addBrandRow} className="gap-1 h-7 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Add brand
                    </Button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {drafts.map((b, i) => (
                      <BrandRow
                        key={b.id}
                        brand={b}
                        onName={(v) => updateBrandName(i, v)}
                        onImage={(f) => handleBrandImage(i, f)}
                        onRemove={() => removeBrandRow(i)}
                        // Existing brands cannot be deleted in Edit mode —
                        // newly added drafts within this session still can be.
                        canRemove={!b.isExisting && drafts.length > 1}
                        removeBlockedReason={
                          b.isExisting
                            ? "Existing brands cannot be removed"
                            : drafts.length === 1
                              ? "At least one brand is required"
                              : undefined
                        }
                      />
                    ))}
                  </div>
                  <div className="px-3 py-2 bg-blue-50 border-t border-blue-100 text-[11px] text-blue-900 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Add new brands as needed. Existing brands cannot be removed.
                  </div>
                </div>
                {errors.brands && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.brands}
                  </p>
                )}
              </TabsContent>

              {/* Categories tab — per-company ONDC category images */}
              <TabsContent value="categories" className="mt-3">
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-3 py-2 gap-2 flex-wrap">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-pink-600" />
                      Company Categories
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {draftCategories.filter((c) => c.imageUrl).length} / {draftCategories.length} with images
                      </Badge>
                    </p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Search category..."
                        className="pl-8 h-7 text-xs w-56"
                      />
                    </div>
                  </div>
                  <div className="p-3 max-h-[420px] overflow-y-auto">
                    {(() => {
                      const filteredCats = draftCategories.filter(
                        (c) =>
                          categorySearch === "" ||
                          c.name.toLowerCase().includes(categorySearch.toLowerCase()),
                      );
                      if (filteredCats.length === 0) {
                        return (
                          <p className="text-sm text-gray-500 text-center py-6">
                            No categories match your search.
                          </p>
                        );
                      }
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {filteredCats.map((c) => (
                            <CategoryTile
                              key={c.name}
                              category={c}
                              onChange={(f) => handleCategoryImage(c.name, f)}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="px-3 py-2 bg-pink-50 border-t border-pink-100 text-[11px] text-pink-900 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Each company has its own copy of all 37 ONDC categories.
                    Images are scoped to this company only.
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sticky footer — always visible regardless of brand count. */}
          <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            {/* CTA disabled until the form has the minimum data
                required: Add mode needs a non-empty company name AND
                at least one brand with a name. Edit mode (name is
                read-only) only requires that every existing/new brand
                row has a name. handleSave still surfaces inline
                errors for finer issues (duplicate names, etc.). */}
            <Button
              onClick={handleSave}
              disabled={
                editingId
                  ? drafts.some((b) => !b.name.trim())
                  : !name.trim() ||
                    drafts.length === 0 ||
                    drafts.some((b) => !b.name.trim())
              }
            >
              {editingId ? "Save Changes" : "Add Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ---- Brand row used inside the Add/Edit Company dialog ----
function BrandRow({
  brand,
  onName,
  onImage,
  onRemove,
  canRemove,
  removeBlockedReason,
}: {
  brand: DraftBrand;
  onName: (v: string) => void;
  onImage: (f: File | null) => void;
  onRemove: () => void;
  canRemove: boolean;
  removeBlockedReason?: string;
}) {
  return (
    <div className="grid grid-cols-[64px_1fr_36px] gap-3 items-center p-3">
      <ImageUploader
        value={brand.imageUrl}
        onChange={onImage}
        size="sm"
        alt={brand.name || "Brand logo"}
        removable={false}
      />
      <Input
        value={brand.name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Brand name (e.g. Aashirvaad)"
        // Brand name is locked once the brand has been saved on the
        // company. The brand image can still be replaced.
        readOnly={!!brand.isExisting}
        disabled={!!brand.isExisting}
        className={brand.isExisting ? "bg-gray-50" : undefined}
        title={brand.isExisting ? "Existing brand names cannot be changed" : undefined}
      />
      {/* Existing brands are immutable — once a company is saved with a brand
          we never let it be removed, so we don't render the × at all. The
          empty span keeps the 36 px grid column so all rows still align. */}
      {brand.isExisting ? (
        <span aria-hidden className="h-8 w-8" />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onRemove}
          disabled={!canRemove}
          title={canRemove ? "Remove brand" : (removeBlockedReason ?? "At least one brand is required")}
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      )}
    </div>
  );
}

// ---- Per-company category image tile (used inside the dialog's Categories tab) ----
function CategoryTile({
  category,
  onChange,
}: {
  category: AdminCategory;
  onChange: (file: File | null) => void;
}) {
  return (
    <Card className="overflow-hidden hover:border-pink-300 transition-colors p-2 flex flex-col gap-2 items-stretch">
      <ImageUploader
        value={category.imageUrl}
        onChange={onChange}
        size="fill"
        aspect="square"
        alt={category.name}
        placeholder="Upload"
        helper={null}
        removable={false}
      />
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-[11px] font-medium text-gray-900 line-clamp-2 leading-tight flex-1"
          title={category.name}
        >
          {category.name}
        </p>
        {category.imageUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1 text-red-600 hover:bg-red-50 rounded shrink-0"
            title="Remove image"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </Card>
  );
}
