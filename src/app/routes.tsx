import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/root-layout";
import { ProtectedRoute } from "./components/protected-route";
import { Dashboard } from "./pages/dashboard";
import { DashboardCompany } from "./pages/dashboard-company";
import { Inventory } from "./pages/inventory";
import { Orders } from "./pages/orders/list";
import { OrderDetail } from "./pages/orders/detail";
import { Customers } from "./pages/customers/legacy-list";
import { CustomerDetail } from "./pages/customers/legacy-detail";
import { CustomersDemo } from "./pages/customers/list";
import { CustomerDemoDetail } from "./pages/customers/detail";
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
import { ShippingSettings } from "./pages/settings/shipping-settings";
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
import { AdminCompanies } from "./pages/admin/companies";
import { AdminCategories } from "./pages/admin/categories";
import { ErrorScreensDemo } from "./pages/demos/error-screens";
import { LoadingScreensDemo } from "./pages/demos/loading-screens";

export const router = createBrowserRouter([
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
      // Admin Connectors
      { path: "connectors", Component: AdminConnectors },
      { path: "connectors/:connectorId", Component: ConnectorDetail },
      // Admin Companies & Brands
      { path: "companies", Component: AdminCompanies },
      // Category Master — hierarchical taxonomy (37 ONDC roots + add/sub)
      { path: "categories", Component: AdminCategories },
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
  // Seller subtree — seller-only
  {
    path: "/",
    element: (
      <ProtectedRoute allow="seller">
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: Dashboard },
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
      { path: "settings/shipping", Component: ShippingSettings },
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
    ],
  },
]);
