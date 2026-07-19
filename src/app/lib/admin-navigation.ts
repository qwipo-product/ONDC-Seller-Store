import {
  LayoutDashboard,
  Store,
  Plug,
  Building2,
  LayoutGrid,
  AlertOctagon,
  Loader2,
  Users,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href?: string;
  icon: LucideIcon;
  subItems?: { name: string; href: string }[];
}

// Admin sidebar — flat menu. Category Master sits right after Companies &
// Brands so the master-data items group together visually.
export const adminNavigation: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Sellers", href: "/admin/users", icon: Store },
  { name: "Customers", href: "/admin/customers", icon: Users },
  { name: "Generate Report", href: "/admin/reports", icon: FileSpreadsheet },
  { name: "Companies & Brands", href: "/admin/companies", icon: Building2 },
  { name: "Category Master", href: "/admin/categories", icon: LayoutGrid },
  { name: "Connectors", href: "/admin/connectors", icon: Plug },
];

/**
 * Empty-mode-only nav item — appended to the standard admin sidebar
 * when the super admin signs in via the demo "Empty" account. Surfaces
 * the Error Screens gallery so reviewers can audit every error state.
 */
export const adminErrorScreensNav: NavItem = {
  name: "Error Screens",
  href: "/admin/error-screens",
  icon: AlertOctagon,
};

/**
 * Empty-mode-only nav item — companion to adminErrorScreensNav. Surfaces
 * the Loading Screens gallery (Skeleton + Center loader variants).
 */
export const adminLoadingScreensNav: NavItem = {
  name: "Loading",
  href: "/admin/loading-screens",
  icon: Loader2,
};

export function getAdminPageTitle(pathname: string): string {
  if (pathname === "/admin") return "Admin Dashboard";
  if (pathname.startsWith("/admin/users/add")) return "Add Seller";
  if (pathname.startsWith("/admin/users/")) return "Seller Details";
  if (pathname.startsWith("/admin/users")) return "Sellers";
  if (pathname.startsWith("/admin/customers/")) return "Customer Details";
  if (pathname.startsWith("/admin/customers")) return "Customer Database";
  if (pathname.startsWith("/admin/reports")) return "Generate Report";
  if (pathname.startsWith("/admin/companies")) return "Companies & Brands";
  if (pathname.startsWith("/admin/categories")) return "Category Master";
  if (pathname.startsWith("/admin/connectors/")) return "Connector Details";
  if (pathname.startsWith("/admin/connectors")) return "Connectors";
  if (pathname.startsWith("/admin/sellers/")) return "Seller Details";
  if (pathname.startsWith("/admin/error-screens")) return "Error Screens";
  if (pathname.startsWith("/admin/loading-screens")) return "Loading";
  return "Admin Portal";
}
