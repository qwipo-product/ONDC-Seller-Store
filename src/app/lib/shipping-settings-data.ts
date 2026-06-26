// Shared store for the seller's Shipping Settings. Phase 1 ships one
// Delivery Fee Slab per distributor — { minOrderValue, maxOrderValue,
// deliveryCharges }. The slab structure is built as an array so a
// future phase can add more slabs without a schema migration; the UI
// currently caps the count at 1.

const SHIPPING_SLABS_KEY = "qwipo.shippingSettings.slabs";

export interface DeliveryFeeSlab {
  minOrderValue: number;
  maxOrderValue: number;
  deliveryCharges: number;
}

const DEFAULT_SLAB: DeliveryFeeSlab = {
  minOrderValue: 0,
  maxOrderValue: 1000,
  deliveryCharges: 50,
};

export function getDeliveryFeeSlabs(): DeliveryFeeSlab[] {
  try {
    const raw = localStorage.getItem(SHIPPING_SLABS_KEY);
    if (!raw) return [DEFAULT_SLAB];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_SLAB];
    return parsed
      .map((s) => ({
        minOrderValue: Number(s.minOrderValue) || 0,
        maxOrderValue: Number(s.maxOrderValue) || 0,
        deliveryCharges: Number(s.deliveryCharges) || 0,
      }))
      .filter((s) => Number.isFinite(s.minOrderValue));
  } catch {
    return [DEFAULT_SLAB];
  }
}

export function setDeliveryFeeSlabs(slabs: DeliveryFeeSlab[]): void {
  try {
    localStorage.setItem(SHIPPING_SLABS_KEY, JSON.stringify(slabs));
  } catch {
    /* localStorage unavailable — no-op */
  }
}
