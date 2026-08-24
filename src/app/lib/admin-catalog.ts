/**
 * Super-admin catalog data: Companies (with brands), and ONDC Categories.
 *
 * This module is the single source of truth used by:
 *  - Admin → Companies & Brands (CRUD with image uploads)
 *  - Admin → Categories (image uploads against the ONDC taxonomy)
 *  - Admin → Add Seller (lets the admin pick which companies/brands the
 *    seller works with)
 */

import { PROD_REPLICA_COMPANIES } from "./prod-replica-companies-seed";

// Pre-baked category cover images. Vite turns these into hashed URLs at
// build time so the admin sees real artwork on the Category Master page
// without anyone having to upload them. All 37 ONDC eB2B categories ship
// with a cover image.
import imgAttaFloursAndSooji from "../../imports/categories/Atta, Flours and Sooji.png";
import imgBabyCare from "../../imports/categories/Baby Care.png";
import imgBakeryCakesDairy from "../../imports/categories/Bakery, Cakes & Dairy.png";
import imgBeautyHygiene from "../../imports/categories/Beauty & Hygiene.png";
import imgBeverages from "../../imports/categories/Beverages.png";
import imgCerealsAndBreakfast from "../../imports/categories/Cereals and Breakfast.png";
import imgChocolatesAndBiscuits from "../../imports/categories/Chocolates and Biscuits.png";
import imgCookingAndBakingNeeds from "../../imports/categories/Cooking and Baking Needs.png";
import imgDairyAndCheese from "../../imports/categories/Dairy and Cheese.png";
import imgDalsAndPulses from "../../imports/categories/Dals and Pulses.png";
import imgDetergentsAndDishwash from "../../imports/categories/Detergents and Dishwash.png";
import imgEggsMeatFish from "../../imports/categories/Eggs, Meat & Fish.png";
import imgEnergyAndSoftDrinks from "../../imports/categories/Energy and Soft Drinks.png";
import imgFoodgrains from "../../imports/categories/Foodgrains.png";
import imgFrozenSnacks from "../../imports/categories/Frozen Snacks.png";
import imgFrozenVegetables from "../../imports/categories/Frozen Vegetables.png";
import imgFruitJuicesAndFruitDrinks from "../../imports/categories/Fruit Juices and Fruit Drinks.png";
import imgFruitsAndVegetables from "../../imports/categories/Fruits and Vegetables.png";
import imgGiftVoucher from "../../imports/categories/Gift Voucher.png";
import imgGourmetWorldFoods from "../../imports/categories/Gourmet & World Foods.png";
import imgIndianSweets from "../../imports/categories/Indian Sweets.png";
import imgKitchenAccessories from "../../imports/categories/Kitchen Accessories.png";
import imgMasalaSeasoning from "../../imports/categories/Masala & Seasoning.png";
import imgOilGhee from "../../imports/categories/Oil & Ghee.png";
import imgPastaSoupAndNoodles from "../../imports/categories/Pasta, Soup and Noodles.png";
import imgPetCare from "../../imports/categories/Pet Care.png";
import imgPicklesAndChutney from "../../imports/categories/Pickles and Chutney.png";
import imgReadyToCookAndEat from "../../imports/categories/Ready to Cook and Eat.png";
import imgRiceAndRiceProducts from "../../imports/categories/Rice and Rice Products.png";
import imgSaltSugarAndJaggery from "../../imports/categories/Salt, Sugar and Jaggery.png";
import imgSaucesSpreadsAndDips from "../../imports/categories/Sauces, Spreads and Dips.png";
import imgSnacksBrandedFoods from "../../imports/categories/Snacks & Branded Foods.png";
import imgSnacksAndNamkeen from "../../imports/categories/Snacks and Namkeen.png";
import imgSnacksDryFruitsNuts from "../../imports/categories/Snacks, Dry Fruits, Nuts.png";
import imgTeaAndCoffee from "../../imports/categories/Tea and Coffee.png";
import imgTinnedAndProcessedFood from "../../imports/categories/Tinned and Processed Food.png";
import imgWater from "../../imports/categories/Water.png";

/**
 * Map of ONDC category-name → cover image. Keys must match ONDC_CATEGORY_NAMES
 * verbatim — all 37 entries are covered, so no fallback to the upload
 * placeholder is currently needed.
 */
const CATEGORY_IMAGES: Record<string, string> = {
  "Atta, Flours and Sooji": imgAttaFloursAndSooji,
  "Baby Care": imgBabyCare,
  "Bakery, Cakes & Dairy": imgBakeryCakesDairy,
  "Beauty & Hygiene": imgBeautyHygiene,
  "Beverages": imgBeverages,
  "Cereals and Breakfast": imgCerealsAndBreakfast,
  "Chocolates and Biscuits": imgChocolatesAndBiscuits,
  "Cooking and Baking Needs": imgCookingAndBakingNeeds,
  "Dairy and Cheese": imgDairyAndCheese,
  "Dals and Pulses": imgDalsAndPulses,
  "Detergents and Dishwash": imgDetergentsAndDishwash,
  "Eggs, Meat & Fish": imgEggsMeatFish,
  "Energy and Soft Drinks": imgEnergyAndSoftDrinks,
  "Foodgrains": imgFoodgrains,
  "Frozen Snacks": imgFrozenSnacks,
  "Frozen Vegetables": imgFrozenVegetables,
  "Fruit Juices and Fruit Drinks": imgFruitJuicesAndFruitDrinks,
  "Fruits and Vegetables": imgFruitsAndVegetables,
  "Gift Voucher": imgGiftVoucher,
  "Gourmet & World Foods": imgGourmetWorldFoods,
  "Indian Sweets": imgIndianSweets,
  "Kitchen Accessories": imgKitchenAccessories,
  "Masala & Seasoning": imgMasalaSeasoning,
  "Oil & Ghee": imgOilGhee,
  "Pasta, Soup and Noodles": imgPastaSoupAndNoodles,
  "Pet Care": imgPetCare,
  "Pickles and Chutney": imgPicklesAndChutney,
  "Ready to Cook and Eat": imgReadyToCookAndEat,
  "Rice and Rice Products": imgRiceAndRiceProducts,
  "Salt, Sugar and Jaggery": imgSaltSugarAndJaggery,
  "Sauces, Spreads and Dips": imgSaucesSpreadsAndDips,
  "Snacks & Branded Foods": imgSnacksBrandedFoods,
  "Snacks and Namkeen": imgSnacksAndNamkeen,
  "Snacks, Dry Fruits, Nuts": imgSnacksDryFruitsNuts,
  "Tea and Coffee": imgTeaAndCoffee,
  "Tinned and Processed Food": imgTinnedAndProcessedFood,
  "Water": imgWater,
};

export interface Brand {
  id: string;
  name: string;
  /** blob: or http(s): URL — null when no image is uploaded yet */
  imageUrl: string | null;
}

export interface Company {
  id: string;
  name: string;
  imageUrl: string | null;
  brands: Brand[];
  /**
   * Per-company copy of the 37 ONDC categories. Each company gets its own
   * dedicated category images so the storefront can show brand-specific
   * tiles (e.g. ITC's "Atta, Flours and Sooji" tile differs from Adani's).
   * Auto-seeded with all 37 ONDC category names (imageUrl=null) on create.
   */
  categories: AdminCategory[];
  /**
   * Whether this company is active (available to be assigned to sellers and
   * shown in seller-side pickers). Defaults to `true`. Inactive companies
   * remain in the catalog (can't be deleted because multiple sellers may
   * already reference them) but are hidden from new assignments.
   */
  isActive?: boolean;
  /**
   * Which image represents this company where a single logo is shown:
   * "company" → the uploaded company logo, "brand" → the brand images.
   * Defaults to "company" when unset (legacy records).
   */
  logoPreference?: "company" | "brand";
}

export interface AdminCategory {
  /** Category name from the ONDC eB2B taxonomy. Acts as the unique key. */
  name: string;
  imageUrl: string | null;
}

// 37-entry ONDC eB2B category taxonomy (must match CATEGORY_OPTIONS in sku-detail.tsx)
export const ONDC_CATEGORY_NAMES: string[] = [
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

/** Build a fresh, image-less copy of the 37 ONDC categories — used as the
 *  starting set when a new company is created. */
export function makeCompanyCategorySeed(): AdminCategory[] {
  return ONDC_CATEGORY_NAMES.map((name) => ({ name, imageUrl: null }));
}

// Seed companies — the first entries match the brands appearing on the
// seller-side SKU list (ids referenced elsewhere, so they keep their old
// ids but carry the exact production company names). The production
// company catalog captured on 2026-07-24 is appended from the generated
// prod-replica-companies-seed.ts module below.
export const seedCompanies: Company[] = [
  {
    id: "co-adani",
    name: "Adani Wilmar Limited",
    imageUrl: null,
    isActive: true,
    brands: [
      { id: "br-fortune", name: "Fortune", imageUrl: null },
      { id: "br-kohinoor", name: "Kohinoor", imageUrl: null },
    ],
    categories: makeCompanyCategorySeed(),
  },
  {
    id: "co-freedom",
    name: "Gemini Edibles & Fats India Private Limited",
    imageUrl: null,
    isActive: true,
    brands: [
      { id: "br-freedom", name: "Freedom", imageUrl: null },
      { id: "br-firstklass", name: "First Klass", imageUrl: null },
    ],
    categories: makeCompanyCategorySeed(),
  },
  // Demo-only company (not in the production catalog) — kept for SKU
  // references but hidden from new assignments.
  {
    id: "co-srikrupa",
    name: "Sri Krupa Industries",
    imageUrl: null,
    isActive: false,
    brands: [{ id: "br-srikrupa", name: "Sri Krupa", imageUrl: null }],
    categories: makeCompanyCategorySeed(),
  },
  {
    id: "co-itc",
    name: "ITC Limited",
    imageUrl: null,
    isActive: true,
    brands: [
      { id: "br-aashirvaad", name: "Aashirvaad", imageUrl: null },
      { id: "br-sunfeast", name: "Sunfeast", imageUrl: null },
      { id: "br-bingo", name: "Bingo", imageUrl: null },
      { id: "br-yippee", name: "Yippee", imageUrl: null },
      { id: "br-classmate", name: "Classmate", imageUrl: null },
    ],
    categories: makeCompanyCategorySeed(),
  },
  // Demo-only stand-in from the July 2026 Mahadev beat upload. The
  // production replica now carries the real companies (Karkhana Zinda
  // Tilismath LLP, Orkla India) — kept for old references but hidden.
  {
    id: "co-mahadev-allbrands",
    name: "Mahadev All Brands",
    imageUrl: null,
    isActive: false,
    brands: [
      { id: "br-mtr", name: "MTR", imageUrl: null },
      { id: "br-eastern", name: "Eastern", imageUrl: null },
      { id: "br-zinda", name: "Zinda", imageUrl: null },
    ],
    categories: makeCompanyCategorySeed(),
  },
  // Production company catalog (2026-07-24) — every company referenced
  // by a replicated production delivery beat.
  ...PROD_REPLICA_COMPANIES.map(
    (c): Company => ({
      id: c.id,
      name: c.name,
      imageUrl: null,
      isActive: true,
      brands: [],
      categories: makeCompanyCategorySeed(),
    }),
  ),
];

/** Tiny in-memory store. In a real app this would live behind an API. */
let companies: Company[] = seedCompanies;
let categories: AdminCategory[] = ONDC_CATEGORY_NAMES.map((name) => ({
  name,
  imageUrl: null,
}));

const companyListeners = new Set<() => void>();
const categoryListeners = new Set<() => void>();

export function getCompanies(): Company[] {
  return companies;
}

export function setCompanies(next: Company[]) {
  companies = next;
  companyListeners.forEach((fn) => fn());
}

export function subscribeToCompanies(fn: () => void): () => void {
  companyListeners.add(fn);
  return () => {
    companyListeners.delete(fn);
  };
}

export function getCategories(): AdminCategory[] {
  return categories;
}

export function setCategories(next: AdminCategory[]) {
  categories = next;
  categoryListeners.forEach((fn) => fn());
}

export function subscribeToCategories(fn: () => void): () => void {
  categoryListeners.add(fn);
  return () => {
    categoryListeners.delete(fn);
  };
}

// ============================================================================
// Category Master — hierarchical taxonomy (root + subcategories).
//
// The 37 ONDC categories are pre-seeded as roots (parentId = null). The super
// admin can add brand-new root categories and subcategories under any node.
// Categories are immutable once created — the UI surfaces no Edit / Delete
// affordances.
// ============================================================================

export interface MasterCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  /** null for top-level (root) categories. */
  parentId: string | null;
}

const masterCategoryListeners = new Set<() => void>();

/**
 * Build the initial Master Category seed: the 37 ONDC categories with
 * their cover images injected from `CATEGORY_IMAGES` where one exists.
 * Used by both the initial in-memory state and the
 * `applyDataMode("demo")` reset.
 */
function buildMasterCategorySeed(): MasterCategory[] {
  return ONDC_CATEGORY_NAMES.map((name) => ({
    id: makeId("cat"),
    name,
    imageUrl: CATEGORY_IMAGES[name] ?? null,
    parentId: null,
  }));
}

let masterCategories: MasterCategory[] = buildMasterCategorySeed();

export function getMasterCategories(): MasterCategory[] {
  return masterCategories;
}

export function setMasterCategories(next: MasterCategory[]) {
  masterCategories = next;
  masterCategoryListeners.forEach((fn) => fn());
}

export function subscribeToMasterCategories(fn: () => void): () => void {
  masterCategoryListeners.add(fn);
  return () => {
    masterCategoryListeners.delete(fn);
  };
}

/** Add a new category. Pass `parentId` = null for a root category, or the
 *  id of an existing category to nest under it. */
export function addMasterCategory(input: {
  name: string;
  imageUrl: string | null;
  parentId: string | null;
}): MasterCategory {
  const cat: MasterCategory = {
    id: makeId("cat"),
    name: input.name,
    imageUrl: input.imageUrl,
    parentId: input.parentId,
  };
  setMasterCategories([...masterCategories, cat]);
  return cat;
}

/**
 * Update the cover image on an existing master category. Pass `null` to
 * clear it (the card falls back to the upload placeholder). Used by the
 * Category Master page when the admin clicks an image tile to upload a
 * new cover. The previous image's blob URL (if any) is revoked so we
 * don't leak.
 */
export function setMasterCategoryImage(id: string, imageUrl: string | null) {
  const target = masterCategories.find((c) => c.id === id);
  if (!target) return;
  if (target.imageUrl !== imageUrl) {
    revokeImage(target.imageUrl);
  }
  setMasterCategories(
    masterCategories.map((c) => (c.id === id ? { ...c, imageUrl } : c)),
  );
}

/**
 * Toggle (or set) a company's active status. Companies are never deleted
 * because they may be referenced by sellers — flipping `isActive` to `false`
 * is the way to retire one.
 */
export function setCompanyActive(companyId: string, isActive: boolean) {
  setCompanies(
    companies.map((c) => (c.id === companyId ? { ...c, isActive } : c)),
  );
}

/** Build a stable id when we add a new company/brand at runtime. */
export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Free up object URLs we created for previews. */
export function revokeImage(url: string | null) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

/**
 * Switch the in-memory master data between the demo seed and an empty state.
 * Used by the second super-admin login (empty mode) to demo inception-day
 * empty screens.
 */
export function applyDataMode(mode: "demo" | "empty") {
  if (mode === "empty") {
    setCompanies([]);
    setCategories([]);
    setMasterCategories([]);
  } else {
    setCompanies(seedCompanies);
    setCategories(ONDC_CATEGORY_NAMES.map((name) => ({ name, imageUrl: null })));
    setMasterCategories(buildMasterCategorySeed());
  }
}
