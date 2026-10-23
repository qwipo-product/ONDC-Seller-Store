import {
  LayoutDashboard,
  Database,
  Inbox,
  Package,
  Users,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./auth-context";

export interface CatalogNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "pending_requests";
  /** Which roles can see this item. Omit = all portal roles. */
  roles?: Role[];
}

export const catalogAdminNavigation: CatalogNavItem[] = [
  {
    name: "Dashboard",
    href: "/catalog-admin",
    icon: LayoutDashboard,
  },
  {
    name: "Requests",
    href: "/catalog-admin/requests",
    icon: Inbox,
    badgeKey: "pending_requests",
    roles: ["catalog-admin"],
  },
  {
    name: "Browse Catalog",
    href: "/catalog-admin/catalog",
    icon: Database,
    roles: ["catalog-admin"],
  },
  {
    name: "My Catalog",
    href: "/catalog-admin/my-catalog",
    icon: Database,
    roles: ["brand-manager"],
  },
  {
    name: "Requests",
    href: "/catalog-admin/my-requests",
    icon: Inbox,
    badgeKey: "pending_requests",
    roles: ["brand-manager"],
  },
  {
    name: "Create SKU",
    href: "/catalog-admin/catalog/create",
    icon: Package,
  },
  {
    name: "Companies & Brands",
    href: "/catalog-admin/companies",
    icon: Building2,
    roles: ["catalog-admin"],
  },
  {
    name: "My Company",
    href: "/catalog-admin/my-company",
    icon: Building2,
    roles: ["brand-manager"],
  },
  {
    name: "Brand Managers",
    href: "/catalog-admin/brand-managers",
    icon: Users,
    roles: ["catalog-admin"],
  },
];

export function getNavForRole(role: Role): CatalogNavItem[] {
  return catalogAdminNavigation.filter(
    (item) => !item.roles || item.roles.includes(role)
  );
}

export function getCatalogAdminPageTitle(pathname: string): string {
  if (pathname === "/catalog-admin") return "Dashboard";
  if (pathname === "/catalog-admin/requests") return "Requests";
  if (pathname.startsWith("/catalog-admin/catalog/create")) return "Create SKU";
  if (pathname.startsWith("/catalog-admin/catalog/")) return "SKU Detail";
  if (pathname.startsWith("/catalog-admin/catalog")) return "Browse Catalog";
  if (pathname.startsWith("/catalog-admin/my-catalog")) return "My Catalog";
  if (pathname.startsWith("/catalog-admin/my-requests")) return "Requests";
  if (pathname.startsWith("/catalog-admin/companies")) return "Companies & Brands";
  if (pathname.startsWith("/catalog-admin/my-company")) return "My Company";
  if (pathname.startsWith("/catalog-admin/brand-managers")) return "Brand Managers";
  return "Product Store";
}
