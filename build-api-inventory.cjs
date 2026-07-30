// Rebuilds Production Polygons/replica-inventory.json (+ the per-seller
// geojson folder tree) from an API capture file produced in the seller
// portal:
//   node build-api-inventory.cjs "C:/Users/User/Downloads/prod-beats-capture-YYYY-MM-DD.json"
//
// The capture comes from seller-core-api (/api/admin/sellers/<id>/serviceability
// + /polygon per rule) — unlike the old dialog blob captures, it carries the
// EXACT deliveryDays (1=Monday … 7=Sunday), so inferredDays is no longer
// inferred from beat-name prefixes.
const fs = require('fs');
const path = require('path');

const capPath = process.argv[2];
if (!capPath) throw new Error('usage: node build-api-inventory.cjs <capture.json>');
const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));

const DAY_NAMES = [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Windows: no <>:"/\|?* in names, and no trailing dots/spaces on folders.
const sanitize = (s) => s.replace(/[<>:"/\\|?*]/g, '').replace(/[. ]+$/, '').trim();

const root = path.join(__dirname, 'Production Polygons');

// ---- group capture by seller ----
const sellers = new Map(); // phone -> {seller, phone, companies: Map}
const seenKeys = new Set();
let dupes = 0;
for (const c of cap.captured) {
  const key = c.phone + '|' + c.company + '|' + c.beat;
  if (seenKeys.has(key)) { dupes++; continue; }
  seenKeys.add(key);
  if (!sellers.has(c.phone)) sellers.set(c.phone, { seller: c.seller, phone: c.phone, companies: new Map() });
  const s = sellers.get(c.phone);
  if (!s.companies.has(c.company)) s.companies.set(c.company, []);
  s.companies.get(c.company).push({
    beat: c.beat,
    file: sanitize(c.beat) + '.geojson',
    inferredDays: (c.days || []).map((d) => DAY_NAMES[d]).filter(Boolean),
    geojson: JSON.parse(c.text),
  });
}

// ---- write folder tree; collect the set of expected files so stale
// beats from earlier captures can be pruned ----
const expected = new Set(); // absolute file paths that should exist
let written = 0;
for (const s of sellers.values()) {
  const sellerDir = path.join(root, `${sanitize(s.seller)}_${s.phone}`);
  for (const [company, beats] of s.companies) {
    const coDir = path.join(sellerDir, sanitize(company));
    fs.mkdirSync(coDir, { recursive: true });
    for (const b of beats) {
      const f = path.join(coDir, b.file);
      fs.writeFileSync(f, JSON.stringify(b.geojson, null, 2));
      expected.add(f.toLowerCase());
      written++;
    }
  }
}

// ---- prune beat files that are no longer in production ----
let pruned = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '_captures') continue;
      walk(p);
      if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
    } else if (e.name.endsWith('.geojson') && !expected.has(p.toLowerCase())) {
      fs.unlinkSync(p);
      pruned++;
    }
  }
};
walk(root);

// ---- inventory ----
const out = [...sellers.values()].map((s) => ({
  seller: s.seller,
  phone: s.phone,
  companies: [...s.companies.entries()].map(([name, beats]) => ({ name, beats })),
}));
fs.writeFileSync(path.join(root, 'replica-inventory.json'), JSON.stringify(out, null, 1));

const nb = out.reduce((a, s) => a + s.companies.reduce((b, c) => b + c.beats.length, 0), 0);
console.log('sellers with beats:', out.length, '| beats:', nb, '| files written:', written, '| stale pruned:', pruned, '| dupes skipped:', dupes);
