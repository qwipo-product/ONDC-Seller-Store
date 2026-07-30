// Generates the one-file Excel dashboard report for the admin customer
// database: KPI dashboard + salesperson / cluster / distributor / company
// summaries + two raw sheets (customer level, customer × company beat level).
//
//   node build-dashboard-report.cjs
//
// Sources (all local, current as of the 2026-07-30 production sync):
//   src/app/lib/customer-raw-seed.csv          26,525 customers
//   src/app/lib/prod-replica-sellers-seed.ts   29 distributors
//   src/app/lib/prod-replica-beats-seed.ts     825 beats w/ polygons + days
//
// Matching = the same point-in-polygon (bbox-fast-path) the app uses.
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'Qwipo-Customer-Database-Dashboard_2026-07-30.xlsx');

// ---- load data --------------------------------------------------------
const extractJson = (file) => {
  const t = fs.readFileSync(file, 'utf8');
  // Seed modules end with "];" or "] as Type[];" — cut at the last
  // newline-anchored "]" so trailing type annotations don't leak in.
  const end = t.lastIndexOf('\n]');
  return JSON.parse(t.slice(t.indexOf('= [') + 2, end + 2));
};
const sellers = extractJson(path.join(ROOT, 'src/app/lib/prod-replica-sellers-seed.ts'));
const beats = extractJson(path.join(ROOT, 'src/app/lib/prod-replica-beats-seed.ts'));

// Minimal CSV parser (same dialect as the app's).
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i+1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i+1] === '\n') i++; row.push(f); f=''; rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
const grid = parseCsv(fs.readFileSync(path.join(ROOT, 'src/app/lib/customer-raw-seed.csv'), 'utf8'));
const H = grid[0];
const col = (name) => H.indexOf(name);
const customers = grid.slice(1).map(r => ({
  id: r[col('customer_id')], name: r[col('customer_name')], mobile: r[col('mobile_number')],
  businessType: r[col('business_type')], businessStatus: r[col('business_status')],
  status: r[col('status')], spName: r[col('salesperson_name')], spNum: r[col('salesperson_number')],
  cluster: r[col('cluster')], registered: r[col('registered_date')],
  lat: Number(r[col('latitude')]), lng: Number(r[col('longitude')]),
}));

// ---- geometry ---------------------------------------------------------
const outerRings = (d) => {
  const rings = [];
  const walk = (g) => {
    if (!g) return;
    if (g.type === 'Polygon' && g.coordinates?.[0]?.length) rings.push(g.coordinates[0]);
    else if (g.type === 'MultiPolygon') for (const p of g.coordinates ?? []) if (p?.[0]?.length) rings.push(p[0]);
  };
  if (!d || typeof d !== 'object') return rings;
  if (d.type === 'FeatureCollection') for (const f of d.features ?? []) walk(f?.geometry);
  else if (d.type === 'Feature') walk(d.geometry);
  else walk(d);
  return rings;
};
const pointInRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const haversine = (a, b, c, d) => {
  const rad = (x) => (x * Math.PI) / 180, R = 6371;
  const dLat = rad(c - a), dLng = rad(d - b);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const sellerById = new Map(sellers.map(s => [s.id, s]));
// A seller coordinate is unusable when lat === lng (known bad row) or
// outside plausible India longitudes — distance stays blank then.
const sellerCoordOk = (s) => s && s.latitude != null && s.longitude != null &&
  s.latitude !== s.longitude && s.longitude > 60 && s.longitude < 100;

// Pre-extract rings + bboxes once.
const beatGeo = beats.map(b => {
  const rings = outerRings(b.polygonData).map(ring => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of ring) { if (x<minX)minX=x; if (x>maxX)maxX=x; if (y<minY)minY=y; if (y>maxY)maxY=y; }
    return { ring, minX, minY, maxX, maxY };
  });
  return { b, rings };
});

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const sortDays = (d) => [...(d ?? [])].sort((a, b2) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b2)).join(', ');

// ---- match ------------------------------------------------------------
console.time('match');
const matches = customers.map(c => {
  const hit = [];
  for (const { b, rings } of beatGeo) {
    for (const r of rings) {
      if (c.lng >= r.minX && c.lng <= r.maxX && c.lat >= r.minY && c.lat <= r.maxY && pointInRing(c.lng, c.lat, r.ring)) {
        hit.push(b);
        break;
      }
    }
  }
  return hit;
});
console.timeEnd('match');

// ---- aggregates -------------------------------------------------------
const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
const isActive = (c) => c.status === 'Active';
const nCust = customers.length;
const nActive = customers.filter(isActive).length;
const serviceableIdx = matches.map(m => m.length > 0);
const nServ = serviceableIdx.filter(Boolean).length;
const nActiveServ = customers.filter((c, i) => isActive(c) && serviceableIdx[i]).length;
const clusters = new Set(customers.map(c => c.cluster).filter(Boolean));
const salespersons = new Set(customers.map(c => c.spName).filter(Boolean));
const companiesInBeats = new Set(beats.map(b => b.companyName));
const sellersWithBeats = new Set(beats.map(b => b.sellerId).filter(Boolean));
const typeCounts = {};
for (const c of customers) { const t = c.businessType || '(blank)'; typeCounts[t] = (typeCounts[t] || 0) + 1; }

// per-customer company/distributor counts
const custCompanyCount = matches.map(m => new Set(m.map(b => b.companyName)).size);
const custSellerCount = matches.map(m => new Set(m.map(b => b.sellerId)).size);
const maxCompanies = Math.max(...custCompanyCount);
const maxSellers = Math.max(...custSellerCount);
const avgCompaniesServ = (custCompanyCount.reduce((a, v) => a + v, 0) / Math.max(1, nServ)).toFixed(1);

// group helpers
function groupRows(keyFn) {
  const m = new Map();
  customers.forEach((c, i) => {
    const k = keyFn(c);
    if (!m.has(k)) m.set(k, { customers: 0, active: 0, serv: 0, activeServ: 0, clusters: new Set(), sellers: new Set() });
    const g = m.get(k);
    g.customers++;
    if (isActive(c)) g.active++;
    if (serviceableIdx[i]) { g.serv++; if (isActive(c)) g.activeServ++; }
    if (c.cluster) g.clusters.add(c.cluster);
    for (const b of matches[i]) if (b.sellerId) g.sellers.add(b.sellerId);
  });
  return m;
}
const bySalesperson = groupRows(c => c.spName || '(unassigned)');
const byCluster = groupRows(c => c.cluster || '(no cluster)');

// distributor + company aggregates
const distAgg = new Map(); // sellerId -> {custs:Set, active:Set, companies:Set, beats:0}
for (const b of beats) {
  if (!b.sellerId) continue;
  if (!distAgg.has(b.sellerId)) distAgg.set(b.sellerId, { custs: new Set(), active: new Set(), companies: new Set(), beats: 0 });
  const g = distAgg.get(b.sellerId);
  g.beats++; g.companies.add(b.companyName);
}
const coAgg = new Map(); // company -> {sellers:Set, beats:0, custs:Set, active:Set}
for (const b of beats) {
  if (!coAgg.has(b.companyName)) coAgg.set(b.companyName, { sellers: new Set(), beats: 0, custs: new Set(), active: new Set() });
  const g = coAgg.get(b.companyName);
  g.beats++; if (b.sellerId) g.sellers.add(b.sellerId);
}
customers.forEach((c, i) => {
  for (const b of matches[i]) {
    if (b.sellerId && distAgg.has(b.sellerId)) {
      distAgg.get(b.sellerId).custs.add(c.id);
      if (isActive(c)) distAgg.get(b.sellerId).active.add(c.id);
    }
    const g = coAgg.get(b.companyName);
    g.custs.add(c.id); if (isActive(c)) g.active.add(c.id);
  }
});

// ---- workbook ---------------------------------------------------------
(async () => {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: OUT, useStyles: true });
  const ARIAL = { name: 'Arial', size: 10 };
  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  const SECTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEFB' } };

  const styleHeaderRow = (row) => {
    row.font = { ...ARIAL, bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = HEADER_FILL;
    row.commit();
  };
  const addPlain = (ws, values, opts = {}) => {
    const row = ws.addRow(values);
    row.font = opts.bold ? { ...ARIAL, bold: true } : ARIAL;
    if (opts.fill) row.fill = opts.fill;
    row.commit();
    return row;
  };

  // ---- 1. Dashboard ----
  const dash = wb.addWorksheet('Dashboard');
  dash.columns = [{ width: 52 }, { width: 16 }, { width: 12 }];
  addPlain(dash, ['Qwipo Customer Database — Dashboard'], { bold: true });
  addPlain(dash, ['Snapshot generated 30-Jul-2026 from the admin customer database (26,525-customer master roster) and the production beat capture of the same date. All figures computed from the raw sheets in this workbook.']);
  addPlain(dash, []);
  const kpi = (label, value, extra) => addPlain(dash, [label, value, extra ?? '']);
  const section = (title) => { addPlain(dash, []); addPlain(dash, [title], { bold: true, fill: SECTION_FILL }); };

  section('CUSTOMER DATABASE');
  kpi('Total customers', nCust);
  kpi('Active customers', nActive, pct(nActive, nCust) + '%');
  kpi('Inactive customers', nCust - nActive, pct(nCust - nActive, nCust) + '%');
  kpi('Areas (clusters) represented', clusters.size);
  kpi('Salespersons (on customer records)', salespersons.size);
  section('CUSTOMERS BY BUSINESS TYPE');
  for (const [t, n] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) kpi('  ' + t, n, pct(n, nCust) + '%');

  section('DISTRIBUTOR NETWORK');
  kpi('Distributors (sellers)', sellers.length);
  kpi('Active distributors', sellers.filter(s => s.isActive).length);
  kpi('Distributors with delivery beats', sellersWithBeats.size);
  kpi('Delivery beats (zones)', beats.length);
  kpi('Companies distributed (via beats)', companiesInBeats.size);

  section('SERVICEABILITY (CUSTOMER ↔ DISTRIBUTOR EXPOSURE)');
  kpi('Customers exposed to ≥1 distributor', nServ, pct(nServ, nCust) + '%');
  kpi('Customers NOT exposed to any distributor', nCust - nServ, pct(nCust - nServ, nCust) + '%');
  kpi('Active customers exposed to ≥1 distributor', nActiveServ, pct(nActiveServ, nActive) + '%');
  kpi('Active customers NOT exposed', nActive - nActiveServ, pct(nActive - nActiveServ, nActive) + '%');
  kpi('Max companies reaching a single customer', maxCompanies);
  kpi('Max distributors reaching a single customer', maxSellers);
  kpi('Avg companies per exposed customer', avgCompaniesServ);

  section('WORKBOOK CONTENTS');
  kpi('Salesperson Summary', 'sheet 2');
  kpi('Area (Cluster) Summary', 'sheet 3');
  kpi('Distributor Summary', 'sheet 4');
  kpi('Company Summary', 'sheet 5');
  kpi('Customers (raw, one row per customer)', 'sheet 6');
  kpi('Customer-Company Detail (raw, one row per customer × beat)', 'sheet 7');
  addPlain(dash, []);
  addPlain(dash, ['Note: product-level data is not linked to customers in this database (products belong to the company catalog); the report goes down to company level.']);
  dash.commit();

  // ---- 2. Salesperson Summary ----
  const sp = wb.addWorksheet('Salesperson Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  sp.columns = [
    { width: 26 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 20 }, { width: 20 }, { width: 12 }, { width: 16 },
  ];
  styleHeaderRow(sp.addRow(['Salesperson', 'Customers', 'Active', 'Exposed (any)', 'Active & Exposed', 'Active & NOT Exposed', 'Clusters', 'Distributors Reaching']));
  for (const [k, g] of [...bySalesperson.entries()].sort((a, b) => b[1].customers - a[1].customers)) {
    addPlain(sp, [k, g.customers, g.active, g.serv, g.activeServ, g.active - g.activeServ, g.clusters.size, g.sellers.size]);
  }
  sp.commit();

  // ---- 3. Area (Cluster) Summary ----
  const cl = wb.addWorksheet('Area Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  cl.columns = [{ width: 24 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 20 }];
  styleHeaderRow(cl.addRow(['Area / Cluster', 'Customers', 'Active', 'Exposed (any)', 'NOT Exposed', 'Coverage %', 'Distributors Reaching']));
  for (const [k, g] of [...byCluster.entries()].sort((a, b) => b[1].customers - a[1].customers)) {
    addPlain(cl, [k, g.customers, g.active, g.serv, g.customers - g.serv, pct(g.serv, g.customers), g.sellers.size]);
  }
  cl.commit();

  // ---- 4. Distributor Summary ----
  const ds = wb.addWorksheet('Distributor Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  ds.columns = [{ width: 26 }, { width: 30 }, { width: 20 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 18 }, { width: 22 }];
  styleHeaderRow(ds.addRow(['Distributor', 'Business Name', 'City', 'Status', 'Companies', 'Beats', 'Customers Covered', 'Active Customers Covered']));
  const distRows = sellers.map(s => {
    const g = distAgg.get(s.id);
    return [s.name, s.businessName, s.city ?? '', s.isActive ? 'Active' : 'Inactive', g ? g.companies.size : 0, g ? g.beats : 0, g ? g.custs.size : 0, g ? g.active.size : 0];
  }).sort((a, b) => b[6] - a[6]);
  for (const r of distRows) addPlain(ds, r);
  ds.commit();

  // ---- 5. Company Summary ----
  const cs = wb.addWorksheet('Company Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  cs.columns = [{ width: 46 }, { width: 14 }, { width: 10 }, { width: 18 }, { width: 22 }];
  styleHeaderRow(cs.addRow(['Company', 'Distributors', 'Beats', 'Customers Covered', 'Active Customers Covered']));
  for (const [name, g] of [...coAgg.entries()].sort((a, b) => b[1].custs.size - a[1].custs.size)) {
    addPlain(cs, [name, g.sellers.size, g.beats, g.custs.size, g.active.size]);
  }
  cs.commit();

  // ---- 6. Customers (raw) ----
  const cu = wb.addWorksheet('Customers', { views: [{ state: 'frozen', ySplit: 1 }] });
  cu.columns = [
    { width: 30 }, { width: 32 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 10 }, { width: 16 },
    { width: 20 }, { width: 14 }, { width: 14 }, { width: 11 }, { width: 11 }, { width: 12 }, { width: 12 }, { width: 12 },
  ];
  styleHeaderRow(cu.addRow(['Customer ID', 'Customer Name', 'Mobile', 'Business Type', 'Business Status', 'Status', 'Cluster', 'Salesperson', 'Salesperson No.', 'Registered', 'Latitude', 'Longitude', 'Exposed', 'Distributors', 'Companies']));
  customers.forEach((c, i) => {
    const row = cu.addRow([
      c.id, c.name, c.mobile, c.businessType, c.businessStatus, c.status, c.cluster,
      c.spName, c.spNum, c.registered, c.lat, c.lng,
      serviceableIdx[i] ? 'Yes' : 'No', custSellerCount[i], custCompanyCount[i],
    ]);
    row.font = ARIAL;
    row.commit();
  });
  cu.commit();

  // ---- 7. Customer-Company Detail (raw) ----
  const det = wb.addWorksheet('Customer-Company Detail', { views: [{ state: 'frozen', ySplit: 1 }] });
  det.columns = [
    { width: 30 }, { width: 32 }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 20 }, { width: 14 },
    { width: 26 }, { width: 30 }, { width: 40 }, { width: 30 }, { width: 30 }, { width: 14 },
  ];
  styleHeaderRow(det.addRow(['Customer ID', 'Customer Name', 'Mobile', 'Status', 'Cluster', 'Salesperson', 'Registered', 'Distributor', 'Distributor Business', 'Company', 'Beat', 'Delivery Days', 'Distance (km)']));
  let detRows = 0;
  customers.forEach((c, i) => {
    for (const b of matches[i]) {
      const s = b.sellerId ? sellerById.get(b.sellerId) : undefined;
      const dist = sellerCoordOk(s) ? Number(haversine(c.lat, c.lng, s.latitude, s.longitude).toFixed(2)) : '';
      const row = det.addRow([
        c.id, c.name, c.mobile, c.status, c.cluster, c.spName, c.registered,
        s ? s.name : (b.sellerName ?? ''), s ? s.businessName : '', b.companyName, b.beatName,
        sortDays(b.deliveryDays), dist,
      ]);
      row.font = ARIAL;
      row.commit();
      detRows++;
    }
  });
  det.commit();

  await wb.commit();
  const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
  console.log('written:', OUT);
  console.log('detail rows:', detRows, '| customers:', nCust, '| serviceable:', nServ, '| active:', nActive, '| active+exposed:', nActiveServ, '| size MB:', mb);
})();
