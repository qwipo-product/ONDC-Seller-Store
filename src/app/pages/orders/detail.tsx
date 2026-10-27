import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
  Pencil,
  Lock,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
// Shared orders store — the detail page now looks up the right
// order by URL :orderId rather than rendering a single hard-coded
// mock for every route. Status writes (confirm / cancel / mark as
// delivered) flow back through `updateOrderStatus` so the list
// page's subscribe callback sees the change.
import {
  getOrderById,
  getCheckoutOrders,
  getCustomerOrderId,
  getOrderLines,
  type Order as StoreOrder,
  updateOrderStatus,
  subscribeToOrders,
  synthesizeProducts,
  getSkuPackConfig,
  canModifyOrderLines,
  validateModifiedQty,
  modifyOrderLineQty,
  SELLER_INFO,
  type Order,
  type CancelledBy,
  type SkuPackConfig,
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
  /** Quantity the buyer ordered — the "Actual Qty" column. */
  orderedQuantity: number;
  /** Seller-edited quantity; undefined while the line is as ordered. */
  modifiedQty?: number;
  /** Inner Pack / UPC from the SKU master; undefined when not configured. */
  pack?: SkuPackConfig;
  availableStock: number;
  pricePerUnit: number;
  /** Line total as ordered — see {@link priceLine} for the final pricing. */
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

// ---------- Line pricing ----------
// A seller quantity edit re-prices the line against the SKU's QPS slab
// schedule: trimming a line can drop it to a lower slab, or below the
// first discounted slab so the offer no longer applies. Lines without
// a slab schedule keep their ordered price.

const round2 = (n: number) => Math.round(n * 100) / 100;

const finalQtyFor = (p: OrderProduct) => p.modifiedQty ?? p.orderedQuantity;

function findSlabIdx(slabs: QpsSlabDef[], qty: number): number {
  return slabs.findIndex(
    (s) => qty >= s.minQty && (s.maxQty === undefined || qty <= s.maxQty),
  );
}

/** e.g. "Slab 2 · 12–47 qty" / "Slab 3 · 48+ qty". */
function slabLabelFor(slabs: QpsSlabDef[], idx: number): string {
  const s = slabs[idx];
  const range = s.maxQty === undefined ? `${s.minQty}+` : `${s.minQty}–${s.maxQty}`;
  return `Slab ${idx + 1} · ${range} qty`;
}

/** A slab with no discount means the offer doesn't apply. */
const slabHasOffer = (s: QpsSlabDef | undefined) =>
  !!s && s.discountLabel !== "—";

interface LinePricing {
  qty: number;
  pricePerUnit: number;
  lineTotal: number;
  /** Offer saving on the line vs the base price. */
  saving: number;
  /** Index into `qps.slabs`; -1 when the line has no slab schedule. */
  slabIdx: number;
  slab?: QpsSlabDef;
}

/** Price `p` at `qty` pieces. The ordered quantity returns the line
 *  exactly as ordered (no rounding drift against the order value). */
function priceLine(p: OrderProduct, qty = finalQtyFor(p)): LinePricing {
  const slabs = p.qps?.slabs;
  const slabIdx = slabs ? findSlabIdx(slabs, qty) : -1;
  const slab = slabs && slabIdx >= 0 ? slabs[slabIdx] : undefined;
  if (qty === p.orderedQuantity) {
    return {
      qty,
      pricePerUnit: p.pricePerUnit,
      lineTotal: p.totalPrice,
      saving: p.qps?.totalSaving ?? 0,
      slabIdx,
      slab,
    };
  }
  const pricePerUnit = slab ? slab.pricePerUnit : p.pricePerUnit;
  const base = p.basePrice ?? pricePerUnit;
  return {
    qty,
    pricePerUnit,
    lineTotal: round2(qty * pricePerUnit),
    saving: p.qps ? round2((base - pricePerUnit) * qty) : 0,
    slabIdx,
    slab,
  };
}

const formatRupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  /** Current (final) order value — reflects any quantity edits. */
  orderValue: number;
  /** As-placed value; set only once a line quantity has been modified. */
  originalOrderValue?: number;
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
  // Seller quantity edits and the SKU's pack config ride along too.
  const products = rawProducts.map((p) => ({
    ...p,
    shortName:
      p.shortName ??
      sampleSKUs.find((s) => s.sku === p.skuId)?.shortName,
    modifiedQty: order.qtyModifications?.[p.skuId]?.modifiedQty,
    pack: getSkuPackConfig(p.skuId),
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
    originalOrderValue: order.originalOrderValue,
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
    // This order has 160 units (10 inner packs of 16) → falls in Slab 3, 10% off.
    id: "1",
    name: "Freedom Refined Sunflower Oil 1L × 16",
    skuId: "180000008",
    shortName: "FFR1",
    orderedQuantity: 160,
    availableStock: 642,
    basePrice: 171,
    pricePerUnit: 153.9,
    totalPrice: 24624,
    qps: {
      offerCode: "QPS-180000008",
      slabLabel: "Slab 3 · 48+ qty",
      discountLabel: "10% off",
      savingPerUnit: 17.1,
      totalSaving: 2736,
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
  // notification (bulk confirm/cancel/deliver from the list page,
  // or a line quantity edit from this page).
  useEffect(() => {
    const refresh = () => {
      if (!orderId) return;
      const o = getOrderById(orderId);
      if (o) setOrderData(buildOrderDetailFromStore(o));
    };
    refresh();
    return subscribeToOrders(refresh);
  }, [orderId]);

  // Customer-order mode — opened from the Orders list's Customer-wise
  // view (?view=customer). When this order's customer checkout holds
  // more than one company order, the page lists all of them with their
  // own Confirm / Cancel / Mark as Delivered actions instead of this
  // single order's items.
  const [searchParams] = useSearchParams();
  const checkoutId = initialOrder ? getCustomerOrderId(initialOrder) : undefined;
  const [checkoutOrders, setCheckoutOrders] = useState<StoreOrder[]>(() =>
    checkoutId ? getCheckoutOrders(checkoutId) : [],
  );
  useEffect(() => {
    if (!checkoutId) return;
    const refresh = () => setCheckoutOrders(getCheckoutOrders(checkoutId));
    refresh();
    return subscribeToOrders(refresh);
  }, [checkoutId]);
  const isCustomerMode =
    searchParams.get("view") === "customer" && checkoutOrders.length > 1;

  // Which order the Confirm / Cancel / Deliver popups act on — this
  // page's order by default, or the company order whose row button was
  // pressed in customer-order mode.
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  // Bulk actions in customer-order mode — the company orders the open
  // Confirm / Cancel popup acts on together (null = single order).
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);
  const confirmableIds = checkoutOrders
    .filter((o) => o.status === "New")
    .map((o) => o.id);
  const cancellableIds = checkoutOrders
    .filter(
      (o) =>
        o.status === "New" ||
        (o.status === "Confirmed" && !o.logisticsRequested),
    )
    .map((o) => o.id);
  const bulkOrders = bulkIds
    ? checkoutOrders.filter((o) => bulkIds.includes(o.id))
    : [];
  const actionStoreOrder = actionOrderId ? getOrderById(actionOrderId) : undefined;
  const actionData: OrderDetails = actionStoreOrder
    ? buildOrderDetailFromStore(actionStoreOrder)
    : orderData;
  const targetId = actionData.orderId;
  // In customer-order mode the seller stays on the page to work through
  // the other company orders; otherwise keep the existing return to the
  // list.
  const afterAction = () => {
    setActionOrderId(null);
    setBulkIds(null);
    if (!isCustomerMode) {
      setTimeout(() => {
        navigate("/orders");
      }, 1500);
    }
  };

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  // Detail page reuses the bulk cancel popup's shape so the seller
  // sees one consistent cancellation experience regardless of where
  // they triggered it.
  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Order modification — per-line quantity edit, New orders only.
  // `editTarget` outlives `isEditOpen` so the popup keeps its
  // content through the close animation.
  const [editTarget, setEditTarget] = useState<OrderProduct | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  // Total Value fee-breakdown accordion (Order Meta).
  const [feeOpen, setFeeOpen] = useState(false);
  const canEdit = canModifyOrderLines(orderData);
  const isModified = orderData.originalOrderValue !== undefined;
  const modifiedLineCount = orderData.products.filter(
    (p) => p.modifiedQty !== undefined,
  ).length;
  // Product / SKU / Short Name / Actual / Modified / Final / Price / Total (+ Edit)
  const columnCount = canEdit ? 9 : 8;

  const handleEditLine = (product: OrderProduct) => {
    setEditTarget(product);
    setIsEditOpen(true);
  };

  const handleSaveLineQty = (product: OrderProduct, qty: number) => {
    const ordered = priceLine(product, product.orderedQuantity);
    const revised = priceLine(product, qty);
    const saved = modifyOrderLineQty(orderData.orderId, product.skuId, {
      actualQty: product.orderedQuantity,
      modifiedQty: qty,
      pricePerUnit: revised.pricePerUnit,
      actualLineTotal: product.totalPrice,
    });
    if (!saved) {
      toast.error("This order can no longer be modified.");
      return;
    }
    setIsEditOpen(false);
    if (qty === product.orderedQuantity) {
      toast.success(`${product.name} is back to the ordered quantity (${qty} pcs).`);
      return;
    }
    const slabChanged = ordered.slabIdx !== revised.slabIdx;
    toast.success(
      `Quantity updated successfully — ${product.name}: ${product.orderedQuantity} → ${qty} pcs.`,
      slabChanged && product.qps?.slabs
        ? {
            description: slabHasOffer(revised.slab)
              ? `Offer revised to ${slabLabelFor(product.qps.slabs, revised.slabIdx)} — ${formatRupees(revised.pricePerUnit)}/unit.`
              : `Offer ${product.qps.offerCode} no longer applies — ${formatRupees(revised.pricePerUnit)}/unit.`,
          }
        : undefined,
    );
  };

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
              Cancelled by Customer
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
    setActionOrderId(null);
    setBulkIds(null);
    setIsConfirmModalOpen(true);
  };

  const handleConfirm = () => {
    if (bulkIds) {
      for (const id of bulkIds) updateOrderStatus(id, "Confirmed");
      if (bulkIds.includes(orderData.orderId)) {
        setOrderData((prev) => ({ ...prev, status: "Confirmed" }));
      }
      setIsConfirmModalOpen(false);
      toast.success(
        `${bulkIds.length} order${bulkIds.length === 1 ? "" : "s"} confirmed successfully!`,
      );
      afterAction();
      return;
    }
    if (targetId === orderData.orderId) {
      setOrderData((prev) => ({ ...prev, status: "Confirmed" }));
    }
    // Write the new status back to the shared store so the list
    // page (and any other subscriber) sees the change.
    if (targetId) updateOrderStatus(targetId, "Confirmed");
    setIsConfirmModalOpen(false);
    toast.success("Order confirmed successfully!");
    afterAction();
  };

  const handleCancelOrder = () => {
    setActionOrderId(null);
    setBulkIds(null);
    setIsCancelModalOpen(true);
  };

  const handleCancel = () => {
    const now = new Date().toISOString();
    if (bulkIds) {
      for (const id of bulkIds) {
        updateOrderStatus(id, "Cancelled", cancelReason, "Seller");
      }
      if (bulkIds.includes(orderData.orderId)) {
        setOrderData((prev) => ({
          ...prev,
          status: "Cancelled",
          cancellationReason: cancelReason,
          cancelledBy: "Seller",
          cancellationTime: now,
        }));
      }
      setIsCancelModalOpen(false);
      toast.error(
        `${bulkIds.length} order${bulkIds.length === 1 ? "" : "s"} cancelled. Reason: ${cancelReason}`,
      );
      setCancelReason("");
      afterAction();
      return;
    }
    if (targetId === orderData.orderId) {
      setOrderData((prev) => ({
        ...prev,
        status: "Cancelled",
        cancellationReason: cancelReason,
        cancelledBy: "Seller",
        cancellationTime: now,
      }));
    }
    if (targetId) {
      updateOrderStatus(targetId, "Cancelled", cancelReason, "Seller");
    }
    setIsCancelModalOpen(false);
    toast.error(`Order cancelled. Reason: ${cancelReason}`);
    setCancelReason("");
    afterAction();
  };

  // ---- Mark as Delivered (Confirmed → Delivered) ----
  // The Confirmed-status flow needs a follow-on "Mark as
  // Delivered" CTA. The detail page used to only handle New →
  // Confirmed; Phase 1 finishes the loop here.
  const handleMarkDelivered = () => {
    setActionOrderId(null);
    setIsDeliverModalOpen(true);
  };

  const handleConfirmDelivered = () => {
    if (targetId === orderData.orderId) {
      setOrderData((prev) => ({ ...prev, status: "Delivered" }));
    }
    if (targetId) updateOrderStatus(targetId, "Delivered");
    setIsDeliverModalOpen(false);
    toast.success("Order marked as delivered.");
    afterAction();
  };

  // Header bulk actions in customer-order mode: aim the Confirm /
  // Cancel popups at every eligible company order at once.
  const openBulk = (action: "confirm" | "cancel") => {
    setActionOrderId(null);
    setBulkIds(action === "confirm" ? confirmableIds : cancellableIds);
    if (action === "confirm") setIsConfirmModalOpen(true);
    else setIsCancelModalOpen(true);
  };

  // Row actions in customer-order mode: aim the existing popups at one
  // company order.
  const openActionFor = (
    id: string,
    action: "confirm" | "cancel" | "deliver",
  ) => {
    setActionOrderId(id);
    setBulkIds(null);
    if (action === "confirm") setIsConfirmModalOpen(true);
    else if (action === "cancel") setIsCancelModalOpen(true);
    else setIsDeliverModalOpen(true);
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
              onClick={() =>
                navigate(isCustomerMode ? "/orders?view=customer" : "/orders")
              }
              className="gap-1.5 h-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Customer-order mode leads with the customer — one
                    name across all its company orders. */}
                <h1 className="text-lg font-semibold text-gray-900 truncate">
                  {isCustomerMode
                    ? orderData.buyerStoreName
                    : `Order #${orderData.orderId}`}
                </h1>
                {isCustomerMode ? (
                  <Badge variant="outline" className="text-sm">
                    {checkoutOrders.length} company orders
                  </Badge>
                ) : (
                  getStatusBadge(orderData)
                )}
                {getChannelBadge(orderData.channel)}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                <Calendar className="h-3 w-3" />
                {orderData.orderTime}
                <span className="mx-1">•</span>
                <span className="font-mono">
                  {isCustomerMode
                    ? `Parent Order ID ${checkoutId}`
                    : orderData.channelOrderId}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
              {/* Status-aware CTAs.
                  New → Confirm Order + Cancel.
                  Confirmed → Mark as Delivered + Cancel.
                  Delivered / Cancelled → no destructive actions —
                  the order is past the seller's hand. */}
              {/* Customer-order mode: bulk Confirm / Cancel across the
                  company orders; each order keeps its own buttons in
                  the Orders list below. */}
              {isCustomerMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50 h-8"
                    disabled={cancellableIds.length === 0}
                    onClick={() => openBulk("cancel")}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Cancel All ({cancellableIds.length})
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 h-8"
                    disabled={confirmableIds.length === 0}
                    onClick={() => openBulk("confirm")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Confirm All ({confirmableIds.length})
                  </Button>
                </>
              )}
              {!isCustomerMode && orderData.status === "New" && (
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
              {!isCustomerMode && orderData.status === "Confirmed" && (
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
        {!isCustomerMode && orderData.status === "Cancelled" &&
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
                    This order was cancelled by the {isBuyer ? "customer" : "seller"}
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
            {/* Order Meta — customer-order mode summarises every company
                order in the checkout. */}
            {isCustomerMode ? (
            <div className="space-y-1.5 md:border-l md:pl-3 md:border-gray-200">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-gray-600" />
                Order Meta
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Company Orders</span>
                <span className="text-gray-900 font-medium">{checkoutOrders.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Items</span>
                <span className="text-gray-900 font-medium">
                  {checkoutOrders.reduce((n, o) => n + getOrderLines(o).length, 0)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Payment</span>
                <span className="text-gray-900 font-medium">{orderData.paymentMode}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Value</span>
                <span className="text-emerald-700 font-semibold">
                  {formatRupees(checkoutOrders.reduce((n, o) => n + o.orderValue, 0))}
                </span>
              </div>
            </div>
            ) : (
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
              {/* Total Value — click the chevron to expand the fee
                  breakdown (retailer-facing vs seller-borne). Fees are a
                  % of GMV, split between retailer and seller, mirroring the
                  Super Admin commercial + logistics setup. */}
              {(() => {
                const totalValue =
                  orderData.originalOrderValue ?? orderData.orderValue;
                // Example setup: a small % of GMV split retailer / seller.
                //   Commercial fee: 0.5% total → retailer 0.2% + seller 0.3%
                //   Logistics fee:  0.3% total → retailer 0.1% + seller 0.2%
                const retailerCommercial = +(totalValue * 0.002).toFixed(2);
                const sellerCommercial = +(totalValue * 0.003).toFixed(2);
                const retailerLogistics = +(totalValue * 0.001).toFixed(2);
                const sellerLogistics = +(totalValue * 0.002).toFixed(2);
                const toBeCollected = +(
                  totalValue + retailerLogistics + retailerCommercial
                ).toFixed(2);
                // Grand total of everything — what's collected from the
                // retailer plus the seller's own logistics + commercial fees.
                const grandTotal = +(
                  toBeCollected + sellerLogistics + sellerCommercial
                ).toFixed(2);
                const money = (n: number) =>
                  `₹${n.toLocaleString("en-IN", {
                    minimumFractionDigits: n % 1 ? 2 : 0,
                    maximumFractionDigits: 2,
                  })}`;
                const Row = ({
                  label,
                  value,
                  bold,
                }: {
                  label: string;
                  value: number;
                  bold?: boolean;
                }) => (
                  <div className="flex justify-between gap-2">
                    <span
                      className={
                        bold ? "text-gray-900 font-semibold" : "text-gray-500"
                      }
                    >
                      {label}
                    </span>
                    <span
                      className={
                        bold
                          ? "text-gray-900 font-bold"
                          : "text-gray-900 font-medium"
                      }
                    >
                      {money(value)}
                    </span>
                  </div>
                );
                return (
                  <div className="text-xs">
                    <button
                      type="button"
                      onClick={() => setFeeOpen((o) => !o)}
                      className="w-full flex justify-between items-center gap-2 text-left"
                      aria-expanded={feeOpen}
                    >
                      <span className="text-gray-500 flex items-center gap-1">
                        Total Value
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                            feeOpen ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                      <span className="text-gray-900 font-semibold">
                        {money(grandTotal)}
                      </span>
                    </button>
                    {feeOpen && (
                      <div className="mt-1.5 rounded-md border border-gray-200 bg-gray-50/70 p-2 space-y-1">
                        <Row label="Total Order Value" value={totalValue} />
                        <Row label="Retailer Logistics Fee" value={retailerLogistics} />
                        <Row label="Retailer Commercial Fees" value={retailerCommercial} />
                        <Row label="To be collected from retailer" value={toBeCollected} bold />
                        <div className="border-t border-gray-200 my-1.5" />
                        <Row label="Seller Logistics Fees" value={sellerLogistics} />
                        <Row label="Seller Commercial Fees" value={sellerCommercial} />
                        <div className="border-t border-gray-200 my-1.5" />
                        <Row label="Total Value" value={grandTotal} bold />
                      </div>
                    )}
                  </div>
                );
              })()}
              {isModified && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Final Value</span>
                  <span className="text-green-700 font-semibold">
                    ₹
                    {orderData.orderValue.toLocaleString("en-IN", {
                      minimumFractionDigits: orderData.orderValue % 1 ? 2 : 0,
                    })}
                  </span>
                </div>
              )}

              {/* Cancellation details — rendered inline as Order Meta
                  rows (same shape as Payment / Channel Order ID /
                  Original Value) so the column reads as one uniform
                  key-value list. Only appears for cancelled orders. */}
              {orderData.status === "Cancelled" && (
                <>
                  <div className="flex justify-between text-xs gap-2">
                    <span className="text-gray-500 shrink-0">Cancelled By</span>
                    <span className="text-gray-900 font-medium">
                      {orderData.cancelledBy === "Buyer" ? "Customer" : "Seller"}
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
            )}
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
        {isCustomerMode ? (
        <Card className="gap-0">
          <CardHeader className="pt-2.5 pb-2.5! px-3 border-b border-gray-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600" />
              Orders ({checkoutOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-0!">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Order ID", "Company", "Items", "Delivery Date", "Order Value", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2 text-[10px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap ${h === "Order Value" ? "text-right" : h === "Actions" ? "text-center" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {checkoutOrders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${o.id}`)}
                          className="text-[11px] font-mono text-blue-600 hover:text-blue-700 hover:underline"
                          title="View order details"
                        >
                          {o.id}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                        {o.company}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        <span title={o.itemsSummary}>
                          {getOrderLines(o).length} · {o.itemsSummary}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 tabular-nums whitespace-nowrap">
                        {o.expectedDeliveryDate}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                        {formatRupees(o.orderValue)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {o.status === "New" && (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200">New Order</Badge>
                        )}
                        {o.status === "Confirmed" && (
                          <Badge className="bg-green-50 text-green-700 border-green-200">Confirmed</Badge>
                        )}
                        {o.status === "Delivered" && (
                          <Badge className="bg-purple-50 text-purple-700 border-purple-200">Delivered</Badge>
                        )}
                        {o.status === "Cancelled" && (
                          (o.cancelledBy ?? "Seller") === "Buyer" ? (
                            <Badge className="bg-amber-50 text-amber-800 border-amber-200">Cancelled by Customer</Badge>
                          ) : (
                            <Badge className="bg-purple-50 text-purple-700 border-purple-200">Cancelled by Seller</Badge>
                          )
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {(o.status === "New" || o.status === "Confirmed") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-300 text-red-700 hover:bg-red-50 h-8"
                              onClick={() => openActionFor(o.id, "cancel")}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Cancel
                            </Button>
                          )}
                          {o.status === "New" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 h-8"
                              onClick={() => openActionFor(o.id, "confirm")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              Confirm Order
                            </Button>
                          )}
                          {o.status === "Confirmed" && !o.logisticsRequested && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 h-8"
                              onClick={() => openActionFor(o.id, "deliver")}
                            >
                              <Truck className="h-3.5 w-3.5 mr-1.5" />
                              Mark as Delivered
                            </Button>
                          )}
                          {(o.status === "Delivered" || o.status === "Cancelled") && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                      {formatRupees(checkoutOrders.reduce((n, o) => n + o.orderValue, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
        ) : (
                <Card className="gap-0">
          <CardHeader className="pt-2.5 pb-2.5! px-3 border-b border-gray-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600" />
              Order Items ({orderData.products.length})
              {modifiedLineCount > 0 && (
                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] py-0">
                  {modifiedLineCount} modified
                </Badge>
              )}
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
                        Actual Qty
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Modified Qty
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Final Qty
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Price/Unit
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        Total
                      </th>
                      {canEdit && (
                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orderData.products.map((product) => {
                      const isLineModified = product.modifiedQty !== undefined;
                      const pricing = priceLine(product);
                      const finalTotal = pricing.lineTotal;
                      const isDiscounted =
                        product.basePrice !== undefined &&
                        pricing.pricePerUnit < product.basePrice;
                      const priceChanged = pricing.pricePerUnit !== product.pricePerUnit;
                      return (
                      <React.Fragment key={product.id}>
                        <tr className={isLineModified ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-gray-50"}>
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
                            <p className="text-gray-700">{product.orderedQuantity}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isLineModified ? (
                              <div>
                                <p className="font-semibold text-amber-700">
                                  {product.modifiedQty}
                                </p>
                                <p className="text-[10px] text-red-600">
                                  −{product.orderedQuantity - product.modifiedQty!}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <p className="font-semibold text-gray-900">
                              {finalQtyFor(product)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {product.qps && isDiscounted ? (
                              <div>
                                <p className="text-[11px] text-gray-400 line-through">
                                  ₹{product.basePrice!.toFixed(2)}
                                </p>
                                <p className="font-semibold text-green-700">
                                  ₹{pricing.pricePerUnit.toFixed(2)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-gray-900">
                                ₹{product.qps ? pricing.pricePerUnit.toFixed(2) : pricing.pricePerUnit}
                              </p>
                            )}
                            {priceChanged && (
                              <p className="text-[10px] text-amber-700">
                                was ₹{product.pricePerUnit.toFixed(2)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isLineModified && (
                              <p className="text-[11px] text-gray-400 line-through">
                                ₹
                                {product.totalPrice.toLocaleString("en-IN", {
                                  minimumFractionDigits: product.totalPrice % 1 ? 2 : 0,
                                })}
                              </p>
                            )}
                            <p className="font-semibold text-sm text-gray-900">
                              ₹
                              {finalTotal.toLocaleString("en-IN", {
                                minimumFractionDigits: finalTotal % 1 ? 2 : 0,
                              })}
                            </p>
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => handleEditLine(product)}
                                aria-label={`Edit quantity for ${product.name}`}
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </Button>
                            </td>
                          )}
                        </tr>
                        {product.qps && (
                          <QpsImpactRow product={product} colSpan={columnCount} />
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    {(() => {
                      const totalQpsSaving = orderData.products.reduce(
                        (sum, p) => sum + qpsSavingFor(p),
                        0,
                      );
                      // Label cells span everything left of Total; the
                      // Action column (New orders) gets an empty cell.
                      const labelSpan = 7;
                      const actionCell = canEdit ? <td /> : null;
                      return (
                        <>
                          {totalQpsSaving > 0 && (
                            <tr className="bg-purple-50">
                              <td colSpan={labelSpan} className="px-4 py-3 text-right text-[11px] font-semibold text-purple-800">
                                Total QPS discount on this order
                              </td>
                              <td className="px-4 py-3 text-right text-xs font-bold text-purple-700">
                                −{formatRupees(totalQpsSaving)}
                              </td>
                              {actionCell}
                            </tr>
                          )}
                          {isModified && (
                            <>
                              <tr>
                                <td colSpan={labelSpan} className="px-4 pt-3 pb-1 text-right text-xs text-gray-600">
                                  Original Order Value:
                                </td>
                                <td className="px-4 pt-3 pb-1 text-right text-xs text-gray-700">
                                  {formatRupees(orderData.originalOrderValue!)}
                                </td>
                                {actionCell}
                              </tr>
                              <tr>
                                <td colSpan={labelSpan} className="px-4 py-1 text-right text-xs text-gray-600">
                                  Modification adjustment:
                                </td>
                                <td className="px-4 py-1 text-right text-xs font-semibold text-red-600">
                                  −{formatRupees(round2(orderData.originalOrderValue! - orderData.orderValue))}
                                </td>
                                {actionCell}
                              </tr>
                            </>
                          )}
                          <tr>
                            <td colSpan={labelSpan} className="px-4 py-3 text-right text-sm font-semibold">
                              {isModified ? "Final Order Value:" : "Total Order Value:"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-base text-green-600">
                              {formatRupees(orderData.orderValue)}
                            </td>
                            {actionCell}
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
        )}
      </div>

      {/* Confirm Order Modal — no delivery-day gate; any New order can
          be confirmed regardless of how far out its Delivery Day is. */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              {bulkIds ? "Confirm Orders" : "Confirm Order"}
            </DialogTitle>
            <DialogDescription>
              {bulkIds
                ? `Are you sure you want to confirm ${bulkIds.length} order${bulkIds.length === 1 ? "" : "s"} for ${orderData.buyerStoreName}?`
                : "Are you sure you want to confirm this order?"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {bulkIds ? (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                {bulkOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900">{o.company}</span>{" "}
                      <span className="text-[11px] font-mono text-gray-500">{o.id}</span>
                    </span>
                    <span className="tabular-nums text-gray-900">
                      ₹{o.orderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 text-sm border-t border-gray-200 pt-2">
                  <strong>Total</strong>
                  <strong className="tabular-nums">
                    ₹{bulkOrders.reduce((n, o) => n + o.orderValue, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            ) : (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm">
                <strong>Order ID:</strong> {actionData.orderId}
              </p>
              <p className="text-sm">
                <strong>Buyer:</strong> {actionData.buyerStoreName}
              </p>
              <p className="text-sm">
                <strong>Total Items:</strong> {actionData.products.length}
              </p>
              <p className="text-sm">
                <strong>Order Value:</strong> ₹{actionData.orderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            )}
            <p className="text-sm text-gray-600 mt-4">
              After confirmation, the buyer will be notified and you can proceed with fulfillment.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
              {bulkIds
                ? `Yes, Confirm ${bulkIds.length} Order${bulkIds.length === 1 ? "" : "s"}`
                : "Yes, Confirm Order"}
            </Button>
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
              {bulkIds ? "Cancel Orders" : "Cancel Order"}
            </DialogTitle>
            <DialogDescription>
              {bulkIds
                ? `Cancel ${bulkIds.length} order${bulkIds.length === 1 ? "" : "s"} for ${orderData.buyerStoreName}. Please provide a reason for cancellation.`
                : "Cancel this order. Please provide a reason for cancellation."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {bulkIds && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                {bulkOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900">{o.company}</span>{" "}
                      <span className="text-[11px] font-mono text-gray-500">{o.id}</span>
                    </span>
                    <span className="tabular-nums text-gray-900">
                      ₹{o.orderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 text-sm border-t border-gray-200 pt-2">
                  <strong>Total</strong>
                  <strong className="tabular-nums">
                    ₹{bulkOrders.reduce((n, o) => n + o.orderValue, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            )}
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
              {bulkIds
                ? `Cancel ${bulkIds.length} Order${bulkIds.length === 1 ? "" : "s"}`
                : "Cancel Order"}
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
              Confirm that Order #{actionData.orderId} has been delivered to{" "}
              {actionData.buyerStoreName}. This action moves the order to the
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

      <EditQuantityDialog
        product={editTarget}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSave={handleSaveLineQty}
      />
    </div>
  );
}

// ---------- Edit Quantity popup ----------
// Seller-side quantity edit for one line of a New order. Inner Pack
// and UPC come from the SKU master and are shown as static values;
// the new quantity must be a multiple of the inner pack and can't go
// above what the buyer ordered. As the seller types, the line is
// re-priced against its QPS slabs and the Ordered vs Revised offer
// impact is shown before they save.
function EditQuantityDialog({
  product,
  open,
  onOpenChange,
  onSave,
}: {
  product: OrderProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (product: OrderProduct, qty: number) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Prefill with the line's current quantity each time the popup opens.
  useEffect(() => {
    if (!open || !product) return;
    setValue(String(finalQtyFor(product)));
    setError(null);
  }, [open, product]);

  if (!product) return null;

  const innerPack = product.pack?.innerPack ?? 1;
  const actualQty = product.orderedQuantity;
  const currentQty = finalQtyFor(product);
  const trimmed = value.trim();
  const isValid = validateModifiedQty(trimmed, { actualQty, innerPack }) === null;
  const newQty = isValid ? Number(trimmed) : undefined;
  const isUnchanged = newQty === currentQty;
  const ordered = priceLine(product, actualQty);
  const revised = newQty !== undefined ? priceLine(product, newQty) : undefined;

  const handleSave = () => {
    const message = validateModifiedQty(trimmed, { actualQty, innerPack });
    if (message) {
      setError(message);
      return;
    }
    onSave(product, Number(trimmed));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue-600" />
            Edit Quantity
          </DialogTitle>
          <DialogDescription>
            {product.name} · <span className="font-mono">{product.skuId}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Static reference values — one compact row, not editable here. */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-[11px] text-gray-500">Inner Pack</p>
              <p className="font-semibold text-gray-900">
                {product.pack ? `${product.pack.innerPack} pcs` : "Not configured"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">UPC (Units per Case)</p>
              <p className="font-semibold text-gray-900">
                {product.pack ? `${product.pack.upc} pcs` : "Not configured"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Actual Qty (ordered)</p>
              <p className="font-semibold text-gray-900">{actualQty} pcs</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Price/Unit (ordered)</p>
              <p className="font-semibold text-gray-900">
                {formatRupees(product.pricePerUnit)}
              </p>
            </div>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-500">
            <Lock className="h-3 w-3" />
            Inner Pack and UPC are configured on the SKU and can't be changed here.
          </p>
        </div>

        {/* Two columns on desktop so nothing needs scrolling: entry +
            offer status on the left, Ordered vs Revised on the right.
            Both columns render from the start so the layout doesn't
            jump while the seller types. */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="modifiedQty">
                Modified Quantity (pcs) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modifiedQty"
                type="number"
                inputMode="numeric"
                min={innerPack}
                max={actualQty}
                step={innerPack}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isUnchanged) handleSave();
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby="modifiedQty-help"
                autoFocus
              />
              {error ? (
                <p
                  id="modifiedQty-help"
                  role="alert"
                  className="flex items-start gap-1.5 text-xs text-red-600"
                >
                  <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                  {error}
                </p>
              ) : (
                <p id="modifiedQty-help" className="text-xs text-gray-500">
                  {innerPack > 1
                    ? `Enter a multiple of ${innerPack}, up to ${actualQty}.`
                    : `Enter a quantity up to ${actualQty}.`}
                </p>
              )}
            </div>

            <OfferChangeBanner product={product} ordered={ordered} revised={revised} />
            <SlabSchedule product={product} ordered={ordered} revised={revised} />
          </div>

          <PriceComparison product={product} ordered={ordered} revised={revised} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!trimmed || isUnchanged}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** QPS saving at the line's final quantity, after slab re-evaluation. */
const qpsSavingFor = (p: OrderProduct) => (p.qps ? priceLine(p).saving : 0);

// ---------- Offer impact (Edit Quantity popup) ----------
// Three pieces laid out side by side in the popup: a banner naming
// the slab change, the QPS slab schedule with the ordered + revised
// slabs marked, and the Ordered vs Revised comparison. `revised` is
// undefined while the typed quantity isn't valid yet.

interface OfferImpactProps {
  product: OrderProduct;
  ordered: LinePricing;
  revised?: LinePricing;
}

/** How the revised quantity moves the line across QPS slabs. */
function offerChangeOf({ product, ordered, revised }: OfferImpactProps) {
  const slabs = product.qps?.slabs;
  const slabChanged = !!slabs && !!revised && ordered.slabIdx !== revised.slabIdx;
  return {
    slabs,
    slabChanged,
    offerLost: slabChanged && !slabHasOffer(revised!.slab),
  };
}

function OfferChangeBanner(props: OfferImpactProps) {
  const { product, ordered, revised } = props;
  const { slabs, slabChanged, offerLost } = offerChangeOf(props);
  const qps = product.qps;
  // Nothing to say until there's a valid quantity that differs from
  // the order, or for lines without a slab schedule.
  if (!slabs || !qps || !revised || revised.qty === ordered.qty) return null;

  if (!slabChanged) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        Still in {slabLabelFor(slabs, revised.slabIdx)} · {revised.slab?.discountLabel} —
        price/unit unchanged.
      </div>
    );
  }

  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
        offerLost
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <AlertCircle
        className={`h-4 w-4 shrink-0 ${offerLost ? "text-red-600" : "text-amber-600"}`}
      />
      <p>
        {offerLost ? (
          <>
            <b>Offer {qps.offerCode} no longer applies.</b> {revised.qty} pcs is
            below the {slabs.find(slabHasOffer)?.minQty} pcs minimum, so the line
            goes back to the base price of {formatRupees(revised.pricePerUnit)}/unit.
          </>
        ) : (
          <>
            <b>
              Slab dropped: Slab {ordered.slabIdx + 1} → Slab {revised.slabIdx + 1}.
            </b>{" "}
            Discount falls from {ordered.slab?.discountLabel} to{" "}
            {revised.slab?.discountLabel}; price/unit rises to{" "}
            {formatRupees(revised.pricePerUnit)}.
          </>
        )}{" "}
        Offer saving drops by{" "}
        <b>{formatRupees(round2(ordered.saving - revised.saving))}</b>.
      </p>
    </div>
  );
}

function SlabSchedule(props: OfferImpactProps) {
  const { product, ordered, revised } = props;
  const { slabs, slabChanged, offerLost } = offerChangeOf(props);
  const qps = product.qps;
  if (!slabs || !qps) return null;
  const showRevised = !!revised && revised.qty !== ordered.qty;

  const revisedTone = offerLost
    ? { row: "bg-red-50/60", chip: "bg-red-50 text-red-700 border-red-200" }
    : slabChanged
      ? { row: "bg-amber-50/60", chip: "bg-amber-50 text-amber-800 border-amber-200" }
      : { row: "bg-green-50/60", chip: "bg-green-50 text-green-700 border-green-200" };

  return (
    <div className="overflow-hidden rounded-lg border border-purple-200">
      <p className="flex items-center gap-1.5 bg-purple-50 px-3 py-1.5 text-[11px] text-purple-900">
        <Layers className="h-3 w-3 text-purple-600" />
        QPS slabs · Offer <b className="font-mono">{qps.offerCode}</b>
      </p>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-gray-500">
          <tr className="border-b border-purple-100">
            <th className="px-3 py-1 text-left font-semibold">Slab</th>
            <th className="px-3 py-1 text-left font-semibold">Qty</th>
            <th className="px-3 py-1 text-left font-semibold">Discount</th>
            <th className="px-3 py-1 text-right font-semibold">Price/Unit</th>
            <th className="px-3 py-1" />
          </tr>
        </thead>
        <tbody className="divide-y divide-purple-50">
          {slabs.map((s, i) => {
            const isOrdered = i === ordered.slabIdx;
            const isRevised = showRevised && i === revised!.slabIdx;
            return (
              <tr
                key={i}
                className={isRevised ? revisedTone.row : isOrdered ? "bg-gray-50" : undefined}
              >
                <td className="px-3 py-1 text-gray-700">Slab {i + 1}</td>
                <td className="px-3 py-1 text-gray-700">
                  {s.maxQty === undefined ? `${s.minQty}+` : `${s.minQty}–${s.maxQty}`}
                </td>
                <td className="px-3 py-1 text-gray-700">{s.discountLabel}</td>
                <td className="px-3 py-1 text-right text-gray-900">
                  {formatRupees(s.pricePerUnit)}
                </td>
                <td className="px-3 py-1 text-right">
                  <span className="inline-flex gap-1">
                    {isOrdered && (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0">
                        Ordered
                      </Badge>
                    )}
                    {isRevised && (
                      <Badge className={`${revisedTone.chip} text-[10px] py-0`}>
                        Revised
                      </Badge>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PriceComparison(props: OfferImpactProps) {
  const { product, ordered, revised } = props;
  const { slabs, slabChanged } = offerChangeOf(props);
  const qps = product.qps;

  const slabText = (p: LinePricing) =>
    slabs && p.slabIdx >= 0 && slabHasOffer(p.slab)
      ? slabLabelFor(slabs, p.slabIdx)
      : "Not eligible";
  const discountText = (p: LinePricing) =>
    slabHasOffer(p.slab) ? p.slab!.discountLabel : "No discount";

  // `revised` cells read "—" until the typed quantity is valid.
  const rows: {
    label: string;
    ordered: string;
    revised?: string;
    tone?: "bad" | "strong";
  }[] = [
    { label: "Quantity", ordered: `${ordered.qty} pcs`, revised: revised && `${revised.qty} pcs` },
    ...(slabs
      ? [
          {
            label: "Offer slab",
            ordered: slabText(ordered),
            revised: revised && slabText(revised),
            tone: slabChanged ? ("bad" as const) : undefined,
          },
          {
            label: "Discount",
            ordered: discountText(ordered),
            revised: revised && discountText(revised),
            tone: slabChanged ? ("bad" as const) : undefined,
          },
        ]
      : []),
    {
      label: "Price/Unit",
      ordered: formatRupees(ordered.pricePerUnit),
      revised: revised && formatRupees(revised.pricePerUnit),
      tone:
        revised && revised.pricePerUnit > ordered.pricePerUnit ? "bad" : undefined,
    },
    ...(qps
      ? [
          {
            label: "Offer saving",
            ordered: formatRupees(ordered.saving),
            revised: revised && formatRupees(revised.saving),
          },
        ]
      : []),
    {
      label: "Line total",
      ordered: formatRupees(ordered.lineTotal),
      revised: revised && formatRupees(revised.lineTotal),
      tone: "strong",
    },
  ];

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-gray-900">Price &amp; offer impact</p>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-1.5 text-left font-semibold" />
              <th className="px-3 py-1.5 text-right font-semibold">Ordered</th>
              <th className="px-3 py-1.5 text-right font-semibold">Revised</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const changed = r.revised !== undefined && r.ordered !== r.revised;
              return (
                <tr key={r.label} className={r.tone === "strong" ? "bg-gray-50" : undefined}>
                  <td className="px-3 py-2 text-gray-600">{r.label}</td>
                  <td
                    className={`px-3 py-2 text-right ${
                      changed ? "text-gray-400 line-through" : "text-gray-700"
                    }`}
                  >
                    {r.ordered}
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${
                      r.revised === undefined
                        ? "text-gray-400"
                        : r.tone === "strong"
                          ? "font-bold text-gray-900"
                          : changed && r.tone === "bad"
                            ? "font-semibold text-red-600"
                            : "font-semibold text-gray-900"
                    }`}
                  >
                    {r.revised ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!qps && (
        <p className="text-[11px] text-gray-500">
          No offer on this SKU — price/unit stays as ordered.
        </p>
      )}
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
function QpsImpactRow({
  product,
  colSpan,
}: {
  product: OrderProduct;
  colSpan: number;
}) {
  const qps = product.qps!;
  const base = product.basePrice ?? 0;
  // After a quantity edit the line may sit in a lower slab (or none).
  const pricing = priceLine(product);
  const slabs = qps.slabs;
  const slabChanged =
    product.modifiedQty !== undefined &&
    !!slabs &&
    pricing.slabIdx !== findSlabIdx(slabs, product.orderedQuantity);
  const offerLost = slabChanged && !slabHasOffer(pricing.slab);
  return (
    <tr className="bg-purple-50/40">
      <td colSpan={colSpan} className="px-4 py-3">
        {/* Compact one-liner — the full slab schedule used to live
            below this strip but only rendered in Modify Items mode,
            which has been retired. Sellers who need the slab
            breakdown can open the QPS scheme in Offers & Schemes. */}
        <div className="flex items-center gap-2 text-[11px] text-purple-900 flex-wrap">
          <Layers className="h-3 w-3 text-purple-600 shrink-0" />
          {slabChanged && slabs ? (
            <span>
              <s className="text-purple-400">{qps.slabLabel}</s>
              {" → "}
              <b>
                {offerLost
                  ? "No offer slab"
                  : `${slabLabelFor(slabs, pricing.slabIdx)} · ${pricing.slab!.discountLabel}`}
              </b>
              {base > 0 && !offerLost && <> vs ₹{base.toFixed(2)}</>}
            </span>
          ) : (
            <span>
              <b>{qps.slabLabel}</b> · {qps.discountLabel}
              {base > 0 && <> vs ₹{base.toFixed(2)}</>}
            </span>
          )}
          {slabChanged && (
            <Badge
              className={
                offerLost
                  ? "bg-red-50 text-red-700 border-red-200 text-[10px] py-0"
                  : "bg-amber-50 text-amber-800 border-amber-200 text-[10px] py-0"
              }
            >
              {offerLost ? "Offer lost" : "Slab dropped"}
            </Badge>
          )}
          <span className="text-purple-700 inline-flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            saved <b>₹{pricing.saving.toFixed(2)}</b>
            {slabChanged && (
              <span className="text-purple-500">(was ₹{qps.totalSaving.toFixed(2)})</span>
            )}
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

