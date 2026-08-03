import { Badge } from "./ui/badge";
import type { SellerType } from "../lib/mock-store";

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  distributor: "Distributor",
  wholesaler: "Wholesaler",
  hybrid: "Hybrid",
};

const STYLES: Record<SellerType, string> = {
  distributor: "bg-blue-50 text-blue-700 border-blue-200",
  wholesaler: "bg-amber-50 text-amber-700 border-amber-200",
  hybrid: "bg-purple-50 text-purple-700 border-purple-200",
};

/** Colour-coded chip for the CALCULATED seller type — Distributor
 *  (blue), Wholesaler (amber), Hybrid (purple). Used everywhere the
 *  type surfaces so the three models read consistently. */
export function SellerTypeBadge({
  type,
  className,
}: {
  type: SellerType;
  className?: string;
}) {
  return (
    <Badge className={`${STYLES[type]} ${className ?? ""}`}>
      {SELLER_TYPE_LABELS[type]}
    </Badge>
  );
}
