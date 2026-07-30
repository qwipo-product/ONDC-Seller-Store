const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'Sri Sai Ram Agencies');
const excelDir = path.join(root, 'Excel');
const imgDir = path.join(root, 'SKU_Images');
const srcExcel = 'C:\\Users\\Lenovo\\Downloads\\Sri Sai Ram Agencies 2.xlsx';
const dstExcel = path.join(excelDir, 'Sri Sai Ram Agencies 2.xlsx');

fs.mkdirSync(excelDir, { recursive: true });
fs.mkdirSync(imgDir, { recursive: true });
fs.copyFileSync(srcExcel, dstExcel);

console.log(`Created: ${root}`);
console.log(`Created: ${excelDir}`);
console.log(`Created: ${imgDir}`);
console.log(`Copied Excel to: ${dstExcel}`);

// Now create one folder per SKU
const skus = JSON.parse(fs.readFileSync('srisai-skus.json', 'utf8'));

// Windows-safe folder name
function sanitize(name) {
  // Replace reserved chars: < > : " / \ | ? *
  let s = name.replace(/[<>:"/\\|?*]/g, '-');
  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ').trim();
  // Strip trailing dots/spaces (Windows disallows)
  s = s.replace(/[. ]+$/g, '');
  // Truncate to 200 chars to stay well under 255-char NAME_MAX (path total can be longer issue too)
  if (s.length > 180) s = s.substring(0, 180).trim();
  return s;
}

const indexRows = [['#', 'SKU Code', 'SKU Name (original)', 'Folder Name', 'Brand', 'Manufacturer', 'Pack', 'MRP', 'Image Count']];
const folderMap = []; // for image fetcher
const usedFolderNames = new Set();

for (const sku of skus) {
  let folder = sanitize(sku.skuName);
  // Handle duplicate folder names by appending SKU code suffix
  if (usedFolderNames.has(folder.toLowerCase())) {
    folder = `${folder} (${sku.skuCode.substring(0, 8)})`;
  }
  usedFolderNames.add(folder.toLowerCase());

  const fullPath = path.join(imgDir, folder);
  fs.mkdirSync(fullPath, { recursive: true });

  indexRows.push([
    sku.index,
    sku.skuCode,
    sku.skuName,
    folder,
    sku.brand,
    sku.manufacturer,
    `${sku.unitValue} ${sku.measureUnit}`,
    sku.mrp,
    0,
  ]);

  folderMap.push({
    index: sku.index,
    skuCode: sku.skuCode,
    skuName: sku.skuName,
    folder,
    folderPath: fullPath,
    brand: sku.brand,
    manufacturer: sku.manufacturer,
    pack: `${sku.unitValue} ${sku.measureUnit}`,
    mrp: sku.mrp,
  });
}

fs.writeFileSync(path.join(root, 'srisai-folder-map.json'), JSON.stringify(folderMap, null, 2));
console.log(`\nCreated ${skus.length} SKU folders under SKU_Images/`);
console.log(`Saved folder map: srisai-folder-map.json`);

// Build an index CSV inside the distributor folder
const csv = indexRows.map(r => r.map(c => {
  const s = String(c ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\n');
fs.writeFileSync(path.join(root, 'SKU-Folder-Index.csv'), csv);
console.log(`Saved index CSV: SKU-Folder-Index.csv`);
