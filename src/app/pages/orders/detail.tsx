import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  ArrowLeft,
  Store,
  Building2,
  Phone,
  MapPin,
  Package,
  CheckCircle2,
  XCircle,
  Calendar,
  Hash,
  Layers,
  TrendingDown,
  Truck,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
// Shared orders store — the detail page now looks up the right
// order by URL :orderId rather than rendering a single hard-coded
// mock for every route. Status writes (confirm / cancel / mark as
// delivered) flow back through `updateOrderStatus` so the list
// page's subscribe callback sees the change.
import {
  getOrderById,
  updateOrderStatus,
  subscribeToOrders,
  synthesizeProducts,
  isConfirmableDeliveryDay,
  SELLER_INFO,
  type Order,
  type CancelledBy,
} from "../../lib/orders-data";
import { sampleSKUs } from "../products/my-sku";

/** One row in the QPS slab schedule for a SKU. */
interface QpsSlabDef {
  minQty: number;
  /** Upper bound; undefined = open-ended (highest tier). */
  maxQty?: number;
  /** Pretty name for the discount, e.g. "5% off" / "Flat ₹155" / "—" for no discount. */
  discountLabel: string;
  /** Effective per-unit price in this tier. */
  pricePerUnit: number;
}

interface OrderProduct {
  id: string;
  name: string;
  skuId: string;
  /** Short Name from My SKU details — read-only, —  when not set. */
  shortName?: string;
  orderedQuantity: number;
  availableStock: number;
  pricePerUnit: number;
  totalPrice: number;
  /** Base selling price before any QPS slab discount is applied (per unit). */
  basePrice?: number;
  /** Snapshot of the QPS slab applied to this line item, if any. */
  qps?: {
    /** The Offer Code (scheme ID) the discount was applied from —
     *  e.g. "QPS-180000008". Surfaced on the product line so the
     *  seller can trace each line's pricing back to the scheme that
     *  authored it. */
    offerCode: string;
    slabLabel: string;       // e.g. "Slab 2 · 12–47 qty"
    discountLabel: string;   // Phase 1 — always "N% off" / "—" (no flat slabs)
    savingPerUnit: number;   // ₹ saved per unit vs basePrice
    totalSaving: number;     // ₹ saved on the whole line
    /** Full slab schedule — kept for future read-only rendering. */
    slabs?: QpsSlabDef[];
  };
}

// Slab-helper functions (slabLabelFor / findSlabIdx) lived here in
// support of the Modify Items / Save Changes flow that re-evaluated
// which slab a line belonged to as the seller edited qty. That flow
// was retired in Phase 1, so the helpers were removed alongside it.
// If a future read-only "open slab schedule" view comes back, the
// helpers can be reintroduced trivially.

interface OrderDetails {
  orderId: string;
  // Status string mirrors the shared store. "In Progress" stays in
  // the union for backwards compatibility but isn't produced by any
  // current flow; Phase 1 ships New / Confirmed / Cancelled /
  // Delivered.
  status: "New" | "Confirmed" | "In Progress" | "Cancelled" | "Delivered";
  orderTime: string;
  channel: "ONDC" | "Amazon" | "Flipkart";
  buyerStoreName: string;
  buyerPhone: string;
  buyerAddress: string;
  sellerName: string;
  sellerContact: string;
  channelOrderId: string;
  paymentMode: "COD" | "Prepaid";
  orderValue: number;
  products: OrderProduct[];
  /** Cancellation reason — seller-picked option for seller-side
   *  cancellations, buyer-supplied copy for buyer-side cancellations.
   *  Only meaningful when `status === "Cancelled"`. Surfaced in the
   *  Cancellation banner + the Order Meta block. */
  cancellationReason?: string;
  /** Who cancelled — see {@link CancelledBy}. Drives the banner +
   *  status-chip variant. Only meaningful when cancelled. */
  cancelledBy?: CancelledBy;
  /** ISO timestamp the cancellation was processed at. Rendered in the
   *  Cancellation banner ("Cancelled by Buyer on 15 Jun 2026 at 04:32 PM").
   *  Only meaningful when cancelled. */
  cancellationTime?: string;
  /** Buyer's GST registration number. Undefined when the buyer is
   *  not GST-registered or the number wasn't provided with the order. */
  gstNumber?: string;
}

/**
 * Pretty-print an ISO timestamp as e.g. "20 May 2026 at 09:38 AM".
 * Falls back to the raw string when the value isn't parseable so a
 * malformed timestamp never breaks the banner. Renders in IST so the
 * displayed time matches what the seller (and the buyer-app payload)
 * actually saw.
 */
function formatCancellationTime(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t);
  const datePart = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return `${datePart} at ${timePart}`;
}

/**
 * Build an OrderDetails record from a shared-store Order. For
 * "QWI-ONDC-260330-8F3K92" we keep the rich products mock (with QPS slab
 * snapshots) because line items there carry the full discount
 * trace; for every other order we synthesize the products from
 * the store's lineItems / itemsSummary. The buyer / seller /
 * channel / status fields always come from the store row, so
 * clicking any row in the orders list now lands the seller on the
 * right order's details.
 */
function buildOrderDetailFromStore(order: Order): OrderDetails {
  // For the rich-mock order, keep the existing hand-authored
  // products array (with QPS slabs) — synthesizeProducts strips the
  // QPS field so we'd lose it otherwise.
  const rawProducts: OrderProduct[] =
    order.id === "QWI-ONDC-260330-8F3K92"
      ? RICH_PRODUCTS_FOR_SEED_ORDER
      : (synthesizeProducts(order) as OrderProduct[]);

  // Attach Short Name from the SKU catalogue (BR-1). Falls back to
  // whatever is already on the product (rich-mock) or undefined.
  const products = rawProducts.map((p) => ({
    ...p,
    shortName:
      p.shortName ??
      sampleSKUs.find((s) => s.sku === p.skuId)?.shortName,
  }));

  // Status mapping — the store's OrderStatus is a subset of the
  // detail page's wider union, so the cast is safe.
  return {
    orderId: order.id,
    status: order.status as OrderDetails["status"],
    orderTime: `${order.orderDate}${order.orderTime ? " " + order.orderTime : ""}`,
    channel: (order.marketplace as OrderDetails["channel"]) ?? "ONDC",
    buyerStoreName: order.retailerName,
    buyerPhone: order.buyerContact ?? "+91 90000 00000",
    buyerAddress: order.buyerAddress ?? "Address on file",
    sellerName: SELLER_INFO.name,
    sellerContact: SELLER_INFO.contact,
    channelOrderId: order.channelOrderId ?? `${order.marketplace ?? "ONDC"}-${order.id}`,
    paymentMode: order.paymentMode,
    orderValue: order.orderValue,
    products,
    cancellationReason: order.cancellationReason,
    cancelledBy: order.cancelledBy,
    cancellationTime: order.cancellationTime,
    gstNumber: order.gstNumber,
  };
}

// Rich hand-authored products array for the single seed order that
// carries the full QPS slab demo (QWI-ONDC-260330-8F3K92, "Balaji
// Kirana Store"). Synthesised orders use the smaller line-item
// shape from lib/orders-data, which drops slab snapshots — so we
// keep this hand-authored array around exclusively for that one
// order.
const RICH_PRODUCTS_FOR_SEED_ORDER: OrderProduct[] = [
  {
    // QPS-eligible line: SKU 180000008 has a 3-slab QPS scheme
    //   1–11 qty → ₹171/unit · 12–47 qty → 5% off (₹162.45) · 48+ qty → 10% off (₹153.90)
    // This order has 25 units → falls in Slab 2, 5% off.
    id: "1",
    name: "Freedom Refined Sunflower Oil 1L × 16",
    skuId: "180000008",
    shortName: "FFR1",
    orderedQuantity: 25,
    availableStock: 642,
    basePrice: 171,
    pricePerUnit: 162.45,
    totalPrice: 4061.25,
    qps: {
      offerCode: "QPS-180000008",
      slabLabel: "Slab 2 · 12–47 qty",
      discountLabel: "5% off",
      savingPerUnit: 8.55,
      totalSaving: 213.75,
      slabs: [
        { minQty: 1, maxQty: 11, discountLabel: "—", pricePerUnit: 171 },
        { minQty: 12, maxQty: 47, discountLabel: "5% off", pricePerUnit: 162.45 },
        { minQty: 48, discountLabel: "10% off", pricePerUnit: 153.9 },
      ],
    },
  },
  {
    id: "1a",
    name: "Aashirvaad Atta 10kg",
    skuId: "SKU-AASH-10",
    orderedQuantity: 20,
    availableStock: 15,
    basePrice: 450,
    pricePerUnit: 420,
    totalPrice: 8400,
    qps: {
      offerCode: "QPS-SKU-AASH-10",
      slabLabel: "Slab 2 · 10–24 qty",
      discountLabel: "6.67% off",
      savingPerUnit: 30,
      totalSaving: 600,
      slabs: [
        { minQty: 1, maxQty: 9, discountLabel: "—", pricePerUnit: 450 },
        { minQty: 10, maxQty: 24, discountLabel: "6.67% off", pricePerUnit: 420 },
        { minQty: 25, discountLabel: "11.11% off", pricePerUnit: 400 },
      ],
    },
  },
  {
    id: "2",
    name: "Sunfeast Biscuits Dark Fantasy 150g",
    skuId: "SKU-SUNF-DF150",
    orderedQuantity: 50,
    availableStock: 100,
    pricePerUnit: 35,
    totalPrice: 1750,
  },
  {
    id: "3",
    name: "Classmate Notebook 172 Pages",
    skuId: "SKU-CLAS-NB172",
    orderedQuantity: 30,
    availableStock: 25,
    pricePerUnit: 45,
    totalPrice: 1350,
  },
  {
    id: "4",
    name: "Bingo Mad Angles 90g",
    skuId: "SKU-BING-MA90",
    orderedQuantity: 40,
    availableStock: 80,
    pricePerUnit: 20,
    totalPrice: 800,
  },
  {
    id: "5",
    name: "Yippee Noodles 240g",
    skuId: "SKU-YIPP-240",
    orderedQuantity: 25,
    availableStock: 10,
    pricePerUnit: 12,
    totalPrice: 300,
  },
];

export function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  // Resolve the order from the shared store by URL :orderId. If
  // the ID isn't in the store (e.g. the seller hand-typed a URL
  // for a non-existent order), fall back to the rich mock so the
  // page still renders something useful instead of crashing.
  const initialOrder = orderId ? getOrderById(orderId) : undefined;
  const initialDetail = initialOrder
    ? buildOrderDetailFromStore(initialOrder)
    : buildOrderDetailFromStore({
        id: orderId ?? "QWI-ONDC-260330-8F3K92",
        brand: "ITC",
        company: "ITC Limited",
        source: "DMS-Bizom",
        retailerName: "Balaji Kirana Store",
        itemsSummary: "Sunflower Oil + 5 more",
        orderValue: 12450,
        paymentMode: "COD",
        orderDate: "2026-03-30",
        orderTime: "10:30 AM",
        status: "New",
        marketplace: "ONDC",
      });
  const [orderData, setOrderData] = useState<OrderDetails>(initialDetail);

  // Resync when the URL changes (clicking a different order in a
  // new tab, or back/forward) AND when the store fires a write
  // notification (bulk confirm/cancel/deliver from the list page).
  useEffect(() => {
    const refresh = () => {
      if (!orderId) return;
      const o = getOrderById(orderId);
      if (!o) return;
      setOrderData((prev) => ({
        ...buildOrderDetailFromStore(o),
        // Preserve in-flight product edits so a list write doesn't
        // clobber the seller's edit-mode changes mid-stream.
        products: prev.orderId === o.id ? prev.products : buildOrderDetailFromStore(o).products,
      }));
    };
    refresh();
    return subscribeToOrders(refresh);
  }, [orderId]);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  // Detail page reuses the bulk cancel popup's shape so the seller
  // sees one consistent cancellation experience regardless of where
  // they triggered it.
  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Modify Items / edit-mode functionality was retired in this
  // phase. The items table is now strictly read-only — qty and
  // price per unit are whatever the order arrived with, and any
  // line-level adjustments would need to happen via a future
  // dedicated flow. Status transitions (Confirm / Cancel / Mark
  // as Delivered) remain available on the action bar below.

  const getStatusBadge = (data: OrderDetails) => {
    const status = data.status;
    switch (status) {
      case "New":
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-base px-4 py-1">
            New Order
          </Badge>
        );
      case "Confirmed":
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200 text-base px-4 py-1">
            Confirmed
          </Badge>
        );
      case "In Progress":
        return (
          <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-base px-4 py-1">
            In Progress
          </Badge>
        );
      case "Cancelled": {
        // Mirror the list-page chip split — amber for buyer-side,
        // purple for seller-side. Default to Seller for legacy
        // un-stamped cancellations.
        const who = data.cancelledBy ?? "Seller";
        if (who === "Buyer") {
          return (
            <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-base px-4 py-1">
              Cancelled by Buyer
            </Badge>
          );
        }
        return (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-base px-4 py-1">
            Cancelled by Seller
          </Badge>
        );
      }
      case "Delivered":
        return (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-base px-4 py-1">
            Delivered
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelBadge = (channel: OrderDetails["channel"]) => {
    return <Badge variant="secondary" className="text-sm">{channel}</Badge>;
  };

  const handleConfirmOrder = () => {
    setIsConfirmModalOpen(true);
  };

  // Confirm-eligibility gate. The seller can only confirm orders
  // whose committed Delivery Day is today, tomorrow, or earlier.
  // We read the live shared-store record (instead of trusting an
  // older snapshot in `orderData`) so the gate stays in sync with
  // any list-page rescheduling. Returns the order + a verdict so the
  // modal body can branch on it without re-querying.
  const liveOrder = orderData.orderId
    ? getOrderById(orderData.orderId)
    : undefined;
  const canConfirmNow = liveOrder
    ? isConfirmableDeliveryDay(liveOrder.expectedDeliveryDate)
    : true;

  const handleConfirm = () => {
    if (!canConfirmNow) {
      // Defence in depth — the modal's primary CTA is already hidden
      // when the order is ineligible, so this only fires if a stray
      // call slips through.
      toast.error(
        "Delivery day is more than 1 day out. Come back the day before to confirm.",
      );
      return;
    }
    setOrderData((prev) => ({ ...prev, status: "Confirmed" }));
    // Write the new status back to the shared store so the list
    // page (and any other subscriber) sees the change.
    if (orderData.orderId) updateOrderStatus(orderData.orderId, "Confirmed");
    setIsConfirmModalOpen(false);
    toast.success("Order confirmed successfully!");
    setTimeout(() => {
      navigate("/orders");
    }, 1500);
  };

  const handleCancelOrder = () => {
    setIsCancelModalOpen(true);
  };

  const handleCancel = () => {
    const now = new Date().toISOString();
    setOrderData((prev) => ({
      ...prev,
      status: "Cancelled",
      cancellationReason: cancelReason,
      cancelledBy: "Seller",
      cancellationTime: now,
    }));
    if (orderData.orderId) {
      updateOrderStatus(orderData.orderId, "Cancelled", cancelReason, "Seller");
    }
    setIsCancelModalOpen(false);
    toast.error(`Order cancelled. Reason: ${cancelReason}`);
    setTimeout(() => {
      navigate("/orders");
    }, 1500);
  };

  // ---- Mark as Delivered (Confirmed → Delivered) ----
  // The Confirmed-status flow needs a follow-on "Mark as
  // Delivered" CTA. The detail page used to only handle New →
  // Confirmed; Phase 1 finishes the loop here.
  const handleMarkDelivered = () => {
    setIsDeliverModalOpen(true);
  };

  const handleConfirmDelivered = () => {
    setOrderData((prev) => ({ ...prev, status: "Delivered" }));
    if (orderData.orderId) updateOrderStatus(orderData.orderId, "Delivered");
    setIsDeliverModalOpen(false);
    toast.success("Order marked as delivered.");
    setTimeout(() => {
      navigate("/orders");
    }, 1500);
  };

  // Stock-availability warnings are no longer shown — distributors don't
  // maintain real-time stock counts (they sell offline & on other channels),
  // so the order line treats the entered qty as authoritative.

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/orders")}
              className="gap-1.5 h-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900 truncate">
                  Order #{orderData.orderId}
                </h1>
                {getStatusBadge(orderData)}
                {getChannelBadge(orderData.channel)}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                <Calendar className="h-3 w-3" />
                {orderData.orderTime}
                <span className="mx-1">•</span>
                <span className="font-mono">{orderData.channelOrderId}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
              {/* Status-aware CTAs.
                  New → Confirm Order + Cancel.
                  Confirmed → Mark as Delivered + Cancel.
                  Delivered / Cancelled → no destructive actions —
                  the order is past the seller's hand. */}
              {orderData.status === "New" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50 h-8"
                    onClick={handleCancelOrder}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 h-8"
                    onClick={handleConfirmOrder}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Confirm Order
                  </Button>
                </>
              )}
              {orderData.status === "Confirmed" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50 h-8"
                    onClick={handleCancelOrder}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 h-8"
                    onClick={handleMarkDelivered}
                  >
                    <Truck className="h-3.5 w-3.5 mr-1.5" />
                    Mark as Delivered
                  </Button>
                </>
              )}
            </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Cancellation banner — only renders when the order is in a
            terminal Cancelled state. Two variants:
              - Buyer-cancelled  → amber, signals the buyer pulled the
                plug via the buyer app (auto-processed; no seller
                action required).
              - Seller-cancelled → red, signals the seller's own
                cancel action from this page or the bulk list.
            Reads the timestamp + reason directly from the order
            so the cancelled-tab reviewer doesn't have to expand
            Order Meta to see the headline facts. */}
        {orderData.status === "Cancelled" &&
          (() => {
            const who = orderData.cancelledBy ?? "Seller";
            const whenLabel = formatCancellationTime(orderData.cancellationTime);
            const isBuyer = who === "Buyer";
            const wrap = isBuyer
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-red-50 border-red-200 text-red-900";
            const iconWrap = isBuyer ? "text-amber-600" : "text-red-600";
            return (
              <div
                className={`rounded-lg border ${wrap} px-4 py-3 flex items-start gap-3`}
                role="status"
                aria-live="polite"
              >
                <XCircle className={`h-5 w-5 mt-0.5 shrink-0 ${iconWrap}`} />
                <div className="min-w-0 text-sm leading-snug">
                  <p className="font-semibold">
                    This order was cancelled by the {isBuyer ? "buyer" : "seller"}
                    {whenLabel ? ` on ${whenLabel}` : ""}.
                  </p>
                  {orderData.cancellationReason && (
                    <p className="mt-0.5 text-xs">
                      <span className="font-medium">Reason:</span>{" "}
                      {orderData.cancellationReason}
                    </p>
                  )}
                  {isBuyer && (
                    <p className="mt-0.5 text-[11px] text-amber-800/80">
                      Auto-processed via the buyer app — no seller action required.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

        {/* Buyer / Seller / Order Meta — compact 3-up grid. Each
            column holds the bare minimum: a single identifier and
            the contact lines that the seller actually needs to
            reach out. Buyer code / Seller code / duplicate buyer
            name were retired here for clarity. */}
        <Card>
          <CardContent className="p-3 grid md:grid-cols-3 gap-3 text-sm">
            {/* Buyer */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Store className="h-3.5 w-3.5 text-blue-600" />
                Buyer
              </p>
              <p className="font-semibold text-gray-900 leading-snug">
                {orderData.buyerStoreName}
              </p>
              <p className="text-gray-700 flex items-center gap-1.5 text-xs">
                <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                {orderData.buyerPhone}
              </p>
              <p className="text-gray-600 flex gap-1.5 text-xs leading-snug">
                <MapPin className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                <span>{orderData.buyerAddress}</span>
              </p>
              {orderData.buyerAddress && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderData.buyerAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-0.5"
                >
                  <MapPin className="h-3 w-3" />
                  View on Map
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              <p className="text-gray-700 flex items-center gap-1.5 text-xs">
                <Hash className="h-3 w-3 text-gray-400 shrink-0" />
                <span className="text-gray-500 shrink-0">GST No.</span>
                <span className={orderData.gstNumber ? "font-mono" : "italic text-gray-400"}>
                  {orderData.gstNumber ?? "Not available"}
                </span>
              </p>
            </div>
            {/* Seller */}
            <div className="space-y-1.5 md:border-l md:pl-3 md:border-gray-200">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-green-600" />
                Seller
              </p>
              <p className="font-semibold text-gray-900 leading-snug">
                {orderData.sellerName}
              </p>
              <p className="text-gray-700 flex items-center gap-1.5 text-xs">
                <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                {orderData.sellerContact}
              </p>
            </div>
            {/* Order Meta */}
            <div className="space-y-1.5 md:border-l md:pl-3 md:border-gray-200">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-gray-600" />
                Order Meta
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Payment</span>
                <span className="text-gray-900 font-medium">
                  {orderData.paymentMode}
                </span>
              </div>
              <div className="flex justify-between text-xs gap-2">
                <span className="text-gray-500 shrink-0">Channel Order ID</span>
                <span className="text-gray-900 font-mono truncate">
                  {orderData.channelOrderId}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Original Value</span>
                <span className="text-gray-900 font-semibold">
                  ₹{orderData.orderValue.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Cancellation details — rendered inline as Order Meta
                  rows (same shape as Payment / Channel Order ID /
                  Original Value) so the column reads as one uniform
                  key-value list. Only appears for cancelled orders. */}
              {orderData.status === "Cancelled" && (
                <>
                  <div className="flex justify-between text-xs gap-2">
                    <span className="text-gray-500 shrink-0">Cancelled By</span>
                    <span className="text-gray-900 font-medium">
                      {orderData.cancelledBy ?? "Seller"}
                    </span>
                  </div>
                  {orderData.cancellationTime && (
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-gray-500 shrink-0">
                        Cancellation Time
                      </span>
                      <span className="text-gray-900 font-medium truncate">
                        {formatCancellationTime(orderData.cancellationTime)}
                      </span>
                    </div>
                  )}
                  {orderData.cancellationReason && (
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-gray-500 shrink-0">
                        Cancellation Reason
                      </span>
                      <span className="text-gray-900 font-medium truncate">
                        {orderData.cancellationReason}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product List.
            `gap-0` overrides the Card primitive's default `gap-6`
            so there's no 24px slot of whitespace between the
            CardHeader border-bottom and the table's <thead>.
            The `pb-2.5!` important suffix is here because the
            shadcn CardHeader primitive ships a default
            `[.border-b]:pb-6` rule — same-element arbitrary
            selector, higher specificity than plain `py-2.5` — so a
            non-important `pb-2.5` would lose. With the override
            the top and bottom of the heading have equal 10px
            spacing. */}
        <Card className="gap-0">
          <CardHeader className="pt-2.5 pb-2.5! px-3 border-b border-gray-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600" />
              Order Items ({orderData.products.length})
            </CardTitle>
          </CardHeader>
          {/* The `pb-0!` override is here because the shadcn
              CardContent ships with `[&:last-child]:pb-6` —
              arbitrary same-element selector, higher specificity
              than plain `p-0`. Without important, 24px of empty
              space stays at the bottom of the card below the last
              row. */}
          <CardContent className="p-0 pb-0!">
            <div className="overflow-hidden">
              <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b sticky top-0 z-[5]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Short Name
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Price/Unit
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orderData.products.map((product) => (
                      <React.Fragment key={product.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                              {product.qps && (
                                <Badge
                                  className="bg-purple-50 text-purple-700 border-purple-200 gap-1 text-[10px] py-0"
                                  title="Quantity Pricing Scheme applied to this line item"
                                >
                                  <Layers className="h-2.5 w-2.5" />
                                  QPS
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-mono text-gray-600">{product.skuId}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className="text-xs text-gray-600 max-w-[120px] truncate"
                              title={product.shortName ?? undefined}
                            >
                              {product.shortName ?? "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <p className="font-semibold text-gray-900">
                              {product.orderedQuantity}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {product.qps && product.basePrice ? (
                              <div>
                                <p className="text-[11px] text-gray-400 line-through">
                                  ₹{product.basePrice.toFixed(2)}
                                </p>
                                <p className="font-semibold text-green-700">
                                  ₹{product.pricePerUnit.toFixed(2)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-gray-900">₹{product.pricePerUnit}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-sm text-gray-900">
                              ₹
                              {product.totalPrice.toLocaleString("en-IN", {
                                minimumFractionDigits: product.totalPrice % 1 ? 2 : 0,
                              })}
                            </p>
                          </td>
                        </tr>
                        {product.qps && (
                          <QpsImpactRow product={product} />
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    {(() => {
                      const totalQpsSaving = orderData.products.reduce(
                        (sum, p) => sum + (p.qps?.totalSaving ?? 0),
                        0,
                      );
                      return (
                        <>
                          {totalQpsSaving > 0 && (
                            <tr className="bg-purple-50">
                              <td colSpan={5} className="px-4 py-3 text-right text-[11px] font-semibold text-purple-800">
                                Total QPS discount on this order
                              </td>
                              <td className="px-4 py-3 text-right text-xs font-bold text-purple-700">
                                −₹{totalQpsSaving.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold">
                              Total Order Value:
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-base text-green-600">
                              ₹
                              {orderData.orderValue.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirm Order Modal — gated by isConfirmableDeliveryDay. When
          the order's Delivery Day is more than 1 day out, the body
          swaps to an information panel and the primary CTA is hidden,
          mirroring the bulk dialog's "Cannot confirm yet" treatment. */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                canConfirmNow ? "text-green-600" : "text-amber-600"
              }`}
            >
              {canConfirmNow ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              {canConfirmNow ? "Confirm Order" : "Cannot confirm yet"}
            </DialogTitle>
            <DialogDescription>
              {canConfirmNow
                ? "Are you sure you want to confirm this order?"
                : "Sellers can confirm orders delivering today, tomorrow, or earlier. This order's Delivery Day is further out."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm">
                <strong>Order ID:</strong> {orderData.orderId}
              </p>
              <p className="text-sm">
                <strong>Buyer:</strong> {orderData.buyerStoreName}
              </p>
              <p className="text-sm">
                <strong>Total Items:</strong> {orderData.products.length}
              </p>
              <p className="text-sm">
                <strong>Order Value:</strong> ₹{orderData.orderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              {liveOrder && (
                <p className="text-sm">
                  <strong>Delivery Day:</strong> {liveOrder.expectedDeliveryDate}
                </p>
              )}
            </div>
            {canConfirmNow ? (
              <p className="text-sm text-gray-600 mt-4">
                After confirmation, the buyer will be notified and you can proceed with fulfillment.
              </p>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <p>
                  Confirmation window opens <b>1 day before</b> the
                  Delivery Day. Come back closer to the date — the order
                  stays in <b>New</b> in the meantime.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              {canConfirmNow ? "Cancel" : "Close"}
            </Button>
            {canConfirmNow && (
              <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
                Yes, Confirm Order
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Modal — mirrors the bulk Cancel Orders popup on
          the list page so the seller sees one consistent cancellation
          surface regardless of where they triggered it. Reason is a
          single Select (no per-option radios, no "Other" textarea). */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Cancel Order
            </DialogTitle>
            <DialogDescription>
              Cancel this order. Please provide a reason for cancellation.
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
              onClick={() => setIsCancelModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim()}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Delivered Modal — confirmation step for the
          Confirmed → Delivered transition. */}
      <Dialog open={isDeliverModalOpen} onOpenChange={setIsDeliverModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-600" />
              Mark as Delivered
            </DialogTitle>
            <DialogDescription>
              Confirm that Order #{orderData.orderId} has been delivered to{" "}
              {orderData.buyerStoreName}. This action moves the order to the
              Delivered tab and can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeliverModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelivered}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Truck className="h-4 w-4 mr-1.5" />
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- QPS impact row ----------
// Read-only banner shown directly under each QPS-eligible line item.
// Two pieces:
//   1. The compact one-liner naming the active slab + line saving —
//      always visible.
//   2. The full QPS schedule (Slab / Qty range / Discount /
//      Price-per-unit) — only visible while the seller is in Modify
//      Items mode. Before that, surfacing every slab tier is noise;
//      the seller already sees which slab applies via the one-liner
//      and the highlighted active row in the schedule once they
//      open it. The currently-applied slab is softly highlighted.
//
// Edit-mode affordances that USED to live here (Was → Now diff,
// Slab dropped / upgraded chips, "Apply slab price" CTA) are
// intentionally absent — they surface inside the Save Changes popup
// once the seller commits. The "Active" column was also dropped
// from the table; the row highlight communicates the same thing.
function QpsImpactRow({ product }: { product: OrderProduct }) {
  const qps = product.qps!;
  const base = product.basePrice ?? 0;
  return (
    <tr className="bg-purple-50/40">
      <td colSpan={6} className="px-4 py-3">
        {/* Compact one-liner — the full slab schedule used to live
            below this strip but only rendered in Modify Items mode,
            which has been retired. Sellers who need the slab
            breakdown can open the QPS scheme in Offers & Schemes. */}
        <div className="flex items-center gap-2 text-[11px] text-purple-900 flex-wrap">
          <Layers className="h-3 w-3 text-purple-600 shrink-0" />
          <span>
            <b>{qps.slabLabel}</b> · {qps.discountLabel}
            {base > 0 && <> vs ₹{base.toFixed(2)}</>}
          </span>
          <span className="text-purple-700 inline-flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            saved <b>₹{qps.totalSaving.toFixed(2)}</b>
          </span>
          {/* Offer Code lives here, on the same line as the slab +
              discount + saving summary — keeps the trace next to
              the offer details rather than under the product name. */}
          {qps.offerCode && (
            <span className="text-purple-800 font-mono">
              · Offer: <b>{qps.offerCode}</b>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

