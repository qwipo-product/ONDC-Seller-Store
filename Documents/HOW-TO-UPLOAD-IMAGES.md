# Bulk-upload product images to Qwipo Seller Portal

This guide gets the remaining **124 SKU image sets** onto the seller portal in one unattended run, using your own Chrome (not the MCP-controlled tab).

## What you need
- The seller portal account you're already using (`omkar charankar / Omkar Distributor` on `seller-portal.test.bms.qwipo.com`).
- Chrome (or any Chromium browser) — your normal one.
- The file **`devtools-snippet.js`** in this folder.

## Steps

1. **Open the seller portal in your normal Chrome.** Go to:
   `https://seller-portal.test.bms.qwipo.com/my-sku`
   Sign in if needed.

2. **Open DevTools.** Press `F12` (or right-click → Inspect). Click the **Console** tab.

3. **Open the snippet file.** Double-click `devtools-snippet.js` to open it in Notepad (or any editor). Select all (`Ctrl+A`), copy (`Ctrl+C`).

4. **Paste into DevTools console** and press `Enter`.
   You'll see a banner:
   ```
   Qwipo bulk uploader ready.
   Auto-starting in 3 seconds. Stay on the /my-sku page.
   ```
   It starts automatically after 3 seconds.

5. **Leave the tab open.** The console will log progress:
   ```
   [1] ✅ SV_ENT_Swastik_0003  (28.4s)  | 123 left
   [2] ✅ SV_ENT_Swastik_0006  (26.1s)  | 122 left
   ...
   ```
   Expect ~25–35 seconds per SKU. Total runtime ≈ **60–80 minutes**.

6. **When it finishes** the console shows:
   ```
   ==== Worker finished ====
   Total processed: 124, ok: 122, fail: 2
   Failed SKUs:
     SV_ENT_Swastik_0XXX — save retries exhausted
   ```

## If you need to stop or check progress

In the DevTools console, type any of these:

| Command | What it does |
|---|---|
| `window.__qwipoUploader__.status()` | Print current queue length + ok/fail counts |
| `window.__qwipoUploader__.stop()` | Halt after the current SKU finishes |
| `window.__qwipoUploader__.start()` | Resume from where it left off |
| `window.__qwipoUploader__.failures()` | Table of failed SKUs with the error |
| `window.__qwipoUploader__.requeueFailures()` | Move failed SKUs back into the queue (then call `.start()`) |
| `window.__qwipoUploader__.reset()` | Wipe progress and start fresh (careful) |

## Notes

- **State is persistent.** If the tab crashes or you close it mid-run, just reload `/my-sku`, paste the snippet again, and it resumes from where it left off (queue + done list live in `localStorage`).
- **Image source.** The snippet fetches photos directly from `swastikspices.com` CDN inside your browser, then injects them into the portal's upload widget — same approach that worked for the first 7 SKUs in our earlier session.
- **Already-full SKUs are skipped.** If a SKU somehow already has 5/5 images, the snippet detects it and moves on without re-uploading.
- **Already-done SKUs are excluded** from the embedded queue: 0001, 0002, 0041, 0059, 0113, 0116, 0117 (the 7 we did together).
- **3 SKUs have no source** and aren't in the queue: 0105, 0106 (Cassia Bark), 0123 (CTC tea). Upload these manually if needed.

## If something looks wrong

- **Progress stalls on one SKU for >2 min** → the test portal is probably slow on save. `window.__qwipoUploader__.stop()`, then `.start()` will skip past it on the next attempt (failed SKUs go to the results, not back into queue).
- **"Session has expired" page appears** → sign back in, reload `/my-sku`, re-paste the snippet. It'll resume.
- **You want to redo a specific SKU** → on its detail page, manually delete its existing images, then re-paste the snippet OR just drag-and-drop the local JPGs from `SKU_Images/`.
