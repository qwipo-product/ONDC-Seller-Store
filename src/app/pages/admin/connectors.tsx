import { useNavigate } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Database,
  ShoppingBag,
  CheckCircle,
  ChevronRight,
  Settings,
  Plug,
  Warehouse,
} from "lucide-react";
import { useDarkStores } from "../../lib/dark-store-data";

interface ConnectorInfo {
  id: string;
  name: string;
  type: "DMS" | "Marketplace" | "Dark store";
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  status: "active" | "inactive";
  lastSync: string;
  syncFrequency: string;
}

// Phase 1 ships ONDC and the Digidukaan Darkstore Connector. Bizom (DMS)
// and other DMS connectors are deferred to Phase 2.
const connectors: ConnectorInfo[] = [
  {
    id: "ondc",
    name: "ONDC",
    type: "Marketplace",
    description:
      "Open Network for Digital Commerce. Buyer-side order routing, catalog publishing and fulfillment updates.",
    icon: <ShoppingBag className="h-6 w-6" />,
    iconBg: "bg-orange-100 text-orange-600",
    status: "active",
    lastSync: "1 minute ago",
    syncFrequency: "Real-time",
  },
  {
    // Detail page: pages/admin/darkstore-connector.tsx
    id: "darkstore",
    name: "Digidukaan Darkstore Connector",
    type: "Dark store",
    description:
      "Qwipo last-mile dark stores deliver on the seller's behalf. Orders route by the customer's location inside each store's polygon.",
    icon: <Warehouse className="h-6 w-6" />,
    iconBg: "bg-emerald-100 text-emerald-600",
    status: "active",
    lastSync: "N/A",
    syncFrequency: "Real-time",
  },
];

export function AdminConnectors() {
  const navigate = useNavigate();

  const stores = useDarkStores();

  const typeBadge = (type: ConnectorInfo["type"]) =>
    type === "DMS" ? (
      <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs">
        <Database className="h-3 w-3" />
        DMS
      </Badge>
    ) : type === "Dark store" ? (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs">
        <Warehouse className="h-3 w-3" />
        Dark store
      </Badge>
    ) : (
      <Badge className="bg-orange-50 text-orange-700 border-orange-200 gap-1 text-xs">
        <ShoppingBag className="h-3 w-3" />
        Marketplace
      </Badge>
    );

  const statusBadge = (status: ConnectorInfo["status"]) =>
    status === "active" ? (
      <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
        <CheckCircle className="h-3 w-3" />
        Active
      </Badge>
    ) : (
      <Badge variant="outline" className="text-gray-600">
        Inactive
      </Badge>
    );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Toolbar — matches the Sellers / Companies / Categories pattern.
          Connectors don't have a primary CTA right now (Phase 1 ships
          ONDC only and it's added by default), so the toolbar just
          shows the count. */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {connectors.length} connector{connectors.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map((c) => (
            <Card
              key={c.id}
              className="border border-gray-200 hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`${c.iconBg} p-2.5 rounded-lg`}>
                      {c.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">
                        {c.name}
                      </p>
                      {typeBadge(c.type)}
                    </div>
                  </div>
                  {statusBadge(c.status)}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {c.description}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">
                      {c.id === "darkstore" ? "Dark Stores" : "Last Sync"}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {c.id === "darkstore"
                        ? `${stores.filter((s) => s.isActive).length} active`
                        : c.lastSync}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Frequency</p>
                    <p className="text-sm font-medium text-gray-900">
                      {c.syncFrequency}
                    </p>
                  </div>
                </div>

                {/* Manage */}
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={() => navigate(`/admin/connectors/${c.id}`)}
                >
                  <Settings className="h-4 w-4" />
                  Manage
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
