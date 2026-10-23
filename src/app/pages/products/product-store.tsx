import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Database,
  Plus,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  psSkus,
  type PSCompany,
  type PSBrand,
  type PSSku,
} from "../../lib/product-store-data";
import { addFromProductStore, isImportedFromPS } from "../../lib/my-sku-store";
import { ProductStoreBrowse } from "../../components/product-store-browse";

export function ProductStore() {
  const navigate = useNavigate();

  // Import to My SKU dialog (single SKU)
  const [importSku, setImportSku] = useState<PSSku | null>(null);
  // Bulk import dialog (company or brand level)
  const [bulkImport, setBulkImport] = useState<{
    label: string;
    skus: PSSku[];
  } | null>(null);

  // Reflects what has already been imported into My SKU
  const [addedSkuIds, setAddedSkuIds] = useState<Set<string>>(
    () => new Set(psSkus.map((s) => s.id).filter((id) => isImportedFromPS(id)))
  );

  const handleImportToMySku = (sku: PSSku) => {
    addFromProductStore(sku);
    setAddedSkuIds((prev) => new Set([...prev, sku.id]));
    toast.success(
      `"${sku.name}" added to My SKU as Inactive. Open My SKU to set pricing and activate it.`,
      { duration: 4000 }
    );
    setImportSku(null);
  };

  const handleBulkImport = () => {
    if (!bulkImport) return;
    const newSkus = bulkImport.skus.filter((s) => !addedSkuIds.has(s.id));
    newSkus.forEach((s) => addFromProductStore(s));
    setAddedSkuIds((prev) => new Set([...prev, ...newSkus.map((s) => s.id)]));
    toast.success(
      `${newSkus.length} SKU${newSkus.length !== 1 ? "s" : ""} from ${bulkImport.label} added to My SKU as Inactive.`,
      { duration: 4000 }
    );
    setBulkImport(null);
  };

  const openBulkImportForCompany = (company: PSCompany, e: React.MouseEvent) => {
    e.stopPropagation();
    const skus = psSkus.filter((s) => s.companyId === company.id && s.status === "active");
    setBulkImport({ label: company.name, skus });
  };

  const openBulkImportForBrand = (brand: PSBrand, e: React.MouseEvent) => {
    e.stopPropagation();
    const skus = psSkus.filter((s) => s.brandId === brand.id && s.status === "active");
    setBulkImport({ label: brand.name, skus });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Database className="h-7 w-7 text-purple-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Product Store</h1>
          </div>
          <p className="text-gray-500 text-sm ml-10">
            Browse the Qwipo Master Catalog and import SKUs directly into your My SKU list.
          </p>
        </div>
      </div>

      {/* Shared browse component */}
      <ProductStoreBrowse
        mode="seller"
        addedSkuIds={addedSkuIds}
        onAddSku={setImportSku}
        onBulkImportCompany={openBulkImportForCompany}
        onBulkImportBrand={openBulkImportForBrand}
      />

      {/* ── Bulk Import Dialog ── */}
      <Dialog open={!!bulkImport} onOpenChange={() => setBulkImport(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" />
              Import All SKUs — {bulkImport?.label}
            </DialogTitle>
            <DialogDescription>
              All SKUs from {bulkImport?.label} will be added to your My SKU list as Inactive.
            </DialogDescription>
          </DialogHeader>
          {bulkImport &&
            (() => {
              const newSkus = bulkImport.skus.filter((s) => !addedSkuIds.has(s.id));
              const alreadyAdded = bulkImport.skus.length - newSkus.length;
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xl font-bold text-green-700">{newSkus.length}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Will be added</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xl font-bold text-gray-500">{alreadyAdded}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Already in My SKU</p>
                    </div>
                  </div>
                  {newSkus.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border divide-y text-sm">
                      {newSkus.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-base">{s.image}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-xs truncate">{s.name}</p>
                            <code className="text-[10px] text-gray-400 font-mono">{s.skuCode}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-start gap-2 p-2.5 bg-purple-50 rounded-lg border border-purple-100 text-xs text-purple-800">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-purple-500" />
                    <span>
                      All imported SKUs will be <strong>Inactive</strong>. You'll need to set
                      pricing and activate each one in My SKU.
                    </span>
                  </div>
                </div>
              );
            })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkImport(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={
                bulkImport?.skus.filter((s) => !addedSkuIds.has(s.id)).length === 0
              }
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Import{" "}
              {bulkImport?.skus.filter((s) => !addedSkuIds.has(s.id)).length ?? 0} SKUs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Confirm Dialog ── */}
      <Dialog open={!!importSku} onOpenChange={() => setImportSku(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" />
              Add to My SKU
            </DialogTitle>
            <DialogDescription>
              This will import the SKU's catalog details into your My SKU list.
            </DialogDescription>
          </DialogHeader>
          {importSku && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                <span className="text-3xl">{importSku.image}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{importSku.name}</p>
                  <code className="text-[11px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded font-mono">
                    {importSku.skuCode}
                  </code>
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-sm text-purple-900 space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  What gets imported (Read-only fields)
                </p>
                <ul className="text-xs space-y-0.5 ml-5 list-disc text-purple-800">
                  <li>SKU name, short name, SKU code, group name</li>
                  <li>Brand, company, category</li>
                  <li>Short &amp; long description</li>
                  <li>Product images</li>
                  <li>Measure unit, packaging size, UPC, package type</li>
                  <li>SKU weight, dimensions &amp; volumetric weight</li>
                  <li>Manufacturer name, country of origin</li>
                  <li>HSN code, GST tax %, GST cess %</li>
                </ul>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                <strong>You fill in after import (Editable):</strong> MRP, selling price,
                fulfillment ID, location, order limits, delivery settings, and consumer care
                details.
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setImportSku(null)}
              className="sm:mr-auto"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (importSku) handleImportToMySku(importSku);
                navigate("/products/my-sku");
              }}
              className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50"
            >
              Add &amp; Go to My SKU →
            </Button>
            <Button
              onClick={() => importSku && handleImportToMySku(importSku)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add to My SKU
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
