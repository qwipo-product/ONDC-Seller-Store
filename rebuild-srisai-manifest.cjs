// Rebuild manifest.json by walking SKU_Images on disk, matching to srisai-folder-map.json entries.
// Uses normalized name matching to defeat mojibake in the source map.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'Sri Sai Ram Agencies');
const IMAGES = path.join(ROOT, 'SKU_Images');
const MAP_PATH = path.join(ROOT, 'srisai-folder-map.json');
const OUT = path.join(ROOT, 'manifest.json');

const IMG_EXT = /\.(jpe?g|png|webp)$/i;
const SUFFIX = /\s*\([0-9a-f]{6,12}\)\s*$/;

// Mojibake: "â€“" is UTF-8 en-dash decoded as Windows-1252. Map it back to en-dash.
function norm(s) {
  return s
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€™/g, '’')
    .replace(/â€˜/g, '‘')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const rawMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const byPrefix = new Map();           // first 8 hex chars of skuCode -> entry
const byNormName = new Map();          // normalized name -> [entries]
for (const e of rawMap) {
  const prefix = e.skuCode.slice(0, 8).toLowerCase();
  byPrefix.set(prefix, e);
  const key = norm(e.folder || e.skuName || '');
  if (!byNormName.has(key)) byNormName.set(key, []);
  byNormName.get(key).push(e);
}

const dirs = fs.readdirSync(IMAGES, {withFileTypes: true}).filter(d => d.isDirectory()).map(d => d.name);

const manifest = [];
const unmatched = [];
const dupSkipped = [];
const seenSku = new Set();

for (const dir of dirs) {
  const suffixMatch = dir.match(/\(([0-9a-f]{8})\)\s*$/);
  let entry = null;
  if (suffixMatch) {
    entry = byPrefix.get(suffixMatch[1].toLowerCase());
  }
  if (!entry) {
    const cleaned = dir.replace(SUFFIX, '').trim();
    const key = norm(cleaned);
    const candidates = byNormName.get(key) || [];
    // Pick the candidate whose skuCode prefix is NOT used by a sibling folder with that prefix suffix
    if (candidates.length === 1) {
      entry = candidates[0];
    } else if (candidates.length > 1) {
      // Prefer the one whose prefix is NOT explicitly bound to another folder
      const used = new Set();
      for (const d of dirs) {
        const m = d.match(/\(([0-9a-f]{8})\)\s*$/);
        if (m) used.add(m[1].toLowerCase());
      }
      entry = candidates.find(c => !used.has(c.skuCode.slice(0, 8).toLowerCase())) || candidates[0];
    }
  }
  if (!entry) { unmatched.push(dir); continue; }
  pushEntry(entry, dir);
}

function pushEntry(entry, dir) {
  const folderFull = path.join(IMAGES, dir);
  const files = fs.readdirSync(folderFull).filter(f => IMG_EXT.test(f)).sort();
  if (!files.length) return;
  if (seenSku.has(entry.skuCode)) {
    dupSkipped.push({skuCode: entry.skuCode, dir});
    return;
  }
  seenSku.add(entry.skuCode);
  manifest.push({
    index: entry.index,
    skuCode: entry.skuCode,
    skuName: entry.skuName,
    folder: dir,
    files,
  });
}

manifest.sort((a, b) => a.index - b.index);
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`Wrote ${manifest.length} entries to manifest.json`);
console.log(`Unmatched folders (${unmatched.length}):`);
unmatched.forEach(d => console.log('  -', d));
console.log(`Duplicate-skipped folders (${dupSkipped.length}):`);
dupSkipped.forEach(d => console.log('  -', d.dir, '->', d.skuCode));
console.log(`SKUs in map but no folder matched: ${rawMap.length - manifest.length}`);
const matchedCodes = new Set(manifest.map(m => m.skuCode));
const missing = rawMap.filter(e => !matchedCodes.has(e.skuCode));
console.log(`Missing SKU codes (${missing.length}):`);
missing.forEach(e => console.log(`  - ${e.skuCode}  ${e.skuName}`));
