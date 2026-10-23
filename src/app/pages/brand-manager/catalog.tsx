import { useState } from "react";
import { useNavigate } from "react-router";
import { ProductStoreBrowse } from "../../components/product-store-browse";
import { psSkus, psCompanies, psBrands, addPsRequest, getBrandById, getCompanyById, type PSSku } from "../../lib/product-store-data";
import { useAuth } from "../../lib/auth-context";
import { Info, PowerOff, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

// Mock mapping: brand-manager-1 (Arjun Mehta) is mapped to ITC.
// In production this would come from Seller Admin's company-to-brand-manager mapping API.
export const BM_COMPANY_IDS = ["ITC"];

export function BrandManagerCatalog() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const myCompanyIds = BM_COMPANY_IDS;
  const filteredCompanies = psCompanies.filter((c) => myCompanyIds.includes(c.id));
  const filteredBrands = psBrands.filter((b) => myCompanyIds.includes(b.companyId));
  const filteredSkus = psSkus.filter((s) => myCompanyIds.includes(s.companyId));

  const myCompanyNames = filteredCompanies.map((c) => c.name).join(", ");

  const [inactivateDialog, setInactivateDialog] = useState<PSSku | null>(null);
  const [inactivateNotes, setInactivateNotes] = useState("");
  const [activateDialog, setActivateDialog] = useState<PSSku | null>(null);
  const [activateNotes, setActivateNotes] = useState("");

  const handleInactivateConfirm = () => {
    if (!inactivateDialog) return;
    const brand = getBrandById(inactivateDialog.brandId);
    const company = getCompanyById(inactivateDialog.companyId);
    const req = addPsRequest({
      type: "inactivate_sku",
      skuId: inactivateDialog.id,
      skuCode: inactivateDialog.skuCode,
      skuName: inactivateDialog.name,
      brandId: inactivateDialog.brandId,
      brandName: brand?.name ?? inactivateDialog.brandId,
      companyName: company?.name ?? inactivateDialog.companyId,
      requestedBy: user?.businessName ?? "Brand Manager",
      requestedByType: "brand_manager",
      notes: inactivateNotes.trim() || undefined,
    });
    toast.success(`Inactivate request ${req.id} submitted to Catalog Admin.`);
    setInactivateDialog(null);
    setInactivateNotes("");
  };

  const handleActivateConfirm = () => {
    if (!activateDialog) return;
    const brand = getBrandById(activateDialog.brandId);
    const company = getCompanyById(activateDialog.companyId);
    const req = addPsRequest({
      type: "activate_sku",
      skuId: activateDialog.id,
      skuCode: activateDialog.skuCode,
      skuName: activateDialog.name,
      brandId: activateDialog.brandId,
      brandName: brand?.name ?? activateDialog.brandId,
      companyName: company?.name ?? activateDialog.companyId,
      requestedBy: user?.businessName ?? "Brand Manager",
      requestedByType: "brand_manager",
      notes: activateNotes.trim() || undefined,
    });
    toast.success(`Activate request ${req.id} submitted to Catalog Admin.`);
    setActivateDialog(null);
    setActivateNotes("");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Catalog</h1>
        <p className="text-gray-500 text-sm mt-1">
          Showing SKUs for your mapped {myCompanyIds.length > 1 ? "companies" : "company"}:{" "}
          <span className="font-medium text-gray-700">{myCompanyNames}</span>
          {" "}— {filteredBrands.length} brands, {filteredSkus.length} SKUs.
        </p>
      </div>

      {/* Scope banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 flex items-start gap-3">
        <Info className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-teal-900">
          <span className="font-medium">Catalog scope:</span> You can only see companies and brands
          mapped to your account ({user?.businessName}). SKU edits, activations, and inactivations
          go through Catalog Admin for approval.
        </p>
      </div>

      <ProductStoreBrowse
        mode="admin"
        companyList={filteredCompanies}
        brandList={filteredBrands}
        skuList={filteredSkus}
        onEditSku={(sku) => navigate(`/catalog-admin/catalog/${sku.id}`)}
        onInactivateSku={(sku) => {
          if (sku.status === "inactive") {
            setActivateDialog(sku);
          } else {
            setInactivateDialog(sku);
          }
        }}
      />

      {/* Inactivate request dialog */}
      <Dialog open={!!inactivateDialog} onOpenChange={() => setInactivateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <PowerOff className="h-5 w-5" />
              Request: Make SKU Inactive
            </DialogTitle>
            <DialogDescription>
              This will be sent to Catalog Admin for approval. The SKU remains active until approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded border text-sm">
              <p className="font-medium text-gray-900">{inactivateDialog?.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {inactivateDialog?.skuCode} · {inactivateDialog?.brandId}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Why should this SKU be made inactive?"
                value={inactivateNotes}
                onChange={(e) => setInactivateNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInactivateDialog(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleInactivateConfirm}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate request dialog */}
      <Dialog open={!!activateDialog} onOpenChange={() => setActivateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Zap className="h-5 w-5" />
              Request: Activate SKU
            </DialogTitle>
            <DialogDescription>
              This will be sent to Catalog Admin for approval. The SKU remains inactive until approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded border text-sm">
              <p className="font-medium text-gray-900">{activateDialog?.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {activateDialog?.skuCode} · {activateDialog?.brandId}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any context for the activation request?"
                value={activateNotes}
                onChange={(e) => setActivateNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialog(null)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleActivateConfirm}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
