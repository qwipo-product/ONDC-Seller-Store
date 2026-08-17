// Generates the local prod-replica seed modules from
// Production Polygons/replica-inventory.json + sellers-manifest.json:
//   src/app/lib/prod-replica-sellers-seed.ts   (31 sellers, real names/phones)
//   src/app/lib/prod-replica-companies-seed.ts (production companies from beats)
//   src/app/lib/prod-replica-beats-seed.ts     (869 beats with polygons)
const fs = require('fs');
const path = require('path');

const inv = JSON.parse(fs.readFileSync('Production Polygons/replica-inventory.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('Production Polygons/sellers-manifest.json', 'utf8'));

// ---- seller id map: production business name -> local seed id + profile ----
// Profile fields for the 20 pre-existing local prod sellers come from the
// current SEED_SELLERS in mock-store.ts (already copied from the portal).
// The 5 new sellers' fields were read from the portal profile pages.
const S = {
  'JAGADISH AGENCIES':          { id: 'seller-prod-jagadish',        city: 'Hyderabad City', state: 'Telangana', pinCode: '500018', latitude: 17.458455, longitude: 78.453121, fullAddress: 'First Floor, 10-4-70, Balanagar, Sanathnagar IE, Sri Ramalayam Mandir Entrance, Fathe Nagar, Hyderabad, Rangareddy, Telangana, 500018', gstin: '36BOXPP1339F1ZI' },
  'MAS MARKETING':              { id: 'seller-prod-mas-marketing',   city: 'Hyderabad South East', state: 'Telangana', pinCode: '500048', latitude: 17.349871, longitude: 78.414398, fullAddress: '2-2-109, , UPPERPALLY, Hyderabad, 500048', gstin: '36ASRPM7304E1ZL' },
  'Mvm Synergy Solutions LLP':  { id: 'seller-prod-mvm-synergy',     city: 'Thane West', state: 'Maharashtra', pinCode: '401105', latitude: 19.316502, longitude: 72.85524, fullAddress: 'A-15 New Samir Chs Ltd K-7,Jesal Park,B Patil Road,Bhayandar East,Thane,401105', gstin: '27ACGFM0411P1Z4' },
  'Ms Gurukumaran Nadar':       { id: 'seller-prod-gurukumaran',     city: 'Mumbai North West', state: 'Maharashtra', pinCode: '400067', latitude: 19.215591, longitude: 72.852287, fullAddress: 'Shop No 2,Krishna Apt. Chs.Ltd.Cst No.6/A,Bhatt Lane,Kandivali West,Mumbai-400067', gstin: '37AAACX1706A1ZY' },
  'Omkar Test Distributor':     { id: 'seller-prod-omkar',           city: 'Secunderabad', state: 'Telangana', pinCode: '500072', latitude: 17.4802, longitude: 78.4171, fullAddress: 'H.No 15, 3rd Phase 3rd Phase, Plot No 14 & 15, Venkateshwara Swamy Temple Road, Kukatpally Housing Board Colony, 3rd Phase, KPHB Phase 2, Kukatpally, Hyderabad, Telangana 500072', gstin: '37AAACX1705A1ZW' },
  'YLN AGENCIES':               { id: 'seller-prod-yln',             city: 'Hyderabad South East', state: 'Telangana', pinCode: '500074', latitude: 17.338726, longitude: 78.55168, fullAddress: '7-4-26, Biramalguda, Saroor Nagar Mandal, Hyderabad, Rangareddy, Telangana, 500074', gstin: '36AABFY9700C1ZB' },
  'JAI GANESH AGENCIES':        { id: 'seller-prod-jai-ganesh',      city: 'Secunderabad', state: 'Telangana', pinCode: '500062', latitude: 17.474239, longitude: 78.547992, fullAddress: 'H.NO 30-265/8/83/1, Geetha nagar, road no 2, AS Rao Nagar', gstin: '36BBTPK2286H1Z6' },
  'DEV AGENCIES':               { id: 'seller-prod-dev',             city: 'Hyderabad City', state: 'Telangana', pinCode: '500019', latitude: 17.5033618, longitude: 78.3070492, fullAddress: 'H.No. 3-33/19, Venkata Reddy Colony, Taranagar, Serilingampally, Hyderabad, Ranga Reddy, Telangana - 500019', gstin: '36AKVPP3365L1ZA' },
  'J S V MARKETING':            { id: 'seller-prod-jsv',             city: 'Hyderabad City', state: 'Telangana', pinCode: '500018', latitude: 17.451225, longitude: 78.448068, fullAddress: '7-2-590, SRT 369', gstin: '36AMZPP2684A1ZL' },
  'DHHANA LAXME ENTERPRISES':   { id: 'seller-prod-dhhana-laxme',    city: 'Hyderabad City', state: 'Telangana', pinCode: '500038', latitude: 17.445655, longitude: 78.445282, fullAddress: '7-1-621/542, PLOT NO 216A, BK GUDA, SR NAGAR', gstin: '36AFPPV0738N1ZM' },
  'VINODH ENTERPRISES':         { id: 'seller-prod-vinodh',          city: 'Secunderabad', state: 'Telangana', pinCode: '500055', latitude: 17.509018, longitude: 78.32085, fullAddress: 'HUDA COLONY, 13-81/1, MIG 459, CHANDANAGAR, HYDERABAD, Ranga Reddy, Telangana, 500055', gstin: '36AJFPV0935P1ZK' },
  'Shalvi Mumbai Seller':       { id: 'seller-prod-shalvi',          city: 'Mumbai North West', state: 'Maharashtra', pinCode: '400092', latitude: 19.22448, longitude: 72.84594, fullAddress: 'Wamanrao Pai Garden, TPS Rd, Rameshwar Darshan CHS, Babhai Naka, Borivali West', gstin: '37AAACX1706A1ZW' },
  'CHASWI MARKETING SOLUTIONS': { id: 'seller-prod-chaswi',          city: 'Secunderabad', state: 'Telangana', pinCode: '500050', latitude: 17.4866371, longitude: 78.32127, fullAddress: 'HUDAFACE-2, 6-94/249, NEAR TO PJR STADIUM, CHANDANAGAR, Ranga Reddy, Telangana, 500050', gstin: '36ANXPV7185M1ZK' },
  'LAKSHMI SAAI ENTERPRISES':   { id: 'seller-prod-lakshmi-saai',    city: 'Secunderabad', state: 'Telangana', pinCode: '500054', latitude: 17.4862465, longitude: 17.4862465, fullAddress: '7 100/28, RAMAKRISHNA NAGAR, CHINTAL, Medchal - Malkajgiri, Telangana, 500054', gstin: '36AWYPV1343D1Z4' },
  'SAHASRA ENTERPRISES':        { id: 'seller-prod-sahasra',         city: 'Secunderabad', state: 'Telangana', pinCode: '500072', latitude: 17.505048, longitude: 78.414073, fullAddress: 'H. No. 432-1135-A164, Phase-2, Allwyn Colony, Kukatpally, Hyderabad, Medchal Malkajgiri, Telangana - 500072', gstin: '36AVFPG1187N1Z9' },
  'SS Enterprises':             { id: 'seller-prod-ss-ent',          city: 'Secunderabad', state: 'Telangana', pinCode: '500037', latitude: 17.501496, longitude: 78.430619, fullAddress: '36-88/4, Devamma Basthi, Near Swathi Vidhya Nikethan, Jagathgiri Gutta, Hyderabad, Medchal Malkajgiri, Telangana, 500037', gstin: '36ARQPP4829B1ZJ' },
  'SS DISTRIBUTORS':            { id: 'seller-prod-ss-dist',         city: 'Secunderabad', state: 'Telangana', pinCode: '500037', latitude: 17.501496, longitude: 78.430621, fullAddress: 'H.No. 36-88/4, Road Number 3, Devamma Basthi, Near Swathi Vidhyanikethan, Quthbullapur, Jagathgirigutta, Hyderabad, Medchal Malkajgiri, Telangana, 500037', gstin: '36AFSFS1308E1ZY' },
  'RM Traders':                 { id: 'seller-prod-rm-traders',      city: 'Secunderabad', state: 'Telangana', pinCode: '500072', latitude: 17.486168, longitude: 78.397041, fullAddress: 'MIG-736/A, Opp. 724, KPHB, Kukatpally, Hyderabad - 500072', gstin: '36AFTPC7788R1Z5' },
  'SHRI SAI KRISHNA TRADERS':   { id: 'seller-prod-sai-krishna',     city: 'Secunderabad', state: 'Telangana', pinCode: '500072', latitude: 17.496161, longitude: 78.41861, fullAddress: '4-35-284, PLOT NO 87,88,105,106 & 107, BALKRISHNA NAGAR, NEAR INDIAN GAS GODOWN, Kukatpally, Hyderabad, Medchal Malkajgiri, Telangana, 500072', gstin: '36AEEPC4773N1Z7' },
  'SRI SARDA ENTERPRISES':      { id: 'seller-prod-sri-sarda',       city: 'Hyderabad City', state: 'Telangana', pinCode: '500018', latitude: 17.464923, longitude: 78.421141, fullAddress: 'GROUND FLOOR, 12-7-20/52, FATIMA WAREHOUSING COMPLEX, Railway Goods Shed Road, IND Swift Ltd, Moosapet, Hyderabad, Medchal Malkajgiri, Telangana, 500018', gstin: '36DDQPA6260J1ZA' },
  'VENKATESHWARA AGENCIES':     { id: 'seller-prod-venkateshwara',   city: 'Secunderabad', state: 'Telangana', pinCode: '500072', latitude: 17.4907605, longitude: 78.40817, fullAddress: 'HOUSE NO 5-5, BAGHAMEERI, KUKATPALLY VILLAGE, Medchal - Malkajgiri, Telangana, 500072', gstin: '36AOQPA0800E2ZI' },
  'MAHADEVA ENTERPRISES':       { id: 'seller-prod-mahadeva',        city: 'Secunderabad', state: 'Telangana', pinCode: '500072', latitude: 17.483253, longitude: 78.419938, fullAddress: 'GROUND FLOOR, MIG 835, 1ST & II P, Kukatpally Main Road, KPHB Colony, Hyderabad, Medchal Malkajgiri, Telangana, 500072', gstin: '36AAYPD6568L1ZT' },
  'S R ENTERPRISES':            { id: 'seller-prod-s-r',             city: 'Secunderabad', state: 'Telangana', pinCode: '500037', latitude: 17.49925, longitude: 78.431143, fullAddress: 'H.NO-36-280, Jagathgiri Gutta, Medchal Malkajgiri, Hyderabad, Telangana', gstin: '36DCZPA0374M1Z2' },
  'Sri Sairam Enterprises':     { id: 'seller-prod-sri-sairam',      city: 'Secunderabad', state: 'Telangana', pinCode: '500055', latitude: 17.488862, longitude: 78.412379, fullAddress: 'SHOP NO 5, SWASTIK RESIDENCY, BAGH AMEER, KUKATPALLY, HYDERABAD, Medchal - Malkajgiri, Telangana', gstin: '36AHBPD2014R1ZH' },
  'Internal Catalog Seller':    { id: 'seller-prod-internal-catalog', city: 'Hyderabad City', state: 'Telangana', pinCode: '500081', latitude: 17.448294, longitude: 78.391487, fullAddress: 'Flat No. 404, Aakash Enclave', gstin: '36AAACX1705A1ZY' },
  // ---- added 2026-07-30 (created in production 25–30 Jul; profiles from
  // seller-core-api /api/admin/sellers/list) ----
  'BANJARA MARKETING':          { id: 'seller-prod-banjara',         city: 'Hyderabad City', state: 'Telangana', pinCode: '500018', latitude: 17.4575559, longitude: 78.4275848, fullAddress: '8-4-336/1/G, Banjaranagar, Erragadda, Hyderabad, Telangana, 500018.', gstin: '36ODCPS3159F1Z4' },
  'SKM ENTERPRISES':            { id: 'seller-prod-skm',             city: 'Hyderabad City', state: 'Telangana', pinCode: '500018', latitude: 17.453823, longitude: 78.4406493, fullAddress: 'H NO SRT 794, SANATH NAGAR, NEAR BY VEGETABLE MARKET, HYDERABAD.', gstin: '36BPJPJ3686QIZZ' },
  'BALAJI TRADING':             { id: 'seller-prod-balaji-trading',  city: 'Hyderabad City', state: 'Telangana', pinCode: '500018', latitude: 17.4649943, longitude: 78.4210894, fullAddress: 'FATIMA WAREHOUSING COMPLEX, Railway Goods Shed Road, Moosapet, Telangana 500018', gstin: '36DXKPA9903G1ZE' },
  'SILPATWAL TRADERS':          { id: 'seller-prod-silpatwal',       city: 'Mumbai North West', state: 'Maharashtra', pinCode: '400092', latitude: 19.253941, longitude: 72.849579, fullAddress: 'Bldg No.1 B Wing, Shop No-2, Golders Green,Maharashtra Holly Cross Road, Borivali West Mumbai - 400092', gstin: '27AECPG0304H1Z6' },
  // ---- added 2026-08-12 (created in production 6–8 Aug) ----
  'HANUMAN ENTERPRISES':        { id: 'seller-prod-hanuman',         city: 'Secunderabad', state: 'Telangana', pinCode: '500047', latitude: 17.4494815, longitude: 78.5330918, fullAddress: '13-120/B, Sanjay Nagar, Brindavan Colony, Malkajgiri, 500047, Malkajgiri, Secunderabad, Telangana, 500047', gstin: '36BGGPS8632B1ZB' },
  'RASVITHA TRADERS':           { id: 'seller-prod-rasvitha',        city: 'Secunderabad', state: 'Telangana', pinCode: '500015', latitude: 17.4941403, longitude: 78.4907842, fullAddress: 'No./Flat No.: 1-6-45/126/3, GROUND FLOOR, YADAMMA NAGAR STREET, Secunderabad, 500015, Alwal, Secunderabad, Telangana, 500015', gstin: '36FLWPK1113C1Z8' },
};

// ---- companies: production name -> local company id ----
// Three production companies already exist in the local catalog under
// older ids — reuse those ids so SKU/brand references keep working.
const COMPANY_ID_OVERRIDES = {
  'Adani Wilmar Limited': 'co-adani',
  'Gemini Edibles & Fats India Private Limited': 'co-freedom',
  'ITC Limited': 'co-itc',
};
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const companyIds = new Map();
const companyId = (name) => {
  if (COMPANY_ID_OVERRIDES[name]) return COMPANY_ID_OVERRIDES[name];
  if (!companyIds.has(name)) companyIds.set(name, `co-prod-${slug(name)}`);
  return companyIds.get(name);
};

// ---- beats ----
const beats = [];
let n = 0;
const invByBiz = new Map(); // manifest business name -> inventory record (inventory "seller" is the personal name)
for (const rec of inv) invByBiz.set(rec.phone, rec);

const sellerCompanies = new Map(); // seller id -> Set of company ids
for (const rec of inv) {
  const man = manifest.find((m) => m.phone === rec.phone);
  const prof = S[man.business];
  if (!prof) throw new Error('no profile mapping for ' + man.business);
  for (const co of rec.companies) {
    const cid = companyId(co.name);
    if (!sellerCompanies.has(prof.id)) sellerCompanies.set(prof.id, new Set());
    sellerCompanies.get(prof.id).add(cid);
    for (const b of co.beats) {
      n++;
      beats.push({
        id: `beat-prod-${String(n).padStart(3, '0')}-${slug(b.beat).slice(0, 30)}`,
        companyId: cid,
        companyName: co.name,
        sellerId: prof.id,
        sellerName: man.seller,
        beatName: b.beat,
        deliveryDays: b.inferredDays,
        polygonFileName: b.file,
        polygonData: b.geojson,
        createdAt: '2026-07-24T00:00:00Z',
      });
    }
  }
}

// ---- sellers ----
const sellers = manifest.map((man) => {
  const prof = S[man.business];
  if (!prof) throw new Error('no profile for ' + man.business);
  return {
    id: prof.id,
    name: man.seller,
    email: `prod-${man.phone}@qwipo.com`,
    phone: man.phone,
    businessName: man.business,
    city: prof.city,
    pinCode: prof.pinCode,
    state: prof.state,
    latitude: prof.latitude,
    longitude: prof.longitude,
    fullAddress: prof.fullAddress,
    isActive: man.status === 'Active',
    sellerType: 'distributor',
    kyc: { gstin: prof.gstin, businessAddress: prof.fullAddress, status: 'verified', updatedAt: '2026-07-17T00:00:00Z' },
    connectors: { bizom: { status: 'not_connected' }, ondc: { status: 'not_connected' } },
    permissions: { view: true, write: true, edit: true, update: true },
    managedCompanies: [...(sellerCompanies.get(prof.id) ?? [])],
    companyBrandSelections: [],
    approvedAt: '2026-07-17T00:00:00Z',
  };
});

// ---- new companies (excluding the 3 mapped onto existing catalog ids) ----
const newCompanies = [...companyIds.entries()].map(([name, id]) => ({ id, name }));
const renamedExisting = Object.entries(COMPANY_ID_OVERRIDES).map(([name, id]) => ({ id, name }));

// ---- emit ----
const out = (f, code) => fs.writeFileSync(path.join('src', 'app', 'lib', f), code);

out('prod-replica-sellers-seed.ts', `// GENERATED by build-prod-replica-seed.cjs — do not edit by hand.
// Exact replica of the production seller roster (seller-portal.bms.qwipo.com)
// as of 2026-08-12: real names, phone numbers and business names, so local
// customer exports map 1:1 onto production sellers.
import type { Seller } from "./mock-store";

export const PROD_REPLICA_SELLERS: Seller[] = ${JSON.stringify(sellers, null, 2)};
`);

out('prod-replica-companies-seed.ts', `// GENERATED by build-prod-replica-seed.cjs — do not edit by hand.
// Production companies referenced by the replicated delivery beats.
// (Adani Wilmar Limited, Gemini Edibles and ITC Limited reuse the
// pre-existing catalog ids co-adani / co-freedom / co-itc.)
export const PROD_REPLICA_COMPANIES: { id: string; name: string }[] = ${JSON.stringify(newCompanies, null, 2)};
`);

out('prod-replica-beats-seed.ts', `// GENERATED by build-prod-replica-seed.cjs — do not edit by hand.
// All ${beats.length} production delivery beats (with polygons) captured from
// seller-portal.bms.qwipo.com (2026-07-30 full sweep + 2026-08-12 additions
// for HANUMAN ENTERPRISES and RASVITHA TRADERS). Source data:
// "Production Polygons/" at the repo root.
import type { ServiceabilityBeat } from "./serviceability-data";

export const PROD_REPLICA_BEATS: ServiceabilityBeat[] = ${JSON.stringify(beats, null, 1)} as ServiceabilityBeat[];
`);

console.log('sellers:', sellers.length, '| beats:', beats.length, '| new companies:', newCompanies.length, '| renamed existing:', renamedExisting.map(c => c.id).join(','));
const empt = sellers.filter(s => !sellerCompanies.has(s.id)).map(s => s.businessName);
console.log('sellers without beats:', empt.join('; '));
