const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile('C:\\Users\\Lenovo\\Downloads\\Sri Sai Ram Agencies 2.xlsx');
const ws = wb.Sheets['Main SKU Upload'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

// Row 0 = header, Row 1 = instructions, Row 2+ = data
const headers = rows[0];
const skus = [];
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  const code = String(r[0] || '').trim();
  const name = String(r[1] || '').trim();
  if (!code || !name) continue;
  skus.push({
    index: skus.length + 1,
    skuCode: code,
    skuName: name,
    groupName: String(r[2] || '').trim(),
    measureUnit: String(r[3] || '').trim(),
    unitValue: r[4],
    weightMeasure: String(r[5] || '').trim(),
    skuWeight: r[6],
    innerPack: r[7],
    upc: r[8],
    mrp: r[9],
    sp: r[10],
    packageType: String(r[12] || '').trim(),
    packageTypeValue: r[13],
    category: String(r[14] || '').trim(),
    manufacturer: String(r[15] || '').trim(),
    brand: String(r[16] || '').trim(),
    hsn: r[17],
    gst: r[18],
    gstCess: r[19],
  });
}

console.log(`Total SKUs: ${skus.length}`);
console.log(`\nBrand counts:`);
const brandCount = {};
skus.forEach(s => { brandCount[s.brand] = (brandCount[s.brand] || 0) + 1; });
Object.entries(brandCount).sort((a, b) => b[1] - a[1]).forEach(([b, c]) => console.log(`  ${b}: ${c}`));

console.log(`\nCategory counts:`);
const catCount = {};
skus.forEach(s => { catCount[s.category || '(blank)'] = (catCount[s.category || '(blank)'] || 0) + 1; });
Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

console.log(`\nManufacturer counts:`);
const mfgCount = {};
skus.forEach(s => { mfgCount[s.manufacturer] = (mfgCount[s.manufacturer] || 0) + 1; });
Object.entries(mfgCount).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log(`  ${m}: ${n}`));

fs.writeFileSync('srisai-skus.json', JSON.stringify(skus, null, 2));
console.log(`\nSaved srisai-skus.json with ${skus.length} SKUs`);
