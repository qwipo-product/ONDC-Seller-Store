import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Receipt, Building2, Pencil, Store } from "lucide-react";
import { ListPagination, paginate } from "../../components/ui/list-pagination";
import {
  getCompanies as getAdminCatalogCompanies,
  subscribeToCompanies as subscribeToAdminCatalog,
  type Company,
} from "../../lib/admin-catalog";
import {
  getSellerDistributorConfig,
  getSellerWholesaleConfig,
  subscribeToChargeConfigs,
  upsertChargeConfig,
  commerceRetailerPct,
  logisticsRetailerPerKg,
  logisticsRetailerPct,
  type ChargeConfig,
  type CommerceFeeConfig,
  type LogisticsFeeConfig,
  type BeatSmallOrderConfig,
} from "../../lib/charges-data";
import type { Seller, OperationMode } from "../../lib/mock-store";

const PAGE_SIZE = 25;

const pct = (n: number) => `${+n.toFixed(2)}%`;
const rupee = (n: number) => `₹${+n.toFixed(2)}`;

// ---- Cell text helpers. A disabled section reads "Disabled" on an active
// config and "Not Configured" on an inactive (stub / unconfigured) config. ----
function commerceText(c: CommerceFeeConfig, status: ChargeConfig["status"]): string {
  if (!c.enabled) return status === "inactive" ? "Not Configured" : "Disabled";
  if (c.method === "order_slab") {
    if (c.slabs.length === 0) return "Order Slab";
    const fees = c.slabs.map((s) => s.fee);
    return `Order Slab (${rupee(Math.min(...fees))} - ${rupee(Math.max(...fees))})`;
  }
  return `${pct(c.qwipoTargetPct)} / ${pct(commerceRetailerPct(c))}`;
}
function logisticsText(l: LogisticsFeeConfig, status: ChargeConfig["status"]): string {
  if (!l.enabled) return status === "inactive" ? "Not Configured" : "Disabled";
  if (l.method === "per_kg") {
    return `${rupee(l.qwipoTargetPerKg)}/kg / ${rupee(logisticsRetailerPerKg(l))}/kg`;
  }
  return `${pct(l.qwipoTargetPct)} / ${pct(logisticsRetailerPct(l))}`;
}
function beatText(b: BeatSmallOrderConfig, status: ChargeConfig["status"]): string {
  if (!b.enabled) return status === "inactive" ? "Not Configured" : "Disabled";
  return `${rupee(b.flatFeeBelowBeatThreshold)} / ${rupee(b.flatFeeBelowNonBeatThreshold)}`;
}

// Relative "time ago" — e.g. "just now", "3 days ago", "2 weeks ago".
function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  const ago = (n: number, unit: string) => `${n} ${unit}${n > 1 ? "s" : ""} ago`;
  if (secs < 60) return "just now";
  if (mins < 60) return ago(mins, "min");
  if (hrs < 24) return ago(hrs, "hour");
  if (days < 7) return ago(days, "day");
  if (weeks < 5) return ago(weeks, "week");
  if (months < 12) return ago(months, "month");
  return ago(years, "year");
}

function Th({
  title,
  sub,
  align = "left",
}: {
  title: string;
  sub?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2.5 text-${align} text-xs font-semibold uppercase tracking-wider text-gray-600 align-bottom`}
    >
      <span className="whitespace-nowrap">{title}</span>
      {sub && (
        <span className="block normal-case font-normal text-[10px] text-gray-400">
          {sub}
        </span>
      )}
    </th>
  );
}

// A row is either one distributor company (configured individually) or the
// single shared wholesale entry that spans every wholesaler-mode company.
type Row =
  | { kind: "distributor"; key: string; company: Company; config?: ChargeConfig }
  | {
      kind: "wholesaler";
      key: string;
      companies: Company[];
      config?: ChargeConfig;
    };

export function SellerChargesTab({ seller }: { seller: Seller }) {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>(
    getAdminCatalogCompanies(),
  );
  const [configVersion, setConfigVersion] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(
    () => subscribeToAdminCatalog(() => setCompanies([...getAdminCatalogCompanies()])),
    [],
  );
  // Re-render on any charge-config change so status/fees reflect edits made
  // in the wizard and returned to this tab.
  useEffect(
    () => subscribeToChargeConfigs(() => setConfigVersion((n) => n + 1)),
    [],
  );

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );

  const selections = seller.companyBrandSelections ?? [];

  const rows: Row[] = useMemo(() => {
    const distributor: Row[] = [];
    const wholesalerCompanies: Company[] = [];
    for (const sel of selections) {
      const company = companyById.get(sel.companyId);
      if (!company) continue;
      const mode: OperationMode = sel.operationMode ?? "distributor";
      if (mode === "wholesaler") {
        wholesalerCompanies.push(company);
      } else {
        distributor.push({
          kind: "distributor",
          key: `dist-${company.id}`,
          company,
          config: getSellerDistributorConfig(seller.id, company.id),
        });
      }
    }
    // Wholesale sits at the TOP of the table (a single shared row), with the
    // individual distributor companies listed beneath it.
    const out: Row[] = [];
    if (wholesalerCompanies.length > 0) {
      out.push({
        kind: "wholesaler",
        key: "wholesale",
        companies: wholesalerCompanies,
        config: getSellerWholesaleConfig(seller.id),
      });
    }
    out.push(...distributor);
    return out;
    // configVersion bumps on every charge-config change so this memo re-reads
    // the mutable store after edits made in the wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, companyById, seller.id, configVersion]);

  const toggleStatus = (config: ChargeConfig) => {
    upsertChargeConfig({
      ...config,
      status: config.status === "active" ? "inactive" : "active",
    });
  };

  const goConfigure = (row: Row) => {
    if (row.kind === "wholesaler") {
      navigate(`/admin/charges/configure/${seller.id}/wholesaler/_all`);
    } else {
      navigate(
        `/admin/charges/configure/${seller.id}/distributor/${row.company.id}`,
      );
    }
  };

  // Clamp the current page if the row set shrinks (e.g. companies removed).
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = paginate(rows, safePage, PAGE_SIZE);

  return (
    <div className="h-full flex flex-col min-h-0">
      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Receipt className="h-10 w-10 mx-auto text-gray-300 mb-2" />
            <p className="font-medium text-gray-600">No companies linked</p>
            <p className="text-sm text-gray-500 mt-1">
              Link companies from the Companies &amp; Brands tab to configure
              their charges here.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <Th title="Company" />
                  <Th title="Commercial Fees" sub="Qwipo / Retailer" />
                  <Th title="Logistics Fee" sub="Qwipo / Retailer" />
                  <Th title="Beat Small Order" sub="Beat / Non-Beat" />
                  <Th title="Status" />
                  <Th title="Last Updated" />
                  <Th title="Actions" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((row) => {
                  const config = row.config;
                  const status: ChargeConfig["status"] =
                    config?.status ?? "inactive";
                  const muted = (s: string) =>
                    s === "Not Configured" || s === "Disabled"
                      ? "text-gray-400"
                      : "text-gray-700";
                  const cText = config
                    ? commerceText(config.commerce, status)
                    : "Not Configured";
                  const lText = config
                    ? logisticsText(config.logistics, status)
                    : "Not Configured";
                  const bText = config
                    ? beatText(config.beat, status)
                    : "Not Configured";
                  return (
                    <tr key={row.key} className="hover:bg-gray-50">
                      {/* Company / Wholesale identity */}
                      <td className="px-3 py-2.5">
                        {row.kind === "distributor" ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-md border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                              {row.company.imageUrl ? (
                                <img
                                  src={row.company.imageUrl}
                                  alt={row.company.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Building2 className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="font-medium text-gray-900 text-sm truncate max-w-[160px]"
                                title={row.company.name}
                              >
                                {row.company.name}
                              </p>
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] mt-0.5">
                                Distributor
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-md border border-amber-200 bg-amber-50 flex items-center justify-center shrink-0">
                              <Store className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm">
                                Wholesale
                              </p>
                              <p
                                className="text-[11px] text-gray-500 truncate max-w-[180px]"
                                title={row.companies.map((c) => c.name).join(", ")}
                              >
                                {row.companies.length} compan
                                {row.companies.length === 1 ? "y" : "ies"} ·{" "}
                                {row.companies.map((c) => c.name).join(", ")}
                              </p>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${muted(cText)}`}>
                        {cText}
                      </td>
                      <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${muted(lText)}`}>
                        {lText}
                      </td>
                      <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${muted(bText)}`}>
                        {bText}
                      </td>
                      {/* Status */}
                      <td className="px-3 py-2.5">
                        {config ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={status === "active"}
                              onCheckedChange={() => toggleStatus(config)}
                              aria-label="Toggle active"
                            />
                            <span
                              className={`text-xs font-medium ${
                                status === "active"
                                  ? "text-green-700"
                                  : "text-gray-500"
                              }`}
                            >
                              {status === "active" ? "Active" : "Inactive"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Not configured
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                        {relativeTime(config?.updatedAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title={config ? "Edit configuration" : "Configure charges"}
                            onClick={() => goConfigure(row)}
                          >
                            <Pencil className="h-4 w-4 text-gray-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination
            page={safePage}
            total={rows.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="row"
          />
        </>
      )}
    </div>
  );
}
