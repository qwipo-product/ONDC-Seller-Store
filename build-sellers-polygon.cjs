// Builds the local seller replica from a production capture of the STD 040
// (Hyderabad, Telangana) sellers:
//   node build-sellers-polygon.cjs "Sellers Polygon/_captures/sellers-040-capture-YYYY-MM-DD.json"
//
// Outputs
//   Sellers Polygon/<BUSINESS NAME>_<Mobile>/<Company>/<Beat>.geojson
//   Sellers Polygon/sellers-manifest.json   (one row per seller)
//   Sellers Polygon/README.md               (per-seller table)
//   src/app/lib/prod-replica-sellers-seed.ts
//   src/app/lib/prod-replica-companies-seed.ts
//   src/app/lib/prod-replica-beats-seed.ts
//
// The capture is produced in a logged-in super-admin tab of
// seller-portal.bms.qwipo.com against https://seller-core-api.bms.qwipo.com:
//   POST /api/admin/sellers/list            → roster (filter ondcCityCode std:040)
//   GET  /api/admin/sellers/<id>/full       → seller + companies (+ tagged brands)
//   GET  /api/admin/sellers/<id>/serviceability            → beat rules + days
//   GET  /api/admin/sellers/<id>/serviceability/<rule>/polygon → GeoJSON
// saved as { capturedAt, sellers: [<full> + listRow], captured: [{sellerId,
// seller, business, phone, company, beat, days, polygonFilename, text}] }.
//
// The whole "Sellers Polygon/" tree (except _captures) is rewritten on every
// run, so a capture must always cover every seller.
const fs = require('fs');
const path = require('path');

const capPath = process.argv[2];
if (!capPath) throw new Error('usage: node build-sellers-polygon.cjs <capture.json>');
const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
const capturedOn = cap.capturedAt.slice(0, 10);

const DAY_NAMES = [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Windows: no <>:"/\|?* in names, and no trailing dots/spaces on folders.
const sanitize = (s) => s.replace(/[<>:"/\\|?*]/g, '').replace(/[. ]+$/, '').trim();
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// ---- stable ids ----
// Sellers already in the previous replica keep their local id (matched by
// mobile) so references such as the Seller demo login (seller-prod-rm-traders)
// keep resolving. New sellers get seller-prod-<business slug>.
const KEEP_SELLER_IDS = {
  '9246172889': 'seller-prod-rm-traders',
};
const prevSeed = path.join('src', 'app', 'lib', 'prod-replica-sellers-seed.ts');
if (fs.existsSync(prevSeed)) {
  const src = fs.readFileSync(prevSeed, 'utf8');
  for (const m of src.matchAll(/"id": "(seller-prod-[^"]+)",\s*"name": "[^"]*",\s*"email": "[^"]*",\s*"phone": "(\d+)"/g)) {
    KEEP_SELLER_IDS[m[2]] ??= m[1];
  }
}
const usedSellerIds = new Set();
const sellerId = (phone, business) => {
  let id = KEEP_SELLER_IDS[phone] ?? `seller-prod-${slug(business)}`;
  if (usedSellerIds.has(id)) id = `${id}-${phone.slice(-4)}`;
  usedSellerIds.add(id);
  return id;
};

// Three production companies already exist in the local catalog under
// older ids — reuse those ids so SKU/brand references keep working.
const COMPANY_ID_OVERRIDES = {
  'Adani Wilmar Limited': 'co-adani',
  'Gemini Edibles & Fats India Private Limited': 'co-freedom',
  'ITC Limited': 'co-itc',
};
const companies = new Map(); // name -> { id, name, brands: Map }
const company = (name) => {
  if (!companies.has(name)) {
    companies.set(name, { id: COMPANY_ID_OVERRIDES[name] ?? `co-prod-${slug(name)}`, name, brands: new Map() });
  }
  return companies.get(name);
};

// ---- sellers ----
const kycStatus = { APPROVED: 'verified', VERIFIED: 'verified', PENDING: 'submitted' };
const byPhone = new Map(); // phone -> local seller record
const sellers = cap.sellers
  .map((f) => ({ ...f.listRow, ...f.seller, kycStatus: f.listRow.kycStatus, companies: f.companies }))
  .sort((a, b) => a.businessName.localeCompare(b.businessName))
  .map((s) => {
    const id = sellerId(s.mobile, s.businessName);
    const selections = s.companies.map((sc) => {
      const co = company(sc.company.name);
      const tagged = sc.taggedBrands ?? [];
      for (const b of tagged) {
        co.brands.set(b.id, { id: `br-prod-${b.id.slice(0, 8)}`, name: b.name, imageUrl: b.imageUrl ?? null });
      }
      const mode = (sc.mode ?? 'DISTRIBUTOR').toLowerCase() === 'wholesaler' ? 'wholesaler' : 'distributor';
      const allBrands = !tagged.length || tagged.length >= (sc.totalBrandsInCompany ?? 0);
      return {
        companyId: co.id,
        brandIds: allBrands ? [] : tagged.map((b) => `br-prod-${b.id.slice(0, 8)}`),
        operationMode: mode,
        ...(mode === 'distributor' ? { purchaseEligibility: 'all-customers' } : {}),
      };
    });
    const modes = new Set(selections.map((x) => x.operationMode));
    const address = [s.addressLine1, s.addressLine2].filter(Boolean).join(', ');
    const rec = {
      id,
      name: s.name,
      email: s.email || `prod-${s.mobile}@qwipo.com`,
      phone: s.mobile,
      businessName: s.businessName,
      sellerType: modes.size === 2 ? 'hybrid' : modes.has('wholesaler') ? 'wholesaler' : 'distributor',
      city: s.city,
      pinCode: s.pincode,
      state: s.state,
      latitude: s.latitude,
      longitude: s.longitude,
      fullAddress: address,
      isActive: s.status === 'ACTIVE',
      kyc: { gstin: s.gstin ?? undefined, pan: s.pan ?? undefined, businessAddress: address, status: kycStatus[s.kycStatus] ?? 'not_started', updatedAt: s.updatedAt },
      connectors: { bizom: { status: 'not_connected' }, ondc: { status: 'not_connected' } },
      permissions: { view: true, write: true, edit: true, update: true },
      managedCompanies: selections.map((x) => x.companyId),
      companyBrandSelections: selections,
      approvedAt: s.createdAt,
    };
    byPhone.set(s.mobile, rec);
    return rec;
  });

// ---- beats + polygon folder tree ----
const root = path.join(__dirname, 'Sellers Polygon');
for (const e of fs.existsSync(root) ? fs.readdirSync(root) : []) {
  if (e !== '_captures') fs.rmSync(path.join(root, e), { recursive: true, force: true });
}

const beats = [];
const perSeller = new Map(); // seller id -> { companies:Set, beats }
const captured = [...cap.captured].sort((a, b) =>
  a.business.localeCompare(b.business) || a.company.localeCompare(b.company) || a.beat.localeCompare(b.beat));
for (const c of captured) {
  const s = byPhone.get(c.phone);
  if (!s) throw new Error('beat for unknown seller ' + c.phone);
  const co = company(c.company);
  const coDir = path.join(root, `${sanitize(s.businessName)}_${s.phone}`, sanitize(c.company));
  fs.mkdirSync(coDir, { recursive: true });
  let file = sanitize(c.beat) + '.geojson';
  if (fs.existsSync(path.join(coDir, file))) file = `${sanitize(c.beat)} (${beats.length + 1}).geojson`;
  const geojson = JSON.parse(c.text);
  fs.writeFileSync(path.join(coDir, file), JSON.stringify(geojson, null, 2));

  beats.push({
    id: `beat-prod-${String(beats.length + 1).padStart(4, '0')}-${slug(c.beat).slice(0, 30)}`,
    companyId: co.id,
    companyName: c.company,
    sellerId: s.id,
    sellerName: s.name,
    beatName: c.beat,
    deliveryDays: (c.days ?? []).slice().sort().map((d) => DAY_NAMES[d]).filter(Boolean),
    polygonFileName: c.polygonFilename || file,
    polygonData: geojson,
    createdAt: cap.capturedAt,
  });
  const ps = perSeller.get(s.id) ?? { companies: new Set(), beats: 0 };
  ps.companies.add(c.company);
  ps.beats++;
  perSeller.set(s.id, ps);
}

// ---- manifest + README ----
const manifest = sellers.map((s) => ({
  seller: s.name,
  business: s.businessName,
  phone: s.phone,
  status: s.isActive ? 'Active' : 'Inactive',
  localId: s.id,
  companies: s.companyBrandSelections.length,
  beats: perSeller.get(s.id)?.beats ?? 0,
}));
fs.writeFileSync(path.join(root, 'sellers-manifest.json'), JSON.stringify(manifest, null, 1));

const rows = manifest.map((m) =>
  `| ${m.business} | ${m.seller} | ${m.phone} | ${m.status} | ${m.companies} | ${perSeller.get(m.localId)?.companies.size ?? 0} | ${m.beats} |`);
fs.writeFileSync(path.join(root, 'README.md'), `# Sellers Polygon

Production delivery-beat polygons for every **STD 040 (Hyderabad, Telangana)**
seller on seller-portal.bms.qwipo.com, captured ${capturedOn}.

- **${manifest.length} sellers** (${manifest.filter((m) => m.status === 'Active').length} active), **${companies.size} companies**, **${beats.length} beats**
- Layout: \`<BUSINESS NAME>_<Mobile>/<Company>/<Beat>.geojson\`
- \`sellers-manifest.json\` — one row per seller (local id, status, counts)
- \`_captures/\` — the raw API capture this tree was built from

The app's seed data (\`src/app/lib/prod-replica-*-seed.ts\`) is generated from
the same capture — rebuild both together:

\`\`\`bash
node build-sellers-polygon.cjs "Sellers Polygon/_captures/<capture>.json"
\`\`\`

| Business | Seller | Mobile | Status | Companies | Companies with beats | Beats |
|---|---|---|---|---:|---:|---:|
${rows.join('\n')}
`);

// ---- emit seeds ----
const out = (f, code) => fs.writeFileSync(path.join('src', 'app', 'lib', f), code);
const catalog = [...companies.values()]
  .filter((c) => !Object.values(COMPANY_ID_OVERRIDES).includes(c.id))
  .map((c) => ({ id: c.id, name: c.name, brands: [...c.brands.values()] }));

out('prod-replica-sellers-seed.ts', `// GENERATED by build-sellers-polygon.cjs — do not edit by hand.
// Exact replica of the production STD 040 (Hyderabad, Telangana) seller
// roster on seller-portal.bms.qwipo.com as of ${capturedOn}. Source:
// "Sellers Polygon/" at the repo root.
import type { Seller } from "./mock-store";

export const PROD_REPLICA_SELLERS: Seller[] = ${JSON.stringify(sellers, null, 2)};
`);

out('prod-replica-companies-seed.ts', `// GENERATED by build-sellers-polygon.cjs — do not edit by hand.
// Production companies (with their tagged brands) linked to the STD 040
// sellers. Adani Wilmar Limited, Gemini Edibles and ITC Limited reuse the
// pre-existing catalog ids co-adani / co-freedom / co-itc.
export const PROD_REPLICA_COMPANIES: {
  id: string;
  name: string;
  brands: { id: string; name: string; imageUrl: string | null }[];
}[] = ${JSON.stringify(catalog, null, 2)};
`);

out('prod-replica-beats-seed.ts', `// GENERATED by build-sellers-polygon.cjs — do not edit by hand.
// All ${beats.length} production delivery beats (with polygons) of the STD 040
// sellers, captured from seller-portal.bms.qwipo.com on ${capturedOn}.
// Source: "Sellers Polygon/" at the repo root.
import type { ServiceabilityBeat } from "./serviceability-data";

export const PROD_REPLICA_BEATS: ServiceabilityBeat[] = [\n${beats.map((b) => JSON.stringify(b)).join(',\n')}\n] as ServiceabilityBeat[];
`);

console.log('sellers:', sellers.length, '| companies:', companies.size, '| beats:', beats.length,
  '| kept ids:', sellers.filter((s) => Object.values(KEEP_SELLER_IDS).includes(s.id)).length);
