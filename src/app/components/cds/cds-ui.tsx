// Cross Dock Store (CDS) — shared UI building blocks.
// Page shell with the CDS location switcher, status pills with one
// colour per lifecycle status, KPI tiles, panels, and a small
// sort + paginate helper for the operational tables.

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Info, Search, Warehouse, X } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useCds, isCdsEnabled, setSelectedCds } from "../../lib/cds/store";
import type {
  CdsOrderStatus,
  CollectionStatus,
  PaymentType,
  ReturnStatus,
  ShipmentStage,
  TripStatus,
} from "../../lib/cds/types";
import { Input } from "../ui/input";
import { ListPagination } from "../ui/list-pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "../ui/utils";
import { DATE_RANGES, type DateRangeKey } from "../../lib/cds/calc";

// ---------------- scope + lookups ----------------

export function useCdsScope() {
  const s = useCds();
  const sel = s.selectedCdsId;
  const maps = useMemo(
    () => ({
      sellerMap: new Map(s.sellers.map((x) => [x.id, x])),
      retailerMap: new Map(s.retailers.map((x) => [x.id, x])),
      locationMap: new Map(s.locations.map((x) => [x.id, x])),
    }),
    // the store mutates arrays in place; rev changes on every commit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.rev],
  );
  const inScope = useCallback((cdsId: string) => sel === "all" || cdsId === sel, [sel]);
  return {
    s,
    sel,
    inScope,
    ...maps,
    loc: sel === "all" ? undefined : maps.locationMap.get(sel),
    sellerName: (id: string) => maps.sellerMap.get(id)?.name ?? id,
    retailerName: (id: string) => maps.retailerMap.get(id)?.name ?? id,
    cdsName: (id: string) => maps.locationMap.get(id)?.name ?? id,
  };
}

// ---------------- page shell ----------------

export function CdsSwitcher() {
  const s = useCds();
  const active = s.locations.filter((l) => l.status === "Active");
  const onboarding = s.locations.filter((l) => l.status === "Onboarding");
  return (
    <Select value={s.selectedCdsId} onValueChange={setSelectedCds}>
      <SelectTrigger className="w-[220px] bg-white" aria-label="Cross Dock Store location">
        <Warehouse className="h-4 w-4 text-teal-600" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All CDS ({active.length} active)</SelectItem>
        <SelectGroup>
          <SelectLabel>Active</SelectLabel>
          {active.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Onboarding</SelectLabel>
          {onboarding.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name} · go-live {l.goLive}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function CdsPage({
  title,
  description,
  actions,
  children,
  showSwitcher = true,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Seller-level pages are not tied to one CDS location. */
  showSwitcher?: boolean;
}) {
  const { user } = useAuth();
  const { loc } = useCdsScope();
  const enabled = isCdsEnabled(user?.id) && user?.dataMode !== "empty";
  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
              <Warehouse className="h-3.5 w-3.5" />
              Cross Dock Store (CDS)
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mt-0.5">{title}</h1>
            {description && <p className="text-sm text-gray-600 mt-0.5">{description}</p>}
          </div>
          {enabled && (
            <div className="flex flex-wrap items-center gap-2">
              {showSwitcher && <CdsSwitcher />}
              {actions}
            </div>
          )}
        </div>
      </div>
      <div className="p-4 md:p-6 space-y-4">
        {!enabled ? (
          <Panel className="p-8 text-center">
            <Warehouse className="h-10 w-10 text-gray-400 mx-auto" />
            <h2 className="mt-3 text-lg font-semibold text-gray-900">Cross Dock Store (CDS) is not enabled</h2>
            <p className="mt-1 text-sm text-gray-600 max-w-md mx-auto">
              CDS access is controlled by the Darkstore Connector. Ask your Qwipo admin to enable it for your account
              from the Admin portal.
            </p>
          </Panel>
        ) : showSwitcher && loc?.status === "Onboarding" ? (
          <Panel className="p-8 text-center">
            <Warehouse className="h-10 w-10 text-teal-500 mx-auto" />
            <h2 className="mt-3 text-lg font-semibold text-gray-900">{loc.name} goes live on {loc.goLive}</h2>
            <p className="mt-1 text-sm text-gray-600 max-w-md mx-auto">
              {loc.address}. Manager {loc.manager} · {loc.phone}. Orders will start flowing here once the CDS is live.
              Switch to an active CDS to see operations.
            </p>
          </Panel>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ---------------- containers ----------------

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-gray-200 bg-white", className)}>{children}</div>;
}

export function PanelHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          {icon}
          {title}
        </h3>
        {description && <p className="text-xs text-gray-600 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border px-3 py-2 text-xs",
        tone === "info" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <Info className="h-4 w-4 flex-shrink-0 mt-px" />
      <div>{children}</div>
    </div>
  );
}

const KPI_TONES = {
  gray: "text-gray-600 bg-gray-100",
  blue: "text-blue-600 bg-blue-50",
  green: "text-green-600 bg-green-50",
  amber: "text-amber-600 bg-amber-50",
  red: "text-red-600 bg-red-50",
  teal: "text-teal-600 bg-teal-50",
  purple: "text-purple-600 bg-purple-50",
  indigo: "text-indigo-600 bg-indigo-50",
};

export function Kpi({
  label,
  value,
  sub,
  icon,
  tone = "gray",
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof KPI_TONES;
  onClick?: () => void;
  active?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white p-4 text-left transition-colors",
        active ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-200",
        onClick && "hover:border-blue-300 cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        {icon && <span className={cn("rounded-md p-1.5", KPI_TONES[tone])}>{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </Comp>
  );
}

// ---------------- pills ----------------

const PILL = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium";

export const ORDER_STATUS_CLASS: Record<CdsOrderStatus, string> = {
  Confirmed: "bg-gray-100 text-gray-700 border-gray-200",
  "Pickup Requested": "bg-sky-50 text-sky-700 border-transparent",
  "Picked Up": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "In Transit to CDS": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Received: "bg-teal-50 text-teal-700 border-transparent",
  "Received Short": "bg-amber-50 text-amber-700 border-amber-200",
  Sorting: "bg-violet-50 text-violet-700 border-transparent",
  "Ready for Dispatch": "bg-blue-50 text-blue-700 border-blue-200",
  "Out for Delivery": "bg-cyan-50 text-cyan-700 border-transparent",
  "Transferred to CDS": "bg-purple-50 text-purple-700 border-purple-200",
  Delivered: "bg-green-50 text-green-700 border-green-200",
  "Delivery Failed": "bg-red-50 text-red-700 border-red-200",
  "Returned to Seller": "bg-orange-50 text-orange-700 border-orange-200",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export function OrderStatusPill({ status }: { status: CdsOrderStatus }) {
  return <span className={cn(PILL, ORDER_STATUS_CLASS[status])}>{status}</span>;
}

const TRIP_CLASS: Record<TripStatus, string> = {
  Requested: "bg-gray-100 text-gray-700 border-gray-200",
  "Rider Assigned": "bg-sky-50 text-sky-700 border-transparent",
  "In Progress": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Arrived at CDS": "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-green-50 text-green-700 border-green-200",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export function TripStatusPill({ status }: { status: TripStatus }) {
  return <span className={cn(PILL, TRIP_CLASS[status])}>{status}</span>;
}

const SHIP_CLASS: Record<ShipmentStage, string> = {
  "Awaiting Orders": "bg-gray-100 text-gray-700 border-gray-200",
  "To Sort": "bg-teal-50 text-teal-700 border-transparent",
  Sorting: "bg-violet-50 text-violet-700 border-transparent",
  Packed: "bg-blue-50 text-blue-700 border-blue-200",
  "Out for Delivery": "bg-cyan-50 text-cyan-700 border-transparent",
  Delivered: "bg-green-50 text-green-700 border-green-200",
  "Delivery Failed": "bg-red-50 text-red-700 border-red-200",
  "In Transfer": "bg-purple-50 text-purple-700 border-purple-200",
  Returned: "bg-orange-50 text-orange-700 border-orange-200",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export function ShipmentPill({ stage }: { stage: ShipmentStage }) {
  return <span className={cn(PILL, SHIP_CLASS[stage])}>{stage === "Packed" ? "Ready for Dispatch" : stage}</span>;
}

const PAY_CLASS: Record<PaymentType, string> = {
  Cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Credit: "bg-purple-50 text-purple-700 border-purple-200",
  QR: "bg-blue-50 text-blue-700 border-blue-200",
};

export function PaymentPill({ type }: { type: PaymentType }) {
  return <span className={cn(PILL, PAY_CLASS[type])}>{type === "QR" ? "QR / UPI" : type}</span>;
}

const COLL_CLASS: Record<CollectionStatus, string> = {
  Collected: "bg-sky-50 text-sky-700 border-transparent",
  Pending: "bg-gray-100 text-gray-700 border-gray-200",
  Failed: "bg-red-50 text-red-700 border-red-200",
  "Handed Over": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Reconciled: "bg-green-50 text-green-700 border-green-200",
  Short: "bg-amber-50 text-amber-700 border-amber-200",
};

export function CollectionPill({ status }: { status: CollectionStatus }) {
  return <span className={cn(PILL, COLL_CLASS[status])}>{status}</span>;
}

const RET_CLASS: Record<ReturnStatus, string> = {
  Open: "bg-amber-50 text-amber-700 border-amber-200",
  "Return to Seller Scheduled": "bg-sky-50 text-sky-700 border-transparent",
  "Returned to Seller": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Refund Processed": "bg-blue-50 text-blue-700 border-blue-200",
  Closed: "bg-green-50 text-green-700 border-green-200",
};

export function ReturnStatusPill({ status }: { status: ReturnStatus }) {
  return <span className={cn(PILL, RET_CLASS[status])}>{status}</span>;
}

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "purple" | "indigo";
const TONE_CLASS: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-700 border-gray-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-green-50 text-green-700 border-green-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export function Pill({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn(PILL, TONE_CLASS[tone])}>{children}</span>;
}

// ---------------- filters ----------------

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8 pr-8 bg-white" />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  width = "w-[170px]",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(width, "bg-white")} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRangeSelect({ value, onChange }: { value: DateRangeKey; onChange: (v: DateRangeKey) => void }) {
  return (
    <FilterSelect
      value={value}
      onChange={(v) => onChange(v as DateRangeKey)}
      options={DATE_RANGES.map((d) => ({ value: d.key, label: d.label }))}
      placeholder="Date"
      width="w-[140px]"
    />
  );
}

export function SegmentTabs<K extends string>({
  value,
  onChange,
  items,
}: {
  value: K;
  onChange: (k: K) => void;
  items: { key: K; label: string; count?: number; alert?: boolean }[];
}) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={cn(
            "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === it.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900",
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span
              className={cn(
                "ml-1.5 rounded-full px-1.5 text-[11px]",
                it.alert && it.count > 0 ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-700",
              )}
            >
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------- table helpers ----------------

export type SortDir = "asc" | "desc";

export function useTable<T>(rows: T[], opts: { pageSize?: number; sort?: { key: string; dir: SortDir }; accessors: Record<string, (r: T) => string | number> }) {
  const [sort, setSort] = useState(opts.sort ?? { key: "", dir: "desc" as SortDir });
  const [page, setPage] = useState(1);
  const pageSize = opts.pageSize ?? 15;
  const sorted = useMemo(() => {
    const acc = opts.accessors[sort.key];
    if (!acc) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const x = acc(a);
      const y = acc(b);
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const toggle = (key: string) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
    setPage(1);
  };
  return { paged, page: safePage, setPage, total: sorted.length, pageSize, sort, toggle, sorted };
}

export function Th({
  children,
  sortKey,
  table,
  className,
}: {
  children?: ReactNode;
  sortKey?: string;
  table?: { sort: { key: string; dir: SortDir }; toggle: (k: string) => void };
  className?: string;
}) {
  const active = sortKey && table?.sort.key === sortKey;
  return (
    <th className={cn("whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-gray-600", className)}>
      {sortKey && table ? (
        <button type="button" onClick={() => table.toggle(sortKey)} className="inline-flex items-center gap-1 hover:text-gray-900">
          {children}
          {active ? (
            table.sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({ children, className, onClick }: { children?: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <td onClick={onClick} className={cn("px-3 py-2.5 align-top text-sm text-gray-800", className)}>
      {children}
    </td>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">{children}</table>
    </div>
  );
}

/** Keeps the Actions column visible on wide tables (pinned to the right edge). */
export const STICKY_ACTIONS_TH = "sticky right-0 z-10 bg-gray-50 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]";
export const STICKY_ACTIONS_TD = "sticky right-0 z-[1] bg-white text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]";

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>{children}</tr>
    </thead>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-10 text-center text-sm text-gray-500">
        {text}
      </td>
    </tr>
  );
}

export function Pager({ table, label }: { table: { page: number; total: number; pageSize: number; setPage: (p: number) => void }; label: string }) {
  return (
    <div className="border-t border-gray-200 px-3 py-2">
      <ListPagination page={table.page} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} itemLabel={label} />
    </div>
  );
}

/** Mono-styled ID that reads well in dense tables. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("whitespace-nowrap font-mono text-[12px] text-gray-900", className)}>{children}</span>;
}
