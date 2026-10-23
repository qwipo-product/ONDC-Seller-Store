/**
 * Module-level store for seller's "Request a SKU" submissions.
 * Persists for the session; re-read on every page mount.
 */

export type RequestStatus = "submitted" | "in_progress" | "approved" | "rejected";
export type RequestType = "sku" | "company" | "brand";

export interface SkuRequestForm {
  itemName: string;
  shortName: string;
  groupName: string;
  brandId: string;
  brandOther: string;
  brandAttribute: string;
  shortDesc: string;
  longDesc: string;
  measureUnit: string;
  measureValue: string;
  weightMeasure: string;
  skuWeight: string;
  unitizedCount: string;
  upc: string;
  packageType: string;
  packageTypeValue: string;
  productLength: string;
  productWidth: string;
  productHeight: string;
  categoryId: string;
  hsnCode: string;
  countryOfOrigin: string;
  gstTax: string;
  gstCess: string;
  manufacturerName: string;
  notes: string;
}

export interface SkuRequest {
  id: string;
  submittedAt: string; // ISO date string
  status: RequestStatus;
  requestType: RequestType;
  rejectionReason?: string;
  form: SkuRequestForm;
}

let _requests: SkuRequest[] = [
  {
    id: "REQ-001",
    submittedAt: "2026-05-20",
    status: "approved",
    requestType: "sku",
    form: {
      itemName: "Horlicks Junior Vanilla 500g",
      shortName: "HORL-JR-500",
      groupName: "Horlicks Junior",
      brandId: "",
      brandOther: "GSK Consumer / HUL",
      brandAttribute: "Horlicks",
      shortDesc: "Junior health drink in vanilla flavour, 500g pack",
      longDesc: "Horlicks Junior is a scientifically formulated health drink for children aged 3–9 years, with 23 essential nutrients to support growth.",
      measureUnit: "Gram",
      measureValue: "500",
      weightMeasure: "Gram",
      skuWeight: "540",
      unitizedCount: "1",
      upc: "8901030773816",
      packageType: "Jar",
      packageTypeValue: "Plastic Jar",
      productLength: "",
      productWidth: "",
      productHeight: "",
      categoryId: "Cereals and Breakfast",
      hsnCode: "19041090",
      countryOfOrigin: "India",
      gstTax: "18%",
      gstCess: "0%",
      manufacturerName: "Hindustan Unilever Ltd",
      notes: "High demand from school retail outlets in NCR, please prioritise.",
    },
  },
  {
    id: "REQ-002",
    submittedAt: "2026-05-28",
    status: "submitted",
    requestType: "sku",
    form: {
      itemName: "Maggi Masala Noodles 12-pack",
      shortName: "MAGGI-12PK",
      groupName: "Maggi 2-Minute Noodles",
      brandId: "",
      brandOther: "Nestlé",
      brandAttribute: "Maggi",
      shortDesc: "Classic Maggi Masala noodles, carton of 12 × 70g",
      longDesc: "Maggi Masala 2-Minute Noodles — India's favourite instant noodle in a multipack carton. Each carton contains 12 packs of 70g.",
      measureUnit: "Gram",
      measureValue: "840",
      weightMeasure: "Gram",
      skuWeight: "900",
      unitizedCount: "12",
      upc: "",
      packageType: "Carton",
      packageTypeValue: "Corrugated Box",
      productLength: "22",
      productWidth: "14",
      productHeight: "10",
      categoryId: "Pasta, Soup and Noodles",
      hsnCode: "19023010",
      countryOfOrigin: "India",
      gstTax: "12%",
      gstCess: "0%",
      manufacturerName: "Nestlé India Ltd",
      notes: "Retailers are asking for carton-level units. Current individual packs don't suit bulk orders.",
    },
  },
  {
    id: "REQ-003",
    submittedAt: "2026-06-02",
    status: "rejected",
    requestType: "sku",
    rejectionReason: "SKU already exists in the catalog as BISC-023. Please use the existing listing.",
    form: {
      itemName: "Oreo Original Cream Biscuits 120g",
      shortName: "OREO-120",
      groupName: "Oreo Original",
      brandId: "",
      brandOther: "Mondelez",
      brandAttribute: "Oreo",
      shortDesc: "Classic Oreo sandwich biscuits, 120g pack",
      longDesc: "Original Oreo biscuits — chocolate wafers with a sweet cream centre, the world's favourite biscuit.",
      measureUnit: "Gram",
      measureValue: "120",
      weightMeasure: "Gram",
      skuWeight: "130",
      unitizedCount: "1",
      upc: "",
      packageType: "Pouch",
      packageTypeValue: "Laminated Pouch",
      productLength: "",
      productWidth: "",
      productHeight: "",
      categoryId: "Chocolates and Biscuits",
      hsnCode: "19053100",
      countryOfOrigin: "India",
      gstTax: "18%",
      gstCess: "0%",
      manufacturerName: "Mondelez India Foods Pvt Ltd",
      notes: "",
    },
  },
  {
    id: "REQ-004",
    submittedAt: "2026-06-08",
    status: "in_progress",
    requestType: "company",
    form: {
      itemName: "Pristine Agro Pvt Ltd",
      shortName: "",
      groupName: "",
      brandId: "",
      brandOther: "",
      brandAttribute: "",
      shortDesc: "Regional spices and dry-goods manufacturer from Rajasthan",
      longDesc: "",
      measureUnit: "",
      measureValue: "",
      weightMeasure: "",
      skuWeight: "",
      unitizedCount: "",
      upc: "",
      packageType: "",
      packageTypeValue: "",
      productLength: "",
      productWidth: "",
      productHeight: "",
      categoryId: "Spices and Condiments",
      hsnCode: "",
      countryOfOrigin: "India",
      gstTax: "",
      gstCess: "",
      manufacturerName: "",
      notes: "Multiple retailers in Rajasthan are asking for their products. Company is FSSAI-registered but not yet in Qwipo's vendor list.",
    },
  },
  {
    id: "REQ-005",
    submittedAt: "2026-06-14",
    status: "submitted",
    requestType: "brand",
    form: {
      itemName: "Farmley",
      shortName: "",
      groupName: "",
      brandId: "",
      brandOther: "Agri10x Foodtech Pvt Ltd",
      brandAttribute: "Farmley",
      shortDesc: "Premium dry fruits and nuts brand",
      longDesc: "",
      measureUnit: "",
      measureValue: "",
      weightMeasure: "",
      skuWeight: "",
      unitizedCount: "",
      upc: "",
      packageType: "",
      packageTypeValue: "",
      productLength: "",
      productWidth: "",
      productHeight: "",
      categoryId: "Dry Fruits and Nuts",
      hsnCode: "",
      countryOfOrigin: "India",
      gstTax: "",
      gstCess: "",
      manufacturerName: "Agri10x Foodtech Pvt Ltd",
      notes: "Growing D2C brand now available for B2B wholesale. Sellers in Delhi and Mumbai have specifically asked for this brand.",
    },
  },
];

let _nextId = 6;

export function getSkuRequests(): SkuRequest[] {
  return [..._requests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function addSkuRequest(form: SkuRequestForm, requestType: RequestType = "sku"): SkuRequest {
  const req: SkuRequest = {
    id: `REQ-${String(_nextId++).padStart(3, "0")}`,
    submittedAt: new Date().toISOString().split("T")[0],
    status: "submitted",
    requestType,
    form,
  };
  _requests = [req, ..._requests];
  return req;
}
