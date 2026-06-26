import { useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Store,
  ShoppingCart,
  Truck,
  Wallet,
  ChevronRight,
  MessageCircle,
} from "lucide-react";

interface SettingCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  iconBg: string;
  iconColor: string;
  comingSoon?: boolean;
}

// Order: active settings first (Store → Order → Communication), then
// the Coming-Soon cards (Shipping, Payment) at the end so the seller
// reaches what they can actually use without scanning past disabled
// tiles.
const settingsCards: SettingCard[] = [
  {
    id: "store",
    title: "Store Settings",
    description: "Manage holidays and store availability",
    icon: <Store className="h-6 w-6" />,
    path: "/settings/store",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    id: "order",
    title: "Order Settings",
    description: "Configure minimum order values and order rules",
    icon: <ShoppingCart className="h-6 w-6" />,
    path: "/settings/order",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    id: "communication",
    title: "Communication Settings",
    description: "Configure email and SMS settings",
    icon: <MessageCircle className="h-6 w-6" />,
    path: "/settings/communication",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-600",
  },
  {
    id: "shipping",
    title: "Shipping Settings",
    description: "Configure delivery fee slabs",
    icon: <Truck className="h-6 w-6" />,
    path: "/settings/shipping",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    id: "payment",
    title: "Payment Settings",
    description: "Configure payment providers and modes",
    icon: <Wallet className="h-6 w-6" />,
    path: "/settings/payment",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    comingSoon: true,
  },
];

export function Settings() {
  const navigate = useNavigate();
  // Logistics has moved out of the seller's Settings hub entirely —
  // it's now controlled per-seller by the Super Admin from the Manage
  // Seller → Logistics tab.

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Toolbar — matches other pages */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <p className="text-sm text-gray-600">
          Manage your store configurations
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settingsCards.map((card) => (
            <Card
              key={card.id}
              className={`border border-gray-200 transition-all ${
                card.comingSoon
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:shadow-md hover:border-gray-300"
              }`}
              onClick={() => !card.comingSoon && navigate(card.path)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`${card.iconBg} ${card.iconColor} p-2.5 rounded-lg`}
                    >
                      {card.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {card.title}
                      </h3>
                    </div>
                  </div>
                  {card.comingSoon && (
                    <Badge className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {card.description}
                </p>
                {!card.comingSoon && (
                  <div className="flex items-center text-sm text-blue-600 font-medium">
                    Configure
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}
