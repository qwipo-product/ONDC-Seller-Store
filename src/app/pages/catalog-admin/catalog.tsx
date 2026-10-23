import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Plus, Package, Database, PowerOff, Users } from "lucide-react";
import { toast } from "sonner";
import {
  psSkus as initialSkus,
  type PSSku,
} from "../../lib/product-store-data";
import { ProductStoreBrowse } from "../../components/product-store-browse";

export function CatalogAdminCatalog() {
  const navigate = useNavigate();
  const [skus, setSkus] = useState(initialSkus);
  const [inactivateDialog, setInactivateDialog] = useState<PSSku | null>(null);
  const [inactivateReason, setInactivateReason] = useState("");
  const handleInactivate = () => {
    if (!inactivateDialog || !inactivateReason.trim()) return;
    setSkus((prev) =>
      prev.map((s) =>
        s.id === inactivateDialog.id ? { ...s, status: "inactive" } : s
      )
    );
    toast.success(`"${inactivateDialog.name}" has been made inactive globally.`);
    setInactivateDialog(null);
    setInactivateReason("");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Database className="h-7 w-7 text-teal-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Browse Catalog</h1>
          </div>
          <p className="text-gray-500 text-sm ml-10">
            View, edit, and manage SKUs across all companies and brands.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate("/catalog-admin/catalog/create")}
            className="gap-2 bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Create SKU
          </Button>
        </div>
      </div>

      {/* Shared browse component in admin mode */}
      <ProductStoreBrowse
        mode="admin"
        skuList={skus}
        onEditSku={(sku) => navigate(`/catalog-admin/catalog/${sku.id}`)}
        onInactivateSku={setInactivateDialog}
      />

      {/* Inactivate Dialog */}
      <Dialog open={!!inactivateDialog} onOpenChange={() => setInactivateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <PowerOff className="h-5 w-5" />
              Make SKU Inactive
            </DialogTitle>
            <DialogDescription>
              This will make the SKU inactive globally — no distributor can import it,
              and all linked sellers will be notified.
            </DialogDescription>
          </DialogHeader>
          {inactivateDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                <span className="text-3xl">{inactivateDialog.image}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {inactivateDialog.name}
                  </p>
                  <code className="text-[11px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded font-mono">
                    {inactivateDialog.skuCode}
                  </code>
                </div>
              </div>
              {inactivateDialog.linkedSellersCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 flex items-start gap-2">
                  <Users className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{inactivateDialog.linkedSellersCount} sellers</strong> have
                    imported this SKU. They will receive an inactivation notice and can
                    choose to keep or remove it from their MySKU.
                  </span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Reason for Inactivation *</Label>
                <Textarea
                  placeholder="e.g. Brand discontinued this SKU, new variant replacing it..."
                  value={inactivateReason}
                  onChange={(e) => setInactivateReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInactivateDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!inactivateReason.trim()}
              onClick={handleInactivate}
              className="bg-red-600 hover:bg-red-700"
            >
              Make Inactive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
