import { useRef } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  FileText,
  Package,
  Ruler,
  Image as ImageIcon,
  Upload,
  X,
  Info,
  ShieldCheck,
  AlertCircle,
  Percent,
  Sparkles,
  PackageOpen,
} from "lucide-react";
import { psBrands, psCompanies } from "../lib/product-store-data";

// ── Shared constants ─────────────────────────────────────────────────────────

export const CATEGORY_OPTIONS = [
  "Fruits and Vegetables",
  "Masala & Seasoning",
  "Oil & Ghee",
  "Eggs, Meat & Fish",
  "Bakery, Cakes & Dairy",
  "Pet Care",
  "Detergents and Dishwash",
  "Dairy and Cheese",
  "Snacks, Dry Fruits, Nuts",
  "Pasta, Soup and Noodles",
  "Cereals and Breakfast",
  "Sauces, Spreads and Dips",
  "Chocolates and Biscuits",
  "Cooking and Baking Needs",
  "Tinned and Processed Food",
  "Atta, Flours and Sooji",
  "Rice and Rice Products",
  "Dals and Pulses",
  "Salt, Sugar and Jaggery",
  "Energy and Soft Drinks",
  "Water",
  "Tea and Coffee",
  "Fruit Juices and Fruit Drinks",
  "Snacks and Namkeen",
  "Ready to Cook and Eat",
  "Pickles and Chutney",
  "Indian Sweets",
  "Frozen Vegetables",
  "Frozen Snacks",
  "Gift Voucher",
  "Gourmet & World Foods",
  "Foodgrains",
  "Beverages",
  "Beauty & Hygiene",
  "Kitchen Accessories",
  "Baby Care",
  "Snacks & Branded Foods",
];

export const MEASURE_UNITS = ["Gram", "Kilogram", "Liter", "Milliliter"];
export const WEIGHT_MEASURES = ["Gram", "Kilogram"];
export const GST_TAX_OPTIONS = ["0%", "3%", "5%", "12%", "18%", "28%"];
export const GST_CESS_OPTIONS = ["0%", "1%", "3%", "5%", "12%", "22%"];

// ── Unified form state ────────────────────────────────────────────────────────

export interface SkuFormState {
  // Descriptor
  itemName: string;
  shortName: string;
  groupName: string;
  itemCode: string;          // admin only
  brandId: string;
  companyId: string;
  brandOther: string;        // seller only (when no brand selected)
  brandAttribute: string;
  // Descriptions
  shortDesc: string;
  longDesc: string;
  // Quantity & Inventory
  measureUnit: string;
  measureValue: string;
  weightMeasure: string;
  skuWeight: string;
  unitizedCount: string;
  minimumOrderQty: string;   // admin only
  maximumOrderQty: string;   // admin only
  upc: string;
  packageType: string;
  packageTypeValue: string;
  // Dimensions
  productLength: string;
  productWidth: string;
  productHeight: string;
  // Tax
  hsnCode: string;
  gstTax: string;
  gstCess: string;
  // Category
  categoryId: string;
  // Company & Brand Information
  manufacturerName: string;
  manufacturerAddress: string; // admin only
  // Tags
  countryOfOrigin: string;
  // Seller only
  notes: string;
  // Admin only
  itemStatus: "enable" | "disable";
}

export const emptySkuForm: SkuFormState = {
  itemName: "",
  shortName: "",
  groupName: "",
  itemCode: "",
  brandId: "",
  companyId: "",
  brandOther: "",
  brandAttribute: "",
  shortDesc: "",
  longDesc: "",
  measureUnit: "",
  measureValue: "",
  weightMeasure: "",
  skuWeight: "",
  unitizedCount: "1",
  minimumOrderQty: "1",
  maximumOrderQty: "100",
  upc: "",
  packageType: "",
  packageTypeValue: "",
  productLength: "",
  productWidth: "",
  productHeight: "",
  hsnCode: "",
  gstTax: "",
  gstCess: "0%",
  categoryId: "",
  manufacturerName: "",
  manufacturerAddress: "",
  countryOfOrigin: "India",
  notes: "",
  itemStatus: "enable",
};

// ── Layout helpers ────────────────────────────────────────────────────────────

export function SkuFormSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-gray-50/60 p-4 space-y-4">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 uppercase tracking-wider">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

export function SkuFormRow({
  label,
  required,
  help,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {help && <p className="text-[11px] text-gray-400">{help}</p>}
    </div>
  );
}

// ── Main shared form fields component ────────────────────────────────────────

export interface SkuFormFieldsProps {
  mode: "seller" | "admin";
  form: SkuFormState;
  onChange: (key: keyof SkuFormState, value: string) => void;
  productImages: string[];
  onProductImagesChange: (images: string[]) => void;
  isEdit?: boolean;
  /** When true, all fields are rendered disabled / non-interactive (view mode) */
  readOnly?: boolean;
  /** Accent colour for upload hover — "purple" for seller, "teal" for admin */
  accent?: "purple" | "teal";
}

export function SkuFormFields({
  mode,
  form,
  onChange,
  productImages,
  onProductImagesChange,
  isEdit = false,
  readOnly = false,
  accent = mode === "admin" ? "teal" : "purple",
}: SkuFormFieldsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = mode === "admin";
  const isSeller = mode === "seller";

  const hoverBorder = accent === "teal" ? "hover:border-teal-400 hover:bg-teal-50 hover:text-teal-600" : "hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    onProductImagesChange([...productImages, ...urls]);
  };

  // Auto-calculated Weight in KG — mirrors sku-detail.tsx behaviour
  const weightInKg = (() => {
    const w = parseFloat(form.skuWeight);
    if (!form.weightMeasure || isNaN(w)) return null;
    const kg = form.weightMeasure === "Kilogram" ? w : w / 1000;
    return kg.toFixed(3);
  })();

  const volumetricWeight =
    form.productLength && form.productWidth && form.productHeight
      ? (
          (Number(form.productLength) *
            Number(form.productWidth) *
            Number(form.productHeight)) /
          5000
        ).toFixed(3)
      : null;

  return (
    <div className="space-y-4">

      {/* ── 1. Descriptor (Product Identity) ── matches sku-detail section name */}
      <SkuFormSection
        title="Descriptor (Product Identity)"
        icon={<FileText className="h-3.5 w-3.5 text-blue-600" />}
      >
        <SkuFormRow label="SKU Name" required={!readOnly} help={readOnly ? undefined : "Brand + variant + pack size (3–100 chars)"}>
          <Input
            placeholder="e.g. Aashirvaad Whole Wheat Atta 10 kg"
            value={form.itemName}
            onChange={(e) => onChange("itemName", e.target.value)}
            disabled={readOnly}
          />
        </SkuFormRow>

        <div className="grid grid-cols-2 gap-3">
          <SkuFormRow label="Short Name" help={readOnly ? undefined : "Internal alias — max 20 chars"}>
            <Input
              placeholder="e.g. AASH-10K"
              value={form.shortName}
              onChange={(e) => onChange("shortName", e.target.value)}
              maxLength={readOnly ? undefined : 20}
              disabled={readOnly}
            />
          </SkuFormRow>
          <SkuFormRow label="Group Name" help={readOnly ? undefined : "Product line this SKU belongs to"}>
            <Input
              placeholder="e.g. Aashirvaad Atta"
              value={form.groupName}
              onChange={(e) => onChange("groupName", e.target.value)}
              disabled={readOnly}
            />
          </SkuFormRow>
        </div>

        {/* Admin: SKU Code + Brand Attribute */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-3">
            <SkuFormRow label="SKU Code" required={!readOnly} help={readOnly ? undefined : "Unique identifier — cannot be changed after creation"}>
              <Input
                placeholder="e.g. AASH-001"
                value={form.itemCode}
                onChange={(e) => onChange("itemCode", e.target.value.toUpperCase().replace(/\s/g, "-"))}
                className="font-mono"
                disabled={readOnly || isEdit}
              />
            </SkuFormRow>
            <SkuFormRow label="Brand Attribute" help={readOnly ? undefined : "Brand name for ONDC compliance"}>
              <Input
                placeholder="Auto-filled from brand"
                value={form.brandAttribute}
                onChange={(e) => onChange("brandAttribute", e.target.value)}
                disabled={readOnly}
              />
            </SkuFormRow>
          </div>
        )}

        {/* Short Description + Long Description — same section as sku-detail Descriptor */}
        <SkuFormRow label="Short Description" required={!readOnly} help={readOnly ? undefined : "10–150 chars, plain text"}>
          <Input
            placeholder="One-line product summary"
            maxLength={readOnly ? undefined : 150}
            value={form.shortDesc}
            onChange={(e) => onChange("shortDesc", e.target.value)}
            disabled={readOnly}
          />
          {!readOnly && <p className="text-[11px] text-gray-400 text-right">{form.shortDesc.length}/150</p>}
        </SkuFormRow>
        <SkuFormRow label="Long Description" required={!readOnly} help={readOnly ? undefined : "20–1000 chars, plain text"}>
          <Textarea
            placeholder="Full product description..."
            rows={isSeller ? 3 : 4}
            maxLength={readOnly ? undefined : 1000}
            value={form.longDesc}
            onChange={(e) => onChange("longDesc", e.target.value)}
            disabled={readOnly}
          />
          {!readOnly && <p className="text-[11px] text-gray-400 text-right">{form.longDesc.length}/1000</p>}
        </SkuFormRow>
      </SkuFormSection>

      {/* ── 2. Product Images ── */}
      <SkuFormSection
        title={isSeller ? "Product Images (optional)" : "Images"}
        icon={isSeller
          ? <Upload className="h-3.5 w-3.5 text-pink-600" />
          : <ImageIcon className="h-3.5 w-3.5 text-pink-600" />
        }
      >
        {isAdmin && !readOnly && (
          <Label className="text-xs font-semibold text-gray-700 block mb-2">
            Product Images
          </Label>
        )}
        {readOnly && productImages.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No images provided with this request.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {productImages.map((img, i) => (
              <div
                key={i}
                className={`relative rounded-lg border-2 border-gray-200 overflow-hidden group ${isAdmin ? "w-20 h-20" : "w-16 h-16"}`}
              >
                {img.startsWith("blob:") || img.startsWith("http") ? (
                  <img src={img} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl bg-gray-50">
                    {img}
                  </div>
                )}
                {!readOnly && (
                  <button
                    onClick={() => onProductImagesChange(productImages.filter((_, j) => j !== i))}
                    className={`absolute ${isAdmin ? "top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" : "inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"}`}
                  >
                    <X className={isAdmin ? "h-3 w-3" : "h-4 w-4"} />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 transition-colors text-gray-400 ${hoverBorder} ${isAdmin ? "w-20 h-20" : "w-16 h-16"}`}
                >
                  <Upload className={isAdmin ? "h-5 w-5" : "h-4 w-4"} />
                  <span className="text-[10px]">{isAdmin ? "Upload" : "Add"}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </>
            )}
          </div>
        )}
        {!readOnly && (
          <p className="text-[11px] text-gray-400">
            {isAdmin
              ? "Upload product images. First image is the primary thumbnail."
              : "Upload reference images if available. Catalog Admin may use these when creating the SKU."}
          </p>
        )}
      </SkuFormSection>

      {/* ── 3. Quantity & Inventory ── renamed from "Quantity & Packaging" to match sku-detail */}
      <SkuFormSection
        title="Quantity & Inventory"
        icon={<Package className="h-3.5 w-3.5 text-indigo-600" />}
      >
        <div className="grid grid-cols-2 gap-3">
          <SkuFormRow label="Measure Unit" required={!readOnly} help={readOnly ? undefined : "Gram / Kilogram / Liter / Milliliter"}>
            <Select value={form.measureUnit} onValueChange={(v) => onChange("measureUnit", v)} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {MEASURE_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SkuFormRow>
          <SkuFormRow label="Unit Value" required={!readOnly} help={readOnly ? undefined : "e.g. 500 for a 500g pack"}>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={form.measureValue}
              onChange={(e) => onChange("measureValue", e.target.value)}
              disabled={readOnly || !form.measureUnit}
            />
          </SkuFormRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SkuFormRow label="Weight Measure" required={!readOnly} help={readOnly ? undefined : "Gram or Kilogram"}>
            <Select value={form.weightMeasure} onValueChange={(v) => onChange("weightMeasure", v)} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {WEIGHT_MEASURES.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SkuFormRow>
          <SkuFormRow label="SKU Weight" required={!readOnly} help={readOnly ? undefined : "Physical shipping weight"}>
            <Input
              type="number"
              step="0.001"
              placeholder="e.g. 0.55"
              value={form.skuWeight}
              onChange={(e) => onChange("skuWeight", e.target.value)}
              disabled={readOnly || !form.weightMeasure}
            />
          </SkuFormRow>
        </div>

        {/* Weight in KG — auto-calculated, read-only. Mirrors sku-detail behaviour. */}
        {weightInKg && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-white rounded px-3 py-2 border">
            <Info className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span>Weight in KG:</span>
            <span className="font-semibold text-gray-900 font-mono">{weightInKg} kg</span>
            <span className="ml-auto text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">Auto</span>
          </div>
        )}

        {isAdmin ? (
          <div className="grid grid-cols-3 gap-3">
            <SkuFormRow label="Pack Size (Inner Pack)" help={readOnly ? undefined : "Units per pack"}>
              <Input type="number" min="1" placeholder="1" value={form.unitizedCount}
                onChange={(e) => onChange("unitizedCount", e.target.value)} disabled={readOnly} />
            </SkuFormRow>
            <SkuFormRow label="Min Order Qty">
              <Input type="number" min="1" placeholder="1" value={form.minimumOrderQty}
                onChange={(e) => onChange("minimumOrderQty", e.target.value)} disabled={readOnly} />
            </SkuFormRow>
            <SkuFormRow label="Max Order Qty">
              <Input type="number" min="1" placeholder="100" value={form.maximumOrderQty}
                onChange={(e) => onChange("maximumOrderQty", e.target.value)} disabled={readOnly} />
            </SkuFormRow>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SkuFormRow label="Pack Size (Inner Pack)" help={readOnly ? undefined : "Units per inner pack"}>
              <Input type="number" min="1" placeholder="1" value={form.unitizedCount}
                onChange={(e) => onChange("unitizedCount", e.target.value)} disabled={readOnly} />
            </SkuFormRow>
            <SkuFormRow label="UPC (Unit Per Case)" help={readOnly ? undefined : "Optional"}>
              <Input placeholder="e.g. 8901725100015" value={form.upc}
                onChange={(e) => onChange("upc", e.target.value)} className="font-mono" disabled={readOnly} />
            </SkuFormRow>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <SkuFormRow label="Package Type" help={readOnly ? undefined : "e.g. Carton, Pouch, Jar"}>
            <Input placeholder="e.g. Pouch" value={form.packageType}
              onChange={(e) => onChange("packageType", e.target.value)} disabled={readOnly} />
          </SkuFormRow>
          <SkuFormRow label="Package Type Value" help={readOnly ? undefined : "e.g. Laminated Pouch"}>
            <Input placeholder="e.g. Laminated Pouch" value={form.packageTypeValue}
              onChange={(e) => onChange("packageTypeValue", e.target.value)} disabled={readOnly} />
          </SkuFormRow>
        </div>

        {isAdmin && (
          <SkuFormRow label="UPC (Unit Per Case)" help={readOnly ? undefined : "Universal Product Code (optional)"}>
            <Input placeholder="e.g. 8901725100015" value={form.upc}
              onChange={(e) => onChange("upc", e.target.value)} className="font-mono" disabled={readOnly} />
          </SkuFormRow>
        )}
      </SkuFormSection>

      {/* ── 4. Dimensions ── matches sku-detail section name */}
      <SkuFormSection
        title="Dimensions"
        icon={<Ruler className="h-3.5 w-3.5 text-amber-600" />}
      >
        <div className="grid grid-cols-3 gap-3">
          <SkuFormRow label="Length (cm)">
            <Input type="number" min="0" step="0.1" placeholder="—"
              value={form.productLength} onChange={(e) => onChange("productLength", e.target.value)} disabled={readOnly} />
          </SkuFormRow>
          <SkuFormRow label="Width (cm)">
            <Input type="number" min="0" step="0.1" placeholder="—"
              value={form.productWidth} onChange={(e) => onChange("productWidth", e.target.value)} disabled={readOnly} />
          </SkuFormRow>
          <SkuFormRow label="Height (cm)">
            <Input type="number" min="0" step="0.1" placeholder="—"
              value={form.productHeight} onChange={(e) => onChange("productHeight", e.target.value)} disabled={readOnly} />
          </SkuFormRow>
        </div>
        {volumetricWeight && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-white rounded px-3 py-2 border">
            <Info className="h-3.5 w-3.5 text-gray-400" />
            Volumetric weight:{" "}
            <span className="font-semibold text-gray-900">{volumetricWeight} kg</span>
            <span className="ml-auto text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">Auto</span>
          </div>
        )}
      </SkuFormSection>

      {/* ── 5. Category, Fulfillment & Location ── matches sku-detail section name */}
      <SkuFormSection
        title="Category, Fulfillment & Location"
        icon={<PackageOpen className="h-3.5 w-3.5 text-orange-600" />}
      >
        <SkuFormRow label="Category ID" required={!readOnly} help={readOnly ? undefined : "Maps this SKU to the ONDC eB2B taxonomy"}>
          <Select value={form.categoryId} onValueChange={(v) => onChange("categoryId", v)} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue placeholder="Select ONDC category" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SkuFormRow>
        {readOnly ? null : (
          <p className="text-[11px] text-gray-400 flex items-center gap-1">
            <Info className="h-3 w-3 flex-shrink-0" />
            Fulfillment ID and Location ID are configured on the SKU detail page after import.
          </p>
        )}
      </SkuFormSection>

      {/* ── 6. Tax ── matches sku-detail section name */}
      <SkuFormSection
        title="Tax"
        icon={<Percent className="h-3.5 w-3.5 text-orange-500" />}
      >
        <SkuFormRow label="HSN Code" required={!readOnly && isSeller} help={readOnly ? undefined : "6-8 digit code for GST filing"}>
          <Input placeholder="e.g. 11010000" value={form.hsnCode}
            onChange={(e) => onChange("hsnCode", e.target.value)}
            className="font-mono" maxLength={readOnly ? undefined : 8} disabled={readOnly} />
        </SkuFormRow>
        <div className="grid grid-cols-2 gap-3">
          <SkuFormRow label="GST Tax %" required={!readOnly}>
            <Select value={form.gstTax} onValueChange={(v) => onChange("gstTax", v)} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Select GST rate" />
              </SelectTrigger>
              <SelectContent>
                {GST_TAX_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SkuFormRow>
          <SkuFormRow label="GST Cess %" help={readOnly ? undefined : "Usually 0%"}>
            <Select value={form.gstCess} onValueChange={(v) => onChange("gstCess", v)} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Select GST cess" />
              </SelectTrigger>
              <SelectContent>
                {GST_CESS_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SkuFormRow>
        </div>
      </SkuFormSection>

      {/* ── 7. Company & Brand Information ── matches sku-detail section name; Brand moved here from Descriptor */}
      <SkuFormSection
        title="Company & Brand Information"
        icon={<ShieldCheck className="h-3.5 w-3.5 text-rose-600" />}
      >
        {/* Seller: Brand dropdown + fallback */}
        {isSeller && (
          <>
            <SkuFormRow label="Brand" required={!readOnly}>
              <Select value={form.brandId} onValueChange={(brandId) => {
                const brand = psBrands.find((b) => b.id === brandId);
                const company = brand ? psCompanies.find((c) => c.id === brand.companyId) : null;
                onChange("brandId", brandId);
                onChange("companyId", brand?.companyId ?? "");
                onChange("brandOther", "");
                onChange("brandAttribute", brand?.name ?? "");
                onChange("manufacturerName", company?.name ?? form.manufacturerName);
              }} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  {psBrands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.logo} {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SkuFormRow>
            <SkuFormRow label="Brand Attribute" help={readOnly ? undefined : "Brand name for ONDC compliance"}>
              <Input
                placeholder="Auto-filled from brand, or enter manually"
                value={form.brandAttribute}
                onChange={(e) => onChange("brandAttribute", e.target.value)}
                disabled={readOnly}
              />
            </SkuFormRow>
            {(!readOnly || form.brandOther) && !form.brandId && (
              <SkuFormRow label="Brand / Company (if not listed)" required={!readOnly}>
                <Input
                  placeholder="e.g. GSK Consumer, HUL"
                  value={form.brandOther}
                  onChange={(e) => onChange("brandOther", e.target.value)}
                  disabled={readOnly}
                />
              </SkuFormRow>
            )}
          </>
        )}

        {/* Admin: Company → Brand cascade (mirrors seller MySKU detail layout) */}
        {isAdmin && (
          <>
            <SkuFormRow label="Manufacturer / Packer Name (Company Name)" required={!readOnly} help={readOnly ? undefined : "Pick a company to filter the brand list"}>
              <Select
                value={form.companyId}
                onValueChange={(companyId) => {
                  const company = psCompanies.find((c) => c.id === companyId);
                  onChange("companyId", companyId);
                  onChange("manufacturerName", company?.name ?? "");
                  // Reset brand when company changes
                  onChange("brandId", "");
                  onChange("brandAttribute", "");
                  onChange("brandOther", "");
                }}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company…" />
                </SelectTrigger>
                <SelectContent>
                  {psCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.logo} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SkuFormRow>

            <SkuFormRow label="Brand" required={!readOnly} help={readOnly ? undefined : "Brands depend on the selected company"}>
              {!form.companyId ? (
                <p className="text-xs text-gray-500 py-1">Select a company first to choose a brand.</p>
              ) : (
                <Select
                  value={form.brandId}
                  onValueChange={(brandId) => {
                    const brand = psBrands.find((b) => b.id === brandId);
                    onChange("brandId", brandId);
                    onChange("brandOther", "");
                    onChange("brandAttribute", brand?.name ?? "");
                  }}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand…" />
                  </SelectTrigger>
                  <SelectContent>
                    {psBrands.filter((b) => b.companyId === form.companyId).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.logo} {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SkuFormRow>

            <SkuFormRow label="Manufacturer / Packer Address">
              <Textarea
                placeholder="Full registered address of manufacturer/packer"
                rows={2}
                value={form.manufacturerAddress}
                onChange={(e) => onChange("manufacturerAddress", e.target.value)}
                disabled={readOnly}
              />
            </SkuFormRow>
          </>
        )}

        {/* Seller: Manufacturer / Packer Name — plain text (company is picked via MySKU detail) */}
        {isSeller && (
          <SkuFormRow label="Manufacturer / Packer Name (Company Name)" required={!readOnly}>
            <Input
              placeholder="Auto-filled from brand, or enter manually"
              value={form.manufacturerName}
              onChange={(e) => onChange("manufacturerName", e.target.value)}
              disabled={readOnly}
            />
          </SkuFormRow>
        )}
      </SkuFormSection>

      {/* ── 8. Tags (Discovery & Attribute Enrichment) ── matches sku-detail section name */}
      <SkuFormSection
        title="Tags (Discovery & Attribute Enrichment)"
        icon={<Sparkles className="h-3.5 w-3.5 text-pink-600" />}
      >
        <SkuFormRow label="Country of Origin" required={!readOnly && isSeller}>
          <Select value={form.countryOfOrigin} onValueChange={(v) => onChange("countryOfOrigin", v)} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {["India", "Bangladesh", "Sri Lanka", "Nepal", "Bhutan", "China", "Other"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SkuFormRow>
      </SkuFormSection>

      {/* ── 9. Notes to Catalog Team (seller only) ── */}
      {isSeller && (!readOnly || form.notes) && (
        <SkuFormSection
          title="Notes to Catalog Team"
          icon={<AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
        >
          <SkuFormRow label="Additional Notes" help={readOnly ? undefined : "SKU urgency, retailer demand, reference links, etc."}>
            <Textarea
              placeholder="e.g. High demand from retail customers in NCR, please prioritise..."
              rows={2}
              value={form.notes}
              onChange={(e) => onChange("notes", e.target.value)}
              disabled={readOnly}
            />
          </SkuFormRow>
          {!readOnly && (
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-amber-50 rounded p-2.5 border border-amber-100">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
              <span>
                Requests are reviewed within 2–3 business days. You'll be notified once
                the SKU is available in the Product Store.
              </span>
            </div>
          )}
        </SkuFormSection>
      )}
    </div>
  );
}
