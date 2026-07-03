// Shared store for delivery-beat serviceability configuration. Each
// record is ONE beat per company — a beat carries its own beat name,
// an array of delivery days it serves on, and an optional polygon.
//
// History note: an earlier model stored one record per (company,
// beat, day) so KPHB 1-on-Monday and KPHB 1-on-Wednesday lived as two
// separate rows. The June 2026 review collapsed that into "one beat
// per company, multiple delivery days" — the model matches how
// distributors think (KPHB 1 is one route, visited on N days) and
// lets the admin list render the schedule on a single chip row per
// beat instead of repeating the beat name across multiple rows.
//
// The exported `ServiceabilityBit` alias is intentional: downstream
// consumers from the old model keep working while the rest of the
// codebase migrates over to the new `ServiceabilityBeat` name.
//
// In a real install this would live behind an API. For the demo
// everything is in-memory and seeded with enough variety to drive
// every UI surface (admin Serviceability page, customer detail).

import type { DeliveryDay } from "./customers-data";

export interface ServiceabilityBeat {
  id: string;
  companyId: string;
  companyName: string;
  beatName: string;
  /**
   * Delivery days this beat serves. Always at least one entry.
   * Multiple days for the same beat means the distributor visits the
   * same area on each of those days (e.g. KPHB 1 served Mon + Tue).
   */
  deliveryDays: DeliveryDay[];
  polygonFileName?: string;
  polygonData?: unknown;
  createdAt: string;
}

/** Back-compat alias — old consumers that imported `ServiceabilityBit`. */
export type ServiceabilityBit = ServiceabilityBeat;

// ---- Seed ----
//
// One polished demo dataset: Rajesh Kumar's distributorship in
// Hyderabad. All four catalog companies run beats here, every beat
// carries a polygon, and every company covers Monday → Saturday
// (Sundays are non-delivery days per Qwipo ops). Zone geometry is
// keyed by beat name and SHARED across companies — "Jubilee Hills"
// is the same physical area no matter which company serves it, which
// also keeps the cross-company day-consistency guard satisfied.

function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build an organic-looking GeoJSON zone around a lat/lng centre —
 * seed-only stand-in for real uploaded polygons. Vertices sit on a
 * jittered ring (deterministic per zone name) so areas read as
 * hand-drawn delivery zones rather than uniform hexagons.
 */
function zonePolygon(
  name: string,
  lat: number,
  lng: number,
  radiusKm: number,
) {
  let seed = seedFrom(name);
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const latR = radiusKm / 110.574;
  const lngR = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const n = 11 + Math.floor(rand() * 4);
  const ring: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n + (rand() - 0.5) * (Math.PI / n);
    const r = 0.7 + rand() * 0.55;
    ring.push([
      Number((lng + lngR * r * Math.cos(a)).toFixed(6)),
      Number((lat + latR * r * Math.sin(a)).toFixed(6)),
    ]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { name },
        geometry: { type: "Polygon" as const, coordinates: [ring] },
      },
    ],
  };
}

// Hyderabad delivery zones — real neighbourhood centres. `days` is
// the city-wide schedule for the area: every company serving a zone
// uses the same day-set (the day-consistency rule).
const HYD_ZONES: Record<
  string,
  { lat: number; lng: number; r: number; days: DeliveryDay[] }
> = {
  "KPHB 1": { lat: 17.4948, lng: 78.3996, r: 1.3, days: ["Monday", "Tuesday"] },
  "KPHB 2": { lat: 17.4849, lng: 78.4116, r: 1.2, days: ["Monday"] },
  Miyapur: { lat: 17.5169, lng: 78.3762, r: 1.6, days: ["Monday"] },
  Kompally: { lat: 17.5453, lng: 78.4855, r: 1.6, days: ["Monday"] },
  "Jubilee Hills": { lat: 17.4326, lng: 78.4071, r: 1.4, days: ["Tuesday"] },
  "Banjara Hills": { lat: 17.4156, lng: 78.4347, r: 1.4, days: ["Tuesday"] },
  "SR Nagar": { lat: 17.4442, lng: 78.4419, r: 1.0, days: ["Wednesday"] },
  Ameerpet: { lat: 17.4374, lng: 78.4487, r: 1.0, days: ["Wednesday"] },
  Begumpet: { lat: 17.4447, lng: 78.4691, r: 1.2, days: ["Wednesday"] },
  Madhapur: { lat: 17.4483, lng: 78.3915, r: 1.2, days: ["Thursday"] },
  Gachibowli: { lat: 17.4401, lng: 78.3489, r: 1.5, days: ["Thursday"] },
  "HITEC City": { lat: 17.4435, lng: 78.3772, r: 1.1, days: ["Thursday"] },
  Kondapur: { lat: 17.4622, lng: 78.3568, r: 1.4, days: ["Friday"] },
  Mehdipatnam: { lat: 17.3949, lng: 78.4344, r: 1.3, days: ["Friday"] },
  Abids: { lat: 17.3911, lng: 78.4735, r: 1.2, days: ["Friday"] },
  Secunderabad: { lat: 17.4399, lng: 78.4983, r: 1.6, days: ["Saturday"] },
  Dilsukhnagar: { lat: 17.3688, lng: 78.5247, r: 1.4, days: ["Saturday"] },
  Uppal: { lat: 17.4056, lng: 78.5591, r: 1.5, days: ["Saturday"] },
  Charminar: { lat: 17.3616, lng: 78.4747, r: 1.3, days: ["Saturday"] },
};

const zoneSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function companyBeats(
  companyId: string,
  companyName: string,
  slug: string,
  zoneNames: (keyof typeof HYD_ZONES)[],
  createdAt: string,
): ServiceabilityBeat[] {
  return zoneNames.map((zoneName) => {
    const z = HYD_ZONES[zoneName];
    return {
      id: `beat-${slug}-${zoneSlug(zoneName)}`,
      companyId,
      companyName,
      beatName: zoneName,
      deliveryDays: [...z.days],
      polygonFileName: `${slug}-${zoneSlug(zoneName)}.geojson`,
      polygonData: zonePolygon(zoneName, z.lat, z.lng, z.r),
      createdAt,
    };
  });
}

// Company rosters — every company covers Monday → Saturday.
const SEED_BEATS: ServiceabilityBeat[] = [
  // ITC — flagship roster, 13 beats across the whole city.
  ...companyBeats(
    "co-itc",
    "ITC",
    "itc",
    [
      "KPHB 1",
      "KPHB 2",
      "Miyapur",
      "Jubilee Hills",
      "Banjara Hills",
      "SR Nagar",
      "Ameerpet",
      "Madhapur",
      "Gachibowli",
      "Kondapur",
      "Abids",
      "Secunderabad",
      "Uppal",
    ],
    "2026-04-08T09:00:00Z",
  ),
  // Adani Wilmar — 6 beats, one per delivery day.
  ...companyBeats(
    "co-adani",
    "Adani Wilmar Ltd",
    "adani",
    [
      "KPHB 1",
      "Jubilee Hills",
      "Begumpet",
      "HITEC City",
      "Mehdipatnam",
      "Dilsukhnagar",
    ],
    "2026-04-11T09:00:00Z",
  ),
  // Gemini Edibles & Fats — 6 beats, one per delivery day.
  ...companyBeats(
    "co-freedom",
    "Gemini Edibles & Fats India",
    "gemini",
    [
      "Kompally",
      "Banjara Hills",
      "SR Nagar",
      "Madhapur",
      "Abids",
      "Secunderabad",
    ],
    "2026-04-10T09:00:00Z",
  ),
  // Sri Krupa Industries — 6 beats, one per delivery day.
  ...companyBeats(
    "co-srikrupa",
    "Sri Krupa Industries",
    "srikrupa",
    [
      "KPHB 2",
      "Jubilee Hills",
      "Ameerpet",
      "Gachibowli",
      "Kondapur",
      "Charminar",
    ],
    "2026-04-09T09:00:00Z",
  ),
];

// ---- In-memory store + subscribe API ----

let _beats: ServiceabilityBeat[] = [...SEED_BEATS];
const _listeners = new Set<() => void>();

const notify = () => {
  for (const cb of _listeners) cb();
};

export function getServiceabilityBeats(): ServiceabilityBeat[] {
  return _beats;
}

export function setServiceabilityBeats(next: ServiceabilityBeat[]): void {
  _beats = next;
  notify();
}

export function subscribeToServiceabilityBeats(cb: () => void): () => void {
  _listeners.add(cb);
  return () => {
    _listeners.delete(cb);
  };
}

// Back-compat shims so older imports keep working until the migration
// is done. All four delegate to the new beat-named primitives.
export const getServiceabilityBits = getServiceabilityBeats;
export const setServiceabilityBits = setServiceabilityBeats;
export const subscribeToServiceabilityBits = subscribeToServiceabilityBeats;

export function makeServiceabilityBeatId(): string {
  return `beat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
export const makeServiceabilityBitId = makeServiceabilityBeatId;

/**
 * Stable, content-derived identity for a polygon. Used to dedupe
 * delivery beats — two beats with the same (company, polygonId) are
 * considered the same physical area regardless of beat name.
 *
 *   - When the beat has polygon data, the id is a hash of the
 *     normalized JSON content. Re-uploading the same geometry under
 *     a different filename therefore collides with the existing beat.
 *   - When no polygon is attached, the id is `"none"`.
 *   - When all we have is a file name (e.g. a partial draft state),
 *     we fall back to the filename so the form-side dedupe still has
 *     something to compare on.
 */
export function getPolygonId(
  source:
    | Pick<ServiceabilityBeat, "polygonData" | "polygonFileName">
    | { polygonData?: unknown; polygonFileName?: string },
): string {
  if (source.polygonData !== undefined && source.polygonData !== null) {
    try {
      return `poly:${polygonHash(JSON.stringify(source.polygonData))}`;
    } catch {
      /* fall through */
    }
  }
  if (source.polygonFileName) {
    return `file:${source.polygonFileName.toLowerCase()}`;
  }
  return "none";
}

function polygonHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ---- Lookup helpers ----

function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface CustomerLocationKey {
  customerId: string;
  city?: string;
  area?: string;
  pincode?: string;
  /**
   * Per-company explicit beat-id list. When present, `findBeatsForCustomer`
   * uses this verbatim instead of the deterministic hash picker — letting
   * the demo seed showcase scenarios the hash can't fabricate.
   *
   * Production lookups will replace this with point-in-polygon tests
   * against the customer's lat/long.
   */
  serviceabilityOverrides?: Record<string, string[]>;
}

/**
 * Return the single beat the customer would inherit for a given
 * company. Returns null when no beat is configured.
 *
 * Honors `serviceabilityOverrides` first (first id wins for the
 * single-beat helper), otherwise picks by the deterministic hash
 * fallback used across the demo.
 */
export function findBeatForCustomer(
  customer: CustomerLocationKey,
  companyId: string,
): ServiceabilityBeat | null {
  const override = customer.serviceabilityOverrides?.[companyId];
  if (override && override.length > 0) {
    const overridden = _beats.find(
      (b) => b.companyId === companyId && b.id === override[0],
    );
    if (overridden) return overridden;
  }
  const candidates = _beats.filter((b) => b.companyId === companyId);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const key = `${customer.customerId}|${customer.city ?? ""}|${customer.area ?? ""}|${customer.pincode ?? ""}`;
  return candidates[hashKey(key) % candidates.length];
}

/**
 * Return ALL beats the customer is mapped to for a given company.
 * Each beat now carries its own `deliveryDays` array — callers
 * iterating to render delivery days should flat-map over the
 * returned beats and their day arrays.
 *
 * Honors explicit overrides; otherwise falls back to the single
 * hash-picked beat as a 1-element array.
 */
export function findBeatsForCustomer(
  customer: CustomerLocationKey,
  companyId: string,
): ServiceabilityBeat[] {
  const override = customer.serviceabilityOverrides?.[companyId];
  if (override && override.length > 0) {
    const set = new Set(override);
    const matched = _beats.filter(
      (b) => b.companyId === companyId && set.has(b.id),
    );
    return matched.sort(beatDisplaySort);
  }
  const single = findBeatForCustomer(customer, companyId);
  return single ? [single] : [];
}

export const findBitForCustomer = findBeatForCustomer;
export const findBitsForCustomer = findBeatsForCustomer;

// Calendar order for display surfaces — "Next Day" first (express),
// then weekly Monday → Sunday.
const DAY_DISPLAY_RANK: Record<string, number> = {
  "Next Day": 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

export function sortDeliveryDays(days: DeliveryDay[]): DeliveryDay[] {
  return [...days].sort(
    (a, b) =>
      (DAY_DISPLAY_RANK[a] ?? 99) - (DAY_DISPLAY_RANK[b] ?? 99),
  );
}

function beatDisplaySort(a: ServiceabilityBeat, b: ServiceabilityBeat): number {
  const ra = DAY_DISPLAY_RANK[a.deliveryDays[0] ?? ""] ?? 99;
  const rb = DAY_DISPLAY_RANK[b.deliveryDays[0] ?? ""] ?? 99;
  if (ra !== rb) return ra - rb;
  return a.beatName.localeCompare(b.beatName);
}

/** Convenience — first delivery day for a customer's matched beat,
 *  or null. Used by surfaces that only care about a single day
 *  (legacy behavior pre-multi-day model). */
export function getDeliveryDayForCustomer(
  customer: CustomerLocationKey,
  companyId: string,
): DeliveryDay | null {
  return findBeatForCustomer(customer, companyId)?.deliveryDays[0] ?? null;
}
