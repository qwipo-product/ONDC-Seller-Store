import { useEffect, useMemo, useState } from "react";
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
  ChevronRight,
  ChevronLeft,
  Eye,
  Download,
  Zap,
  Route,
  MapPin,
  CalendarDays,
  CalendarPlus,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { isEmptyMode } from "../../lib/data-mode";
import { EmptyState } from "../../components/empty-state";
import { CopyOnHover } from "../../components/copy-on-hover";
import { ListPagination } from "../../components/ui/list-pagination";
import { OrdersMapDialog } from "../../components/orders-map-dialog";
// Shared store — seeds + writers live in lib/orders-data so the
// detail page can read the same orders by id and writes flow both
// ways. `Order` / `OrderLineItem` / `OrderStatus` are exported from
// the lib so we don't redeclare them here.
import {
  type Order,
  type OrderLineItem,
  type OrderStatus,
  type DeliveryType,
  type CancelledBy,
  SELLER_INFO,
  getOrders,
  setOrders as setOrdersStore,
  subscribeToOrders,
  updateOrderStatuses,
  getOrdersToday,
  getOrderType,
  isConfirmableDeliveryDay,
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
type TabType = "all" | "new" | "confirmed" | "delivered" | "cancelled";

export function Orders() {
  const navigate = useNavigate();
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
  // "Update Expected Delivery Date" bulk action — Confirmed tab.
  // The seller picks one or more confirmed orders, opens the
  // dialog, chooses a new date, and on save we mutate
  // expectedDeliveryDate across the selection. A WhatsApp
  // notification banner in the success toast tells the seller
  // their customers were informed about the schedule change.
  const [isUpdateDeliveryDialogOpen, setIsUpdateDeliveryDialogOpen] =
    useState(false);
  const [newExpectedDeliveryDate, setNewExpectedDeliveryDate] = useState("");

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

  // Calculate summary statistics
  const summary = useMemo(() => {
    return {
      all: orders.length,
      new: orders.filter((o) => o.status === "New").length,
      confirmed: orders.filter((o) => o.status === "Confirmed").length,
      delivered: orders.filter((o) => o.status === "Delivered").length,
      cancelled: orders.filter((o) => o.status === "Cancelled").length,
    };
  }, [orders]);

  // Get orders for active tab
  const getTabOrders = (tab: TabType): Order[] => {
    const statusMap: Record<Exclude<TabType, "all">, Order["status"]> = {
      new: "New",
      confirmed: "Confirmed",
      delivered: "Delivered",
      cancelled: "Cancelled",
    };

    return orders.filter((order) => {
      // "all" tab bypasses the status filter
      const matchesStatus =
        tab === "all" ? true : order.status === statusMap[tab];
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
      // on both the New and Confirmed tabs — the seller plans new
      // arrivals and already-confirmed deliveries the same way (which
      // day? which route?), so the filters mirror across both. "all"
      // on either dimension is a pass-through.
      let matchesConfirmedSub = true;
      if (tab === "confirmed" || tab === "new") {
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
  const buildBucketCounts = (statusFilter: OrderStatus) => {
    const base = orders.filter((o) => {
      if (o.status !== statusFilter) return false;
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
      beat: scopedToDay.filter(isBeatOrder).length,
      nonBeat: scopedToDay.filter((o) => !isBeatOrder(o)).length,
    };
  };

  const confirmedBucketCounts = useMemo(
    () => buildBucketCounts("Confirmed"),
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
    () => buildBucketCounts("New"),
    [
      orders,
      searchQuery,
      marketplaceFilter,
      selectedBrandFilters,
      selectedDeliveryTypes,
      confirmedDeliveryDay,
    ],
  );

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

  // Clear selection when changing tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    setSelectedOrders([]);
    setCurrentPage(1); // Reset to first page
    // Reset the Delivery Day + Beat/Non-Beat sub-navigation whenever
    // we leave New or Confirmed (the two tabs that host the
    // filters), so a fresh visit always lands on "All days / All
    // orders".
    if (tab !== "confirmed" && tab !== "new") {
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

  // Confirm orders (New → Confirmed). The June 25 review settled that
  // a seller can only confirm orders whose committed Delivery Day is
  // today, tomorrow, or in the past — anything further out has to
  // wait until the day-before window. We filter the selection to the
  // eligible subset, flip just those to Confirmed, and leave the
  // ineligible ones selected so the seller can revisit them later.
  // The confirm dialog body already calls this out per-row; the toast
  // copy mirrors the split so the action's outcome is unambiguous.
  const handleConfirmOrders = () => {
    const allSelected = orders.filter((o) => selectedOrders.includes(o.id));
    const eligible = allSelected.filter((o) =>
      isConfirmableDeliveryDay(o.expectedDeliveryDate),
    );
    if (eligible.length === 0) {
      toast.error(
        "Nothing to confirm — every selected order delivers more than 1 day out.",
      );
      return;
    }
    const eligibleIds = new Set(eligible.map((o) => o.id));
    setOrders((prev) =>
      prev.map((order) =>
        eligibleIds.has(order.id)
          ? { ...order, status: "Confirmed" as const }
          : order,
      ),
    );
    const skipped = allSelected.length - eligible.length;
    if (skipped > 0) {
      toast.success(
        `Confirmed ${eligible.length} order${eligible.length === 1 ? "" : "s"}. Skipped ${skipped} that deliver more than 1 day out.`,
      );
    } else {
      toast.success(
        `Confirmed ${eligible.length} order${eligible.length === 1 ? "" : "s"}.`,
      );
    }
    // Drop the confirmed ids from the selection; keep the ineligible
    // ones selected so the seller can act on them later (or unselect
    // by hand).
    setSelectedOrders((prev) => prev.filter((id) => !eligibleIds.has(id)));
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

  // Bulk reschedule — Confirmed tab. Rewrites expectedDeliveryDate on
  // every selected order to the date the seller picked in the
  // dialog, then surfaces two notifications: a primary toast
  // confirming the update, and a description line telling the
  // seller a WhatsApp notification went out to each affected
  // customer. (The WhatsApp send is mocked at this layer — in
  // production this would queue against the messaging backend.)
  const handleUpdateDeliveryDate = () => {
    if (!newExpectedDeliveryDate) {
      toast.error("Please pick a new expected delivery date.");
      return;
    }
    // Block past-dated reschedules — picking yesterday makes no
    // operational sense and would confuse the customer message.
    const today = new Date().toISOString().slice(0, 10);
    if (newExpectedDeliveryDate < today) {
      toast.error("New delivery date can't be in the past.");
      return;
    }
    const count = selectedOrders.length;
    setOrders((prev) =>
      prev.map((order) =>
        selectedOrders.includes(order.id)
          ? { ...order, expectedDeliveryDate: newExpectedDeliveryDate }
          : order,
      ),
    );
    // Friendly date for the toast — same format the column uses.
    const t = Date.parse(newExpectedDeliveryDate + "T00:00:00Z");
    const friendly = Number.isNaN(t)
      ? newExpectedDeliveryDate
      : new Date(t).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          timeZone: "UTC",
        });
    toast.success(
      `${count} order${count === 1 ? "" : "s"} rescheduled to ${friendly}.`,
      {
        description:
          "WhatsApp notification sent to inform customers about the delayed delivery.",
        icon: <MessageCircle className="h-4 w-4 text-emerald-600" />,
        duration: 5000,
      },
    );
    setSelectedOrders([]);
    setIsUpdateDeliveryDialogOpen(false);
    setNewExpectedDeliveryDate("");
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

    // 26-column layout — one row per line item; order-level fields
    // (Original Order Value, Order Level Savings, Final Order Value)
    // repeat on every row. The June 2026 review replaced the
    // Expected / Actual Delivery Date pair with a single Delivery
    // Day field, and added Order Type (Beat / Non-Beat) so finance
    // can reconcile by beat route without re-joining against the
    // settings sheet.
    const headers = [
      "Order ID",
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
      lines.forEach((item) => {
        const row = [
          order.id,
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
          item.company,
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
              Cancelled by Buyer
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
          : `No ${activeTab} orders`;
      const description = hasActiveFilters
        ? "No orders match your current filters. Try clearing them to see everything."
        : activeTab === "all"
          ? "Once retailers start placing orders on ONDC and connected marketplaces, they'll show up here ready for you to confirm and dispatch."
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
                          then Mark Delivered, the May 2026 Update
                          Delivery Date reschedule flow (with WhatsApp
                          customer notification), and the destructive
                          Cancel. */}
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
                            onClick={() => setIsDeliverDialogOpen(true)}
                          >
                            <Truck className="h-4 w-4" />
                            Mark Delivered
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 gap-2"
                            onClick={() => setIsUpdateDeliveryDialogOpen(true)}
                          >
                            <CalendarPlus className="h-4 w-4" />
                            Update Delivery Date
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
              {renderOrderTable(paginatedOrders)}
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
              {renderOrderTable(paginatedOrders)}
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
                      Buyer ({cancelledByCounts.buyer})
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
              Sellers can confirm orders delivering <b>today, tomorrow, or
              earlier</b>. Orders further out have to wait until the day
              before delivery.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const selectedOrderObjects = orders.filter((o) =>
              selectedOrders.includes(o.id),
            );
            const today = getOrdersToday();
            const eligible = selectedOrderObjects.filter((o) =>
              isConfirmableDeliveryDay(o.expectedDeliveryDate),
            );
            const ineligible = selectedOrderObjects.filter(
              (o) => !isConfirmableDeliveryDay(o.expectedDeliveryDate),
            );

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
                    <p>
                      None of the selected orders is eligible to confirm
                      yet. Confirm window opens 1 day before each
                      order&apos;s Delivery Day.
                    </p>
                  </div>
                )}
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
              const eligibleCount = orders.filter(
                (o) =>
                  selectedOrders.includes(o.id) &&
                  isConfirmableDeliveryDay(o.expectedDeliveryDate),
              ).length;
              return (
                <Button
                  onClick={handleConfirmOrders}
                  disabled={eligibleCount === 0}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {eligibleCount === 0
                    ? "Nothing to confirm"
                    : `Confirm ${eligibleCount} order${eligibleCount === 1 ? "" : "s"}`}
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

      {/* Update Expected Delivery Date Dialog — bulk-reschedule
          flow. The seller picks a new date in the input below;
          on save we rewrite expectedDeliveryDate across the
          selection and a mocked WhatsApp notification message is
          surfaced in the success toast. Closing the dialog clears
          the picked date so the next open starts blank. */}
      <Dialog
        open={isUpdateDeliveryDialogOpen}
        onOpenChange={(open) => {
          setIsUpdateDeliveryDialogOpen(open);
          if (!open) setNewExpectedDeliveryDate("");
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-amber-600" />
              Update Expected Delivery Date
            </DialogTitle>
            <DialogDescription>
              Reschedule{" "}
              {selectedOrders.length === 1
                ? "1 order"
                : `${selectedOrders.length} orders`}{" "}
              to a new expected delivery date. Customers will be
              notified on WhatsApp about the change.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-delivery-date">
                New Expected Delivery Date
              </Label>
              <Input
                id="new-delivery-date"
                type="date"
                value={newExpectedDeliveryDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) =>
                  setNewExpectedDeliveryDate(e.target.value)
                }
                className="w-full"
              />
              <p className="text-[11px] text-gray-500">
                The same date will be applied to every selected
                order. Past dates aren&apos;t allowed.
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 rounded border border-emerald-100 bg-emerald-50/60 text-[12px] text-emerald-900">
              <MessageCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-700" />
              <p>
                A WhatsApp message will be sent to each affected
                customer with the new expected delivery date so they
                know about the delay.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUpdateDeliveryDialogOpen(false);
                setNewExpectedDeliveryDate("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateDeliveryDate}
              disabled={!newExpectedDeliveryDate}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              <CalendarPlus className="h-4 w-4" />
              Update &amp; Notify
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