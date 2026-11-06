// Cross Dock Store (CDS) — domain types.
//
// One retailer order on ONDC = one seller order. A CDS collects seller
// orders (first mile, LBNP pickup trips), receives them, sorts them
// per retailer into a Shipment (one consolidated drop + one payment
// per retailer), and hands them to LBNP for last-mile delivery.
//
// Trips are owned by LBNP. CDS only requests them and records the
// steps that happen inside the building (receiving, sorting, packing,
// handover to rider).

export type PaymentType = "Cash" | "Credit" | "QR";

export type CdsOrderStatus =
  | "Confirmed"
  | "Pickup Requested"
  | "Picked Up"
  | "In Transit to CDS"
  | "Received"
  | "Received Short"
  | "Sorting"
  | "Ready for Dispatch"
  | "Out for Delivery"
  | "Delivered"
  | "Delivery Failed"
  | "Transferred to CDS"
  | "Returned to Seller"
  | "Cancelled";

export type Leg = "order" | "first-mile" | "cds" | "last-mile" | "payment" | "exception";

export interface CdsEvent {
  at: string;
  title: string;
  note?: string;
  by: string;
  leg: Leg;
  status?: CdsOrderStatus;
}

export interface CdsLocation {
  id: string;
  name: string; // "Kukatpally CDS"
  code: string; // "CDS-KKP"
  locality: string;
  address: string;
  manager: string;
  phone: string;
  status: "Active" | "Onboarding";
  goLive?: string; // for onboarding locations
  inwardCutoff: string; // "11:30"
  dispatchCutoff: string; // "14:00"
  crates: number;
  /** Earlier Dark Store id this CDS replaces, if any. */
  darkStoreId?: string;
}

export interface CdsSeller {
  id: string;
  name: string;
  area: string;
  contact: string;
  phone: string;
  brands: string[];
  cdsIds: string[];
}

export interface CdsRetailer {
  id: string;
  name: string;
  owner: string;
  phone: string;
  area: string;
  cdsId: string;
  /** Result of the serviceability check (#7). Differs from cdsId for border retailers. */
  serviceableCdsId: string;
  type: "Kirana" | "Supermarket" | "General Store" | "Medical & General" | "Bakery";
}

export interface CdsProduct {
  sku: string;
  name: string;
  brand: string;
  uom: string; // "Case of 12", "Bag 10 kg"
  price: number; // per unit (selling price to retailer)
}

export interface CdsOrderLine {
  sku: string;
  name: string;
  brand: string;
  uom: string;
  price: number;
  orderedQty: number;
  /** Qty the seller confirmed (order modification at confirmation). */
  confirmedQty: number;
  /** Units the rider actually collected (partial pickup). */
  pickedQty?: number;
  /** Units the seller cancelled after moving the order to CDS. */
  cancelledQty?: number;
  /** Set at CDS inward. Includes damaged units, may exceed confirmed (excess). */
  receivedQty?: number;
  damagedQty?: number;
  /** Units placed in the retailer crate at sorting. */
  sortedQty?: number;
  deliveredQty?: number;
}

export interface CdsOrder {
  id: string;
  ondcOrderId: string;
  sellerId: string;
  retailerId: string;
  cdsId: string;
  /** Set when the order arrived here through a CDS-to-CDS transfer. */
  originCdsId?: string;
  placedAt: string;
  confirmedAt: string;
  /** Business day this order is planned to be delivered (YYYY-MM-DD). */
  waveDate: string;
  lines: CdsOrderLine[];
  paymentType: PaymentType;
  status: CdsOrderStatus;
  pickupTripId?: string;
  shipmentId?: string;
  deliveredAt?: string;
  cancelReason?: string;
  cancelledBy?: "Retailer" | "Seller" | "CDS";
  /** LBNP settlement planning — value locked when the rider picks up (#3). */
  settlementLock?: { at: string; value: number };
  /** Seller confirmed the order's payment is fully settled. */
  sellerSettledAt?: string;
  /** Seller confirmed the pickup handover (after the agent's OTP) is settled. */
  pickupSettledAt?: string;
  /** "system" when auto-marked because the seller missed it and the order moved on. */
  pickupSettledBy?: "seller" | "system";
  history: CdsEvent[];
}

export type TripKind = "Pickup" | "Delivery" | "Transfer";
export type TripStatus =
  | "Requested"
  | "Rider Assigned"
  | "In Progress"
  | "Arrived at CDS"
  | "Completed"
  | "Cancelled";

export type StopStatus = "Pending" | "Done" | "Failed";

export interface TripStop {
  id: string;
  seq: number;
  type: "Pickup" | "Drop" | "Transfer Drop";
  sellerId?: string;
  retailerId?: string;
  targetCdsId?: string;
  shipmentId?: string;
  orderIds: string[];
  expectedUnits: number;
  collectedUnits?: number;
  status: StopStatus;
  eta: string;
  doneAt?: string;
  exception?: string;
  otpVerified?: boolean;
  podRef?: string;
  failReason?: string;
}

export interface Rider {
  name: string;
  phone: string;
  vehicle: string;
}

export interface CdsTrip {
  id: string; // LBNP trip id
  kind: TripKind;
  cdsId: string;
  targetCdsId?: string;
  status: TripStatus;
  requestedAt: string;
  assignedAt?: string;
  startedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  /** Delivery / transfer trips — when the CDS verified the handover to the rider. */
  handoverAt?: string;
  handoverUnits?: number;
  /** OTP the rider confirms in the FA App when collecting at the CDS (#6). */
  handoverOtp?: string;
  rider?: Rider;
  stops: TripStop[];
  distanceKm: number;
  slot: string;
  note?: string;
}

export interface InwardRecord {
  id: string;
  tripId: string;
  cdsId: string;
  completedAt: string;
  receivedBy: string;
  expectedUnits: number;
  receivedUnits: number;
  damagedUnits: number;
  shortUnits: number;
  excessUnits: number;
  orderIds: string[];
  discrepancyIds: string[];
  status: "Completed" | "Completed with discrepancies";
}

export type ShipmentStatus =
  | "Open" // derived at read time into Awaiting Orders / To Sort / Sorting
  | "Packed"
  | "Out for Delivery"
  | "Delivered"
  | "Delivery Failed"
  | "In Transfer"
  | "Returned"
  | "Cancelled";

export type ShipmentStage =
  | "Awaiting Orders"
  | "To Sort"
  | "Sorting"
  | "Packed"
  | "Out for Delivery"
  | "Delivered"
  | "Delivery Failed"
  | "In Transfer"
  | "Returned"
  | "Cancelled";

export interface DeliveryAttempt {
  at: string;
  tripId: string;
  outcome: "Delivered" | "Failed";
  reason?: string;
  otpVerified?: boolean;
  podRef?: string;
  agent?: string;
}

export interface Shipment {
  id: string;
  cdsId: string;
  retailerId: string;
  waveDate: string;
  orderIds: string[];
  crate?: string;
  status: ShipmentStatus;
  sortStartedAt?: string;
  packedAt?: string;
  packages?: number;
  deliveryTripId?: string;
  attempts: DeliveryAttempt[];
  deliveredAt?: string;
}

export type CollectionStatus =
  | "Collected"
  | "Pending"
  | "Failed"
  | "Handed Over"
  | "Reconciled"
  | "Short";

export interface Collection {
  id: string;
  shipmentId: string;
  retailerId: string;
  cdsId: string;
  tripId: string;
  mode: "Cash" | "QR";
  amountDue: number;
  amountCollected: number;
  status: CollectionStatus;
  at: string;
  agent: string;
  qrRef?: string;
  failReason?: string;
  handoverId?: string;
  splits: { orderId: string; sellerId: string; amount: number }[];
}

export interface CashHandover {
  id: string;
  cdsId: string;
  agent: string;
  at: string;
  expected: number;
  received: number;
  status: "Pending Verification" | "Matched" | "Short";
  collectionIds: string[];
  receivedBy: string;
  verifiedAt?: string;
}

export interface CreditEntry {
  id: string;
  orderId: string;
  sellerId: string;
  retailerId: string;
  cdsId: string;
  amount: number;
  paid: number;
  deliveredAt: string;
  dueDate: string;
  payments: { at: string; amount: number; ref: string }[];
}

export interface CreditAccount {
  sellerId: string;
  retailerId: string;
  limit: number;
  termsDays: number;
}

export interface Settlement {
  id: string;
  sellerId: string;
  cdsId: string;
  date: string; // delivery day
  orderIds: string[];
  cashAmount: number;
  qrAmount: number;
  creditAmount: number; // tracked only — seller collects credit directly
  deductions: number; // returns / refunds after delivery
  net: number;
  status: "Pending" | "Processing" | "Settled" | "On Hold";
  holdReason?: string;
  settledAt?: string;
  utr?: string;
  /** Sum of values locked at pickup stage by LBNP settlement planning. */
  lockedValue: number;
  /** Returns on already-paid orders, recovered from this payout. */
  recoveries?: { orderId: string; returnId: string; amount: number }[];
}

export type AdjustmentType =
  | "Short at Pickup"
  | "Partial Cancellation"
  | "Short Receipt"
  | "Damaged at Receiving"
  | "Cancellation"
  | "Retailer Return"
  | "QR Refund"
  | "Delivery Failure";

export interface Adjustment {
  id: string;
  orderId: string;
  sellerId: string;
  retailerId: string;
  cdsId: string;
  type: AdjustmentType;
  amount: number;
  at: string;
  appliedTo: "Retailer bill" | "Seller settlement" | "QR refund" | "Credit note";
  note: string;
}

export type DiscrepancyType = "Short" | "Damaged" | "Excess";

export interface Discrepancy {
  id: string;
  orderId: string;
  sellerId: string;
  retailerId: string;
  cdsId: string;
  tripId: string;
  sku: string;
  name: string;
  type: DiscrepancyType;
  qty: number;
  value: number;
  status: "Open" | "Seller Acknowledged" | "Closed";
  raisedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

export type ReturnCaseType =
  | "Retailer Cancellation"
  | "Seller Cancellation"
  | "Pickup-stage Cancellation"
  | "Receiving Discrepancy"
  | "Retailer Return"
  | "Delivery Failure (RTO)";

export type ReturnStage =
  | "Before pickup"
  | "First mile"
  | "At CDS"
  | "Last mile"
  | "After delivery";

export type ReturnStatus =
  | "Open"
  | "Return to Seller Scheduled"
  | "Returned to Seller"
  | "Refund Processed"
  | "Closed";

export interface ReturnCase {
  id: string;
  orderId: string;
  sellerId: string;
  retailerId: string;
  cdsId: string;
  type: ReturnCaseType;
  stage: ReturnStage;
  reason: string;
  items: { sku: string; name: string; qty: number; value: number }[];
  value: number;
  /** Who absorbs the cost: shown as "financial impact". */
  impact: string;
  status: ReturnStatus;
  createdAt: string;
  updatedAt: string;
  needsReturnToSeller: boolean;
  discrepancyId?: string;
  /** Seller confirmed the return is settled (goods back, deduction accepted). */
  sellerSettledAt?: string;
}

export interface CdsState {
  version: number;
  seededOn: string;
  rev: number;
  selectedCdsId: string; // a location id or "all"
  locations: CdsLocation[];
  sellers: CdsSeller[];
  retailers: CdsRetailer[];
  products: CdsProduct[];
  creditAccounts: CreditAccount[];
  orders: CdsOrder[];
  trips: CdsTrip[];
  inward: InwardRecord[];
  shipments: Shipment[];
  collections: Collection[];
  handovers: CashHandover[];
  credit: CreditEntry[];
  settlements: Settlement[];
  adjustments: Adjustment[];
  discrepancies: Discrepancy[];
  returns: ReturnCase[];
  counters: Record<string, number>;
}
