// Logistics settings store — per-seller, controlled by the Super Admin
// from the Manage Seller → Logistics tab. The seller cannot edit their
// own logistics state; their sidebar reads this store to gate whether
// the Logistics menu is clickable.
//
// Storage shape: one localStorage key per seller, `qwipo.logisticsSettings.<sellerId>`,
// so admin edits for one seller don't bleed into another.

const STORAGE_PREFIX = "qwipo.logisticsSettings.";

export interface LogisticsSettings {
  /**
   * Master toggle — the only thing the admin can flip from the Manage
   * Seller → Logistics tab. The seller's sidebar reads this and gates
   * the Logistics shortcut accordingly. (An earlier iteration carried a
   * sub-mode field but the spec collapsed to a single enable/disable
   * boolean; legacy `mode` keys in localStorage are ignored.)
   */
  enabled: boolean;
}

// Prototype default: Logistics ON. The 3PL hand-off flow on Orders →
// Confirmed is the behaviour under review, so a seller who hasn't had
// the connector explicitly switched on should still land in it rather
// than in the pre-logistics view. Flip back to `false` to demo the
// no-logistics case (or turn the connector off for a specific seller
// from Super Admin → Seller → Logistics, which still wins over this).
const DEFAULT: LogisticsSettings = {
  enabled: true,
};

const storageKey = (sellerId: string) => `${STORAGE_PREFIX}${sellerId}`;

const read = (sellerId: string): LogisticsSettings => {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(storageKey(sellerId));
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<LogisticsSettings>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
};

// In-memory mirror per seller so synchronous getters don't pay the
// localStorage parse cost on every read.
const cache = new Map<string, LogisticsSettings>();
// Subscribers per seller — the seller's sidebar subscribes to its own
// user.id; the admin's tab subscribes to the seller it's editing.
const subscribers = new Map<string, Set<() => void>>();

const ensureLoaded = (sellerId: string): LogisticsSettings => {
  const hit = cache.get(sellerId);
  if (hit) return hit;
  const fresh = read(sellerId);
  cache.set(sellerId, fresh);
  return fresh;
};

const notify = (sellerId: string) => {
  const subs = subscribers.get(sellerId);
  if (!subs) return;
  subs.forEach((fn) => fn());
};

export const getLogisticsSettings = (sellerId: string): LogisticsSettings =>
  ensureLoaded(sellerId);

export const setLogisticsSettings = (
  sellerId: string,
  next: LogisticsSettings,
) => {
  const value = { ...next };
  cache.set(sellerId, value);
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(sellerId), JSON.stringify(value));
    }
  } catch {
    // Quota-exceeded or private-mode block — keep in-memory value and
    // drop the persistence quietly. The UI still reflects the choice.
  }
  notify(sellerId);
};

export const subscribeToLogisticsSettings = (
  sellerId: string,
  fn: () => void,
): (() => void) => {
  let set = subscribers.get(sellerId);
  if (!set) {
    set = new Set();
    subscribers.set(sellerId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
};

/**
 * Cross-tab sync — when the admin saves in tab A and the seller is
 * already logged-in in tab B, the seller's sidebar updates without
 * needing a refresh. Wired once on module load.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;
    const sellerId = e.key.slice(STORAGE_PREFIX.length);
    // Drop the cache entry so the next read re-parses from storage.
    cache.delete(sellerId);
    notify(sellerId);
  });
}
