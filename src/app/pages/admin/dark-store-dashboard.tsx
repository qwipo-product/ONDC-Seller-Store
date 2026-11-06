// Admin → Dark Stores → <Store>
// -----------------------------------------------------------------
// One dark store (CDS) on one plain page — label / value lists and
// small tables, no charts:
// 1. Store details   — who and where it is (from the connector form).
// 2. Service area    — its polygon and the retailers inside it.
// 3. Connected sellers — sellers whose delivery beats reach the polygon.
// 4. Companies       — what retailers here can order through the store.
// 5. Retailers       — every active retailer inside, searchable, CSV.
// 6. Daily operations — orders / handover / delivery figures; empty
//    until orders are routed through the store.
//
// Only ACTIVE sellers and ACTIVE retailers (Business Status Active-User,
// Status Active) are counted — the same rules as Generate Report.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { ListPagination } from "../../components/ui/list-pagination";
import { EmptyState } from "../../components/empty-state";
import { PolygonPreviewMap } from "../../components/serviceability-map-view";
import { ArrowLeft, Download, Loader2, Pencil, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { getCustomers, subscribeToCustomers } from "../../lib/customer-database";
import { subscribeToServiceabilityBeats } from "../../lib/serviceability-data";
import {
  buildDarkStoreAnalysis,
  customerTable,
  downloadTableCsv,
  isLogisticsProvisioned,
  storeZoneLabel,
  useDarkStores,
  type DarkStoreAnalysis,
} from "../../lib/dark-store-data";

const fmt = (n: number) => n.toLocaleString("en-IN");

const DAY_SHORT: Record<string, string> = {
  "Next Day": "NDD",
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};
const shortDays = (days: string[]) =>
  days.length ? days.map((d) => DAY_SHORT[d] ?? d).join(", ") : "—";

const PAGE_SIZE = 20;

export function AdminDarkStoreDashboard() {
  const navigate = useNavigate();
  const { storeId = "" } = useParams();
  const store = useDarkStores().find((s) => s.id === storeId);

  // Built after first paint — a point-in-polygon pass over the roster.
  const [customers, setCustomers] = useState(getCustomers());
  const [beatsVersion, setBeatsVersion] = useState(0);
  useEffect(() => {
    const un1 = subscribeToCustomers(() => setCustomers([...getCustomers()]));
    const un2 = subscribeToServiceabilityBeats(() => setBeatsVersion((v) => v + 1));
    return () => {
      un1();
      un2();
    };
  }, []);
  const [analysis, setAnalysis] = useState<DarkStoreAnalysis | null>(null);
  useEffect(() => {
    if (!store) return;
    setAnalysis(null);
    const t = setTimeout(() => setAnalysis(buildDarkStoreAnalysis(store, customers, "zone")), 0);
    return () => clearTimeout(t);
  }, [store, customers, beatsVersion]);

  // Retailer table
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, storeId]);
  const retailerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (analysis?.customers ?? [])
      .filter((z) => {
        if (!q) return true;
        const c = z.customer;
        return (
          c.name.toLowerCase().includes(q) ||
          c.mobile.includes(q) ||
          c.cluster.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [analysis, search]);

  if (!store) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Store}
              title="Dark store not found"
              description="This dark store doesn't exist. Pick one from Dark Stores."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const downloadRetailers = () => {
    if (!analysis) return;
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const slug = store.areaName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadTableCsv(customerTable("zone"), retailerRows, `${slug}-dark-store_retailers_${stamp}.csv`);
    toast.success(`Downloaded ${fmt(retailerRows.length)} retailers as CSV`);
  };

  const provisioned = isLogisticsProvisioned(store);
  const location =
    store.latitude != null && store.longitude != null
      ? `${store.latitude.toFixed(5)}, ${store.longitude.toFixed(5)}`
      : "—";

  return (
    <div className="p-6 space-y-5">
      <button
        type="button"
        onClick={() => navigate("/admin/dark-stores")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All dark stores
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{store.name}</h2>
            {store.isActive ? (
              <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Active</Badge>
            ) : (
              <Badge variant="outline" className="text-gray-600 text-xs">
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {[store.areaName, store.city].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/connectors/darkstore?edit=${store.id}`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Update store
          </Button>
          <Button onClick={downloadRetailers} disabled={!analysis}>
            <Download className="h-4 w-4 mr-2" />
            Download retailers
          </Button>
        </div>
      </div>

      {/* 1 — Store details */}
      <Section title="Store details">
        <Facts
          items={[
            ["Dark store name", store.name],
            ["Area", store.areaName],
            ["Status", store.isActive ? "Active" : "Inactive"],
            ["Address", store.address || "—"],
            ["City / PIN", [store.city, store.pincode].filter(Boolean).join(" – ") || "—"],
            ["State", store.state || "—"],
            ["Mobile", store.mobile || "—"],
            ["Email", store.email || "—"],
            ["GST number", store.gstNumber || "—"],
            ["Location (lat, long)", location],
            ["ONDC city code", store.ondcCityCode || "—"],
            [
              "Logistics account",
              provisioned ? (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">LBNP + LSP</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 text-xs">
                  Provisioning incomplete
                </Badge>
              ),
            ],
          ]}
        />
      </Section>

      {/* 2 — Service area */}
      <Section title="Service area">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Facts
            columns={1}
            items={[
              ["Polygon", `${storeZoneLabel(store)}${store.zoneFileName ? ` · ${store.zoneFileName}` : ""}`],
              ["Retailers inside (all)", analysis ? fmt(analysis.totalInZone) : <Pending />],
              ["Active retailers", analysis ? fmt(analysis.customers.length) : <Pending />],
              [
                "Served by connected sellers",
                analysis ? `${fmt(analysis.covered)} (${analysis.coveragePct}%)` : <Pending />,
              ],
              ["Not served by any seller", analysis ? fmt(analysis.notCovered) : <Pending />],
              [
                "Companies a retailer can order (avg)",
                analysis ? String(analysis.avgCompanies) : <Pending />,
              ],
            ]}
          />
          <PolygonPreviewMap
            data={store.zone}
            caption="The dark store's polygon — every retailer inside it is routed to this store."
          />
        </div>
      </Section>

      {/* 3 — Connected sellers */}
      <Section title={`Connected sellers${analysis ? ` (${analysis.sellers.length})` : ""}`}>
        {!analysis ? (
          <Pending block />
        ) : analysis.sellers.length === 0 ? (
          <p className="text-sm text-gray-500">No seller's delivery beats reach into this polygon yet.</p>
        ) : (
          <SimpleTable
            headers={["Seller", "Companies", "Active retailers reached", "Delivery days", "Warehouse distance"]}
            rightFrom={1}
            rows={analysis.sellers.map((s) => [
              <div key="n">
                <p className="font-medium text-gray-900">{s.businessName}</p>
                <p className="text-xs text-gray-500">{s.sellerName}</p>
              </div>,
              fmt(s.companyNames.length),
              fmt(s.customersReached),
              shortDays(s.deliveryDays),
              s.warehouseKm != null ? `${s.warehouseKm} km` : "—",
            ])}
          />
        )}
      </Section>

      {/* 4 — Companies */}
      <Section title={`Companies available${analysis ? ` (${analysis.companies.length})` : ""}`}>
        {!analysis ? (
          <Pending block />
        ) : analysis.companies.length === 0 ? (
          <p className="text-sm text-gray-500">No company is delivered inside this polygon yet.</p>
        ) : (
          <SimpleTable
            headers={["Company", "Sellers", "Active retailers reached"]}
            rightFrom={1}
            rows={analysis.companies.map((c) => [
              <span key="c" className="font-medium text-gray-900">{c.companyName}</span>,
              fmt(c.sellerNames.length),
              `${fmt(c.customersReached)} (${c.coveragePct}%)`,
            ])}
          />
        )}
      </Section>

      {/* 5 — Retailers */}
      <Section
        title={`Active retailers${analysis ? ` (${fmt(analysis.customers.length)})` : ""}`}
        action={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, mobile or cluster"
              className="pl-10 h-9"
            />
          </div>
        }
      >
        {!analysis ? (
          <Pending block />
        ) : (
          <>
            <SimpleTable
              headers={["Retailer", "Mobile", "Cluster", "Companies", "Sellers", "Distance"]}
              rightFrom={3}
              rows={retailerRows
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((z) => [
                  <button
                    key="r"
                    type="button"
                    className="font-medium text-gray-900 hover:text-violet-700 hover:underline text-left"
                    onClick={() => navigate(`/admin/customers/${z.customer.id}`)}
                  >
                    {z.customer.name}
                  </button>,
                  z.customer.mobile || "—",
                  z.customer.cluster || "—",
                  fmt(z.companyNames.length),
                  fmt(z.sellerIds.length),
                  `${z.distanceKm} km`,
                ])}
            />
            <ListPagination
              page={page}
              total={retailerRows.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="retailer"
              hideOnSinglePage
            />
          </>
        )}
      </Section>

      {/* 6 — Daily operations */}
      <Section title="Daily operations">
        <p className="text-xs text-gray-500 mb-3">
          Fills in once retailer orders are routed through this dark store.
        </p>
        <Facts
          items={[
            ["Orders today", "—"],
            ["Waiting for seller handover", "—"],
            ["Received at store", "—"],
            ["Out for delivery", "—"],
            ["Delivered today", "—"],
            ["Average delivery time", "—"],
          ]}
        />
      </Section>
    </div>
  );
}

// ---- Building blocks ----

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Label / value pairs in a grid. */
function Facts({ items, columns = 3 }: { items: [string, ReactNode][]; columns?: 1 | 3 }) {
  return (
    <dl
      className={`grid gap-x-6 gap-y-3 ${
        columns === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-gray-500">{label}</dt>
          <dd className="text-sm text-gray-900 mt-0.5 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A plain table; columns from `rightFrom` on are right-aligned numbers. */
function SimpleTable({
  headers,
  rows,
  rightFrom,
}: {
  headers: string[];
  rows: ReactNode[][];
  rightFrom: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {headers.map((h, i) => (
              <TableHead
                key={h}
                className={`text-xs uppercase text-gray-500 ${i >= rightFrom ? "text-right" : ""}`}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, ri) => (
            <TableRow key={ri}>
              {r.map((c, ci) => (
                <TableCell
                  key={ci}
                  className={`text-sm ${ci >= rightFrom ? "text-right tabular-nums text-gray-700" : ""}`}
                >
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Pending({ block }: { block?: boolean }) {
  return block ? (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
      <Loader2 className="h-4 w-4 animate-spin" />
      Working out the numbers…
    </div>
  ) : (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
  );
}
