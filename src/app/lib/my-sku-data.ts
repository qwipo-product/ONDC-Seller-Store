// Shared SKU types and seed data — extracted here so that my-sku-store.ts
// and my-sku.tsx can both import without creating a circular dependency.

interface ONDCData {
  productName: string;
  mrp: string;
  hsnCode: string;
  countryOfOrigin: string;
  manufacturerName: string;
  manufacturerAddress: string;
  importerPackerName: string;
  importerPackerAddress: string;
  productLength: string;
  productWidth: string;
  productHeight: string;
  productWeight: string;
  returnPolicy: string;
  supportName: string;
  supportEmail: string;
  supportPhone: string;
}

export interface SKUData {
  id: string;
  name: string;
  category: string;
  brand: string;
  source: string;
  status: string;
  lastUpdated: string;
  sku: string;
  shortName?: string;
  productStoreId?: string;
  mrp?: number;
  sellingPrice?: number;
  availableStock?: number;
  isInfiniteStock?: boolean;
  thresholdLevel?: number;
  reservedStock?: number;
  ondcPrefilled?: Record<string, unknown>;
  tax?: { hsnCode?: string; gstTax?: string; gstCess?: string };
  ondcCompliance: {
    isCompliant: boolean;
    missingFields: string[];
    ondcData: Partial<ONDCData>;
  };
}

export const sampleSKUs: SKUData[] = [
  {
    id: "190000001",
    name: "Aashirvaad Whole Wheat Atta 10 kg",
    category: "Cooking and Baking Needs",
    brand: "Aashirvaad",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-25",
    sku: "190000001",
    shortName: "AASH-10K",
    mrp: 565,
    sellingPrice: 525,
    availableStock: 320,
    isInfiniteStock: false,
    thresholdLevel: 30,
    reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "180000005",
    name: "FREEDOM REF. SUNFLOWER OIL 15 KG. TIN",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-22",
    sku: "180000005",
    shortName: "FFR-15KG",
    mrp: 3091, sellingPrice: 2810, availableStock: 1, isInfiniteStock: false, thresholdLevel: 5, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "180000006",
    name: "FREEDOM REF. SUNFLOWER OIL 15 LTR. TIN",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-22",
    sku: "180000006",
    mrp: 2838, sellingPrice: 2580, availableStock: 252, isInfiniteStock: false, thresholdLevel: 20, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "180000008",
    name: "FREEDOM REF. SUNFLOWER OIL 1 LTR.X16NOS.",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-22",
    sku: "180000008",
    shortName: "FFR1",
    mrp: 188, sellingPrice: 171, availableStock: 642, isInfiniteStock: false, thresholdLevel: 50, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "180000076",
    name: "FREEDOM REF.SUNFLOWER OIL 1 LTR X 12PET",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-14",
    sku: "180000076",
    mrp: 191, sellingPrice: 174, availableStock: 27, isInfiniteStock: false, thresholdLevel: 10, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "180000179",
    name: "FREEDOM REF.SUNFLOWER OIL 2 LTR X 6 PET",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-08",
    sku: "180000179",
    mrp: 388, sellingPrice: 353, availableStock: 1, isInfiniteStock: false, thresholdLevel: 5, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "180000248",
    name: "FREEDOM FILTE. GROUNDNUT OIL 1 LTRX10NOS",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-03-20",
    sku: "180000248",
    mrp: 190, sellingPrice: 173, availableStock: 0, isInfiniteStock: false, thresholdLevel: 10, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "180000249",
    name: "FREEDOM REF.SUNFLOWEROIL 5LTRX4JARS-NEW",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-14",
    sku: "180000249",
    mrp: 963, sellingPrice: 875, availableStock: 138, isInfiniteStock: false, thresholdLevel: 20, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "180000260",
    name: "FREEDOM K.GHANI MUSTARD OIL 1LTRX12 PET",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-06",
    sku: "180000260",
    mrp: 194, sellingPrice: 176, availableStock: 12, isInfiniteStock: false, thresholdLevel: 5, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "180000377",
    name: "Sri Krupa 1Ltr X 12 Pet",
    category: "Edible Oil",
    brand: "Sri Krupa",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-03-20",
    sku: "180000377",
    mrp: 172, sellingPrice: 156, availableStock: 9, isInfiniteStock: false, thresholdLevel: 5, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "180000419",
    name: "FREEDOM FILTE. GROUNDNUT OIL 1 LTRX10NOS-OFFER",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-08",
    sku: "180000419",
    mrp: 190, sellingPrice: 173, availableStock: 28, isInfiniteStock: false, thresholdLevel: 10, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "180000437",
    name: "FREEDOM REF. RICE BRAN OIL 1 LTR.X16 NOS",
    category: "Edible Oil",
    brand: "Freedom",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-04-08",
    sku: "180000437",
    mrp: 179, sellingPrice: 163, availableStock: 50, isInfiniteStock: false, thresholdLevel: 10, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "180000490",
    name: "FIRST KLASS REF PALMOLEIN 750G X 15 NOS",
    category: "Edible Oil",
    brand: "First Klass",
    source: "DMS",
    status: "Active",
    lastUpdated: "2026-03-16",
    sku: "180000490",
    mrp: 129, sellingPrice: 117.4, availableStock: 19, isInfiniteStock: false, thresholdLevel: 10, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },

  // ITC — Aashirvaad
  {
    id: "190000002", name: "Aashirvaad Multigrain Atta 5 kg",
    category: "Atta, Flours and Sooji", brand: "Aashirvaad", source: "DMS",
    status: "Active", lastUpdated: "2026-04-25", sku: "190000002",
    mrp: 320, sellingPrice: 298, availableStock: 184, isInfiniteStock: false, thresholdLevel: 20, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "190000003", name: "Aashirvaad Salt 1 kg",
    category: "Salt, Sugar and Jaggery", brand: "Aashirvaad", source: "DMS",
    status: "Active", lastUpdated: "2026-04-24", sku: "190000003",
    mrp: 28, sellingPrice: 26, availableStock: 412, isInfiniteStock: false, thresholdLevel: 50, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "190000004", name: "Aashirvaad Turmeric Powder 200 g",
    category: "Masala & Seasoning", brand: "Aashirvaad", source: "DMS",
    status: "Active", lastUpdated: "2026-04-22", sku: "190000004",
    mrp: 105, sellingPrice: 96, availableStock: 0, isInfiniteStock: false, thresholdLevel: 30, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "190000005", name: "Aashirvaad Chilli Powder 200 g",
    category: "Masala & Seasoning", brand: "Aashirvaad", source: "DMS",
    status: "Active", lastUpdated: "2026-04-20", sku: "190000005",
    mrp: 135, sellingPrice: 124, availableStock: 78, isInfiniteStock: false, thresholdLevel: 20, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },

  // ITC — Sunfeast
  {
    id: "200000001", name: "Sunfeast Marie Light 200 g",
    category: "Chocolates and Biscuits", brand: "Sunfeast", source: "DMS",
    status: "Active", lastUpdated: "2026-04-18", sku: "200000001",
    mrp: 30, sellingPrice: 27, availableStock: 540, isInfiniteStock: false, thresholdLevel: 80, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "200000002", name: "Sunfeast Dark Fantasy Choco Fills 75 g",
    category: "Chocolates and Biscuits", brand: "Sunfeast", source: "DMS",
    status: "Active", lastUpdated: "2026-04-17", sku: "200000002",
    mrp: 50, sellingPrice: 45, availableStock: 320, isInfiniteStock: false, thresholdLevel: 60, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "200000003", name: "Sunfeast Mom's Magic Cashew & Almond 200 g",
    category: "Chocolates and Biscuits", brand: "Sunfeast", source: "DMS",
    status: "Active", lastUpdated: "2026-04-12", sku: "200000003",
    mrp: 55, sellingPrice: 50, availableStock: 210, isInfiniteStock: false, thresholdLevel: 40, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },

  // ITC — Bingo
  {
    id: "210000001", name: "Bingo Mad Angles Achaari Masti 80 g",
    category: "Snacks and Namkeen", brand: "Bingo", source: "DMS",
    status: "Active", lastUpdated: "2026-04-15", sku: "210000001",
    mrp: 30, sellingPrice: 27, availableStock: 480, isInfiniteStock: false, thresholdLevel: 80, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "210000002", name: "Bingo Tedhe Medhe Tomato Twist 80 g",
    category: "Snacks and Namkeen", brand: "Bingo", source: "DMS",
    status: "Inactive", lastUpdated: "2026-04-10", sku: "210000002",
    mrp: 30, sellingPrice: 27, availableStock: 12, isInfiniteStock: false, thresholdLevel: 80, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },

  // ITC — Yippee
  {
    id: "220000001", name: "Yippee Magic Masala Noodles 4-pack 280 g",
    category: "Pasta, Soup and Noodles", brand: "Yippee", source: "DMS",
    status: "Active", lastUpdated: "2026-04-19", sku: "220000001",
    mrp: 60, sellingPrice: 54, availableStock: 360, isInfiniteStock: false, thresholdLevel: 60, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "220000002", name: "Yippee Mood Masala Noodles 8-pack 560 g",
    category: "Pasta, Soup and Noodles", brand: "Yippee", source: "DMS",
    status: "Active", lastUpdated: "2026-04-14", sku: "220000002",
    mrp: 120, sellingPrice: 108, availableStock: 144, isInfiniteStock: false, thresholdLevel: 30, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },

  // Britannia
  {
    id: "230000001", name: "Britannia Marie Gold 250 g",
    category: "Chocolates and Biscuits", brand: "Britannia", source: "DMS",
    status: "Active", lastUpdated: "2026-04-23", sku: "230000001",
    mrp: 45, sellingPrice: 41, availableStock: 600, isInfiniteStock: false, thresholdLevel: 100, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "230000002", name: "Britannia Good Day Cashew 200 g",
    category: "Chocolates and Biscuits", brand: "Britannia", source: "DMS",
    status: "Active", lastUpdated: "2026-04-21", sku: "230000002",
    mrp: 50, sellingPrice: 46, availableStock: 320, isInfiniteStock: false, thresholdLevel: 80, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "230000003", name: "Britannia 50-50 Maska Chaska 100 g",
    category: "Chocolates and Biscuits", brand: "Britannia", source: "DMS",
    status: "Active", lastUpdated: "2026-04-16", sku: "230000003",
    mrp: 20, sellingPrice: 18, availableStock: 480, isInfiniteStock: false, thresholdLevel: 100, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "230000004", name: "Britannia NutriChoice Digestive 200 g",
    category: "Chocolates and Biscuits", brand: "Britannia", source: "DMS",
    status: "Active", lastUpdated: "2026-04-11", sku: "230000004",
    mrp: 60, sellingPrice: 55, availableStock: 240, isInfiniteStock: false, thresholdLevel: 50, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },

  // Nestle
  {
    id: "240000001", name: "Nestle Maggi 2-Minute Noodles 280 g (4-pack)",
    category: "Pasta, Soup and Noodles", brand: "Nestle", source: "DMS",
    status: "Active", lastUpdated: "2026-04-26", sku: "240000001",
    mrp: 64, sellingPrice: 58, availableStock: 800, isInfiniteStock: false, thresholdLevel: 120, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "240000002", name: "Nestle Maggi Hot & Sweet Tomato Sauce 1 kg",
    category: "Sauces, Spreads and Dips", brand: "Nestle", source: "DMS",
    status: "Active", lastUpdated: "2026-04-13", sku: "240000002",
    mrp: 175, sellingPrice: 160, availableStock: 95, isInfiniteStock: false, thresholdLevel: 30, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "240000003", name: "Nestle Kit Kat 4-Finger 38 g",
    category: "Chocolates and Biscuits", brand: "Nestle", source: "DMS",
    status: "Active", lastUpdated: "2026-04-09", sku: "240000003",
    mrp: 40, sellingPrice: 36, availableStock: 540, isInfiniteStock: false, thresholdLevel: 100, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "240000004", name: "Nestle Munch Chocolate 10 g (Pack of 30)",
    category: "Chocolates and Biscuits", brand: "Nestle", source: "DMS",
    status: "Active", lastUpdated: "2026-04-05", sku: "240000004",
    mrp: 150, sellingPrice: 138, availableStock: 60, isInfiniteStock: false, thresholdLevel: 20, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },

  // HUL
  {
    id: "250000001", name: "Surf Excel Easy Wash 1 kg",
    category: "Detergents and Dishwash", brand: "Surf Excel", source: "DMS",
    status: "Active", lastUpdated: "2026-04-27", sku: "250000001",
    mrp: 140, sellingPrice: 128, availableStock: 220, isInfiniteStock: false, thresholdLevel: 40, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "250000002", name: "Wheel Active 2-in-1 Lemon & Jasmine 4 kg",
    category: "Detergents and Dishwash", brand: "Wheel", source: "DMS",
    status: "Active", lastUpdated: "2026-04-24", sku: "250000002",
    mrp: 240, sellingPrice: 220, availableStock: 88, isInfiniteStock: false, thresholdLevel: 20, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "250000003", name: "Lifebuoy Total 10 Soap 100 g (Pack of 4)",
    category: "Beauty & Hygiene", brand: "Lifebuoy", source: "DMS",
    status: "Active", lastUpdated: "2026-04-19", sku: "250000003",
    mrp: 100, sellingPrice: 92, availableStock: 360, isInfiniteStock: false, thresholdLevel: 60, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "250000004", name: "Dove Cream Beauty Bar 100 g",
    category: "Beauty & Hygiene", brand: "Dove", source: "DMS",
    status: "Active", lastUpdated: "2026-04-16", sku: "250000004",
    mrp: 80, sellingPrice: 73, availableStock: 450, isInfiniteStock: false, thresholdLevel: 80, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "250000005", name: "Lux Soft Touch Soap 150 g (Pack of 3)",
    category: "Beauty & Hygiene", brand: "Lux", source: "DMS",
    status: "Inactive", lastUpdated: "2026-04-02", sku: "250000005",
    mrp: 90, sellingPrice: 82, availableStock: 26, isInfiniteStock: false, thresholdLevel: 40, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },

  // Tata Consumer Products
  {
    id: "260000001", name: "Tata Salt 1 kg",
    category: "Salt, Sugar and Jaggery", brand: "Tata", source: "DMS",
    status: "Active", lastUpdated: "2026-04-28", sku: "260000001",
    mrp: 28, sellingPrice: 26, availableStock: 800, isInfiniteStock: false, thresholdLevel: 100, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "260000002", name: "Tata Sampann Toor Dal Unpolished 1 kg",
    category: "Dals and Pulses", brand: "Tata Sampann", source: "DMS",
    status: "Active", lastUpdated: "2026-04-22", sku: "260000002",
    mrp: 180, sellingPrice: 165, availableStock: 250, isInfiniteStock: false, thresholdLevel: 40, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "260000003", name: "Tata Tea Premium 500 g",
    category: "Tea and Coffee", brand: "Tata Tea", source: "DMS",
    status: "Active", lastUpdated: "2026-04-18", sku: "260000003",
    mrp: 280, sellingPrice: 255, availableStock: 140, isInfiniteStock: false, thresholdLevel: 30, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "260000004", name: "Tata Tea Gold 250 g",
    category: "Tea and Coffee", brand: "Tata Tea", source: "DMS",
    status: "Active", lastUpdated: "2026-04-14", sku: "260000004",
    mrp: 175, sellingPrice: 160, availableStock: 0, isInfiniteStock: false, thresholdLevel: 20, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },

  // Marico
  {
    id: "270000001", name: "Saffola Gold Refined Oil 1 L",
    category: "Oil & Ghee", brand: "Saffola", source: "DMS",
    status: "Active", lastUpdated: "2026-04-26", sku: "270000001",
    mrp: 210, sellingPrice: 192, availableStock: 360, isInfiniteStock: false, thresholdLevel: 50, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "270000002", name: "Saffola Tasty Refined Oil 1 L",
    category: "Oil & Ghee", brand: "Saffola", source: "DMS",
    status: "Active", lastUpdated: "2026-04-23", sku: "270000002",
    mrp: 195, sellingPrice: 178, availableStock: 280, isInfiniteStock: false, thresholdLevel: 50, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "270000003", name: "Parachute Coconut Oil 200 ml",
    category: "Beauty & Hygiene", brand: "Parachute", source: "DMS",
    status: "Active", lastUpdated: "2026-04-20", sku: "270000003",
    mrp: 110, sellingPrice: 100, availableStock: 540, isInfiniteStock: false, thresholdLevel: 80, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "270000004", name: "Hair & Care Almond Hair Oil 100 ml",
    category: "Beauty & Hygiene", brand: "Hair & Care", source: "DMS",
    status: "Active", lastUpdated: "2026-04-12", sku: "270000004",
    mrp: 75, sellingPrice: 68, availableStock: 320, isInfiniteStock: false, thresholdLevel: 60, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },

  // Mondelez
  {
    id: "280000001", name: "Cadbury Dairy Milk Silk 60 g",
    category: "Chocolates and Biscuits", brand: "Cadbury", source: "DMS",
    status: "Active", lastUpdated: "2026-04-27", sku: "280000001",
    mrp: 85, sellingPrice: 78, availableStock: 720, isInfiniteStock: false, thresholdLevel: 120, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "280000002", name: "Cadbury 5 Star Chocolate 25 g (Pack of 12)",
    category: "Chocolates and Biscuits", brand: "Cadbury", source: "DMS",
    status: "Active", lastUpdated: "2026-04-21", sku: "280000002",
    mrp: 120, sellingPrice: 110, availableStock: 240, isInfiniteStock: false, thresholdLevel: 40, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "280000003", name: "Cadbury Bournvita Health Drink 500 g",
    category: "Beverages", brand: "Bournvita", source: "DMS",
    status: "Active", lastUpdated: "2026-04-15", sku: "280000003",
    mrp: 245, sellingPrice: 225, availableStock: 168, isInfiniteStock: false, thresholdLevel: 30, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },

  // P&G
  {
    id: "290000001", name: "Tide Plus Extra Power 1 kg",
    category: "Detergents and Dishwash", brand: "Tide", source: "DMS",
    status: "Active", lastUpdated: "2026-04-25", sku: "290000001",
    mrp: 145, sellingPrice: 132, availableStock: 280, isInfiniteStock: false, thresholdLevel: 50, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "290000002", name: "Ariel Matic Front Load Detergent 1 kg",
    category: "Detergents and Dishwash", brand: "Ariel", source: "DMS",
    status: "Active", lastUpdated: "2026-04-22", sku: "290000002",
    mrp: 235, sellingPrice: 215, availableStock: 160, isInfiniteStock: false, thresholdLevel: 30, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "290000003", name: "Pantene Pro-V Total Damage Care Shampoo 180 ml",
    category: "Beauty & Hygiene", brand: "Pantene", source: "DMS",
    status: "Active", lastUpdated: "2026-04-17", sku: "290000003",
    mrp: 165, sellingPrice: 150, availableStock: 220, isInfiniteStock: false, thresholdLevel: 40, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "290000004", name: "Whisper Ultra Choice 7-pack XL",
    category: "Beauty & Hygiene", brand: "Whisper", source: "DMS",
    status: "Active", lastUpdated: "2026-04-13", sku: "290000004",
    mrp: 145, sellingPrice: 132, availableStock: 390, isInfiniteStock: false, thresholdLevel: 60, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },

  // Beverage majors
  {
    id: "300000001", name: "Coca-Cola PET 600 ml (Case of 24)",
    category: "Beverages", brand: "Coca-Cola", source: "DMS",
    status: "Active", lastUpdated: "2026-04-28", sku: "300000001",
    mrp: 960, sellingPrice: 880, availableStock: 64, isInfiniteStock: false, thresholdLevel: 15, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "300000002", name: "Pepsi PET 600 ml (Case of 24)",
    category: "Beverages", brand: "Pepsi", source: "DMS",
    status: "Active", lastUpdated: "2026-04-26", sku: "300000002",
    mrp: 960, sellingPrice: 880, availableStock: 56, isInfiniteStock: false, thresholdLevel: 15, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "300000003", name: "Sprite PET 600 ml (Case of 24)",
    category: "Beverages", brand: "Sprite", source: "DMS",
    status: "Active", lastUpdated: "2026-04-24", sku: "300000003",
    mrp: 960, sellingPrice: 880, availableStock: 48, isInfiniteStock: false, thresholdLevel: 15, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "300000004", name: "Thumbs Up PET 600 ml (Case of 24)",
    category: "Beverages", brand: "Thumbs Up", source: "DMS",
    status: "Active", lastUpdated: "2026-04-19", sku: "300000004",
    mrp: 960, sellingPrice: 880, availableStock: 40, isInfiniteStock: false, thresholdLevel: 15, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },

  // Dairy & breakfast
  {
    id: "310000001", name: "Amul Toned Milk 1 L (Case of 12)",
    category: "Dairy and Cheese", brand: "Amul", source: "DMS",
    status: "Active", lastUpdated: "2026-04-27", sku: "310000001",
    mrp: 720, sellingPrice: 660, availableStock: 35, isInfiniteStock: false, thresholdLevel: 10, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "310000002", name: "Mother Dairy Paneer 200 g",
    category: "Dairy and Cheese", brand: "Mother Dairy", source: "DMS",
    status: "Active", lastUpdated: "2026-04-25", sku: "310000002",
    mrp: 95, sellingPrice: 86, availableStock: 168, isInfiniteStock: false, thresholdLevel: 30, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
  {
    id: "310000003", name: "Amul Butter 500 g",
    category: "Dairy and Cheese", brand: "Amul", source: "DMS",
    status: "Active", lastUpdated: "2026-04-22", sku: "310000003",
    mrp: 285, sellingPrice: 262, availableStock: 144, isInfiniteStock: false, thresholdLevel: 25, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "310000004", name: "Kellogg's Corn Flakes Original 475 g",
    category: "Cereals and Breakfast", brand: "Kellogg's", source: "DMS",
    status: "Active", lastUpdated: "2026-04-18", sku: "310000004",
    mrp: 235, sellingPrice: 215, availableStock: 120, isInfiniteStock: false, thresholdLevel: 25, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "310000005", name: "Bagrry's White Oats 1 kg",
    category: "Cereals and Breakfast", brand: "Bagrry's", source: "DMS",
    status: "Active", lastUpdated: "2026-04-14", sku: "310000005",
    mrp: 280, sellingPrice: 255, availableStock: 88, isInfiniteStock: false, thresholdLevel: 20, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },

  // Pet care
  {
    id: "320000001", name: "Pedigree Chicken & Vegetables 1.2 kg",
    category: "Pet Care", brand: "Pedigree", source: "DMS",
    status: "Active", lastUpdated: "2026-04-15", sku: "320000001",
    mrp: 460, sellingPrice: 420, availableStock: 56, isInfiniteStock: false, thresholdLevel: 12, reservedStock: 0,
    ondcCompliance: { isCompliant: true, missingFields: [], ondcData: {} },
  },
  {
    id: "320000002", name: "Whiskas Cat Food Tuna 480 g",
    category: "Pet Care", brand: "Whiskas", source: "DMS",
    status: "Active", lastUpdated: "2026-04-08", sku: "320000002",
    mrp: 320, sellingPrice: 295, availableStock: 32, isInfiniteStock: false, thresholdLevel: 10, reservedStock: 0,
    ondcCompliance: { isCompliant: false, missingFields: ["Short Description", "Long Description", "Measure Unit", "SKU Weight", "Min Order Qty", "Max Order Qty", "Category ID", "Fulfillment ID", "Location ID", "Time to Ship", "Consumer Care Contact", "Country of Origin", "Brand Attribute"], ondcData: {} },
  },
];
