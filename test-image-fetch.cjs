// Test Bing image search for one SKU
const https = require('https');

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...headers,
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetch(res.headers.location, headers));
      }
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

async function bingImageSearch(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const r = await fetch(url);
  if (r.status !== 200) throw new Error(`Bing status ${r.status}`);
  // Each result has m='{"murl":"...","turl":"...",...}'
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

(async () => {
  const query = 'Priya Mango Avakaya Pickle 1kg jar';
  console.log(`Query: ${query}`);
  const results = await bingImageSearch(query);
  console.log(`Got ${results.length} results`);
  results.slice(0, 8).forEach((r, i) => {
    console.log(`${i+1}. murl: ${r.murl}`);
    console.log(`   desc: ${r.desc} | purl: ${r.purl}`);
  });
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
