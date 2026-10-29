import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { MultiSelect } from "../../components/ui/multi-select";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
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
  Lock,
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
// ways. `Order` is exported from the lib so we
// don't redeclare it here.
import {
  type Order,
  type OrderLineItem,
  type CancelledBy,
  SELLER_INFO,
  getOrders,
  setOrders as setOrdersStore,
  subscribeToOrders,
  updateOrderStatuses,
  getOrdersToday,
  getOrderType,
  getOrderOperationMode,
  getCustomerOrderId,
  requestLogisticsForOrders,
  getStalePendingOrders,
  getPendingAgeDays,
  isStalePendingOrder,
  STALE_PENDING_NUDGE_DAYS,
  getAttentionOrders,
  type CustomerCheckout,
  groupOrdersByCheckout,
  getOrderLines,
  getRetailerCompanyId,
  CUSTOMER_ORDER_STAGES,
  getCustomerOrderStage,
  getMixedCustomerOrderStatus,
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

// "rejected" tab label is retired alongside the status rename; the
// tab now shows Cancelled orders. The TabType value stays as
// "cancelled" so future code reads consistently.
// "logistics" holds orders handed to the 3PL network. It isn't an
// order STATUS — those rows are still Confirmed underneath — it's a
// fulfilment route, so it gets its own tab rather than a status entry.
type OrdersView = "company" | "customer";

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
  // Orders view — "customer" (default) folds the company orders of one
  // customer checkout into a single row; "company" is the existing
  // one-row-per-company-order list. Only the URL carries it
  // (?view=company), so opening Orders fresh always lands on the
  // Customer Wise view, and Back from a company order returns to the
  // Company Wise view.
  const [searchParams, setSearchParams] = useSearchParams();
  const [orderView, setOrderView] = useState<OrdersView>(() =>
    searchParams.get("view") === "company" ? "company" : "customer",
  );
  const handleOrderViewChange = (view: OrdersView) => {
    if (view === orderView) return;
    setOrderView(view);
    setSelectedOrders([]);
    setCurrentPage(1);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (view === "company") next.set("view", "company");
        else next.delete("view");
        return next;
      },
      { replace: true },
    );
  };
  // Sub-tab inside Confirmed: split deliveries by when they're due.
  // "all" matches both buckets — the default so existing flows keep
  // Confirmed-tab navigation. The earlier "Urgent / Tomorrow /
  // Beyond Tomorrow" model was retired in June 2026 — distributors
  // plan around delivery DAYS, not urgency labels. The new model:
  //
  //   1. Pick a delivery day (e.g. "Thu 21 May") from a pill row.
  //   2. Inside that day, switch between Beat orders (riding the
  //      configured serviceability route) and Non-Beat orders
  //      (urgent / off-schedule exceptions).
  //
  // `confirmedDeliveryDay` holds the selected ISO date or "all".
  // `confirmedBeatMode` holds the Beat/Non-Beat filter.
  const [confirmedDeliveryDay, setConfirmedDeliveryDay] = useState<string>("all");
  const [confirmedBeatMode, setConfirmedBeatMode] = useState<
    "all" | "beat" | "non-beat"
  >("all");
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

  // Unique companies and statuses for filter options
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
  // Default window: the 31 days ending at the newest order, so the
  // first export always has data in it.
  const latestOrderIso = (() => {
    const latest = getOrders().reduce(
      (max, o) => (o.orderDate > max ? o.orderDate : max),
      "",
    );
    return latest && latest < todayIso ? latest : todayIso;
  })();
  const [exportStartDate, setExportStartDate] = useState(() =>
    isoNDaysAfter(latestOrderIso, -30),
  );
  const [exportEndDate, setExportEndDate] = useState(latestOrderIso);
  const [exportFormat, setExportFormat] = useState("csv");
  // Export level: one row per customer order, per company order, or per
  // product line (the original export). Set when the dialog opens.
  const [exportLevel, setExportLevel] = useState<"customer" | "order" | "item">(
    "item",
  );

  // Delivery Date filter: "all", or one expected delivery date among the
  // orders created in the export range. Reset when the dialog opens or
  // the range changes.
  const [exportDeliveryDate, setExportDeliveryDate] = useState("all");
  const inExportRange = (o: Order) => {
    const d = new Date(o.orderDate);
    return d >= new Date(exportStartDate) && d <= new Date(exportEndDate);
  };
  const exportDeliveryOptions = (() => {
    if (!exportStartDate || !exportEndDate) return [];
    const counts = new Map<string, number>();
    for (const o of orders) {
      if (inExportRange(o)) {
        counts.set(o.expectedDeliveryDate, (counts.get(o.expectedDeliveryDate) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

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

  // Calculate summary statistics
  // In the Customer-wise view each tab counts customer checkouts
  // (distinct checkout references), not company orders.
  const summary = useMemo(() => {
    const count = (list: Order[]) =>
      orderView === "customer"
        ? new Set(list.map(getCustomerOrderId)).size
        : list.length;
    return {
      all: count(orders),
      new: count(orders.filter((o) => o.status === "New")),
      confirmed: count(
        orders.filter((o) => o.status === "Confirmed" && isSellerActionable(o)),
      ),
      logistics: count(orders.filter(isWithLogisticsPartner)),
      delivered: count(orders.filter((o) => o.status === "Delivered")),
      cancelled: count(orders.filter((o) => o.status === "Cancelled")),
    };
  }, [orders, orderView]);

  // Get orders for active tab
  const getTabOrders = (tab: TabType): Order[] => {
    const statusMap: Record<
      Exclude<TabType, "all" | "logistics">,
      Order["status"]
    > = {
      new: "New",
      confirmed: "Confirmed",
      delivered: "Delivered",
      cancelled: "Cancelled",
    };

    return orders.filter((order) => {
      // "all" bypasses the status filter; "logistics" is keyed off the
      // hand-off flag rather than a status, since those rows are still
      // Confirmed underneath.
      const matchesStatus =
        tab === "all"
          ? true
          : tab === "logistics"
            ? isWithLogisticsPartner(order)
            : order.status === statusMap[tab];
      // Orders out with the 3PL partner leave the seller's Confirmed
      // working list — they live in the Logistics tab instead. They
      // stay visible on "All" so the seller can still find an order by
      // id without hunting.
      const matchesLogisticsHandoff =
        tab === "confirmed" ? isSellerActionable(order) : true;
      const matchesSearch =
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.retailerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMarketplace =
        marketplaceFilter === "all" || order.marketplace === marketplaceFilter;
      const matchesCompany =
        selectedCompanyFilters.length === 0 || selectedCompanyFilters.includes(order.company);
      const matchesStatusFilter =
        selectedStatusFilters.length === 0 || selectedStatusFilters.includes(order.status);

      let matchesDate = true;
      if (startDate && endDate) {
        const orderDate = new Date(order.orderDate);
        const start = new Date(startDate);
        const end = new Date(endDate);
        matchesDate = orderDate >= start && orderDate <= end;
      }

      // Delivery Day pill + Beat/Non-Beat sub-navigation. Same shape
      // on the New, Confirmed and 3PL Logistics tabs — the seller
      // plans new arrivals, their own deliveries and the partner's
      // deliveries the same way (which day? which route?), so the
      // filters mirror across all three. "all" on either dimension is
      // a pass-through.
      let matchesConfirmedSub = true;
      if (tab === "confirmed" || tab === "new" || tab === "logistics") {
        if (confirmedDeliveryDay !== "all") {
          matchesConfirmedSub =
            matchesConfirmedSub &&
            order.expectedDeliveryDate === confirmedDeliveryDay;
        }
        if (confirmedBeatMode !== "all") {
          const beat = isBeatOrder(order);
          matchesConfirmedSub =
            matchesConfirmedSub &&
            (confirmedBeatMode === "beat" ? beat : !beat);
        }
      }

      // Cancelled-By quick filter — only applies on the Cancelled tab.
      // Off-tab the filter is ignored so switching tabs doesn't accidentally
      // mask non-cancelled orders.
      let matchesCancelledBy = true;
      if (tab === "cancelled" && cancelledByFilter !== "all") {
        // Treat legacy / un-stamped cancellations as seller-initiated
        // — that's where the existing seed orders came from.
        const who = order.cancelledBy ?? "Seller";
        matchesCancelledBy = who === cancelledByFilter;
      }

      return (
        matchesStatus &&
        matchesLogisticsHandoff &&
        matchesSearch &&
        matchesMarketplace &&
        matchesCompany &&
        matchesStatusFilter &&
        matchesDate &&
        matchesConfirmedSub &&
        matchesCancelledBy
      );
    });
  };

  const currentTabOrders = useMemo(
    () => getTabOrders(activeTab),
    [
      activeTab,
      confirmedDeliveryDay,
      confirmedBeatMode,
      orders,
      searchQuery,
      marketplaceFilter,
      selectedCompanyFilters,
      selectedStatusFilters,
      startDate,
      endDate,
      cancelledByFilter,
    ],
  );

  // Counts for the Delivery Day + Beat/Non-Beat sub-navigation. The
  // same shape is rendered on both the New and the Confirmed tabs,
  // so the compute is factored into a helper and called twice —
  // once filtered to "New", once to "Confirmed". We expose:
  //   - dayBuckets: one entry per distinct expectedDeliveryDate
  //     with how many orders sit on that day (ignoring the active
  //     day filter so the pill row stays steady when the user hops
  //     between days).
  //   - beat / nonBeat: how many Beat vs Non-Beat orders sit inside
  //     the currently-selected day (or across all days when day ===
  //     "all").
  //
  // Both run off the same base filter so a search / marketplace /
  // brand filter is reflected in the counts the user sees on the
  // pills + tabs.
  // `scope` picks the tab's population. It takes a predicate rather
  // than a status because the 3PL Logistics tab isn't status-backed —
  // those rows are Confirmed underneath and are selected on
  // `logisticsRequested` instead.
  const buildBucketCounts = (scope: (order: Order) => boolean) => {
    const base = orders.filter((o) => {
      if (!scope(o)) return false;
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.retailerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMarketplace =
        marketplaceFilter === "all" || o.marketplace === marketplaceFilter;
      const matchesCompany =
        selectedCompanyFilters.length === 0 ||
        selectedCompanyFilters.includes(o.company);
      return matchesSearch && matchesMarketplace && matchesCompany;
    });

    const dayMap = new Map<string, number>();
    for (const o of base) {
      dayMap.set(
        o.expectedDeliveryDate,
        (dayMap.get(o.expectedDeliveryDate) ?? 0) + 1,
      );
    }
    const dayBuckets = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const scopedToDay =
      confirmedDeliveryDay === "all"
        ? base
        : base.filter(
            (o) => o.expectedDeliveryDate === confirmedDeliveryDay,
          );

    return {
      all: base.length,
      dayBuckets,
      beat: scopedToDay.filter(isBeatOrder).length,
      nonBeat: scopedToDay.filter((o) => !isBeatOrder(o)).length,
    };
  };

  // Keeps the day + Beat/Non-Beat pill counts in step with the rows
  // the seller can actually see — an order out with the 3PL partner
  // shouldn't inflate a day pill the seller can't action.
  const confirmedBucketCounts = useMemo(
    () =>
      buildBucketCounts(
        (o) => o.status === "Confirmed" && isSellerActionable(o),
      ),
    [
      orders,
      searchQuery,
      marketplaceFilter,
      selectedCompanyFilters,
      confirmedDeliveryDay,
    ],
  );

  // Same two chip rows as Confirmed, scoped to what the partner is
  // carrying. The planning question doesn't change just because
  // someone else is driving: which day is this going out, and is it
  // riding a beat?
  const logisticsBucketCounts = useMemo(
    () => buildBucketCounts(isWithLogisticsPartner),
    [
      orders,
      searchQuery,
      marketplaceFilter,
      selectedCompanyFilters,
      confirmedDeliveryDay,
    ],
  );

  const newBucketCounts = useMemo(
    () => buildBucketCounts((o) => o.status === "New"),
    [
      orders,
      searchQuery,
      marketplaceFilter,
      selectedCompanyFilters,
      confirmedDeliveryDay,
    ],
  );

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

  // ── Feature 9 — Order Status Update Enforcement (hard restriction) ──
  // While any New order is older than the nudge age, fresh New orders
  // are masked and can't be confirmed until every one of those older
  // orders is confirmed or cancelled.
  const [isGatePopupOpen, setIsGatePopupOpen] = useState(false);
  const [gateSelection, setGateSelection] = useState<string[]>([]);

  const attentionItems = useMemo(
    () => getAttentionOrders(orders),
    [orders],
  );
  const attentionIds = useMemo(
    () => new Set(attentionItems.map((i) => i.order.id)),
    [attentionItems],
  );
  const gateActive = attentionItems.length > 0;
  // Fresh incoming orders: New, but not themselves part of the backlog.
  const isMaskedOrder = (o: Order) =>
    gateActive && o.status === "New" && !attentionIds.has(o.id);
  const maskedCount = gateActive
    ? orders.filter((o) => isMaskedOrder(o)).length
    : 0;
  // Selection survives only for orders still in the backlog.
  const gateSelectedIds = gateSelection.filter((id) => attentionIds.has(id));
  const oldestOverdue = attentionItems[0]?.overdueDays ?? 0;
  // The gate pop-ups keep showing the last real numbers while they
  // fade out, instead of flashing "0 orders" once the backlog clears.
  const gateSnapRef = useRef({
    items: attentionItems,
    masked: maskedCount,
    oldest: oldestOverdue,
    selected: 0,
  });
  if (gateActive) {
    gateSnapRef.current = {
      items: attentionItems,
      masked: maskedCount,
      oldest: oldestOverdue,
      selected: gateSelectedIds.length || gateSnapRef.current.selected,
    };
  }
  const gateView = gateSnapRef.current;
  // Open the pop-up each time the seller lands on New while gated.
  // Deferred slightly so the tab click's focus change can't dismiss it.
  useEffect(() => {
    if (activeTab !== "new" || !gateActive) return;
    const t = setTimeout(() => setIsGatePopupOpen(true), 150);
    return () => clearTimeout(t);
  }, [activeTab, gateActive]);

  // Simple Yes/No confirm for the pop-up's multi-select (no review
  // dialog, same as the portal's quick confirm).
  const [isGateConfirmOpen, setIsGateConfirmOpen] = useState(false);
  const handleGateConfirm = () => {
    const ids = new Set(gateSelectedIds);
    if (ids.size === 0) return;
    setOrders((prev) =>
      prev.map((o) =>
        ids.has(o.id) ? { ...o, status: "Confirmed" as const } : o,
      ),
    );
    toast.success(
      `Confirmed ${ids.size} order${ids.size === 1 ? "" : "s"}.`,
    );
    setGateSelection([]);
    setIsGateConfirmOpen(false);
    // The seller just worked the backlog from the gate pop-up, so the
    // daily soft nudge would only repeat it.
    dismissStaleNudgePopup();
  };

  // Counts for the Cancelled tab's "Cancelled By" quick filter.
  // Counts respect the search box + global filters, but not the
  // cancelled-by chip itself, so each chip always shows the size
  // of the bucket the seller would land on if they clicked it.
  const cancelledByCounts = useMemo(() => {
    const baseCancelled = orders.filter((o) => {
      if (o.status !== "Cancelled") return false;
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.retailerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMarketplace =
        marketplaceFilter === "all" || o.marketplace === marketplaceFilter;
      const matchesCompany =
        selectedCompanyFilters.length === 0 ||
        selectedCompanyFilters.includes(o.company);
      return matchesSearch && matchesMarketplace && matchesCompany;
    });
    const isBuyer = (o: Order) => (o.cancelledBy ?? "Seller") === "Buyer";
    // Customer Wise View counts customer orders, like the rows and tabs.
    const count = (list: Order[]) =>
      orderView === "customer"
        ? new Set(list.map(getCustomerOrderId)).size
        : list.length;
    return {
      all: count(baseCancelled),
      buyer: count(baseCancelled.filter(isBuyer)),
      seller: count(baseCancelled.filter((o) => !isBuyer(o))),
    };
  }, [orders, searchQuery, marketplaceFilter, selectedCompanyFilters, orderView]);

  // Handle select all for current tab
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(
        currentTabOrders.filter((o) => !isMaskedOrder(o)).map((o) => o.id),
      );
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
    // Reset the Delivery Day + Beat/Non-Beat sub-navigation whenever
    // we leave New, Confirmed or 3PL Logistics (the tabs that host
    // the filters), so a fresh visit always lands on "All days / All
    // orders".
    if (tab !== "confirmed" && tab !== "new" && tab !== "logistics") {
      setConfirmedDeliveryDay("all");
      setConfirmedBeatMode("all");
    }
    // Same idea for the Cancelled tab's "Cancelled By" quick filter
    // — reset on the way out so it doesn't quietly persist.
    if (tab !== "cancelled") setCancelledByFilter("all");
  };

  const handleConfirmedDayChange = (day: string) => {
    setConfirmedDeliveryDay(day);
    setSelectedOrders([]);
    setCurrentPage(1);
  };

  const handleConfirmedBeatModeChange = (mode: "all" | "beat" | "non-beat") => {
    setConfirmedBeatMode(mode);
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

  // Customer-wise view: the current tab's (filtered) company orders
  // grouped by checkout, paginated by checkout.
  const checkoutGroups = useMemo(
    () => groupOrdersByCheckout(currentTabOrders),
    [currentTabOrders],
  );
  const paginatedCheckouts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return checkoutGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [checkoutGroups, currentPage, itemsPerPage]);
  const listTotal =
    orderView === "customer" ? checkoutGroups.length : currentTabOrders.length;
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
      orders: listTotal,
      value,
    };
  }, [currentTabOrders, listTotal]);

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
  };

  const hasActiveFilters =
    searchQuery ||
    marketplaceFilter !== "all" ||
    selectedCompanyFilters.length > 0 ||
    selectedStatusFilters.length > 0 ||
    startDate ||
    endDate;

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

  // ---- Customer level / Order level exports ----
  // Order level: one row per company order with only what the seller
  // needs. Customer level is the Retailer-wise Order Summary below; Item
  // level is the original export.
  const stageLabel = (o: Order) => {
    const st = getCustomerOrderStage(o);
    return st === "logistics" ? "With 3PL Partner" : CUSTOMER_ORDER_STAGES[st].label;
  };
  const orderTypeLabel = (o: Order) =>
    getOrderType(o) === "beat" ? "Beat" : "Non-Beat";

  const buildOrderLevelSheet = (list: Order[]) => {
    const headers = [
      "Order ID",
      "Order Date",
      "Delivery Date",
      "Business Name",
      "Mobile",
      "Company",
      "Retailer Company ID",
      "Order Type",
      "Beat Name",
      "Items",
      "Order Value",
      "Status",
      "Cancellation Reason",
      "Payment Mode",
    ];
    const rows = list.map((o) => [
      o.id,
      o.orderDate,
      o.expectedDeliveryDate,
      o.retailerName,
      o.buyerContact ?? "",
      getOrderOperationMode(o) === "wholesale" ? "Wholesaler" : o.company,
      getRetailerCompanyId(o) ?? "",
      orderTypeLabel(o),
      o.beatName ?? "",
      getOrderLines(o).length,
      o.orderValue,
      stageLabel(o),
      o.status === "Cancelled" ? o.cancellationReason ?? "" : "",
      o.paymentMode,
    ]);
    return { headers, rows, moneyCols: [10], records: rows.length };
  };

  // PDF — landscape table with a title line; A4, or A3 for the wide
  // Item level sheet. Amounts are written as plain numbers: the built-in
  // PDF fonts have no rupee sign.
  const PDF_ONE_LINE = new Set([
    "Order ID",
    "Order Date",
    "Delivery Date",
    "Mobile",
    "Retailer Company ID",
    "Order Type",
    "Company Orders",
    "Items",
    "Order Value",
    "Customer Order Value",
    "Payment Mode",
  ]);
  const downloadPdf = async (
    title: string,
    headers: string[],
    rows: (string | number)[][],
    moneyCols: number[],
    fileName: string,
    range: { start: string; end: string },
    delivery: string,
  ) => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const wide = headers.length > 20;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: wide ? "a3" : "a4" });
    doc.setFontSize(13);
    doc.text(title, 28, 32);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    doc.text(`Delivery Date: ${delivery}`, 28, 49);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90);
    doc.text(
      `${SELLER_INFO.name}  |  Orders created ${range.start} to ${range.end}  |  ${rows.length} row${rows.length === 1 ? "" : "s"}  |  Amounts in Rs`,
      28,
      63,
    );
    const money = (n: number) =>
      n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    autoTable(doc, {
      head: [headers],
      body: rows.map((r) =>
        r.map((v, i) =>
          moneyCols.includes(i) && typeof v === "number" ? money(v) : String(v ?? ""),
        ),
      ),
      startY: 72,
      margin: { left: 20, right: 20 },
      styles: {
        fontSize: wide ? 6 : headers.length > 13 ? 6.5 : 7.5,
        cellPadding: 2.5,
        overflow: "linebreak",
      },
      headStyles: { fillColor: [241, 243, 247], textColor: [31, 41, 55], fontStyle: "bold", lineColor: [220, 224, 230], lineWidth: 0.4 },
      bodyStyles: { textColor: [55, 65, 81], lineColor: [229, 231, 235], lineWidth: 0.3 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      // Short fields stay on one line so only long text (names,
      // addresses, companies, status) wraps. The wide Item level sheet
      // lets every column wrap to fit the page.
      columnStyles: Object.fromEntries(
        headers.map((h, i) => [
          i,
          {
            ...(moneyCols.includes(i) ? { halign: "right" as const } : {}),
            ...(!wide && PDF_ONE_LINE.has(h) ? { cellWidth: "wrap" as const } : {}),
          },
        ]),
      ),
    });
    doc.save(fileName);
  };

  // ---- Customer level: Retailer-wise Order Summary ----
  // Each retailer (customer order) is its own section. The top table
  // holds the retailer's static details (contact, location, totals); the
  // table below holds everything that belongs to an order or a line —
  // each company order's Order ID, Status, dates, company and Retailer
  // Company ID (merged across that order's lines), then its SKUs — and a
  // retailer total; a grand total closes the file. Same layout in Excel
  // and PDF; CSV gets the same fields as one flat row per product line.
  const RETAILER_LINE_COLS = [
    "Order ID",
    "Status",
    "Created Date",
    "Delivery Date",
    "Company",
    "Retailer Company ID",
    "SKU Name",
    "QTY",
    "Unit MRP (₹)",
    "Unit Selling Price (₹)",
    "Line Subtotal (₹)",
  ];
  // Columns that belong to the company order (merged across its lines).
  const ORDER_COLS = 6;

  const shortDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const mon = d.toLocaleString("en-US", { month: "short" });
    return `${String(d.getDate()).padStart(2, "0")}-${mon}-${d.getFullYear()}`;
  };
  // Locality from the address — the part before the city.
  const areaOf = (address?: string) => {
    const parts = (address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    parts.pop(); // state + PIN
    const last = parts[parts.length - 1] ?? "";
    return /^(hyderabad|bengaluru|bangalore|mumbai|pune|chennai|new delhi|delhi)$/i.test(last)
      ? parts[parts.length - 2] ?? last
      : last;
  };
  // The Delivery Date filter as a heading: the chosen date, or the span
  // of delivery dates in the export.
  const deliveryHeading = (list: Order[]) => {
    if (exportDeliveryDate !== "all") return shortDate(exportDeliveryDate);
    const ds = list.map((o) => o.expectedDeliveryDate).sort();
    if (!ds.length) return "All";
    return ds[0] === ds[ds.length - 1]
      ? shortDate(ds[0])
      : `All (${shortDate(ds[0])} to ${shortDate(ds[ds.length - 1])})`;
  };
  const deliverySuffix = () =>
    exportDeliveryDate === "all" ? "" : `_delivery_${exportDeliveryDate}`;
  const mobileDigits = (m?: string) => (m ?? "").replace(/\D/g, "").slice(-10);
  const mapsUrl = (o: Order) =>
    typeof o.buyerLat === "number" && typeof o.buyerLng === "number"
      ? `https://www.google.com/maps?q=${o.buyerLat},${o.buyerLng}`
      : "";
  // Product lines with any seller quantity edits applied, so the lines
  // add up to the order value.
  const linesWithEdits = (o: Order): OrderLineItem[] =>
    getOrderLines(o).map((l) => {
      const mod = o.qtyModifications?.[l.skuCode];
      return mod
        ? {
            ...l,
            qty: mod.modifiedQty,
            finalPricePerUnit: mod.pricePerUnit,
            lineTotal: Math.round(mod.modifiedQty * mod.pricePerUnit * 100) / 100,
          }
        : l;
    });
  const round2 = (n: number) => Math.round(n * 100) / 100;

  type SectionOrder = {
    orderId: string;
    status: string;
    created: string;
    delivery: string;
    company: string;
    retailerCompanyId: string;
    lines: {
      sku: string;
      qty: number;
      mrp: number;
      price: number;
      subtotal: number;
    }[];
  };
  type RetailerSection = {
    no: number;
    name: string;
    mobile: string;
    area: string;
    address: string;
    latLng: string;
    url: string;
    items: number;
    qty: number;
    value: number;
    orders: SectionOrder[];
  };

  const buildRetailerSections = (list: Order[]) => {
    const sections: RetailerSection[] = groupOrdersByCheckout(list).map((g, gi) => {
      const first = g.orders[0];
      const orders: SectionOrder[] = g.orders.map((o) => ({
        orderId: o.id,
        status: stageLabel(o),
        created: `${shortDate(o.orderDate)}${o.orderTime ? ` ${o.orderTime}` : ""}`,
        delivery: shortDate(o.expectedDeliveryDate),
        company: o.company,
        retailerCompanyId: getRetailerCompanyId(o) ?? "Not available",
        lines: linesWithEdits(o).map((l) => ({
          sku: l.productName,
          qty: l.qty,
          mrp: l.originalPricePerUnit,
          price: l.finalPricePerUnit,
          subtotal: l.lineTotal,
        })),
      }));
      const lines = orders.flatMap((o) => o.lines);
      return {
        no: gi + 1,
        name: first.retailerName,
        mobile: mobileDigits(first.buyerContact),
        area: areaOf(first.buyerAddress),
        address: first.buyerAddress ?? "",
        latLng:
          typeof first.buyerLat === "number" && typeof first.buyerLng === "number"
            ? `${first.buyerLat}, ${first.buyerLng}`
            : "",
        url: mapsUrl(first),
        items: lines.length,
        qty: lines.reduce((n, l) => n + l.qty, 0),
        value: round2(g.orders.reduce((n, o) => n + o.orderValue, 0)),
        orders,
      };
    });
    const totals = {
      retailers: sections.length,
      orders: sections.reduce((n, s) => n + s.orders.length, 0),
      items: sections.reduce((n, s) => n + s.items, 0),
      qty: sections.reduce((n, s) => n + s.qty, 0),
      value: round2(sections.reduce((n, s) => n + s.value, 0)),
    };
    return { sections, totals };
  };

  const saveBlob = (blob: Blob, fileName: string) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRetailerSummary = async (
    list: Order[],
    range: { start: string; end: string },
  ) => {
    const { sections, totals } = buildRetailerSections(list);
    const title = "Retailer-wise Order Summary";
    const base = `orders_customer-level_${range.start}_to_${range.end}${deliverySuffix()}`;
    const delivery = deliveryHeading(list);
    const money = (n: number) =>
      n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const COLS = RETAILER_LINE_COLS.length; // 11
    const QTY_COL = 8; // 1-based
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

    if (exportFormat === "xlsx") {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Retailer Summary");
      const thin = { style: "thin" as const, color: { argb: "FFBFC5D2" } };
      const border = { top: thin, left: thin, bottom: thin, right: thin };
      const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
      const navy = solid("FF1F3864");
      [24, 21, 20, 13, 22, 18, 40, 7, 11, 13, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
      ws.mergeCells(1, 1, 1, COLS);
      ws.getCell(1, 1).value = title;
      ws.getCell(1, 1).font = { bold: true, size: 14 };
      ws.mergeCells(2, 1, 2, COLS);
      ws.getCell(2, 1).value = `Delivery Date: ${delivery}   |   Orders created ${shortDate(range.start)} to ${shortDate(range.end)}`;
      ws.getCell(2, 1).font = { bold: true, size: 12, color: { argb: "FF1F3864" } };
      let r = 4;
      type Val = string | number | { text: string; hyperlink: string };
      // One row of label / value pairs: [label col, value from, value to].
      const kv = (row: number, pairs: [number, number, number, string, Val, string?][]) => {
        for (const [keyCol, from, to, key, val, numFmt] of pairs) {
          const k = ws.getCell(row, keyCol);
          k.value = key;
          k.font = { bold: true, color: { argb: "FF44546A" } };
          k.fill = solid("FFEEF2F8");
          k.border = border;
          k.alignment = { vertical: "middle" };
          if (to > from) ws.mergeCells(row, from, row, to);
          const v = ws.getCell(row, from);
          v.value = val;
          v.border = border;
          v.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
          if (numFmt) v.numFmt = numFmt;
          if (typeof val === "object") v.font = { color: { argb: "FF1155CC" }, underline: true };
        }
      };
      const totalRow = (row: number, label: string, qty: number, value: number, fill: ReturnType<typeof solid>, white: boolean) => {
        ws.mergeCells(row, 1, row, QTY_COL - 1);
        const t = ws.getRow(row);
        t.getCell(1).value = label;
        t.getCell(QTY_COL).value = qty;
        t.getCell(COLS).value = value;
        for (let c = 1; c <= COLS; c++) {
          const cell = t.getCell(c);
          cell.font = { bold: true, ...(white ? { color: { argb: "FFFFFFFF" } } : {}) };
          cell.fill = fill;
          cell.border = border;
          cell.alignment = { vertical: "middle", horizontal: c === QTY_COL ? "center" : c > QTY_COL ? "right" : "left" };
        }
        t.getCell(COLS).numFmt = "#,##0.00";
      };
      for (const s of sections) {
        // Top table — the retailer's static details.
        ws.mergeCells(r, 1, r, COLS);
        const h = ws.getCell(r, 1);
        h.value = `${s.no}. ${s.name}`;
        h.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        h.fill = navy;
        h.alignment = { vertical: "middle" };
        ws.getRow(r).height = 20;
        r++;
        kv(r++, [
          [1, 2, 3, "Mobile", s.mobile],
          [4, 5, 6, "Area", s.area],
          [7, 8, COLS, "Location", s.url ? { text: "Open in Maps", hyperlink: s.url } : "—"],
        ]);
        kv(r++, [
          [1, 2, 6, "Address", s.address],
          [7, 8, COLS, "Latitude, Longitude", s.latLng || "—"],
        ]);
        kv(r++, [
          [1, 2, 3, "No. of Items", s.items],
          [4, 5, 6, "Total QTY", s.qty],
          [7, 8, COLS, "Order Value (₹)", s.value, "#,##0.00"],
        ]);
        // Orders & products — per company order, then its lines.
        const head = ws.getRow(r);
        head.values = RETAILER_LINE_COLS;
        head.eachCell((c) => {
          c.font = { bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = solid("FF2F5597");
          c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          c.border = border;
        });
        r++;
        for (const o of s.orders) {
          const start = r;
          for (const l of o.lines) {
            const row = ws.getRow(r++);
            row.values = [
              o.orderId,
              o.status,
              o.created,
              o.delivery,
              o.company,
              o.retailerCompanyId,
              l.sku,
              l.qty,
              l.mrp,
              l.price,
              l.subtotal,
            ];
            row.eachCell((c, col) => {
              c.border = border;
              c.alignment = {
                vertical: "middle",
                wrapText: true,
                horizontal: col === QTY_COL ? "center" : col > QTY_COL ? "right" : "left",
              };
              if (col > QTY_COL) c.numFmt = "#,##0.00";
            });
          }
          if (o.lines.length > 1) {
            for (let c = 1; c <= ORDER_COLS; c++) ws.mergeCells(start, c, r - 1, c);
          }
        }
        totalRow(r, `Retailer total — ${plural(s.orders.length, "order")}, ${plural(s.items, "item")}`, s.qty, s.value, solid("FFDCE6F1"), false);
        r += 2;
      }
      totalRow(
        r,
        `GRAND TOTAL — ${totals.retailers} retailers, ${totals.orders} orders, ${totals.items} items`,
        totals.qty,
        totals.value,
        navy,
        true,
      );
      const buf = await wb.xlsx.writeBuffer();
      saveBlob(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${base}.xlsx`,
      );
    } else if (exportFormat === "pdf") {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
      const pageH = doc.internal.pageSize.getHeight();
      const margin = { left: 28, right: 28 };
      // Light, print-friendly palette: soft grey fills, dark grey text and
      // one muted blue accent for the retailer name and links.
      const ink: [number, number, number] = [31, 41, 55];
      const muted: [number, number, number] = [107, 114, 128];
      const accent: [number, number, number] = [37, 99, 235];
      const rule: [number, number, number] = [226, 232, 240];
      const headFill: [number, number, number] = [241, 245, 249];
      const labelFill: [number, number, number] = [248, 250, 252];
      const link = accent;
      const lastY = () =>
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(title, margin.left, 36);
      // Delivery Date heading, so the reader knows what the file covers.
      doc.setFontSize(12.5);
      doc.setTextColor(...ink);
      doc.text(`Delivery Date: ${delivery}`, margin.left, 56);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(
        `Orders created ${shortDate(range.start)} to ${shortDate(range.end)}  |  ${totals.retailers} retailers, ${totals.orders} orders  |  Amounts in Rs`,
        margin.left,
        71,
      );
      doc.setTextColor(0);
      let y = 84;
      const lbl = (content: string) => ({
        content,
        styles: { fontStyle: "bold" as const, fillColor: labelFill, textColor: muted },
      });
      for (const s of sections) {
        // Start a retailer on a new page when the whole section won't fit
        // (unless it is longer than a page anyway), and never leave a
        // heading alone at the bottom of a page.
        const needed = 90 + (s.items + 2) * 16;
        if ((y + needed > pageH - 30 && needed < pageH - 80) || y > pageH - 160) {
          doc.addPage();
          y = 36;
        }
        // Top table — the retailer's static details.
        autoTable(doc, {
          startY: y,
          margin,
          theme: "grid",
          styles: { fontSize: 8.5, cellPadding: 4, textColor: ink, lineColor: rule, lineWidth: 0.4, valign: "middle" },
          head: [[{ content: `${s.no}. ${s.name}`, colSpan: 6, styles: { fillColor: [255, 255, 255], textColor: accent, fontSize: 11.5, fontStyle: "bold", cellPadding: { top: 6, bottom: 5, left: 4, right: 4 } } }]],
          body: [
            [lbl("Mobile"), s.mobile, lbl("Area"), s.area, lbl("Location"), { content: s.url ? "Open in Maps" : "-", styles: s.url ? { textColor: link } : {} }],
            [lbl("Address"), { content: s.address, colSpan: 3 }, lbl("Latitude, Longitude"), s.latLng || "-"],
            [lbl("No. of Items"), String(s.items), lbl("Total QTY"), String(s.qty), lbl("Order Value (Rs)"), money(s.value)],
          ],
          columnStyles: { 0: { cellWidth: 90 }, 2: { cellWidth: 90 }, 4: { cellWidth: 110 } },
          didDrawCell: (data) => {
            if (data.section === "body" && data.row.index === 0 && data.column.index === 5 && s.url) {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: s.url });
            }
          },
        });
        // Orders & products — order cells span the order's lines.
        const body = s.orders.flatMap((o) =>
          o.lines.map((l, li) => [
            ...(li === 0
              ? [o.orderId, o.status, o.created, o.delivery, o.company, o.retailerCompanyId].map((v) => ({
                  content: v,
                  rowSpan: o.lines.length,
                }))
              : []),
            l.sku,
            String(l.qty),
            money(l.mrp),
            money(l.price),
            money(l.subtotal),
          ]),
        );
        autoTable(doc, {
          startY: lastY(),
          margin,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 3.5, textColor: ink, lineColor: rule, lineWidth: 0.4, valign: "middle" },
          headStyles: { fillColor: headFill, textColor: ink, fontStyle: "bold", halign: "center" },
          head: [RETAILER_LINE_COLS.map((c) => c.replace("(₹)", "(Rs)"))],
          body,
          foot: [[
            { content: `Retailer total - ${plural(s.orders.length, "order")}, ${plural(s.items, "item")}`, colSpan: 7 },
            String(s.qty),
            "",
            "",
            money(s.value),
          ]],
          footStyles: { fillColor: headFill, textColor: ink, fontStyle: "bold" },
          showFoot: "lastPage",
          columnStyles: {
            0: { cellWidth: 118 },
            1: { cellWidth: 100 },
            2: { cellWidth: 98 },
            3: { cellWidth: 64 },
            4: { cellWidth: 118 },
            5: { cellWidth: 84 },
            7: { halign: "center", cellWidth: 32 },
            8: { halign: "right", cellWidth: 60 },
            9: { halign: "right", cellWidth: 72 },
            10: { halign: "right", cellWidth: 74 },
          },
          didParseCell: (data) => {
            if (data.section === "foot" && data.column.index >= 7) {
              data.cell.styles.halign = data.column.index === 7 ? "center" : "right";
            }
          },
        });
        y = lastY() + 18;
      }
      if (y > pageH - 50) {
        doc.addPage();
        y = 36;
      }
      autoTable(doc, {
        startY: y,
        margin,
        theme: "grid",
        styles: { fontSize: 9.5, cellPadding: 5, fontStyle: "bold", fillColor: [239, 246, 255], textColor: ink, lineColor: [191, 219, 254], lineWidth: 0.6 },
        body: [[
          { content: `GRAND TOTAL - ${totals.retailers} retailers, ${totals.orders} orders, ${totals.items} items`, colSpan: 3 },
          { content: `QTY ${totals.qty}`, styles: { halign: "center" } },
          { content: `Rs ${money(totals.value)}`, styles: { halign: "right" } },
        ]],
      });
      doc.save(`${base}.pdf`);
    } else {
      // Same fields, flat: the retailer's details repeat on each line.
      const headers = [
        "S.No",
        "Buyer Name",
        "Buyer Mobile",
        "Area",
        "Retailer Address",
        "Latitude, Longitude",
        "GPS Location",
        "No. of Items",
        "Total QTY",
        "Order Value (₹)",
        ...RETAILER_LINE_COLS,
      ];
      const rows = sections.flatMap((s) =>
        s.orders.flatMap((o) =>
          o.lines.map((l) => [
            s.no,
            s.name,
            s.mobile,
            s.area,
            s.address,
            s.latLng,
            s.url,
            s.items,
            s.qty,
            s.value,
            o.orderId,
            o.status,
            o.created,
            o.delivery,
            o.company,
            o.retailerCompanyId,
            l.sku,
            l.qty,
            l.mrp,
            l.price,
            l.subtotal,
          ]),
        ),
      );
      const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
      saveBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), `${base}.csv`);
    }
    toast.success(
      `Successfully exported ${sections.length} customer order(s) (${list.length} company orders) from ${range.start} to ${range.end}`,
    );
    setIsExportDialogOpen(false);
  };

  const exportLevelSheet = (
    level: "customer" | "order",
    list: Order[],
    range: { start: string; end: string },
  ) => {
    if (level === "customer") {
      exportRetailerSummary(list, range).catch(() =>
        toast.error("Could not create the export. Please try again."),
      );
      return;
    }
    const { headers, rows, moneyCols, records } = buildOrderLevelSheet(list);
    const base = `orders_${level}-level_${range.start}_to_${range.end}${deliverySuffix()}`;
    const what =
      level === "customer"
        ? `${records} customer order(s) (${list.length} company orders)`
        : `${records} order(s)`;
    const done = () => {
      toast.success(`Successfully exported ${what} from ${range.start} to ${range.end}`);
      setIsExportDialogOpen(false);
    };
    if (exportFormat === "pdf") {
      downloadPdf(
        `Orders - ${level === "customer" ? "Customer" : "Order"} level`,
        headers,
        rows,
        moneyCols,
        `${base}.pdf`,
        range,
        deliveryHeading(list),
      )
        .then(done)
        .catch(() => toast.error("Could not create the PDF. Please try again."));
      return;
    }
    // CSV, and Excel the same way as the original export.
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${base}.${exportFormat}`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    done();
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

    // Filter orders by export date range, then by the Delivery Date filter
    const ordersToExport = orders.filter((order) => {
      const orderDate = new Date(order.orderDate);
      return (
        orderDate >= start &&
        orderDate <= end &&
        (exportDeliveryDate === "all" || order.expectedDeliveryDate === exportDeliveryDate)
      );
    });

    if (ordersToExport.length === 0) {
      toast.error(
        exportDeliveryDate === "all"
          ? "No orders found in the selected date range"
          : "No orders found for the selected delivery date",
      );
      return;
    }

    if (exportLevel !== "item") {
      exportLevelSheet(exportLevel, ordersToExport, range);
      return;
    }

    // 27-column layout (SKU code removed) — one row per line item; order-level fields
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
    // list. Same in both views.
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
    const pdfRows: (string | number)[][] = [];

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
          order.originalOrderValue ?? order.orderValue,
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
        pdfRows.push(row);
      });
    });

    if (exportFormat === "pdf") {
      downloadPdf(
        "Orders - Item level",
        headers,
        pdfRows,
        [],
        `orders_${range.start}_to_${range.end}${deliverySuffix()}.pdf`,
        range,
        deliveryHeading(ordersToExport),
      )
        .then(() => {
          toast.success(
            `Successfully exported ${ordersToExport.length} order(s) from ${range.start} to ${range.end}`,
          );
          setIsExportDialogOpen(false);
        })
        .catch(() => toast.error("Could not create the PDF. Please try again."));
      return;
    }

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
      `orders_${range.start}_to_${range.end}${deliverySuffix()}.${exportFormat}`,
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

  const maskedText = "••••••••";

  // "Wed, 13 May": weekday + date, rendered in UTC so it matches the
  // ISO string whatever the viewer's timezone is.
  const gateDate = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

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
                    {isMaskedOrder(order) ? (
                      <Lock className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOrder(order.id, checked as boolean)
                        }
                      />
                    )}
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
                      {getPendingAgeDays(order)}d pending
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
                    title={isMaskedOrder(order) ? undefined : order.company}
                  >
                    {isMaskedOrder(order) ? maskedText : order.company}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  {isMaskedOrder(order) ? (
                    <p className="text-sm text-gray-400 select-none">
                      {maskedText}
                    </p>
                  ) : (
                  <CopyOnHover value={order.retailerName} label="Business name">
                    <p
                      className="text-sm font-medium text-gray-900 truncate max-w-[160px]"
                      title={order.retailerName}
                    >
                      {order.retailerName}
                    </p>
                  </CopyOnHover>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {isMaskedOrder(order) ? (
                    <p className="text-xs text-gray-400 select-none">
                      {maskedText}
                    </p>
                  ) : order.buyerContact ? (
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
                  <p
                    className={`text-sm font-semibold tabular-nums ${isMaskedOrder(order) ? "text-gray-400 select-none" : "text-gray-900"}`}
                  >
                    {isMaskedOrder(order)
                      ? "₹ ••••"
                      : `₹${order.orderValue.toFixed(2)}`}
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
                    {isMaskedOrder(order) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled
                        title="Locked. Update your previous orders to view this order"
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/orders/${order.id}?view=company`)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Customer-wise view — one row per customer checkout. The company
  // orders of a checkout (those that match the current tab + filters)
  // fold into a single row; the row opens the consolidated Customer
  // Order page, which links on to each company order for billing and
  // fulfilment. A checkout is locked while any of its company orders
  // is masked by the status-update gate.
  // ---- Customer order status (Customer Wise View) ----
  // A customer order whose company orders are in different states shows
  // a "Partially …" badge and a breakdown on every tab it appears in —
  // see getMixedCustomerOrderStatus.
  // Every company order of each customer order, whatever tab is open.
  const checkoutIndex = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of orders) {
      const k = getCustomerOrderId(o);
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return m;
  }, [orders]);
  const renderCustomerTable = (groups: CustomerCheckout[]) => {
    const isActionable = activeTab === "new" || activeTab === "confirmed";
    const th =
      "text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap";
    const selectableIds = (g: CustomerCheckout) =>
      g.orders.filter((o) => !isMaskedOrder(o)).map((o) => o.id);
    const pageIds = groups.flatMap(selectableIds);
    const allPageSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedOrders.includes(id));

    return (
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              {isActionable && (
                <th className="text-left py-2.5 px-3 w-10">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
              )}
              <th className={th}>Order Date</th>
              <th className={th}>Delivery Date</th>
              <th className={th}>Business Name</th>
              <th className={th}>Mobile</th>
              <th className={th}>Order Type</th>
              <th className={th}>Delivery Address</th>
              <th className={`${th} text-right`}>Items</th>
              <th className={`${th} text-right`}>Order Value</th>
              <th className={th}>Status</th>
              <th className={`${th} text-center`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const first = g.orders[0];
              const locked = g.orders.some(isMaskedOrder);
              const ids = selectableIds(g);
              const checked =
                ids.length > 0 && ids.every((id) => selectedOrders.includes(id));
              const orderDate = g.orders
                .map((o) => o.orderDate)
                .sort()[0];
              const deliveryDates = Array.from(
                new Set(g.orders.map((o) => o.expectedDeliveryDate)),
              ).sort();
              // Beat / Non-Beat — one chip per type present in the
              // customer order.
              const orderTypes = Array.from(
                new Set(g.orders.map((o) => getOrderType(o))),
              );
              const items = g.orders.reduce(
                (n, o) => n + getOrderLines(o).length,
                0,
              );
              const value = g.orders.reduce((n, o) => n + o.orderValue, 0);
              const staleDays = Math.max(
                0,
                ...g.orders
                  .filter(isStalePendingOrder)
                  .map((o) => getPendingAgeDays(o)),
              );
              // One badge per distinct status, so a checkout whose
              // company orders sit in different states says so.
              const statusOrders = Array.from(
                new Map(
                  g.orders.map((o) => [
                    o.status === "Cancelled"
                      ? `Cancelled-${o.cancelledBy ?? "Seller"}`
                      : o.status,
                    o,
                  ]),
                ).values(),
              );
              return (
                <tr
                  key={g.checkoutId}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {isActionable && (
                    <td className="px-3 py-2.5">
                      {locked ? (
                        <Lock className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            setSelectedOrders((prev) =>
                              c
                                ? [...prev, ...ids.filter((id) => !prev.includes(id))]
                                : prev.filter((id) => !ids.includes(id)),
                            )
                          }
                        />
                      )}
                    </td>
                  )}
                  <td
                    className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-700 tabular-nums"
                    title={first.orderTime ? `${orderDate} ${first.orderTime}` : orderDate}
                  >
                    {orderDate}
                    {staleDays > 0 && (
                      <span
                        className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 w-fit"
                        title={`Placed ${staleDays} days ago — please confirm or cancel it before piling on new orders.`}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {staleDays}d pending
                      </span>
                    )}
                  </td>
                  <td
                    className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-700 tabular-nums"
                    title={deliveryDates.join(", ")}
                  >
                    {deliveryDates[0]}
                    {deliveryDates.length > 1 && (
                      <span className="block text-[10px] text-gray-500">
                        +{deliveryDates.length - 1} more date
                        {deliveryDates.length > 2 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {locked ? (
                      <p className="text-sm text-gray-400 select-none">{maskedText}</p>
                    ) : (
                      <CopyOnHover value={first.retailerName} label="Business name">
                        <p
                          className="text-sm font-medium text-gray-900 truncate max-w-[160px]"
                          title={first.retailerName}
                        >
                          {first.retailerName}
                        </p>
                      </CopyOnHover>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {locked ? (
                      <p className="text-xs text-gray-400 select-none">{maskedText}</p>
                    ) : first.buyerContact ? (
                      <CopyOnHover value={first.buyerContact} label="Mobile number">
                        <p className="text-xs text-gray-700 font-mono">
                          {first.buyerContact}
                        </p>
                      </CopyOnHover>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      {orderTypes.map((type) =>
                        type === "beat" ? (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700"
                          >
                            <Route className="h-3 w-3" />
                            Beat
                          </span>
                        ) : (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-[11px] font-medium text-amber-800"
                          >
                            <Zap className="h-3 w-3" />
                            Non-Beat
                          </span>
                        ),
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {locked ? (
                      <p className="text-xs text-gray-400 select-none">{maskedText}</p>
                    ) : first.buyerAddress ? (
                      <p
                        className="text-xs text-gray-700 line-clamp-2 max-w-[220px]"
                        title={first.buyerAddress}
                      >
                        {first.buyerAddress}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right text-sm text-gray-700 tabular-nums">
                    {items}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${locked ? "text-gray-400 select-none" : "text-gray-900"}`}
                    >
                      {locked ? "₹ ••••" : `₹${value.toFixed(2)}`}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {(() => {
                      const all = checkoutIndex.get(g.checkoutId) ?? g.orders;
                      const mixed = getMixedCustomerOrderStatus(all);
                      return (
                        <div className="flex flex-col items-start gap-1">
                          {mixed ? (
                            <Badge className={mixed.badge}>{mixed.label}</Badge>
                          ) : (
                            statusOrders.map((o) => (
                              <span key={o.id}>{getStatusBadge(o)}</span>
                            ))
                          )}
                          {mixed && (
                            <p
                              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-600"
                              title={`Status of all ${all.length} company orders in this customer order`}
                            >
                              <span className="text-gray-500">{all.length} orders:</span>
                              {mixed.parts.map((p) => (
                                <span key={p.stage} className="inline-flex items-center gap-1">
                                  <span className={`h-1.5 w-1.5 rounded-full ${CUSTOMER_ORDER_STAGES[p.stage].dot}`} />
                                  {p.count} {CUSTOMER_ORDER_STAGES[p.stage].label}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      {locked ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          title="Locked. Update your previous orders to view this order"
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            navigate(`/orders/${first.id}?view=customer`)
                          }
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // The list body for the active view. An empty Customer-wise list
  // falls back to the Company-wise empty state (same copy + Clear
  // Filters action).
  const renderOrdersList = () =>
    orderView === "customer" && paginatedCheckouts.length > 0
      ? renderCustomerTable(paginatedCheckouts)
      : renderOrderTable(paginatedOrders);

  // Inception-day: when the seller has no orders at all, hide the
  // Filters / Export CTAs and the pagination footer. Tabs remain
  // visible so the seller can switch between status views and the
  // same full-height Card container is preserved so the layout reads
  // identically to the populated state. The per-tab EmptyState
  // already handles rendering the illustration in each tab body.
  const isEmpty = orders.length === 0;

  // Render helper — the Delivery Day pill row + Beat/Non-Beat tab
  // row, parameterised on a counts object. Same JSX powers the New
  // tab and the Confirmed tab so the surfaces stay in lockstep.
  type BucketCounts = ReturnType<typeof buildBucketCounts>;
  const renderDayAndBeatFilters = (counts: BucketCounts) => (
    <div className="px-6 pt-4 pb-2 border-b flex-shrink-0 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide mr-1">
          Delivery day:
        </span>
        <button
          onClick={() => handleConfirmedDayChange("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            confirmedDeliveryDay === "all"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          All days ({counts.all})
        </button>
        {counts.dayBuckets.map((b) => {
          const isActive = confirmedDeliveryDay === b.date;
          const label = formatDeliveryPillLabel(b.date);
          const today = getOrdersToday();
          const tone =
            b.date === today
              ? isActive
                ? "bg-red-600 text-white border-red-600"
                : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
              : isActive
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100";
          return (
            <button
              key={b.date}
              onClick={() => handleConfirmedDayChange(b.date)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors gap-1.5 inline-flex items-center ${tone}`}
              title={b.date}
            >
              <CalendarDays className="h-3 w-3" />
              {label} ({b.count})
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide mr-1">
          Order type:
        </span>
        <button
          onClick={() => handleConfirmedBeatModeChange("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            confirmedBeatMode === "all"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          All ({counts.beat + counts.nonBeat})
        </button>
        <button
          onClick={() => handleConfirmedBeatModeChange("beat")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors gap-1.5 inline-flex items-center ${
            confirmedBeatMode === "beat"
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
          }`}
        >
          <Route className="h-3 w-3" />
          Beat orders ({counts.beat})
        </button>
        <button
          onClick={() => handleConfirmedBeatModeChange("non-beat")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors gap-1.5 inline-flex items-center ${
            confirmedBeatMode === "non-beat"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
          }`}
        >
          <Zap className="h-3 w-3" />
          Non-beat orders ({counts.nonBeat})
        </button>
      </div>
    </div>
  );

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
                <div className="flex items-center justify-between gap-2 overflow-x-auto">
                  {/* Tab Toggle */}
                  <TabsList className="bg-gray-100 p-1 rounded-lg inline-flex gap-1 h-auto flex-shrink-0">
                    <TabsTrigger
                      value="all"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-2 py-2 transition-all whitespace-nowrap text-[13px]"
                    >
                      <span className="font-medium">All ({summary.all})</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="new"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-2 py-2 transition-all whitespace-nowrap text-[13px]"
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      <span className="font-medium">New ({summary.new})</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="confirmed"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-2 py-2 transition-all whitespace-nowrap text-[13px]"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      <span className="font-medium">Confirmed ({summary.confirmed})</span>
                    </TabsTrigger>
                    {/* Only meaningful once the seller can actually
                        hand orders off, so it's gated on the same flag
                        as the Request 3PL Logistics action. */}
                    {logisticsEnabled && (
                      <TabsTrigger
                        value="logistics"
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-2 py-2 transition-all whitespace-nowrap text-[13px]"
                      >
                        <Truck className="h-4 w-4 mr-1" />
                        <span className="font-medium">Logistics ({summary.logistics})</span>
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="delivered"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-2 py-2 transition-all whitespace-nowrap text-[13px]"
                    >
                      <PackageCheck className="h-4 w-4 mr-1" />
                      <span className="font-medium">Delivered ({summary.delivered})</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="cancelled"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-2 py-2 transition-all whitespace-nowrap text-[13px]"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      <span className="font-medium">Cancelled ({summary.cancelled})</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Action Buttons */}
                  {!isEmpty && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View toggle — "Customer Wise" on the left (default,
                        switch off), "Company Wise" on the right (switch
                        on, the existing list). The active side is
                        highlighted; either label also switches. */}
                    <div className="flex items-center gap-1.5 text-xs whitespace-nowrap select-none">
                      <button
                        type="button"
                        onClick={() => handleOrderViewChange("customer")}
                        className={
                          orderView === "customer"
                            ? "p-0 text-xs font-semibold text-purple-700"
                            : "p-0 text-xs font-medium text-gray-500 hover:text-gray-700"
                        }
                      >
                        Customer Wise
                      </button>
                      <Switch
                        id="orders-company-wise"
                        checked={orderView === "company"}
                        onCheckedChange={(on) =>
                          handleOrderViewChange(on ? "company" : "customer")
                        }
                        aria-label="Switch between Customer Wise and Company Wise view"
                      />
                      <button
                        type="button"
                        onClick={() => handleOrderViewChange("company")}
                        className={
                          orderView === "company"
                            ? "p-0 text-xs font-semibold text-purple-700"
                            : "p-0 text-xs font-medium text-gray-500 hover:text-gray-700"
                        }
                      >
                        Company Wise
                      </button>
                    </div>

                    {/* Filters Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setIsFilterDialogOpen(true)}
                    >
                      <Filter className="h-4 w-4" />
                      Filters
                    </Button>

                    {/* Export Button */}
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setExportLevel("customer");
                        setExportDeliveryDate("all");
                        setIsExportDialogOpen(true);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  )}
                </div>

                {/* Bulk Action Buttons for New Tab */}
                {/* Removed - now beside search bar */}

                {/* Bulk Action Buttons for Confirmed Tab */}
                {/* Removed - now beside search bar */}
              </div>

              {/* Order Summary strip — three figures (Customers,
                  Orders, Total Value) reading off `currentTabOrders`
                  so they react to every active filter. Lets the
                  seller eyeball the business shape of the slice
                  they're looking at without exporting a report. */}
              {!isEmpty && (
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

            {/* Tab Contents */}
            <TabsContent value="all" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {!isEmpty && (
              <div className="px-6 py-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by order ID, retailer name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Table */}
              {renderOrdersList()}
              {!isEmpty && (
              <ListPagination
                page={currentPage}
                total={listTotal}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
                itemLabel="order"
              />
              )}
            </TabsContent>

            <TabsContent value="new" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {!isEmpty && renderDayAndBeatFilters(newBucketCounts)}
              {!isEmpty && (
              <div className="px-6 py-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by order ID, retailer name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Bulk Action Buttons — Confirm / Cancel keep the
                      green/red destructive treatment; View on Map sits
                      first because the seller usually wants to eyeball
                      delivery clustering before they confirm a wave of
                      new orders. */}
                  {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 mr-2">{selectedOrders.length} selected</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-2"
                        onClick={handleViewOnMap}
                      >
                        <MapPin className="h-4 w-4" />
                        View on Map
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                        onClick={() => setIsConfirmDialogOpen(true)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50 gap-2"
                        onClick={() => setIsCancelDialogOpen(true)}
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Feature 9 — hard restriction. The detail lives in a
                  pop-up (see "Order status update required" dialog);
                  this slim strip only lets the seller reopen it. */}
              {!isEmpty && gateActive && (
                <div className="px-6 py-2 border-b bg-red-50/60 flex items-center justify-between gap-3 flex-shrink-0">
                  <p className="text-xs text-red-800 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    {maskedCount} new order{maskedCount === 1 ? "" : "s"}{" "}
                    locked. Update {attentionItems.length} previous order
                    {attentionItems.length === 1 ? "" : "s"} to unlock.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => setIsGatePopupOpen(true)}
                  >
                    Update now
                  </Button>
                </div>
              )}
              {/* Table */}
              {renderOrdersList()}
              {!isEmpty && (
              <ListPagination
                page={currentPage}
                total={listTotal}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
                itemLabel="order"
              />
              )}
            </TabsContent>

            <TabsContent value="confirmed" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {!isEmpty && (
                <>
                  {renderDayAndBeatFilters(confirmedBucketCounts)}

                  <div className="px-6 py-4 border-b flex-shrink-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="relative max-w-md flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search by order ID, retailer name..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Bulk Action Buttons — View on Map (route the
                          day's confirmed deliveries) anchors the row,
                          then the two fulfilment routes, then the
                          destructive Cancel.

                          Fulfilment is a choice, not a mode: a seller
                          with Logistics enabled hands SOME orders to
                          the 3PL network and still delivers the rest
                          themselves, so "Request 3PL Logistics" sits
                          alongside "Mark Delivered" rather than
                          replacing it. */}
                      {selectedOrders.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 mr-2">{selectedOrders.length} selected</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-2"
                            onClick={handleViewOnMap}
                          >
                            <MapPin className="h-4 w-4" />
                            View on Map
                          </Button>
                          {logisticsEnabled && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                              onClick={() => setIsRequestLogisticsDialogOpen(true)}
                            >
                              <Truck className="h-4 w-4" />
                              Request 3PL Logistics
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white gap-2"
                            onClick={() => setIsDeliverDialogOpen(true)}
                          >
                            <PackageCheck className="h-4 w-4" />
                            Mark Delivered
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 gap-2"
                            onClick={() => setIsCancelDialogOpen(true)}
                          >
                            <XCircle className="h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Table */}
              {renderOrdersList()}
            </TabsContent>

            {/* 3PL Logistics — orders handed to the delivery partner.
                Read-only as far as fulfilment goes: the seller can look
                them up and answer a customer's "where is it?", but they
                can't deliver or reschedule an order the partner now
                owns. The one action is the partner-completion callback,
                which in production arrives from the delivery-partner
                app via LBNP rather than from a button here. */}
            <TabsContent value="logistics" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {!isEmpty && renderDayAndBeatFilters(logisticsBucketCounts)}
              <div className="px-6 py-4 border-b flex-shrink-0">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by order ID, retailer name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  These orders are with the logistics partner. They move to Delivered automatically once the delivery partner completes them.
                </p>
              </div>

              {/* Table */}
              {renderOrdersList()}
              {!isEmpty && (
                <ListPagination
                  page={currentPage}
                  total={listTotal}
                  pageSize={itemsPerPage}
                  onPageChange={setCurrentPage}
                  itemLabel="order"
                />
              )}
            </TabsContent>

            <TabsContent value="delivered" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {!isEmpty && (
              <div className="px-6 py-4 border-b flex-shrink-0">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by order ID, retailer name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              )}

              {/* Table */}
              {renderOrdersList()}
            </TabsContent>

            <TabsContent value="cancelled" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {!isEmpty && (
                <>
                  {/* Cancelled-By quick filter — split a flat Cancelled
                      list into who-pulled-the-plug buckets so the
                      seller can audit buyer drop-offs vs their own
                      cancellations in one click. Mirrors the Confirmed
                      tab's delivery-window chips for visual rhythm. */}
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

                  <div className="px-6 py-4 border-b flex-shrink-0">
                    <div className="relative max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by order ID, retailer name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Table */}
              {renderOrdersList()}
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
        open={
          isStaleNudgePopupOpen &&
          !gateActive &&
          stalePendingOrders.length > 0
        }
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
              unconfirmed. Please confirm or cancel them. New-order details stay
              locked until you do.
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
              act on now, then Confirm or Cancel. Anything left
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
                    {getPendingAgeDays(o)}d pending
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

      {/* Confirm Orders Dialog — pure confirmation surface, no
          dispatch metadata captured here. The selection is grouped
          by Delivery Day (the concrete committed date) so the
          distributor can plan packing & dispatch per-day instead of
          via the older Tomorrow / Beyond-Tomorrow relative buckets
          retired in June 2026. */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Confirm Orders
            </DialogTitle>
            <DialogDescription>
              Review the selected orders, grouped by Delivery Day, then
              confirm.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const selectedOrderObjects = orders.filter((o) =>
              selectedOrders.includes(o.id),
            );
            const today = getOrdersToday();
            const eligible = selectedOrderObjects;

            const groupByDay = (rows: Order[]) => {
              const map = new Map<string, Order[]>();
              for (const o of rows) {
                const key = o.expectedDeliveryDate;
                const arr = map.get(key);
                if (arr) arr.push(o);
                else map.set(key, [o]);
              }
              return Array.from(map.entries()).sort(([a], [b]) =>
                a.localeCompare(b),
              );
            };

            const renderRow = (o: Order) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 text-xs bg-white rounded px-2 py-1.5 border border-gray-100"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-gray-900 truncate">
                    {o.retailerName}
                  </span>
                  <span className="text-[10px] text-gray-500">{o.id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap border ${
                      getOrderType(o) === "beat"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {getOrderType(o) === "beat" ? (
                      <Route className="h-3 w-3" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    {getOrderType(o) === "beat" ? "Beat" : "Non-Beat"}
                  </span>
                  <span className="text-[10px] text-gray-600 whitespace-nowrap">
                    ₹{o.orderValue.toLocaleString()}
                  </span>
                </div>
              </li>
            );

            return (
              <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
                {eligible.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Will be confirmed
                      </p>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        {eligible.length}
                      </Badge>
                    </div>
                    {groupByDay(eligible).map(([day, rows]) => {
                      const isToday = day === today;
                      const tone = isToday
                        ? "border-red-200 bg-red-50/60"
                        : "border-blue-200 bg-blue-50/60";
                      const iconTone = isToday
                        ? "text-red-600"
                        : "text-blue-600";
                      return (
                        <div
                          key={day}
                          className={`rounded-md border p-3 ${tone}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <CalendarDays className={`h-4 w-4 ${iconTone}`} />
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDeliveryPillLabel(day)}
                            </p>
                            <Badge
                              variant="secondary"
                              className="bg-white text-gray-700 border border-gray-200"
                            >
                              {rows.length}
                            </Badge>
                          </div>
                          <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                            {rows.map(renderRow)}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}

                {eligible.length === 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>No orders selected.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Soft nudge — VIW-2026-06911. Doesn't block this confirm;
              just flags older orders left behind so the seller can
              fold them into the same batch. */}
          {(() => {
            const leftBehind = stalePendingOrders.filter(
              (o) => !selectedOrders.includes(o.id),
            );
            if (leftBehind.length === 0) return null;
            return (
              <div className="flex items-start gap-2 p-2.5 rounded border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p className="flex-1">
                  You also have {leftBehind.length} order
                  {leftBehind.length === 1 ? "" : "s"} pending for more than{" "}
                  {STALE_PENDING_NUDGE_DAYS} days that {leftBehind.length === 1 ? "isn't" : "aren't"} in
                  this batch. Consider confirming{" "}
                  {leftBehind.length === 1 ? "it" : "them"} too.
                </p>
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            {(() => {
              const count = selectedOrders.length;
              return (
                <Button
                  onClick={handleConfirmOrders}
                  disabled={count === 0}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {count === 0
                    ? "Nothing to confirm"
                    : `Confirm ${count} order${count === 1 ? "" : "s"}`}
                </Button>
              );
            })()}
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

      {/* Feature 9 — hard-restriction pop-up. Opens when the seller
          lands on New with a serious backlog. Closing it keeps the
          new orders masked; "Update now" on the strip reopens it. */}
      <Dialog
        open={isGatePopupOpen && gateActive}
        onOpenChange={setIsGatePopupOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-600" />
              Update {gateView.items.length} previous order
              {gateView.items.length === 1 ? "" : "s"} to unlock{" "}
              {gateView.masked} new order{gateView.masked === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Confirm or cancel these to unlock the new orders. Your oldest is{" "}
              {gateView.oldest} days old.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2 px-1">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <Checkbox
                checked={
                  gateView.items.length > 0 &&
                  gateSelectedIds.length === gateView.items.length
                }
                onCheckedChange={(checked) =>
                  setGateSelection(
                    checked ? gateView.items.map((i) => i.order.id) : [],
                  )
                }
              />
              Select all
              {gateSelectedIds.length > 0 && (
                <span className="text-gray-500">
                  ({gateSelectedIds.length} selected)
                </span>
              )}
            </label>
          </div>
          <div className="max-h-[322px] overflow-auto rounded-md border divide-y">
            {gateView.items.map(({ order, overdueDays }) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-3 px-3 py-1.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={gateSelectedIds.includes(order.id)}
                    onCheckedChange={(checked) =>
                      setGateSelection((prev) =>
                        checked
                          ? [...prev.filter((id) => id !== order.id), order.id]
                          : prev.filter((id) => id !== order.id),
                      )
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {order.retailerName}
                      <span className="ml-2 text-xs font-normal text-gray-500 font-mono">
                        {order.buyerContact ?? "No mobile"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-700">
                      Ordered {gateDate(order.orderDate)}
                      <span className="mx-1.5 text-gray-300">|</span>
                      <span className="font-semibold">
                        ₹{order.orderValue.toLocaleString("en-IN")}
                      </span>
                      <span className="mx-1.5 text-gray-300">|</span>
                      {order.beatName ?? "No beat"}
                    </p>
                    <p className="text-xs text-red-700">
                      Not confirmed, placed {overdueDays} days ago.{" "}
                      <a
                        href={`/orders/${order.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        View order
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setIsGatePopupOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 gap-1.5"
                disabled={gateSelectedIds.length === 0}
                onClick={() => {
                  setSelectedOrders(gateSelectedIds);
                  setIsCancelDialogOpen(true);
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel selected
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                disabled={gateSelectedIds.length === 0}
                onClick={() => setIsGateConfirmOpen(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm selected{gateSelectedIds.length > 0 ? ` (${gateSelectedIds.length})` : ""}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature 9 — quick confirm for the pop-up selection. Same
          shape as the portal's confirm: title, one line, Cancel and
          Confirm Orders. */}
      <Dialog open={isGateConfirmOpen} onOpenChange={setIsGateConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Confirm Orders
            </DialogTitle>
            <DialogDescription>
              Confirm {gateView.selected} order
              {gateView.selected === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsGateConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={handleGateConfirm}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Orders
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
              Select the date range, level and format to export orders.
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
                    setExportDeliveryDate("all");
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
                  onChange={(e) => {
                    setExportEndDate(e.target.value);
                    setExportDeliveryDate("all");
                  }}
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
              <Label htmlFor="exportDeliveryDate">Delivery Date</Label>
              <Select value={exportDeliveryDate} onValueChange={setExportDeliveryDate}>
                <SelectTrigger id="exportDeliveryDate" className="w-full">
                  <SelectValue placeholder="All delivery dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All delivery dates</SelectItem>
                  {exportDeliveryOptions.map(([d, n]) => (
                    <SelectItem key={d} value={d}>
                      {shortDate(d)} ({n} order{n === 1 ? "" : "s"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-600">
                Only orders created in the date range above that are due on this delivery date are exported.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exportLevel">
                Level <span className="text-red-500">*</span>
              </Label>
              <Select
                value={exportLevel}
                onValueChange={(v) => setExportLevel(v as "customer" | "order" | "item")}
              >
                <SelectTrigger id="exportLevel" className="w-full">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer level</SelectItem>
                  <SelectItem value="order">Order level</SelectItem>
                  <SelectItem value="item">Item level</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-600">
                {exportLevel === "customer"
                  ? "One section per retailer — their orders with status, dates, company and products."
                  : exportLevel === "order"
                    ? "One row per company order — company, Retailer Company ID, value and status."
                    : "One row per product line — the full export."}
              </p>
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
                  <SelectItem value="pdf">PDF</SelectItem>
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