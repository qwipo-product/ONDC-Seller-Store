// Batch image downloader for Sri Sai Ram Agencies SKUs
// Uses Bing image search HTML scrape. Resumable: skips SKUs that already have 4+ images.

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.join(__dirname, 'Sri Sai Ram Agencies');
const IMG_ROOT = path.join(ROOT, 'SKU_Images');
const MAP = path.join(ROOT, 'srisai-folder-map.json');
const LOG = path.join(ROOT, 'image-fetch-log.txt');
const TARGET = 4;
const MIN_BYTES = 4 * 1024; // 4 KB minimum to skip blank/placeholder images

const folderMap = JSON.parse(fs.readFileSync(MAP, 'utf8'));

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
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
        const nextUrl = new URL(res.headers.location, url).href;
        return resolve(fetchBinary(nextUrl, headers, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`status ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || '',
      }));
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
    } catch (e) { /* skip */ }
  }
  return results;
}

function buildQuery(sku) {
  // Strip pack-count suffix and clean for better search hits
  let name = sku.skuName
    .replace(/,\s*Pack of \d+/gi, '')
    .replace(/,\s*\d+\s*Pcs?\b/gi, '')
    .replace(/\s+\d+\+\d+\s*Offer/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const brand = (sku.brand || '').trim();
  // For incense, append "agarbathi" / "incense" if not present
  const nameLower = name.toLowerCase();
  const brandLower = brand.toLowerCase();
  const hints = [];
  if (['cycle', 'om shanthi', 'good luck', 'lia', 'rhythm', 'naivedya', 'flute'].includes(brandLower) &&
      !/(agarbathi|incense|dhoop|sambrani|stick)/i.test(nameLower)) {
    hints.push('agarbathi');
  }
  if (brandLower === 'grb' && !/ghee|sweet|halwa|mix|milk|dairy/i.test(nameLower)) {
    hints.push('ghee');
  }
  if (brandLower === 'priya' && !/(pickle|paste|powder|masala|oil|spice|ginger|garlic|chutney)/i.test(nameLower)) {
    hints.push('pickle');
  }
  if (brandLower === 'ajay' && !/(toothbrush|brush)/i.test(nameLower)) {
    hints.push('toothbrush');
  }
  // Ensure brand appears in query
  const hasBrand = nameLower.includes(brandLower);
  const parts = [hasBrand ? name : `${brand} ${name}`, ...hints, 'product'].filter(Boolean);
  return parts.join(' ');
}

function pickResults(results, n) {
  // Prefer different host domains, prefer larger images, skip tiny/icon-like
  const seenHost = new Set();
  const seenUrl = new Set();
  const picks = [];
  // First pass: unique hosts
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
  // Second pass: fill remaining from any unseen URLs
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
  if (/gif/i.test(contentType)) return '.gif';
  return '.jpg';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processSku(sku, idx, total) {
  const dir = sku.folderPath;
  let existing = [];
  try { existing = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f)); } catch (e) {}
  if (existing.length >= TARGET) {
    log(`[${idx}/${total}] SKIP ${sku.folder} — already has ${existing.length} images`);
    return { skipped: true };
  }

  const need = TARGET - existing.length;
  const query = buildQuery(sku);
  let results;
  try {
    results = await bingImageSearch(query);
  } catch (e) {
    log(`[${idx}/${total}] SEARCH FAIL ${sku.folder} (${query}): ${e.message}`);
    return { error: 'search' };
  }
  if (!results.length) {
    log(`[${idx}/${total}] NO RESULTS for "${query}"`);
    return { error: 'no_results' };
  }

  // Try up to 12 candidates to satisfy `need` valid downloads
  const candidates = pickResults(results, Math.min(12, results.length));
  let saved = existing.length;
  let nextIdx = existing.length + 1;

  for (const cand of candidates) {
    if (saved >= TARGET) break;
    try {
      const bin = await fetchBinary(cand.murl, { 'Referer': cand.purl || 'https://www.bing.com/' });
      if (!bin.contentType.startsWith('image/') && !/image/.test(bin.contentType)) {
        if (bin.body.length < MIN_BYTES) continue;
      }
      if (bin.body.length < MIN_BYTES) continue;
      const ext = extFromUrlOrType(cand.murl, bin.contentType);
      const fname = `image_${String(nextIdx).padStart(2, '0')}${ext}`;
      const fpath = path.join(dir, fname);
      fs.writeFileSync(fpath, bin.body);
      saved++;
      nextIdx++;
    } catch (e) {
      // skip and try next candidate
    }
  }

  // Save metadata
  const meta = {
    skuCode: sku.skuCode,
    skuName: sku.skuName,
    brand: sku.brand,
    query,
    fetchedAt: new Date().toISOString(),
    imageCount: saved,
    sources: candidates.slice(0, saved).map(c => ({ image: c.murl, page: c.purl, desc: c.desc })),
  };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2));

  log(`[${idx}/${total}] ${saved >= 1 ? 'OK' : 'EMPTY'} ${sku.folder} — saved ${saved}/${TARGET} | query: ${query}`);
  return { saved };
}

(async () => {
  // CLI args: --from N --to M to process a subset
  const args = process.argv.slice(2);
  let from = 1, to = folderMap.length;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') from = parseInt(args[++i], 10);
    if (args[i] === '--to') to = parseInt(args[++i], 10);
  }
  const subset = folderMap.filter(s => s.index >= from && s.index <= to);
  log(`=== Starting batch: ${subset.length} SKUs (index ${from}..${to}) ===`);

  let okCount = 0, skipCount = 0, errCount = 0;
  for (let i = 0; i < subset.length; i++) {
    const sku = subset[i];
    const result = await processSku(sku, sku.index, folderMap.length);
    if (result.skipped) skipCount++;
    else if (result.error) errCount++;
    else if (result.saved >= 1) okCount++;
    else errCount++;
    // small delay to avoid hammering Bing
    await sleep(700);
  }

  log(`=== Batch done: ok=${okCount} skip=${skipCount} err=${errCount} ===`);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
