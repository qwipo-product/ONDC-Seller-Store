// Re-fetch images for SKUs where the Excel brand column doesn't match the SKU name.
// Uses brand derived from SKU name (more authoritative).

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.join(__dirname, 'Sri Sai Ram Agencies');
const LOG = path.join(ROOT, 'image-refetch-log.txt');
const mismatches = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand-mismatches.json'), 'utf8'));
const folderMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'srisai-folder-map.json'), 'utf8'));

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG, line);
  process.stdout.write(line);
}

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...headers,
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(new URL(res.headers.location, url).href, headers));
      }
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

function fetchBinary(url, headers = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        ...headers,
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        return resolve(fetchBinary(new URL(res.headers.location, url).href, headers, maxRedirects - 1));
      }
      if (res.statusCode !== 200) return reject(new Error(`status ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
    req.setTimeout(25000, () => req.destroy(new Error('timeout')));
  });
}

async function bingImageSearch(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const r = await fetchText(url);
  if (r.status !== 200) throw new Error(`Bing status ${r.status}`);
  const re = /m=["']({[^"']+?})["']/g;
  const results = [];
  let m;
  while ((m = re.exec(r.body)) !== null) {
    try {
      const meta = JSON.parse(m[1].replace(/&quot;/g, '"'));
      if (meta.murl) results.push(meta);
    } catch (e) {}
  }
  return results;
}

function pickResults(results, n) {
  const seenHost = new Set();
  const seenUrl = new Set();
  const picks = [];
  for (const r of results) {
    if (picks.length >= n) break;
    try {
      const host = new URL(r.murl).host;
      if (seenHost.has(host)) continue;
      if (seenUrl.has(r.murl)) continue;
      seenHost.add(host);
      seenUrl.add(r.murl);
      picks.push(r);
    } catch (e) {}
  }
  if (picks.length < n) {
    for (const r of results) {
      if (picks.length >= n) break;
      if (seenUrl.has(r.murl)) continue;
      seenUrl.add(r.murl);
      picks.push(r);
    }
  }
  return picks;
}

function extFromUrlOrType(url, contentType) {
  let ext = path.extname(new URL(url).pathname).toLowerCase().replace(/[?#].*$/, '');
  if (/^\.(jpg|jpeg|png|webp|gif|avif)$/.test(ext)) return ext;
  if (/jpeg/i.test(contentType)) return '.jpg';
  if (/png/i.test(contentType)) return '.png';
  if (/webp/i.test(contentType)) return '.webp';
  return '.jpg';
}

function buildQueryFromName(skuName, correctBrand) {
  let name = skuName
    .replace(/,\s*Pack of \d+/gi, '')
    .replace(/,\s*\d+\s*Pcs?\b/gi, '')
    .replace(/\s+\d+\+\d+\s*Offer/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const brandLower = correctBrand.toLowerCase();
  const hints = [];
  if (['cycle', 'om shanthi', 'good luck', 'lia', 'rhythm', 'naivedya', 'flute'].includes(brandLower) &&
      !/(agarbathi|incense|dhoop|sambrani|stick|camphor|vibhuti|turmeric)/i.test(name.toLowerCase())) {
    hints.push('agarbathi');
  }
  if (brandLower === 'priya' && !/(pickle|paste|powder|masala|oil|spice|ginger|garlic|chutney)/i.test(name.toLowerCase())) {
    hints.push('pickle');
  }
  if (brandLower === 'ajay' && !/(toothbrush|brush)/i.test(name.toLowerCase())) {
    hints.push('toothbrush');
  }
  return [name, ...hints, 'product'].join(' ');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  log(`=== Re-fetching ${mismatches.length} brand-mismatch SKUs ===`);
  let ok = 0, err = 0;
  for (let i = 0; i < mismatches.length; i++) {
    const mm = mismatches[i];
    const sku = folderMap.find(s => s.skuCode === mm.skuCode);
    if (!sku) { log(`SKIP ${mm.skuCode} — not in folderMap`); err++; continue; }
    const correctBrand = mm.nameBrand;
    const query = buildQueryFromName(sku.skuName, correctBrand);

    // Wipe existing image files (not _meta.json)
    for (const f of fs.readdirSync(sku.folderPath)) {
      if (/\.(jpe?g|png|webp|gif|avif)$/i.test(f)) {
        fs.unlinkSync(path.join(sku.folderPath, f));
      }
    }

    let results;
    try { results = await bingImageSearch(query); } catch (e) {
      log(`[${i+1}/${mismatches.length}] SEARCH FAIL ${sku.folder}: ${e.message}`);
      err++; await sleep(700); continue;
    }
    const candidates = pickResults(results, 12);
    let saved = 0, nextIdx = 1;
    for (const c of candidates) {
      if (saved >= 4) break;
      try {
        const bin = await fetchBinary(c.murl, { 'Referer': c.purl || 'https://www.bing.com/' });
        if (bin.body.length < 4096) continue;
        const ext = extFromUrlOrType(c.murl, bin.contentType);
        fs.writeFileSync(path.join(sku.folderPath, `image_${String(nextIdx).padStart(2, '0')}${ext}`), bin.body);
        saved++; nextIdx++;
      } catch (e) {}
    }
    const meta = {
      skuCode: sku.skuCode,
      skuName: sku.skuName,
      brand: sku.brand,
      correctedBrand: correctBrand,
      query,
      refetchedAt: new Date().toISOString(),
      imageCount: saved,
      sources: candidates.slice(0, saved).map(c => ({ image: c.murl, page: c.purl, desc: c.desc })),
    };
    fs.writeFileSync(path.join(sku.folderPath, '_meta.json'), JSON.stringify(meta, null, 2));
    if (saved >= 1) ok++; else err++;
    log(`[${i+1}/${mismatches.length}] ${saved >= 1 ? 'OK' : 'EMPTY'} ${sku.folder} — saved ${saved}/4 | "${query}"`);
    await sleep(700);
  }
  log(`=== Refetch done: ok=${ok} err=${err} ===`);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
