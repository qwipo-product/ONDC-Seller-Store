import { useNavigate } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Rocket,
  Clock,
  ChevronRight,
  Database,
  Package,
} from "lucide-react";

export function BrandManagerDashboard() {
  const navigate = useNavigate();

  const modules = [
    {
      label: "My Catalog",
      description: "Browse SKUs across the companies and brands mapped to your account.",
      href: "/catalog-admin/my-catalog",
      icon: Database,
    },
    {
      label: "Create SKU",
      description: "Add a new SKU to the catalog or bulk-import multiple SKUs via CSV.",
      href: "/catalog-admin/catalog/create",
      icon: Package,
    },
  ];

  return (
    <div className="min-h-full bg-gradient-to-b from-teal-50 via-white to-green-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex h-20 w-20 rounded-2xl bg-gradient-to-br from-teal-500 to-green-600 items-center justify-center shadow-xl mb-5">
            <Rocket className="h-10 w-10 text-white" />
          </div>
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 mb-3">
            <Clock className="h-3 w-3 mr-1" />
            Coming Soon
          </Badge>
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            Brand Manager Dashboard is on the way
          </h1>
          <p className="text-base text-gray-600 max-w-xl mx-auto leading-relaxed">
            SKU health summaries, request status and brand-level analytics are{" "}
            <b>not part of Phase 1</b>. They will be released in a later phase.
            In the meantime, jump straight into the modules below.
          </p>
        </div>

        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
              Available now
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {modules.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.label}
                    onClick={() => navigate(m.href)}
                    className="group flex items-center gap-3 text-left p-3 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-teal-100 group-hover:bg-teal-200 flex items-center justify-center transition-colors flex-shrink-0">
                      <Icon className="h-5 w-5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                      <p className="text-xs text-gray-600 line-clamp-2">{m.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          Need a metric urgently or have feedback?{" "}
          <a href="mailto:support@qwipo.com" className="text-teal-600 hover:text-teal-700 font-medium">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
