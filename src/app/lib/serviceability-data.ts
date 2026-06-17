// Shared store for delivery-beat serviceability configuration. Each
// record is ONE beat per AREA — a beat carries an area name (the beat
// name), the days it serves on, and an optional polygon. Beats apply
// to ALL companies the distributor handles; there is no company
// dimension on the record.
//
// History note: an earlier model stored one beat per (company, area)
// so KPHB 1 lived as separate rows for ITC and for Marico, each
// configurable with its own delivery day. The June 2026 review
// collapsed that: a distributor runs one delivery operation across
// every company, so one area = one beat = one delivery schedule. If
// a new company gets linked later, every existing beat automatically
// applies to it without any extra configuration step.
//
// In a real install this would live behind an API. For the demo
// everything is in-memory and seeded with enough variety to drive
// every UI surface (admin Serviceability page, customer detail).

import type { DeliveryDay } from "./customers-data";

export interface ServiceabilityBeat {
  id: string;
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

// One beat per area. KPHB 1 carries TWO delivery days (Mon + Tue) —
// the "one beat, two day chips" showcase from the June review. Every
// other beat is single-day for now.
const SEED_BEATS: ServiceabilityBeat[] = [
  {
    id: "beat-kphb1",
    beatName: "KPHB 1",
    deliveryDays: ["Monday", "Tuesday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-kphb2",
    beatName: "KPHB 2",
    deliveryDays: ["Monday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-kphb3",
    beatName: "KPHB 3",
    deliveryDays: ["Monday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-banjara",
    beatName: "Banjara Hills",
    deliveryDays: ["Tuesday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-jubilee",
    beatName: "Jubilee Hills",
    deliveryDays: ["Tuesday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-sr-nagar",
    beatName: "SR Nagar",
    deliveryDays: ["Wednesday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-madhapur",
    beatName: "Madhapur",
    deliveryDays: ["Thursday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-gachibowli",
    beatName: "Gachibowli",
    deliveryDays: ["Thursday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-kondapur",
    beatName: "Kondapur",
    deliveryDays: ["Friday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-hitec",
    beatName: "HITEC City",
    deliveryDays: ["Friday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-begumpet",
    beatName: "Begumpet",
    deliveryDays: ["Saturday"],
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "beat-ameerpet",
    beatName: "Ameerpet",
    deliveryDays: ["Thursday"],
    createdAt: "2026-04-09T09:00:00Z",
  },
  {
    id: "beat-freedom-mum",
    beatName: "Mumbai Metro — North",
    deliveryDays: ["Monday"],
    polygonFileName: "freedom-zone.geojson",
    polygonData: SAMPLE_FREEDOM_POLYGON,
    createdAt: "2026-04-10T09:00:00Z",
  },
  {
    id: "beat-freedom-hyd",
    beatName: "Hyderabad West",
    deliveryDays: ["Friday"],
    createdAt: "2026-04-10T09:00:00Z",
  },
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

export function makeServiceabilityBeatId(): string {
  return `beat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Stable, content-derived identity for a polygon. Used to dedupe
 * delivery beats — two beats with the same polygonId are considered
 * the same physical area regardless of beat name.
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
   * Explicit beat-id list — when present, lookups use it verbatim
   * instead of the deterministic hash picker. Lets the demo seed
   * showcase scenarios the hash can't fabricate.
   *
   * Production lookups will replace this with point-in-polygon tests
   * against the customer's lat/long.
   */
  serviceabilityOverrides?: string[];
}

/**
 * Return the single beat the customer is mapped to. Returns null
 * when no beat is configured.
 *
 * Honors `serviceabilityOverrides` first (first id wins for the
 * single-beat helper), otherwise picks by the deterministic hash
 * fallback used across the demo.
 */
export function findBeatForCustomer(
  customer: CustomerLocationKey,
): ServiceabilityBeat | null {
  const override = customer.serviceabilityOverrides;
  if (override && override.length > 0) {
    const overridden = _beats.find((b) => b.id === override[0]);
    if (overridden) return overridden;
  }
  if (_beats.length === 0) return null;
  if (_beats.length === 1) return _beats[0];
  const key = `${customer.customerId}|${customer.city ?? ""}|${customer.area ?? ""}|${customer.pincode ?? ""}`;
  return _beats[hashKey(key) % _beats.length];
}

/**
 * Return ALL beats the customer is mapped to. Each beat carries its
 * own `deliveryDays` array — callers iterating to render delivery
 * days should flat-map over the returned beats and their day arrays.
 *
 * Honors explicit overrides; otherwise falls back to the single
 * hash-picked beat as a 1-element array.
 */
export function findBeatsForCustomer(
  customer: CustomerLocationKey,
): ServiceabilityBeat[] {
  const override = customer.serviceabilityOverrides;
  if (override && override.length > 0) {
    const set = new Set(override);
    return _beats.filter((b) => set.has(b.id)).sort(beatDisplaySort);
  }
  const single = findBeatForCustomer(customer);
  return single ? [single] : [];
}

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
 *  or null. Used by surfaces that only care about a single day. */
export function getDeliveryDayForCustomer(
  customer: CustomerLocationKey,
): DeliveryDay | null {
  return findBeatForCustomer(customer)?.deliveryDays[0] ?? null;
}
