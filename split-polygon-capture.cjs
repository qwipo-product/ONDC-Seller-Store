// Splits a *.capture.json (from the browser capture) into
// Production Polygons/<Seller>_<Phone>/<Company>/<beat>.geojson
// Supports single-seller format {seller, phone, captured:[{company,beat,file,text}]}
// and multi-seller format {captured:[{seller,phone,company,beat,file,text}]}
const fs = require('fs');
const path = require('path');

const captureFile = process.argv[2];
if (!captureFile) { console.error('usage: node split-polygon-capture.cjs <capture.json>'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(captureFile, 'utf8'));
const safe = s => String(s).replace(/[<>:"/\\|?*]/g, '_').trim().replace(/[. ]+$/, '');
const root = path.join(__dirname, 'Production Polygons');

const counts = {};
for (const cap of data.captured) {
  const seller = cap.seller || data.seller;
  const phone = cap.phone || data.phone;
  const dir = path.join(root, `${safe(seller)}_${phone}`, safe(cap.company));
  fs.mkdirSync(dir, { recursive: true });
  const fname = safe(cap.file || (cap.beat + '.geojson'));
  fs.writeFileSync(path.join(dir, fname), cap.text);
  counts[`${seller}_${phone}`] = (counts[`${seller}_${phone}`] || 0) + 1;
}
for (const [k, v] of Object.entries(counts)) console.log(`${k}: ${v} polygon files`);
