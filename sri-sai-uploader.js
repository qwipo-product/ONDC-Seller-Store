/*
 * Sri Sai Ram Agencies — bulk image uploader (10-tab parallel mode)
 *
 *  HOW TO USE:
 *    1. Start the local image server first:
 *         node "C:\Users\Lenovo\OneDrive - Xavica Primary\Desktop\Seller Store\serve-srisai-images.cjs" 8731
 *    2. Open https://seller-portal.test.bms.qwipo.com/my-sku in 10 different tabs.
 *    3. In EACH tab, open DevTools (F12) → Console.
 *    4. In tab N (N = 0..9), first run:        window.SRI_SAI_SLICE = N
 *       Then paste this entire file and press Enter.
 *    5. Each tab will process its own ~20 SKU slice. Leave them open.
 *
 *  CONTROL (in any tab):
 *    window.__sriSai.status()    -> queue & progress
 *    window.__sriSai.stop()      -> halt after current SKU
 *    window.__sriSai.start()     -> resume
 *    window.__sriSai.failures()  -> list failed SKUs (with error)
 *    window.__sriSai.requeueFailures()  -> move failed back into queue
 *    window.__sriSai.reset()     -> wipe this tab's progress
 */

(() => {
  if (window.__sriSai && window.__sriSai._running) {
    console.warn('[sriSai] Already running. Use window.__sriSai.stop() first.');
    return;
  }

  const SERVER = 'http://localhost:8731';
  const TOTAL_SLICES = 10;

  // ---- Pick slice -----------------------------------------------------------
  let slice = window.SRI_SAI_SLICE;
  if (slice === undefined || slice === null) {
    const fromUrl = new URLSearchParams(location.search).get('slice');
    if (fromUrl !== null) slice = parseInt(fromUrl, 10);
  }
  if (slice === undefined || slice === null || isNaN(slice)) {
    const p = prompt(`Enter slice number 0..${TOTAL_SLICES - 1}`);
    if (p === null) return;
    slice = parseInt(p, 10);
  }
  if (isNaN(slice) || slice < 0 || slice >= TOTAL_SLICES) {
    console.error('[sriSai] Bad slice:', slice);
    return;
  }
  const STORE_KEY = `sriSai-slice-${slice}`;
  const TAG = `[T${slice}]`;

  // ---- Utilities ------------------------------------------------------------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);

  function loadState() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveState(s) {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  async function waitFor(predicate, timeoutMs = 20000, interval = 200) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      try { const v = predicate(); if (v) return v; } catch {}
      await sleep(interval);
    }
    return null;
  }

  // ---- DOM helpers ----------------------------------------------------------
  function getSearchBox() {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.find(i => /search by/i.test(i.placeholder || ''));
  }
  function setNativeValue(el, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  async function goToList() {
    if (location.pathname.endsWith('/my-sku')) return true;
    // Prefer Angular SPA sidebar link
    const link = Array.from(document.querySelectorAll('a, button')).find(el =>
      /^\s*my\s*sku\s*$/i.test(el.textContent || '') && el.offsetParent !== null
    );
    if (link) { link.click(); await sleep(1500); }
    else { history.back(); await sleep(1500); }
    const ok = await waitFor(() => location.pathname.endsWith('/my-sku') && getSearchBox(), 15000);
    return !!ok;
  }
  function findDetailsButton(code) {
    const rows = Array.from(document.querySelectorAll('tbody tr'))
      .filter(r => r.textContent.includes(code));
    if (!rows.length) return null;
    return Array.from(rows[0].querySelectorAll('button'))
      .find(b => /details/i.test(b.textContent));
  }
  function getFileInput() {
    return document.querySelector('input[type="file"]');
  }
  function imagesCount() {
    // Look for the "0/5", "1/5", etc. label
    const allTxt = Array.from(document.querySelectorAll('*'))
      .filter(e => e.children.length === 0)
      .map(e => (e.textContent || '').trim());
    const m = allTxt.find(t => /^[0-5]\s*\/\s*5$/.test(t));
    if (!m) return null;
    return parseInt(m, 10);
  }
  function findSaveButton() {
    return Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent.trim() === 'Save'
    );
  }
  function dismissBlockingModal() {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      /got it|will fix|ok|continue/i.test(b.textContent) && b.offsetParent !== null
    );
    if (btn && /modal|dialog/i.test(btn.closest('[role]')?.getAttribute('role') || '')) {
      btn.click();
      return true;
    }
    return false;
  }
  async function complianceStatus() {
    // After save, check the SKU's compliance badge in the header area.
    // The detail page shows "Active" status badge — compliance is shown in /my-sku list.
    // We rely on Save succeeding (button disabled / enabled-again) + image count.
    return imagesCount();
  }

  // ---- XHR helpers (fetch is blocked in some injected-JS contexts) ---------
  function xhrJson(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = 'json';
      x.timeout = timeoutMs;
      x.onload = () => x.status === 200 ? resolve(x.response) : reject(new Error('HTTP ' + x.status));
      x.onerror = () => reject(new Error('network'));
      x.ontimeout = () => reject(new Error('timeout'));
      x.send();
    });
  }
  function xhrBlob(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = 'blob';
      x.timeout = timeoutMs;
      x.onload = () => x.status === 200 ? resolve(x.response) : reject(new Error('HTTP ' + x.status));
      x.onerror = () => reject(new Error('network'));
      x.ontimeout = () => reject(new Error('timeout'));
      x.send();
    });
  }

  // ---- Fetch image and build File[] ----------------------------------------
  async function fetchAsFile(folder, file) {
    const url = `${SERVER}/img/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
    const blob = await xhrBlob(url);
    const type = blob.type || 'image/jpeg';
    return new File([blob], file, { type });
  }

  // ---- Process one SKU -----------------------------------------------------
  async function processOne(item) {
    if (!await goToList()) throw new Error('cannot reach /my-sku');
    const search = getSearchBox();
    if (!search) throw new Error('no search box');

    setNativeValue(search, '');
    await sleep(400);
    setNativeValue(search, item.skuCode);
    await sleep(2200);

    const detailBtn = findDetailsButton(item.skuCode);
    if (!detailBtn) throw new Error('row not found after search');
    detailBtn.click();

    await sleep(2500);
    const fileInp = await waitFor(getFileInput, 15000);
    if (!fileInp) throw new Error('file input missing on detail page');

    // If already has images, skip (idempotent)
    let count = imagesCount();
    if (count === null) count = 0;
    if (count >= 5) {
      log(`✓ ${item.skuCode} already 5/5, skipping`);
      await goToList();
      return { skipped: true };
    }

    // Build File[] from server, take what we have, max 5
    const toUpload = item.files.slice(0, 5);
    const files = [];
    for (const f of toUpload) {
      files.push(await fetchAsFile(item.folder, f));
    }
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    fileInp.files = dt.files;
    fileInp.dispatchEvent(new Event('change', { bubbles: true }));
    fileInp.dispatchEvent(new Event('input',  { bubbles: true }));

    // Wait for the UI to register the files (count goes up), then click Save
    await waitFor(() => (imagesCount() || 0) >= files.length, 30000);

    let saved = false;
    for (let attempt = 1; attempt <= 4 && !saved; attempt++) {
      await sleep(attempt === 1 ? 4000 : 4000);
      const saveBtn = findSaveButton();
      if (!saveBtn) { saved = true; break; }
      if (saveBtn.disabled) {
        // Maybe still uploading thumbnails
        await sleep(3000);
        continue;
      }
      saveBtn.click();
      // Wait for Save to either become disabled-and-stay (success) or re-enabled (failure)
      let resolved = false;
      for (let i = 0; i < 80 && !resolved; i++) {
        await sleep(250);
        if (dismissBlockingModal()) continue;
        const s = findSaveButton();
        if (!s) { saved = true; resolved = true; break; }
        if (s.disabled) { saved = true; resolved = true; break; }
      }
    }
    if (!saved) throw new Error('save retries exhausted');

    await sleep(1500); // let backend update compliance
    await goToList();
    return { uploaded: files.length };
  }

  // ---- Main loop -----------------------------------------------------------
  async function runLoop() {
    // Load manifest, derive slice
    let manifest;
    try {
      manifest = await xhrJson(`${SERVER}/manifest.json`);
    } catch (e) {
      err('Cannot reach image server at', SERVER, ':', e.message);
      err('Did you run:  node serve-srisai-images.cjs 8731 ?');
      window.__sriSai._running = false;
      return;
    }

    const chunkSize = Math.ceil(manifest.length / TOTAL_SLICES);
    const mySlice = manifest.slice(slice * chunkSize, (slice + 1) * chunkSize);
    log(`manifest=${manifest.length}, my slice ${slice}: ${mySlice.length} SKUs (${mySlice[0]?.skuCode?.slice(0,8)}…${mySlice[mySlice.length-1]?.skuCode?.slice(0,8)})`);

    let state = loadState();
    if (!state.queue) {
      state = {
        queue: mySlice.map(e => e.skuCode),
        done: [],
        failed: [],
        skipped: [],
        startedAt: Date.now(),
      };
      saveState(state);
    }
    const bySku = Object.fromEntries(mySlice.map(e => [e.skuCode, e]));

    let processed = 0;
    while (window.__sriSai._running && state.queue.length) {
      const code = state.queue[0];
      const item = bySku[code];
      processed++;
      const t0 = Date.now();
      try {
        if (!item) throw new Error('not in this slice');
        const res = await processOne(item);
        const dt = ((Date.now() - t0)/1000).toFixed(1);
        const remaining = state.queue.length - 1;
        if (res?.skipped) {
          log(`[skip ${processed}] ${code.slice(0,8)} ${item.skuName.slice(0,40)} (${dt}s) | ${remaining} left`);
          state.skipped.push(code);
        } else {
          log(`✅ [${processed}] ${code.slice(0,8)} ${item.skuName.slice(0,40)} (${dt}s) | ${remaining} left`);
          state.done.push(code);
        }
        state.queue.shift();
      } catch (e) {
        warn(`❌ [${processed}] ${code.slice(0,8)} — ${e.message}`);
        state.failed.push({ code, error: e.message });
        state.queue.shift();
      }
      saveState(state);
      await sleep(800);
    }

    if (!state.queue.length) {
      log(`==== Slice ${slice} DONE ==== done=${state.done.length} skipped=${state.skipped.length} failed=${state.failed.length} elapsed=${((Date.now()-state.startedAt)/1000).toFixed(0)}s`);
      if (state.failed.length) console.table(state.failed);
    } else {
      log('paused — queue length', state.queue.length);
    }
    window.__sriSai._running = false;
  }

  window.__sriSai = {
    _running: false,
    slice,
    start() {
      if (this._running) { log('already running'); return; }
      this._running = true;
      runLoop().catch(e => err('loop crashed:', e.message));
    },
    stop() {
      this._running = false;
      log('stop requested — will halt after current SKU');
    },
    status() {
      const s = loadState();
      return { slice, running: this._running, queue: s.queue?.length || 0, done: s.done?.length || 0, skipped: s.skipped?.length || 0, failed: s.failed?.length || 0 };
    },
    failures() {
      const s = loadState();
      console.table(s.failed || []);
      return s.failed;
    },
    requeueFailures() {
      const s = loadState();
      const requeue = (s.failed || []).map(f => f.code);
      s.queue = (s.queue || []).concat(requeue);
      s.failed = [];
      saveState(s);
      log('Re-queued', requeue.length, 'failed SKUs. Call window.__sriSai.start() to resume.');
    },
    reset() {
      if (!confirm('Wipe progress for slice ' + slice + '?')) return;
      sessionStorage.removeItem(STORE_KEY);
      log('reset');
    },
  };

  log(`Sri Sai uploader ready (slice ${slice}). Auto-starting in 3s. Stay on /my-sku.`);
  log('Controls: window.__sriSai.status() / .stop() / .start() / .failures() / .reset()');
  setTimeout(() => window.__sriSai.start(), 3000);
})();
