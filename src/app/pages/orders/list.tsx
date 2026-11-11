import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { MultiSelect } from "../../components/ui/multi-select";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
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
  Warehouse,
  RotateCcw,
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
  ChevronDown,
  Send,
  Pencil,
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
import { isCdsEnabled } from "../../lib/cds/store";
import { SELLER_CANCELLABLE } from "../../lib/cds/calc";
import { CdsOrdersTab } from "../../components/cds/cds-orders-tab";
import { CdsReturnsTab, useCdsReturnCount } from "../../components/cds/cds-returns-tab";
import { useCdsOrderIds, useCdsOrderMap } from "../../components/cds/cds-order-sync";
import { areaFromAddress, isCdsServiceable } from "../../lib/cds/order-bridge";
import type { CdsOrderStatus } from "../../lib/cds/types";
import { sellerOrderStage } from "../../lib/cds/calc";

// Short CDS stage shown under "Confirmed" — same labels as the CDS tab.
const cdsStageLabel = (s: CdsOrderStatus) => sellerOrderStage(s).label;
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
  type DeliveryType,
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
  orderLines,
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
type TabType =
  | "all"
  | "new"
  | "confirmed"
  | "logistics"
  | "delivered"
  | "cancelled"
  // Cross Dock Store orders — only when the Darkstore Connector is on.
  | "cds"
  | "returns";

// ---- Bulk "Actions" menu --------------------------------------------
// After selecting orders the seller sees "N selected" and one Actions
// button; clicking it lists every action available for that tab.
type SelectionAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Shown under a disabled action to say why. */
  hint?: string;
  tone?: "default" | "danger";
};

function SelectionActions({ count, actions }: { count: number; actions: SelectionAction[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">{count} selected</span>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700">
            Actions
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {actions.map((a) => (
            <DropdownMenuItem
              key={a.label}
              disabled={a.disabled}
              onSelect={() => a.onClick()}
              className={a.tone === "danger" ? "text-red-700 focus:text-red-700" : undefined}
            >
              <span className="flex w-full items-start gap-2">
                <span className="mt-0.5 shrink-0">{a.icon}</span>
                <span className="min-w-0">
                  <span className="block">{a.label}</span>
                  {a.disabled && a.hint && <span className="block text-[11px] text-gray-500">{a.hint}</span>}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cdsEnabled = isCdsEnabled(user?.id) && user?.dataMode !== "empty";
  // Connector sellers: confirmed orders are also in the CDS (see
  // CdsOrderSync) — they stay on Confirmed and show their CDS stage.
  const cdsOrderIds = useCdsOrderIds();
  const cdsOrderMap = useCdsOrderMap();
  // Tabs that draw their own summary + filters (CDS, 3PL for CDS sellers, Returns).
  const ownHeaderTab = (tab: string) => tab === "cds" || tab === "returns" || (cdsEnabled && tab === "logistics");
  // CDS sellers: the order type comes from CDS serviceability (buyer inside
  // the CDS polygon → CDS Store Delivery, else 3PL Logistics Delivery).
  // Other sellers keep Beat / Non-Beat.
  const isRouteA = (o: Order) => (cdsEnabled ? isCdsServiceable(o) : isBeatOrder(o));
  const cdsReturnCount = useCdsReturnCount();
  const location = useLocation();

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
  // 3PL is always available to CDS sellers — it's their only route for
  // orders outside the CDS area.
  const threePlEnabled = logisticsEnabled || cdsEnabled;

  // Source of truth lives in lib/orders-data. We mirror it locally
  // and resubscribe so writes from the detail page propagate here.
  const [orders, setOrdersState] = useState<Order[]>(() =>
    isEmptyMode() ? [] : getOrders(),
  );
  useEffect(() => {
    // Pick up writes that landed before we subscribed (e.g. the CDS sync).
    if (!isEmptyMode()) setOrdersState([...getOrders()]);
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
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    (["cds", "returns", "logistics"] as const).find((x) => x === new URLSearchParams(window.location.search).get("tab")) ?? "all",
  );
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
  const [selectedBrandFilters, setSelectedBrandFilters] = useState<string[]>([]);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  // Delivery filters — Delivery Type (Urgent / Regular) is still
  // a useful slicer in the drawer; the Today / Tomorrow / Overdue
  // bucket multi-select and the Tomorrow-only / Urgent-only quick
  // toggles were retired in June 2026 along with the rest of the
  // relative-date model. Sellers filter by a concrete Delivery Day
  // (via the pill row + an optional date range below) instead.
  const [selectedDeliveryTypes, setSelectedDeliveryTypes] = useState<string[]>([]);
  const [deliveryStartDate, setDeliveryStartDate] = useState<string>("");
  const [deliveryEndDate, setDeliveryEndDate] = useState<string>("");
  // "Cancelled By" quick filter — only consulted on the Cancelled
  // tab. "all" matches buyer + seller cancellations; the other two
  // narrow to just one origin so the seller can audit one cancellation
  // channel at a time.
  const [cancelledByFilter, setCancelledByFilter] = useState<
    "all" | CancelledBy
  >("all");

  // Unique brands and statuses for filter options
  const uniqueBrands = useMemo(
    () => Array.from(new Set(orders.map((o) => o.brand))).sort(),
    [orders]
  );
  const statusOptions = [
    { label: "New", value: "New" },
    { label: "Confirmed", value: "Confirmed" },
    { label: "Delivered", value: "Delivered" },
    { label: "Cancelled", value: "Cancelled" },
  ];
  const deliveryTypeOptions: { label: string; value: DeliveryType }[] = [
    { label: "Urgent", value: "Urgent" },
    { label: "Regular", value: "Regular" },
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
  // Orders moved to the CDS leave Confirmed (like 3PL hand-offs) and are
  // tracked on the CDS tab.
  // CDS sellers: confirming routes orders automatically to the CDS or 3PL
  // tab, and Confirmed keeps showing all of them with their stage.
  const isSellerActionable = (o: Order) => !isWithLogisticsPartner(o);

  // Calculate summary statistics
  const summary = useMemo(() => {
    return {
      all: orders.length,
      new: orders.filter((o) => o.status === "New").length,
      confirmed: orders.filter(
        (o) => o.status === "Confirmed" && isSellerActionable(o),
      ).length,
      logistics: orders.filter(isWithLogisticsPartner).length,
      delivered: orders.filter((o) => o.status === "Delivered").length,
      cancelled: orders.filter((o) => o.status === "Cancelled").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, cdsOrderIds]);

  // Get orders for active tab
  const getTabOrders = (tab: TabType): Order[] => {
    const statusMap: Record<
      Exclude<TabType, "all" | "logistics" | "cds" | "returns">,
      Order["status"]
    > = {
      new: "New",
      confirmed: "Confirmed",
      delivered: "Delivered",
      cancelled: "Cancelled",
    };

    if (tab === "cds" || tab === "returns") return [];
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
      const matchesBrand =
        selectedBrandFilters.length === 0 || selectedBrandFilters.includes(order.brand);
      const matchesStatusFilter =
        selectedStatusFilters.length === 0 || selectedStatusFilters.includes(order.status);

      let matchesDate = true;
      if (startDate && endDate) {
        const orderDate = new Date(order.orderDate);
        const start = new Date(startDate);
        const end = new Date(endDate);
        matchesDate = orderDate >= start && orderDate <= end;
      }

      // Delivery filters — Delivery Type stays (Urgent / Regular),
      // backed by the optional Delivery Day range below. The relative
      // bucket multi-select and Tomorrow-only / Urgent-only quick
      // toggles were dropped in June 2026.
      const matchesDeliveryType =
        selectedDeliveryTypes.length === 0 ||
        selectedDeliveryTypes.includes(order.deliveryType);

      let matchesDeliveryDateRange = true;
      if (deliveryStartDate && deliveryEndDate) {
        matchesDeliveryDateRange =
          order.expectedDeliveryDate >= deliveryStartDate &&
          order.expectedDeliveryDate <= deliveryEndDate;
      }

      // Delivery Day pill + Beat/Non-Beat sub-navigation. Same shape
      // on the New, Confirmed and 3PL Logistics tabs — the seller
      // plans new arrivals, their own deliveries and the partner's
      // deliveries the same way (which day? which route?), so the
      // filters mirror across all three. "all" on either dimension is
      // a pass-through.
      let matchesConfirmedSub = true;
      // Delivery day + Order type apply on every list tab.
      {
        if (confirmedDeliveryDay !== "all") {
          matchesConfirmedSub =
            matchesConfirmedSub &&
            order.expectedDeliveryDate === confirmedDeliveryDay;
        }
        // The 3PL tab has no Order type filter for CDS sellers — ignore it there.
        if (confirmedBeatMode !== "all" && !(cdsEnabled && tab === "logistics")) {
          const beat = isRouteA(order);
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
        matchesBrand &&
        matchesStatusFilter &&
        matchesDate &&
        matchesDeliveryType &&
        matchesDeliveryDateRange &&
        matchesConfirmedSub &&
        matchesCancelledBy
      );
    });
  };

  const currentTabOrders = useMemo(
    () => getTabOrders(activeTab),
    [
      activeTab,
      cdsOrderIds,
      confirmedDeliveryDay,
      confirmedBeatMode,
      orders,
      searchQuery,
      marketplaceFilter,
      selectedBrandFilters,
      selectedStatusFilters,
      startDate,
      endDate,
      selectedDeliveryTypes,
      deliveryStartDate,
      deliveryEndDate,
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
      const matchesBrand =
        selectedBrandFilters.length === 0 ||
        selectedBrandFilters.includes(o.brand);
      const matchesDeliveryType =
        selectedDeliveryTypes.length === 0 ||
        selectedDeliveryTypes.includes(o.deliveryType);
      return (
        matchesSearch &&
        matchesMarketplace &&
        matchesBrand &&
        matchesDeliveryType
      );
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
      beat: scopedToDay.filter(isRouteA).length,
      nonBeat: scopedToDay.filter((o) => !isRouteA(o)).length,
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
      selectedBrandFilters,
      selectedDeliveryTypes,
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
      selectedBrandFilters,
      selectedDeliveryTypes,
      confirmedDeliveryDay,
    ],
  );

  const newBucketCounts = useMemo(
    () => buildBucketCounts((o) => o.status === "New"),
    [
      orders,
      searchQuery,
      marketplaceFilter,
      selectedBrandFilters,
      selectedDeliveryTypes,
      confirmedDeliveryDay,
    ],
  );
  const allBucketCounts = useMemo(() => buildBucketCounts(() => true), [
      orders,
      searchQuery,
      marketplaceFilter,
      selectedBrandFilters,
      selectedDeliveryTypes,
      confirmedDeliveryDay,
    ]);
  const deliveredBucketCounts = useMemo(() => buildBucketCounts((o) => o.status === "Delivered"), [
      orders,
      searchQuery,
      marketplaceFilter,
      selectedBrandFilters,
      selectedDeliveryTypes,
      confirmedDeliveryDay,
    ]);
  const cancelledBucketCounts = useMemo(() => buildBucketCounts((o) => o.status === "Cancelled"), [
      orders,
      searchQuery,
      marketplaceFilter,
      selectedBrandFilters,
      selectedDeliveryTypes,
      confirmedDeliveryDay,
    ]);

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
    setIsStaleReviewDialogOpen(false);
    if (cdsEnabled) {
      handleConfirmOrders(staleReviewSelection);
      return;
    }
    setSelectedOrders(staleReviewSelection);
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
  // CDS sellers can select and confirm any New order — the older-orders
  // lock (and its pop-up) applies only to other sellers.
  const gateActive = !cdsEnabled && attentionItems.length > 0;
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
      const matchesBrand =
        selectedBrandFilters.length === 0 ||
        selectedBrandFilters.includes(o.brand);
      return matchesSearch && matchesMarketplace && matchesBrand;
    });
    const isBuyer = (o: Order) => (o.cancelledBy ?? "Seller") === "Buyer";
    return {
      all: baseCancelled.length,
      buyer: baseCancelled.filter(isBuyer).length,
      seller: baseCancelled.filter((o) => !isBuyer(o)).length,
    };
  }, [orders, searchQuery, marketplaceFilter, selectedBrandFilters]);

  // Rows the seller can tick: not locked, and not a 3PL order already
  // sent to LBNP.
  const canSelect = (o: Order) => !isMaskedOrder(o);

  // Header checkbox: selects / clears the rows shown on this page (not
  // hidden pages), keeping any selection made on other pages.
  const handleSelectAll = (checked: boolean, pageRows: Order[]) => {
    const ids = pageRows.filter((o) => canSelect(o)).map((o) => o.id);
    setSelectedOrders((prev) =>
      checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id)),
    );
  };

  // Row checkbox — functional update so quick clicks never drop a change.
  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders((prev) =>
      checked ? (prev.includes(orderId) ? prev : [...prev, orderId]) : prev.filter((id) => id !== orderId),
    );
  };


  // Keep the selection to orders still in this tab's list — a search,
  // filter or status change shouldn't leave hidden orders selected.
  useEffect(() => {
    const visible = new Set(currentTabOrders.map((o) => o.id));
    setSelectedOrders((prev) => {
      const next = prev.filter((id) => visible.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [currentTabOrders]);

  // The 3PL Logistics tab only exists while the connector is on. If
  // the admin turns it off mid-session, fall back to All rather than
  // leaving the seller on a tab whose trigger has disappeared.
  useEffect(() => {
    if (!threePlEnabled && activeTab === "logistics") {
      setActiveTab("all");
      setSelectedOrders([]);
    }
  }, [threePlEnabled, activeTab]);

  useEffect(() => {
    const want = new URLSearchParams(location.search).get("tab");
    if ((want === "cds" || want === "returns" || want === "logistics") && cdsEnabled) {
      setActiveTab(want);
      setSelectedOrders([]);
    } else if (!want) {
      // Sidebar "Orders" (plain /orders) leaves the CDS / Returns tab.
      setActiveTab((cur) => (cur === "cds" || cur === "returns" ? "all" : cur));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Clear selection when changing tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    // Keep the URL in step with the CDS / Returns tabs so the sidebar
    // highlights the right item and links back here work.
    const want = cdsEnabled && (tab === "cds" || tab === "returns" || tab === "logistics") ? "?tab=" + tab : "";
    if (location.search !== want) navigate("/orders" + want, { replace: true });
    setSelectedOrders([]);
    setCurrentPage(1); // Reset to first page
    // Reset the Delivery Day + Beat/Non-Beat sub-navigation whenever
    // we leave New, Confirmed or 3PL Logistics (the tabs that host
    // the filters), so a fresh visit always lands on "All days / All
    // orders".
    // Every tab has its own Delivery day / Order type view — start fresh.
    setConfirmedDeliveryDay("all");
    setConfirmedBeatMode("all");
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
  const handleConfirmOrders = (ids: string[] = selectedOrders) => {
    const allSelected = orders.filter((o) => ids.includes(o.id));
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
    if (cdsEnabled) {
      // One short line: where the confirmed orders went, by order type.
      const n = (k: number) => `${k} order${k === 1 ? "" : "s"}`;
      const toCds = allSelected.filter((o) => isCdsServiceable(o)).length;
      const to3pl = allSelected.length - toCds;
      const parts = [toCds ? `${n(toCds)} moved to CDS` : "", to3pl ? `${n(to3pl)} moved to 3PL Logistics` : ""].filter(Boolean);
      toast.success(parts.join(" · "));
    } else {
      toast.success(
        `Confirmed ${allSelected.length} order${allSelected.length === 1 ? "" : "s"}.`,
      );
    }
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
    // CDS sellers: once logistics is requested the order can't be cancelled.
    const cancellable = cdsEnabled
      ? selectedOrders.filter((id) => {
          const c = cdsOrderMap.get(id);
          return !c || SELLER_CANCELLABLE.includes(c.status);
        })
      : selectedOrders;
    if (cancellable.length < selectedOrders.length) {
      toast.error(`${selectedOrders.length - cancellable.length} order(s) already have logistics requested and can't be cancelled.`);
    }
    if (!cancellable.length) return;
    updateOrderStatuses(cancellable, "Cancelled", cancelReason, "Seller");
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
          "Track them under the 3PL Logistics tab until the delivery partner completes them.",
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
    setSelectedBrandFilters([]);
    setSelectedStatusFilters([]);
    setStartDate("");
    setEndDate("");
    setSelectedDeliveryTypes([]);
    setDeliveryStartDate("");
    setDeliveryEndDate("");
  };

  const hasActiveFilters =
    searchQuery ||
    marketplaceFilter !== "all" ||
    selectedBrandFilters.length > 0 ||
    selectedStatusFilters.length > 0 ||
    startDate ||
    endDate ||
    selectedDeliveryTypes.length > 0 ||
    deliveryStartDate ||
    deliveryEndDate;

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
      cdsEnabled ? "Area Name" : "Beat Name",
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
      const lines = orderLines(order);
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
          cdsEnabled
            ? isCdsServiceable(order) ? "CDS Store Delivery" : "3PL Logistics Delivery"
            : getOrderType(order) === "beat" ? "Beat" : "Non-Beat",
          cdsEnabled ? areaFromAddress(order.buyerAddress) : order.beatName ?? "",
          order.expectedDeliveryDate,
          order.retailerName,
          order.buyerContact ?? "",
          order.buyerAddress ?? "",
          SELLER_INFO.name,
          SELLER_INFO.contact,
          order.paymentMode,
          channelOrderIdFor(order),
          order.originalOrderValue ?? order.orderValue,
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
      case "Confirmed": {
        const c = cdsEnabled ? cdsOrderMap.get(order.id) : undefined;
        return (
          <span className="inline-flex flex-col items-start gap-0.5">
            <Badge className="bg-green-50 text-green-700 border-green-200">
              Confirmed
            </Badge>
            {c &&
              (c.route === "3pl" ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                  <Truck className="h-3 w-3" /> 3PL · {cdsStageLabel(c.status)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700">
                  <Warehouse className="h-3 w-3" /> CDS · {cdsStageLabel(c.status)}
                </span>
              ))}
          </span>
        );
      }
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


  // "Wed, 13 May": weekday + date, rendered in UTC so it matches the
  // ISO string whatever the viewer's timezone is.
  const gateDate = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  // CDS / 3PL / Returns tabs show the same table as Confirmed, for the
  // orders those tabs pick (ids from the CDS store).
  const renderLinkedTable = (orderIds: string[], statusNotes?: Map<string, ReactNode>) => {
    const byId = new Map(orders.map((o) => [o.id, o] as const));
    return renderOrderTable(orderIds.map((id) => byId.get(id)).filter((o): o is Order => !!o), statusNotes);
  };

  // Render order table
  const renderOrderTable = (ordersToRender: Order[], statusNotes?: Map<string, ReactNode>) => {
    if (ordersToRender.length === 0) {
      const hasSearch = searchQuery.trim().length > 0;
      const title = hasSearch
        ? "No orders match your search"
        : activeTab === "all"
          ? "No orders yet"
          : activeTab === "cds"
            ? "No Cross Dock Store orders here"
            : activeTab === "returns"
              ? "No returns here"
              : activeTab === "logistics"
                ? cdsEnabled ? "No 3PL Logistics orders here" : "Nothing with the logistics partner"
                : `No ${activeTab} orders`;
      const description = hasActiveFilters
        ? "No orders match your current filters. Try clearing them to see everything."
        : activeTab === "all"
          ? "Once retailers start placing orders on ONDC and connected marketplaces, they'll show up here ready for you to confirm and dispatch."
          : cdsEnabled && (activeTab === "cds" || activeTab === "logistics")
            ? "Orders you confirm land here automatically, already sent to LBNP."
            : activeTab === "returns"
              ? "Returns raised by the delivery app will appear here."
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
                    aria-label="Select all orders on this page"
                    checked={(() => {
                      const pageIds = ordersToRender.filter((o) => canSelect(o)).map((o) => o.id);
                      const picked = pageIds.filter((id) => selectedOrders.includes(id)).length;
                      if (picked === 0 || pageIds.length === 0) return false;
                      return picked === pageIds.length ? true : "indeterminate";
                    })()}
                    onCheckedChange={(v) => handleSelectAll(v === true, ordersToRender)}
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
                {cdsEnabled ? "Area Name" : "Beat Name"}
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
                      <span title="Confirm your older pending orders first">
                        <Lock className="h-3.5 w-3.5 text-gray-400" />
                      </span>
                    ) : !canSelect(order) ? (
                      // 3PL order already sent to LBNP — nothing to select.
                      <span className="block h-4 w-4" />
                    ) : (
                      <Checkbox
                        aria-label={`Select ${order.id}`}
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOrder(order.id, checked === true)
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
                  {cdsEnabled ? (
                    isCdsServiceable(order) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-[11px] font-medium text-teal-700">
                        <Warehouse className="h-3 w-3" />
                        CDS Store Delivery
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-700">
                        <Truck className="h-3 w-3" />
                        3PL Logistics Delivery
                      </span>
                    )
                  ) : getOrderType(order) === "beat" ? (
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
                {cdsEnabled ? (
                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-700" title={order.buyerAddress}>
                  {areaFromAddress(order.buyerAddress) || <span className="text-gray-400">—</span>}
                </td>
                ) : (
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
                )}
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <p
                    className="text-sm font-semibold tabular-nums text-gray-900"
                  >
                    {`₹${order.orderValue.toFixed(2)}`}
                  </p>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-gray-200 bg-white text-[11px] font-medium text-gray-700">
                    {order.marketplace}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {statusNotes?.has(order.id) ? (
                    <span className="inline-flex flex-col items-start gap-0.5">
                      {getStatusBadge(order)}
                      {statusNotes.get(order.id)}
                    </span>
                  ) : (
                    getStatusBadge(order)
                  )}
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
                    {/* View + Edit on every order. Locked (newer) New orders can
                        still be opened and edited; only confirming waits until
                        the older pending orders are updated. */}
                    {(
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/orders/${order.id}`)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {/* Edit quantities before confirming (New orders only). */}
                        {order.status === "New" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/orders/${order.id}#edit`)}
                            title="Edit quantities before confirming"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </>
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
  // showType=false hides the Order type row (e.g. 3PL Logistics tab for
  // CDS sellers — every order there is already 3PL).
  const renderDayAndBeatFilters = (
    counts: BucketCounts,
    showType = true,
    fixedType?: { label: string; icon: ReactNode },
  ) => (
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

      {fixedType && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide mr-1">
            Order type:
          </span>
          <span className="text-xs px-3 py-1.5 rounded-full border gap-1.5 inline-flex items-center bg-blue-600 text-white border-blue-600">
            {fixedType.icon}
            {fixedType.label} ({counts.beat + counts.nonBeat})
          </span>
        </div>
      )}
      {showType && !fixedType && (
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
              ? cdsEnabled ? "bg-teal-600 text-white border-teal-600" : "bg-emerald-600 text-white border-emerald-600"
              : cdsEnabled ? "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100" : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
          }`}
        >
          {cdsEnabled ? <Warehouse className="h-3 w-3" /> : <Route className="h-3 w-3" />}
          {cdsEnabled ? "CDS Store Delivery" : "Beat orders"} ({counts.beat})
        </button>
        <button
          onClick={() => handleConfirmedBeatModeChange("non-beat")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors gap-1.5 inline-flex items-center ${
            confirmedBeatMode === "non-beat"
              ? cdsEnabled ? "bg-blue-600 text-white border-blue-600" : "bg-amber-600 text-white border-amber-600"
              : cdsEnabled ? "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100" : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
          }`}
        >
          {cdsEnabled ? <Truck className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
          {cdsEnabled ? "3PL Logistics Delivery" : "Non-beat orders"} ({counts.nonBeat})
        </button>
      </div>
      )}
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
                <div className="flex items-center justify-between gap-4 overflow-x-auto">
                  {/* Tab Toggle */}
                  <TabsList className="bg-gray-100 p-1 rounded-lg inline-flex gap-1 h-auto flex-shrink-0">
                    <TabsTrigger
                      value="all"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                    >
                      <span className="font-medium">All ({summary.all})</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="new"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      <span className="font-medium">New ({summary.new})</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="confirmed"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      <span className="font-medium">Confirmed ({summary.confirmed})</span>
                    </TabsTrigger>
                    {cdsEnabled && (
                      <TabsTrigger
                        value="cds"
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                      >
                        <Warehouse className="h-4 w-4 mr-2" />
                        <span className="font-medium">Cross Dock Store (CDS)</span>
                      </TabsTrigger>
                    )}
                    {/* Only meaningful once the seller can actually
                        hand orders off, so it's gated on the same flag
                        as the Request 3PL Logistics action. */}
                    {threePlEnabled && (
                      <TabsTrigger
                        value="logistics"
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        <span className="font-medium">{cdsEnabled ? "3PL Logistics" : `3PL Logistics (${summary.logistics})`}</span>
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="delivered"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                    >
                      <PackageCheck className="h-4 w-4 mr-2" />
                      <span className="font-medium">Delivered ({summary.delivered})</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="cancelled"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      <span className="font-medium">Cancelled ({summary.cancelled})</span>
                    </TabsTrigger>
                    {cdsEnabled && (
                      <TabsTrigger
                        value="returns"
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-2 transition-all whitespace-nowrap"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        <span className="font-medium">Returns ({cdsReturnCount})</span>
                      </TabsTrigger>
                    )}
                  </TabsList>

                  {/* Action Buttons */}
                  {!isEmpty && !ownHeaderTab(activeTab) && (
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
              {!isEmpty && !ownHeaderTab(activeTab) && (
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
              {(selectedBrandFilters.length > 0 || selectedStatusFilters.length > 0 || marketplaceFilter !== "all") && (
                <div className="px-6 py-2 border-b flex flex-wrap items-center gap-2 flex-shrink-0">
                  {selectedBrandFilters.map((brand) => (
                    <Badge key={brand} variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-purple-50 text-purple-700 border-purple-200">
                      {brand}
                      <button onClick={() => setSelectedBrandFilters(selectedBrandFilters.filter(b => b !== brand))} className="ml-1 hover:bg-purple-200 rounded-full p-0.5">
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
              {!isEmpty && renderDayAndBeatFilters(allBucketCounts)}
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
                    <SelectionActions
                      count={selectedOrders.length}
                      actions={[
                        {
                          label: "Confirm",
                          icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
                          // CDS sellers confirm straight away — no review pop-up.
                          onClick: () => (cdsEnabled ? handleConfirmOrders() : setIsConfirmDialogOpen(true)),
                        },
                        { label: "View on Map", icon: <MapPin className="h-4 w-4 text-blue-600" />, onClick: handleViewOnMap },
                        { label: "Cancel", icon: <XCircle className="h-4 w-4" />, onClick: () => setIsCancelDialogOpen(true), tone: "danger" },
                      ]}
                    />
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
                    {maskedCount} new order{maskedCount === 1 ? "" : "s"} can be viewed and edited, but confirmed only after you update{" "}
                    {attentionItems.length} previous order{attentionItems.length === 1 ? "" : "s"}.
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
                        <SelectionActions
                          count={selectedOrders.length}
                          actions={[
                            ...(cdsEnabled
                              ? [] // routed automatically on confirm — manage them on the CDS / 3PL tabs
                              : [
                                  ...(logisticsEnabled
                                    ? [{ label: "Request 3PL Logistics", icon: <Truck className="h-4 w-4 text-blue-600" />, onClick: () => setIsRequestLogisticsDialogOpen(true) }]
                                    : []),
                                  { label: "Mark Delivered", icon: <PackageCheck className="h-4 w-4 text-green-600" />, onClick: () => setIsDeliverDialogOpen(true) },
                                ]),
                            { label: "View on Map", icon: <MapPin className="h-4 w-4 text-blue-600" />, onClick: handleViewOnMap },
                            { label: "Cancel", icon: <XCircle className="h-4 w-4" />, onClick: () => setIsCancelDialogOpen(true), tone: "danger" as const },
                          ]}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

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
              {cdsEnabled ? (
                <CdsOrdersTab route="3pl" renderTable={renderLinkedTable} />
              ) : (
              <>
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
              </>
              )}
            </TabsContent>

            <TabsContent value="delivered" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {!isEmpty && renderDayAndBeatFilters(deliveredBucketCounts)}
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
              {renderOrderTable(paginatedOrders)}
            </TabsContent>

            <TabsContent value="cancelled" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {!isEmpty && renderDayAndBeatFilters(cancelledBucketCounts)}
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
              {renderOrderTable(paginatedOrders)}
            </TabsContent>

            {cdsEnabled && (
              <TabsContent value="cds" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
                <CdsOrdersTab renderTable={renderLinkedTable} />
              </TabsContent>
            )}
            {cdsEnabled && (
              <TabsContent value="returns" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
                <CdsReturnsTab renderTable={renderLinkedTable} />
              </TabsContent>
            )}
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
                  {cdsOrderIds.has(o.id) ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap border border-teal-200 bg-teal-50 text-teal-700">
                      <Warehouse className="h-3 w-3" />
                      CDS Store Delivery
                    </span>
                  ) : (
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
                  )}
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
                  onClick={() => handleConfirmOrders()}
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
                onClick={() => (cdsEnabled ? handleGateConfirm() : setIsGateConfirmOpen(true))}
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
              Send {selectedOrders.length === 1 ? "1 order" : `${selectedOrders.length} orders`}{" "}
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
                    <Label>Company / Brand</Label>
                    <MultiSelect
                      options={uniqueBrands.map((b) => ({ label: b, value: b }))}
                      selected={selectedBrandFilters}
                      onChange={setSelectedBrandFilters}
                      placeholder="All Brands"
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
                    <Label htmlFor="dateRange">Order Date Range</Label>
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

                  {/* Delivery filters — June 2026 retired the relative
                      bucket multi-select (Today / Tomorrow / Overdue)
                      and the Tomorrow-only / Urgent-only quick toggles
                      together with the broader Tomorrow indicator
                      cleanup. Sellers slice deliveries by a concrete
                      Delivery Day range (or via the pill row on the
                      New / Confirmed tabs). Delivery Type stays as an
                      Urgent vs Regular slicer. */}
                  <div className="pt-2 border-t border-gray-100">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-3">
                      Delivery
                    </h4>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Delivery Day Range</Label>
                        <div className="flex flex-col gap-2">
                          <Input
                            type="date"
                            value={deliveryStartDate}
                            onChange={(e) =>
                              setDeliveryStartDate(e.target.value)
                            }
                            placeholder="From"
                          />
                          <Input
                            type="date"
                            value={deliveryEndDate}
                            onChange={(e) =>
                              setDeliveryEndDate(e.target.value)
                            }
                            placeholder="To"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Delivery Type</Label>
                        <MultiSelect
                          options={deliveryTypeOptions}
                          selected={selectedDeliveryTypes}
                          onChange={setSelectedDeliveryTypes}
                          placeholder="Urgent / Regular"
                          className="w-full"
                        />
                      </div>
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