import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Building2,
  CheckCircle2,
  Download,
  FileJson,
  Info,
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
  updateSellerWholesalerPolygon,
  type Seller,
} from "../lib/mock-store";
import { readPolygonFile } from "./serviceability-manager";
import { PolygonPreviewMap } from "./serviceability-map-view";

/**
 * Wholesaler Serviceability — ONE polygon per seller that covers every
 * company mapped with Operation Mode = Wholesaler. Sits alongside (but
 * separate from) the Distributor Delivery Beats section; hybrid sellers
 * see both. Companies linked as Wholesaler later inherit the polygon
 * automatically — no re-upload needed.
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

  const fileRef = useRef<HTMLInputElement | null>(null);

  const wholesalerCompanies = (seller.companyBrandSelections ?? [])
    .filter((s) => s.operationMode === "wholesaler")
    .map((s) => companies.find((c) => c.id === s.companyId))
    .filter((c): c is AdminCatalogCompany => !!c);

  const polygon = seller.wholesalerPolygon;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const draft = await readPolygonFile(file);
    if (!draft.valid || draft.data == null) return; // readPolygonFile toasts
    const updated = updateSellerWholesalerPolygon(seller.id, {
      fileName: file.name,
      data: draft.data,
      updatedAt: new Date().toISOString(),
    });
    if (updated) {
      onChange(updated);
      toast.success(
        `Wholesaler polygon ${polygon ? "replaced" : "uploaded"} — applies to ${wholesalerCompanies.length} wholesaler compan${wholesalerCompanies.length === 1 ? "y" : "ies"}.`,
      );
    }
  };

  const handleRemove = () => {
    if (
      !window.confirm(
        "Remove the wholesaler polygon? Wholesaler companies will have no serviceable area until a new one is uploaded.",
      )
    )
      return;
    const updated = updateSellerWholesalerPolygon(seller.id, null);
    if (updated) {
      onChange(updated);
      toast.success("Wholesaler polygon removed.");
    }
  };

  const handleDownload = () => {
    if (!polygon?.data) return;
    const blob = new Blob([JSON.stringify(polygon.data, null, 2)], {
      type: "application/geo+json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = polygon.fileName || "wholesaler-zone.geojson";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-amber-600" />
            Wholesaler Serviceability
          </h3>
          <p className="text-sm text-gray-500 max-w-2xl">
            One delivery polygon covers <b>all</b> companies mapped as
            Wholesaler — no beats, no per-company zones. Companies linked as
            Wholesaler later inherit it automatically.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.geojson"
          onChange={handleUpload}
          className="hidden"
        />
        <Button
          className="gap-2 shrink-0"
          variant={polygon ? "outline" : "default"}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {polygon ? "Replace polygon" : "Upload polygon"}
        </Button>
      </div>

      {/* Companies covered by the polygon */}
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

      {polygon ? (
        <Card className="border border-gray-200 p-0 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <FileJson className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium text-gray-900 truncate">
                {polygon.fileName}
              </span>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </Badge>
              <span className="text-xs text-gray-500">
                Updated {new Date(polygon.updatedAt).toLocaleDateString()}
              </span>
              <span className="ml-auto flex items-center gap-2">
                {polygon.data != null && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8"
                    onClick={handleDownload}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-red-600 hover:bg-red-50"
                  onClick={handleRemove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </span>
            </div>
            {polygon.data != null && <PolygonPreviewMap data={polygon.data} />}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Warehouse className="h-10 w-10 mx-auto text-gray-300 mb-2" />
          <p className="font-medium text-gray-600">
            No wholesaler polygon uploaded yet
          </p>
          <p className="text-sm text-gray-500 mt-1 mb-4 max-w-md mx-auto">
            Upload a single GeoJSON polygon defining where this seller
            delivers as a wholesaler. It applies to every Wholesaler-mode
            company at once.
          </p>
          <Button className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Upload polygon
          </Button>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 p-3 rounded-md border border-amber-100 bg-amber-50/60 text-xs text-amber-900">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Unlike Distributor Delivery Beats, wholesaler serviceability uses{" "}
          <b>one shared polygon</b>. If a new company is later linked with
          Operation Mode = Wholesaler, it automatically inherits this polygon —
          no additional upload is required.
        </p>
      </div>
    </div>
  );
}
