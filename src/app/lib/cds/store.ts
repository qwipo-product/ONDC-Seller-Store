// Cross Dock Store (CDS) — client store.
//
// One shared state object, persisted to localStorage, seeded on first
// use (and re-seeded on a new day so the "today" snapshot stays
// current). Components read it with useCds(); every mutation goes
// through run(), which applies an engine action and notifies all
// subscribers so every CDS screen re-renders from the same data.

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { localDate } from "./calc";
import * as engine from "./engine";
import { CdsActionError, ctx } from "./engine";
import { CDS_DATA_VERSION, buildSeed } from "./seed";
import type { CdsState } from "./types";
import { CDS_CONNECTOR_SELLERS } from "./order-bridge";

const KEY = "qwipo.cds.state";
const ENABLED_PREFIX = "qwipo.cds.enabled.";

let state: CdsState | null = null;
const listeners = new Set<() => void>();

function load(): CdsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CdsState;
      if (parsed.version === CDS_DATA_VERSION && parsed.seededOn === localDate(new Date())) {
        return parsed;
      }
    }
  } catch {
    /* corrupted or unavailable — reseed */
  }
  return buildSeed();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — keep in memory */
  }
}

export function getCds(): CdsState {
  if (!state) {
    state = load();
    ctx.s = state;
    persist();
  }
  return state;
}

function commit() {
  state = { ...getCds(), rev: getCds().rev + 1 };
  ctx.s = state;
  // Delivery-app updates may close out pickups the seller never marked.
  engine.autoSettlePickups();
  persist();
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useCds(): CdsState {
  return useSyncExternalStore(subscribe, getCds, getCds);
}

/**
 * Run an engine action, commit, and toast. Returns the action result,
 * or undefined when the action was rejected (the reason is toasted).
 */
export function run<R>(fn: () => R, success?: string | ((r: R) => string)): R | undefined {
  ctx.s = getCds();
  try {
    const result = fn();
    commit();
    if (success) toast.success(typeof success === "function" ? success(result) : success);
    // void actions still report success to callers checking `!== undefined`
    return result === undefined ? (true as unknown as R) : result;
  } catch (e) {
    if (e instanceof CdsActionError) {
      toast.error(e.message);
      return undefined;
    }
    throw e;
  }
}

export function setSelectedCds(id: string) {
  getCds().selectedCdsId = id;
  commit();
}

export function resetCdsData() {
  state = buildSeed();
  ctx.s = state;
  commit();
  toast.success("CDS demo data reset to today's snapshot");
}

/** Apply engine actions with no toast — used by the Orders ↔ CDS sync.
 *  Rejected actions are skipped silently. */
export function runQuiet(fn: () => void) {
  ctx.s = getCds();
  try {
    fn();
  } catch (e) {
    if (!(e instanceof CdsActionError)) throw e;
  }
  commit();
}

// ---- CDS connector gate (set from the admin portal) ----
// The admin creates a connector for a CDS polygon and enables it for
// the sellers inside it. Demo: CDS_CONNECTOR_SELLERS have access; a
// localStorage override lets the prototype switch it off.

export function isCdsEnabled(sellerId?: string): boolean {
  if (!sellerId) return false;
  try {
    const v = localStorage.getItem(ENABLED_PREFIX + sellerId);
    return v === null ? CDS_CONNECTOR_SELLERS.includes(sellerId) : v === "true";
  } catch {
    return CDS_CONNECTOR_SELLERS.includes(sellerId);
  }
}

export { engine };
