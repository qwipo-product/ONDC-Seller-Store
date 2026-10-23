import { useNavigate, useParams } from "react-router";
import { useRef, useState } from "react";
import { getMySkus } from "../../lib/my-sku-store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Progress } from "../../components/ui/progress";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import { cn } from "../../components/ui/utils";
import {
  ArrowLeft,
  Package,
  Pencil,
  Tag,
  FileText,
  DollarSign,
  IndianRupee,
  Upload,
  X,
  Image as ImageIcon,
  Archive,
  Gift,
  Percent,
  ShoppingCart,
  Users,
  PackageOpen,
  TrendingUp,
  Sparkles,
  Flame,
  Star,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Ruler,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { validateSKU, ValidationError } from "../../lib/ondc-validation";
import { useAuth } from "../../lib/auth-context";
import {
  getProcessingTimeHours,
  formatProcessingTimeLabel,
} from "../../lib/order-settings-data";
// Active-offers lookup + warning dialog — used by the Price &
// Inventory tab to gate Save Price & Stock when the seller updates
// the SP of a SKU that has Active or Scheduled QPS schemes mapped.
import { getActiveSchemesForSku } from "../../lib/offers-data";
import type { QpsScheme } from "../../lib/qps-validation";
import { PriceUpdateOffersDialog } from "../../components/price-update-offers-dialog";
// Weight in KG is auto-calculated from Measure Unit × SKU Weight;
// measureToKg + formatKgValue live with the bulk-import schema so
// the manual form and the import preview agree on the math.
import { measureToKg, formatKgValue } from "../../lib/sku-import-template";
// Shared catalog — every SKU in My SKU lives here. SKU Detail only
// ships rich detail for a few SKUs (1, 2, 190000001); for everything
// else we synthesize a minimal SKU object from the catalog so the
// page renders the right SKU code, name, MRP and SP — which the
// Price & Inventory tab and the offers warning both depend on.
import { catalogSkus, findSku as findCatalogSku } from "../../lib/sku-catalog";

// ONDC eB2B category taxonomy — shown as the Category ID dropdown options.
const CATEGORY_OPTIONS = [
  "Fruits and Vegetables",
  "Masala & Seasoning",
  "Oil & Ghee",
  "Eggs, Meat & Fish",
  "Bakery, Cakes & Dairy",
  "Pet Care",
  "Detergents and Dishwash",
  "Dairy and Cheese",
  "Snacks, Dry Fruits, Nuts",
  "Pasta, Soup and Noodles",
  "Cereals and Breakfast",
  "Sauces, Spreads and Dips",
  "Chocolates and Biscuits",
  "Cooking and Baking Needs",
  "Tinned and Processed Food",
  "Atta, Flours and Sooji",
  "Rice and Rice Products",
  "Dals and Pulses",
  "Salt, Sugar and Jaggery",
  "Energy and Soft Drinks",
  "Water",
  "Tea and Coffee",
  "Fruit Juices and Fruit Drinks",
  "Snacks and Namkeen",
  "Ready to Cook and Eat",
  "Pickles and Chutney",
  "Indian Sweets",
  "Frozen Vegetables",
  "Frozen Snacks",
  "Gift Voucher",
  "Gourmet & World Foods",
  "Foodgrains",
  "Beverages",
  "Beauty & Hygiene",
  "Kitchen Accessories",
  "Baby Care",
  "Snacks & Branded Foods",
];

// Group-name dropdown options. In production these would come from a
// distinct-groupName API across the seller's imported SKUs; for the
// demo we seed the most common families so the Add SKU dialog has
// something useful to pick from.
const KNOWN_GROUP_NAMES = [
  "Freedom Model",
  "Freedom Refined Sunflower Oil",
  "Aashirvaad Atta",
  "Sunfeast Biscuits",
  "Yippee Noodles",
  "Bingo Snacks",
  "Marico Saffola",
  "Classmate Notebooks",
];

// validateSKU returns errors keyed by ONDC JSON-paths (e.g.
// "items[].descriptor.name"). The seller doesn't think in those
// terms, so map the most common paths to the field's display label.
// Anything we don't recognise falls back to the last segment of the
// path (e.g. "country_of_origin" → "country of origin").
const FIELD_LABELS: Record<string, string> = {
  "items[].time.label": "Item Status",
  "items[].descriptor.name": "SKU Name",
  "items[].descriptor.code": "SKU Code",
  "items[].descriptor.short_desc": "Short Description",
  "items[].descriptor.long_desc": "Long Description",
  "items[].descriptor.images": "Product Images",
  "items[].descriptor.symbol": "Primary Image",
  "items[].quantity.unitized.measure.unit": "Measure Unit",
  "items[].quantity.unitized.measure.value": "SKU Weight",
  "items[].quantity.unitized.count": "Pack Size",
  "items[].quantity.maximum.count": "Max Order Quantity",
  "items[].quantity.minimum.count": "Min Order Quantity",
  "items[].quantity.available.count": "Available Stock",
  "items[].tags.upc": "UPC",
  "items[].tags.sku_weight": "SKU Weight",
  "items[].category_id": "Category",
  "items[].fulfillment_id": "Fulfillment",
  "items[].location_id": "Location",
  "items[].@ondc/org/returnable": "Returnable",
  "items[].@ondc/org/cancellable": "Cancellable",
  "items[].@ondc/org/time_to_ship": "Time to Ship",
  "items[].@ondc/org/available_on_cod": "Available on COD",
  "items[].@ondc/org/contact_details_consumer_care": "Customer Care",
  "items[].tags.manufacturer_or_packer_name": "Manufacturer",
  "items[].tags.manufacturer_or_packer_address": "Manufacturer Address",
  "items[].tags.country_of_origin": "Country of Origin",
  "items[].tags.brand": "Brand",
};
const humaniseFieldPath = (path: string): string => {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  // Fallback: take the last segment, strip dots/brackets, prettify.
  const tail = path.split(/[.\]]/).filter(Boolean).pop() ?? path;
  return tail.replace(/[_-]+/g, " ").replace(/\bng\b/i, "");
};

// Types
interface OfferTier {
  minQty: number;
  maxQty?: number;
  pricePerUnit: number;
  savings?: number;
}

interface Offer {
  id: string;
  type:
    | "quantity-slab"
    | "buy-x-get-y"
    | "discount"
    | "cart-level"
    | "seller-specific"
    | "bundle";
  title: string;
  description: string;
  benefitText: string;
  conditions: string[];
  validity?: string;
  isActive: boolean;
  isBestOffer?: boolean;
  isMostPopular?: boolean;
  savings?: number;
  tiers?: OfferTier[];
  discountType?: "flat" | "percentage";
  discountValue?: number;
  buyQuantity?: number;
  getQuantity?: number;
  getFreeItem?: string;
  getDiscountPercent?: number;
  minCartValue?: number;
  cartDiscount?: number;
  cartDiscountType?: "flat" | "percentage";
  sellerName?: string;
  sellerDiscount?: number;
  bundleProducts?: { name: string; sku: string }[];
  bundleDiscount?: number;
  stackable?: boolean;
  expiresIn?: string;
  category?: "sku-level" | "conditional";
}

// Sample SKU data
const skuData: Record<string, any> = {
  "1": {
    id: "1",
    name: "Fortune Sunlite Refined Sunflower oil",
    sku: "FOR-SUN-1L-001",
    category: "Edible Oil",
    brand: "Fortune",
    source: "Brand Sync",
    status: "Active",
    lastUpdated: "2024-03-25",
    description:
      "Premium quality refined sunflower oil for healthy cooking. Rich in Vitamin E and low in saturated fats.",
    specifications: {
      weight: "1 Liter",
      packaging: "Plastic Bottle",
      shelfLife: "12 months",
      manufacturer: "Adani Wilmar Ltd",
      countryOfOrigin: "India",
    },
    pricing: {
      mrp: 185.0,
      sellingPrice: 165.0,
      costPrice: 145.0,
      margin: "13.79%",
    },
    inventory: {
      currentStock: 450,
      minStockLevel: 50,
      reorderPoint: 100,
      warehouse: "WH-Mumbai-01",
    },
    tax: {
      hsnCode: "15121900",
      gstTax: "18%",
      gstCess: "0%",
    },
  },
  "2": {
    id: "2",
    name: "Maggi 2-Minute Noodles Masala",
    sku: "MAG-NOO-70G-002",
    category: "Instant Food",
    brand: "Maggi",
    source: "Manual",
    status: "Active",
    lastUpdated: "2024-03-24",
    description:
      "Quick and tasty instant noodles with the classic Maggi masala flavor. Ready in just 2 minutes.",
    specifications: {
      weight: "70 Grams",
      packaging: "Pouch",
      shelfLife: "9 months",
      manufacturer: "Nestle India Ltd",
      countryOfOrigin: "India",
    },
    pricing: {
      mrp: 14.0,
      sellingPrice: 12.0,
      costPrice: 9.5,
      margin: "26.32%",
    },
    inventory: {
      currentStock: 1200,
      minStockLevel: 200,
      reorderPoint: 300,
      warehouse: "WH-Delhi-02",
    },
    tax: {
      hsnCode: "19023010",
      gstTax: "12%",
      gstCess: "0%",
    },
  },
  // Fully-prefilled ONDC SKU — Aashirvaad Atta 10 kg from ITC Limited.
  // Used to demo what the SKU detail screen looks like once every ONDC field
  // is populated (including images). Linked to seller-1 via the ITC company.
  "190000001": {
    id: "190000001",
    name: "Aashirvaad Whole Wheat Atta 10 kg",
    sku: "190000001",
    category: "Cooking and Baking Needs",
    brand: "Aashirvaad",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-25",
    description:
      "Aashirvaad Atta is made from 100% whole wheat sourced from the heartlands of India, stone-ground for chakki-fresh taste. Each 10 kg pack delivers consistently soft, fluffy rotis with high fibre content and rich aroma.",
    specifications: {
      weight: "10 Kilogram",
      packaging: "Multi-layer Polypropylene Bag",
      shelfLife: "6 months",
      manufacturer: "ITC",
      countryOfOrigin: "India",
    },
    pricing: {
      mrp: 565.0,
      sellingPrice: 525.0,
      costPrice: 470.0,
      margin: "10.47%",
    },
    inventory: {
      currentStock: 320,
      minStockLevel: 30,
      reorderPoint: 60,
      warehouse: "WH-Hyderabad-001",
    },
    tax: {
      hsnCode: "11010000",
      gstTax: "5%",
      gstCess: "0%",
    },
    // Pre-populated ONDC values — when present, ProductDetailsTab seeds the
    // ONDC editor with these instead of leaving the form blank.
    ondcPrefilled: {
      itemStatus: "enable",
      shortDesc:
        "Stone-ground whole wheat atta for soft, fluffy rotis. 10 kg value pack.",
      longDesc:
        "Aashirvaad Atta is made from 100% whole wheat sourced from the heartlands of India and stone-ground using the traditional chakki process for authentic taste. Each 10 kg pack delivers consistently soft, fluffy rotis with high fibre content, slow-release energy and a rich aroma. Hygienically packed in a multi-layer polypropylene bag to preserve freshness for up to six months.",
      measureUnit: "kilogram",
      measureValue: "10",
      unitizedCount: "1",
      maximumOrderQty: "100",
      minimumOrderQty: "1",
      upc: "8901725100015",
      weightMeasure: "Kilogram",
      skuWeight: "10",
      // Physical dimensions in cm — drives the volumetric weight read-out.
      productLength: "30",
      productWidth: "22",
      productHeight: "14",
      categoryId: "Cooking and Baking Needs",
      fulfillmentId: "Store Delivery",
      locationId: "WH-001",
      returnable: true,
      cancellable: true,
      timeToShip: "PT24H",
      availableOnCod: true,
      consumerCareContactName: "ITC Consumer Care",
      consumerCareContactEmail: "consumer.care@itc.in",
      consumerCareContactPhone: "18004253030",
      manufacturerName: "ITC",
      manufacturerAddress:
        "ITC Limited, Virginia House, 37 J.L. Nehru Road, Kolkata, West Bengal, India - 700071",
      countryOfOrigin: "India",
      brandAttribute: "Aashirvaad",
      productImages: [
        "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",
        "https://images.unsplash.com/photo-1568051243851-f9b136146e97?w=600&q=80",
        "https://images.unsplash.com/photo-1528712306091-ed0763094c98?w=600&q=80",
      ],
    },
  },
};

// Mock Offers Data
const mockOffers: Record<string, Offer[]> = {
  "1": [
    // SKU-Level Offers
    {
      id: "off-1",
      type: "quantity-slab",
      category: "sku-level",
      title: "Bulk Purchase Discount",
      description: "Save more when you buy in bulk",
      benefitText: "Up to ₹25/unit savings",
      conditions: ["Minimum 1 unit", "Maximum 100 units per order"],
      validity: "Valid till 30 Apr 2026",
      isActive: true,
      isBestOffer: true,
      stackable: false,
      tiers: [
        { minQty: 1, maxQty: 10, pricePerUnit: 165, savings: 0 },
        { minQty: 11, maxQty: 20, pricePerUnit: 155, savings: 10 },
        { minQty: 21, maxQty: 50, pricePerUnit: 145, savings: 20 },
        { minQty: 51, pricePerUnit: 140, savings: 25 },
      ],
    },
    {
      id: "off-2",
      type: "buy-x-get-y",
      category: "sku-level",
      title: "Buy 2 Get 1 @ 50% Off",
      description: "Perfect for stocking up",
      benefitText: "Save ₹82.50 per combo",
      conditions: ["Buy 2 units", "Get 1 unit at 50% off"],
      validity: "Valid till 15 Apr 2026",
      isActive: true,
      isMostPopular: true,
      stackable: false,
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 50,
      savings: 82.5,
      expiresIn: "8 days",
    },
    {
      id: "off-3",
      type: "discount",
      category: "sku-level",
      title: "Instant Discount",
      description: "Flat discount on this SKU",
      benefitText: "Flat ₹15 Off",
      conditions: ["No minimum quantity", "Applied automatically"],
      validity: "Valid till 20 Apr 2026",
      isActive: true,
      stackable: true,
      discountType: "flat",
      discountValue: 15,
      savings: 15,
    },

    // Conditional Offers
    {
      id: "off-4",
      type: "cart-level",
      category: "conditional",
      title: "Cart Value Bonus",
      description: "Extra savings on higher cart value",
      benefitText: "Get 5% off on cart ₹5000+",
      conditions: ["Minimum cart value ₹5000", "Maximum discount ₹500"],
      validity: "Valid till 30 Apr 2026",
      isActive: true,
      stackable: true,
      minCartValue: 5000,
      cartDiscount: 5,
      cartDiscountType: "percentage",
    },
    {
      id: "off-5",
      type: "seller-specific",
      category: "conditional",
      title: "Premium Seller Deal",
      description: "Exclusive offer from verified seller",
      benefitText: "Extra 3% off from Fortune Direct",
      conditions: ["Only from seller: Fortune Direct", "Minimum 5 units"],
      validity: "Valid till 25 Apr 2026",
      isActive: true,
      stackable: true,
      sellerName: "Fortune Direct",
      sellerDiscount: 3,
    },
    {
      id: "off-6",
      type: "bundle",
      category: "conditional",
      title: "Cooking Essentials Bundle",
      description: "Buy together and save",
      benefitText: "Save ₹50 on combo",
      conditions: ["Buy all items in bundle", "Limited time offer"],
      validity: "Valid till 30 Apr 2026",
      isActive: true,
      stackable: false,
      bundleProducts: [
        { name: "Fortune Sunlite Oil 1L", sku: "FOR-SUN-1L-001" },
        { name: "Fortune Rice Bran Oil 1L", sku: "FOR-RBO-1L-002" },
        { name: "Fortune Mustard Oil 1L", sku: "FOR-MUS-1L-003" },
      ],
      bundleDiscount: 50,
      savings: 50,
    },
  ],
  "2": [
    // SKU-Level Offers for Maggi
    {
      id: "mag-1",
      type: "buy-x-get-y",
      category: "sku-level",
      title: "Buy 5 Get 1 Free",
      description: "Stock up and save",
      benefitText: "Get 1 pack absolutely free",
      conditions: ["Buy 5 packs", "Get 1 pack free"],
      validity: "Valid till 30 Apr 2026",
      isActive: true,
      isBestOffer: true,
      stackable: false,
      buyQuantity: 5,
      getQuantity: 1,
      getFreeItem: "Maggi 2-Minute Noodles Masala",
      savings: 12,
    },
    {
      id: "mag-2",
      type: "quantity-slab",
      category: "sku-level",
      title: "Wholesale Pricing",
      description: "Better prices for bulk orders",
      benefitText: "Save up to ₹2/unit",
      conditions: ["Volume-based pricing", "No maximum limit"],
      validity: "Always available",
      isActive: true,
      isMostPopular: true,
      stackable: false,
      tiers: [
        { minQty: 1, maxQty: 24, pricePerUnit: 12, savings: 0 },
        { minQty: 25, maxQty: 50, pricePerUnit: 11, savings: 1 },
        { minQty: 51, pricePerUnit: 10, savings: 2 },
      ],
    },
    {
      id: "mag-3",
      type: "discount",
      category: "sku-level",
      title: "Monsoon Special",
      description: "Limited time offer",
      benefitText: "10% Off",
      conditions: ["Valid on all quantities", "Auto-applied at checkout"],
      validity: "Valid till 10 Apr 2026",
      isActive: true,
      stackable: true,
      discountType: "percentage",
      discountValue: 10,
      savings: 1.2,
      expiresIn: "3 days",
    },
  ],
};

// Offer Card Component
function OfferCard({ offer, currentQty = 1 }: { offer: Offer; currentQty?: number }) {
  const [expanded, setExpanded] = useState(false);

  const getOfferIcon = () => {
    switch (offer.type) {
      case "quantity-slab":
        return <TrendingUp className="h-5 w-5" />;
      case "buy-x-get-y":
        return <Gift className="h-5 w-5" />;
      case "discount":
        return <Percent className="h-5 w-5" />;
      case "cart-level":
        return <ShoppingCart className="h-5 w-5" />;
      case "seller-specific":
        return <Users className="h-5 w-5" />;
      case "bundle":
        return <PackageOpen className="h-5 w-5" />;
      default:
        return <Tag className="h-5 w-5" />;
    }
  };

  const getOfferTypeLabel = () => {
    switch (offer.type) {
      case "quantity-slab":
        return "Volume Pricing";
      case "buy-x-get-y":
        return "Freebie Offer";
      case "discount":
        return "Instant Discount";
      case "cart-level":
        return "Cart Offer";
      case "seller-specific":
        return "Seller Offer";
      case "bundle":
        return "Bundle Deal";
      default:
        return "Offer";
    }
  };

  const getOfferColor = () => {
    switch (offer.type) {
      case "quantity-slab":
        return "border-blue-200 bg-blue-50";
      case "buy-x-get-y":
        return "border-pink-200 bg-pink-50";
      case "discount":
        return "border-green-200 bg-green-50";
      case "cart-level":
        return "border-purple-200 bg-purple-50";
      case "seller-specific":
        return "border-orange-200 bg-orange-50";
      case "bundle":
        return "border-indigo-200 bg-indigo-50";
      default:
        return "border-gray-200 bg-gray-50";
    }
  };

  const getBadgeColor = () => {
    switch (offer.type) {
      case "quantity-slab":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "buy-x-get-y":
        return "bg-pink-100 text-pink-700 border-pink-300";
      case "discount":
        return "bg-green-50 text-green-700 border-green-200";
      case "cart-level":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "seller-specific":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "bundle":
        return "bg-indigo-100 text-indigo-700 border-indigo-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  return (
    <Card className={`border-2 ${getOfferColor()} transition-all hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-lg ${getOfferColor()}`}>{getOfferIcon()}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-gray-900">{offer.title}</h3>
                  {offer.isBestOffer && (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                      <Star className="h-3 w-3 fill-amber-700" />
                      Best Offer
                    </Badge>
                  )}
                  {offer.isMostPopular && (
                    <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                      <Flame className="h-3 w-3" />
                      Most Popular
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">{offer.description}</p>
              </div>
            </div>
            <Badge className={getBadgeColor()}>{getOfferTypeLabel()}</Badge>
          </div>

          {/* Benefit Highlight */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-700">{offer.benefitText}</span>
              </div>
              {offer.savings && (
                <span className="text-sm text-gray-600">You save ₹{offer.savings.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Quantity Slab Pricing Table */}
          {offer.type === "quantity-slab" && offer.tiers && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Volume Pricing Tiers</span>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  {expanded ? (
                    <>
                      Collapse <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Expand <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
              {expanded && (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Quantity</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">
                          Price/Unit
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">Savings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {offer.tiers.map((tier, idx) => {
                        const isActive =
                          currentQty >= tier.minQty &&
                          (!tier.maxQty || currentQty <= tier.maxQty);
                        return (
                          <tr
                            key={idx}
                            className={isActive ? "bg-green-50 font-medium" : "bg-white"}
                          >
                            <td className="px-4 py-3">
                              {tier.minQty}
                              {tier.maxQty ? `-${tier.maxQty}` : "+"} units
                              {isActive && (
                                <Badge className="ml-2 bg-green-50 text-green-700 border-green-200 text-xs">
                                  Active
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">₹{tier.pricePerUnit}</td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {tier.savings ? `₹${tier.savings}/unit` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Bundle Products */}
          {offer.type === "bundle" && offer.bundleProducts && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Bundle Includes:</span>
              <div className="space-y-1">
                {offer.bundleProducts.map((product, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm bg-white rounded p-2 border border-gray-200"
                  >
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{product.name}</span>
                    <span className="text-gray-500 text-xs">({product.sku})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cart Progress (for cart-level offers) */}
          {offer.type === "cart-level" && offer.minCartValue && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Cart value needed:</span>
                <span className="font-semibold text-gray-900">₹{offer.minCartValue}</span>
              </div>
              <Progress value={45} className="h-2" />
              <p className="text-xs text-gray-500">
                Add ₹2,750 more to unlock this offer (Current: ₹2,250)
              </p>
            </div>
          )}

          {/* Conditions */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-700">Conditions:</span>
            <ul className="space-y-0.5">
              {offer.conditions.map((condition, idx) => (
                <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{condition}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {offer.validity && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{offer.validity}</span>
                </div>
              )}
              {offer.expiresIn && (
                <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Ends in {offer.expiresIn}
                </Badge>
              )}
              {offer.stackable && (
                <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                  Stackable
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Offer details coming soon")}
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Product Details Tab Component — DMS (read-only reference) + ONDC (editable) dual-column layout.
function ProductDetailsTab({ sku }: { sku: any }) {
  // DMS snapshot — read-only reference that comes from the DMS system of record.
  const dms = {
    itemStatus: sku.status === "Active" ? "enable" : "disable",
    itemName: sku.name || "",
    itemCode: "1:" + (sku.sku || ""),
    // Group Name clusters variants of the same product family
    // (e.g. "Freedom Model" groups the 50ml / 100ml / 200ml SKUs).
    // Optional — single-variant SKUs leave it blank.
    groupName: "",
    shortName: (sku as any).shortName || "",
    shortDesc: sku.description?.split(".")[0] || "",
    longDesc: sku.description || "",
    additionalImages: [] as string[],
    unitizedCount: "1",
    measureUnit: "litre",
    measureValue: "1",
    maximumOrderQty: "100",
    minimumOrderQty: "1",
    upc: "12",
    // Weight Measure pairs with SKU Weight to give Weight in KG its
    // canonical source. For a 1L oil seed the bottle is roughly 1.05 kg,
    // so the demo defaults the weight to Kilogram + 1.05.
    weightMeasure: "Kilogram",
    skuWeight: "1.05",
    // Physical dimensions in cm. Optional on DMS — left blank by default
    // and surfaced as editable fields under the Dimensions section so
    // the seller can populate them and have volumetric weight derive
    // automatically.
    productLength: "",
    productWidth: "",
    productHeight: "",
    categoryId: sku.category || "",
    fulfillmentId: "F1",
    locationId: "L1",
    returnable: true,
    cancellable: true,
    timeToShip: "PT4H",
    availableOnCod: false,
    consumerCareContactName: "Customer Support",
    consumerCareContactEmail: "support@seller.com",
    consumerCareContactPhone: "18004254444",
    manufacturerName: sku.specifications?.manufacturer || "",
    manufacturerAddress: "Ahmedabad, Gujarat, India - 380009",
    countryOfOrigin: "IND",
    brandAttribute: sku.brand || "",
    statutoryImages: [] as string[],
    productImages: [] as string[],
    // Selling Units — extra pack-size chips the seller wants buyers to order
    // in (in pieces). Empty by default; the seller types a number, hits
    // Enter, and a chip appears. Lives directly under Pack Size so the
    // packaging story stays in one place.
    sellingUnits: [] as number[],
  };

  // ONDC starts mostly blank — only Item Name and Item Code are copied from DMS
  // (these are the unique identifiers). Everything else is left for the seller to fill in.
  const blankOndc: typeof dms = {
    ...dms,
    groupName: "",
    shortName: (sku as any).shortName || "",
    shortDesc: "",
    longDesc: "",
    additionalImages: [],
    unitizedCount: "",
    measureUnit: "",
    measureValue: "",
    maximumOrderQty: "",
    minimumOrderQty: "",
    upc: "",
    weightMeasure: "",
    skuWeight: "",
    productLength: "",
    productWidth: "",
    productHeight: "",
    categoryId: "",
    // Phase 1 spec defaults — fulfillment is Store Delivery, location
    // defaults to Warehouse 1, Returnable / Cancellable are locked to
    // "No", COD is locked to "Yes", Time to Ship defaults to 24 hours,
    // and Country of Origin defaults to India.
    fulfillmentId: "Store Delivery",
    locationId: "Warehouse 1",
    returnable: false,
    cancellable: false,
    timeToShip: "24 hours",
    availableOnCod: true,
    consumerCareContactName: "",
    consumerCareContactEmail: "",
    consumerCareContactPhone: "",
    manufacturerName: "",
    manufacturerAddress: "",
    countryOfOrigin: "India",
    brandAttribute: "",
    statutoryImages: [],
    productImages: [],
    sellingUnits: [],
  };
  // Some SKUs (e.g. the demo Aashirvaad Atta) ship with a fully-populated ONDC
  // record. When present, seed the editor with those values so the page shows
  // what a "complete" SKU looks like.
  const seededOndc: typeof dms = sku.ondcPrefilled
    ? { ...blankOndc, ...sku.ondcPrefilled }
    : blankOndc;
  const [ondc, setOndc] = useState({ ...seededOndc });
  // ONDC-fields-dirty tracking. The Save ONDC Value button starts
  // disabled (BR-1) and only enables once the seller has actually
  // changed any ONDC field on the Product Details tab (BR-2). After a
  // successful save round-trip we reset the flag so the button locks
  // again until the next change.
  const [ondcDirty, setOndcDirty] = useState(false);
  // Saving state for the brief loading flicker on the button.
  const [isSavingOndc, setIsSavingOndc] = useState(false);
  const update = (key: keyof typeof dms, value: any) => {
    setOndc((prev) => ({ ...prev, [key]: value }));
    setOndcDirty(true);
  };
  const isEdited = (key: keyof typeof dms) =>
    JSON.stringify(dms[key]) !== JSON.stringify(ondc[key]);

  // Tax — HSN Code + GST Tax + GST Cess (all optional, independent of ONDC state)
  const GST_TAX_OPTIONS = ["0%", "3%", "5%", "12%", "18%", "28%"];
  const GST_CESS_OPTIONS = ["0%", "1%", "3%", "5%", "12%", "22%"];
  const dmsTax = {
    hsnCode: String(sku.tax?.hsnCode ?? ""),
    gstTax: String(sku.tax?.gstTax ?? ""),
    gstCess: String(sku.tax?.gstCess ?? ""),
  };
  const [ondcTax, setOndcTax] = useState({ ...dmsTax });
  const updateTax = (key: keyof typeof dmsTax, value: string) =>
    setOndcTax((prev) => ({ ...prev, [key]: value }));

  // Inline error catalog — populated on Save with the validator's
  // output. The post-save popup has been retired in favour of
  // showing every error inline beneath its owning input.
  const [pendingErrors, setPendingErrors] = useState<ValidationError[]>([]);

  // Map our ondc-state keys → the JSON-path the validator uses so
  // each TextInput can look up its own error without us threading
  // the field key through every call site as a separate prop.
  const STATE_KEY_TO_PATH: Record<string, string> = {
    itemName: "items[].descriptor.name",
    itemCode: "items[].descriptor.code",
    shortDesc: "items[].descriptor.short_desc",
    longDesc: "items[].descriptor.long_desc",
    measureUnit: "items[].quantity.unitized.measure.unit",
    measureValue: "items[].quantity.unitized.measure.value",
    unitizedCount: "items[].quantity.unitized.count",
    upc: "items[].tags.upc",
    minimumOrderQty: "items[].quantity.minimum.count",
    maximumOrderQty: "items[].quantity.maximum.count",
    categoryId: "items[].category_id",
    fulfillmentId: "items[].fulfillment_id",
    locationId: "items[].location_id",
    returnable: "items[].@ondc/org/returnable",
    cancellable: "items[].@ondc/org/cancellable",
    timeToShip: "items[].@ondc/org/time_to_ship",
    availableOnCod: "items[].@ondc/org/available_on_cod",
    consumerCareContactName: "items[].@ondc/org/contact_details_consumer_care",
    consumerCareContactEmail: "items[].@ondc/org/contact_details_consumer_care",
    consumerCareContactPhone: "items[].@ondc/org/contact_details_consumer_care",
    manufacturerName: "items[].tags.manufacturer_or_packer_name",
    manufacturerAddress: "items[].tags.manufacturer_or_packer_address",
    countryOfOrigin: "items[].tags.country_of_origin",
    brandAttribute: "items[].tags.brand",
  };
  const getError = (stateKey: string): string | undefined => {
    const path = STATE_KEY_TO_PATH[stateKey];
    if (!path) return undefined;
    return pendingErrors.find((e) => e.field === path)?.message;
  };

  // "Got it, will fix" confirmation surface (BR-7). null → not shown.
  // Captured at save-time so the modal text is stable while open.
  const [postSavePrompt, setPostSavePrompt] = useState<
    | {
        title: string;
        body: string;
        savedCount: number;
        failedCount: number;
      }
    | null
  >(null);

  const handleReset = () => {
    // Reset only the Category 2 (seller-editable) fields to their seeded defaults.
    // Category 1 (Catalog-owned) fields are read-only displays and are not in state.
    setOndc((prev) => ({
      ...prev,
      minimumOrderQty: seededOndc.minimumOrderQty,
      maximumOrderQty: seededOndc.maximumOrderQty,
      returnable: seededOndc.returnable,
      cancellable: seededOndc.cancellable,
      availableOnCod: seededOndc.availableOnCod,
      timeToShip: seededOndc.timeToShip,
      consumerCareContactName: seededOndc.consumerCareContactName,
      consumerCareContactEmail: seededOndc.consumerCareContactEmail,
      consumerCareContactPhone: seededOndc.consumerCareContactPhone,
      manufacturerAddress: seededOndc.manufacturerAddress,
      sellingUnits: seededOndc.sellingUnits,
      itemStatus: seededOndc.itemStatus,
      fulfillmentId: seededOndc.fulfillmentId,
      locationId: seededOndc.locationId,
    }));
    setPendingErrors([]);
    setOndcDirty(false);
    toast.success("ONDC values reset");
  };

  const handleSave = () => {
    setIsSavingOndc(true);
    // Brief loading state so the seller sees the system reacted, then
    // run validation + the incremental-save categorisation. The actual
    // save is in-memory (no server round-trip in Phase 1) — the
    // setTimeout exists purely to surface the "Saving" state.
    window.setTimeout(() => {
      doSaveOndc();
      setIsSavingOndc(false);
    }, 250);
  };

  const doSaveOndc = () => {
    // Consumer Care combined into the "name,email,contact_no" format expected by validateSKU
    const ccc =
      ondc.consumerCareContactName || ondc.consumerCareContactEmail || ondc.consumerCareContactPhone
        ? `${ondc.consumerCareContactName},${ondc.consumerCareContactEmail},${ondc.consumerCareContactPhone}`
        : "";

    // Packaged-commodity heuristic — same one the bulk-import uses, so rules stay consistent
    const catLower = (ondc.categoryId || "").toLowerCase();
    const isPackagedCommodity =
      !!(ondc.manufacturerName || ondc.manufacturerAddress) ||
      /atta|flour|biscuit|salt|oil|food|packaged/.test(catLower);

    // Track which fields the seller actually edited this session — only
    // those count as "updated" for incremental save (BR-12).
    const editedFields = (Object.keys(dms) as Array<keyof typeof dms>).filter(
      (k) => isEdited(k),
    );
    const editedCount = editedFields.length;

    // Was the SKU compliant *before* this save? Used to detect the
    // just-became-compliant transition for the special toast (AC-9).
    // We re-run validateSKU against the DMS snapshot, with the same
    // packaged-commodity heuristic, to keep parity with the post-save
    // run below.
    const wasCompliantBefore = pendingErrors.length === 0;

    const errors = validateSKU(
      {
        itemStatus: ondc.itemStatus,
        itemName: ondc.itemName,
        itemCode: ondc.itemCode,
        shortDesc: ondc.shortDesc,
        longDesc: ondc.longDesc,
        additionalImages: ondc.additionalImages,
        unitizedCount: ondc.unitizedCount,
        measureUnit: ondc.measureUnit,
        measureValue: ondc.measureValue,
        availableCount: "99", // inventory lives on Price & Inventory now
        maximumOrderQty: ondc.maximumOrderQty,
        minimumOrderQty: ondc.minimumOrderQty,
        categoryId: ondc.categoryId,
        fulfillmentId: ondc.fulfillmentId,
        locationId: ondc.locationId,
        returnable: ondc.returnable,
        cancellable: ondc.cancellable,
        timeToShip: ondc.timeToShip,
        availableOnCod: ondc.availableOnCod,
        consumerCareContact: ccc,
        manufacturerName: ondc.manufacturerName,
        manufacturerAddress: ondc.manufacturerAddress,
        isPackagedCommodity,
        countryOfOrigin: ondc.countryOfOrigin,
        brandAttribute: ondc.brandAttribute,
      },
      {},
    );

    // Inline errors are always the "value-typed-wrong" ones; missing
    // mandatory fields show as red below the empty input too (because
    // VAL-4: blank mandatory = validation failure).
    setPendingErrors(errors);

    // Compliance is "no errors at all" — the moment the last gap closes
    // (BR-11), the SKU's badge flips automatically. There's no separate
    // publish step.
    //
    // TODO (user story): SKUs imported from Product Store start with MRP=0 and
    // SP=0 (FC2 fields — seller must fill them in). When this user story is
    // implemented, add a check here so that a SKU with MRP <= 0 or SP <= 0
    // is NEVER marked ONDC compliant, regardless of whether the ONDC fields
    // are filled. i.e.: const isNowCompliant = errors.length === 0 && mrp > 0 && sp > 0;
    // (read mrp/sp from the Price & Inventory state, same as commitSave does.)
    const isNowCompliant = errors.length === 0;

    // No edits → button shouldn't have been enabled, defensive only.
    if (editedCount === 0) {
      setOndcDirty(false);
      return;
    }

    // The validator returns errors keyed by JSON-path (e.g.
    // "items[].descriptor.name"), not by our ondc state key, so we
    // can't cleanly diff per-edited-field. Pragmatic categorisation
    // for the post-save surface:
    //   • zero errors                → all updated fields valid
    //   • errors >= edited count     → treat as "all invalid"
    //   • errors <  edited count     → partial save
    // The popup numbers therefore reflect "how many errors remain"
    // vs. "how many of the seller's edits look saveable" — which is
    // what the user actually cares about.
    const failedCount = errors.length;
    const savedCount = Math.max(0, editedCount - failedCount);

    if (failedCount === 0) {
      // BR-4 happy path — every updated field is valid and saved.
      // Special-case the "just became compliant" transition (AC-9).
      if (isNowCompliant && !wasCompliantBefore) {
        toast.success("This SKU is now ONDC Compliant.");
      } else {
        toast.success("Changes saved.");
      }
      setOndcDirty(false);
      return;
    }

    if (savedCount === 0) {
      // Every updated field is invalid — nothing saves.
      setPostSavePrompt({
        title: "Nothing was saved",
        body: "None of your changes could be saved. Please fix the highlighted fields.",
        savedCount: 0,
        failedCount,
      });
      // Keep the dirty flag on so the seller can re-save after fixing.
      return;
    }

    // Partial save — some valid fields persisted, some need fixing.
    setPostSavePrompt({
      title: "Some changes need fixing",
      body: `${savedCount} field${savedCount === 1 ? "" : "s"} saved. ${failedCount} field${failedCount === 1 ? "" : "s"} need fixing.`,
      savedCount,
      failedCount,
    });
    // Stay dirty so the seller can re-save after fixing.
  };

  const isActive = ondc.itemStatus === "enable";

  return (
    <div className="space-y-3">
      {/* Sticky action bar — stays visible while the user scrolls so they can
          always hit Save without scrolling back to the top. The page is now
          a single unified SKU view (DMS read-only column dropped per the
          Phase 2 spec); the only remaining badge is the Active/Inactive
          status, surfaced through the toggle on the left. */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 gap-2 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Item Status</span>
          <StatusToggle
            active={isActive}
            onChange={(v) => update("itemStatus", v ? "enable" : "disable")}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset
          </Button>
          {/* Save — disabled by default, enables on first ONDC field
              change, shows a brief loading state during the round-trip,
              returns to disabled after a successful save with no further
              changes. */}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!ondcDirty || isSavingOndc}
          >
            {isSavingOndc ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Brand-managed fields callout */}
      <div className="flex items-start gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-900">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-teal-600" />
        <p>
          <span className="font-medium">Brand-managed fields</span> — Fields marked{" "}
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            Catalog
          </span>{" "}
          are owned by the brand and maintained by Catalog Admin. Your editable fields (Min/Max Order Qty, Returnable, Cancellable, Consumer Care, etc.) have normal inputs.
        </p>
      </div>

      {/* Descriptor */}
      <DualSection title="Descriptor (Product Identity)" icon={<FileText className="h-5 w-5 text-blue-600" />}>
        <DualRow
          label="SKU Name"
          required
          ondcRequired
          help="Display name: brand + variant + pack size (3–100 chars)"
          dms={dms.itemName}
          ondc={<CatalogField value={seededOndc.itemName} />}
        />
        <DualRow
          label="Group Name"
          help="Cluster variants of the same product family."
          dms={dms.groupName || "—"}
          ondc={<CatalogField value={seededOndc.groupName} />}
        />
        <DualRow
          label="SKU Code"
          required
          ondcRequired
          help="System-generated unique identifier — cannot be edited"
          dms={dms.itemCode}
          ondc={
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono">{ondc.itemCode || "—"}</p>
              <span
                className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 leading-none"
                title="SKU Code is generated at SKU import and cannot be changed"
              >
                Read-only
              </span>
            </div>
          }
        />
        <DualRow
          label="Short Name"
          help="Internal alias for this SKU (e.g. FFR1). Max 20 chars."
          dms={""}
          ondc={<CatalogField value={seededOndc.shortName} />}
        />
        <DualRow
          label="Short Description"
          required
          ondcRequired
          help="10–150 chars, plain text"
          dms={""}
          ondc={<CatalogField value={seededOndc.shortDesc} />}
        />
        <DualRow
          label="Long Description"
          required
          ondcRequired
          help="20–1000 chars, plain text"
          dms={""}
          multiline
          ondc={<CatalogField value={seededOndc.longDesc} multiline />}
        />
      </DualSection>

      {/* Quantity */}
      <DualSection title="Quantity & Inventory" icon={<Package className="h-5 w-5 text-indigo-600" />}>
        <DualRow
          label="Measure Unit"
          required
          ondcRequired
          dms={""}
          ondc={<CatalogField value={seededOndc.measureUnit} />}
        />
        <DualRow
          label="Unit Value"
          required
          ondcRequired
          help="Number paired with Measure Unit (e.g. 1.5 for a 1.5 L bottle)."
          dms={""}
          ondc={<CatalogField value={seededOndc.measureValue} />}
        />
        <DualRow
          label="Weight Measure"
          required
          ondcRequired
          help="Gram or Kilogram — drives the auto-calculated Weight in KG."
          dms={""}
          ondc={<CatalogField value={seededOndc.weightMeasure} />}
        />
        <DualRow
          label="SKU Weight"
          required
          ondcRequired
          help="Physical weight in the chosen Weight Measure (up to 3 decimals)."
          dms={""}
          ondc={<CatalogField value={seededOndc.skuWeight} />}
        />
        <DualRow
          label="Pack Size (Inner Pack)"
          help="Optional, 1–10,000"
          dms={""}
          ondc={<CatalogField value={seededOndc.unitizedCount} />}
        />
        <DualRow
          label="UPC (Unit Per Case)"
          help="Number of units in one case"
          dms={""}
          ondc={<CatalogField value={seededOndc.upc} />}
        />
        {/* Selling Units — chip input. Seller types a piece count
            (e.g. 1, 16, 96), hits Enter, and the number locks in as a
            chip. Chips can be removed with the × on each chip; that's
            the whole UI. No labels, no defaults, no toggles — just a
            list of pack sizes buyers can order in. */}
        <DualRow
          label="Selling Units"
          help="Pack sizes buyers can order in (number of pieces). Type a number and press Enter to add a chip; click × on a chip to remove it."
          dms={""}
          ondc={
            <SellingUnitsChips
              value={ondc.sellingUnits}
              onChange={(v) => update("sellingUnits", v)}
              edited={isEdited("sellingUnits")}
            />
          }
        />
        {/* Weight in KG is auto-calculated from Weight Measure ×
            SKU Weight. Gram and Kilogram convert exactly; the
            seller can't edit this — the field is locked to the
            system value. */}
        <DualRow
          label="Weight in KG"
          help="Auto-calculated from Weight Measure × SKU Weight, expressed in kg."
          dms={
            formatKgValue(
              measureToKg(dms.weightMeasure, parseFloat(dms.skuWeight)),
            )
          }
          ondc={
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono">
                {formatKgValue(
                  measureToKg(ondc.weightMeasure, parseFloat(ondc.skuWeight)),
                )}
              </p>
              <span
                className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 leading-none"
                title="Weight in KG is auto-calculated from Weight Measure × SKU Weight and cannot be edited."
              >
                Auto
              </span>
            </div>
          }
        />
        <DualRow
          label="Min Order Qty"
          required
          ondcRequired
          dms={""}
          ondc={<TextInput value={ondc.minimumOrderQty} onChange={(v) => update("minimumOrderQty", v)} edited={isEdited("minimumOrderQty")} required type="number" errorMessage={getError("minimumOrderQty")} />}
        />
        <DualRow
          label="Max Order Qty"
          required
          ondcRequired
          dms={""}
          ondc={<TextInput value={ondc.maximumOrderQty} onChange={(v) => update("maximumOrderQty", v)} edited={isEdited("maximumOrderQty")} required type="number" errorMessage={getError("maximumOrderQty")} />}
        />
      </DualSection>

      {/* Tax — HSN Code + GST Tax % + GST Cess % (all optional) */}
      <DualSection title="Tax" icon={<Percent className="h-5 w-5 text-orange-500" />}>
        <DualRow
          label="HSN Code"
          help="8-digit Harmonised System Nomenclature code for this product"
          dms={dmsTax.hsnCode || "—"}
          ondc={<CatalogField value={dmsTax.hsnCode} />}
        />
        <DualRow
          label="GST Tax %"
          help="GST slab applicable on this product"
          dms={dmsTax.gstTax || "—"}
          ondc={<CatalogField value={dmsTax.gstTax} />}
        />
        <DualRow
          label="GST Cess %"
          help="Additional cess on top of GST, if applicable"
          dms={dmsTax.gstCess || "—"}
          ondc={<CatalogField value={dmsTax.gstCess} />}
        />
      </DualSection>

      {/* Dimensions — Length / Width / Height in cm. Volumetric Weight
          is derived from the three (L × W × H ÷ 5000, the standard
          courier formula) and surfaced as a read-only field. */}
      <DualSection title="Dimensions" icon={<Ruler className="h-5 w-5 text-amber-600" />}>
        <DualRow
          label="Length"
          help="Optional · in centimetres"
          dms={""}
          ondc={<CatalogField value={seededOndc.productLength} />}
        />
        <DualRow
          label="Width"
          help="Optional · in centimetres"
          dms={""}
          ondc={<CatalogField value={seededOndc.productWidth} />}
        />
        <DualRow
          label="Height"
          help="Optional · in centimetres"
          dms={""}
          ondc={<CatalogField value={seededOndc.productHeight} />}
        />
        <DualRow
          label="Volumetric Weight"
          help="Auto-calculated from L × W × H ÷ 5000 — cannot be edited"
          dms={""}
          ondc={
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono">
                {formatVolumetricWeight(
                  ondc.productLength,
                  ondc.productWidth,
                  ondc.productHeight,
                )}
              </p>
              <span
                className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 leading-none"
                title="Volumetric Weight is derived from Length × Width × Height and cannot be edited directly"
              >
                Read-only
              </span>
            </div>
          }
        />
      </DualSection>

      {/* Category / Fulfillment / Location */}
      <DualSection title="Category, Fulfillment & Location" icon={<PackageOpen className="h-5 w-5 text-orange-600" />}>
        <DualRow
          label="Category ID"
          required
          ondcRequired
          help="ONDC eB2B taxonomy"
          dms={""}
          ondc={<CatalogField value={seededOndc.categoryId} />}
        />
        <DualRow
          label="Fulfillment ID"
          required
          ondcRequired
          help="Store Delivery only — Store Pickup is reserved for a later phase."
          dms={""}
          ondc={
            <SelectInput
              value={ondc.fulfillmentId}
              onChange={(v) => update("fulfillmentId", v)}
              edited={isEdited("fulfillmentId")}
              errorMessage={getError("fulfillmentId")}
              // Phase 1: Store Pickup is intentionally NOT exposed.
              options={["Store Delivery"]}
            />
          }
        />
        <DualRow
          label="Location ID"
          required
          ondcRequired
          help="Warehouse / store this SKU is fulfilled from."
          dms={""}
          ondc={
            <SelectInput
              value={ondc.locationId}
              onChange={(v) => update("locationId", v)}
              edited={isEdited("locationId")}
              errorMessage={getError("locationId")}
              // Spec: dropdown, default Warehouse 1. Future warehouses
              // would be added here (or pulled from the seller record).
              options={["Warehouse 1", "Warehouse 2", "Warehouse 3"]}
            />
          }
        />
      </DualSection>

      {/* ONDC Commerce Attributes */}
      <DualSection title="ONDC Commerce Attributes" icon={<ShieldCheck className="h-5 w-5 text-teal-600" />}>
        {/* Returnable / Cancellable / COD are now editable Yes/No toggles
            so the seller can configure their commerce policy per SKU. */}
        <DualRow
          label="Returnable"
          required
          ondcRequired
          help="Whether buyers can return this SKU after delivery."
          dms={""}
          ondc={
            <YesNoToggle
              checked={ondc.returnable}
              onChange={(v) => update("returnable", v)}
              edited={isEdited("returnable")}
            />
          }
        />
        <DualRow
          label="Cancellable"
          required
          ondcRequired
          help="Whether buyers can cancel before dispatch."
          dms={""}
          ondc={
            <YesNoToggle
              checked={ondc.cancellable}
              onChange={(v) => update("cancellable", v)}
              edited={isEdited("cancellable")}
            />
          }
        />
        <DualRow
          label="Available on COD"
          required
          ondcRequired
          help="Whether cash-on-delivery is offered for this SKU."
          dms={""}
          ondc={
            <YesNoToggle
              checked={ondc.availableOnCod}
              onChange={(v) => update("availableOnCod", v)}
              edited={isEdited("availableOnCod")}
            />
          }
        />
        {/* Time to Ship is no longer per-SKU editable. The seller
            configures their dispatch window once on Settings > Order
            Settings > Processing Time, and every SKU surfaces that
            value here as a read-only field — same treatment as
            Volumetric Weight and SKU Code. */}
        <DualRow
          label="Time to Ship"
          required
          ondcRequired
          help="Inherited from Settings > Order Settings > Processing Time. Update it there to change every SKU at once."
          dms={""}
          ondc={
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono">
                {formatProcessingTimeLabel(getProcessingTimeHours())}
              </p>
              <span
                className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 leading-none"
                title="Time to Ship is set on Settings > Order Settings > Processing Time."
              >
                Read-only
              </span>
            </div>
          }
        />
        <DualRow
          label="Consumer Care — Name"
          required
          ondcRequired
          dms={""}
          ondc={<TextInput value={ondc.consumerCareContactName} onChange={(v) => update("consumerCareContactName", v)} edited={isEdited("consumerCareContactName")} required errorMessage={getError("consumerCareContactName")} />}
        />
        <DualRow
          label="Consumer Care — Email"
          required
          ondcRequired
          dms={""}
          ondc={<TextInput value={ondc.consumerCareContactEmail} onChange={(v) => update("consumerCareContactEmail", v)} edited={isEdited("consumerCareContactEmail")} required errorMessage={getError("consumerCareContactEmail")} />}
        />
        <DualRow
          label="Consumer Care — Phone"
          required
          ondcRequired
          help="10–11 digits, numeric only"
          dms={""}
          ondc={<TextInput value={ondc.consumerCareContactPhone} onChange={(v) => update("consumerCareContactPhone", v)} edited={isEdited("consumerCareContactPhone")} required errorMessage={getError("consumerCareContactPhone")} />}
        />
      </DualSection>

      {/* Company & Brand Information (was: Statutory — Packaged Commodities) */}
      <DualSection
        title="Company & Brand Information"
        icon={<Info className="h-5 w-5 text-rose-600" />}
      >
        <DualRow
          label="Manufacturer / Packer Name (Company Name)"
          required
          ondcRequired
          conditional
          help="Owned by the brand — managed by Catalog Admin"
          dms={""}
          ondc={<CatalogField value={seededOndc.manufacturerName} />}
        />
        <DualRow
          label="Brand"
          required
          ondcRequired
          help="Owned by the brand — managed by Catalog Admin"
          dms={""}
          ondc={<CatalogField value={seededOndc.brandAttribute} />}
        />
        <DualRow
          label="Manufacturer / Packer Address"
          conditional
          help="10–250 chars, must include 6-digit PIN"
          dms={""}
          multiline
          ondc={<TextAreaInput value={ondc.manufacturerAddress} onChange={(v) => update("manufacturerAddress", v)} edited={isEdited("manufacturerAddress")} errorMessage={getError("manufacturerAddress")} />}
        />
      </DualSection>

      {/* Tags */}
      <DualSection title="Tags (Discovery & Attribute Enrichment)" icon={<Sparkles className="h-5 w-5 text-pink-600" />}>
        <DualRow
          label="Country of Origin"
          required
          ondcRequired
          help="Where the SKU is manufactured / packed."
          dms={""}
          ondc={<CatalogField value={seededOndc.countryOfOrigin} />}
        />
      </DualSection>

      {/* Product Images — managed by Catalog Admin, read-only for sellers */}
      <ReadOnlyProductImages images={seededOndc.productImages} />

      {/* Post-save summary — surfaces the count of saved fields vs
          fields that still need fixing. Per-field error detail also
          renders INLINE beneath each affected input via getError(),
          so this dialog is purely the high-level "how the save went"
          summary that lets the seller move on with confidence
          (incremental save: valid fields are persisted, invalid ones
          stay editable with their inline red helper text). */}
      <Dialog
        open={postSavePrompt !== null}
        onOpenChange={(o) => !o && setPostSavePrompt(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-2xl max-h-[85vh] flex flex-col"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-5 w-5" />
              {postSavePrompt?.title}
            </DialogTitle>
            <DialogDescription>{postSavePrompt?.body}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 text-sm shrink-0">
            {postSavePrompt && postSavePrompt.savedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {postSavePrompt.savedCount} saved
              </span>
            )}
            {postSavePrompt && postSavePrompt.failedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="h-3.5 w-3.5" />
                {postSavePrompt.failedCount} need fixing
              </span>
            )}
          </div>

          {/* What specifically needs fixing — driven by the same
              pendingErrors array that paints the inline red text on
              each field. Showing the list here gives the seller a
              one-glance summary so they don't have to scan the whole
              page to find the red. */}
          {pendingErrors.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Fields that need fixing:
              </p>
              <ul className="space-y-2">
                {pendingErrors.map((err, i) => (
                  <li
                    key={`${err.ruleId}-${i}`}
                    className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 text-sm"
                  >
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-red-800 font-medium leading-snug">
                        {err.message}
                      </p>
                      <p className="text-[11px] text-red-600 font-mono mt-0.5 truncate">
                        {humaniseFieldPath(err.field)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="shrink-0">
            <Button onClick={() => setPostSavePrompt(null)}>
              Got it, will fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ---------- Compact form primitives (grid-based, minimal whitespace) ----------

// ---------- DMS / ONDC dual-column primitives ----------

// =====================================================================
// Single-view SKU primitives (Phase 2 revamp)
// ---------------------------------------------------------------------
// We dropped the DMS / ONDC two-column layout. The page is now a single
// unified SKU structure: every field has one editor (except SKU Code,
// which is locked). Each section renders a card with a 2-column grid
// of fields (1 column on small screens, 2 on md+). Multi-line fields
// (Long Description, Manufacturer Address) span both columns via the
// `multiline` flag on DualRow. The component names stay so existing
// call sites in this file don't have to change.
// =====================================================================

function DualSection({
  title,
  icon,
  children,
  dense,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** Tighter vertical paddings — useful for the Price & Inventory tab. */
  dense?: boolean;
}) {
  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader
        className={
          (dense ? "py-1.5 px-3 !pb-1.5" : "py-2.5 px-4 !pb-2.5") +
          " gap-0 border-b border-gray-100"
        }
      >
        <CardTitle className="text-sm font-semibold flex items-center gap-2 m-0">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={dense ? "p-3" : "p-4"}>
        {/* 2-column responsive grid. Children are <DualRow>s; rows with
            `multiline` opt into a full-width slot inside the grid. */}
        <div
          className={
            "grid grid-cols-1 md:grid-cols-2 " +
            (dense ? "gap-x-4 gap-y-2" : "gap-x-4 gap-y-3")
          }
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function DualRow({
  label,
  required,
  // ondcRequired is preserved for prop-signature compatibility but now
  // collapses into the same red asterisk as `required` — the dual-mode
  // distinction is gone in the unified view.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ondcRequired,
  conditional,
  help,
  // dms is preserved for prop compat but no longer rendered. Old call
  // sites that pass dms={dms.someField} are simply ignored.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dms,
  ondc,
  multiline,
  dense,
}: {
  label: string;
  required?: boolean;
  ondcRequired?: boolean;
  conditional?: boolean;
  help?: string;
  dms: React.ReactNode;
  ondc: React.ReactNode;
  /** When true, the field spans both columns of the section's grid —
   *  used for Long Description, Manufacturer Address, etc. */
  multiline?: boolean;
  /** Inherited from DualSection; controls vertical density. */
  dense?: boolean;
}) {
  return (
    <div
      className={
        (multiline ? "md:col-span-2 " : "") +
        (dense ? "space-y-1" : "space-y-1.5")
      }
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <Label className="text-xs font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {conditional && (
          <span
            className="inline-flex items-center shrink-0 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 leading-none"
            title="Conditional (packaged commodities)"
          >
            Cond.
          </span>
        )}
      </div>
      <div>{ondc}</div>
      {help && (
        <p className="text-[11px] text-gray-500 leading-tight">{help}</p>
      )}
    </div>
  );
}

function CompactSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="py-2.5 px-4 border-b border-gray-100">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

function CompactField({
  label,
  required,
  ondcRequired,
  conditional,
  help,
  span2,
  children,
}: {
  label: string;
  required?: boolean;
  ondcRequired?: boolean;
  conditional?: boolean;
  help?: string;
  span2?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${span2 ? "md:col-span-2" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="text-xs font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {ondcRequired && (
          <span
            className="inline-flex items-center shrink-0 px-1 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 leading-none"
            title="Required for ONDC compliance"
          >
            ONDC
          </span>
        )}
        {conditional && (
          <span
            className="inline-flex items-center shrink-0 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 leading-none"
            title="Conditional (packaged commodities)"
          >
            Conditional
          </span>
        )}
      </div>
      {children}
      {help && <p className="text-[11px] text-gray-500 leading-tight">{help}</p>}
    </div>
  );
}

function StatusToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-full p-0.5 border border-gray-200">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
          active
            ? "bg-green-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
          !active
            ? "bg-gray-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Inactive
      </button>
    </div>
  );
}

function BooleanToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          value ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className={`text-xs font-medium ${value ? "text-blue-700" : "text-gray-500"}`}>
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}

// ---------- Product Images section ----------
// At least one image is mandatory; up to 5 images total (1 + 4 more).
// Uses the browser File API to render real previews (URL.createObjectURL).
function ProductImagesSection({
  images,
  onChange,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const MAX_IMAGES = 5;
  const remaining = MAX_IMAGES - images.length;

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Only image files
    const imgFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imgFiles.length === 0) {
      toast.error("Only image files (PNG / JPG / JPEG / WEBP) are allowed.");
      return;
    }
    const slots = Math.max(0, MAX_IMAGES - images.length);
    if (slots === 0) {
      toast.error(`You can upload a maximum of ${MAX_IMAGES} images.`);
      return;
    }
    const accepted = imgFiles.slice(0, slots);
    const urls = accepted.map((f) => URL.createObjectURL(f));
    onChange([...images, ...urls]);
    if (imgFiles.length > slots) {
      toast.warning(
        `Only ${slots} more image${slots === 1 ? "" : "s"} could be added (max ${MAX_IMAGES}).`,
      );
    } else {
      toast.success(
        `${accepted.length} image${accepted.length === 1 ? "" : "s"} added.`,
      );
    }
    // Reset input so the same file can be re-selected later
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = (idx: number) => {
    const removed = images[idx];
    if (removed?.startsWith("blob:")) URL.revokeObjectURL(removed);
    onChange(images.filter((_, i) => i !== idx));
  };

  const isMissing = images.length === 0;

  return (
    <Card>
      <CardHeader className="py-2.5 px-4 border-b border-gray-100">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-fuchsia-600" />
          Product Images
          <span className="text-red-500 ml-0.5">*</span>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-2 text-[10px]">
            {images.length}/{MAX_IMAGES}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="text-xs text-gray-600">
          At least <b>1 image is required</b>. You can add up to <b>{MAX_IMAGES} images</b> in
          total (1 primary + 4 more). PNG, JPG, JPEG, or WEBP.
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          onChange={handleSelect}
          className="hidden"
        />

        <div className="flex flex-wrap gap-3">
          {images.map((src, idx) => (
            <div
              key={idx}
              className="relative w-28 h-28 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden group"
            >
              <img src={src} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 && (
                <span className="absolute top-1 left-1 bg-blue-600 text-white text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded">
                  Primary
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="absolute top-1 right-1 p-1 rounded bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                title="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Upload tile — only shown if we still have slots */}
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-28 h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-colors ${
                isMissing
                  ? "border-red-400 hover:border-red-600 text-red-600 hover:text-red-700 bg-red-50"
                  : "border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600"
              }`}
            >
              <Upload className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Upload</span>
              <span className="text-[10px] mt-0.5">
                {remaining} more allowed
              </span>
            </button>
          )}
        </div>

        {isMissing && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <b>At least one product image is required.</b> The first image you upload becomes
              the primary image shown to buyers.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImageUploader({
  images,
  onChange,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((_img, idx) => (
          <div
            key={idx}
            className="relative w-24 h-24 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center group"
          >
            <ImageIcon className="h-6 w-6 text-gray-400" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 p-0.5 rounded bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...images, `img-${images.length + 1}`])}
          className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ImageIcon className="h-5 w-5 mb-1" />
          <span className="text-xs">Upload</span>
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {images.length} image{images.length !== 1 ? "s" : ""} uploaded
      </p>
    </div>
  );
}

// ---------- Read-only catalog field primitive ----------

function CatalogField({ value, multiline }: { value: string; multiline?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 py-1.5 px-2.5 rounded-md bg-gray-50 border border-gray-200 ${
        multiline ? "min-h-[56px]" : "min-h-[36px]"
      }`}
    >
      <p className={`flex-1 text-sm break-words ${value ? "text-gray-800" : "text-gray-400 italic"}`}>
        {value || "—"}
      </p>
      <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 leading-none mt-0.5">
        Catalog
      </span>
    </div>
  );
}

// Read-only product images section for sellers — shows brand-uploaded images without upload controls.
function ReadOnlyProductImages({ images }: { images: string[] }) {
  return (
    <Card>
      <CardHeader className="py-2.5 px-4 border-b border-gray-100">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-fuchsia-600" />
          Product Images
          <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 leading-none ml-1">
            Catalog
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {images.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No images provided by the brand.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {images.map((src, idx) => (
              <div
                key={idx}
                className="relative w-28 h-28 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden"
              >
                <img src={src} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                {idx === 0 && (
                  <span className="absolute top-1 left-1 bg-blue-600 text-white text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Editable field primitives ----------

function TextInput({
  value,
  onChange,
  // `edited` is preserved on the prop signature to keep ~25 call
  // sites compiling; the amber "Edited" outline + pill were retired
  // because the seller can see their own changes inline.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  edited,
  required,
  type = "text",
  placeholder,
  prefix,
  errorMessage,
  disabled,
  disabledHint,
}: {
  value: string;
  onChange: (v: string) => void;
  edited?: boolean;
  required?: boolean;
  type?: "text" | "number";
  placeholder?: string;
  prefix?: React.ReactNode;
  /** When set, paints the field red and shows the message below the
   *  input. Takes precedence over the "Required" pill. */
  errorMessage?: string;
  /** Greys the input out and blocks edits. Used to gate dependent
   *  fields — e.g. Unit Value waits for Measure Unit, SKU Weight
   *  waits for Weight Measure. */
  disabled?: boolean;
  /** Helper text shown below a disabled input to explain why it's
   *  blocked. Suppresses the "Required" pill while disabled. */
  disabledHint?: string;
}) {
  const missing = required && !disabled && (!value || String(value).trim() === "");
  const hasError = !disabled && !!errorMessage;
  const borderClass = hasError || missing
    ? "border-red-400 focus:ring-red-500"
    : "border-gray-300 focus:ring-blue-500";
  const stateClass = disabled
    ? "bg-gray-50 text-gray-400 cursor-not-allowed"
    : "bg-white";
  return (
    <div>
      <div className="relative">
        {prefix !== undefined && (
          <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none ${disabled ? "text-gray-300" : "text-gray-500"}`}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          placeholder={disabled ? "" : placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full ${prefix !== undefined ? "pl-7 pr-2.5" : "px-2.5"} py-1.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${borderClass} ${stateClass}`}
        />
      </div>
      {disabled && disabledHint ? (
        <p className="mt-1 text-[11px] text-gray-500 italic">{disabledHint}</p>
      ) : hasError ? (
        <p className="mt-1 flex items-start gap-1 text-xs text-red-600 leading-snug">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      ) : (
        <FieldStatus missing={missing} />
      )}
    </div>
  );
}

function TextAreaInput({
  value,
  onChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  edited,
  required,
  errorMessage,
}: {
  value: string;
  onChange: (v: string) => void;
  edited?: boolean;
  required?: boolean;
  errorMessage?: string;
}) {
  const missing = required && (!value || String(value).trim() === "");
  const hasError = !!errorMessage;
  const borderClass = hasError || missing
    ? "border-red-400 focus:ring-red-500"
    : "border-gray-300 focus:ring-blue-500";
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className={`w-full px-2.5 py-1.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 ${borderClass}`}
      />
      {hasError ? (
        <p className="mt-1 flex items-start gap-1 text-xs text-red-600 leading-snug">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      ) : (
        <FieldStatus missing={missing} />
      )}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  edited,
  errorMessage,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  edited?: boolean;
  errorMessage?: string;
}) {
  const hasError = !!errorMessage;
  return (
    <div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={hasError ? "border-red-400" : ""}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasError && (
        <p className="mt-1 flex items-start gap-1 text-xs text-red-600 leading-snug">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Search-as-you-type combobox for picking from a list of strings.
 * Same external contract as SelectInput (value/onChange/options) so
 * call sites can swap one for the other when a list grows long
 * enough that scanning it linearly is painful — e.g. the Group Name
 * field, which can grow with every imported SKU family.
 *
 * Empty string value = nothing selected; the trigger shows the
 * placeholder. The clearable variant exposes a "Clear selection"
 * row at the top of the list (used for optional fields like Group
 * Name where "no group" is a legitimate choice).
 */
function ComboboxInput({
  value,
  onChange,
  options,
  placeholder = "Search or pick one…",
  clearable,
  clearLabel = "— None —",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  edited,
  errorMessage,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  clearable?: boolean;
  clearLabel?: string;
  edited?: boolean;
  errorMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasError = !!errorMessage;
  const selectedLabel = value || placeholder;
  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal h-9 px-2.5",
              !value && "text-muted-foreground",
              hasError && "border-red-400",
            )}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)]"
          align="start"
        >
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList className="max-h-64">
              <CommandEmpty>No match found.</CommandEmpty>
              <CommandGroup>
                {clearable && (
                  <CommandItem
                    value={clearLabel}
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="text-gray-500 italic"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === "" ? "opacity-100 text-blue-600" : "opacity-0",
                      )}
                    />
                    {clearLabel}
                  </CommandItem>
                )}
                {options.map((opt) => {
                  const isSel = opt === value;
                  return (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onSelect={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSel ? "opacity-100 text-blue-600" : "opacity-0",
                        )}
                      />
                      {opt}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {hasError && (
        <p className="mt-1 flex items-start gap-1 text-xs text-red-600 leading-snug">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Volumetric weight = (L × W × H in cm) ÷ 5000. The standard courier
 * formula used across Indian logistics (Delhivery, Blue Dart, etc.) so
 * the seller sees the same number their carrier will use. Returns
 * "—" when any of the three measurements is missing or non-numeric so
 * the read-only field reads cleanly until enough data is entered.
 */
function formatVolumetricWeight(
  length: string,
  width: string,
  height: string,
): string {
  const l = parseFloat(length);
  const w = parseFloat(width);
  const h = parseFloat(height);
  if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return "—";
  }
  if (l <= 0 || w <= 0 || h <= 0) return "—";
  const kg = (l * w * h) / 5000;
  return `${kg.toFixed(2)} kg`;
}

/**
 * Editable Yes/No toggle for ONDC boolean attributes (Returnable,
 * Cancellable, Available on COD). Renders the Switch alongside its
 * current state label so the value reads at a glance — Yes pills green,
 * No pills grey — and shows the standard "Edited" status under the
 * row when the seller flips it from the DMS default.
 */
function YesNoToggle({
  checked,
  onChange,
  edited,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  edited?: boolean;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-2">
        <Switch checked={checked} onCheckedChange={onChange} />
        <span
          className={
            "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border " +
            (checked
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-gray-100 text-gray-700 border-gray-200")
          }
        >
          {checked ? "Yes" : "No"}
        </span>
      </div>
      <FieldStatus edited={edited} />
    </div>
  );
}

// FieldStatus — surfaces inline status under an input. The "Edited"
// pill was retired (the seller can see their own changes); the
// "Required" pill stays as a friendlier nudge than a raw red border
// when an input is empty but mandatory.
function FieldStatus({ missing }: { missing?: boolean }) {
  if (!missing) return null;
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="h-3 w-3" />
        Required
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Active"
      ? "bg-green-50 text-green-700 border-green-200"
      : status === "Inactive"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-gray-100 text-gray-700 border-gray-300";
  return <Badge className={cls}>{status}</Badge>;
}

// Offers & Schemes Tab Component
function OffersTab({ skuId }: { skuId: string }) {
  const offers = mockOffers[skuId] || [];
  const [sortBy, setSortBy] = useState<"savings" | "relevance">("relevance");

  const skuLevelOffers = offers.filter((o) => o.category === "sku-level");
  const conditionalOffers = offers.filter((o) => o.category === "conditional");

  const sortOffers = (offerList: Offer[]) => {
    if (sortBy === "savings") {
      return [...offerList].sort((a, b) => (b.savings || 0) - (a.savings || 0));
    }
    return offerList;
  };

  const totalOffers = offers.length;
  const bestOffer = offers.find((o) => o.isBestOffer);

  if (totalOffers === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-gray-100 rounded-full p-6 mb-4">
          <Gift className="h-16 w-16 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No offers available</h3>
        <p className="text-gray-600 text-center max-w-md">
          There are currently no offers or schemes available for this SKU. Check back later for
          exciting deals!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900">Best Offer Available</h3>
              </div>
              {bestOffer ? (
                <div>
                  <p className="text-2xl font-bold text-green-700 mb-1">{bestOffer.benefitText}</p>
                  <p className="text-sm text-gray-600">{bestOffer.title}</p>
                </div>
              ) : (
                <p className="text-lg text-gray-700">Multiple offers available</p>
              )}
            </div>
            <div className="text-right">
              <div className="bg-white rounded-lg px-4 py-2 border border-green-300">
                <p className="text-sm text-gray-600">Total Offers</p>
                <p className="text-3xl font-bold text-gray-900">{totalOffers}</p>
              </div>
            </div>
          </div>
          {totalOffers > 1 && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <p className="text-sm text-gray-600">
                + {totalOffers - 1} more {totalOffers === 2 ? "offer" : "offers"} available below
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">All Offers</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SKU-Level Offers */}
      {skuLevelOffers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-green-600 rounded-full"></div>
            <h3 className="text-lg font-semibold text-gray-900">SKU-Level Offers</h3>
            <Badge className="bg-green-50 text-green-700 border-green-200">
              {skuLevelOffers.length}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 -mt-2">Directly applicable on this SKU</p>
          <div className="grid gap-4">
            {sortOffers(skuLevelOffers).map((offer) => (
              <OfferCard key={offer.id} offer={offer} currentQty={15} />
            ))}
          </div>
        </div>
      )}

      {/* Conditional Offers */}
      {conditionalOffers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
            <h3 className="text-lg font-semibold text-gray-900">Conditional Offers</h3>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
              {conditionalOffers.length}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 -mt-2">
            Dependent on cart value, seller, or product bundles
          </p>
          <div className="grid gap-4">
            {sortOffers(conditionalOffers).map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Price & Inventory Tab ----------
// Previously a separate page; now merged as a tab inside the SKU Detail so pricing + stock
// live with the SKU record. Uses the same edit-form validation (PV-003 / PV-004 / PV-005 /
// PV-011) as the Bizom bulk import.

function PriceInventoryTab({ sku }: { sku: any }) {
  // DMS snapshot — read-only reference from the DMS system.
  // Distributors typically can't enter real-time quantities (they sell offline
  // and on other marketplaces too), so stock is captured as a single toggle:
  // "Stock Available" yes/no. No piece-/case-level counts on this screen.
  const seedUnitsPerCase = String(sku.unitsPerCase ?? sku.ondcPrefilled?.unitizedCount ?? "1");
  const seedHasStock =
    sku.inStock !== undefined
      ? Boolean(sku.inStock)
      : Number(sku.availableStock ?? sku.inventory?.currentStock ?? 0) > 0 ||
        Boolean(sku.isInfiniteStock);

  const dmsPI = {
    mrp: String(sku.mrp ?? sku.pricing?.mrp ?? ""),
    sellingPrice: String(sku.sellingPrice ?? sku.pricing?.sellingPrice ?? ""),
    // Pack Size (Inner Pack) — optional, 1–10,000.
    packSize: String(sku.packSize ?? sku.ondcPrefilled?.unitizedCount ?? ""),
    unitsPerCase: seedUnitsPerCase,
    inStock: seedHasStock,
  };
  // ONDC (editable) — starts populated same as DMS (per business rule).
  // The seller reviews and edits if needed before publishing to ONDC.
  const [ondcPI, setOndcPI] = useState({ ...dmsPI });
  const updatePI = (key: keyof typeof dmsPI, value: any) =>
    setOndcPI((prev) => ({ ...prev, [key]: value }));

  // Incremental save — pending errors list shown as a non-blocking warning card
  const [pendingPIErrors, setPendingPIErrors] = useState<
    { code: string; field: string; message: string }[]
  >([]);

  const handleReset = () => {
    setOndcPI({ ...dmsPI });
    setPendingPIErrors([]);
    toast.success("ONDC price & inventory values reset to DMS");
  };

  // Active-offers warning — when the seller updates SP for a SKU
  // that has Active or Scheduled QPS schemes mapped to it, we open
  // this confirm dialog instead of saving immediately. The dialog
  // shows the current vs updated effective price for every mapped
  // slab so the seller can see how the change cascades.
  const [offersWarningOpen, setOffersWarningOpen] = useState(false);
  const [offersWarningSchemes, setOffersWarningSchemes] = useState<
    QpsScheme[]
  >([]);

  /** Run the actual save logic — toasts + pending-error state. Pulled
   *  out of handleSave so we can call it directly when no offers are
   *  mapped, and from the warning dialog's Confirm callback when they
   *  are. */
  const commitSave = () => {
    const errs: { code: string; field: string; message: string }[] = [];
    const mrp = parseFloat(ondcPI.mrp);
    const sp = parseFloat(ondcPI.sellingPrice);
    // Pack Size and UPC are read-only on this tab — they are owned by
    // the Product Details tab and validated there. Don't re-check
    // them here, otherwise an empty UPC on a fresh SKU would block
    // Save Price & Stock with an error the seller can't fix from this
    // tab.
    // MRP: required, numeric, > 0
    if (ondcPI.mrp === "" || isNaN(mrp)) {
      errs.push({ code: "ERR_PI_003", field: "MRP", message: "MRP is required and must be a valid number." });
    } else if (mrp <= 0) {
      errs.push({ code: "ERR_PI_003", field: "MRP", message: "MRP must be greater than 0." });
    }
    // Selling Price: required, numeric, > 0
    if (ondcPI.sellingPrice === "" || isNaN(sp)) {
      errs.push({ code: "ERR_PI_004", field: "Selling Price", message: "Selling price is required and must be a valid number." });
    } else if (sp < 0) {
      errs.push({ code: "ERR_PI_004", field: "Selling Price", message: "Selling price cannot be negative." });
    } else if (sp === 0) {
      errs.push({ code: "ERR_PI_004", field: "Selling Price", message: "Selling price must be greater than 0." });
    }
    // MRP ≥ SP
    if (!isNaN(mrp) && !isNaN(sp) && mrp > 0 && sp > 0 && mrp < sp) {
      errs.push({ code: "ERR_PI_005", field: "MRP", message: "MRP cannot be less than Selling Price — please enter a valid MRP (≥ Selling Price)." });
    }
    // Stock is now a single toggle (Stock Available). No quantity validation.
    // Incremental save — always persist. Show errors only for incorrectly
    // entered values, not for merely empty fields.
    const invalidErrs = errs.filter(
      (e) => !/is required\.?/i.test(e.message),
    );
    setPendingPIErrors(invalidErrs);
    if (invalidErrs.length > 0) {
      toast.warning(
        `Saved. ${invalidErrs.length} field${invalidErrs.length === 1 ? "" : "s"} ${invalidErrs.length === 1 ? "has" : "have"} invalid values — see the summary below.`,
      );
    } else if (errs.length > 0) {
      toast.success("Saved. Some optional fields still pending.");
    } else {
      toast.success("Price & inventory saved successfully");
    }
  };

  const handleSave = () => {
    // ---- Offers/schemes mapping check ----
    // Trigger the warning dialog ONLY when the SP has actually
    // changed AND there are Active/Scheduled schemes mapped to this
    // SKU. Stock-only or MRP-only edits don't affect slab effective
    // prices, so they save through directly.
    const newSp = parseFloat(ondcPI.sellingPrice);
    const dmsSp = parseFloat(dmsPI.sellingPrice);
    const spChanged =
      !isNaN(newSp) && !isNaN(dmsSp) && Math.abs(newSp - dmsSp) > 0.001;
    if (spChanged) {
      const skuCode = String(sku.sku ?? sku.skuCode ?? "");
      if (skuCode) {
        const mapped = getActiveSchemesForSku(skuCode);
        if (mapped.length > 0) {
          setOffersWarningSchemes(mapped);
          setOffersWarningOpen(true);
          // Bail — the dialog's Confirm CTA will call commitSave().
          return;
        }
      }
    }
    commitSave();
  };

  const isEditedPI = (key: keyof typeof dmsPI) =>
    JSON.stringify((dmsPI as any)[key]) !== JSON.stringify((ondcPI as any)[key]);

  return (
    <div className="space-y-3">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 gap-2 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">
            Price & Inventory for <b>{sku.sku}</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset
          </Button>
          <Button size="sm" className="" onClick={handleSave}>
            Save Price & Stock
          </Button>
        </div>
      </div>

      {/* Inventory — compact, single Stock Available toggle.
          Pack Size and UPC are read-only on this tab per spec — they
          are owned by the Product Details tab and shown here only for
          reference, with a hint about where to edit them. */}
      <DualSection title="Inventory" icon={<Archive className="h-5 w-5 text-emerald-600" />} dense>
        <DualRow
          dense
          label="Pack Size (Inner Pack)"
          help="Read-only here. Edit on the Product Details tab."
          dms={dmsPI.packSize}
          ondc={
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono">
                {ondcPI.packSize || "—"}
              </p>
              <span
                className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 leading-none"
                title="Pack Size is owned by the Product Details tab and cannot be changed here."
              >
                Read-only
              </span>
            </div>
          }
        />
        <DualRow
          dense
          label="UPC (Unit Per Case)"
          required
          help="Read-only here. Edit on the Product Details tab."
          dms={dmsPI.unitsPerCase}
          ondc={
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono">
                {ondcPI.unitsPerCase || "—"}
              </p>
              <span
                className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 leading-none"
                title="UPC is owned by the Product Details tab and cannot be changed here."
              >
                Read-only
              </span>
            </div>
          }
        />
        <DualRow
          dense
          label="Stock Available"
          dms={dmsPI.inStock ? "Yes" : "No"}
          ondc={
            <BooleanToggle
              value={ondcPI.inStock}
              onChange={(v) => updatePI("inStock", v)}
            />
          }
        />
      </DualSection>

      {/* Price — single SKU-level MRP + Selling Price */}
      <DualSection title="Price" icon={<IndianRupee className="h-5 w-5 text-green-600" />} dense>
        <DualRow
          dense
          label="MRP"
          required
          dms={dmsPI.mrp ? `₹${dmsPI.mrp}` : ""}
          ondc={
            <TextInput
              value={ondcPI.mrp}
              onChange={(v) => updatePI("mrp", v)}
              edited={isEditedPI("mrp")}
              required
              type="number"
              prefix="₹"
            />
          }
        />
        <DualRow
          dense
          label="Selling Price"
          required
          dms={dmsPI.sellingPrice ? `₹${dmsPI.sellingPrice}` : ""}
          ondc={
            <TextInput
              value={ondcPI.sellingPrice}
              onChange={(v) => updatePI("sellingPrice", v)}
              edited={isEditedPI("sellingPrice")}
              required
              type="number"
              prefix="₹"
            />
          }
        />
      </DualSection>

      {/* Save-time error popup */}
      <Dialog
        open={pendingPIErrors.length > 0}
        onOpenChange={(o) => !o && setPendingPIErrors([])}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              We couldn't save your changes
            </DialogTitle>
            <DialogDescription>
              We couldn't save your changes. Please try again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {pendingPIErrors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 text-sm"
              >
                <span className="font-mono font-semibold text-[10px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                  {err.code}
                </span>
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{err.message}</p>
                  <p className="text-[11px] text-red-600 mt-0.5">{err.field}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setPendingPIErrors([])}
              className=""
            >
              Got it, will fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active-offers warning shown when the seller updates SP for
          a SKU that has Active or Scheduled QPS schemes mapped. The
          dialog renders the read-only current vs updated effective
          prices for every mapped slab and gates the actual save
          behind the seller's explicit Confirm. */}
      <PriceUpdateOffersDialog
        open={offersWarningOpen}
        onOpenChange={setOffersWarningOpen}
        skuName={String(sku.skuName ?? sku.name ?? sku.sku ?? "")}
        skuCode={String(sku.sku ?? sku.skuCode ?? "")}
        schemes={offersWarningSchemes}
        currentPrice={parseFloat(dmsPI.sellingPrice) || 0}
        updatedPrice={parseFloat(ondcPI.sellingPrice) || 0}
        onConfirm={commitSave}
      />
    </div>
  );
}

// ---------- Selling Units Chips ----------
// Lightweight chip input that lives directly under Pack Size on the
// Product Details tab. The seller types a piece count, hits Enter (or
// clicks Add), and the number becomes a chip. Each chip carries an ×
// for removal. Empty by default — distributors only add chips for the
// pack sizes they actually want buyers to order in.
function SellingUnitsChips({
  value,
  onChange,
  edited,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  edited?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a piece count of at least 1.");
      return;
    }
    if (value.includes(n)) {
      toast.error(`${n} is already added.`);
      setDraft("");
      return;
    }
    onChange([...value, n]);
    setDraft("");
  };

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={draft}
          placeholder="e.g. 16"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className={`w-32 px-2 py-1.5 rounded-md border text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            edited ? "border-blue-400" : "border-gray-300"
          }`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={commit}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {value.map((qty, idx) => (
            <span
              key={`${qty}-${idx}`}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
            >
              <span className="font-mono">{qty}</span>
              <span className="text-blue-500">{qty === 1 ? "piece" : "pieces"}</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="ml-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-blue-100 transition-colors"
                title="Remove"
                aria-label={`Remove ${qty}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 italic">
          No selling units yet — type a number above and press Enter.
        </p>
      )}
    </div>
  );
}

/**
 * Build a minimal `sku` object from a catalog entry so SKU Detail
 * can render the correct SKU code, name, MRP and Selling Price for
 * any catalog SKU even when we don't have a hand-authored detail
 * record. The hand-authored entries in `skuData` (1, 2, 190000001)
 * still take precedence — this is only the fallback path.
 */
function synthSkuFromStore(skuId: string) {
  const s = getMySkus().find((sk) => sk.id === skuId);
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    sku: s.sku,
    shortName: s.shortName ?? "",
    category: s.category,
    brand: s.brand,
    source: s.source,
    status: s.status,
    lastUpdated: s.lastUpdated,
    description: (s.ondcPrefilled?.longDesc as string) ?? "",
    specifications: {
      weight: s.ondcPrefilled?.skuWeight
        ? `${s.ondcPrefilled.skuWeight} ${s.ondcPrefilled.weightMeasure ?? ""}`
        : "",
      packaging: "",
      shelfLife: "",
      manufacturer: (s.ondcPrefilled?.manufacturerName as string) ?? "",
      countryOfOrigin: (s.ondcPrefilled?.countryOfOrigin as string) ?? "India",
    },
    pricing: {
      mrp: s.mrp ?? 0,
      sellingPrice: s.sellingPrice ?? 0,
      costPrice: 0,
      margin: "—",
    },
    mrp: s.mrp,
    sellingPrice: s.sellingPrice,
    availableStock: s.availableStock ?? 0,
    inventory: {
      currentStock: s.availableStock ?? 0,
      minStockLevel: s.thresholdLevel ?? 0,
      reorderPoint: 0,
      warehouse: "",
    },
    ondcPrefilled: s.ondcPrefilled ?? null,
    tax: s.tax ?? { hsnCode: "", gstTax: "", gstCess: "" },
    productStoreId: s.productStoreId ?? null,
  };
}

function synthSkuFromCatalog(skuId: string) {
  const c = findCatalogSku(skuId);
  if (!c) return null;
  return {
    id: c.id,
    name: c.skuName,
    sku: c.skuCode,
    skuName: c.skuName,
    category: c.category,
    brand: c.brand,
    source: "DMS Sync",
    status: "Active",
    lastUpdated: "2026-04-22",
    description: "",
    specifications: {
      weight: "",
      packaging: "",
      shelfLife: "",
      manufacturer: c.brand,
      countryOfOrigin: "India",
    },
    pricing: {
      mrp: c.mrp,
      sellingPrice: c.sellingPrice,
      costPrice: 0,
      margin: "—",
    },
    mrp: c.mrp,
    sellingPrice: c.sellingPrice,
    inventory: {
      currentStock: 0,
      minStockLevel: 0,
      reorderPoint: 0,
      warehouse: "",
    },
    tax: { hsnCode: "", gstTax: "", gstCess: "" },
  };
}

// Main SKU Detail Component
export function SKUDetail() {
  const navigate = useNavigate();
  const { skuId } = useParams();
  const [activeTab, setActiveTab] = useState<"details" | "pricing">("details");

  // Prefer hand-authored rich detail when we have it, otherwise
  // synthesize from the shared catalog. Only fall back to the demo
  // entry "1" if neither path resolves.
  const sku =
    (skuId && skuData[skuId]) ||
    (skuId && synthSkuFromCatalog(skuId)) ||
    (skuId && synthSkuFromStore(skuId)) ||
    skuData["1"];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
      case "Inactive":
        return <Badge className="bg-red-50 text-red-700 border-red-200">Inactive</Badge>;
      case "Draft":
        return <Badge className="bg-gray-100 text-gray-700 border-gray-300">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-full">
      {/* Header — compact */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/products/my-sku")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{sku.name}</h1>
              {getStatusBadge(sku.status)}
            </div>
            <p className="text-sm text-gray-600">SKU: {sku.sku}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab("details")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "details"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Product Details
            </div>
          </button>
          <button
            onClick={() => setActiveTab("pricing")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "pricing"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Price & Inventory
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "details" && <ProductDetailsTab sku={sku} />}
      {activeTab === "pricing" && <PriceInventoryTab sku={sku} />}
    </div>
  );
}