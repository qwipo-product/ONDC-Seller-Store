import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { MultiSelect } from "../../components/ui/multi-select";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Search,
  CheckCircle2,
  XCircle,
  Truck,
  Package,
  ShoppingCart,
  AlertCircle,
  PackageCheck,
  ExternalLink,
  Calendar,
  ChevronDown,
  X,
  Filter,
  Eye,
  Download,
  Zap,
  Route,
  MapPin,
  CalendarDays,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { isEmptyMode } from "../../lib/data-mode";
import { EmptyState } from "../../components/empty-state";
import { CopyOnHover } from "../../components/copy-on-hover";
import { ListPagination } from "../../components/ui/list-pagination";
import { OrdersMapDialog } from "../../components/orders-map-dialog";
import { useAuth } from "../../lib/auth-context";
import {
  getLogisticsSettings,
  subscribeToLogisticsSettings,
} from "../../lib/logistics-settings";
// Shared store — seeds + writers live in lib/orders-data so the
// detail page can read the same orders by id and writes flow both
// ways. `Order` / `OrderLineItem` are exported from the lib so we
// don't redeclare them here.
import {
  type Order,
  type OrderLineItem,
  type CancelledBy,
  SELLER_INFO,
  getOrders,
  setOrders as setOrdersStore,
  subscribeToOrders,
  updateOrderStatuses,
  getOrderType,
  getOrderOperationMode,
  getCustomerOrderId,
  requestLogisticsForOrders,
  getStalePendingOrders,
  getPendingAgeDays,
  isStalePendingOrder,
  STALE_PENDING_NUDGE_DAYS,
} from "../../lib/orders-data";

// An order is a "beat" delivery when it rides a configured
// serviceability beat. The June 2026 review decoupled this from
// Urgent / Regular — that delivery-type axis was a UI artefact, not
// a routing one. Beat-vs-Standard now flows from the explicit
// `orderType` field on the order, with `beatName` as a backstop for
// older seeds. Kept as a wrapper around the shared `getOrderType`
// helper so call-sites read clearly at usage.
function isBeatOrder(order: Order): boolean {
  return getOrderType(order) === "beat";
}

// Delivery-day weekday tabs. Keyed by JS getUTCDay() (0 = Sunday) and
// listed Monday-first, the way distributors plan their beat week.
// Sunday is a holiday, so it has no tab; any Sunday-dated order still
// shows under All Days.
const WEEKDAY_TABS: { day: number; label: string }[] = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
];

/** Weekday (0 = Sunday) of a YYYY-MM-DD delivery date, or null when the
 *  date is missing / malformed so it never lands on the wrong weekday.
 *  Parsed in UTC, matching the store's other date helpers, so the
 *  result doesn't drift across the client's timezone boundary. */
function deliveryWeekday(iso: string | undefined): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    return null;
  }
  return d.getUTCDay();
}

// "rejected" tab label is retired alongside the status rename; the
// tab now shows Cancelled orders. The TabType value stays as
// "cancelled" so future code reads consistently.
// "logistics" holds orders handed to the 3PL network. It isn't an
// order STATUS — those rows are still Confirmed underneath — it's a
// fulfilment route, so it gets its own tab rather than a status entry.
type TabType =
  | "all"
  | "new"
  | "confirmed"
  | "logistics"
  | "delivered"
  | "cancelled";

export function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Read logistics enabled flag for the current seller, and keep it
  // live across tab — the admin can toggle it without a page reload.
  const [logisticsEnabled, setLogisticsEnabled] = useState(() =>
    user ? getLogisticsSettings(user.id).enabled : false,
  );
  useEffect(() => {
    if (!user) return;
    setLogisticsEnabled(getLogisticsSettings(user.id).enabled);
    return subscribeToLogisticsSettings(user.id, () =>
      setLogisticsEnabled(getLogisticsSettings(user.id).enabled),
    );
  }, [user]);

  // Source of truth lives in lib/orders-data. We mirror it locally
  // and resubscribe so writes from the detail page propagate here.
  const [orders, setOrdersState] = useState<Order[]>(() =>
    isEmptyMode() ? [] : getOrders(),
  );
  useEffect(() => {
    return subscribeToOrders(() => setOrdersState([...getOrders()]));
  }, []);
  // Local setter that also writes through to the store so detail-page
  // subscribers see the change.
  const setOrders = (
    updater: ((prev: Order[]) => Order[]) | Order[],
  ) => {
    const next =
      typeof updater === "function" ? updater(getOrders()) : updater;
    setOrdersStore(next);
  };
  const [activeTab, setActiveTab] = useState<TabType>("all");
  // Quick filter bar — one bar, same on every tab, so the seller can
  // ask plain questions ("non-beat orders", "what goes out
  // Monday", "Thursday's orders by status") in one or two clicks.
  // It deliberately survives tab switches: pick a weekday once and
  // the status tabs' counts all re-read for that day.
  //
  //   - `routeFilter`: Order type — Beat vs Non-Beat.
  // Delivery-day weekday tab: "all" or a getUTCDay() number. Matches
  // every order whose delivery date falls on that weekday, across all
  // weeks — not a single calendar date.
  const [deliveryDayTab, setDeliveryDayTab] = useState<"all" | number>("all");
  // Exact delivery date picked from the date row that opens under a
  // weekday tab ("all" = every date for that weekday).
  const [deliveryDate, setDeliveryDate] = useState<string>("all");
  const [routeFilter, setRouteFilter] = useState<"all" | "beat" | "non-beat">(
    "all",
  );
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all");
  const [selectedCompanyFilters, setSelectedCompanyFilters] = useState<string[]>([]);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  // "Cancelled By" quick filter — only consulted on the Cancelled
  // tab. "all" matches buyer + seller cancellations; the other two
  // narrow to just one origin so the seller can audit one cancellation
  // channel at a time.
  const [cancelledByFilter, setCancelledByFilter] = useState<
    "all" | CancelledBy
  >("all");

  // Unique brands and statuses for filter options
  const uniqueCompanies = useMemo(
    () => Array.from(new Set(orders.map((o) => o.company))).sort(),
    [orders]
  );
  const statusOptions = [
    { label: "New", value: "New" },
    { label: "Confirmed", value: "Confirmed" },
    { label: "Delivered", value: "Delivered" },
    { label: "Cancelled", value: "Cancelled" },
  ];


  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Modals
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isDeliverDialogOpen, setIsDeliverDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  // View on Map dialog — embedded Leaflet view of the selected
  // orders' customer locations. Opened from the New + Confirmed
  // bulk action bars.
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  // "Request 3PL Logistics" bulk action — Confirmed tab, only when
  // the seller has Logistics enabled. Confirms the hand-off before
  // the orders leave the seller's working list.
  const [isRequestLogisticsDialogOpen, setIsRequestLogisticsDialogOpen] =
    useState(false);
  // Pending Orders Review — VIW-2026-06911 soft nudge. Opened from the
  // New-tab banner; lets the seller pick which stale orders to act on
  // (not all-or-nothing) and route the picked subset to either the
  // existing Confirm or Cancel dialog.
  const [isStaleReviewDialogOpen, setIsStaleReviewDialogOpen] =
    useState(false);
  const [staleReviewSelection, setStaleReviewSelection] = useState<string[]>(
    [],
  );
  // Stale-pending nudge popup — VIW-2026-06911. A banner that sits in
  // the page permanently pushes the order rows down and eats into
  // scroll budget, which was the opposite of the goal (keep New
  // orders visible). A pop-up interrupts once, forces an explicit
  // close, and then gets out of the way entirely.
  const [isStaleNudgePopupOpen, setIsStaleNudgePopupOpen] = useState(false);

  // Form data
  const [cancelReason, setCancelReason] = useState("");

  // Export form — Start + End date inputs with a 31-day max span.
  // Start Date defaults to 30 days back so the initial pair already
  // covers the most recent month; End Date is auto-set to Start + 30
  // when Start changes, so the seller almost never has to touch End
  // (they can still shrink the window if they want a tighter export).
  const todayIso = new Date().toISOString().split("T")[0];
  const isoNDaysBack = (n: number) =>
    new Date(Date.now() - n * 86400000).toISOString().split("T")[0];
  const isoNDaysAfter = (anchor: string, n: number) => {
    const t = new Date(anchor).getTime();
    if (Number.isNaN(t)) return anchor;
    return new Date(t + n * 86400000).toISOString().split("T")[0];
  };
  const [exportStartDate, setExportStartDate] = useState(isoNDaysBack(30));
  const [exportEndDate, setExportEndDate] = useState(todayIso);
  const [exportFormat, setExportFormat] = useState("csv");

  /** Resolve the active export range. Returns null when either date
   *  input is empty — the Export button is also disabled in that
   *  state so this is a belt-and-suspenders check. */
  const resolveExportRange = (): { start: string; end: string } | null => {
    if (!exportStartDate || !exportEndDate) return null;
    return { start: exportStartDate, end: exportEndDate };
  };

  /** True when the chosen range exceeds one month (31 days). The
   *  End Date input's `max` attribute keeps the OS picker honest,
   *  but a determined seller could still type a date directly — so
   *  we also surface an inline error + disable Export. */
  const exportRangeTooLong = (() => {
    if (!exportStartDate || !exportEndDate) return false;
    const s = new Date(exportStartDate);
    const e = new Date(exportEndDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
    if (e < s) return false;
    const diffDays = Math.floor((e.getTime() - s.getTime()) / 86400000);
    return diffDays > 30;
  })();

  /** End Date can't go past Start + 30 days. Used as the `max`
   *  attribute on the End Date input. */
  const exportEndMax = (() => {
    if (!exportStartDate) return undefined;
    const s = new Date(exportStartDate);
    if (Number.isNaN(s.getTime())) return undefined;
    return new Date(s.getTime() + 30 * 86400000).toISOString().split("T")[0];
  })();

  // Orders handed to the 3PL network stay Confirmed underneath but
  // drop out of the seller's working list — the delivery is the
  // partner's to run, and asking the seller to action it would be
  // misleading. They come back on the Delivered tab once the partner
  // closes them out. `isSellerActionable` is the single predicate
  // every Confirmed-tab count and list runs through.
  const isWithLogisticsPartner = (o: Order) =>
    o.status === "Confirmed" && o.logisticsRequested === true;
  const isSellerActionable = (o: Order) => !isWithLogisticsPartner(o);

  const matchesRoute = (o: Order): boolean => {
    if (routeFilter === "all") return true;
    if (routeFilter === "non-beat") return !isBeatOrder(o);
    return isBeatOrder(o);
  };

  /** Every filter except the status tab. `skip` leaves one chip group
   *  out so that group's chips can show "what would I get if I clicked
   *  this" instead of collapsing to the current selection. */
  const matchesCommonFilters = (
    o: Order,
    skip: ("route" | "weekday" | "date")[] = [],
  ): boolean => {
    const q = searchQuery.trim().toLowerCase();
    if (
      q &&
      !o.id.toLowerCase().includes(q) &&
      !o.retailerName.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (marketplaceFilter !== "all" && o.marketplace !== marketplaceFilter) {
      return false;
    }
    if (
      selectedCompanyFilters.length > 0 &&
      !selectedCompanyFilters.includes(o.company)
    ) {
      return false;
    }
    if (
      selectedStatusFilters.length > 0 &&
      !selectedStatusFilters.includes(o.status)
    ) {
      return false;
    }
    // Date range applies once both ends are set, as in the original
    // drawer.
    if (startDate && endDate) {
      const orderDate = new Date(o.orderDate);
      if (orderDate < new Date(startDate) || orderDate > new Date(endDate)) {
        return false;
      }
    }
    if (!skip.includes("route") && !matchesRoute(o)) return false;
    // Weekday tab: orders with a missing / invalid delivery date never
    // match a specific weekday, but still show under All Days.
    if (
      !skip.includes("weekday") &&
      deliveryDayTab !== "all" &&
      deliveryWeekday(o.expectedDeliveryDate) !== deliveryDayTab
    ) {
      return false;
    }
    if (
      !skip.includes("date") &&
      deliveryDate !== "all" &&
      o.expectedDeliveryDate !== deliveryDate
    ) {
      return false;
    }
    return true;
  };

  // Orders handed to the 3PL partner stay visible on All and Pending
  // so the seller can still find them by id, but leave the Confirmed
  // working list — they live in the 3PL Logistics tab instead.
  const matchesTab = (o: Order, tab: TabType): boolean => {
    switch (tab) {
      case "all":
        return true;
      case "new":
        return o.status === "New";
      case "confirmed":
        return o.status === "Confirmed" && isSellerActionable(o);
      case "logistics":
        return isWithLogisticsPartner(o);
      case "delivered":
        return o.status === "Delivered";
      case "cancelled":
        return o.status === "Cancelled";
    }
  };

  // Cancelled-By chip — only consulted on the Cancelled tab. Legacy /
  // un-stamped cancellations count as seller-initiated, which is where
  // the existing seed orders came from.
  const matchesCancelledBy = (o: Order): boolean =>
    activeTab !== "cancelled" ||
    cancelledByFilter === "all" ||
    (o.cancelledBy ?? "Seller") === cancelledByFilter;

  const filterDeps = [
    orders,
    searchQuery,
    marketplaceFilter,
    selectedCompanyFilters,
    selectedStatusFilters,
    startDate,
    endDate,
    routeFilter,
    deliveryDayTab,
    deliveryDate,
  ];

  // Delivered and Cancelled are history, not planning — they don't
  // show the Delivery day / Dates / Order type rows, so those filters
  // are ignored there (search and the Filters drawer still apply).
  const usesDeliveryFilters = (tab: TabType) =>
    tab !== "delivered" && tab !== "cancelled";
  const deliverySkip = (tab: TabType): ("route" | "weekday" | "date")[] =>
    usesDeliveryFilters(tab) ? [] : ["route", "weekday", "date"];

  // Tab counts follow the filters, so picking "Monday" turns the tab
  // strip into "Monday's orders by status".
  const summary = useMemo(() => {
    const count = (tab: TabType) =>
      orders.filter(
        (o) => matchesTab(o, tab) && matchesCommonFilters(o, deliverySkip(tab)),
      ).length;
    return {
      all: count("all"),
      new: count("new"),
      confirmed: count("confirmed"),
      logistics: count("logistics"),
      delivered: count("delivered"),
      cancelled: count("cancelled"),
    };
  }, filterDeps);

  const currentTabOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          matchesTab(o, activeTab) &&
          matchesCancelledBy(o) &&
          matchesCommonFilters(o, deliverySkip(activeTab)),
      ),
    [...filterDeps, activeTab, cancelledByFilter],
  );

  // Weekday tab counts — same population as the visible list (current
  // status tab + every other filter), minus the weekday tab itself, so
  // All Days equals the list total and each weekday is what you get by
  // clicking it.
  const deliveryDayCounts = useMemo(() => {
    const base = orders.filter(
      (o) =>
        matchesTab(o, activeTab) &&
        matchesCancelledBy(o) &&
        matchesCommonFilters(o, ["weekday", "date"]),
    );
    const byDay = new Map<number, number>();
    for (const o of base) {
      const d = deliveryWeekday(o.expectedDeliveryDate);
      if (d !== null) byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    return { all: base.length, byDay };
  }, [...filterDeps, activeTab, cancelledByFilter]);

  // Dates for the selected weekday with their order counts. Ignores
  // only the date pick itself, so every date stays clickable.
  const deliveryDateBuckets = useMemo(() => {
    if (deliveryDayTab === "all") return { total: 0, dates: [] };
    const byDate = new Map<string, number>();
    let total = 0;
    for (const o of orders) {
      if (
        !matchesTab(o, activeTab) ||
        !matchesCancelledBy(o) ||
        !matchesCommonFilters(o, ["date"])
      ) {
        continue;
      }
      total++;
      byDate.set(
        o.expectedDeliveryDate,
        (byDate.get(o.expectedDeliveryDate) ?? 0) + 1,
      );
    }
    const dates = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
    return { total, dates };
  }, [...filterDeps, activeTab, cancelledByFilter]);

  const routeCounts = useMemo(() => {
    const base = orders.filter(
      (o) =>
        matchesTab(o, activeTab) &&
        matchesCancelledBy(o) &&
        matchesCommonFilters(o, ["route"]),
    );
    const beat = base.filter(isBeatOrder).length;
    return { all: base.length, beat, nonBeat: base.length - beat };
  }, [...filterDeps, activeTab, cancelledByFilter]);

  // VIW-2026-06911 — Soft nudge only (Stage 1). New orders the seller
  // has sat on past the threshold, across the whole list — not just
  // the current page/filters — so the banner doesn't disappear just
  // because a search or filter hides the stale rows. Nothing here
  // disables the Accept/Confirm actions for newer orders; it's purely
  // advisory, per the call to drop Stage 2's hard restriction.
  const stalePendingOrders = useMemo(
    () => getStalePendingOrders(orders),
    [orders],
  );

  // Opens the review picker with every stale order pre-checked — the
  // seller can then uncheck the ones they don't want to act on yet
  // before routing the rest to Confirm or Cancel.
  const handleReviewStaleOrders = () => {
    setStaleReviewSelection(stalePendingOrders.map((o) => o.id));
    setIsStaleReviewDialogOpen(true);
  };

  // Nudge popup dismissal — once-per-day, not once-per-exact-backlog.
  // Re-showing it every time the stale set changes even slightly (e.g.
  // the seller clears 3 of 5) felt like nagging for a problem they'd
  // already started fixing. Instead: show it once when they first hit
  // New each day, stay quiet for the rest of the day while they work
  // through the picker, and only interrupt again *that same day* if
  // the backlog gets worse than what they already saw (more stale
  // orders than last time), not merely different.
  const staleNudgeStorageKey = "stalePendingNudgeLastSeen";
  useEffect(() => {
    if (activeTab !== "new" || stalePendingOrders.length === 0) return;
    let lastSeen: { date: string; count: number } | null = null;
    try {
      lastSeen = JSON.parse(
        localStorage.getItem(staleNudgeStorageKey) ?? "null",
      );
    } catch {
      lastSeen = null;
    }
    const isNewDay = lastSeen?.date !== todayIso;
    const backlogGrew =
      !isNewDay && stalePendingOrders.length > (lastSeen?.count ?? 0);
    if (isNewDay || backlogGrew) {
      setIsStaleNudgePopupOpen(true);
    }
  }, [activeTab, stalePendingOrders, todayIso]);

  const dismissStaleNudgePopup = () => {
    localStorage.setItem(
      staleNudgeStorageKey,
      JSON.stringify({ date: todayIso, count: stalePendingOrders.length }),
    );
    setIsStaleNudgePopupOpen(false);
  };

  // Hands the review picker's checked subset off to the existing
  // Confirm / Cancel dialogs — same handlers the bulk action bar
  // uses, so eligibility rules and toasts stay identical.
  const handleStaleReviewConfirm = () => {
    setSelectedOrders(staleReviewSelection);
    setIsStaleReviewDialogOpen(false);
    setIsConfirmDialogOpen(true);
  };
  const handleStaleReviewCancel = () => {
    setSelectedOrders(staleReviewSelection);
    setIsStaleReviewDialogOpen(false);
    setIsCancelDialogOpen(true);
  };

  // Counts for the Cancelled tab's "Cancelled By" quick filter.
  // Counts respect the search box + global filters, but not the
  // cancelled-by chip itself, so each chip always shows the size
  // of the bucket the seller would land on if they clicked it.
  const cancelledByCounts = useMemo(() => {
    const baseCancelled = orders.filter(
      (o) =>
        o.status === "Cancelled" &&
        matchesCommonFilters(o, deliverySkip("cancelled")),
    );
    const isBuyer = (o: Order) => (o.cancelledBy ?? "Seller") === "Buyer";
    return {
      all: baseCancelled.length,
      buyer: baseCancelled.filter(isBuyer).length,
      seller: baseCancelled.filter((o) => !isBuyer(o)).length,
    };
  }, filterDeps);

  // Handle select all for current tab
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(currentTabOrders.map((o) => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  // Handle individual selection
  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId));
    }
  };

  // The 3PL Logistics tab only exists while the connector is on. If
  // the admin turns it off mid-session, fall back to All rather than
  // leaving the seller on a tab whose trigger has disappeared.
  useEffect(() => {
    if (!logisticsEnabled && activeTab === "logistics") {
      setActiveTab("all");
      setSelectedOrders([]);
    }
  }, [logisticsEnabled, activeTab]);

  // Clear selection when changing tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    setSelectedOrders([]);
    setCurrentPage(1); // Reset to first page
    // The quick filter bar is shared across tabs and deliberately
    // kept. The Cancelled tab's "Cancelled By" chip is tab-local, so
    // reset it on the way out so it doesn't quietly persist.
    if (tab !== "cancelled") setCancelledByFilter("all");
  };

  const handleDeliveryDayTabChange = (day: "all" | number) => {
    setDeliveryDayTab(day);
    setDeliveryDate("all");
    setSelectedOrders([]);
    setCurrentPage(1);
  };

  const handleRouteChange = (route: "all" | "beat" | "non-beat") => {
    setRouteFilter(route);
    setSelectedOrders([]);
    setCurrentPage(1);
  };

  // Date row under a weekday: pick one date. Clicking the active date
  // again goes back to every date for that weekday.
  const handleDeliveryDateChange = (date: string) => {
    setDeliveryDate(deliveryDate === date ? "all" : date);
    setSelectedOrders([]);
    setCurrentPage(1);
  };

  // Format an ISO delivery date as a pill label. The June 2026 review
  // dropped Today / Tomorrow / Yesterday suffixes — distributors plan
  // around the committed delivery DAY, and the relative labels added
  // noise without changing the operational decision. The pill row
  // still tints today's date red (handled at the pill render site)
  // so the imminent window stays visually distinct without text.
  const formatDeliveryPillLabel = (iso: string): string => {
    const d = Date.parse(iso + "T00:00:00Z");
    if (Number.isNaN(d)) return iso;
    return new Date(d).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  };

  // Pagination calculations
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return currentTabOrders.slice(startIndex, endIndex);
  }, [currentTabOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(currentTabOrders.length / itemsPerPage);
  // Order Summary metrics — drives the strip rendered between the
  // tab row and the per-tab content. Reads off `currentTabOrders`
  // so the figures react to every active filter (tab, Beat /
  // Non-Beat, Delivery Day pill, search, drawer filters).
  // `customers` is a count of distinct retailers — each retailer
  // can sit behind multiple orders in a single day, so the seller
  // needs both axes to plan dispatch.
  const orderSummary = useMemo(() => {
    const customers = new Set<string>();
    let value = 0;
    for (const o of currentTabOrders) {
      customers.add(o.retailerName);
      value += o.orderValue;
    }
    return {
      customers: customers.size,
      orders: currentTabOrders.length,
      value,
    };
  }, [currentTabOrders]);

  // View on Map — bulk action available on the New + Confirmed
  // tabs. Opens an in-app Leaflet + OpenStreetMap dialog showing
  // every selected order's customer pin so the distributor can
  // eyeball where the day's deliveries cluster before they confirm
  // or dispatch.
  //
  // The dialog handles the heavy lifting (markers, clustering,
  // legend, summary counts); this handler just gates the action
  // on "at least one selected order carries coordinates" so the
  // seller gets a helpful toast instead of an empty map when their
  // selection has no geo data.
  const handleViewOnMap = () => {
    const sel = orders.filter((o) => selectedOrders.includes(o.id));
    const mappable = sel.filter(
      (o) => typeof o.buyerLat === "number" && typeof o.buyerLng === "number",
    );
    if (mappable.length === 0) {
      toast.error(
        "None of the selected orders has a recorded customer location.",
      );
      return;
    }
    setIsMapDialogOpen(true);
  };

  // Confirm orders (New → Confirmed). There's no delivery-day gate —
  // any selected New order can be confirmed regardless of how far out
  // its committed Delivery Day is. (The earlier today/tomorrow-only
  // rule was dropped — it didn't reflect an actual business
  // requirement.)
  const handleConfirmOrders = () => {
    const allSelected = orders.filter((o) => selectedOrders.includes(o.id));
    if (allSelected.length === 0) {
      toast.error("Nothing to confirm — no orders selected.");
      return;
    }
    const selectedIds = new Set(allSelected.map((o) => o.id));
    setOrders((prev) =>
      prev.map((order) =>
        selectedIds.has(order.id)
          ? { ...order, status: "Confirmed" as const }
          : order,
      ),
    );
    toast.success(
      `Confirmed ${allSelected.length} order${allSelected.length === 1 ? "" : "s"}.`,
    );
    setSelectedOrders((prev) => prev.filter((id) => !selectedIds.has(id)));
    setIsConfirmDialogOpen(false);
  };

  // Cancel orders. The Cancel verb replaced "Reject" across the
  // module — same flow, same destructive intent, just consistent
  // wording with the single-order Cancel action on the detail page.
  const handleCancelOrders = () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }
    updateOrderStatuses(selectedOrders, "Cancelled", cancelReason, "Seller");
    toast.success(
      `${selectedOrders.length} order(s) cancelled. Reason: ${cancelReason}`,
    );
    setSelectedOrders([]);
    setIsCancelDialogOpen(false);
    setCancelReason("");
  };

  // Mark as delivered (Confirmed → Delivered). No metadata to capture
  // — the dialog is purely a confirmation surface.
  const handleDeliverOrders = () => {
    setOrders((prev) =>
      prev.map((order) =>
        selectedOrders.includes(order.id)
          ? { ...order, status: "Delivered" as const }
          : order
      )
    );

    toast.success(
      `${selectedOrders.length} order(s) marked as delivered!`
    );
    setSelectedOrders([]);
    setIsDeliverDialogOpen(false);
  };

  // Hand the selected confirmed orders to the third-party logistics
  // network. The seller doesn't need to know the order is crossing
  // into LBNP — from their side it simply leaves the Confirmed list
  // and reappears under Delivered once the partner closes it out.
  // Anything they didn't hand over stays selectable and can still be
  // marked delivered by hand, which is the whole point of the split.
  const handleRequestLogistics = () => {
    const moved = requestLogisticsForOrders(selectedOrders);
    if (moved === 0) {
      toast.error("Nothing to send — the selected orders are already with the logistics partner.");
      return;
    }
    toast.success(
      `${moved} order${moved === 1 ? "" : "s"} sent for 3PL delivery.`,
      {
        description:
          "Track them under the Logistics tab until the delivery partner completes them.",
        icon: <Truck className="h-4 w-4 text-blue-600" />,
        duration: 5000,
      },
    );
    setSelectedOrders([]);
    setIsRequestLogisticsDialogOpen(false);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setMarketplaceFilter("all");
    setSelectedCompanyFilters([]);
    setSelectedStatusFilters([]);
    setStartDate("");
    setEndDate("");
    setRouteFilter("all");
    setDeliveryDayTab("all");
    setDeliveryDate("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery ||
    marketplaceFilter !== "all" ||
    selectedCompanyFilters.length > 0 ||
    selectedStatusFilters.length > 0 ||
    startDate ||
    endDate ||
    routeFilter !== "all" ||
    deliveryDayTab !== "all";

  // Handle export
  // ---- Export helpers ----
  // Used by handleExport to materialise rows in the same shape as the
  // sample export sheet.

  const escapeCsv = (value: string | number): string => {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // Channel order ID — synthesised from marketplace + last 6 digits of
  // the order ID when the order doesn't carry its own.
  const channelOrderIdFor = (order: Order): string => {
    if (order.channelOrderId) return order.channelOrderId;
    const tail = order.id.replace(/[^0-9]/g, "").slice(-6);
    return `${order.marketplace.toUpperCase()}-ORD-${tail}`;
  };

  // Order Status display string — matches the sample's "New Order"
  // (instead of just "New") so the export reads as a sentence.
  const statusLabelFor = (order: Order): string =>
    `${order.status} Order`;

  // Compose the order-date column. Sample combines date + time; we
  // append `orderTime` when present.
  const orderDateLabelFor = (order: Order): string =>
    order.orderTime ? `${order.orderDate} ${order.orderTime}` : order.orderDate;

  // Synthesize a single line item from `itemsSummary` for orders
  // that don't carry full lineItems. Best-effort parsing: pulls the
  // leading qty + product description, prices to orderValue/qty, and
  // marks the line as no-discount.
  const synthesizeLineItems = (order: Order): OrderLineItem[] => {
    const m = order.itemsSummary.match(/^\s*(\d+)\s+units?\s+(.+?)\s*$/i);
    const qty = m ? parseInt(m[1], 10) : 1;
    const name = m ? m[2] : order.itemsSummary;
    const ppu = qty > 0 ? +(order.orderValue / qty).toFixed(2) : order.orderValue;
    return [
      {
        skuCode: `SKU-${order.id.replace(/[^0-9]/g, "").slice(-5)}`,
        productName: name,
        // No richer brand/company info to draw on — fall back to the
        // order's brand and an em-dash for company. Real builds would
        // resolve company and category from the SKU catalog.
        company: "—",
        brand: order.brand,
        category: "—",
        qty,
        originalPricePerUnit: ppu,
        finalPricePerUnit: ppu,
        discountApplied: 0,
        discountDetails: "No Discount",
        lineTotal: order.orderValue,
      },
    ];
  };

  const handleExport = () => {
    const range = resolveExportRange();
    if (!range) {
      toast.error("Please select a date range for export");
      return;
    }
    const start = new Date(range.start);
    const end = new Date(range.end);
    if (start > end) {
      toast.error("Start date cannot be after end date");
      return;
    }
    // Phase 1 caps the exportable window at one month to keep
    // generated sheets reasonable. The End Date input's `max`
    // attribute keeps the OS picker honest; this guard catches
    // the typed-date-bypass edge case.
    if (exportRangeTooLong) {
      toast.error("Date range can span at most one month (31 days)");
      return;
    }

    // Filter orders by export date range
    const ordersToExport = orders.filter((order) => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= start && orderDate <= end;
    });

    if (ordersToExport.length === 0) {
      toast.error("No orders found in the selected date range");
      return;
    }

    // 28-column layout — one row per line item; order-level fields
    // (Original Order Value, Order Level Savings, Final Order Value)
    // repeat on every row. The June 2026 review replaced the
    // Expected / Actual Delivery Date pair with a single Delivery
    // Day field, and added Order Type (Beat / Non-Beat) so finance
    // can reconcile by beat route without re-joining against the
    // settings sheet.
    // "Clubbed Orders" (how many seller orders were split out of the
    // same buyer-app checkout — blank for standalone orders) sits
    // beside Order ID. The earlier dummy "Parent Order No." was
    // rejected: order IDs come from the buyer app, and a fabricated
    // number read like a real ID. "Operation Mode" follows Company.
    // Wholesale rows mask the company as "Wholesaler" — same as the
    // list.
    const headers = [
      "Order ID",
      "Clubbed Orders",
      "Order Status",
      "Order Date",
      "Order Type",
      "Beat Name",
      "Delivery Day",
      "Buyer Name",
      "Buyer Contact",
      "Buyer Address",
      "Seller Name",
      "Seller Contact",
      "Payment Mode",
      "Channel Order ID",
      "Original Order Value",
      "SKU code",
      "Product Name",
      "Company",
      "Operation Mode",
      "Brand",
      "Category",
      "QTY",
      "Original Price/Unit",
      "Final Price/Unit",
      "Discount Applied",
      "Discount Details",
      "Order Level Discount",
      "Final Order Value",
    ];

    const csvRows = [headers.join(",")];

    // Clubbed-order counts — how many exported orders share each
    // checkout. Counted within the export window so the sheet is
    // self-consistent.
    const clubSizes = new Map<string, number>();
    for (const o of ordersToExport) {
      const k = getCustomerOrderId(o);
      clubSizes.set(k, (clubSizes.get(k) ?? 0) + 1);
    }

    ordersToExport.forEach((order) => {
      const lines =
        order.lineItems && order.lineItems.length > 0
          ? order.lineItems
          : synthesizeLineItems(order);
      const orderLevelSavings = lines.reduce(
        (n, l) => n + l.discountApplied,
        0,
      );
      const finalOrderValue = order.orderValue;
      const isWholesale = getOrderOperationMode(order) === "wholesale";
      lines.forEach((item) => {
        const clubSize = clubSizes.get(getCustomerOrderId(order)) ?? 1;
        const row = [
          order.id,
          clubSize > 1 ? clubSize : "",
          statusLabelFor(order),
          orderDateLabelFor(order),
          getOrderType(order) === "beat" ? "Beat" : "Non-Beat",
          order.beatName ?? "",
          order.expectedDeliveryDate,
          order.retailerName,
          order.buyerContact ?? "",
          order.buyerAddress ?? "",
          SELLER_INFO.name,
          SELLER_INFO.contact,
          order.paymentMode,
          channelOrderIdFor(order),
          order.orderValue,
          item.skuCode,
          item.productName,
          isWholesale ? "Wholesaler" : item.company,
          isWholesale ? "Wholesale" : "Distribution",
          item.brand,
          item.category,
          item.qty,
          item.originalPricePerUnit,
          item.finalPricePerUnit,
          item.discountApplied,
          item.discountDetails,
          orderLevelSavings,
          finalOrderValue,
        ];
        csvRows.push(row.map(escapeCsv).join(","));
      });
    });

    const csvContent = csvRows.join("\r\n");

    // Create download link
    const blob = new Blob(["﻿" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `orders_${range.start}_to_${range.end}.${exportFormat}`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(
      `Successfully exported ${ordersToExport.length} order(s) from ${range.start} to ${range.end}`,
    );
    setIsExportDialogOpen(false);
  };

  // Get status badge. Cancelled orders fan out into two visually
  // distinct chips so the cancelled-tab reviewer can tell at a glance
  // who pulled the plug:
  //   - "Cancelled by Buyer"  — amber, signals an auto-processed
  //     cancellation the seller didn't act on (came in via the buyer
  //     app's ONDC /cancel).
  //   - "Cancelled by Seller" — purple, signals a seller-initiated
  //     cancellation from the bulk action or the detail page.
  // Legacy / un-stamped cancellations default to the Seller variant
  // since every pre-feature cancellation in the seed data came from
  // a seller action.
  const getStatusBadge = (order: Order) => {
    const status = order.status;
    switch (status) {
      case "New":
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">
            New
          </Badge>
        );
      case "Confirmed":
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200">
            Confirmed
          </Badge>
        );
      case "Delivered":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
            Delivered
          </Badge>
        );
      case "Cancelled": {
        const who = order.cancelledBy ?? "Seller";
        if (who === "Buyer") {
          return (
            <Badge className="bg-amber-50 text-amber-800 border-amber-200">
              Cancelled by Customer
            </Badge>
          );
        }
        return (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200">
            Cancelled by Seller
          </Badge>
        );
      }
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // (Priority badge was retired alongside the May 2026 column sweep
  // — urgency now reads off the Delivery Type badge, and the row
  // surfaces Beat Name + Beat Delivery Day as first-class columns
  // instead of the old past/today/tomorrow/future bucket chip.)

  // Render order table
  const renderOrderTable = (ordersToRender: Order[]) => {
    if (ordersToRender.length === 0) {
      const hasSearch = searchQuery.trim().length > 0;
      const title = hasSearch
        ? "No orders match your search"
        : activeTab === "all"
          ? "No orders yet"
          : activeTab === "logistics"
            ? "Nothing with the logistics partner"
            : `No ${activeTab} orders`;
      const description = hasActiveFilters
        ? "No orders match your current filters. Try clearing them to see everything."
        : activeTab === "all"
          ? "Once retailers start placing orders on ONDC and connected marketplaces, they'll show up here ready for you to confirm and dispatch."
          : activeTab === "logistics"
            ? "Orders you send from Confirmed using Request 3PL Logistics will appear here until the delivery partner completes them."
            : `You don't have any ${activeTab} orders right now — new ones will land here automatically.`;
      return (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <EmptyState
            icon={Package}
            title={title}
            description={description}
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        </div>
      );
    }

    // Tabs that carry a bulk-action bar need row checkboxes. Logistics
    // is deliberately excluded — the order belongs to the partner at
    // that point and completion arrives from their app, so there is
    // nothing for the seller to select or act on.
    const isActionable = activeTab === "new" || activeTab === "confirmed";

    return (
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              {isActionable && (
                <th className="text-left py-2.5 px-3 w-10">
                  <Checkbox
                    checked={
                      selectedOrders.length === ordersToRender.length &&
                      ordersToRender.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </th>
              )}
              {/* Column shape locked on June 26 — Order Date leads
                  (when did it land), followed by Delivery Date (when
                  it ships), then the order ID, identity columns,
                  operational tags (Type / Beat), commercial (Value /
                  Marketplace), and Status + per-tab Actions. */}
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Order Date
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Delivery Date
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Order ID
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Company
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Business Name
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Mobile
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Order Type
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Beat Name
              </th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Order Value
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Marketplace
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Status
              </th>
              {activeTab === "cancelled" && (
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                  Cancellation Reason
                </th>
              )}
              <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {ordersToRender.map((order) => (
              <tr
                key={order.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {isActionable && (
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOrder(order.id, checked as boolean)
                      }
                    />
                  </td>
                )}
                {/* Order Date — ISO date the order landed. */}
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-700 tabular-nums"
                  title={order.orderTime ? `${order.orderDate} ${order.orderTime}` : order.orderDate}
                >
                  {order.orderDate}
                  {/* Stale-pending flag — VIW-2026-06911 soft nudge.
                      Visual only; the row stays fully actionable. */}
                  {isStalePendingOrder(order) && (
                    <span
                      className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 w-fit"
                      title={`Placed ${getPendingAgeDays(order)} days ago — please confirm or cancel it before piling on new orders.`}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {getPendingAgeDays(order)}{" "}
                      {getPendingAgeDays(order) === 1 ? "day" : "days"} pending
                    </span>
                  )}
                </td>
                {/* Delivery Date — the date the seller committed to
                    deliver on. Same ISO format as Order Date so the
                    two columns read in lockstep. */}
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-700 tabular-nums"
                  title={order.expectedDeliveryDate}
                >
                  {order.expectedDeliveryDate}
                </td>
                {/* Order ID — full ID rendered as a code chip with
                    copy-on-hover. */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <CopyOnHover value={order.id} label="Order ID">
                    <code
                      className="text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono"
                      title={order.id}
                    >
                      {order.id}
                    </code>
                  </CopyOnHover>
                </td>
                <td className="px-3 py-2.5">
                  <p
                    className="text-sm font-medium text-gray-900 truncate max-w-[160px]"
                    title={order.company}
                  >
                    {order.company}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <CopyOnHover value={order.retailerName} label="Business name">
                    <p
                      className="text-sm font-medium text-gray-900 truncate max-w-[160px]"
                      title={order.retailerName}
                    >
                      {order.retailerName}
                    </p>
                  </CopyOnHover>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {order.buyerContact ? (
                    <CopyOnHover value={order.buyerContact} label="Mobile number">
                      <p className="text-xs text-gray-700 font-mono">
                        {order.buyerContact}
                      </p>
                    </CopyOnHover>
                  ) : (
                    <p className="text-xs text-gray-400">—</p>
                  )}
                </td>
                {/* Order Type — Beat / Non-Beat. Derived from the
                    explicit `orderType` field, or inferred from
                    `beatName` for legacy seed rows. The tone pairs
                    with the New / Confirmed tab's Beat-vs-Non-Beat
                    filter pills (emerald = beat route, amber =
                    off-schedule) so the row and the filter speak
                    the same visual language. */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {getOrderType(order) === "beat" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700">
                      <Route className="h-3 w-3" />
                      Beat
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-[11px] font-medium text-amber-800">
                      <Zap className="h-3 w-3" />
                      Non-Beat
                    </span>
                  )}
                </td>
                {/* Beat Name — surfaces the configured serviceability
                    beat that owns this delivery. Falls back to "—"
                    for orphan / ad-hoc orders. */}
                <td
                  className="px-3 py-2.5 whitespace-nowrap"
                  title={order.beatName ?? "No beat assigned"}
                >
                  {order.beatName ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-[11px] text-gray-700 max-w-[160px]">
                      <span className="truncate">{order.beatName}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    ₹{order.orderValue.toFixed(2)}
                  </p>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-gray-200 bg-white text-[11px] font-medium text-gray-700">
                    {order.marketplace}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {getStatusBadge(order)}
                </td>
                {activeTab === "cancelled" && (
                  <td className="px-3 py-2.5 max-w-[200px]">
                    {order.cancellationReason ? (
                      <p
                        className="text-xs text-gray-700 truncate"
                        title={order.cancellationReason}
                      >
                        {order.cancellationReason}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">—</p>
                    )}
                  </td>
                )}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/orders/${order.id}`)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Inception-day: when the seller has no orders at all, hide the
  // Filters / Export CTAs and the pagination footer. Tabs remain
  // visible so the seller can switch between status views and the
  // same full-height Card container is preserved so the layout reads
  // identically to the populated state. The per-tab EmptyState
  // already handles rendering the illustration in each tab body.
  const isEmpty = orders.length === 0;

  // Search bar — sits under the filters, as on the original screen.
  // Clear resets every filter (search, delivery day, order type and
  // the drawer filters) in one go.
  const renderSearchBar = () => (
    <div className="px-6 py-4 border-b flex-shrink-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by order ID, retailer name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-sm text-gray-500 gap-1"
            >
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Bulk actions — one "Actions" dropdown on the New and
            Confirmed tabs, shown once at least one order is selected.
            New: View on Map, Confirm. Confirmed: View on Map, Request
            3PL Logistics (when enabled), Mark Delivered. Cancel Orders
            sits last, split off as the destructive option. Each item
            opens the same dialog the old buttons did. */}
        {(activeTab === "new" || activeTab === "confirmed") &&
          selectedOrders.length > 0 && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm text-gray-600">
                {selectedOrders.length} selected
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="group gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    Actions
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {selectedOrders.length}{" "}
                    {selectedOrders.length === 1 ? "order" : "orders"} selected
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={handleViewOnMap}
                    className="gap-2 cursor-pointer"
                  >
                    <MapPin className="h-4 w-4" />
                    View on Map
                  </DropdownMenuItem>
                  {activeTab === "new" && (
                    <DropdownMenuItem
                      onSelect={() => setIsConfirmDialogOpen(true)}
                      className="gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm
                    </DropdownMenuItem>
                  )}
                  {activeTab === "confirmed" && logisticsEnabled && (
                    <DropdownMenuItem
                      onSelect={() => setIsRequestLogisticsDialogOpen(true)}
                      className="gap-2 cursor-pointer"
                    >
                      <Truck className="h-4 w-4" />
                      Request 3PL Logistics
                    </DropdownMenuItem>
                  )}
                  {activeTab === "confirmed" && (
                    <DropdownMenuItem
                      onSelect={() => setIsDeliverDialogOpen(true)}
                      className="gap-2 cursor-pointer"
                    >
                      <PackageCheck className="h-4 w-4" />
                      Mark Delivered
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setIsCancelDialogOpen(true)}
                    className="gap-2 cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Orders
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
      </div>
    </div>
  );

  // Delivery filters — the rows under the toolbar:
  //   1. Delivery day: All Days · Monday … Sunday (weekday, every week)
  //   2. Only once a weekday is picked: that weekday's actual dates
  //      with their order counts.
  //   3. Order type: All · Beat · Non-beat.
  // Same pill styling the old date-wise Delivery Day row used: dark
  // for All, blue for the selected day, emerald = beat, amber =
  // non-beat. Rows scroll sideways on narrow screens.
  const renderDeliveryFilters = () => {
    const pill = (
      active: boolean,
      activeTone: string,
      empty = false,
      idleTone?: string,
    ) =>
      `shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
        active
          ? activeTone
          : (idleTone ??
            `bg-white border-gray-300 hover:bg-gray-50 ${empty ? "text-gray-400" : "text-gray-700"}`)
      }`;
    const rowLabel =
      "shrink-0 w-28 inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 uppercase tracking-wide";
    const weekdayLabel =
      WEEKDAY_TABS.find((w) => w.day === deliveryDayTab)?.label ?? "";

    return (
      <div className="px-6 py-3 border-b flex-shrink-0 space-y-2">
        {/* 1 — weekday */}
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <span className={rowLabel}>
            <CalendarDays className="h-3.5 w-3.5" />
            Delivery day
          </span>
          <button
            onClick={() => handleDeliveryDayTabChange("all")}
            className={pill(
              deliveryDayTab === "all",
              "bg-gray-900 text-white border-gray-900",
            )}
          >
            All Days ({deliveryDayCounts.all})
          </button>
          {WEEKDAY_TABS.map(({ day, label }) => {
            const count = deliveryDayCounts.byDay.get(day) ?? 0;
            return (
              <button
                key={day}
                onClick={() => handleDeliveryDayTabChange(day)}
                className={pill(
                  deliveryDayTab === day,
                  "bg-blue-600 text-white border-blue-600",
                  count === 0,
                )}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* 2 — that weekday's actual dates */}
        {deliveryDayTab !== "all" && (
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] rounded-lg bg-blue-50/50 py-1.5 -mx-1 px-1">
            <span className={rowLabel}>Dates</span>
            <button
              onClick={() => {
                setDeliveryDate("all");
                setSelectedOrders([]);
                setCurrentPage(1);
              }}
              className={pill(
                deliveryDate === "all",
                "bg-blue-600 text-white border-blue-600",
              )}
            >
              All {weekdayLabel}s ({deliveryDateBuckets.total})
            </button>
            {deliveryDateBuckets.dates.length === 0 && (
              <span className="text-xs text-gray-500">
                No {weekdayLabel} deliveries for the current filters.
              </span>
            )}
            {deliveryDateBuckets.dates.map((d) => {
              const active = deliveryDate === d.date;
              return (
                <button
                  key={d.date}
                  onClick={() => handleDeliveryDateChange(d.date)}
                  className={pill(
                    active,
                    "bg-blue-600 text-white border-blue-600",
                  )}
                >
                  {formatDeliveryPillLabel(d.date)} ({d.count})
                </button>
              );
            })}
          </div>
        )}

        {/* 3 — order type */}
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <span className={rowLabel}>
            <Route className="h-3.5 w-3.5" />
            Order type
          </span>
          <button
            onClick={() => handleRouteChange("all")}
            className={pill(
              routeFilter === "all",
              "bg-gray-900 text-white border-gray-900",
            )}
          >
            All ({routeCounts.all})
          </button>
          <button
            onClick={() => handleRouteChange("beat")}
            className={pill(
              routeFilter === "beat",
              "bg-emerald-600 text-white border-emerald-600",
              routeCounts.beat === 0,
              "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
            )}
          >
            <Route className="h-3 w-3" />
            Beat ({routeCounts.beat})
          </button>
          <button
            onClick={() => handleRouteChange("non-beat")}
            className={pill(
              routeFilter === "non-beat",
              "bg-amber-600 text-white border-amber-600",
              routeCounts.nonBeat === 0,
              "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
            )}
          >
            <Zap className="h-3 w-3" />
            Non-beat ({routeCounts.nonBeat})
          </button>
        </div>
      </div>
    );
  };

  // Status tabs — original grey segmented style, "All (35)" labels.
  // Kept data-driven so the Logistics tab can drop in and out with the
  // logistics flag.
  const statusTabs: {
    value: TabType;
    label: string;
    count: number;
    icon?: typeof Clock;
    title?: string;
  }[] = [
    { value: "all", label: "All", count: summary.all },
    { value: "new", label: "New", count: summary.new, icon: ShoppingCart },
    {
      value: "confirmed",
      label: "Confirmed",
      count: summary.confirmed,
      icon: CheckCircle2,
    },
    ...(logisticsEnabled
      ? [
          {
            value: "logistics" as TabType,
            label: "Logistics",
            count: summary.logistics,
            icon: Truck,
          },
        ]
      : []),
    {
      value: "delivered",
      label: "Delivered",
      count: summary.delivered,
      icon: PackageCheck,
    },
    {
      value: "cancelled",
      label: "Cancelled",
      count: summary.cancelled,
      icon: XCircle,
    },
  ];
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Page area — Card stretches; only the rows inside each tab
          scroll. Tab strip + search bar stay pinned at the top, the
          pagination stays pinned at the bottom. Mirrors the My SKU
          layout pattern. */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full">
          {/* Orders Card with Tabs */}
          <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full h-full flex flex-col overflow-hidden"
            >
              {/* Tab Headers with Filters */}
              <div className="border-b border-gray-200 p-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-4 overflow-x-auto">
                  {/* Tab Toggle */}
                  <TabsList className="bg-gray-100 p-1 rounded-lg inline-flex gap-1 h-auto flex-shrink-0">
                    {statusTabs.map((t) => {
                      const Icon = t.icon;
                      return (
                        <TabsTrigger
                          key={t.value}
                          value={t.value}
                          title={t.title}
                          className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                        >
                          {Icon && <Icon className="h-4 w-4 mr-2" />}
                          <span className="font-medium">
                            {t.label} ({t.count})
                          </span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {/* Action Buttons */}
                  {!isEmpty && (
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Filters Button */}
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setIsFilterDialogOpen(true)}
                    >
                      <Filter className="h-4 w-4" />
                      Filters
                    </Button>

                    {/* Export Button */}
                    <Button
                      className="gap-2"
                      onClick={() => setIsExportDialogOpen(true)}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  )}
                </div>
              </div>

              {/* Order Summary strip — three figures (Customers,
                  Orders, Total Value) reading off `currentTabOrders`
                  so they react to every active filter. Lets the
                  seller eyeball the business shape of the slice
                  they're looking at without exporting a report.
                  Not shown on Delivered / Cancelled — like the filter
                  rows, it's for planning open orders. */}
              {!isEmpty && usesDeliveryFilters(activeTab) && (
                <div className="px-6 py-2.5 border-b border-gray-100 bg-gradient-to-r from-purple-50/40 via-white to-emerald-50/40 flex-shrink-0 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                      Customers
                    </span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                      {orderSummary.customers.toLocaleString()}
                    </span>
                  </div>
                  <span className="h-3 w-px bg-gray-200" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                      Orders
                    </span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                      {orderSummary.orders.toLocaleString()}
                    </span>
                  </div>
                  <span className="h-3 w-px bg-gray-200" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                      Total Value
                    </span>
                    <span className="text-sm font-semibold text-emerald-700 tabular-nums">
                      ₹{orderSummary.value.toLocaleString()}
                    </span>
                  </div>
                  <span className="ml-auto text-[10px] text-gray-500">
                    Updates with active filters
                  </span>
                </div>
              )}

              {/* Delivery day / Dates / Order type */}
              {!isEmpty && usesDeliveryFilters(activeTab) && renderDeliveryFilters()}

              {/* Applied Filter Tags */}
              {(selectedCompanyFilters.length > 0 || selectedStatusFilters.length > 0 || marketplaceFilter !== "all") && (
                <div className="px-6 py-2 border-b flex flex-wrap items-center gap-2 flex-shrink-0">
                  {selectedCompanyFilters.map((company) => (
                    <Badge key={company} variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-purple-50 text-purple-700 border-purple-200">
                      {company}
                      <button onClick={() => setSelectedCompanyFilters(selectedCompanyFilters.filter(c => c !== company))} className="ml-1 hover:bg-purple-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {selectedStatusFilters.map((status) => (
                    <Badge key={status} variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {status}
                      <button onClick={() => setSelectedStatusFilters(selectedStatusFilters.filter(s => s !== status))} className="ml-1 hover:bg-blue-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {marketplaceFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-green-50 text-green-700 border-green-200">
                      {marketplaceFilter}
                      <button onClick={() => setMarketplaceFilter("all")} className="ml-1 hover:bg-green-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500 text-xs h-6">
                    Clear all
                  </Button>
                </div>
              )}

              {/* Cancelled-By quick filter — split a flat Cancelled
                  list into who-pulled-the-plug buckets so the
                  seller can audit buyer drop-offs vs their own
                  cancellations in one click. Mirrors the Confirmed
                  tab's delivery-window chips for visual rhythm. Sits above
                  the search bar on the Cancelled tab. */}
              {!isEmpty && activeTab === "cancelled" && (
              <div className="px-6 pt-4 pb-2 border-b flex-shrink-0 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide mr-1">
                  Cancelled By:
                </span>
                <button
                  onClick={() => {
                    setCancelledByFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    cancelledByFilter === "all"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  All ({cancelledByCounts.all})
                </button>
                <button
                  onClick={() => {
                    setCancelledByFilter("Buyer");
                    setCurrentPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    cancelledByFilter === "Buyer"
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  Customer ({cancelledByCounts.buyer})
                </button>
                <button
                  onClick={() => {
                    setCancelledByFilter("Seller");
                    setCurrentPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    cancelledByFilter === "Seller"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  Seller ({cancelledByCounts.seller})
                </button>
              </div>
              )}

              {/* Search */}
              {!isEmpty && renderSearchBar()}

            {/* Tab Contents */}
            <TabsContent value="all" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {/* Table */}
              {renderOrderTable(paginatedOrders)}
              {!isEmpty && (
              <ListPagination
                page={currentPage}
                total={currentTabOrders.length}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
                itemLabel="order"
              />
              )}
            </TabsContent>

            <TabsContent value="new" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {/* Table */}
              {renderOrderTable(paginatedOrders)}
              {!isEmpty && (
              <ListPagination
                page={currentPage}
                total={currentTabOrders.length}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
                itemLabel="order"
              />
              )}
            </TabsContent>

            <TabsContent value="confirmed" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {/* Table */}
              {renderOrderTable(paginatedOrders)}
            </TabsContent>

            {/* 3PL Logistics — orders handed to the delivery partner.
                Read-only as far as fulfilment goes: the seller can look
                them up and answer a customer's "where is it?", but they
                can't deliver or reschedule an order the partner now
                owns. The one action is the partner-completion callback,
                which in production arrives from the delivery-partner
                app via LBNP rather than from a button here. */}
            <TabsContent value="logistics" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              <div className="px-6 py-3 border-b flex-shrink-0">
                <p className="text-xs text-gray-500">
                  These orders are with the logistics partner. They move to Delivered automatically once the delivery partner completes them.
                </p>
              </div>

              {/* Table */}
              {renderOrderTable(paginatedOrders)}
              {!isEmpty && (
                <ListPagination
                  page={currentPage}
                  total={currentTabOrders.length}
                  pageSize={itemsPerPage}
                  onPageChange={setCurrentPage}
                  itemLabel="order"
                />
              )}
            </TabsContent>

            <TabsContent value="delivered" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {/* Table */}
              {renderOrderTable(paginatedOrders)}
            </TabsContent>

            <TabsContent value="cancelled" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {/* Table */}
              {renderOrderTable(paginatedOrders)}
            </TabsContent>
          </Tabs>
        </Card>
        </div>
      </div>

      {/* Orders Map View — Leaflet + OpenStreetMap dialog showing
          customer pins for the seller's current selection. Opened
          from the View on Map bulk action on the New + Confirmed
          tabs. Context label reflects the tab the seller is on so
          the header is honest about what they're looking at. */}
      <OrdersMapDialog
        open={isMapDialogOpen}
        onOpenChange={setIsMapDialogOpen}
        orders={orders.filter((o) => selectedOrders.includes(o.id))}
        contextLabel={
          activeTab === "new"
            ? "New Orders"
            : activeTab === "confirmed"
              ? "Confirmed Orders"
              : "Selected Orders"
        }
      />

      {/* Stale-pending nudge pop-up — VIW-2026-06911. Interrupts once
          on landing in New with a stale backlog, instead of sitting
          in the page as a permanent banner. Must be explicitly
          closed (X, "Not now", clicking outside, or Escape all route
          through the same dismiss handler) — the seller has to
          actually register it before it goes away, which was the
          point of moving off the sticky banner. */}
      <Dialog
        open={isStaleNudgePopupOpen}
        onOpenChange={(open) => {
          if (!open) dismissStaleNudgePopup();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Pending orders need attention
            </DialogTitle>
            <DialogDescription>
              {stalePendingOrders.length} order
              {stalePendingOrders.length === 1 ? "" : "s"} placed more than{" "}
              {STALE_PENDING_NUDGE_DAYS} days ago{" "}
              {stalePendingOrders.length === 1 ? "is" : "are"} still
              unconfirmed. Please update their status before processing new
              ones — you can still view and act on everything in the list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={dismissStaleNudgePopup}>
              Not now
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              onClick={() => {
                dismissStaleNudgePopup();
                handleReviewStaleOrders();
              }}
            >
              <Clock className="h-3.5 w-3.5" />
              Review pending orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Orders Review — VIW-2026-06911 soft nudge. Opened
          from the stale-pending nudge pop-up. Lets the seller pick
          which stale orders to act on (defaults to all checked) and
          route the picked subset to either Confirm or Cancel — the
          ticket's Stage 1 nudge is advisory, so partial action + either
          outcome both have to stay available, not just "confirm all
          or ignore". */}
      <Dialog
        open={isStaleReviewDialogOpen}
        onOpenChange={setIsStaleReviewDialogOpen}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Review Pending Orders
            </DialogTitle>
            <DialogDescription>
              These New orders have been sitting for more than{" "}
              {STALE_PENDING_NUDGE_DAYS} days. Pick the ones you want to
              act on now, then Confirm or Cancel — anything left
              unchecked stays as-is.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Checkbox
                checked={
                  staleReviewSelection.length === stalePendingOrders.length &&
                  stalePendingOrders.length > 0
                }
                onCheckedChange={(checked) =>
                  setStaleReviewSelection(
                    checked ? stalePendingOrders.map((o) => o.id) : [],
                  )
                }
              />
              <span className="text-xs font-medium text-gray-600">
                {staleReviewSelection.length} of {stalePendingOrders.length}{" "}
                selected
              </span>
            </div>
            <ul className="space-y-1.5">
              {stalePendingOrders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 text-xs bg-white rounded px-2 py-2 border border-gray-100"
                >
                  <Checkbox
                    checked={staleReviewSelection.includes(o.id)}
                    onCheckedChange={(checked) =>
                      setStaleReviewSelection((prev) =>
                        checked
                          ? [...prev, o.id]
                          : prev.filter((id) => id !== o.id),
                      )
                    }
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium text-gray-900 truncate">
                      {o.retailerName}
                    </span>
                    <span className="text-[10px] text-gray-500">{o.id}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap border border-amber-200 bg-amber-50 text-amber-800">
                    <Clock className="h-3 w-3" />
                    {getPendingAgeDays(o)}{" "}
                    {getPendingAgeDays(o) === 1 ? "day" : "days"} pending
                  </span>
                  <span className="text-[10px] text-gray-600 whitespace-nowrap">
                    ₹{o.orderValue.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsStaleReviewDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50 gap-2"
              disabled={staleReviewSelection.length === 0}
              onClick={handleStaleReviewCancel}
            >
              <XCircle className="h-4 w-4" />
              Cancel {staleReviewSelection.length || ""}
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={staleReviewSelection.length === 0}
              onClick={handleStaleReviewConfirm}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm {staleReviewSelection.length || ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Orders Dialog — a simple confirmation: how many orders,
          then Cancel / Confirm Orders. */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Confirm Orders
            </DialogTitle>
            <DialogDescription>
              Confirm {selectedOrders.length} order
              {selectedOrders.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmOrders}
              disabled={selectedOrders.length === 0}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Orders Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Cancel Orders
            </DialogTitle>
            <DialogDescription>
              Cancel {selectedOrders.length} order(s). Please provide a
              reason for cancellation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancelReason">
                Reason for Cancellation <span className="text-red-500">*</span>
              </Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger id="cancelReason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                  <SelectItem value="Delivery Issue">Delivery Issue</SelectItem>
                  <SelectItem value="Pricing Error">Pricing Error</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Cancelled orders will be notified to the customer and cannot be
                undone.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrders}
              disabled={!cancelReason.trim()}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancel {selectedOrders.length} Order(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Delivered Dialog — pure confirmation surface.
          No date / notes capture; the timestamp is set server-side
          when status flips to Delivered. */}
      <Dialog open={isDeliverDialogOpen} onOpenChange={setIsDeliverDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
              Mark as Delivered
            </DialogTitle>
            <DialogDescription>
              Confirm delivery of {selectedOrders.length === 1
                ? "1 order"
                : `${selectedOrders.length} orders`}.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeliverDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeliverOrders}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <PackageCheck className="h-4 w-4" />
              Mark Delivered
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request 3PL Logistics Dialog — the hand-off is one-way from
          the seller's side, so it gets a confirmation step. Kept to a
          plain confirm, matching the other bulk dialogs on this page. */}
      <Dialog
        open={isRequestLogisticsDialogOpen}
        onOpenChange={setIsRequestLogisticsDialogOpen}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              Request 3PL Logistics
            </DialogTitle>
            <DialogDescription>
              Send {selectedOrders.length === 1
                ? "1 order"
                : `${selectedOrders.length} orders`}{" "}
              to the logistics partner for delivery.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRequestLogisticsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestLogistics}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Truck className="h-4 w-4" />
              Send for Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Orders Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Export Orders
            </DialogTitle>
            <DialogDescription>
              Select the date range and format to export orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Date Range — Start + End date inputs with a 31-day
                max span. When Start changes, End auto-fills to
                Start + 30 days so the seller almost never has to
                touch End; they can shrink the window for a
                tighter export but the OS picker disables anything
                past one month. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="exportStartDate">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="exportStartDate"
                  type="date"
                  value={exportStartDate}
                  max={todayIso}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setExportStartDate(newStart);
                    // Auto-fill End Date to Start + 30 so the
                    // seller lands on a valid one-month window
                    // out of the box. They can still pull End
                    // earlier if they want a shorter export.
                    if (newStart) {
                      const cappedEnd = isoNDaysAfter(newStart, 30);
                      // Don't push End past today even if the
                      // 30-day window would go into the future.
                      setExportEndDate(
                        cappedEnd > todayIso ? todayIso : cappedEnd,
                      );
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exportEndDate">
                  End Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="exportEndDate"
                  type="date"
                  value={exportEndDate}
                  min={exportStartDate || undefined}
                  max={exportEndMax}
                  onChange={(e) => setExportEndDate(e.target.value)}
                />
              </div>
              <p className="sm:col-span-2 text-[11px] text-gray-600">
                Date range can span at most one month (31 days).
                When you pick a Start Date, the End Date is set to
                one month later automatically — adjust it down if
                you want a tighter window.
              </p>
              {exportRangeTooLong && (
                <p className="sm:col-span-2 text-[11px] text-red-700 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  The selected range exceeds one month. Narrow it
                  before exporting.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="exportFormat">
                Format <span className="text-red-500">*</span>
              </Label>
              <Select
                value={exportFormat}
                onValueChange={setExportFormat}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExportDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              className="gap-2"
              disabled={
                exportRangeTooLong ||
                !exportStartDate ||
                !exportEndDate
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter Orders Drawer */}
      <AnimatePresence>
        {isFilterDialogOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsFilterDialogOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Filter Orders</h2>
                <button
                  onClick={() => setIsFilterDialogOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <MultiSelect
                      options={uniqueCompanies.map((c) => ({ label: c, value: c }))}
                      selected={selectedCompanyFilters}
                      onChange={setSelectedCompanyFilters}
                      placeholder="All Companies"
                      allLabel="All Companies"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <MultiSelect
                      options={statusOptions}
                      selected={selectedStatusFilters}
                      onChange={setSelectedStatusFilters}
                      placeholder="All Status"
                      allLabel="All Status"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="marketplaceFilter">Marketplace</Label>
                    <Select
                      value={marketplaceFilter}
                      onValueChange={setMarketplaceFilter}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Marketplace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Marketplaces</SelectItem>
                        <SelectItem value="ONDC">ONDC</SelectItem>
                        <SelectItem value="Amazon">Amazon</SelectItem>
                        <SelectItem value="Flipkart">Flipkart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateRange">Date Range</Label>
                    <div className="flex flex-col gap-2">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full"
                        placeholder="Start Date"
                      />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full"
                        placeholder="End Date"
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setIsFilterDialogOpen(false)}
                >
                  Apply
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}