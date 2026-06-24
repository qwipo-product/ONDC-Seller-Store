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

const SAMPLE_FREEDOM_POLYGON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { name: "Freedom Zone — Mumbai metropolitan region" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [72.7, 18.9],
            [73.05, 18.9],
            [73.05, 19.3],
            [72.7, 19.3],
            [72.7, 18.9],
          ],
        ],
      },
    },
  ],
};

// ITC seed — 11 beats covering Monday → Saturday. KPHB 1 carries
// TWO delivery days (Mon + Tue) — the explicit "one beat, two day
// chips" showcase the meeting called out. Every other beat is
// single-day.
const ITC_SEED_BEATS: ServiceabilityBeat[] = [
  {
    id: "beat-itc-kphb1",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "KPHB 1",
    deliveryDays: ["Monday", "Tuesday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-kphb2",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "KPHB 2",
    deliveryDays: ["Monday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-kphb3",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "KPHB 3",
    deliveryDays: ["Monday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-banjara",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "Banjara Hills",
    deliveryDays: ["Tuesday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-jubilee",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "Jubilee Hills",
    deliveryDays: ["Tuesday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-sr-nagar",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "SR Nagar",
    deliveryDays: ["Wednesday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-madhapur",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "Madhapur",
    deliveryDays: ["Thursday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-gachibowli",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "Gachibowli",
    deliveryDays: ["Thursday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-kondapur",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "Kondapur",
    deliveryDays: ["Friday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-hitec",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "HITEC City",
    deliveryDays: ["Friday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-itc-begumpet",
    companyId: "co-itc",
    companyName: "ITC Limited",
    beatName: "Begumpet",
    deliveryDays: ["Saturday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
];

const ADANI_SEED_BEATS: ServiceabilityBeat[] = [
  {
    id: "beat-adani-jubilee",
    companyId: "co-adani",
    companyName: "Adani Wilmar Ltd",
    beatName: "Jubilee Hills",
    deliveryDays: ["Next Day"],
    createdAt: "2026-04-11T09:00:00Z",
  },
  {
    id: "beat-adani-banjara",
    companyId: "co-adani",
    companyName: "Adani Wilmar Ltd",
    beatName: "Banjara Hills",
    deliveryDays: ["Next Day"],
    createdAt: "2026-04-11T09:00:00Z",
  },
  {
    id: "beat-adani-madhapur",
    companyId: "co-adani",
    companyName: "Adani Wilmar Ltd",
    beatName: "Madhapur",
    deliveryDays: ["Next Day"],
    createdAt: "2026-04-11T09:00:00Z",
  },
  {
    id: "beat-adani-kondapur",
    companyId: "co-adani",
    companyName: "Adani Wilmar Ltd",
    beatName: "Kondapur",
    deliveryDays: ["Next Day"],
    createdAt: "2026-04-11T09:00:00Z",
  },
];

const SEED_BEATS: ServiceabilityBeat[] = [
  ...ITC_SEED_BEATS,
  {
    id: "beat-marico-kphb",
    companyId: "co-marico",
    companyName: "Marico",
    beatName: "KPHB 1",
    deliveryDays: ["Monday"],
    createdAt: "2026-04-09T09:00:00Z",
  },
  {
    id: "beat-marico-ameerpet",
    companyId: "co-marico",
    companyName: "Marico",
    beatName: "Ameerpet",
    deliveryDays: ["Thursday"],
    createdAt: "2026-04-09T09:00:00Z",
  },
  {
    id: "beat-freedom-mum",
    companyId: "co-freedom",
    companyName: "Gemini Edibles & Fats India",
    beatName: "Mumbai Metro — North",
    deliveryDays: ["Monday"],
    polygonFileName: "freedom-zone.geojson",
    polygonData: SAMPLE_FREEDOM_POLYGON,
    createdAt: "2026-04-10T09:00:00Z",
  },
  {
    id: "beat-freedom-hyd",
    companyId: "co-freedom",
    companyName: "Gemini Edibles & Fats India",
    beatName: "Hyderabad West",
    deliveryDays: ["Friday"],
    createdAt: "2026-04-10T09:00:00Z",
  },
  ...ADANI_SEED_BEATS,
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
