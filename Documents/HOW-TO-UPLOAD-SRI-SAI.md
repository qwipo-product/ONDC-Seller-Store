# Sri Sai Ram Agencies — bulk image upload (10 tabs, parallel)

197 SKUs · 4 JPEGs each · ~10–15 minutes of unattended runtime.

The image server (`serve-srisai-images.cjs`) is **already running** in the background on
`http://localhost:8731`. The 10 Chrome tabs are **already open** on `/my-sku` and each
one already has its `window.SRI_SAI_SLICE` set (tab 1 = slice 0, tab 2 = slice 1, …).

## Step 1 — Copy the snippet (one time)

1. Open `sri-sai-uploader.js` (in this same folder) in Notepad.
2. `Ctrl+A`, `Ctrl+C`.

## Step 2 — Paste in each tab

For each of the 10 Sri Sai tabs (left → right):

1. Click into the tab.
2. Press `F12` → click the **Console** tab.
3. `Ctrl+V` to paste the snippet → press `Enter`.
4. You will see a banner like:
   ```
   [T3] Sri Sai uploader ready (slice 3). Auto-starting in 3s. Stay on /my-sku.
   ```
   The slice number is already filled in — no prompts.
5. Move to the next tab and repeat.

Total paste-time per tab: ~5 seconds. After all 10 are pasted, they run autonomously
and in parallel.

## Step 3 — Watch progress

Each tab logs its own progress like:
```
[T2] ✅ [1] e7dd12da Priya Ginger Garlic Paste, 200 Gm (12.4s) | 19 left
[T2] ✅ [2] 703d6b8d Priya Ginger Garlic Paste , 100 Gm (11.8s) | 18 left
```
When a tab finishes:
```
[T2] ==== Slice 2 DONE ==== done=20 skipped=0 failed=0 elapsed=247s
```

In the **My SKU** list each row will flip from **Non-compliant** → **Compliant**
as its Save succeeds. Refresh `/my-sku` to see fresh counts.

## Controls (any tab)

| Command                               | What it does                          |
|---------------------------------------|---------------------------------------|
| `window.__sriSai.status()`            | This tab's queue / done / failed      |
| `window.__sriSai.stop()`              | Halt after current SKU                |
| `window.__sriSai.start()`             | Resume                                |
| `window.__sriSai.failures()`          | Table of failed SKUs                  |
| `window.__sriSai.requeueFailures()`   | Move failed back into queue           |
| `window.__sriSai.reset()`             | Wipe this tab's progress              |

## If something goes wrong

- **"Cannot reach image server"** — the local Node server stopped. Restart it:
  ```
  node "C:\Users\Lenovo\OneDrive - Xavica Primary\Desktop\Seller Store\serve-srisai-images.cjs" 8731
  ```
- **Tab gets reloaded by mistake** — slice variable is lost. Set it again in console
  (`window.SRI_SAI_SLICE = N`) and re-paste the snippet. It resumes from sessionStorage.
- **"Session expired" page** — log back in with `9121222836` / `123456`, return to
  `/my-sku`, and re-paste.

## How the slices are split

197 SKUs ÷ 10 tabs = 20 per slice (last slice gets 17). The split is by manifest order,
so no two tabs touch the same SKU.

| Slice | Count |
|------:|------:|
| 0–9   |    20 |
| 10    |    17 |
