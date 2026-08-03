import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Search,
  Store,
  Plus,
  Filter,
} from "lucide-react";
import { getSellers, deriveSellerType, type Seller } from "../../lib/mock-store";
import { SellerTypeBadge } from "../../components/seller-type-badge";
import { EmptyState } from "../../components/empty-state";
import { ListPagination, paginate } from "../../components/ui/list-pagination";
import {
  SellersFilterDrawer,
  type SellerStatusFilter,
} from "../../components/filter-drawers/sellers-filter-drawer";

const PAGE_SIZE = 10;

export function AdminActiveSellers() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // 1-indexed page. Reset to 1 every time the search query OR a filter
  // changes so the visible window doesn't fall off the end of a shorter
  // result set.
  const [page, setPage] = useState(1);
  // Right-hand filter drawer state. The status filter mirrors the
  // pattern used by the seller-module drawers (My SKU, Orders, etc.).
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SellerStatusFilter>("all");

  useEffect(() => {
    setSellers(getSellers());
  }, []);

  const filtered = useMemo(() => {
    return sellers.filter((s) => {
      // Status — `isActive` defaults to true for legacy records that
      // don't carry the field. "all" disables the gate entirely.
      const active = s.isActive !== false;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      // Search — restricted to seller name + business name only.
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.businessName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sellers, searchQuery, statusFilter]);

  const activeFilterCount = statusFilter !== "all" ? 1 : 0;

  const pageRows = paginate(filtered, page, PAGE_SIZE);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Toolbar — sticky at the top of the page area. */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {filtered.length} seller{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by seller name or business name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            {/* Filters CTA — slides in the right-hand drawer. The pill
                next to the icon shows the active filter count so the
                admin always knows whether the list is gated. */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsFilterDrawerOpen(true)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold w-5 h-5">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button
              className="gap-2"
              onClick={() => navigate("/admin/users/add")}
            >
              <Plus className="h-4 w-4" />
              Add Seller
            </Button>
          </div>
        </div>
      </div>

      {/* Content — Card stretches to fill the available height so the
          empty state and the "data + pagination" layout both feel
          full-page rather than squished into a small block. */}
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col overflow-hidden p-0 gap-0">
          {filtered.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Store}
                title={
                  sellers.length === 0
                    ? "No sellers onboarded yet"
                    : "No sellers found"
                }
                description={
                  sellers.length === 0
                    ? "No sellers yet — click + Add Seller to onboard the first one."
                    : searchQuery
                      ? "No sellers found — try a different search term."
                      : "No sellers match your current filters."
                }
                action={
                  sellers.length === 0 ? (
                    <Button
                      className="gap-2"
                      onClick={() => navigate("/admin/users/add")}
                    >
                      <Plus className="h-4 w-4" />
                      Add Seller
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Scrollable table region — only the rows scroll, the
                  toolbar above and pagination below stay pinned. */}
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Seller Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Business Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Mobile Number
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Seller Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageRows.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{s.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-700">
                            {s.businessName}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {s.phone}
                        </td>
                        <td className="px-4 py-3">
                          {/* Calculated from company operation modes —
                              never stored/edited manually. */}
                          <SellerTypeBadge type={deriveSellerType(s)} />
                        </td>
                        <td className="px-4 py-3">
                          {s.isActive !== false ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                              Inactive
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/users/${s.id}`);
                              }}
                            >
                              Manage
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ListPagination
                page={page}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="seller"
              />
            </>
          )}
        </Card>
      </div>

      {/* Right-hand filter drawer — same pattern as the seller-module
          drawers (My SKU, Orders, Offers, …). */}
      <SellersFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        status={statusFilter}
        onStatusChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onClearFilters={() => {
          setStatusFilter("all");
          setPage(1);
        }}
      />
    </div>
  );
}
