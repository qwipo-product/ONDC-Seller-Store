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
import { UPLOADED_SEED_BEATS } from "./uploaded-beats-seed";

export interface ServiceabilityBeat {
  id: string;
  companyId: string;
  companyName: string;
  /**
   * The seller (distributor) whose Serviceability tab created this
   * beat. Drives the Seller Name + distance columns in the admin
   * Beat Serviceability Report. Optional because legacy records
   * predate the field.
   */
  sellerId?: string;
  sellerName?: string;
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
// Seeded ONLY from the business team's uploaded GeoJSON files (see
// serviceability-uploads/ at the repo root and uploaded-beats-seed.ts).
// No demo beats — sellers without an upload have empty serviceability
// until their polygons arrive.

const SEED_BEATS: ServiceabilityBeat[] = UPLOADED_SEED_BEATS;

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

// ---- Polygon overlap geometry ----
//
// Save-time guard for the Add/Edit beat dialogs: does a candidate
// polygon geometrically overlap an existing beat's polygon? Outer
// rings only ([lng, lat] pairs) — city-scale delivery zones don't
// carry holes, and a false positive inside a hole is harmless here.
//
// Two zones "overlap" when any vertex of one falls inside the other,
// or when any of their edges cross. A cheap bounding-box reject runs
// first so the O(n·m) edge scan only fires on candidates that are
// actually near each other.

type Ring = [number, number][];

/** Extract every outer ring from a GeoJSON Polygon/MultiPolygon/Feature(Collection). */
export function polygonOuterRings(data: unknown): Ring[] {
  const rings: Ring[] = [];
  const walk = (geom: { type?: string; coordinates?: unknown } | undefined) => {
    if (!geom) return;
    if (geom.type === "Polygon") {
      const outer = (geom.coordinates as Ring[])?.[0];
      if (outer?.length) rings.push(outer);
    } else if (geom.type === "MultiPolygon") {
      for (const poly of (geom.coordinates as Ring[][]) ?? []) {
        if (poly?.[0]?.length) rings.push(poly[0]);
      }
    }
  };
  const d = data as {
    type?: string;
    features?: { geometry?: { type?: string; coordinates?: unknown } }[];
    geometry?: { type?: string; coordinates?: unknown };
  };
  if (!d || typeof d !== "object") return rings;
  if (d.type === "FeatureCollection") {
    for (const f of d.features ?? []) walk(f?.geometry);
  } else if (d.type === "Feature") {
    walk(d.geometry);
  } else {
    walk(d as { type?: string; coordinates?: unknown });
  }
  return rings;
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function ringBBox(ring: Ring): BBox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function bboxDisjoint(a: BBox, b: BBox): boolean {
  return a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY;
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orient(
  a: [number, number],
  b: [number, number],
  c: [number, number],
): number {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function segmentsCross(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number],
): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  return d1 !== d2 && d3 !== d4;
}

function ringsOverlap(a: Ring, b: Ring): boolean {
  if (bboxDisjoint(ringBBox(a), ringBBox(b))) return false;
  for (const [x, y] of a) if (pointInRing(x, y, b)) return true;
  for (const [x, y] of b) if (pointInRing(x, y, a)) return true;
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (segmentsCross(a[i], a[i + 1], b[j], b[j + 1])) return true;
    }
  }
  return false;
}

/**
 * True when two GeoJSON polygons share any area (or their boundaries
 * cross). Used to block a new beat whose zone overlaps a DIFFERENT
 * company's zone with a conflicting delivery-day set.
 */
export function polygonsOverlap(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  const ringsA = polygonOuterRings(a);
  const ringsB = polygonOuterRings(b);
  for (const ra of ringsA) {
    for (const rb of ringsB) {
      if (ringsOverlap(ra, rb)) return true;
    }
  }
  return false;
}

/**
 * Great-circle distance between two lat/lng points in kilometres
 * (haversine). Used for the customer ↔ seller distance column in the
 * Beat Serviceability Report.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * True when a lat/lng point falls inside any outer ring of a GeoJSON
 * polygon. The production-grade counterpart to the demo hash picker —
 * used by the admin Customer Database to resolve which beats actually
 * cover an uploaded customer location.
 */
export function polygonContainsPoint(
  data: unknown,
  lat: number,
  lng: number,
): boolean {
  for (const ring of polygonOuterRings(data)) {
    if (pointInRing(lng, lat, ring)) return true;
  }
  return false;
}

/**
 * Every beat (across ALL companies) whose polygon contains the given
 * point. A customer inside two companies' zones gets both beats back —
 * callers group by company for display.
 */
export function findBeatsContainingPoint(
  lat: number,
  lng: number,
): ServiceabilityBeat[] {
  return _beats
    .filter(
      (b) =>
        b.polygonData != null && polygonContainsPoint(b.polygonData, lat, lng),
    )
    .sort(beatDisplaySort);
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
