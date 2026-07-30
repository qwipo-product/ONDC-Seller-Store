const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'Sri Sai Ram Agencies');
const IMG_ROOT = path.join(ROOT, 'SKU_Images');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'srisai-folder-map.json'), 'utf8'));

let totalImages = 0;
let perCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
let suspectBrand = [];
let zeroes = [];
let totalBytes = 0;

for (const s of map) {
  const files = fs.readdirSync(s.folderPath).filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f));
  totalImages += files.length;
  perCounts[Math.min(files.length, 4)] = (perCounts[Math.min(files.length, 4)] || 0) + 1;
  for (const f of files) totalBytes += fs.statSync(path.join(s.folderPath, f)).size;

  if (files.length === 0) zeroes.push(s);

  // Detect brand mismatch — SKU name starts with a known brand word that differs from sku.brand
  const knownBrands = ['Ajay', 'Priya', 'Cycle', 'Good Luck', 'Om Shanthi', 'Lia', 'Grb', 'GRB', 'Naivedya', 'Rhythm', 'Flute', 'Medini'];
  const firstWord = s.skuName.trim().split(/\s+/)[0];
  const firstTwo = s.skuName.trim().split(/\s+/).slice(0, 2).join(' ');
  const nameBrand = knownBrands.find(b => b.toLowerCase() === firstWord.toLowerCase()) ||
                    knownBrands.find(b => b.toLowerCase() === firstTwo.toLowerCase());
  if (nameBrand && s.brand && nameBrand.toLowerCase() !== s.brand.toLowerCase()) {
    suspectBrand.push({ skuCode: s.skuCode, skuName: s.skuName, excelBrand: s.brand, nameBrand });
  }
}

console.log(`\n=== Sri Sai Ram Agencies Image Summary ===`);
console.log(`Total SKUs: ${map.length}`);
console.log(`Total images saved: ${totalImages}`);
console.log(`Total size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`\nImages per SKU:`);
for (const k of [0, 1, 2, 3, 4]) console.log(`  ${k} images: ${perCounts[k] || 0} SKUs`);

console.log(`\nSKUs with 0 images: ${zeroes.length}`);
zeroes.forEach(s => console.log(`  - ${s.skuName} (${s.skuCode})`));

console.log(`\nBrand mismatches in source Excel (SKU name brand ≠ Brand column): ${suspectBrand.length}`);
suspectBrand.forEach(s => console.log(`  - "${s.skuName}" — Excel brand: "${s.excelBrand}", name suggests: "${s.nameBrand}" (SKU: ${s.skuCode.substring(0,8)})`));

fs.writeFileSync(path.join(ROOT, 'brand-mismatches.json'), JSON.stringify(suspectBrand, null, 2));
