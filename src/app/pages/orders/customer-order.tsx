import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { EmptyState } from "../../components/empty-state";
import { CopyOnHover } from "../../components/copy-on-hover";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ExternalLink,
  Hash,
  Lock,
  MapPin,
  Package,
  Phone,
  Store,
  Truck,
} from "lucide-react";
import {
  type Order,
  getAttentionOrders,
  getCheckoutOrders,
  getOrderLines,
  getOrders,
  subscribeToOrders,
} from "../../lib/orders-data";

// Customer Order — the consolidated detail for one customer checkout,
// opened from the Orders list's Customer-wise view. Shows the buyer
// once, every product across the checkout's company orders (each line
// tagged with its company / brand), and a card per company order that
// links to the existing company order detail for billing and
// fulfilment. Read-only: status actions stay on the company orders.

const statusBadge = (order: Order) => {
  switch (order.status) {
    case "New":
      return <Badge className="bg-blue-50 text-blue-700 border-blue-200">New</Badge>;
    case "Confirmed":
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          {order.logisticsRequested ? "With 3PL partner" : "Confirmed"}
        </Badge>
      );
    case "Delivered":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
          Delivered
        </Badge>
      );
    case "Cancelled":
      return (order.cancelledBy ?? "Seller") === "Buyer" ? (
        <Badge className="bg-amber-50 text-amber-800 border-amber-200">
          Cancelled by Buyer
        </Badge>
      ) : (
        <Badge className="bg-purple-50 text-purple-700 border-purple-200">
          Cancelled by Seller
        </Badge>
      );
  }
};

const rupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CustomerOrderDetail() {
  const { checkoutId = "" } = useParams();
  const navigate = useNavigate();
  const backToList = () => navigate("/orders?view=customer");

  const [orders, setOrders] = useState<Order[]>(() =>
    getCheckoutOrders(checkoutId),
  );
  useEffect(() => {
    setOrders(getCheckoutOrders(checkoutId));
    return subscribeToOrders(() => setOrders(getCheckoutOrders(checkoutId)));
  }, [checkoutId]);

  // Same gate as the list: while older New orders are overdue, fresh
  // New orders stay hidden — a checkout holding one stays locked here
  // too, even if the URL is opened directly.
  const locked = useMemo(() => {
    const attention = getAttentionOrders(getOrders());
    if (attention.length === 0) return false;
    const attentionIds = new Set(attention.map((a) => a.order.id));
    return orders.some((o) => o.status === "New" && !attentionIds.has(o.id));
  }, [orders]);

  const lines = useMemo(
    () =>
      orders.flatMap((order) =>
        getOrderLines(order).map((line) => ({ order, line })),
      ),
    [orders],
  );

  const header = (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={backToList} className="gap-1.5 h-8">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {orders.length > 0 && !locked && (
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-900">Customer Order</h1>
              <CopyOnHover value={checkoutId} label="Parent Order ID">
                <code className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                  {checkoutId}
                </code>
              </CopyOnHover>
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                {orders.length} company order{orders.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
              <Calendar className="h-3 w-3" />
              {orders[0].orderDate}
              {orders[0].orderTime && <> · {orders[0].orderTime}</>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (orders.length === 0 || locked) {
    return (
      <div className="min-h-screen bg-gray-50">
        {header}
        <div className="p-8">
          <EmptyState
            icon={locked ? Lock : Package}
            title={locked ? "This customer order is locked" : "Customer order not found"}
            description={
              locked
                ? "Update your previous orders to view this order."
                : "It may have been removed, or the link is incorrect."
            }
            action={
              <Button variant="outline" onClick={backToList}>
                Back to Orders
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const buyer = orders[0];
  const total = orders.reduce((n, o) => n + o.orderValue, 0);
  const deliveryDates = Array.from(
    new Set(orders.map((o) => o.expectedDeliveryDate)),
  ).sort();
  const companies = Array.from(new Set(orders.map((o) => o.company)));

  return (
    <div className="min-h-screen bg-gray-50">
      {header}

      <div className="p-4 space-y-3">
        {/* Buyer · Delivery · Summary */}
        <Card>
          <CardContent className="p-3 grid md:grid-cols-3 gap-3 text-sm">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Store className="h-3.5 w-3.5 text-blue-600" />
                Customer
              </p>
              <p className="font-semibold text-gray-900 leading-snug">
                {buyer.retailerName}
              </p>
              {buyer.buyerContact && (
                <p className="text-gray-700 flex items-center gap-1.5 text-xs">
                  <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                  {buyer.buyerContact}
                </p>
              )}
              {buyer.buyerAddress && (
                <p className="text-gray-600 flex gap-1.5 text-xs leading-snug">
                  <MapPin className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                  <span>{buyer.buyerAddress}</span>
                </p>
              )}
              {buyer.gstNumber && (
                <p className="text-gray-700 flex items-center gap-1.5 text-xs">
                  <Hash className="h-3 w-3 text-gray-400 shrink-0" />
                  <span className="text-gray-500">GST No.</span>
                  <span className="font-mono">{buyer.gstNumber}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5 md:border-l md:pl-3 md:border-gray-200">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-green-600" />
                Delivery
              </p>
              <div className="flex justify-between text-xs gap-2">
                <span className="text-gray-500">Delivery Date</span>
                <span className="text-gray-900 font-medium text-right">
                  {deliveryDates.join(", ")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Payment</span>
                <span className="text-gray-900 font-medium">{buyer.paymentMode}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Marketplace</span>
                <span className="text-gray-900 font-medium">{buyer.marketplace}</span>
              </div>
            </div>

            <div className="space-y-1.5 md:border-l md:pl-3 md:border-gray-200">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-gray-600" />
                Order Summary
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Companies</span>
                <span className="text-gray-900 font-medium">{companies.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Items</span>
                <span className="text-gray-900 font-medium">{lines.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Order Value</span>
                <span className="text-emerald-700 font-semibold">{rupees(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* All products across the checkout, each with its company */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-600" />
              <h2 className="text-sm font-semibold text-gray-900">Products</h2>
              <span className="text-xs text-gray-500">({lines.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Product", "SKU", "Company", "Brand", "Qty", "Price / Unit", "Total", "Company Order"].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap ${i >= 4 && i <= 6 ? "text-right" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ order, line }, i) => (
                    <tr key={`${order.id}-${line.skuCode}-${i}`} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 text-sm text-gray-900">{line.productName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <code className="text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                          {line.skuCode}
                        </code>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                        {line.company}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                        {line.brand}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 text-right tabular-nums">
                        {line.qty}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 text-right tabular-nums whitespace-nowrap">
                        {rupees(line.finalPricePerUnit)}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900 text-right tabular-nums whitespace-nowrap">
                        {rupees(line.lineTotal)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="text-[11px] font-mono text-blue-600 hover:text-blue-700 hover:underline"
                          title="Open company order"
                        >
                          {order.id}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* One card per company order — the billing / fulfilment unit */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-600" />
              <h2 className="text-sm font-semibold text-gray-900">Company Orders</h2>
              <span className="text-xs text-gray-500">
                · billing and fulfilment happen on each company order
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{o.company}</p>
                      {statusBadge(o)}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                      <code className="font-mono text-gray-700">{o.id}</code>
                      <span>{getOrderLines(o).length} item{getOrderLines(o).length === 1 ? "" : "s"}</span>
                      <span>Delivery {o.expectedDeliveryDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                      {rupees(o.orderValue)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8"
                      onClick={() => navigate(`/orders/${o.id}`)}
                    >
                      View company order
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
