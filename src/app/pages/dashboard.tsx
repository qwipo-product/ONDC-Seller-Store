import { useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Rocket,
  Clock,
  Package,
  ShoppingCart,
  Users,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface PhaseOneCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  iconBg: string;
  iconColor: string;
}

const PHASE_ONE: PhaseOneCard[] = [
  {
    id: "my-sku",
    title: "My SKU",
    description: "Manage your catalog and ONDC details",
    icon: <Package className="h-5 w-5" />,
    path: "/my-sku",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    id: "orders",
    title: "Orders",
    description: "View and manage incoming orders",
    icon: <ShoppingCart className="h-5 w-5" />,
    path: "/orders",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    id: "customers",
    title: "Customers",
    description: "Customer list, filters and exports",
    icon: <Users className="h-5 w-5" />,
    path: "/customers",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    id: "offers",
    title: "Offers & Schemes",
    description: "Quantity Pricing Schemes (QPS)",
    icon: <Sparkles className="h-5 w-5" />,
    path: "/offers",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
];

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto py-10 text-center">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Rocket className="h-10 w-10 text-white" />
            </div>
            <Badge className="absolute -bottom-2 -right-6 bg-amber-50 text-amber-700 border-amber-200 gap-1 text-[11px]">
              <Clock className="h-3 w-3" />
              Coming Soon
            </Badge>
          </div>

          <h1 className="text-3xl font-semibold text-gray-900">
            Dashboard is on the way
          </h1>
          <p className="text-sm text-gray-600 mt-3 max-w-xl mx-auto">
            Sales KPIs, smart insights, recent-orders feed and other
            dashboard visualisations are <b>not part of Phase 1</b>. They
            will be released in a later phase. In the meantime, jump
            straight into the modules below.
          </p>

          <Card className="mt-8 border border-gray-200 text-left">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-4">
                Available now in Phase 1
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PHASE_ONE.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => navigate(card.path)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 transition-colors text-left"
                  >
                    <div
                      className={`${card.iconBg} ${card.iconColor} p-2.5 rounded-lg shrink-0`}
                    >
                      {card.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {card.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {card.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-gray-500 mt-6">
            Have feedback or need a metric urgently?{" "}
            <button
              type="button"
              onClick={() => navigate("/support")}
              className="text-blue-600 hover:underline font-medium"
            >
              Contact support
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
