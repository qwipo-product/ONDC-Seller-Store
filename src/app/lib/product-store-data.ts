// Central mock data for the Qwipo Product Store.
// All Product Store pages (seller browse + catalog admin) share this module.

import type { SkuRequestForm } from "./sku-request-store";

export interface PSCompany {
  id: string;
  name: string;
  logo: string;
  imageUrl: string;
  abbr: string;
  color: string;
  skuCount: number;
  activeBrands: number;
}

export interface PSBrand {
  id: string;
  companyId: string;
  name: string;
  logo: string;
  imageUrl: string;
  abbr: string;
  color: string;
  skuCount: number;
  activeSkuCount: number;
  category: string;
}

export interface PSCategory {
  id: string;
  name: string;
  parentId?: string;
}

export type PSSkuStatus = "active" | "inactive";

export interface PSSku {
  id: string;
  skuCode: string;
  name: string;
  shortName?: string;
  groupName?: string;
  brandId: string;
  companyId: string;
  categoryId: string;
  shortDescription: string;
  longDescription: string;
  image: string;
  // Reference MRP from manufacturer — note: MRP is Field Category 2, seller sets their own in My SKU
  mrp: number;
  hsnCode: string;
  gstTax?: string;
  gstCess?: string;
  countryOfOrigin: string;
  manufacturerName: string;
  packagingSize: string;
  packagingUnit: string;
  upc?: string;
  productWeight: number;
  productLength?: number;
  productWidth?: number;
  productHeight?: number;
  packageType?: string;
  packageTypeValue?: string;
  status: PSSkuStatus;
  linkedSellersCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PSRequestType = "create_sku" | "edit_sku" | "inactivate_sku" | "activate_sku" | "request_company" | "request_brand";
export type PSRequestStatus = "submitted" | "in_progress" | "approved" | "rejected";

export interface PSRequest {
  id: string;
  type: PSRequestType;
  status: PSRequestStatus;
  skuId?: string;
  skuCode?: string;
  skuName: string;
  brandId: string;
  brandName: string;
  companyName: string;
  requestedBy: string;
  requestedByType: "seller" | "brand_manager" | "system";
  createdAt: string;
  updatedAt: string;
  changes?: Record<string, { old: string; new: string }>;
  notes?: string;
  reason?: string;
  /** Full form data submitted by the seller (present on create_sku requests) */
  form?: SkuRequestForm;
}

// ------------------------------------------------------------------
// Product Store reach — total seller users importing from PS
// ------------------------------------------------------------------
export const psSellerCount = 55;

// ------------------------------------------------------------------
// Companies
// ------------------------------------------------------------------
export const psCompanies: PSCompany[] = [
  { id: "ITC", name: "ITC Limited", logo: "🏭", imageUrl: "https://logo.clearbit.com/itcportal.com", abbr: "ITC", color: "#1a5276", skuCount: 312, activeBrands: 4 },
  { id: "HUL", name: "Hindustan Unilever", logo: "🧴", imageUrl: "https://logo.clearbit.com/hul.co.in", abbr: "HUL", color: "#1565c0", skuCount: 428, activeBrands: 6 },
  { id: "NEST", name: "Nestle India", logo: "🍫", imageUrl: "https://logo.clearbit.com/nestle.in", abbr: "NES", color: "#c0392b", skuCount: 178, activeBrands: 3 },
  { id: "BRIT", name: "Britannia Industries", logo: "🍪", imageUrl: "https://logo.clearbit.com/britannia.co.in", abbr: "BRI", color: "#e65100", skuCount: 134, activeBrands: 2 },
  { id: "PARL", name: "Parle Products", logo: "🍬", imageUrl: "https://logo.clearbit.com/parleindia.com", abbr: "PAR", color: "#6a1f6a", skuCount: 156, activeBrands: 3 },
  { id: "DABUR", name: "Dabur India", logo: "🌿", imageUrl: "https://logo.clearbit.com/dabur.com", abbr: "DAB", color: "#2e7d32", skuCount: 245, activeBrands: 5 },
  { id: "P&G", name: "Procter & Gamble", logo: "🧼", imageUrl: "https://logo.clearbit.com/pg.com", abbr: "P&G", color: "#1a237e", skuCount: 198, activeBrands: 4 },
  { id: "AMUL", name: "Amul (GCMMF)", logo: "🥛", imageUrl: "https://logo.clearbit.com/amul.com", abbr: "AMU", color: "#b71c1c", skuCount: 89, activeBrands: 1 },
];

// ------------------------------------------------------------------
// Brands
// ------------------------------------------------------------------
export const psBrands: PSBrand[] = [
  // ITC
  { id: "AASH", companyId: "ITC", name: "Aashirvaad", logo: "🌾", imageUrl: "https://logo.clearbit.com/aashirvaad.com", abbr: "ASH", color: "#795548", skuCount: 28, activeSkuCount: 22, category: "Atta & Flours" },
  { id: "SUNF", companyId: "ITC", name: "Sunfeast", logo: "🍪", imageUrl: "https://logo.clearbit.com/sunfeast.com", abbr: "SUN", color: "#e65100", skuCount: 56, activeSkuCount: 48, category: "Biscuits & Snacks" },
  { id: "BINGO", companyId: "ITC", name: "Bingo!", logo: "🍟", imageUrl: "https://logo.clearbit.com/bingochips.com", abbr: "BNG", color: "#f57f17", skuCount: 32, activeSkuCount: 28, category: "Snacks & Namkeen" },
  { id: "YIPP", companyId: "ITC", name: "Yippee!", logo: "🍜", imageUrl: "https://logo.clearbit.com/yippee.in", abbr: "YIP", color: "#c62828", skuCount: 18, activeSkuCount: 16, category: "Noodles & Pasta" },
  // HUL
  { id: "SURF", companyId: "HUL", name: "Surf Excel", logo: "🧺", imageUrl: "https://logo.clearbit.com/surfexcel.in", abbr: "SRF", color: "#1565c0", skuCount: 24, activeSkuCount: 22, category: "Detergents & Fabric Care" },
  { id: "LUX", companyId: "HUL", name: "Lux", logo: "🛁", imageUrl: "https://logo.clearbit.com/luxbeauty.com", abbr: "LUX", color: "#880e4f", skuCount: 18, activeSkuCount: 16, category: "Soaps & Bathing" },
  { id: "DOVE", companyId: "HUL", name: "Dove", logo: "🕊️", imageUrl: "https://logo.clearbit.com/dove.com", abbr: "DOV", color: "#546e7a", skuCount: 22, activeSkuCount: 18, category: "Personal Care" },
  { id: "LIPT", companyId: "HUL", name: "Lipton", logo: "🍵", imageUrl: "https://logo.clearbit.com/lipton.com", abbr: "LIP", color: "#f9a825", skuCount: 34, activeSkuCount: 30, category: "Tea & Beverages" },
  { id: "KNORR", companyId: "HUL", name: "Knorr", logo: "🍲", imageUrl: "https://logo.clearbit.com/knorr.com", abbr: "KNR", color: "#2e7d32", skuCount: 26, activeSkuCount: 22, category: "Soups & Seasonings" },
  // Nestle
  { id: "MAGGI", companyId: "NEST", name: "Maggi", logo: "🍝", imageUrl: "https://logo.clearbit.com/maggi.in", abbr: "MAG", color: "#c0392b", skuCount: 48, activeSkuCount: 42, category: "Noodles & Sauces" },
  { id: "NESTEA", companyId: "NEST", name: "Nescafe", logo: "☕", imageUrl: "https://logo.clearbit.com/nescafe.com", abbr: "NES", color: "#b71c1c", skuCount: 28, activeSkuCount: 24, category: "Coffee & Beverages" },
  { id: "KITKAT", companyId: "NEST", name: "KitKat", logo: "🍫", imageUrl: "https://logo.clearbit.com/kitkat.com", abbr: "KIT", color: "#bf360c", skuCount: 14, activeSkuCount: 12, category: "Chocolates & Confectionery" },
  // Britannia
  { id: "BNGB", companyId: "BRIT", name: "Good Day", logo: "🍪", imageUrl: "https://logo.clearbit.com/britannia.co.in", abbr: "GDY", color: "#e65100", skuCount: 38, activeSkuCount: 32, category: "Biscuits & Cookies" },
  { id: "MARIE", companyId: "BRIT", name: "Marie Gold", logo: "🍞", imageUrl: "https://logo.clearbit.com/britannia.co.in", abbr: "MRG", color: "#f57f17", skuCount: 16, activeSkuCount: 14, category: "Health Biscuits" },
  // Parle
  { id: "PARLG", companyId: "PARL", name: "Parle-G", logo: "🍪", imageUrl: "https://logo.clearbit.com/parleindia.com", abbr: "PLG", color: "#6a1f6a", skuCount: 12, activeSkuCount: 10, category: "Glucose Biscuits" },
  { id: "HIDE", companyId: "PARL", name: "Hide & Seek", logo: "🍫", imageUrl: "https://logo.clearbit.com/parleindia.com", abbr: "H&S", color: "#4a148c", skuCount: 22, activeSkuCount: 18, category: "Chocolate Biscuits" },
  // Dabur
  { id: "RCHYAW", companyId: "DABUR", name: "Chyawanprash", logo: "🌿", imageUrl: "https://logo.clearbit.com/dabur.com", abbr: "CHY", color: "#1b5e20", skuCount: 14, activeSkuCount: 12, category: "Health Supplements" },
  { id: "RJUICE", companyId: "DABUR", name: "Real Juice", logo: "🧃", imageUrl: "https://logo.clearbit.com/daburreal.com", abbr: "REL", color: "#e65100", skuCount: 42, activeSkuCount: 38, category: "Juices & Drinks" },
  // P&G
  { id: "ARIEL", companyId: "P&G", name: "Ariel", logo: "🧺", imageUrl: "https://logo.clearbit.com/ariel.com", abbr: "ARI", color: "#1565c0", skuCount: 22, activeSkuCount: 20, category: "Detergents" },
  { id: "GILLT", companyId: "P&G", name: "Gillette", logo: "🪒", imageUrl: "https://logo.clearbit.com/gillette.com", abbr: "GIL", color: "#1a237e", skuCount: 34, activeSkuCount: 28, category: "Grooming" },
  // Amul
  { id: "AMUL", companyId: "AMUL", name: "Amul", logo: "🥛", imageUrl: "https://logo.clearbit.com/amul.com", abbr: "AMU", color: "#b71c1c", skuCount: 89, activeSkuCount: 78, category: "Dairy & Beverages" },
];

// ------------------------------------------------------------------
// Categories
// ------------------------------------------------------------------
export const psCategories: PSCategory[] = [
  { id: "FOOD", name: "Food & Grocery" },
  { id: "ATTA", name: "Atta & Flours", parentId: "FOOD" },
  { id: "BISC", name: "Biscuits & Cookies", parentId: "FOOD" },
  { id: "SNCK", name: "Snacks & Namkeen", parentId: "FOOD" },
  { id: "NOOD", name: "Noodles & Pasta", parentId: "FOOD" },
  { id: "SOUP", name: "Soups & Seasonings", parentId: "FOOD" },
  { id: "CHOC", name: "Chocolates & Confectionery", parentId: "FOOD" },
  { id: "BEVG", name: "Beverages" },
  { id: "TEA", name: "Tea & Hot Beverages", parentId: "BEVG" },
  { id: "COFF", name: "Coffee", parentId: "BEVG" },
  { id: "JUICE", name: "Juices & Cold Drinks", parentId: "BEVG" },
  { id: "DAIRY", name: "Dairy & Fresh" },
  { id: "MILK", name: "Milk & Milk Products", parentId: "DAIRY" },
  { id: "HCARE", name: "Home Care" },
  { id: "DETG", name: "Detergents & Fabric Care", parentId: "HCARE" },
  { id: "SOAP", name: "Soaps & Bathing", parentId: "HCARE" },
  { id: "PCARE", name: "Personal Care" },
  { id: "HLTH", name: "Health & Wellness" },
  { id: "SUPP", name: "Health Supplements", parentId: "HLTH" },
];

// ------------------------------------------------------------------
// SKUs
// ------------------------------------------------------------------
export const psSkus: PSSku[] = [
  // Aashirvaad
  {
    id: "PS-001", skuCode: "AASH-001", name: "Aashirvaad Whole Wheat Atta 10 kg",
    shortName: "Aashirvaad Atta 10kg", groupName: "Aashirvaad Atta", brandId: "AASH", companyId: "ITC", categoryId: "ATTA",
    shortDescription: "Premium whole wheat flour, ideal for soft rotis",
    longDescription: "Aashirvaad Atta is milled from the finest wheat grains and is known for making soft and tasty rotis. It is the No.1 branded atta in India.",
    image: "🌾", mrp: 565, hsnCode: "11010000", gstTax: "5%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "ITC Limited", packagingSize: "10", packagingUnit: "kg",
    upc: "8901012345678", productWeight: 10.2,
    productLength: 32, productWidth: 20, productHeight: 10,
    packageType: "Bag", packageTypeValue: "HDPE Woven Bag",
    status: "active", linkedSellersCount: 48, createdAt: "2026-01-10", updatedAt: "2026-04-15",
  },
  {
    id: "PS-002", skuCode: "AASH-002", name: "Aashirvaad Whole Wheat Atta 5 kg",
    shortName: "Aashirvaad Atta 5kg", groupName: "Aashirvaad Atta", brandId: "AASH", companyId: "ITC", categoryId: "ATTA",
    shortDescription: "Premium whole wheat flour 5kg pack",
    longDescription: "Aashirvaad Atta 5kg — ideal for smaller households. Same premium quality as the larger pack.",
    image: "🌾", mrp: 295, hsnCode: "11010000", gstTax: "5%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "ITC Limited", packagingSize: "5", packagingUnit: "kg",
    upc: "8901012345679", productWeight: 5.1,
    productLength: 25, productWidth: 15, productHeight: 8,
    packageType: "Bag", packageTypeValue: "HDPE Woven Bag",
    status: "active", linkedSellersCount: 62, createdAt: "2026-01-10", updatedAt: "2026-04-15",
  },
  {
    id: "PS-003", skuCode: "AASH-003", name: "Aashirvaad Multigrain Atta 5 kg",
    shortName: "Multigrain Atta 5kg", groupName: "Aashirvaad Atta", brandId: "AASH", companyId: "ITC", categoryId: "ATTA",
    shortDescription: "6-grain blend for nutritious everyday cooking",
    longDescription: "A blend of 6 grains — wheat, soya, oat, maize, psyllium husk, and channa — for a nutritious, wholesome flour.",
    image: "🌾", mrp: 340, hsnCode: "11010000", gstTax: "5%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "ITC Limited", packagingSize: "5", packagingUnit: "kg",
    upc: "8901012345680", productWeight: 5.1,
    productLength: 25, productWidth: 15, productHeight: 8,
    packageType: "Bag", packageTypeValue: "HDPE Woven Bag",
    status: "active", linkedSellersCount: 31, createdAt: "2026-01-12", updatedAt: "2026-04-10",
  },
  // Sunfeast
  {
    id: "PS-010", skuCode: "SUNF-001", name: "Sunfeast Dark Fantasy Choco Fills 150g",
    shortName: "Dark Fantasy Choco 150g", groupName: "Dark Fantasy", brandId: "SUNF", companyId: "ITC", categoryId: "BISC",
    shortDescription: "Premium chocolate-filled cookies",
    longDescription: "Sunfeast Dark Fantasy Choco Fills — irresistible cookies with a dark chocolate filling, perfect for indulgent moments.",
    image: "🍫", mrp: 70, hsnCode: "19053100", gstTax: "18%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "ITC Limited", packagingSize: "150", packagingUnit: "g",
    upc: "8901012456001", productWeight: 0.16,
    productLength: 18, productWidth: 12, productHeight: 5,
    packageType: "Pouch", packageTypeValue: "Laminated Pouch",
    status: "active", linkedSellersCount: 55, createdAt: "2026-01-15", updatedAt: "2026-04-20",
  },
  {
    id: "PS-011", skuCode: "SUNF-002", name: "Sunfeast Mom's Magic Butter & Cashew 200g",
    shortName: "Mom's Magic Butter 200g", groupName: "Mom's Magic", brandId: "SUNF", companyId: "ITC", categoryId: "BISC",
    shortDescription: "Buttery cashew-flavored cookies",
    longDescription: "Rich buttery biscuits with a hint of cashew — a classic favourite for all ages.",
    image: "🍪", mrp: 45, hsnCode: "19053100", gstTax: "18%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "ITC Limited", packagingSize: "200", packagingUnit: "g",
    upc: "8901012456002", productWeight: 0.21,
    productLength: 20, productWidth: 14, productHeight: 4,
    packageType: "Pouch", packageTypeValue: "Laminated Pouch",
    status: "active", linkedSellersCount: 38, createdAt: "2026-01-15", updatedAt: "2026-04-18",
  },
  // Maggi
  {
    id: "PS-020", skuCode: "MAGGI-001", name: "Maggi 2-Minute Masala Noodles 70g",
    shortName: "Maggi Masala 70g", groupName: "Maggi 2-Minute Noodles", brandId: "MAGGI", companyId: "NEST", categoryId: "NOOD",
    shortDescription: "India's favourite instant noodles",
    longDescription: "Maggi 2-Minute Noodles — quick, tasty, and made with the iconic tastemaker masala. A household staple since 1983.",
    image: "🍝", mrp: 15, hsnCode: "19023000", gstTax: "12%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Nestle India Limited", packagingSize: "70", packagingUnit: "g",
    upc: "8901234567001", productWeight: 0.075,
    productLength: 17, productWidth: 11, productHeight: 2,
    packageType: "Pouch", packageTypeValue: "Laminated Pouch",
    status: "active", linkedSellersCount: 88, createdAt: "2026-01-05", updatedAt: "2026-04-25",
  },
  {
    id: "PS-021", skuCode: "MAGGI-002", name: "Maggi 2-Minute Masala Noodles 280g (Pack of 4)",
    shortName: "Maggi Masala 280g 4pk", groupName: "Maggi 2-Minute Noodles", brandId: "MAGGI", companyId: "NEST", categoryId: "NOOD",
    shortDescription: "Pack of 4 — value family pack",
    longDescription: "Maggi 2-Minute Noodles family pack with 4 servings. Same great taste, better value.",
    image: "🍝", mrp: 58, hsnCode: "19023000", gstTax: "12%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Nestle India Limited", packagingSize: "280", packagingUnit: "g",
    upc: "8901234567002", productWeight: 0.29,
    productLength: 22, productWidth: 14, productHeight: 8,
    packageType: "Carton", packageTypeValue: "Corrugated Box",
    status: "active", linkedSellersCount: 74, createdAt: "2026-01-05", updatedAt: "2026-04-25",
  },
  {
    id: "PS-022", skuCode: "MAGGI-003", name: "Maggi Hot & Sour Sauce 400g",
    shortName: "Maggi Hot & Sour Sauce 400g", groupName: "Maggi Sauces", brandId: "MAGGI", companyId: "NEST", categoryId: "SOUP",
    shortDescription: "Classic hot & sour dipping sauce",
    longDescription: "Maggi's iconic hot and sour sauce — perfect for snacks, street food, and stir fries.",
    image: "🍶", mrp: 80, hsnCode: "21039090", gstTax: "12%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Nestle India Limited", packagingSize: "400", packagingUnit: "g",
    upc: "8901234567010", productWeight: 0.42,
    productLength: 20, productWidth: 8, productHeight: 8,
    packageType: "Bottle", packageTypeValue: "PET Bottle",
    status: "active", linkedSellersCount: 42, createdAt: "2026-02-01", updatedAt: "2026-04-10",
  },
  // Nescafe
  {
    id: "PS-030", skuCode: "NCAF-001", name: "Nescafe Classic Instant Coffee 50g",
    shortName: "Nescafe Classic 50g", groupName: "Nescafe Classic", brandId: "NESTEA", companyId: "NEST", categoryId: "COFF",
    shortDescription: "Rich, aromatic instant coffee",
    longDescription: "Nescafe Classic is made from carefully selected robusta beans, giving you a rich full-bodied taste every time.",
    image: "☕", mrp: 145, hsnCode: "21011100", gstTax: "18%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Nestle India Limited", packagingSize: "50", packagingUnit: "g",
    upc: "8901234568001", productWeight: 0.06,
    productLength: 12, productWidth: 7, productHeight: 7,
    packageType: "Jar", packageTypeValue: "Glass Jar",
    status: "active", linkedSellersCount: 52, createdAt: "2026-01-08", updatedAt: "2026-04-20",
  },
  // Lipton Tea
  {
    id: "PS-040", skuCode: "LIPT-001", name: "Lipton Yellow Label Tea 250g",
    shortName: "Lipton Yellow Label 250g", groupName: "Lipton Yellow Label", brandId: "LIPT", companyId: "HUL", categoryId: "TEA",
    shortDescription: "Bright, brisk CTC tea for everyday use",
    longDescription: "Lipton Yellow Label is a bright, brisk tea that gives you a refreshing cup every time. Sourced from the finest tea gardens.",
    image: "🍵", mrp: 125, hsnCode: "09024090", gstTax: "5%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Hindustan Unilever Limited", packagingSize: "250", packagingUnit: "g",
    upc: "8901030500011", productWeight: 0.27,
    productLength: 16, productWidth: 10, productHeight: 6,
    packageType: "Carton", packageTypeValue: "Folding Carton",
    status: "active", linkedSellersCount: 45, createdAt: "2026-01-20", updatedAt: "2026-04-12",
  },
  // Surf Excel
  {
    id: "PS-050", skuCode: "SURF-001", name: "Surf Excel Easy Wash Detergent Powder 1 kg",
    shortName: "Surf Excel Easy Wash 1kg", groupName: "Surf Excel Easy Wash", brandId: "SURF", companyId: "HUL", categoryId: "DETG",
    shortDescription: "Removes tough stains with less effort",
    longDescription: "Surf Excel Easy Wash — dissolves easily in water, removes tough stains in as few as 2 bucket rinses.",
    image: "🧺", mrp: 115, hsnCode: "34022090", gstTax: "18%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Hindustan Unilever Limited", packagingSize: "1", packagingUnit: "kg",
    upc: "8901030890011", productWeight: 1.05,
    productLength: 22, productWidth: 15, productHeight: 7,
    packageType: "Pouch", packageTypeValue: "Laminated Stand-up Pouch",
    status: "active", linkedSellersCount: 60, createdAt: "2026-01-18", updatedAt: "2026-04-22",
  },
  {
    id: "PS-051", skuCode: "SURF-002", name: "Surf Excel Easy Wash Detergent Powder 3 kg",
    shortName: "Surf Excel Easy Wash 3kg", groupName: "Surf Excel Easy Wash", brandId: "SURF", companyId: "HUL", categoryId: "DETG",
    shortDescription: "Economy pack — value for money",
    longDescription: "Surf Excel Easy Wash 3kg — same great cleaning power, bigger value pack for larger families.",
    image: "🧺", mrp: 318, hsnCode: "34022090", gstTax: "18%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Hindustan Unilever Limited", packagingSize: "3", packagingUnit: "kg",
    upc: "8901030890012", productWeight: 3.1,
    productLength: 32, productWidth: 22, productHeight: 10,
    packageType: "Pouch", packageTypeValue: "Laminated Stand-up Pouch",
    status: "active", linkedSellersCount: 48, createdAt: "2026-01-18", updatedAt: "2026-04-22",
  },
  // Parle-G
  {
    id: "PS-060", skuCode: "PARLG-001", name: "Parle-G Original Glucose Biscuits 800g",
    shortName: "Parle-G 800g", groupName: "Parle-G", brandId: "PARLG", companyId: "PARL", categoryId: "BISC",
    shortDescription: "World's best-selling glucose biscuit",
    longDescription: "Parle-G — India's most beloved biscuit for over 80 years. Wholesome, energising, and universally enjoyed.",
    image: "🍪", mrp: 60, hsnCode: "19053100", gstTax: "18%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Parle Products Pvt Ltd", packagingSize: "800", packagingUnit: "g",
    upc: "8901719120011", productWeight: 0.83,
    productLength: 28, productWidth: 18, productHeight: 8,
    packageType: "Pouch", packageTypeValue: "Laminated Pouch",
    status: "active", linkedSellersCount: 95, createdAt: "2026-01-02", updatedAt: "2026-05-01",
  },
  // Real Juice
  {
    id: "PS-070", skuCode: "RJUICE-001", name: "Dabur Real Mixed Fruit Juice 1L",
    shortName: "Real Mixed Fruit 1L", groupName: "Dabur Real Juice", brandId: "RJUICE", companyId: "DABUR", categoryId: "JUICE",
    shortDescription: "100% real fruit juice blend",
    longDescription: "Dabur Real — India's No.1 Fruit Juice brand. Made from real fruits with no added preservatives.",
    image: "🧃", mrp: 120, hsnCode: "20092900", gstTax: "12%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Dabur India Limited", packagingSize: "1", packagingUnit: "L",
    upc: "8901207095871", productWeight: 1.08,
    productLength: 20, productWidth: 8, productHeight: 8,
    packageType: "Tetra Pack", packageTypeValue: "Tetra Prisma",
    status: "active", linkedSellersCount: 38, createdAt: "2026-02-05", updatedAt: "2026-04-28",
  },
  // Amul
  {
    id: "PS-080", skuCode: "AMUL-001", name: "Amul Taaza Toned Milk 500ml",
    shortName: "Amul Taaza 500ml", groupName: "Amul Taaza", brandId: "AMUL", companyId: "AMUL", categoryId: "MILK",
    shortDescription: "Fresh toned milk, pasteurised and homogenised",
    longDescription: "Amul Taaza toned milk — pasteurised, homogenised, and packed in a hygienic tetra pack. Ready to drink.",
    image: "🥛", mrp: 30, hsnCode: "04011000", gstTax: "0%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Gujarat Co-operative Milk Marketing Federation", packagingSize: "500", packagingUnit: "ml",
    upc: "8906009000011", productWeight: 0.53,
    productLength: 15, productWidth: 8, productHeight: 6,
    packageType: "Tetra Pack", packageTypeValue: "Tetra Fino",
    status: "active", linkedSellersCount: 22, createdAt: "2026-03-01", updatedAt: "2026-05-05",
  },
  // Pending approval (new SKU created, waiting for admin)
  {
    id: "PS-090", skuCode: "BINGO-001", name: "Bingo! Mad Angles Achaari Masti 130g",
    shortName: "Bingo Mad Angles 130g", groupName: "Bingo Mad Angles", brandId: "BINGO", companyId: "ITC", categoryId: "SNCK",
    shortDescription: "Triangular rice snacks with tangy achaari flavor",
    longDescription: "Bingo! Mad Angles — crispy triangular rice snacks with the lip-smacking taste of aam ka achaar.",
    image: "🍟", mrp: 30, hsnCode: "19059090", gstTax: "12%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "ITC Limited", packagingSize: "130", packagingUnit: "g",
    productWeight: 0.13, status: "inactive", linkedSellersCount: 0, createdAt: "2026-05-20", updatedAt: "2026-05-20",
  },
  {
    id: "PS-091", skuCode: "GOOD-001", name: "Britannia Good Day Cashew Cookies 200g",
    shortName: "Good Day Cashew 200g", groupName: "Good Day", brandId: "BNGB", companyId: "BRIT", categoryId: "BISC",
    shortDescription: "Rich buttery cookies loaded with cashew",
    longDescription: "Britannia Good Day Cashew — rich, buttery cookies generously loaded with real cashew pieces.",
    image: "🍪", mrp: 50, hsnCode: "19053100", gstTax: "18%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "Britannia Industries Limited", packagingSize: "200", packagingUnit: "g",
    productWeight: 0.21, status: "inactive", linkedSellersCount: 0, createdAt: "2026-05-22", updatedAt: "2026-05-22",
  },
  // Inactive
  {
    id: "PS-095", skuCode: "YIPP-001", name: "Yippee! Magic Masala Long Noodles 70g",
    shortName: "Yippee Magic Masala 70g", groupName: "Yippee Magic Masala", brandId: "YIPP", companyId: "ITC", categoryId: "NOOD",
    shortDescription: "Long noodles with magic masala flavor",
    longDescription: "ITC Yippee! Magic Masala — long non-sticky noodles with a unique magic masala that doesn't clump.",
    image: "🍜", mrp: 15, hsnCode: "19023000", gstTax: "12%", gstCess: "0%", countryOfOrigin: "India",
    manufacturerName: "ITC Limited", packagingSize: "70", packagingUnit: "g",
    productWeight: 0.075, status: "inactive", linkedSellersCount: 12, createdAt: "2025-06-01", updatedAt: "2026-04-10",
  },
];

// ------------------------------------------------------------------
// Requests
// ------------------------------------------------------------------
export const psRequests: PSRequest[] = [
  // Create SKU requests — raised by sellers when SKU not in PS
  {
    id: "REQ-001", type: "create_sku", status: "submitted",
    skuName: "Horlicks Junior Vanilla 500g",
    brandId: "HUL", brandName: "Horlicks", companyName: "Hindustan Unilever",
    requestedBy: "Rajesh Kumar (ABC Distributors)", requestedByType: "seller",
    createdAt: "2026-05-30", updatedAt: "2026-05-30",
    notes: "This SKU is frequently requested by retailers. Please add to Product Store.",
    form: {
      itemName: "Horlicks Junior Vanilla 500g",
      shortName: "HORL-JR-VAN-500",
      groupName: "Horlicks Junior",
      brandId: "HUL",
      brandOther: "",
      brandAttribute: "Horlicks",
      shortDesc: "Nutritious health drink for kids, vanilla flavour, 500g",
      longDesc: "Horlicks Junior Vanilla is specifically formulated to support the growth and development needs of children. Made with milk solids, wheat flour, and enriched with 23 vital nutrients.",
      measureUnit: "Gram",
      measureValue: "500",
      weightMeasure: "Gram",
      skuWeight: "520",
      unitizedCount: "1",
      upc: "8901012512345",
      packageType: "Jar",
      packageTypeValue: "HDPE Jar",
      productLength: "10",
      productWidth: "10",
      productHeight: "15",
      categoryId: "Cereals and Breakfast",
      hsnCode: "19041090",
      countryOfOrigin: "India",
      gstTax: "5%",
      gstCess: "0%",
      manufacturerName: "Hindustan Unilever Limited",
      notes: "This SKU is frequently requested by retailers. Please add to Product Store.",
    },
  },
  {
    id: "REQ-002", type: "create_sku", status: "in_progress",
    skuName: "Boost Health Drink 500g",
    brandId: "HUL", brandName: "Boost", companyName: "Hindustan Unilever",
    requestedBy: "Priya Sharma (Sri Krupa Distributors)", requestedByType: "seller",
    createdAt: "2026-06-01", updatedAt: "2026-06-04",
    notes: "High demand product. SKU details available from company website.",
    form: {
      itemName: "Boost Health Drink 500g",
      shortName: "BOOST-500",
      groupName: "Boost Health Drink",
      brandId: "HUL",
      brandOther: "",
      brandAttribute: "Boost",
      shortDesc: "Energy and stamina booster health drink, 500g",
      longDesc: "Boost is a chocolate malt-based health food drink that provides energy to support physical stamina. Enriched with 14 vital nutrients, it helps build stamina for active kids.",
      measureUnit: "Gram",
      measureValue: "500",
      weightMeasure: "Gram",
      skuWeight: "510",
      unitizedCount: "1",
      upc: "8901234567890",
      packageType: "Jar",
      packageTypeValue: "HDPE Jar with Lid",
      productLength: "11",
      productWidth: "11",
      productHeight: "14",
      categoryId: "Cereals and Breakfast",
      hsnCode: "19041090",
      countryOfOrigin: "India",
      gstTax: "18%",
      gstCess: "0%",
      manufacturerName: "Hindustan Unilever Limited",
      notes: "High demand product. SKU details available from company website.",
    },
  },
  {
    id: "REQ-003", type: "create_sku", status: "submitted",
    skuName: "Bingo! Tedhe Medhe Masala 72g",
    brandId: "BINGO", brandName: "Bingo!", companyName: "ITC Limited",
    requestedBy: "Mohan Das (Freedom Distributors)", requestedByType: "seller",
    createdAt: "2026-06-03", updatedAt: "2026-06-03",
    form: {
      itemName: "Bingo! Tedhe Medhe Masala 72g",
      shortName: "BINGO-TM-72",
      groupName: "Bingo! Tedhe Medhe",
      brandId: "BINGO",
      brandOther: "",
      brandAttribute: "Bingo!",
      shortDesc: "Uniquely shaped masala flavoured corn snack, 72g",
      longDesc: "Bingo! Tedhe Medhe are fun-shaped, crunchy corn snacks loaded with tangy masala flavor. The unique twisted shape makes them irresistible.",
      measureUnit: "Gram",
      measureValue: "72",
      weightMeasure: "Gram",
      skuWeight: "72",
      unitizedCount: "1",
      upc: "8901596123456",
      packageType: "Pouch",
      packageTypeValue: "Laminated Pouch",
      productLength: "22",
      productWidth: "14",
      productHeight: "4",
      categoryId: "Snacks and Namkeen",
      hsnCode: "19042000",
      countryOfOrigin: "India",
      gstTax: "12%",
      gstCess: "0%",
      manufacturerName: "ITC Limited",
      notes: "",
    },
  },
  {
    id: "REQ-004", type: "create_sku", status: "approved",
    skuName: "Aashirvaad Multigrain Atta 5 kg",
    brandId: "AASH", brandName: "Aashirvaad", companyName: "ITC Limited",
    requestedBy: "Suresh Nair (First Klass Traders)", requestedByType: "seller",
    createdAt: "2026-04-20", updatedAt: "2026-04-25",
    skuId: "PS-003", skuCode: "AASH-003",
    form: {
      itemName: "Aashirvaad Multigrain Atta 5 kg",
      shortName: "AASH-MG-5K",
      groupName: "Aashirvaad Atta",
      brandId: "AASH",
      brandOther: "",
      brandAttribute: "Aashirvaad",
      shortDesc: "Multigrain atta with goodness of 6 grains, 5 kg",
      longDesc: "Aashirvaad Multigrain Atta is a blend of whole wheat and 5 other grains — soya, oat, maize, channa, and psyllium husk. Ideal for soft and nutritious rotis.",
      measureUnit: "Kilogram",
      measureValue: "5",
      weightMeasure: "Kilogram",
      skuWeight: "5.1",
      unitizedCount: "1",
      upc: "8901012001234",
      packageType: "Bag",
      packageTypeValue: "HDPE Woven Bag",
      productLength: "28",
      productWidth: "18",
      productHeight: "8",
      categoryId: "Atta, Flours and Sooji",
      hsnCode: "11010000",
      countryOfOrigin: "India",
      gstTax: "5%",
      gstCess: "0%",
      manufacturerName: "ITC Limited",
      notes: "",
    },
  },
  {
    id: "REQ-005", type: "create_sku", status: "rejected",
    skuName: "Some Unknown Brand Biscuits 100g",
    brandId: "PARL", brandName: "Unknown Brand", companyName: "Unknown Co",
    requestedBy: "Vikram Singh (New Trader)", requestedByType: "seller",
    createdAt: "2026-05-10", updatedAt: "2026-05-12",
    reason: "Brand not registered with Qwipo. Please ensure the brand is onboarded first.",
    form: {
      itemName: "Some Unknown Brand Biscuits 100g",
      shortName: "UNK-BISC-100",
      groupName: "Unknown Brand Biscuits",
      brandId: "",
      brandOther: "Unknown Brand Co",
      brandAttribute: "Unknown Brand",
      shortDesc: "Plain biscuits 100g",
      longDesc: "Generic biscuits from an unknown manufacturer.",
      measureUnit: "Gram",
      measureValue: "100",
      weightMeasure: "Gram",
      skuWeight: "100",
      unitizedCount: "1",
      upc: "",
      packageType: "Pouch",
      packageTypeValue: "Plastic Pouch",
      productLength: "",
      productWidth: "",
      productHeight: "",
      categoryId: "Chocolates and Biscuits",
      hsnCode: "19053199",
      countryOfOrigin: "India",
      gstTax: "12%",
      gstCess: "0%",
      manufacturerName: "Unknown Co",
      notes: "Requested by a new retailer.",
    },
  },
  // More ITC requests — visible to the ITC brand manager
  {
    id: "REQ-006", type: "create_sku", status: "submitted",
    skuName: "Sunfeast Mom's Magic Butter & Cashew 200g",
    brandId: "SUNF", brandName: "Sunfeast", companyName: "ITC Limited",
    requestedBy: "Deepak Rathi (Rathi Wholesale)", requestedByType: "seller",
    createdAt: "2026-06-18", updatedAt: "2026-06-18",
    notes: "Very popular SKU in our area, retailers ask for it frequently. Sunfeast Mom's Magic 200g variant is missing from the catalog.",
    form: {
      itemName: "Sunfeast Mom's Magic Butter & Cashew 200g",
      shortName: "SF-MM-BC-200",
      groupName: "Sunfeast Mom's Magic",
      brandId: "SUNF",
      brandOther: "",
      brandAttribute: "Sunfeast",
      shortDesc: "Rich butter and cashew biscuits, 200g",
      longDesc: "Sunfeast Mom's Magic Butter & Cashew biscuits are made with real butter and cashew pieces for a rich, indulgent taste. Perfect with tea or as a snack.",
      measureUnit: "Gram",
      measureValue: "200",
      weightMeasure: "Gram",
      skuWeight: "205",
      unitizedCount: "1",
      upc: "8901596200150",
      packageType: "Pack",
      packageTypeValue: "Flow Wrap",
      productLength: "20",
      productWidth: "10",
      productHeight: "4",
      categoryId: "Chocolates and Biscuits",
      hsnCode: "19053199",
      countryOfOrigin: "India",
      gstTax: "12%",
      gstCess: "0%",
      manufacturerName: "ITC Limited",
      notes: "Very popular SKU in our area.",
    },
  },
  {
    id: "REQ-007", type: "create_sku", status: "in_progress",
    skuName: "Yippee! Power Up Masala 80g",
    brandId: "YIPP", brandName: "Yippee!", companyName: "ITC Limited",
    requestedBy: "Anita Joshi (Joshi Enterprises)", requestedByType: "seller",
    createdAt: "2026-06-20", updatedAt: "2026-06-21",
    notes: "Yippee! Power Up Masala 80g pack is out of stock everywhere. Please add to catalog so we can order.",
    form: {
      itemName: "Yippee! Power Up Masala 80g",
      shortName: "YIPP-PU-MAS-80",
      groupName: "Yippee! Power Up",
      brandId: "YIPP",
      brandOther: "",
      brandAttribute: "Yippee!",
      shortDesc: "Power Up Masala instant noodles, 80g",
      longDesc: "Yippee! Power Up Masala noodles with a bold masala flavour. Long, smooth noodles that don't turn sticky even after 30 minutes.",
      measureUnit: "Gram",
      measureValue: "80",
      weightMeasure: "Gram",
      skuWeight: "82",
      unitizedCount: "1",
      upc: "8901596303045",
      packageType: "Pouch",
      packageTypeValue: "Laminated Pouch",
      productLength: "18",
      productWidth: "12",
      productHeight: "3",
      categoryId: "Pasta, Soup and Noodles",
      hsnCode: "19023010",
      countryOfOrigin: "India",
      gstTax: "12%",
      gstCess: "0%",
      manufacturerName: "ITC Limited",
      notes: "",
    },
  },
  {
    id: "REQ-008", type: "request_brand", status: "submitted",
    skuName: "—", brandId: "", brandName: "ITC Engage", companyName: "ITC Limited",
    requestedBy: "Karthik Venkat (Venkat Distributors)", requestedByType: "seller",
    createdAt: "2026-06-22", updatedAt: "2026-06-22",
    notes: "ITC Engage deodorants and body sprays are high demand in our territory. Please add Engage as a brand under ITC Limited in the Product Store.",
  },
  {
    id: "REQ-009", type: "create_sku", status: "approved",
    skuName: "Aashirvaad Svasti Pure Cow Ghee 1L",
    brandId: "AASH", brandName: "Aashirvaad", companyName: "ITC Limited",
    requestedBy: "Ramesh Gupta (Gupta Brothers)", requestedByType: "seller",
    createdAt: "2026-05-28", updatedAt: "2026-06-02",
    skuId: "PS-999", skuCode: "AASH-SVS-1L",
    form: {
      itemName: "Aashirvaad Svasti Pure Cow Ghee 1L",
      shortName: "AASH-SVS-GHE-1L",
      groupName: "Aashirvaad Svasti",
      brandId: "AASH",
      brandOther: "",
      brandAttribute: "Aashirvaad",
      shortDesc: "Pure cow ghee, slow-cooked for rich flavour, 1L",
      longDesc: "Aashirvaad Svasti Pure Cow Ghee is made from fresh cream sourced from Indian cows. Slow-cooked in traditional bilona method for authentic taste and aroma.",
      measureUnit: "Liter",
      measureValue: "1",
      weightMeasure: "Kilogram",
      skuWeight: "1.05",
      unitizedCount: "1",
      upc: "8901012991001",
      packageType: "Jar",
      packageTypeValue: "Glass Jar",
      productLength: "10",
      productWidth: "10",
      productHeight: "12",
      categoryId: "Edible Oils and Ghee",
      hsnCode: "04059010",
      countryOfOrigin: "India",
      gstTax: "5%",
      gstCess: "0%",
      manufacturerName: "ITC Limited",
      notes: "",
    },
  },
  // Request Company — sellers asking for a new company to be onboarded
  {
    id: "REQ-050", type: "request_company", status: "submitted",
    skuName: "—", brandId: "", brandName: "—", companyName: "Amul (GCMMF)",
    requestedBy: "Vikram Patel (Patel General Stores)", requestedByType: "seller",
    createdAt: "2026-06-16", updatedAt: "2026-06-16",
    notes: "Amul is our highest-demand brand — retailers ask for Amul butter, ghee, and milk powder almost daily. Requesting GCMMF (Gujarat Co-operative Milk Marketing Federation) to be onboarded along with brands like Amul Butter, Amul Ghee, and Amul Gold.",
  },
  {
    id: "REQ-051", type: "request_brand", status: "submitted",
    skuName: "—", brandId: "", brandName: "Cadbury Dairy Milk", companyName: "Mondelez India",
    requestedBy: "Sneha Nair (Nair Brothers Wholesale)", requestedByType: "seller",
    createdAt: "2026-06-16", updatedAt: "2026-06-16",
    notes: "Mondelez is in the Product Store but Cadbury Dairy Milk is missing as a brand. Retailers order CDM bars (Silk, Bubbly, Shots) in bulk — please add it under Mondelez India.",
  },
  {
    id: "REQ-030", type: "request_company", status: "submitted",
    skuName: "—", brandId: "", brandName: "—", companyName: "Haldiram's Snacks Pvt Ltd",
    requestedBy: "Ravi Gupta (Gupta Distributors)", requestedByType: "seller",
    createdAt: "2026-06-10", updatedAt: "2026-06-10",
    notes: "Haldiram's is one of the most requested brands by our retailers. Requesting onboarding of the company and its brands (Haldiram's Nagpur & Haldiram's Delhi) into the Product Store.",
  },
  {
    id: "REQ-031", type: "request_company", status: "rejected",
    skuName: "—", brandId: "", brandName: "—", companyName: "Mother Dairy Fruit & Vegetable Pvt Ltd",
    requestedBy: "Sandeep Rao (Sri Balaji Traders)", requestedByType: "seller",
    createdAt: "2026-05-18", updatedAt: "2026-05-22",
    reason: "Mother Dairy is already in the process of being onboarded. You will be notified once the company and brands are live.",
  },
  // Request Brand — sellers asking for a new brand under an existing company
  {
    id: "REQ-040", type: "request_brand", status: "submitted",
    skuName: "—", brandId: "", brandName: "Horlicks", companyName: "Hindustan Unilever",
    requestedBy: "Meena Iyer (Fast Track Distributors)", requestedByType: "seller",
    createdAt: "2026-06-12", updatedAt: "2026-06-12",
    notes: "Horlicks was recently acquired by HUL. Requesting the brand to be added under HUL in the Product Store so we can start importing SKUs.",
  },
  {
    id: "REQ-041", type: "request_brand", status: "approved",
    skuName: "—", brandId: "", brandName: "Boost", companyName: "Hindustan Unilever",
    requestedBy: "Priya Sharma (Sri Krupa Distributors)", requestedByType: "seller",
    createdAt: "2026-05-25", updatedAt: "2026-05-28",
    notes: "Boost is an HUL brand but not yet in the Product Store. High demand from retailers.",
  },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
export function getCompanyById(id: string): PSCompany | undefined {
  return psCompanies.find((c) => c.id === id);
}

export function getBrandById(id: string): PSBrand | undefined {
  return psBrands.find((b) => b.id === id);
}

export function getBrandsByCompany(companyId: string): PSBrand[] {
  return psBrands.filter((b) => b.companyId === companyId);
}

export function getSkusByBrand(brandId: string): PSSku[] {
  return psSkus.filter((s) => s.brandId === brandId);
}

export function getSkusByCompany(companyId: string): PSSku[] {
  return psSkus.filter((s) => s.companyId === companyId);
}

export function getActiveSkus(): PSSku[] {
  return psSkus.filter((s) => s.status === "active");
}

export function getCategoryById(id: string): PSCategory | undefined {
  return psCategories.find((c) => c.id === id);
}

export function getPendingRequests(): PSRequest[] {
  return psRequests.filter((r) => r.status === "submitted" || r.status === "in_progress");
}

export function getRequestsByType(type: PSRequestType): PSRequest[] {
  return psRequests.filter((r) => r.type === type);
}

let _nextReqId = 60;

export function addPsRequest(
  partial: Omit<PSRequest, "id" | "status" | "createdAt" | "updatedAt">
): PSRequest {
  const today = new Date().toISOString().split("T")[0];
  const req: PSRequest = {
    ...partial,
    id: `REQ-${String(_nextReqId++).padStart(3, "0")}`,
    status: "submitted",
    createdAt: today,
    updatedAt: today,
  };
  psRequests.unshift(req);
  return req;
}
