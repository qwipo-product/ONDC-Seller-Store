import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import { ServiceabilityManager } from "../../components/serviceability-manager";
import { CompanyComboBox } from "../../components/company-combobox";
import {
  getLogisticsSettings,
  setLogisticsSettings,
  subscribeToLogisticsSettings,
} from "../../lib/logistics-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  ArrowLeft,
  User as UserIcon,
  FileText,
  Plug,
  ShieldCheck,
  Building2,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  ArrowRight,
  MapPin,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSellerById,
  updateSellerPermissions,
  updateSellerOndcConfig,
  updateManagedCompanies,
  updateCompanyBrandSelections,
  updateSellerImage,
  updateSellerActive,
  getQwipoCompanies,
  emptyOndcConfig,
  type Seller,
  type SellerPermissions,
  type OndcConfig,
  type ConnectorType,
  type CompanyBrandSelection,
} from "../../lib/mock-store";
import {
  getCompanies as getAdminCatalogCompanies,
  subscribeToCompanies as subscribeToAdminCatalog,
  revokeImage,
  type Company as AdminCatalogCompany,
} from "../../lib/admin-catalog";
import { Camera, Upload as UploadIcon } from "lucide-react";

const emptyPermissions: SellerPermissions = {
  view: false,
  write: false,
  edit: false,
  update: false,
};

const DATA_SYNC_TYPES = ["SKU", "Orders", "Customers", "Inventory", "Pricing"];

export function AdminSellerDetail() {
  const { sellerId } = useParams();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [activeTab, setActiveTab] = useState("profile");

  // Profile is read-only post-creation (no edit affordance in Phase 1).

  // Active/Inactive toggle — pendingActiveValue holds the proposed flip
  // until the admin confirms it in the dialog. null = no pending change.
  const [pendingActiveValue, setPendingActiveValue] = useState<boolean | null>(null);

  // Permissions state
  const [permissions, setPermissions] = useState<SellerPermissions>(emptyPermissions);
  const [permissionsDirty, setPermissionsDirty] = useState(false);

  // Logistics connector state — reads the same logisticsSettings store
  // that the seller sidebar uses. The Logistics connector is now part
  // of the unified Add Connector chooser; there's no separate Add
  // Logistics dialog anymore.
  const [logisticsEnabled, setLogisticsEnabled] = useState(
    sellerId ? getLogisticsSettings(sellerId).enabled : false,
  );

  // Connectors state — dialogs
  const [addConnectorOpen, setAddConnectorOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configDialogType, setConfigDialogType] = useState<ConnectorType | "">("");
  const [configSellerId, setConfigSellerId] = useState("");
  const [configApiKey, setConfigApiKey] = useState("");
  // Inline errors for the Add ONDC dialog. Connect button is always
  // enabled — clicking with empty fields populates these and renders the
  // red helper line under each input instead of silently no-op'ing.
  const [configErrors, setConfigErrors] = useState<{
    sellerId?: string;
    apiKey?: string;
  }>({});
  // Phase 1 ships ONDC only — Bizom (DMS) connectors are deferred to Phase 2.
  // The legacy `extraDmsConnectors` list is kept here as an empty array so the
  // existing rendering branches don't blow up; we no longer surface a way to
  // add to it.
  interface ExtraDmsConnector {
    id: string;
    brandName: string;
    type: ConnectorType;
    sellerId: string;
  }
  const [extraDmsConnectors] = useState<ExtraDmsConnector[]>([]);

  // Managed Companies dialog
  const [addCompaniesOpen, setAddCompaniesOpen] = useState(false);
  const [companiesSelection, setCompaniesSelection] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sellerId) return;
    const s = getSellerById(sellerId);
    setSeller(s || null);
    if (s) {
      setPermissions(s.permissions);
      setPermissionsDirty(false);
    }
  }, [sellerId]);

  useEffect(() => {
    if (!sellerId) return;
    setLogisticsEnabled(getLogisticsSettings(sellerId).enabled);
    return subscribeToLogisticsSettings(sellerId, () => {
      setLogisticsEnabled(getLogisticsSettings(sellerId).enabled);
    });
  }, [sellerId]);

  if (!seller) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">Seller not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/admin/users")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sellers
          </Button>
        </div>
      </div>
    );
  }

  // ---- Helpers ----

  const togglePermission = (key: keyof SellerPermissions) => {
    setPermissions((p) => ({ ...p, [key]: !p[key] }));
    setPermissionsDirty(true);
  };

  const savePermissions = () => {
    const updated = updateSellerPermissions(seller.id, permissions);
    if (updated) {
      toast.success(`Permissions updated for ${seller.name}`);
      setSeller(updated);
      setPermissionsDirty(false);
    } else {
      toast.error("Failed to update permissions");
    }
  };

  const openConnectorConfig = (type: ConnectorType) => {
    setConfigDialogType(type);
    setConfigSellerId("");
    setConfigApiKey("");
    setConfigErrors({});
    setConfigDialogOpen(true);
    setAddConnectorOpen(false);
  };

  const saveConnectorConfig = () => {
    // Validate first; if anything is missing, surface field-level
    // errors instead of silently no-op'ing.
    const next: { sellerId?: string; apiKey?: string } = {};
    if (!configSellerId.trim()) next.sellerId = "Seller ID is required.";
    if (!configApiKey.trim()) next.apiKey = "API Key is required.";
    if (Object.keys(next).length > 0) {
      setConfigErrors(next);
      return;
    }
    setConfigErrors({});
    // Phase 1: only ONDC is supported.
    const updated = updateSellerOndcConfig(seller.id, {
      subscriberId: configSellerId, uniqueKeyId: "", privateKey: configApiKey, apiEndpoint: "", webhookUrl: "",
      dataSyncTypes: [], syncFrequencyMinutes: 15, maxRetries: 3, autoRetry: true, autoSyncEnabled: true,
    });
    if (updated) {
      toast.success("ONDC connector added.");
      setSeller(updated);
      setConfigDialogOpen(false);
    } else {
      toast.error("Could not save the ONDC connector. Please try again.");
    }
  };

  const toggleSyncType = (type: string) => {
    setOndcForm((f) => ({
      ...f,
      dataSyncTypes: f.dataSyncTypes.includes(type)
        ? f.dataSyncTypes.filter((t) => t !== type)
        : [...f.dataSyncTypes, type],
    }));
  };

  const openAddCompanies = () => {
    setCompaniesSelection(new Set(seller.managedCompanies));
    setAddCompaniesOpen(true);
  };

  const saveManagedCompanies = () => {
    const updated = updateManagedCompanies(
      seller.id,
      Array.from(companiesSelection),
    );
    if (updated) {
      toast.success("Managed companies updated");
      setSeller(updated);
      setAddCompaniesOpen(false);
    } else {
      toast.error("Failed to update companies");
    }
  };

  const removeCompany = (companyId: string) => {
    const next = seller.managedCompanies.filter((id) => id !== companyId);
    const updated = updateManagedCompanies(seller.id, next);
    if (updated) {
      toast.success("Company removed");
      setSeller(updated);
    }
  };

  // ---- Badges ----

  const kycBadge = () => {
    if (seller.kyc.status === "verified") {
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          Verified
        </Badge>
      );
    }
    if (seller.kyc.status === "submitted") {
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
          Submitted
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-700 border-gray-300">
        Not Started
      </Badge>
    );
  };

  const connectorBadge = (state: { status: "connected" | "not_connected" }) =>
    state.status === "connected" ? (
      <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </Badge>
    ) : (
      <Badge variant="outline" className="text-gray-600">
        Not Connected
      </Badge>
    );

  const permissionItems: {
    key: keyof SellerPermissions;
    label: string;
    description: string;
  }[] = [
    { key: "view", label: "View", description: "Read-only access to data on assigned modules" },
    { key: "write", label: "Write", description: "Create new records (e.g., add SKUs, add customers)" },
    { key: "edit", label: "Edit", description: "Modify existing records on assigned modules" },
    { key: "update", label: "Update", description: "Push updates to downstream connectors (e.g., sync price)" },
  ];

  const qwipoCompanies = getQwipoCompanies();
  const linkedCompanies = qwipoCompanies.filter((c) =>
    seller.managedCompanies.includes(c.id),
  );

  const ondcConnected = seller.connectors.ondc.status === "connected";

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header — back arrow + seller avatar (click to upload) + name */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/users")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Avatar with click-to-replace */}
            <SellerAvatar
              seller={seller}
              onChange={(url) => {
                const updated = updateSellerImage(seller.id, url);
                if (updated) setSeller(updated);
                toast.success(url ? "Photo updated" : "Photo removed");
              }}
            />

            <div>
              <h2 className="text-lg font-semibold text-gray-900">{seller.name}</h2>
              <p className="text-sm text-gray-500">
                {seller.businessName} • {seller.city}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(seller.isActive ?? true) ? (
              <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </Badge>
            ) : (
              <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                <AlertCircle className="h-3 w-3" />
                Inactive
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-gray-200 p-3">
              <TabsList className="bg-gray-100 p-1 rounded-lg inline-flex gap-1 h-auto flex-wrap">
                <TabsTrigger
                  value="profile"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2"
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger
                  value="catalog"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Companies &amp; Brands
                </TabsTrigger>
                <TabsTrigger
                  value="connectors"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2"
                >
                  <Plug className="h-4 w-4 mr-2" />
                  Connector
                </TabsTrigger>
                <TabsTrigger
                  value="serviceability"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Serviceability
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Profile — read-only. Mirrors the fields captured during
                Add Seller. Laid out in dense 3-column rows so wide cards
                aren't half-empty: short fields (Mobile, Seller Type, PIN,
                City, State, Lat, Lng, Created On) pack tightly, and the
                long Full Address field spans the row. */}
            <TabsContent value="profile" className="p-6 mt-0">
              <div className="space-y-6">
                {/* Status — pinned at the top so the admin can flip
                    Active / Inactive without scrolling. Opens a confirmation
                    prompt before the change is saved. */}
                <section className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex-1 min-w-[260px]">
                      <Label className="text-sm font-medium">Status</Label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Toggle to activate or deactivate this seller. A
                        confirmation will appear before the change is saved.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          (seller.isActive ?? true)
                            ? "text-green-700"
                            : "text-gray-500"
                        }`}
                      >
                        {(seller.isActive ?? true) ? "Active" : "Inactive"}
                      </span>
                      <Switch
                        checked={seller.isActive ?? true}
                        onCheckedChange={(next) => {
                          // Open the confirm dialog instead of flipping
                          // immediately. The dialog persists on confirm.
                          setPendingActiveValue(next);
                        }}
                      />
                    </div>
                  </div>
                </section>

                {/* Identity */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    Identity
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                    <Field label="Full Name" value={seller.name} />
                    <Field label="Mobile Number" value={seller.phone} />
                    <Field
                      label="Seller Type"
                      value={
                        seller.sellerType === "wholesaler"
                          ? "Wholesaler"
                          : "Distributor"
                      }
                    />
                    <Field label="Business Name" value={seller.businessName} />
                    <Field
                      label="Created On"
                      value={
                        seller.approvedAt
                          ? new Date(seller.approvedAt).toLocaleDateString()
                          : "—"
                      }
                    />
                  </div>
                </section>

                {/* Address */}
                <section className="pt-6 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    Address
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                    <Field label="PIN Code" value={seller.pinCode || "—"} />
                    <Field label="City" value={seller.city || "—"} />
                    <Field label="State" value={seller.state || "—"} />
                    <Field
                      label="Latitude"
                      value={
                        seller.latitude !== undefined
                          ? String(seller.latitude)
                          : "—"
                      }
                    />
                    <Field
                      label="Longitude"
                      value={
                        seller.longitude !== undefined
                          ? String(seller.longitude)
                          : "—"
                      }
                    />
                    <Field
                      label="Full Address"
                      value={seller.fullAddress || "—"}
                      className="sm:col-span-2 lg:col-span-3"
                    />
                  </div>
                </section>

              </div>
            </TabsContent>

            {/* Companies & Brands attached to this seller */}
            <TabsContent value="catalog" className="p-6 mt-0">
              <SellerCatalogTab
                seller={seller}
                onChange={(s) => setSeller(s)}
              />
            </TabsContent>

            {/* KYC — hidden */}
            <TabsContent value="kyc" className="p-6 mt-0">
              {seller.kyc.status === "not_started" ? (
                <div className="text-center py-10">
                  <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-600">KYC not started</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Seller has not submitted KYC information yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                  <Field label="PAN" value={seller.kyc.pan || "—"} />
                  <Field label="Aadhaar" value={seller.kyc.aadhaar || "—"} />
                  <Field label="GSTIN" value={seller.kyc.gstin || "—"} />
                  <Field
                    label="Bank Account"
                    value={seller.kyc.bankAcct || "—"}
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="Business Address"
                      value={seller.kyc.businessAddress || "—"}
                    />
                  </div>
                  <Field
                    label="Submitted On"
                    value={
                      seller.kyc.updatedAt
                        ? new Date(seller.kyc.updatedAt).toLocaleDateString()
                        : "—"
                    }
                  />
                  <div>
                    <Label className="text-xs text-gray-500">Status</Label>
                    <div className="mt-1">{kycBadge()}</div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Connectors — one unified section for every connector type
                (marketplace + logistics). Connected cards render side by
                side in the same grid; the Add Connector dialog hosts every
                available type so there's no separate Add Logistics CTA. */}
            <TabsContent value="connectors" className="p-6 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Connectors
                  </h3>
                  <p className="text-sm text-gray-500">
                    Manage this seller's marketplace and logistics
                    integrations.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => setAddConnectorOpen(true)}
                  disabled={ondcConnected && logisticsEnabled}
                >
                  <Plus className="h-4 w-4" />
                  Add Connector
                </Button>
              </div>

              {!ondcConnected && !logisticsEnabled ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Plug className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-600">
                    No connectors configured yet
                  </p>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    Add a marketplace (ONDC) or a logistics provider (Qwipo
                    Logistics) so this seller can transact and fulfil
                    orders.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setAddConnectorOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Connector
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ondcConnected && (
                    <ConnectorCard
                      icon={<ShoppingBag className="h-5 w-5" />}
                      iconBg="bg-orange-100 text-orange-600"
                      name="ONDC"
                      subtitle="Marketplace"
                      description="Open Network for Digital Commerce — buyer-side order routing."
                      badge={connectorBadge(seller.connectors.ondc)}
                    />
                  )}
                  {logisticsEnabled && (
                    <ConnectorCard
                      icon={<Truck className="h-5 w-5" />}
                      iconBg="bg-blue-100 text-blue-600"
                      name="Qwipo Logistics"
                      subtitle="Logistics"
                      description="Logistics fulfilment via ONDC network — delivery planning, tracking and status sync."
                      badge={
                        <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </Badge>
                      }
                    />
                  )}
                </div>
              )}
            </TabsContent>

            {/* Permissions */}
            <TabsContent value="permissions" className="p-6 mt-0">
              <div className="max-w-2xl space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Grant per-seller access levels. Changes take effect
                  immediately on save.
                </p>
                {permissionItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">
                        {item.description}
                      </p>
                    </div>
                    <Switch
                      checked={permissions[item.key]}
                      onCheckedChange={() => togglePermission(item.key)}
                    />
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    disabled={!permissionsDirty}
                    onClick={() => {
                      setPermissions(seller.permissions);
                      setPermissionsDirty(false);
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    className=""
                    disabled={!permissionsDirty}
                    onClick={savePermissions}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Managed Companies */}
            <TabsContent value="companies" className="p-6 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Managed Companies
                  </h3>
                  <p className="text-sm text-gray-500">
                    Qwipo catalog companies this distributor is linked to. The
                    seller will only see products from these companies when
                    adding SKUs.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={openAddCompanies}
                >
                  <Plus className="h-4 w-4" />
                  Add Companies
                </Button>
              </div>

              {linkedCompanies.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Building2 className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-600">
                    No companies linked
                  </p>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    Link Qwipo catalog companies to grant this seller access to
                    their products.
                  </p>
                  <Button
                    variant="outline"
                    onClick={openAddCompanies}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Companies
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {linkedCompanies.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-purple-100 text-purple-600 p-2 rounded-lg flex-shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {c.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {c.category}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => removeCompany(c.id)}
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Serviceability — moved here from the seller-side
                Settings hub. Renders the same flow (per-company
                polygon upload, list + configure views) inside the
                Manage Seller view, so admins can configure delivery
                zones for any seller from a single place. */}
            <TabsContent value="serviceability" className="p-6 mt-0">
              <ServiceabilityManager
                warehouse={
                  seller.latitude != null && seller.longitude != null
                    ? {
                        lat: seller.latitude,
                        lng: seller.longitude,
                        name: seller.name,
                        businessName: seller.businessName,
                        address:
                          [
                            seller.fullAddress,
                            seller.city,
                            seller.state,
                            seller.pinCode,
                          ]
                            .filter(Boolean)
                            .join(", ") || undefined,
                      }
                    : undefined
                }
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* -------- Dialogs -------- */}

      {/* Add Connector (chooser) — now hosts both ONDC and Logistics so
          the admin sees every available connector behind a single CTA. */}
      <Dialog open={addConnectorOpen} onOpenChange={setAddConnectorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Connector</DialogTitle>
            <DialogDescription>
              Choose the type of connector you want to add for this seller.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <button
              type="button"
              disabled={ondcConnected}
              onClick={() => openConnectorConfig("ondc")}
              className={`w-full p-4 rounded-lg border text-left transition-all ${
                ondcConnected
                  ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                  : "border-gray-200 hover:border-orange-400 hover:shadow-sm"
              }`}
            >
              <div className="bg-orange-100 text-orange-600 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <p className="font-semibold text-gray-900">ONDC</p>
              <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs my-1">
                Marketplace
              </Badge>
              <p className="text-xs text-gray-600 mt-1">
                Open Network for Digital Commerce. Buyer-side order routing.
              </p>
              {ondcConnected && (
                <p className="text-xs text-green-600 font-medium mt-2">
                  Already added
                </p>
              )}
            </button>

            {/* Logistics — Qwipo Logistics. Clicking the tile flips the
                seller's logistics setting on and closes the chooser. No
                follow-up form: a logistics connector has no per-seller
                credentials to capture (it's an internal Qwipo service). */}
            <button
              type="button"
              disabled={logisticsEnabled}
              onClick={() => {
                if (!sellerId) return;
                setLogisticsSettings(sellerId, { enabled: true });
                setLogisticsEnabled(true);
                setAddConnectorOpen(false);
                toast.success("Qwipo Logistics connected.");
              }}
              className={`w-full p-4 rounded-lg border text-left transition-all ${
                logisticsEnabled
                  ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                  : "border-gray-200 hover:border-blue-400 hover:shadow-sm"
              }`}
            >
              <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Truck className="h-5 w-5" />
              </div>
              <p className="font-semibold text-gray-900">Qwipo Logistics</p>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs my-1">
                Logistics
              </Badge>
              <p className="text-xs text-gray-600 mt-1">
                ONDC logistics fulfilment — route planning, delivery
                tracking and status sync.
              </p>
              {logisticsEnabled && (
                <p className="text-xs text-green-600 font-medium mt-2">
                  Already added
                </p>
              )}
            </button>

            <p className="text-[11px] text-gray-500 mt-3">
              DMS connectors (Bizom, Tally, etc.) will arrive in Phase 2.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddConnectorOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connector Config Dialog — Seller ID + API Key only */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-600" />
              Connect ONDC
            </DialogTitle>
            <DialogDescription>
              Enter the Seller ID and API Key shared by ONDC for this seller.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className={configErrors.sellerId ? "text-red-700" : ""}>
                Seller ID <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Enter seller ID"
                value={configSellerId}
                onChange={(e) => {
                  setConfigSellerId(e.target.value);
                  if (configErrors.sellerId)
                    setConfigErrors((p) => ({ ...p, sellerId: undefined }));
                }}
                aria-invalid={!!configErrors.sellerId}
              />
              {configErrors.sellerId && (
                <p className="flex items-start gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{configErrors.sellerId}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className={configErrors.apiKey ? "text-red-700" : ""}>
                API Key <span className="text-red-500">*</span>
              </Label>
              <Input
                type="password"
                placeholder="Enter API key"
                value={configApiKey}
                onChange={(e) => {
                  setConfigApiKey(e.target.value);
                  if (configErrors.apiKey)
                    setConfigErrors((p) => ({ ...p, apiKey: undefined }));
                }}
                aria-invalid={!!configErrors.apiKey}
              />
              {configErrors.apiKey && (
                <p className="flex items-start gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{configErrors.apiKey}</span>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            {/* CTA always enabled — clicking with empty fields fires
                inline errors above instead of silently no-op'ing. */}
            <Button onClick={saveConnectorConfig}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Active / Inactive confirmation prompt — fires whenever the admin
          flips the Status toggle on the Profile tab. The actual write only
          happens after explicit confirmation. */}
      <Dialog
        open={pendingActiveValue !== null}
        onOpenChange={(o) => !o && setPendingActiveValue(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingActiveValue ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              {pendingActiveValue
                ? "Activate this seller?"
                : "Deactivate this seller?"}
            </DialogTitle>
            <DialogDescription>
              {pendingActiveValue ? (
                <>
                  Re-activating <b>{seller.name}</b> will restore their access
                  immediately:
                </>
              ) : (
                <>
                  Deactivating <b>{seller.name}</b> has the following effects:
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 py-2">
            {pendingActiveValue ? (
              <>
                <li>The seller will be able to log in again.</li>
                <li>
                  They'll be able to view and manage their orders, products and
                  customers.
                </li>
                <li>
                  You'll be able to link new companies and add more brands to
                  this seller.
                </li>
              </>
            ) : (
              <>
                <li>The seller will not be able to log in.</li>
                <li>
                  They will not be able to view or manage their orders or
                  products.
                </li>
                <li>
                  You will not be able to link new companies or add more brands
                  to this seller until they are re-activated.
                </li>
                <li>Existing data is preserved and can be restored anytime.</li>
              </>
            )}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingActiveValue(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingActiveValue === null) return;
                const updated = updateSellerActive(seller.id, pendingActiveValue);
                if (updated) {
                  setSeller(updated);
                  toast.success(
                    pendingActiveValue
                      ? `${updated.name} is now Active.`
                      : `${updated.name} has been deactivated.`,
                  );
                } else {
                  toast.error("Could not update status. Please try again.");
                }
                setPendingActiveValue(null);
              }}
              className={
                pendingActiveValue
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {pendingActiveValue ? "Yes, Activate" : "Yes, Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Managed Companies */}
      <Dialog open={addCompaniesOpen} onOpenChange={setAddCompaniesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link Companies from Qwipo Catalog</DialogTitle>
            <DialogDescription>
              Select the companies this distributor can sell products from.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {qwipoCompanies.map((c) => {
              const checked = companiesSelection.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    checked
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        const next = new Set(companiesSelection);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        setCompaniesSelection(next);
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {c.name}
                      </p>
                      <p className="text-xs text-gray-500">{c.category}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddCompaniesOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className=""
              onClick={saveManagedCompanies}
            >
              Save ({companiesSelection.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Small helpers ----------

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-gray-500 font-normal">{label}</Label>
      <p className="mt-1 text-sm text-gray-900 font-medium break-words">
        {value}
      </p>
    </div>
  );
}

// ---- Seller Avatar — header tile with click-to-upload + remove ----
function SellerAvatar({
  seller,
  onChange,
}: {
  seller: Seller;
  onChange: (url: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const initials = seller.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files allowed");
      return;
    }
    revokeImage(seller.imageUrl ?? null);
    const url = URL.createObjectURL(f);
    onChange(url);
    if (ref.current) ref.current.value = "";
  };

  const handleClear = () => {
    revokeImage(seller.imageUrl ?? null);
    onChange(null);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="relative w-12 h-12 rounded-full border border-gray-200 bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center overflow-hidden group"
        title="Click to upload / change photo"
      >
        {seller.imageUrl ? (
          <>
            <img src={seller.imageUrl} alt={seller.name} className="w-full h-full object-cover" />
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-blue-700">{initials || "S"}</span>
            <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </span>
          </>
        )}
      </button>
      {seller.imageUrl && (
        <button
          type="button"
          onClick={handleClear}
          className="text-[11px] text-red-600 hover:text-red-700 underline"
          title="Remove photo"
        >
          Remove
        </button>
      )}
    </div>
  );
}

// ---- Companies & Brands tab on the Seller Detail page ----
// Shows companies/brands tagged to this seller and lets the admin
// add more from the master Companies & Brands catalog, or remove
// existing links.
export function SellerCatalogTab({
  seller,
  onChange,
}: {
  seller: Seller;
  onChange: (s: Seller) => void;
}) {
  const [companies, setCompanies] = useState<AdminCatalogCompany[]>(getAdminCatalogCompanies());
  useEffect(() => subscribeToAdminCatalog(() => setCompanies([...getAdminCatalogCompanies()])), []);

  const selections = seller.companyBrandSelections ?? [];
  // Inactive sellers can't have new companies linked to them.
  const isInactive = seller.isActive === false;

  // ---- Add Company dialog ----
  const [addOpen, setAddOpen] = useState(false);
  const [addCompanyId, setAddCompanyId] = useState<string>("");
  const [addAllBrands, setAddAllBrands] = useState(true);
  const [addBrandIds, setAddBrandIds] = useState<string[]>([]);

  // ---- Add Brands dialog (per-card "+ Add Brands" CTA) ----
  // Behaves as "extend only" — existing brand access is preserved and
  // cannot be revoked from this surface. The admin can:
  //   • tick additional brands on top of the locked existing ones, or
  //   • flip on "Use all brands" to grant everything.
  // They cannot untick an already-linked brand, nor switch from
  // all-brands back to specific (that would shrink access).
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editAllBrands, setEditAllBrands] = useState(true);
  const [editBrandIds, setEditBrandIds] = useState<string[]>([]);
  // Captured at open-time so we can lock the existing brands and the
  // "all brands" mode flag against being downgraded.
  const [existingBrandIds, setExistingBrandIds] = useState<string[]>([]);
  const [existingWasAllBrands, setExistingWasAllBrands] = useState(false);

  const editingCompany = editTarget
    ? companies.find((c) => c.id === editTarget)
    : null;
  const editingSelection = editTarget
    ? selections.find((s) => s.companyId === editTarget)
    : null;

  const openEdit = (companyId: string) => {
    const sel = selections.find((s) => s.companyId === companyId);
    if (!sel) return;
    setEditTarget(companyId);
    const isAll = sel.brandIds.length === 0;
    setEditAllBrands(isAll);
    setEditBrandIds(isAll ? [] : [...sel.brandIds]);
    setExistingBrandIds(isAll ? [] : [...sel.brandIds]);
    setExistingWasAllBrands(isAll);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditAllBrands(true);
    setEditBrandIds([]);
    setExistingBrandIds([]);
    setExistingWasAllBrands(false);
  };

  const toggleEditBrand = (brandId: string) => {
    // Existing brand access is sticky — admins can only ADD on top of it
    // from this dialog. Removal is intentionally not surfaced here.
    if (existingBrandIds.includes(brandId)) return;
    setEditBrandIds((prev) =>
      prev.includes(brandId)
        ? prev.filter((b) => b !== brandId)
        : [...prev, brandId],
    );
  };

  const handleEditSubmit = () => {
    if (!editTarget) return;
    if (!editAllBrands && editBrandIds.length === 0) {
      toast.error("Pick at least one brand or choose 'Use all brands'");
      return;
    }
    const next: CompanyBrandSelection[] = selections.map((s) =>
      s.companyId === editTarget
        ? {
            companyId: editTarget,
            brandIds: editAllBrands ? [] : editBrandIds,
          }
        : s,
    );
    persistSelections(next);
    toast.success(
      editingCompany
        ? `Updated brand access for ${editingCompany.name}`
        : "Updated brand access",
    );
    closeEdit();
  };

  // Once a company is linked it can't be removed. Extending brands on
  // an already-linked company now lives behind the per-card "Add Brands"
  // CTA, so the Link a Company dropdown should only surface companies
  // the seller is NOT yet linked to — re-picking the same company here
  // would just duplicate the Add-Brands flow.
  const linkedCompanyIds = new Set(selections.map((s) => s.companyId));
  const availableCompanies = companies.filter(
    (c) => c.isActive !== false && !linkedCompanyIds.has(c.id),
  );
  const selectedAddCompany = companies.find((c) => c.id === addCompanyId);

  const openAdd = () => {
    setAddCompanyId("");
    setAddAllBrands(true);
    setAddBrandIds([]);
    setAddOpen(true);
  };

  const toggleAddBrand = (brandId: string) => {
    setAddBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((b) => b !== brandId) : [...prev, brandId],
    );
  };

  const persistSelections = (next: CompanyBrandSelection[]) => {
    const updated = updateCompanyBrandSelections(seller.id, next);
    if (updated) onChange(updated);
  };

  const handleAddSubmit = () => {
    if (!addCompanyId) {
      toast.error("Please select a company");
      return;
    }
    if (!addAllBrands && addBrandIds.length === 0) {
      toast.error("Pick at least one brand or choose 'Use all brands'");
      return;
    }
    // Picker only surfaces unlinked companies now, so this is always a
    // fresh link — the merge branch is gone. Adding brands to an already-
    // linked company happens via the per-card "Add Brands" CTA which
    // opens the Edit Brand Access dialog.
    const company = companies.find((c) => c.id === addCompanyId);
    const next: CompanyBrandSelection[] = [
      ...selections,
      {
        companyId: addCompanyId,
        brandIds: addAllBrands ? [] : addBrandIds,
      },
    ];
    persistSelections(next);
    toast.success(`Linked "${company?.name ?? "company"}" to seller`);
    setAddOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Companies &amp; Brands
          </h3>
          <p className="text-sm text-gray-500">
            Companies and brands this distributor sells. Add more to grant
            access to additional catalog products.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={openAdd}
          disabled={isInactive || availableCompanies.length === 0}
          title={
            isInactive
              ? "Activate this seller before linking new companies"
              : availableCompanies.length === 0
                ? "No active companies in the catalog"
                : undefined
          }
        >
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </div>

      {isInactive && (
        <div className="mb-3 flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-900">Seller is inactive</p>
            <p className="text-amber-800">
              You can't link new companies until this seller is re-activated
              from the Profile tab.
            </p>
          </div>
        </div>
      )}

      {selections.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Building2 className="h-10 w-10 mx-auto text-gray-300 mb-2" />
          <p className="font-medium text-gray-600">No companies linked</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Link companies from the master catalog so this seller can list
            their products.
          </p>
          <Button
            variant="outline"
            onClick={openAdd}
            className="gap-2"
            disabled={isInactive || availableCompanies.length === 0}
            title={
              isInactive
                ? "Activate this seller before linking companies"
                : undefined
            }
          >
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {selections.map((sel) => {
            const company = companies.find((c) => c.id === sel.companyId);
            if (!company) return null;
            const allBrands = sel.brandIds.length === 0;
            const visibleBrands = allBrands
              ? company.brands
              : company.brands.filter((b) => sel.brandIds.includes(b.id));
            // The OUTER `isInactive` covers the seller; this inner one
            // covers the catalog company status.
            const isCompanyInactive = company.isActive === false;
            const isInactiveSeller = isInactive;
            return (
              <div
                key={sel.companyId}
                className="border border-gray-200 rounded-lg p-4 bg-white"
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {company.imageUrl ? (
                      <img
                        src={company.imageUrl}
                        alt={company.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {company.name}
                      </p>
                      {isCompanyInactive && (
                        <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">
                          Inactive in catalog
                        </Badge>
                      )}
                      {allBrands && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          All brands
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {allBrands
                        ? `All ${company.brands.length} brands`
                        : `${visibleBrands.length} of ${company.brands.length} brands`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {visibleBrands.map((b) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-2 py-0.5 text-xs text-gray-800"
                        >
                          <div className="w-5 h-5 rounded-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                            {b.imageUrl ? (
                              <img
                                src={b.imageUrl}
                                alt={b.name}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                          {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Per-card action — single "Add Brands" CTA. The
                      Edit Brand Access dialog it opens still supports
                      pruning and the Use-all-brands toggle, so power
                      users keep their full kit; we just don't expose
                      a second button for it. */}
                  <Button
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => openEdit(sel.companyId)}
                    disabled={isInactiveSeller}
                    title={
                      isInactiveSeller
                        ? "Activate this seller before adding brands"
                        : `Add more brands for ${company.name}`
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Brands
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Company Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Link a Company
            </DialogTitle>
            <DialogDescription>
              Pick a company from the master catalog and choose the brands
              this seller should have access to. Companies cannot be unlinked
              once added; to add more brands later, use the <b>Add Brands</b>
              button on the linked company below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Company</Label>
              {/* Search-and-select combobox — same pattern as the
                  SKU picker on Offers & Schemes and the Add Seller
                  flow's company picker. The list here is pre-filtered
                  to companies the seller hasn't already linked, so
                  every row is selectable. */}
              <CompanyComboBox
                value={addCompanyId}
                onChange={(v) => {
                  setAddCompanyId(v);
                  setAddAllBrands(true);
                  setAddBrandIds([]);
                }}
                placeholder="Choose a company…"
                companies={availableCompanies.map((c) => ({
                  id: c.id,
                  name: c.name,
                  brandCount: c.brands.length,
                }))}
                disabled={availableCompanies.length === 0}
              />
              {availableCompanies.length === 0 && (
                <p className="text-[11px] text-amber-700">
                  No more catalog companies to link. Use <b>Add Brands</b>{" "}
                  on an existing company below to extend its brand list.
                </p>
              )}
            </div>

            {selectedAddCompany && (
              <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Brands</Label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch
                      checked={addAllBrands}
                      onCheckedChange={(v) => {
                        setAddAllBrands(v);
                        if (v) setAddBrandIds([]);
                      }}
                    />
                    <span className="text-gray-700">Use all brands</span>
                  </label>
                </div>
                {!addAllBrands && (
                  <div className="flex flex-wrap gap-2">
                    {selectedAddCompany.brands.map((b) => {
                      const checked = addBrandIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleAddBrand(b.id)}
                          className={`inline-flex items-center gap-1.5 border rounded-full pl-1 pr-2 py-0.5 text-xs transition-colors ${
                            checked
                              ? "bg-blue-50 border-blue-300 text-blue-800"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleAddBrand(b.id)}
                            className="h-3.5 w-3.5"
                          />
                          {b.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {addAllBrands && (
                  <p className="text-[11px] text-gray-600">
                    All {selectedAddCompany.brands.length} brands will be
                    available. Future brands added to this company will also be
                    accessible automatically.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className=""
              onClick={handleAddSubmit}
              disabled={!addCompanyId}
            >
              Link Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company dialog — pre-fills from the existing brand
          selection and REPLACES (not merges) on save, so the admin can
          both add new brands and remove existing ones. The company
          itself is shown as read-only context. */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(o) => (o ? null : closeEdit())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add Brands
            </DialogTitle>
            <DialogDescription>
              Add more brands for this seller under{" "}
              <b>{editingCompany?.name ?? "this company"}</b>.
              Already-linked brands are locked — they can't be removed
              from this dialog.
            </DialogDescription>
          </DialogHeader>

          {editingCompany && editingSelection && (
            <div className="space-y-4">
              {/* Read-only company strip — gives the admin context but
                  prevents accidentally swapping the linked company. */}
              <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                <div className="w-10 h-10 rounded-md border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {editingCompany.imageUrl ? (
                    <img
                      src={editingCompany.imageUrl}
                      alt={editingCompany.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {editingCompany.name}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {editingCompany.brands.length} brand
                    {editingCompany.brands.length === 1 ? "" : "s"} available
                  </p>
                </div>
              </div>

              <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Brands</Label>
                  {/* The "Use all brands" switch is one-way here:
                        • If existing was all-brands, it's locked ON
                          (downgrading to specific would shrink access).
                        • Otherwise, the admin can flip it ON to grant
                          everything, but can't flip it back OFF without
                          re-opening the dialog (saving locks the new
                          state in too).
                      The disabled rule below covers both cases. */}
                  <label
                    className={`flex items-center gap-2 text-xs ${existingWasAllBrands ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                    title={existingWasAllBrands ? "All brands are already enabled — cannot be turned off" : undefined}
                  >
                    <Switch
                      checked={editAllBrands}
                      disabled={existingWasAllBrands}
                      onCheckedChange={(v) => {
                        // Block turning off if existing was all-brands.
                        // Block turning off if it's currently on but only
                        // because the admin just enabled it — same UX,
                        // they can cancel and reopen if they made a mistake.
                        if (existingWasAllBrands && !v) return;
                        setEditAllBrands(v);
                        if (v) setEditBrandIds([]);
                      }}
                    />
                    <span className="text-gray-700">Use all brands</span>
                  </label>
                </div>
                {!editAllBrands && (
                  <div className="flex flex-wrap gap-2">
                    {editingCompany.brands.map((b) => {
                      const checked = editBrandIds.includes(b.id);
                      const isExisting = existingBrandIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleEditBrand(b.id)}
                          disabled={isExisting}
                          title={isExisting ? "Already linked — cannot be removed here" : undefined}
                          className={`inline-flex items-center gap-1.5 border rounded-full pl-1 pr-2 py-0.5 text-xs transition-colors ${
                            isExisting
                              ? "bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed"
                              : checked
                                ? "bg-blue-50 border-blue-300 text-blue-800"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={isExisting}
                            onCheckedChange={() => toggleEditBrand(b.id)}
                            className="h-3.5 w-3.5"
                          />
                          {b.name}
                          {isExisting && (
                            <span className="text-[9px] uppercase tracking-wide font-semibold text-gray-500 ml-0.5">
                              linked
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {editAllBrands && (
                  <p className="text-[11px] text-gray-600">
                    {existingWasAllBrands
                      ? `All ${editingCompany.brands.length} brands are already enabled. Future brands added to this company will be accessible automatically — there is nothing to add here.`
                      : `All ${editingCompany.brands.length} brands will be granted. Future brands added to this company will also be accessible automatically.`}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              // Disable Save unless the admin has actually added
              // something on top of what was already linked.
              disabled={(() => {
                if (existingWasAllBrands) return true; // already at max
                if (editAllBrands && !existingWasAllBrands) return false; // upgrading to all
                // specific → specific: must include at least one NEW id.
                const hasNew = editBrandIds.some(
                  (id) => !existingBrandIds.includes(id),
                );
                return !hasNew;
              })()}
            >
              Add Brands
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Companies & Brands attached to the seller (admin-catalog data) ----
export function SellerCompaniesAndBrands({ seller }: { seller: Seller }) {
  const [companies, setCompanies] = useState<AdminCatalogCompany[]>(getAdminCatalogCompanies());
  useEffect(() => subscribeToAdminCatalog(() => setCompanies([...getAdminCatalogCompanies()])), []);

  const selections = seller.companyBrandSelections ?? [];

  if (selections.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
        <Building2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">No companies linked yet</p>
        <p className="text-xs text-gray-500 mt-1">
          Companies and brands selected during seller creation will show here. To
          add them now, edit this seller's catalog access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selections.map((sel) => {
        const company = companies.find((c) => c.id === sel.companyId);
        if (!company) return null;
        const allBrands = sel.brandIds.length === 0;
        const visibleBrands = allBrands
          ? company.brands
          : company.brands.filter((b) => sel.brandIds.includes(b.id));
        return (
          <div
            key={sel.companyId}
            className="border border-gray-200 rounded-lg p-3 bg-white"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                {company.imageUrl ? (
                  <img src={company.imageUrl} alt={company.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{company.name}</p>
                <p className="text-[11px] text-gray-500">
                  {allBrands
                    ? `All ${company.brands.length} brands`
                    : `${visibleBrands.length} of ${company.brands.length} brands`}
                </p>
              </div>
              {allBrands && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  All brands
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleBrands.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-2 py-0.5 text-xs text-gray-800"
                >
                  <div className="w-5 h-5 rounded-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ApiField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
      <Label className="text-xs text-gray-600 md:text-right">{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="md:col-span-2 font-mono text-xs"
      />
    </div>
  );
}

function ConnectorCard({
  icon,
  iconBg,
  name,
  subtitle,
  description,
  badge,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  subtitle: string;
  description: string;
  badge: React.ReactNode;
}) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`${iconBg} p-2 rounded-lg`}>{icon}</div>
            <div>
              <p className="font-semibold text-gray-900">{name}</p>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          {badge}
        </div>
        <p className="text-xs text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );
}

