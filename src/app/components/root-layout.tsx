import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Tag,
  ShoppingCart,
  Users,
  Settings,
  Menu,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  User,
  LogOut,
  HelpCircle,
  Search,
  X,
  Truck,
  ExternalLink,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import logoImage from "../../imports/Qwipo_Secondary_Logo_for_Light_BG@4x-8.png";
import iconLogo from "../../imports/Qwipo_Icon_Logo_for_Light_BG@4x-8.png";
// Dark-BG variants — used when the sidebar is rendered against the
// dark theme so the wordmark / icon stays legible without a CSS
// filter hack. Vite imports SVGs as a URL string.
import logoImageDark from "../../imports/Qwipo_Secondary_Logo_for_Dark_BG.svg";
import iconLogoDark from "../../imports/Qwipo_Icon_Logo_for_Dark_BG.svg";
import { useAuth } from "../lib/auth-context";
import {
  adminErrorScreensNav,
  adminLoadingScreensNav,
  adminNavigation,
  getAdminPageTitle,
} from "../lib/admin-navigation";
import { AlertOctagon, Loader2 } from "lucide-react";
import { RouteProgress } from "./ui/page-loader";
import { ThemeToggle } from "./theme-toggle";
// External target the Logistics menu opens in a new tab. The Logistics
// item is part of every seller's sidebar — it goes greyed-out for the
// empty-mode seller persona (so reviewers see the inception-day state)
// and clickable for the regular seller.
const LOGISTICS_PORTAL_URL =
  "https://logistics-buyer.test.bms.qwipo.com/auth/login";

// Logistics is an external portal — it doesn't have an internal href.
// Instead it carries `externalUrl` so the NavLinks renderer knows to
// open it in a new tab, and `requiresLogistics` so the renderer can
// grey it out when the seller hasn't enabled Logistics in Settings.
type SellerNavItem = {
  name: string;
  href?: string;
  externalUrl?: string;
  requiresLogistics?: boolean;
  icon: typeof LayoutDashboard;
  subItems?: { href: string; name: string }[];
};

// The Logistics nav entry now sits in the base seller navigation
// directly — every seller persona sees it. The empty-mode seller has
// it greyed out (via `requiresLogistics`), while the regular seller
// can click through to the external portal.
const sellerNavigation: SellerNavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "My SKU", href: "/products/my-sku", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Offers & Schemes", href: "/offers", icon: Tag },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Support", href: "/support", icon: HelpCircle },
  {
    name: "Logistics",
    externalUrl: LOGISTICS_PORTAL_URL,
    requiresLogistics: true,
    icon: Truck,
  },
];

const sellerErrorScreensNav = {
  name: "Error Screens",
  href: "/error-screens",
  icon: AlertOctagon,
};

const sellerLoadingScreensNav = {
  name: "Loading",
  href: "/loading-screens",
  icon: Loader2,
};

// Multi-offer-type demo of the Offers & Schemes list. Surfaced only
// in the empty-mode sidebar — reviewers see how the table reads when
// every offer type is in play and the same SKU appears in multiple
// rows for different schemes.
const sellerOffersDemoNav = {
  name: "Offers & Schemes 2",
  href: "/offers-demo",
  icon: Tag,
};

// Auto-register-on-first-order customers workflow demo. Empty-mode
// only — companies cluster their customers, distributors bulk-assign
// delivery days, and per-customer Block keeps reorders out of the
// system. Lives alongside the existing Customers screen so we can
// trial the model without disturbing the live page.
const sellerCustomersDemoNav = {
  name: "Customers 2",
  href: "/customers-demo",
  icon: Users,
};

// Get page title based on current route
const getSellerPageTitle = (pathname: string): string => {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/products/sku-detail")) return "SKU Details";
  if (pathname.startsWith("/products/my-sku")) return "My SKU List";
  if (pathname.startsWith("/customers-demo")) return "Customers 2";
  if (pathname.startsWith("/customers")) return "Customer Management";
  if (pathname.startsWith("/offers-demo")) return "Offers & Schemes 2";
  if (pathname.startsWith("/offers")) return "Offers & Schemes";
  if (pathname.startsWith("/orders")) return "Orders Management";
  if (pathname.startsWith("/connectors")) return "Connectors";
  if (pathname.startsWith("/kyc")) return "KYC Information";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/support")) return "Support";
  if (pathname.startsWith("/error-screens")) return "Error Screens";
  if (pathname.startsWith("/loading-screens")) return "Loading";
  return "SMP Platform";
};

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  // Theme-aware logo swap. We mount-guard with `themeReady` so the
  // first paint after hydration uses the persisted theme without a
  // visible flicker between the two PNG/SVG sources.
  const { resolvedTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => setThemeReady(true), []);
  const isDarkLogo = themeReady && resolvedTheme === "dark";
  const sidebarLogoSrc = isDarkLogo ? logoImageDark : logoImage;
  const sidebarIconLogoSrc = isDarkLogo ? iconLogoDark : iconLogo;
  // Empty-mode demo personas (Super Admin Empty / Seller Empty) get
  // extra "Error Screens" + "Loading" items appended to their sidebar
  // so reviewers can browse the error and loading galleries without
  // leaving the app.
  const isEmptyMode = user?.dataMode === "empty";
  const navigation = isAdmin
    ? isEmptyMode
      ? [...adminNavigation, adminErrorScreensNav, adminLoadingScreensNav]
      : adminNavigation
    : isEmptyMode
      ? [
          ...sellerNavigation,
          sellerCustomersDemoNav,
          sellerOffersDemoNav,
          sellerErrorScreensNav,
          sellerLoadingScreensNav,
        ]
      : sellerNavigation;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(
    isAdmin ? "User Management" : "Products",
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (href: string) => {
    // Exact match for the two "home" routes so subpages don't keep them highlighted
    if (href === "/" || href === "/admin") {
      return location.pathname === href;
    }
    // For sub-routes, require either exact match or a "/" boundary
    // so "/admin/requests" doesn't light up "/admin/request-archive" etc.
    return (
      location.pathname === href ||
      location.pathname.startsWith(href + "/")
    );
  };

  const isParentActive = (subItems?: { href: string }[]) => {
    if (!subItems) return false;
    return subItems.some(
      (item) =>
        location.pathname === item.href ||
        location.pathname.startsWith(item.href + "/"),
    );
  };

  // Auto-expand the parent menu whose sub-item is currently active, so
  // URL navigation (deep links, back/forward) keeps the sidebar in sync.
  useEffect(() => {
    const activeParent = navigation.find(
      (item) => item.subItems && isParentActive(item.subItems),
    );
    if (activeParent && expandedMenu !== activeParent.name) {
      setExpandedMenu(activeParent.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navigation]);

  const toggleMenu = (name: string) => {
    setExpandedMenu(expandedMenu === name ? null : name);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const NavLinks = ({ collapsed = false }: { collapsed?: boolean }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const hasSubItems = item.subItems && item.subItems.length > 0;
        const parentActive = hasSubItems && isParentActive(item.subItems);
        const isExpanded = expandedMenu === item.name;

        // External URL items (e.g. Logistics → external portal). Render
        // as a button — opens the URL in a new tab. `requiresLogistics`
        // greys the item out for the empty-mode seller persona, so
        // reviewers see the inception-day state; the regular seller
        // has it clickable.
        if (item.externalUrl) {
          const disabled = item.requiresLogistics && isEmptyMode;
          return (
            <button
              key={item.name}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                window.open(item.externalUrl, "_blank", "noopener,noreferrer");
              }}
              title={
                collapsed
                  ? disabled
                    ? `${item.name} (not available in demo empty mode)`
                    : item.name
                  : disabled
                    ? "Logistics is not available in this demo persona"
                    : undefined
              }
              className={`flex w-full items-center ${
                collapsed ? "justify-center" : "gap-3"
              } rounded-lg px-3 py-2.5 transition-all ${
                disabled
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-700 hover:text-gray-900 hover:bg-blue-50"
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm flex-1 flex items-center justify-between gap-2">
                  <span>{item.name}</span>
                  <ExternalLink
                    className={`h-3 w-3 ${
                      disabled ? "opacity-40" : "opacity-60"
                    }`}
                  />
                </span>
              )}
            </button>
          );
        }

        if (hasSubItems) {
          return (
            <div key={item.name}>
              <button
                onClick={() => !collapsed && toggleMenu(item.name)}
                title={collapsed ? item.name : undefined}
                className={`flex w-full items-center ${
                  collapsed ? "justify-center" : "justify-between"
                } rounded-lg px-3 py-2.5 transition-all hover:bg-blue-50 ${
                  parentActive
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-gray-700 hover:text-gray-900"
                }`}
              >
                <div className={`flex items-center ${collapsed ? "" : "gap-3"}`}>
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="text-sm">{item.name}</span>}
                </div>
                {!collapsed &&
                  (isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  ))}
              </button>
              {!collapsed && isExpanded && (
                <div className="ml-9 mt-1 space-y-1">
                  {item.subItems.map((subItem) => (
                    <Link
                      key={subItem.href}
                      to={subItem.href}
                      className={`flex items-center rounded-lg px-3 py-2 text-sm transition-all hover:bg-blue-50 ${
                        isActive(subItem.href)
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {subItem.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        const active = isActive(item.href!);
        return (
          <Link
            key={item.name}
            to={item.href!}
            title={collapsed ? item.name : undefined}
            className={`flex items-center ${
              collapsed ? "justify-center" : "gap-3"
            } rounded-lg px-3 py-2.5 transition-all hover:bg-blue-50 ${
              active
                ? "bg-blue-50 text-blue-600 font-medium"
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm">{item.name}</span>}
          </Link>
        );
      })}
    </>
  );

  const pageTitle = isAdmin
    ? getAdminPageTitle(location.pathname)
    : getSellerPageTitle(location.pathname);

  const displayName = user?.name ?? "Guest";
  const displaySubtitle = isAdmin
    ? "Super Admin Portal"
    : user?.businessName ?? "";
  const avatarInitials = user?.avatarInitials ?? "?";
  const avatarColor = isAdmin ? "bg-purple-600" : "bg-blue-600";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex md:flex-col border-r border-gray-200 bg-white transition-all duration-300 ${
          sidebarCollapsed ? "md:w-16" : "md:w-56"
        }`}
      >
        {/* Logo/Brand with Collapse Toggle */}
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-3">
          {!sidebarCollapsed ? (
            <>
              <img
                src={sidebarLogoSrc}
                alt="Qwipo"
                className="h-6 object-contain"
              />
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center"
              title="Expand sidebar"
            >
              <img
                src={sidebarIconLogoSrc}
                alt="Qwipo"
                className="h-8 w-8 object-contain"
              />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <NavLinks collapsed={sidebarCollapsed} />
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6 flex-shrink-0">
          {/* Page Title */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Notifications icon removed for Phase 1 — the notifications
                feature is deferred, so we don't show a bell that goes
                nowhere. Restore this block when notifications ship. */}

            {/* Light / dark mode toggle — sits immediately before the
                profile dropdown so it's the last action the user's
                eye lands on before their identity. Available to every
                logged-in role (admin + seller). */}
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 hover:bg-gray-50"
                >
                  <div
                    className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium text-sm`}
                  >
                    {avatarInitials}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-sm font-medium text-gray-900">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-600">{displaySubtitle}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-600 hidden lg:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{displayName}</p>
                    <p className="text-xs font-normal text-gray-600">
                      {displaySubtitle}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-y-auto">
          {/* Top-of-viewport progress bar — animates briefly on every
              route change so the user gets visual feedback that the
              navigation registered. */}
          <RouteProgress />
          <Outlet />
        </main>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-2xl z-50 flex flex-col md:hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <img
                  src={sidebarLogoSrc}
                  alt="Qwipo"
                  className="h-6 object-contain"
                />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const parentActive = hasSubItems && isParentActive(item.subItems);
                  const isExpanded = expandedMenu === item.name;

                  // External URL items — same disabled-gate behavior
                  // as the desktop sidebar.
                  if (item.externalUrl) {
                    const disabled =
                      item.requiresLogistics && isEmptyMode;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          window.open(
                            item.externalUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                          disabled
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-gray-700 hover:text-gray-900 hover:bg-blue-50"
                        }`}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm flex-1 flex items-center justify-between gap-2">
                          <span>{item.name}</span>
                          <ExternalLink
                            className={`h-3 w-3 ${
                              disabled ? "opacity-40" : "opacity-60"
                            }`}
                          />
                        </span>
                      </button>
                    );
                  }

                  if (hasSubItems) {
                    return (
                      <div key={item.name}>
                        <button
                          onClick={() => toggleMenu(item.name)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-all hover:bg-blue-50 ${
                            parentActive
                              ? "bg-blue-50 text-blue-600 font-medium"
                              : "text-gray-700 hover:text-gray-900"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span className="text-sm">{item.name}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="ml-9 mt-1 space-y-1">
                            {item.subItems.map((subItem) => (
                              <Link
                                key={subItem.href}
                                to={subItem.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center rounded-lg px-3 py-2 text-sm transition-all hover:bg-blue-50 ${
                                  isActive(subItem.href)
                                    ? "bg-blue-50 text-blue-600 font-medium"
                                    : "text-gray-600 hover:text-gray-900"
                                }`}
                              >
                                {subItem.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const active = isActive(item.href!);
                  return (
                    <Link
                      key={item.name}
                      to={item.href!}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-blue-50 ${
                        active
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-700 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}