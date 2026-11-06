// Admin → Dark Stores
// -----------------------------------------------------------------
// Every dark store (CDS) side by side in one plain table — the few
// numbers that tell you how a store is set up and how well its area is
// served. Click a row for that store's page. Stores are added and edited
// in Connectors → Digidukaan Darkstore Connector.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { EmptyState } from "../../components/empty-state";
import { ChevronRight, Plug, Search, Warehouse } from "lucide-react";
import { getCustomers, subscribeToCustomers } from "../../lib/customer-database";
import { subscribeToServiceabilityBeats } from "../../lib/serviceability-data";
import {
  buildDarkStoreAnalysis,
  storeZoneLabel,
  useDarkStores,
  type DarkStoreAnalysis,
} from "../../lib/dark-store-data";

const fmt = (n: number) => n.toLocaleString("en-IN");

export function AdminDarkStores() {
  const navigate = useNavigate();
  const stores = useDarkStores();
  const [search, setSearch] = useState("");

  // Per-store numbers, built after first paint — each is a
  // point-in-polygon pass over the retailer roster.
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
  const [stats, setStats] = useState<Map<string, DarkStoreAnalysis>>(new Map());
  useEffect(() => {
    const t = setTimeout(() => {
      setStats(new Map(stores.map((s) => [s.id, buildDarkStoreAnalysis(s, customers, "zone")])));
    }, 0);
    return () => clearTimeout(t);
  }, [stores, customers, beatsVersion]);

  const q = search.trim().toLowerCase();
  const rows = stores.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || s.areaName.toLowerCase().includes(q),
  );
  const cell = (id: string, pick: (a: DarkStoreAnalysis) => string) => {
    const a = stats.get(id);
    return a ? pick(a) : "…";
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {rows.length} dark store{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or area"
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/connectors/darkstore")}>
              <Plug className="h-4 w-4" />
              Add / edit stores
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card className="overflow-hidden gap-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title={stores.length === 0 ? "No dark stores yet" : "No dark stores found"}
              description={
                stores.length === 0
                  ? "Add one in Connectors → Digidukaan Darkstore Connector."
                  : "Try a different name or area."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs uppercase text-gray-500">Dark store</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500">Area</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500">Status</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500">Polygon</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 text-right">Active retailers</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 text-right">Served by sellers</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 text-right">Connected sellers</TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 text-right">Companies</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/admin/dark-stores/${s.id}`)}
                    >
                      <TableCell className="font-medium text-gray-900">{s.name}</TableCell>
                      <TableCell className="text-sm text-gray-700">{s.areaName}</TableCell>
                      <TableCell>
                        {s.isActive ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{storeZoneLabel(s)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cell(s.id, (a) => fmt(a.customers.length))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cell(s.id, (a) => `${fmt(a.covered)} (${a.coveragePct}%)`)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cell(s.id, (a) => fmt(a.sellers.length))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cell(s.id, (a) => fmt(a.companies.length))}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
        <p className="text-xs text-gray-500 mt-3">
          Active retailers — inside the store's polygon. Served by sellers — of those, how many at
          least one connected seller already delivers to. Connected sellers — sellers whose delivery
          beats reach into the polygon.
        </p>
      </div>
    </div>
  );
}
