import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  Database,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Tag,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useAuth } from "../../lib/auth-context";
import {
  getNavForRole,
  getCatalogAdminPageTitle,
} from "../../lib/catalog-admin-navigation";
import { getPendingRequests } from "../../lib/product-store-data";
import { RouteProgress } from "../../components/ui/page-loader";

export function CatalogAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role ?? "catalog-admin";
  const isBrandManager = role === "brand-manager";
  const pendingCount = getPendingRequests().length;
  const pageTitle = getCatalogAdminPageTitle(location.pathname);
  const navItems = getNavForRole(role);

  // Accent colours — teal for both roles
  const accent = { bg: "bg-teal-600", light: "bg-teal-50", text: "text-teal-700", icon: "text-teal-600", chevron: "text-teal-500", avatar: "bg-teal-100 text-teal-700" };

  const roleLabel = isBrandManager ? "Brand Manager" : "Catalog Admin";
  const PortalIcon = isBrandManager ? Tag : Database;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (href: string) => {
    if (href === "/catalog-admin") return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? `${accent.light} ${accent.text}`
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <item.icon className={`h-4 w-4 flex-shrink-0 ${active ? accent.icon : ""}`} />
            <span className="flex-1">{item.name}</span>
            {item.badgeKey === "pending_requests" && pendingCount > 0 && (
              <Badge className="h-5 min-w-5 rounded-full bg-red-500 text-white text-[10px] px-1.5">
                {pendingCount}
              </Badge>
            )}
            {active && <ChevronRight className={`h-3 w-3 ${accent.chevron}`} />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <RouteProgress />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
          <div className={`w-8 h-8 ${accent.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <PortalIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight truncate">Product Store</p>
            <p className="text-[11px] text-gray-500">{roleLabel}</p>
          </div>
        </div>

        <NavLinks />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col transform transition-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 ${accent.bg} rounded-lg flex items-center justify-center`}>
              <PortalIcon className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm text-gray-900">Product Store</span>
          </div>
          <button onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <NavLinks onClick={() => setMobileOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <PortalIcon className={`h-3.5 w-3.5 ${accent.icon}`} />
            <span className={`${accent.text} font-medium`}>Product Store</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-gray-900">{pageTitle}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Role badge in topbar */}
            <Badge className="text-[10px] hidden sm:inline-flex bg-teal-50 text-teal-700 border-teal-200">
              {roleLabel}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-8">
                  <div className={`w-6 h-6 rounded-full ${accent.avatar} flex items-center justify-center text-[10px] font-bold`}>
                    {user?.avatarInitials}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
