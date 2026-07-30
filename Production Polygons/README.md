# Production Polygons — Seller Portal Export

Exported from https://seller-portal.bms.qwipo.com (Super Admin → Sellers → Manage → Serviceability → Edit beat → Download existing) on 2026-07-24.

Structure: `<Seller Name>_<Mobile>/<Company Name>/<Beat Name>.geojson`

- 25 production sellers checked (see `sellers-manifest.json`)
- 19 sellers had delivery beats → **568 polygon GeoJSON files** (all validated as GeoJSON FeatureCollections)
- 6 sellers had **no delivery beats configured**:
  - PADIDELA JAGDEESHWAR RAO (JAGADISH AGENCIES) — 9963120143
  - ABDUL HASEEB MOHAMMED (MAS MARKETING) — 9866198219
  - UNNIKRISHNA KASAM (YLN AGENCIES) — 9030456547
  - POLAPAKA RUPESH KUMAR (JAI GANESH AGENCIES) — 9985633229
  - Shalvi Mumbai Seller — 8329996029
  - Catalog Admin (Internal Catalog Seller) — 9182855346

Notes:
- Company folder names have Windows-forbidden characters (`<>:"/\|?*`) and trailing dots replaced/stripped (e.g. `Msk Flavours.` → `Msk Flavours`).
- A beat served on multiple days appears once (one polygon per beat, days are metadata in the portal).
- `_captures/` holds the raw export payloads (`*.capture.json`); re-run `node split-polygon-capture.cjs <file>` to regenerate folders from them.

| Seller | Files | Companies |
|---|---|---|
| KAILASH CHAUDHARY_8121062768 | 260 | 13 |
| GAYATHRI VALLURI_9989998536 | 63 | 21 |
| VENKATA SHIVAJI VANAMA_9866781539 | 39 | 13 |
| AMARNATH PALLA_9440665515 | 38 | 7 |
| NARAYANA SWAMY DABBARA_9666687556 | 25 | 4 |
| SACHIN AINAPUR_9160336789 | 24 | 4 |
| PRAVEEN KUMAR VENNU_8519877717 | 22 | 3 |
| Chintha Raja Mouli_9246172889 | 18 | 2 |
| VINODH MUTTINENI_9493018641 | 18 | 3 |
| DEVADASU DUDAM_9390164462 | 14 | 2 |
| DIVYA GOGINENI_9948028989 | 13 | 1 |
| SARANSH AGARWAL_7032401515 | 10 | 10 |
| Chintha Anusha_8686673441 | 8 | 4 |
| ASHOK PAREEK_8500011128 | 6 | 1 |
| VENKATESHWARLU DIDIGAM_9866444344 | 4 | 4 |
| Didigam Pavani_9346605566 | 3 | 1 |
| Ms Gurukumaran Nadar_9819139532 | 1 | 1 |
| Mvm Synergy Solutions LLP_9970169334 | 1 | 1 |
| Omkar Distributor_7773991199 | 1 | 1 |
