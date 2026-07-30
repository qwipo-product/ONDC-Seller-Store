const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'Sri Sai Ram Agencies');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'srisai-folder-map.json'), 'utf8'));

// Group by skuName
const byName = {};
for (const s of map) {
  const k = s.skuName.toLowerCase().trim();
  byName[k] = byName[k] || [];
  byName[k].push(s);
}

let filled = 0;
for (const s of map) {
  const files = fs.readdirSync(s.folderPath).filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f));
  if (files.length >= 4) continue;
  const twins = byName[s.skuName.toLowerCase().trim()].filter(t => t.skuCode !== s.skuCode);
  if (!twins.length) continue;
  // Find a twin with >= 4 images
  const donor = twins.find(t => {
    try { return fs.readdirSync(t.folderPath).filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f)).length >= 4; }
    catch { return false; }
  });
  if (!donor) continue;
  const donorFiles = fs.readdirSync(donor.folderPath).filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f));
  // Wipe and copy
  for (const f of files) fs.unlinkSync(path.join(s.folderPath, f));
  for (const f of donorFiles) fs.copyFileSync(path.join(donor.folderPath, f), path.join(s.folderPath, f));
  console.log(`Filled "${s.folder}" from "${donor.folder}" (${donorFiles.length} images)`);
  filled++;
}

console.log(`\nFilled ${filled} thin-duplicate SKUs from their twins.`);
