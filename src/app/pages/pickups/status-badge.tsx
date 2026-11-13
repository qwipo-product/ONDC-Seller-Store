import { Badge } from "../../components/ui/badge";
import type { Pickup } from "../../lib/cross-dock-data";

const STATUS: Record<Pickup["status"], { label: string; className: string }> = {
  SCHEDULED: { label: "Scheduled", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ARRIVED: { label: "Driver at your store", className: "bg-amber-50 text-amber-800 border-amber-300" },
  PICKED_UP: { label: "Picked up", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  RELEASED: { label: "Released · nothing to load", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export function PickupStatusBadge({ pickup, className = "" }: { pickup: Pickup; className?: string }) {
  const s = STATUS[pickup.status];
  return <Badge className={`${s.className} ${className}`}>{s.label}</Badge>;
}
