import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  Tag,
  LogOut,
  Menu,
  X,
  ChevronRight,
  LayoutDashboard,
  Database,
  Plus,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useAuth } from "../../lib/auth-context";
import { RouteProgress } from "../../components/ui/page-loader";

const navigation = [
  { name: "Dashboard", href: "/brand-manager", icon: LayoutDashboard },
  { name: "Catalog", href: "/brand-manager/catalog", icon: Database },
  { name: "Create SKU", href: "/brand-manager/catalog/create", icon: Plus },
];

function getPageTitle(pathname: string): string {
  if (pathname === "/brand-manager") return "Dashboard";
  if (pathname.startsWith("/brand-manager/catalog/create")) return "Create SKU";
  if (pathname.startsWith("/brand-manager/catalog/")) return "SKU Detail";
  if (pathname.startsWith("/brand-manager/catalog")) return "Catalog";
  return "Brand Manager";
}

export function BrandManagerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (href: string) => {
    if (href === "/brand-manager") return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navigation.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <item.icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-indigo-600" : ""}`} />
            <span className="flex-1">{item.name}</span>
            {active && <ChevronRight className="h-3 w-3 text-indigo-500" />}
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
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Tag className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight truncate">
              Product Store
            </p>
            <p className="text-[11px] text-gray-500">Brand Manager</p>
          </div>
        </div>

        {/* Company badge */}
        {user?.businessName && (
          <div className="mx-3 mt-3 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg">
            <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">Company</p>
            <p className="text-xs font-semibold text-indigo-900 truncate mt-0.5">{user.businessName}</p>
          </div>
        )}

        <NavLinks />

        {/* User footer */}
        <div className="px-3 py-3 border-t border-gray-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {user?.avatarInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Brand Manager</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Tag className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm text-gray-900">Brand Manager</span>
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
            <Tag className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-indigo-600 font-medium">Brand Manager</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-gray-900">{pageTitle}</span>
          </div>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-8">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
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

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
