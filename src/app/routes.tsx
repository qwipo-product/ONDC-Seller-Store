import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/root-layout";
import { ProtectedRoute } from "./components/protected-route";
import { CatalogAdminLogin } from "./pages/catalog-admin/login";
import { CatalogAdminLayout } from "./pages/catalog-admin/layout";
import { CatalogAdminDashboard } from "./pages/catalog-admin/dashboard";
import { CatalogAdminRequests } from "./pages/catalog-admin/requests";
import { CatalogAdminCatalog } from "./pages/catalog-admin/catalog";
import { CatalogAdminSkuForm } from "./pages/catalog-admin/sku-form";
import { CatalogAdminBrandManagers } from "./pages/catalog-admin/brand-managers";
import { BrandManagerCompanies } from "./pages/catalog-admin/my-company";
import { BrandManagerCatalog } from "./pages/brand-manager/catalog";
import { BrandManagerDashboard } from "./pages/brand-manager/dashboard";
import { BrandManagerRequests } from "./pages/brand-manager/requests";
import { useAuth } from "./lib/auth-context";
import { MyRequests } from "./pages/products/my-requests";
import { Dashboard } from "./pages/dashboard";
import { DashboardCompany } from "./pages/dashboard-company";
import { Inventory } from "./pages/inventory";
import { Orders } from "./pages/orders/list";
import { OrderDetail } from "./pages/orders/detail";
import { CustomerOrderDetail } from "./pages/orders/customer-order";
import { Customers } from "./pages/customers/legacy-list";
import { CustomerDetail } from "./pages/customers/legacy-detail";
import { CustomersDemo } from "./pages/customers/list";
import { CustomerDemoDetail } from "./pages/customers/detail";
import { CustomersDms } from "./pages/customers-dms/list";
import { CustomerDmsDetail } from "./pages/customers-dms/detail";
import { Profile } from "./pages/profile";
import { Connectors } from "./pages/connectors/list";
import { ConnectorDetail } from "./pages/connectors/detail";
import { Support } from "./pages/support";
import { Settings } from "./pages/settings";
import { Reports } from "./pages/reports";
import { Login } from "./pages/auth/login";
import { Onboarding } from "./pages/auth/onboarding";
import { DesignSystem } from "./pages/design-system";
import { AddSKU } from "./pages/products/add-sku";
import { MySKU } from "./pages/products/my-sku";
import { SKUDetail } from "./pages/products/sku-detail";
import { AddManually } from "./pages/products/add-sku/manual";
import { BrandSync } from "./pages/products/add-sku/brand-sync";
import { CentralCatalogSync } from "./pages/products/add-sku/central-catalog-sync";
import { PriceList } from "./pages/products/price-list";
import { OffersList } from "./pages/offers/offers-list";
import { OffersDemo } from "./pages/offers/offers-demo";
import { CreateScheme } from "./pages/offers/create-scheme";
import { StoreSettings } from "./pages/settings/store-settings";
import { OrderSettings } from "./pages/settings/order-settings";
import { PaymentSettings } from "./pages/settings/payment-settings";
import { CustomerSettings } from "./pages/settings/customer-settings";
import { CommunicationSettings } from "./pages/settings/communication-settings";
import { SalesOrdersReport } from "./pages/reports/sales-orders";
import { InventoryInsightsReport } from "./pages/reports/inventory-insights";
import { ProductPerformanceReport } from "./pages/reports/product-performance";
import { CustomerInsightsReport } from "./pages/reports/customer-insights";
import { SchemesOffersReport } from "./pages/reports/schemes-offers";
import { OperationsDeliveryReport } from "./pages/reports/operations-delivery";
import { KycPage } from "./pages/kyc";
import { AdminDashboard } from "./pages/admin/dashboard";
import { AdminNewRequests } from "./pages/admin/new-requests";
import { AdminActiveSellers } from "./pages/admin/active-sellers";
import { AdminSellerDetail } from "./pages/admin/seller-detail";
import { AdminAddUser } from "./pages/admin/add-user";
import { AdminConnectors } from "./pages/admin/connectors";
import { AdminCustomers } from "./pages/admin/customers";
import { AdminCustomerDetail } from "./pages/admin/customer-detail";
import { AdminServiceabilityReport } from "./pages/admin/serviceability-report";
import { AdminDarkStoreDashboard } from "./pages/admin/dark-store-dashboard";
import { AdminCompanies } from "./pages/admin/companies";
import { AdminCategories } from "./pages/admin/categories";
import { ErrorScreensDemo } from "./pages/demos/error-screens";
import { LoadingScreensDemo } from "./pages/demos/loading-screens";

function CatalogAdminIndex() {
  const { user } = useAuth();
  if (user?.role === "brand-manager") return <BrandManagerDashboard />;
  return <CatalogAdminDashboard />;
}

// Same index logic used for the RootLayout-integrated catalog portal at /catalog-portal.
function CatalogPortalIndex() {
  const { user } = useAuth();
  if (user?.role === "brand-manager") return <BrandManagerDashboard />;
  return <CatalogAdminDashboard />;
}

export const router = createBrowserRouter([
  // Catalog Admin Portal — separate login + standalone layout
  {
    path: "/catalog-admin/login",
    Component: CatalogAdminLogin,
  },
  // Brand Manager login redirects to the shared portal login
  {
    path: "/brand-manager/login",
    element: <Navigate to="/catalog-admin/login" replace />,
  },
  {
    path: "/catalog-admin",
    element: (
      <ProtectedRoute allow={["catalog-admin", "brand-manager"]}>
        <CatalogAdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: CatalogAdminIndex },
      { path: "requests", Component: CatalogAdminRequests },
      { path: "catalog", Component: CatalogAdminCatalog },
      { path: "catalog/create", Component: CatalogAdminSkuForm },
      { path: "catalog/:skuId", Component: CatalogAdminSkuForm },
      { path: "companies", Component: AdminCompanies },
      { path: "my-company", Component: BrandManagerCompanies },
      { path: "brand-managers", Component: CatalogAdminBrandManagers },
      { path: "my-catalog", Component: BrandManagerCatalog },
      { path: "my-requests", Component: BrandManagerRequests },
    ],
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/onboarding",
    Component: Onboarding,
  },
  // Design system handbook — role-gated to "designer". Single-page
  // app with its own sidebar; intentionally does NOT use the
  // seller RootLayout because the audience here is reviewing
  // design language, not running a distribution business.
  {
    path: "/design",
    element: (
      <ProtectedRoute allow="designer">
        <DesignSystem />
      </ProtectedRoute>
    ),
  },
  // Admin subtree — role-gated to "admin"
  {
    path: "/admin",
    element: (
      <ProtectedRoute allow="admin">
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: AdminDashboard },
      // User Management (flat — was Active Sellers)
      { path: "users", Component: AdminActiveSellers },
      { path: "users/add", Component: AdminAddUser },
      { path: "users/:sellerId", Component: AdminSellerDetail },
      { path: "users/:sellerId/connectors/:connectorId", Component: ConnectorDetail },
      // Customer Database — uploaded roster + per-customer serviceability
      { path: "customers", Component: AdminCustomers },
      { path: "customers/:customerId", Component: AdminCustomerDetail },
      // Generate Report — customer × beat serviceability export
      { path: "reports", Component: AdminServiceabilityReport },
      // Dark Store — zone coverage dashboard per store
      { path: "dark-store/:storeId", Component: AdminDarkStoreDashboard },
      // Admin Connectors
      { path: "connectors", Component: AdminConnectors },
      { path: "connectors/:connectorId", Component: ConnectorDetail },
      // Admin Companies & Brands
      { path: "companies", Component: AdminCompanies },
      // Category Master — hierarchical taxonomy (37 ONDC roots + add/sub)
      { path: "categories", Component: AdminCategories },
      // Charges & Fees — logistics fee is configured per SELLER from a tile +
      // dialog on the Manage Seller "Charges & Fees" tab (no standalone route).
      // Error Screens demo gallery — only surfaced in the empty-mode
      // sidebar but routable for both admin paths.
      { path: "error-screens", Component: ErrorScreensDemo },
      // Loading Screens demo gallery — same empty-mode-only treatment.
      { path: "loading-screens", Component: LoadingScreensDemo },
      // Legacy aliases (keep old URLs working)
      { path: "requests", Component: AdminNewRequests },
      { path: "sellers", Component: AdminActiveSellers },
      { path: "sellers/:sellerId", Component: AdminSellerDetail },
      { path: "sellers/:sellerId/connectors/:connectorId", Component: ConnectorDetail },
    ],
  },
  // Seller subtree — sellers, catalog-admins, and brand-managers all share
  // the RootLayout shell. Role-specific nav is injected in root-layout.tsx.
  {
    path: "/",
    element: (
      <ProtectedRoute allow={["seller", "catalog-admin", "brand-manager"]}>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: Dashboard },
      { path: "products/my-requests", Component: MyRequests },
      // Per-company drill-down — opens from the company table on the
      // Dashboard. Carries the dashboard's date range via the query
      // string so the window survives the navigation.
      { path: "dashboard/companies/:companyId", Component: DashboardCompany },
      { path: "products/my-sku/edit/:skuId", Component: AddManually },
      { path: "products/my-sku", Component: MySKU },
      { path: "products/sku-detail/:skuId", Component: SKUDetail },
      { path: "products/add-sku", Component: AddSKU },
      { path: "products/add-sku/central-catalog", Component: CentralCatalogSync },
      { path: "products/add-sku/manual", Component: AddManually },
      { path: "products/add-sku/brand-sync", Component: BrandSync },
      { path: "products/price-list", Component: PriceList },
      { path: "offers", Component: OffersList },
      { path: "offers-demo", Component: OffersDemo },
      { path: "offers/create", Component: CreateScheme },
      { path: "inventory", Component: Inventory },
      { path: "orders", Component: Orders },
      { path: "orders/:orderId", Component: OrderDetail },
      // Customer-wise view: one customer checkout across its company orders.
      { path: "orders/customer/:checkoutId", Component: CustomerOrderDetail },
      // The Customers module ships the auto-register-on-first-order
      // flow (originally prototyped as "Customers 2" in the
      // empty-mode demo). It became the production model after PM
      // sign-off, so it's mounted at /customers — the canonical
      // sidebar entry. The legacy Pending → Approved → Rejected
      // approval flow is preserved at /customers-demo so empty-mode
      // reviewers can still compare the two.
      { path: "customers", Component: CustomersDemo },
      { path: "customers/:customerId", Component: CustomerDemoDetail },
      // Legacy approval flow — kept for reference under the empty-
      // mode "Customers 2" sidebar entry.
      // New Onboarding — new-customer requests from the buyer
      // app, downloaded and handed to the company to create in its
      // DMS. Mounted on its own path so the live /customers module is
      // untouched.
      { path: "new-onboarding", Component: CustomersDms },
      { path: "new-onboarding/:customerId", Component: CustomerDmsDetail },
      { path: "customers-demo", Component: Customers },
      { path: "customers-demo/:customerId", Component: CustomerDetail },
      { path: "profile", Component: Profile },
      { path: "connectors", Component: Connectors },
      { path: "connectors/:connectorId", Component: ConnectorDetail },
      { path: "kyc", Component: KycPage },
      { path: "support", Component: Support },
      { path: "settings", Component: Settings },
      { path: "settings/store", Component: StoreSettings },
      { path: "settings/order", Component: OrderSettings },
      { path: "settings/payment", Component: PaymentSettings },
      { path: "settings/customer", Component: CustomerSettings },
      { path: "settings/communication", Component: CommunicationSettings },
      { path: "reports", Component: Reports },
      { path: "reports/sales-orders", Component: SalesOrdersReport },
      { path: "reports/inventory", Component: InventoryInsightsReport },
      { path: "reports/product-performance", Component: ProductPerformanceReport },
      { path: "reports/customer-insights", Component: CustomerInsightsReport },
      { path: "reports/schemes-offers", Component: SchemesOffersReport },
      { path: "reports/operations", Component: OperationsDeliveryReport },
      // Error Screens demo gallery — surfaced in the empty-mode sidebar
      // for both seller-empty and (via /admin/error-screens) admin-empty.
      { path: "error-screens", Component: ErrorScreensDemo },
      // Loading Screens demo gallery — same empty-mode-only treatment.
      { path: "loading-screens", Component: LoadingScreensDemo },
      // Catalog Portal — catalog-admin and brand-manager roles integrated
      // into the main RootLayout shell. Pages are re-used from the
      // standalone /catalog-admin portal; the separate portal stays intact.
      { path: "catalog-portal", Component: CatalogPortalIndex },
      { path: "catalog-portal/requests", Component: CatalogAdminRequests },
      { path: "catalog-portal/catalog", Component: CatalogAdminCatalog },
      { path: "catalog-portal/catalog/create", Component: CatalogAdminSkuForm },
      { path: "catalog-portal/catalog/:skuId", Component: CatalogAdminSkuForm },
      { path: "catalog-portal/companies", Component: AdminCompanies },
      { path: "catalog-portal/my-company", Component: BrandManagerCompanies },
      { path: "catalog-portal/brand-managers", Component: CatalogAdminBrandManagers },
      { path: "catalog-portal/my-catalog", Component: BrandManagerCatalog },
      { path: "catalog-portal/my-requests", Component: BrandManagerRequests },
    ],
  },
]);
