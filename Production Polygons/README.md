# Production Polygons — Seller Portal Export

Exported from https://seller-portal.bms.qwipo.com (Super Admin). Last refreshed
**2026-08-12**, when HANUMAN ENTERPRISES and RASVITHA TRADERS were added; the
rest of the tree is from the 2026-07-30 full re-capture.

Structure: `<Seller Name>_<Mobile>/<Company Name>/<Beat Name>.geojson`

- 31 production sellers tracked (see `sellers-manifest.json`)
- 27 sellers have delivery beats → **869 polygon GeoJSON files** (all GeoJSON FeatureCollections)
- 4 sellers have **no delivery beats configured**:
  - ABDUL HASEEB MOHAMMED (MAS MARKETING) — 9866198219
  - UNNIKRISHNA KASAM (YLN AGENCIES) — 9030456547
  - Shalvi Mumbai Seller — 8329996029
  - Catalog Admin (Internal Catalog Seller) — 9182855346

## Refreshing

Capture straight from `seller-core-api` in a logged-in portal tab — for each
seller, `GET /api/admin/sellers/<id>/serviceability` lists the rules (with exact
`deliveryDays`, 1=Mon … 7=Sun), and `GET …/serviceability/<ruleId>/polygon`
returns the GeoJSON. Save one `{capturedAt, captured:[{seller, phone, company,
beat, days, text}]}` file, then:

```bash
node build-api-inventory.cjs <capture.json>   # rebuilds replica-inventory.json + folder tree
node build-prod-replica-seed.cjs              # regenerates src/app/lib/prod-replica-*-seed.ts
```

`build-api-inventory.cjs` **prunes** any beat file not present in the capture,
so a partial capture (one or two sellers) must be merged with the previous full
capture before running it. New sellers also need a profile entry in the `S` map
in `build-prod-replica-seed.cjs` and a row in `sellers-manifest.json`, and
`SELLERS_KEY` in `src/app/lib/mock-store.ts` must be bumped so existing
localStorage reseeds.

Notes:
- Company folder names have Windows-forbidden characters (`<>:"/\|?*`) and trailing dots replaced/stripped (e.g. `Msk Flavours.` → `Msk Flavours`).
- A beat served on multiple days appears once (one polygon per beat, days are metadata in the portal).
- `_captures/` holds the raw export payloads (`*.capture.json`). The older `*.capture.json` batches came from the superseded dialog-blob pipeline (`split-polygon-capture.cjs`), which inferred delivery days from beat names.

| Seller | Files | Companies |
|---|---|---|
| KAILASH CHAUDHARY_8121062768 | 260 | 13 |
| GAYATHRI VALLURI_9989998536 | 126 | 21 |
| JALIGUM VIJAYA LAKSHMI_9985229232 | 113 | 13 |
| VENKATA SHIVAJI VANAMA_9866781539 | 39 | 13 |
| AMARNATH PALLA_9440665515 | 38 | 7 |
| MYDHILI KAIPU_9247241176 | 35 | 5 |
| NARAYANA SWAMY DABBARA_9666687556 | 25 | 4 |
| Chintha Anusha_8686673441 | 24 | 4 |
| NARESH RAMAVTAR GUPTA_9821253909 | 24 | 12 |
| SACHIN AINAPUR_9160336789 | 24 | 4 |
| PRAVEEN KUMAR VENNU_8519877717 | 22 | 3 |
| Chintha Raja Mouli_9246172889 | 18 | 2 |
| VINODH MUTTINENI_9493018641 | 18 | 3 |
| PADIDELA JAGDEESHWAR RAO_9963120143 | 17 | 1 |
| DEVADASU DUDAM_9390164462 | 14 | 2 |
| DIVYA GOGINENI_9948028989 | 13 | 1 |
| POLAPAKA RUPESH KUMAR_9985633229 | 13 | 1 |
| SARANSH AGARWAL_7032401515 | 10 | 10 |
| KURA SRINIVAS_9704626876 | 9 | 2 |
| ASHOK PAREEK_8500011128 | 6 | 1 |
| VANSH AGARWAL_7702002017 | 6 | 1 |
| JHARAPLA SAROJA_8688340270 | 5 | 1 |
| VENKATESHWARLU DIDIGAM_9866444344 | 4 | 4 |
| Didigam Pavani_9346605566 | 3 | 1 |
| Ms Gurukumaran Nadar_9819139532 | 1 | 1 |
| Mvm Synergy Solutions LLP_9970169334 | 1 | 1 |
| Omkar Distributor_7773991199 | 1 | 1 |
