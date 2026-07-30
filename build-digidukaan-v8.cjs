/**
 * DigiDukaan Master Dashboard — v8.
 *
 * Built on top of v6/v7. New in v8:
 *   1. Two new KPI cards in a second KPI row (rows 5-6):
 *      - UNIQUE ORDERS    = unique order_id count across all statuses
 *      - UNIQUE CUSTOMERS = unique buyer_mobile count across all statuses
 *   2. Date-wise breakdown gains 3 value-breakdown columns BEFORE Total Value:
 *      - Open Value  (CREATED + ACCEPTED + PACKED + SHIPPED)
 *      - Delivered Value
 *      - Cancelled & Returned Value
 *      - Total Value (kept at the end)
 *
 * Every dimension list (sellers, dates, categories, brands) is still
 * built dynamically via _xlfn.UNIQUE(...) directly off RawData, so new
 * rows pasted into Sheet10 auto-appear in every block.
 *
 * Requires Excel 365 / 2021 / Excel Online (UNIQUE / SORT / FILTER).
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const JSZip = require('jszip');

const SRC = 'C:\\Users\\Lenovo\\Downloads\\Digidukaan Dashboard.xlsx';
const DST = 'C:\\Users\\Lenovo\\Downloads\\Digidukaan Dashboard - v8.xlsx';

const SORT_FN   = '_xlfn._xlws.SORT';
const UNIQUE_FN = '_xlfn.UNIQUE';
const FILTER_FN = '_xlfn._xlws.FILTER';

const N = 1200;

// RawData columns (source)
const R_ORDER  = `RawData!$A$2:$A$${N}`;
const R_SELLER = `RawData!$B$2:$B$${N}`;
const R_STATUS = `RawData!$D$2:$D$${N}`;
const R_BUYER  = `RawData!$E$2:$E$${N}`;
const R_MOBILE = `RawData!$F$2:$F$${N}`;
const R_BRAND  = `RawData!$K$2:$K$${N}`;
const R_CAT    = `RawData!$M$2:$M$${N}`;
const R_VALUE  = `RawData!$W$2:$W$${N}`;
// Helpers
const R_AK = `RawData!$AK$2:$AK$${N}`;
const R_AL = `RawData!$AL$2:$AL$${N}`;
const R_AM = `RawData!$AM$2:$AM$${N}`;
const R_AN = `RawData!$AN$2:$AN$${N}`;
const R_AO = `RawData!$AO$2:$AO$${N}`;
const R_AP = `RawData!$AP$2:$AP$${N}`;
const R_AQ = `RawData!$AQ$2:$AQ$${N}`;
const R_AR = `RawData!$AR$2:$AR$${N}`;
const R_AS = `RawData!$AS$2:$AS$${N}`;
const R_AT = `RawData!$AT$2:$AT$${N}`;
const R_AU = `RawData!$AU$2:$AU$${N}`;
const R_AV = `RawData!$AV$2:$AV$${N}`;
const R_AW = `RawData!$AW$2:$AW$${N}`;
const R_AX = `RawData!$AX$2:$AX$${N}`;
const R_AY = `RawData!$AY$2:$AY$${N}`;
const R_AZ = `RawData!$AZ$2:$AZ$${N}`;
const R_BA = `RawData!$BA$2:$BA$${N}`;

const COLOR = {
  navy:   'FF1F3864',
  ink:    'FF1F3864',
  white:  'FFFFFFFF',
  band:   'FFF2F4F8',
  band2:  'FFFFFFFF',
  kpiBg:  'FF4472C4',
  kpiBg2: 'FF5B9BD5',
  kpiVal: 'FFFFE699',
  kpiVal2:'FFD9E1F2',
  border: 'FFB4B4B4',
  total:  'FF305496',
  helper: 'FF548135',
};

const thinB = { style: 'thin', color: { argb: COLOR.border } };
const thinAll = { top: thinB, bottom: thinB, left: thinB, right: thinB };

function sectionHeader(cell, text) {
  cell.value = text;
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR.white } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.navy } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
}
function columnHeader(cell, text) {
  cell.value = text;
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.ink } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = thinAll;
}
function bandCell(cell, i) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? COLOR.band : COLOR.band2 } };
  cell.border = thinAll;
}
function styleTotalRow(cell) {
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.white } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.total } };
  const med = { style: 'medium', color: { argb: COLOR.ink } };
  cell.border = { top: med, bottom: med, left: thinB, right: thinB };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

async function main() {
  const wbSrc = new ExcelJS.Workbook();
  await wbSrc.xlsx.readFile(SRC);
  const rawSrc = wbSrc.getWorksheet('Sheet10');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Digidukaan Builder v8';
  const dash = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false, state: 'normal' }] });
  const raw  = wb.addWorksheet('RawData', { views: [{ state: 'frozen', ySplit: 1 }] });

  // ── Copy RawData (values only) ───────────────────────────────────────
  const headerRow = rawSrc.getRow(1);
  const headers = [];
  for (let c = 1; c <= rawSrc.columnCount; c++) {
    const v = headerRow.getCell(c).value;
    headers.push(v && typeof v === 'object' ? (v.text || v.result || '') : v);
  }
  raw.addRow(headers);
  for (let c = 1; c <= headers.length; c++) {
    raw.getRow(1).getCell(c).font = { bold: true, color: { argb: COLOR.white } };
    raw.getRow(1).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.navy } };
    raw.getRow(1).getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
  }
  raw.getRow(1).height = 22;
  for (let r = 2; r <= rawSrc.rowCount; r++) {
    const srcRow = rawSrc.getRow(r);
    const data = [];
    for (let c = 1; c <= rawSrc.columnCount; c++) {
      const v = srcRow.getCell(c).value;
      data.push(v && typeof v === 'object' ? (v.text || v.result || v) : v);
    }
    raw.addRow(data);
  }
  for (let c = 1; c <= rawSrc.columnCount; c++) raw.getColumn(c).width = 14;

  // ── Helper columns AK..BA (rows 2..N) ──
  const helperHeaders = {
    AK: 'first_order_per_buyer',
    AL: 'first_buyer',
    AM: 'orders_for_this_buyer',
    AN: 'first_seller_for_order',
    AO: 'first_seller_for_buyer',
    AP: 'first_seller',
    AQ: 'first_category_for_order',
    AR: 'first_brand_for_order',
    AS: 'first_brand',
    AT: 'freq_bucket',
    AU: 'parsed_date',
    AV: 'line_total_clean',
    AW: 'first_order_overall',
    AX: 'first_seller_for_date',
    AY: 'first_buyer_for_date',
    AZ: 'first_seller_overall',
    BA: 'first_buyer_overall',
  };
  for (const col of Object.keys(helperHeaders)) {
    const cell = raw.getCell(`${col}1`);
    cell.value = helperHeaders[col];
    cell.font = { bold: true, color: { argb: COLOR.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.helper } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    raw.getColumn(col).width = 18;
  }

  for (let r = 2; r <= N; r++) {
    const nc = `D${r}<>"CANCELLED"`;
    const nonE = (c) => `${c}${r}<>""`;

    raw.getCell(`AK${r}`).value = { formula:
      `IF(AND(${nc},${nonE('F')},${nonE('A')},COUNTIFS($F$2:F${r},F${r},$A$2:A${r},A${r},$D$2:D${r},"<>CANCELLED")=1),1,0)` };
    raw.getCell(`AL${r}`).value = { formula:
      `IF(AND(${nc},${nonE('F')},COUNTIFS($F$2:F${r},F${r},$D$2:D${r},"<>CANCELLED")=1),1,0)` };
    raw.getCell(`AM${r}`).value = { formula:
      `IF(F${r}="",0,SUMIFS($AK$2:$AK$${N},$F$2:$F$${N},F${r}))` };
    raw.getCell(`AN${r}`).value = { formula:
      `IF(AND(${nc},${nonE('B')},${nonE('A')},COUNTIFS($B$2:B${r},B${r},$A$2:A${r},A${r},$D$2:D${r},"<>CANCELLED")=1),1,0)` };
    raw.getCell(`AO${r}`).value = { formula:
      `IF(AND(${nc},${nonE('B')},${nonE('F')},COUNTIFS($B$2:B${r},B${r},$F$2:F${r},F${r},$D$2:D${r},"<>CANCELLED")=1),1,0)` };
    raw.getCell(`AP${r}`).value = { formula:
      `IF(AND(${nc},${nonE('B')},COUNTIFS($B$2:B${r},B${r},$D$2:D${r},"<>CANCELLED")=1),1,0)` };
    raw.getCell(`AQ${r}`).value = { formula:
      `IF(AND(${nc},${nonE('M')},${nonE('A')},COUNTIFS($M$2:M${r},M${r},$A$2:A${r},A${r},$D$2:D${r},"<>CANCELLED")=1),1,0)` };
    raw.getCell(`AR${r}`).value = { formula:
      `IF(AND(${nc},${nonE('K')},${nonE('A')},COUNTIFS($K$2:K${r},K${r},$A$2:A${r},A${r},$D$2:D${r},"<>CANCELLED")=1),1,0)` };
    raw.getCell(`AS${r}`).value = { formula:
      `IF(AND(${nc},${nonE('K')},COUNTIFS($K$2:K${r},K${r},$D$2:D${r},"<>CANCELLED")=1),1,0)` };
    raw.getCell(`AT${r}`).value = { formula:
      `IF(OR(AM${r}="",AM${r}=0),"",IF(AM${r}>=Dashboard!$A$4,"TIER1",IF(AM${r}>=4*Dashboard!$A$4/7,"TIER2",IF(AM${r}>=2*Dashboard!$A$4/7,"TIER3","TIER4"))))` };
    raw.getCell(`AU${r}`).value = { formula:
      `IF(C${r}="","",IF(ISNUMBER(C${r}),INT(C${r}),IFERROR(DATE(VALUE(LEFT(C${r},4)),VALUE(MID(C${r},6,2)),VALUE(MID(C${r},9,2))),"")))` };
    raw.getCell(`AV${r}`).value = { formula:
      `IFERROR(VALUE(W${r}),0)` };
    raw.getCell(`AW${r}`).value = { formula:
      `IF(AND(A${r}<>"",COUNTIF($A$2:A${r},A${r})=1),1,0)` };
    raw.getCell(`AX${r}`).value = { formula:
      `IF(AND(AU${r}<>"",B${r}<>"",COUNTIFS($AU$2:AU${r},AU${r},$B$2:B${r},B${r})=1),1,0)` };
    raw.getCell(`AY${r}`).value = { formula:
      `IF(AND(AU${r}<>"",F${r}<>"",COUNTIFS($AU$2:AU${r},AU${r},$F$2:F${r},F${r})=1),1,0)` };
    raw.getCell(`AZ${r}`).value = { formula:
      `IF(AND(B${r}<>"",COUNTIF($B$2:B${r},B${r})=1),1,0)` };
    raw.getCell(`BA${r}`).value = { formula:
      `IF(AND(F${r}<>"",COUNTIF($F$2:F${r},F${r})=1),1,0)` };
  }

  // ────────────────────── Dashboard ──────────────────────
  // Dashboard now spans columns A..T (20 cols) — date block widened with
  // 3 new value-breakdown columns.
  const widths = [26, 13, 13, 14, 14, 12, 12, 18,
                  13, 9, 9, 9, 10, 10, 10, 10, 15, 15, 17, 15];
  for (let i = 0; i < widths.length; i++) dash.getColumn(i + 1).width = widths[i];

  // Title row 1 — span the full new width (A..T)
  dash.mergeCells('A1:T1');
  const title = dash.getCell('A1');
  title.value = 'DigiDukaan Master Dashboard';
  title.font = { name: 'Calibri', size: 22, bold: true, color: { argb: COLOR.white } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.navy } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  dash.getRow(1).height = 38;
  dash.getRow(2).height = 8;

  function makeKpi(labelRange, valueRange, label, value, numFmt, opts) {
    opts = opts || {};
    dash.mergeCells(labelRange);
    dash.mergeCells(valueRange);
    const lc = dash.getCell(labelRange.split(':')[0]);
    const vc = dash.getCell(valueRange.split(':')[0]);
    lc.value = label;
    lc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.white } };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.labelBg || COLOR.kpiBg } };
    lc.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    if (typeof value === 'string' && value.startsWith('=')) vc.value = { formula: value.slice(1) };
    else vc.value = value;
    vc.font = { name: 'Calibri', size: 18, bold: true, color: { argb: COLOR.ink } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.valBg || COLOR.kpiVal } };
    vc.alignment = { vertical: 'middle', horizontal: 'center' };
    if (numFmt) vc.numFmt = numFmt;
  }

  // KPI row 1 — rows 3-4 (existing 8 cards)
  dash.getRow(3).height = 18;
  dash.getRow(4).height = 36;
  makeKpi('A3:B3', 'A4:B4', 'DAYS OF OPS (editable)', 12, '#,##0');
  makeKpi('C3:D3', 'C4:D4', 'No. of SELLERS', `=SUM(${R_AP})`, '#,##0');
  makeKpi('E3:F3', 'E4:F4', 'TRANSACTING RETAILERS', `=SUM(${R_AL})`, '#,##0');
  makeKpi('G3:H3', 'G4:H4', 'TOTAL ORDERS', `=SUM(${R_AK})`, '#,##0');
  makeKpi('I3:J3', 'I4:J4', 'TOTAL VALUE',
    `=SUMIFS(${R_AV},${R_STATUS},"<>CANCELLED")`, '"Rs. "#,##0');
  makeKpi('K3:L3', 'K4:L4', 'AOV (Avg Order Value)',
    `=IFERROR(SUMIFS(${R_AV},${R_STATUS},"<>CANCELLED")/SUM(${R_AK}),0)`, '"Rs. "#,##0');
  makeKpi('M3:N3', 'M4:N4', 'DATE RANGE',
    `=IFERROR(IF(MAX(${R_AU})=0,"",TEXT(MAX(${R_AU})-$A$4+1,"dd-mmm")&" - "&TEXT(MAX(${R_AU}),"dd-mmm-yy")),"")`, '@');
  makeKpi('O3:P3', 'O4:P4', 'BRANDS LIVE', `=SUM(${R_AS})`, '#,##0');

  // KPI row 2 — rows 5-6 (NEW: unique orders + unique customers)
  dash.getRow(5).height = 18;
  dash.getRow(6).height = 36;
  makeKpi('A5:B5', 'A6:B6', 'UNIQUE ORDERS (all statuses)',
    `=SUM(${R_AW})`, '#,##0',
    { labelBg: COLOR.kpiBg2, valBg: COLOR.kpiVal2 });
  makeKpi('C5:D5', 'C6:D6', 'UNIQUE CUSTOMERS (mobiles transacted)',
    `=SUM(${R_BA})`, '#,##0',
    { labelBg: COLOR.kpiBg2, valBg: COLOR.kpiVal2 });

  dash.getRow(7).height = 14;

  // Section block start shifted +2 rows compared to v6/v7 (because of new KPI row)
  const ROW_OFFSET = 2;

  // ── DISTRIBUTOR BLOCK (A-G) ──
  const DIST_TITLE = 8 + ROW_OFFSET;     // 10
  const DIST_HDR   = 9 + ROW_OFFSET;     // 11
  const DIST_START = 10 + ROW_OFFSET;    // 12
  const DIST_CAP   = 20;
  const DIST_END   = DIST_START + DIST_CAP - 1;  // 31
  const DIST_TOTAL = DIST_END + 1;                // 32

  dash.mergeCells(`A${DIST_TITLE}:H${DIST_TITLE}`);
  sectionHeader(dash.getCell(`A${DIST_TITLE}`), '   DISTRIBUTOR-WISE SNAPSHOT');
  dash.getRow(DIST_TITLE).height = 24;
  const dHdrs = ['Distributor', 'Outlets', 'Orders', 'Value (Rs.)', 'AOV (Rs.)', '% Value', '% Orders'];
  for (let i = 0; i < dHdrs.length; i++) columnHeader(dash.getRow(DIST_HDR).getCell(i + 1), dHdrs[i]);
  dash.getRow(DIST_HDR).height = 30;

  dash.getCell(`A${DIST_START}`).value = { formula: `${UNIQUE_FN}(${R_SELLER})` };

  for (let r = DIST_START; r <= DIST_END; r++) {
    const aRef = `A${r}`;
    const blank = `${aRef}=""`;
    dash.getCell(`B${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AO},${R_SELLER},${aRef}))` };
    dash.getCell(`C${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AN},${R_SELLER},${aRef}))` };
    dash.getCell(`D${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AV},${R_SELLER},${aRef},${R_STATUS},"<>CANCELLED"))` };
    dash.getCell(`E${r}`).value = { formula: `IFERROR(D${r}/C${r},"")` };
    dash.getCell(`F${r}`).value = { formula: `IFERROR(D${r}/$D$${DIST_TOTAL},"")` };
    dash.getCell(`G${r}`).value = { formula: `IFERROR(C${r}/$C$${DIST_TOTAL},"")` };

    for (let c = 1; c <= 7; c++) {
      bandCell(dash.getRow(r).getCell(c), r - DIST_START);
      dash.getRow(r).getCell(c).alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
    }
    dash.getCell(`B${r}`).numFmt = '#,##0';
    dash.getCell(`C${r}`).numFmt = '#,##0';
    dash.getCell(`D${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`E${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`F${r}`).numFmt = '0.0%';
    dash.getCell(`G${r}`).numFmt = '0.0%';
  }

  for (let c = 1; c <= 7; c++) styleTotalRow(dash.getRow(DIST_TOTAL).getCell(c));
  dash.getCell(`A${DIST_TOTAL}`).value = 'GRAND TOTAL';
  dash.getCell(`A${DIST_TOTAL}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  dash.getCell(`B${DIST_TOTAL}`).value = { formula: `SUM(B${DIST_START}:B${DIST_END})` };
  dash.getCell(`C${DIST_TOTAL}`).value = { formula: `SUM(C${DIST_START}:C${DIST_END})` };
  dash.getCell(`D${DIST_TOTAL}`).value = { formula: `SUM(D${DIST_START}:D${DIST_END})` };
  dash.getCell(`E${DIST_TOTAL}`).value = { formula: `IFERROR(D${DIST_TOTAL}/C${DIST_TOTAL},0)` };
  dash.getCell(`F${DIST_TOTAL}`).value = { formula: `SUM(F${DIST_START}:F${DIST_END})` };
  dash.getCell(`G${DIST_TOTAL}`).value = { formula: `SUM(G${DIST_START}:G${DIST_END})` };
  dash.getCell(`B${DIST_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`C${DIST_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`D${DIST_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`E${DIST_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`F${DIST_TOTAL}`).numFmt = '0.0%';
  dash.getCell(`G${DIST_TOTAL}`).numFmt = '0.0%';

  dash.addConditionalFormatting({
    ref: `D${DIST_START}:D${DIST_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF4472C4' }, priority: 1 }],
  });
  dash.addConditionalFormatting({
    ref: `C${DIST_START}:C${DIST_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF70AD47' }, priority: 2 }],
  });

  // ── DATE-WISE BLOCK (I-T) — now 12 columns wide ──
  // I=Date, J=Sellers, K=Orders, L=Open, M=Delivered, N=Cancelled, O=Returned,
  // P=Buyers, Q=Open Value, R=Delivered Value, S=Cancelled+Returned Value, T=Total Value
  const DATE_TITLE = 8 + ROW_OFFSET;     // 10
  const DATE_HDR   = 9 + ROW_OFFSET;     // 11
  const DATE_START = 10 + ROW_OFFSET;    // 12
  const DATE_CAP   = 60;
  const DATE_END   = DATE_START + DATE_CAP - 1;  // 71
  const DATE_TOTAL = DATE_END + 1;                // 72

  dash.mergeCells(`I${DATE_TITLE}:T${DATE_TITLE}`);
  sectionHeader(dash.getCell(`I${DATE_TITLE}`), '   DATE-WISE BREAKDOWN');
  dash.getRow(DATE_TITLE).height = 24;
  const dateHdrs = ['Date', 'Sellers', 'Orders', 'Open', 'Delivered', 'Cancelled', 'Returned',
                    'Buyers', 'Open Value (Rs.)', 'Delivered Value (Rs.)',
                    'Cancelled & Returned Value (Rs.)', 'Total Value (Rs.)'];
  for (let i = 0; i < dateHdrs.length; i++) columnHeader(dash.getRow(DATE_HDR).getCell(9 + i), dateHdrs[i]);
  dash.getRow(DATE_HDR).height = 42;

  dash.getCell(`I${DATE_START}`).value = { formula: `${UNIQUE_FN}(${R_AU})` };

  const OPEN_STATUSES = ['CREATED', 'ACCEPTED', 'PACKED', 'SHIPPED'];

  for (let r = DATE_START; r <= DATE_END; r++) {
    const iRef = `I${r}`;
    const blank = `${iRef}=""`;
    const openCntF = OPEN_STATUSES.map(s => `SUMIFS(${R_AW},${R_AU},${iRef},${R_STATUS},"${s}")`).join('+');
    const openValF = OPEN_STATUSES.map(s => `SUMIFS(${R_AV},${R_AU},${iRef},${R_STATUS},"${s}")`).join('+');

    // Counts
    dash.getCell(`J${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AX},${R_AU},${iRef}))` };
    dash.getCell(`K${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AW},${R_AU},${iRef}))` };
    dash.getCell(`L${r}`).value = { formula: `IF(${blank},"",${openCntF})` };
    dash.getCell(`M${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AW},${R_AU},${iRef},${R_STATUS},"DELIVERED"))` };
    dash.getCell(`N${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AW},${R_AU},${iRef},${R_STATUS},"CANCELLED"))` };
    dash.getCell(`O${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AW},${R_AU},${iRef},${R_STATUS},"RETURNED"))` };
    dash.getCell(`P${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AY},${R_AU},${iRef}))` };
    // Values: open / delivered / cancelled+returned / total
    dash.getCell(`Q${r}`).value = { formula: `IF(${blank},"",${openValF})` };
    dash.getCell(`R${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AV},${R_AU},${iRef},${R_STATUS},"DELIVERED"))` };
    dash.getCell(`S${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AV},${R_AU},${iRef},${R_STATUS},"CANCELLED")+SUMIFS(${R_AV},${R_AU},${iRef},${R_STATUS},"RETURNED"))` };
    dash.getCell(`T${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AV},${R_AU},${iRef}))` };

    for (let ci = 0; ci < 12; ci++) {
      const c = dash.getRow(r).getCell(9 + ci);
      bandCell(c, r - DATE_START);
      c.alignment = { vertical: 'middle', horizontal: ci === 0 ? 'left' : 'center' };
    }
    dash.getCell(`I${r}`).numFmt = 'yyyy-mm-dd';
    dash.getCell(`J${r}`).numFmt = '#,##0';
    dash.getCell(`K${r}`).numFmt = '#,##0';
    dash.getCell(`L${r}`).numFmt = '#,##0';
    dash.getCell(`M${r}`).numFmt = '#,##0';
    dash.getCell(`N${r}`).numFmt = '#,##0';
    dash.getCell(`O${r}`).numFmt = '#,##0';
    dash.getCell(`P${r}`).numFmt = '#,##0';
    dash.getCell(`Q${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`R${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`S${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`T${r}`).numFmt = '"Rs. "#,##0';
  }

  for (let ci = 0; ci < 12; ci++) styleTotalRow(dash.getRow(DATE_TOTAL).getCell(9 + ci));
  dash.getCell(`I${DATE_TOTAL}`).value = 'TOTAL';
  dash.getCell(`I${DATE_TOTAL}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  dash.getCell(`J${DATE_TOTAL}`).value = { formula: `SUM(${R_AZ})` };
  dash.getCell(`K${DATE_TOTAL}`).value = { formula: `SUM(${R_AW})` };
  dash.getCell(`L${DATE_TOTAL}`).value = { formula: OPEN_STATUSES.map(s => `SUMIFS(${R_AW},${R_STATUS},"${s}")`).join('+') };
  dash.getCell(`M${DATE_TOTAL}`).value = { formula: `SUMIFS(${R_AW},${R_STATUS},"DELIVERED")` };
  dash.getCell(`N${DATE_TOTAL}`).value = { formula: `SUMIFS(${R_AW},${R_STATUS},"CANCELLED")` };
  dash.getCell(`O${DATE_TOTAL}`).value = { formula: `SUMIFS(${R_AW},${R_STATUS},"RETURNED")` };
  dash.getCell(`P${DATE_TOTAL}`).value = { formula: `SUM(${R_BA})` };
  dash.getCell(`Q${DATE_TOTAL}`).value = { formula: OPEN_STATUSES.map(s => `SUMIFS(${R_AV},${R_STATUS},"${s}")`).join('+') };
  dash.getCell(`R${DATE_TOTAL}`).value = { formula: `SUMIFS(${R_AV},${R_STATUS},"DELIVERED")` };
  dash.getCell(`S${DATE_TOTAL}`).value = { formula: `SUMIFS(${R_AV},${R_STATUS},"CANCELLED")+SUMIFS(${R_AV},${R_STATUS},"RETURNED")` };
  dash.getCell(`T${DATE_TOTAL}`).value = { formula: `SUM(${R_AV})` };
  dash.getCell(`J${DATE_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`K${DATE_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`L${DATE_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`M${DATE_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`N${DATE_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`O${DATE_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`P${DATE_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`Q${DATE_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`R${DATE_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`S${DATE_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`T${DATE_TOTAL}`).numFmt = '"Rs. "#,##0';

  dash.addConditionalFormatting({
    ref: `T${DATE_START}:T${DATE_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF4472C4' }, priority: 3 }],
  });
  dash.addConditionalFormatting({
    ref: `K${DATE_START}:K${DATE_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF70AD47' }, priority: 4 }],
  });

  // ── CATEGORY BLOCK ──
  const blockStart = Math.max(DIST_TOTAL, DATE_TOTAL) + 2;
  const CAT_TITLE  = blockStart;
  const CAT_HDR    = CAT_TITLE + 1;
  const CAT_START  = CAT_HDR + 1;
  const CAT_CAP    = 30;
  const CAT_END    = CAT_START + CAT_CAP - 1;
  const CAT_TOTAL  = CAT_END + 1;

  dash.mergeCells(`A${CAT_TITLE}:H${CAT_TITLE}`);
  sectionHeader(dash.getCell(`A${CAT_TITLE}`), '   CATEGORY-WISE SNAPSHOT');
  dash.getRow(CAT_TITLE).height = 24;
  const catHdrs = ['Category', 'Orders', 'Value (Rs.)', 'AOV (Rs.)', '% Value', '% Orders'];
  for (let i = 0; i < catHdrs.length; i++) columnHeader(dash.getRow(CAT_HDR).getCell(i + 1), catHdrs[i]);
  dash.getRow(CAT_HDR).height = 30;

  dash.getCell(`A${CAT_START}`).value = { formula: `${UNIQUE_FN}(${R_CAT})` };

  for (let r = CAT_START; r <= CAT_END; r++) {
    const aRef = `A${r}`;
    const blank = `${aRef}=""`;
    dash.getCell(`B${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AQ},${R_CAT},${aRef}))` };
    dash.getCell(`C${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AV},${R_CAT},${aRef},${R_STATUS},"<>CANCELLED"))` };
    dash.getCell(`D${r}`).value = { formula: `IFERROR(C${r}/B${r},"")` };
    dash.getCell(`E${r}`).value = { formula: `IFERROR(C${r}/$C$${CAT_TOTAL},"")` };
    dash.getCell(`F${r}`).value = { formula: `IFERROR(B${r}/$B$${CAT_TOTAL},"")` };

    for (let c = 1; c <= 6; c++) {
      bandCell(dash.getRow(r).getCell(c), r - CAT_START);
      dash.getRow(r).getCell(c).alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
    }
    dash.getCell(`B${r}`).numFmt = '#,##0';
    dash.getCell(`C${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`D${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`E${r}`).numFmt = '0.0%';
    dash.getCell(`F${r}`).numFmt = '0.0%';
  }

  for (let c = 1; c <= 6; c++) styleTotalRow(dash.getRow(CAT_TOTAL).getCell(c));
  dash.getCell(`A${CAT_TOTAL}`).value = 'GRAND TOTAL';
  dash.getCell(`A${CAT_TOTAL}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  dash.getCell(`B${CAT_TOTAL}`).value = { formula: `SUM(B${CAT_START}:B${CAT_END})` };
  dash.getCell(`C${CAT_TOTAL}`).value = { formula: `SUM(C${CAT_START}:C${CAT_END})` };
  dash.getCell(`D${CAT_TOTAL}`).value = { formula: `IFERROR(C${CAT_TOTAL}/B${CAT_TOTAL},0)` };
  dash.getCell(`E${CAT_TOTAL}`).value = { formula: `SUM(E${CAT_START}:E${CAT_END})` };
  dash.getCell(`F${CAT_TOTAL}`).value = { formula: `SUM(F${CAT_START}:F${CAT_END})` };
  dash.getCell(`B${CAT_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`C${CAT_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`D${CAT_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`E${CAT_TOTAL}`).numFmt = '0.0%';
  dash.getCell(`F${CAT_TOTAL}`).numFmt = '0.0%';

  dash.addConditionalFormatting({
    ref: `C${CAT_START}:C${CAT_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF4472C4' }, priority: 5 }],
  });
  dash.addConditionalFormatting({
    ref: `B${CAT_START}:B${CAT_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF70AD47' }, priority: 6 }],
  });

  // ── BRAND BLOCK ──
  const BRAND_TITLE = CAT_TOTAL + 2;
  const BRAND_HDR   = BRAND_TITLE + 1;
  const BRAND_START = BRAND_HDR + 1;
  const BRAND_CAP   = 80;
  const BRAND_END   = BRAND_START + BRAND_CAP - 1;
  const BRAND_TOTAL = BRAND_END + 1;

  dash.mergeCells(`A${BRAND_TITLE}:H${BRAND_TITLE}`);
  sectionHeader(dash.getCell(`A${BRAND_TITLE}`), '   BRAND-WISE SNAPSHOT');
  dash.getRow(BRAND_TITLE).height = 24;
  const brandHdrs = ['Brand', 'Orders', 'Value (Rs.)', 'AOV (Rs.)', 'Category', '% Value', '% Orders'];
  for (let i = 0; i < brandHdrs.length; i++) columnHeader(dash.getRow(BRAND_HDR).getCell(i + 1), brandHdrs[i]);
  dash.getRow(BRAND_HDR).height = 30;

  dash.getCell(`A${BRAND_START}`).value = { formula: `${UNIQUE_FN}(${R_BRAND})` };

  for (let r = BRAND_START; r <= BRAND_END; r++) {
    const aRef = `A${r}`;
    const blank = `${aRef}=""`;
    dash.getCell(`B${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AR},${R_BRAND},${aRef}))` };
    dash.getCell(`C${r}`).value = { formula: `IF(${blank},"",SUMIFS(${R_AV},${R_BRAND},${aRef},${R_STATUS},"<>CANCELLED"))` };
    dash.getCell(`D${r}`).value = { formula: `IFERROR(C${r}/B${r},"")` };
    dash.getCell(`E${r}`).value = { formula: `IFERROR(IF(${blank},"",INDEX(${R_CAT},MATCH(${aRef},${R_BRAND},0))),"")` };
    dash.getCell(`F${r}`).value = { formula: `IFERROR(C${r}/$C$${BRAND_TOTAL},"")` };
    dash.getCell(`G${r}`).value = { formula: `IFERROR(B${r}/$B$${BRAND_TOTAL},"")` };

    for (let c = 1; c <= 7; c++) {
      bandCell(dash.getRow(r).getCell(c), r - BRAND_START);
      dash.getRow(r).getCell(c).alignment = { vertical: 'middle', horizontal: (c === 1 || c === 5) ? 'left' : 'center' };
    }
    dash.getCell(`B${r}`).numFmt = '#,##0';
    dash.getCell(`C${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`D${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`F${r}`).numFmt = '0.0%';
    dash.getCell(`G${r}`).numFmt = '0.0%';
  }

  for (let c = 1; c <= 7; c++) styleTotalRow(dash.getRow(BRAND_TOTAL).getCell(c));
  dash.getCell(`A${BRAND_TOTAL}`).value = 'GRAND TOTAL';
  dash.getCell(`A${BRAND_TOTAL}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  dash.getCell(`B${BRAND_TOTAL}`).value = { formula: `SUM(B${BRAND_START}:B${BRAND_END})` };
  dash.getCell(`C${BRAND_TOTAL}`).value = { formula: `SUM(C${BRAND_START}:C${BRAND_END})` };
  dash.getCell(`D${BRAND_TOTAL}`).value = { formula: `IFERROR(C${BRAND_TOTAL}/B${BRAND_TOTAL},0)` };
  dash.getCell(`E${BRAND_TOTAL}`).value = '';
  dash.getCell(`F${BRAND_TOTAL}`).value = { formula: `SUM(F${BRAND_START}:F${BRAND_END})` };
  dash.getCell(`G${BRAND_TOTAL}`).value = { formula: `SUM(G${BRAND_START}:G${BRAND_END})` };
  dash.getCell(`B${BRAND_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`C${BRAND_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`D${BRAND_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`F${BRAND_TOTAL}`).numFmt = '0.0%';
  dash.getCell(`G${BRAND_TOTAL}`).numFmt = '0.0%';

  dash.addConditionalFormatting({
    ref: `C${BRAND_START}:C${BRAND_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF4472C4' }, priority: 7 }],
  });
  dash.addConditionalFormatting({
    ref: `B${BRAND_START}:B${BRAND_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF70AD47' }, priority: 8 }],
  });

  // ── FREQUENCY BLOCK ──
  const FREQ_TITLE = BRAND_TOTAL + 2;
  const FREQ_HDR   = FREQ_TITLE + 1;
  const FREQ_START = FREQ_HDR + 1;
  const FREQ_END   = FREQ_START + 3;
  const FREQ_TOTAL = FREQ_END + 1;

  dash.mergeCells(`A${FREQ_TITLE}:H${FREQ_TITLE}`);
  sectionHeader(dash.getCell(`A${FREQ_TITLE}`), '   RETAILER ORDER FREQUENCY');
  dash.getRow(FREQ_TITLE).height = 24;
  const freqHdrs = ['Frequency Bucket', 'Unique Outlets', 'Orders', 'Value (Rs.)', 'AOV (Rs.)', '% Outlets', '% Value'];
  for (let i = 0; i < freqHdrs.length; i++) columnHeader(dash.getRow(FREQ_HDR).getCell(i + 1), freqHdrs[i]);
  dash.getRow(FREQ_HDR).height = 30;

  const buckets = ['TIER1', 'TIER2', 'TIER3', 'TIER4'];
  const bucketLabels = ['>=7 per week (>=1/day)', '4-6 per week', '2-3 per week', '<2 per week'];

  for (let i = 0; i < buckets.length; i++) {
    const r = FREQ_START + i;
    dash.getCell(`A${r}`).value = bucketLabels[i];
    const k = `"${buckets[i]}"`;
    dash.getCell(`B${r}`).value = { formula: `SUMIFS(${R_AL},${R_AT},${k})` };
    dash.getCell(`C${r}`).value = { formula: `SUMIFS(${R_AK},${R_AT},${k})` };
    dash.getCell(`D${r}`).value = { formula: `SUMIFS(${R_AV},${R_AT},${k},${R_STATUS},"<>CANCELLED")` };
    dash.getCell(`E${r}`).value = { formula: `IFERROR(D${r}/C${r},"")` };
    dash.getCell(`F${r}`).value = { formula: `IFERROR(B${r}/$B$${FREQ_TOTAL},"")` };
    dash.getCell(`G${r}`).value = { formula: `IFERROR(D${r}/$D$${FREQ_TOTAL},"")` };

    for (let c = 1; c <= 7; c++) {
      bandCell(dash.getRow(r).getCell(c), i);
      dash.getRow(r).getCell(c).alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
    }
    dash.getCell(`B${r}`).numFmt = '#,##0';
    dash.getCell(`C${r}`).numFmt = '#,##0';
    dash.getCell(`D${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`E${r}`).numFmt = '"Rs. "#,##0';
    dash.getCell(`F${r}`).numFmt = '0.0%';
    dash.getCell(`G${r}`).numFmt = '0.0%';
  }

  for (let c = 1; c <= 7; c++) styleTotalRow(dash.getRow(FREQ_TOTAL).getCell(c));
  dash.getCell(`A${FREQ_TOTAL}`).value = 'GRAND TOTAL';
  dash.getCell(`A${FREQ_TOTAL}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  dash.getCell(`B${FREQ_TOTAL}`).value = { formula: `SUM(B${FREQ_START}:B${FREQ_END})` };
  dash.getCell(`C${FREQ_TOTAL}`).value = { formula: `SUM(C${FREQ_START}:C${FREQ_END})` };
  dash.getCell(`D${FREQ_TOTAL}`).value = { formula: `SUM(D${FREQ_START}:D${FREQ_END})` };
  dash.getCell(`E${FREQ_TOTAL}`).value = { formula: `IFERROR(D${FREQ_TOTAL}/C${FREQ_TOTAL},0)` };
  dash.getCell(`F${FREQ_TOTAL}`).value = { formula: `SUM(F${FREQ_START}:F${FREQ_END})` };
  dash.getCell(`G${FREQ_TOTAL}`).value = { formula: `SUM(G${FREQ_START}:G${FREQ_END})` };
  dash.getCell(`B${FREQ_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`C${FREQ_TOTAL}`).numFmt = '#,##0';
  dash.getCell(`D${FREQ_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`E${FREQ_TOTAL}`).numFmt = '"Rs. "#,##0';
  dash.getCell(`F${FREQ_TOTAL}`).numFmt = '0.0%';
  dash.getCell(`G${FREQ_TOTAL}`).numFmt = '0.0%';

  dash.addConditionalFormatting({
    ref: `D${FREQ_START}:D${FREQ_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF4472C4' }, priority: 9 }],
  });
  dash.addConditionalFormatting({
    ref: `B${FREQ_START}:B${FREQ_END}`,
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FFED7D31' }, priority: 10 }],
  });

  // Footnote
  const foot = FREQ_TOTAL + 2;
  dash.mergeCells(`A${foot}:T${foot}`);
  const fc = dash.getCell(`A${foot}`);
  fc.value = 'Notes: All blocks auto-update from RawData. KPI cards: row 1 excludes CANCELLED for revenue metrics; row 2 ("Unique Orders" and "Unique Customers") counts everything including CANCELLED. Date-wise breakdown value columns split Total into Open + Delivered + Cancelled & Returned. A4 (Days of Ops) drives the frequency buckets and date range.';
  fc.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
  fc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  dash.getRow(foot).height = 56;

  dash.views = [{ state: 'frozen', ySplit: 7, showGridLines: false }];

  await wb.xlsx.writeFile(DST);

  // ── Post-process: add Excel 365 dynamic-array metadata ──
  // Cells with spilling UNIQUE() formulas (Dashboard sheet). Row numbers
  // reflect the +2 shift from the new KPI row.
  const DYNAMIC_ARRAY_CELLS = [
    `A${DIST_START}`,    // A12 — distributor list
    `I${DATE_START}`,    // I12 — date list
    `A${CAT_START}`,     // category list
    `A${BRAND_START}`,   // brand list
  ];

  const zip = await JSZip.loadAsync(fs.readFileSync(DST));

  let sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  for (const addr of DYNAMIC_ARRAY_CELLS) {
    const re = new RegExp(`(<c\\s+r="${addr}"\\s)`);
    if (re.test(sheetXml) && !new RegExp(`<c\\s+r="${addr}"\\s[^>]*cm=`).test(sheetXml)) {
      sheetXml = sheetXml.replace(re, `<c r="${addr}" cm="1" `);
    }
  }
  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  const metadataXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray" xmlns:xlrd="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata"><metadataTypes count="1"><metadataType name="XLDAPR" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1"/></metadataTypes><futureMetadata name="XLDAPR" count="1"><bk><extLst><ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}"><xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/></ext></extLst></bk></futureMetadata><cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata></metadata>`;
  zip.file('xl/metadata.xml', metadataXml);

  let contentTypes = await zip.file('[Content_Types].xml').async('string');
  if (!contentTypes.includes('/xl/metadata.xml')) {
    contentTypes = contentTypes.replace(
      '</Types>',
      '<Override PartName="/xl/metadata.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml"/></Types>'
    );
    zip.file('[Content_Types].xml', contentTypes);
  }

  let wbRels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const metaRelId = 'rIdMeta';
  if (!wbRels.includes('metadata.xml')) {
    wbRels = wbRels.replace(
      '</Relationships>',
      `<Relationship Id="${metaRelId}" Type="http://schemas.microsoft.com/office/2017/06/relationships/sheetMetadata" Target="metadata.xml"/></Relationships>`
    );
    zip.file('xl/_rels/workbook.xml.rels', wbRels);
  }

  fs.writeFileSync(DST, await zip.generateAsync({ type: 'nodebuffer' }));

  console.log('Saved:', DST);
  console.log(`Helper range: rows 2..${N} (${N-1} rows × 17 helpers)`);
  console.log(`Distrib block: ${DIST_START}..${DIST_TOTAL}, Date block: ${DATE_START}..${DATE_TOTAL}`);
  console.log(`Category block: ${CAT_START}..${CAT_TOTAL}, Brand block: ${BRAND_START}..${BRAND_TOTAL}`);
  console.log(`Frequency block: ${FREQ_START}..${FREQ_TOTAL}`);
  console.log(`Dynamic-array cells marked with cm="1": ${DYNAMIC_ARRAY_CELLS.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
