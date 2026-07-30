// build-us12.cjs — generates US-12 user story docx
'use strict';
const DOCX_PATH = 'C:/Users/Lenovo/AppData/Roaming/npm/node_modules/docx';
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, ExternalHyperlink,
} = require(DOCX_PATH);
const fs = require('fs');

// ── Palette ────────────────────────────────────────────────────────────────
const BRAND_BLUE   = '1F4E79'; // dark header bg
const BRAND_MED    = '2E75B6'; // section header bg
const BRAND_LIGHT  = 'D5E8F0'; // alternating table row / column header bg
const BRAND_PALE   = 'EBF3FB'; // faint alt row
const WHITE        = 'FFFFFF';
const GRAY_TEXT    = '404040';
const NOTE_YELLOW  = 'FFF2CC'; // [NEEDS INPUT] highlight
const FONT         = 'Arial';

// ── Helpers ────────────────────────────────────────────────────────────────
const border = (color = 'CCCCCC') => ({ style: BorderStyle.SINGLE, size: 1, color });
const cellBorders = (color = 'CCCCCC') => ({
  top: border(color), bottom: border(color),
  left: border(color), right: border(color),
});
const CELL_MARGIN = { top: 80, bottom: 80, left: 120, right: 120 };

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size || 20, bold: opts.bold || false,
    italics: opts.italic || false, color: opts.color || GRAY_TEXT,
    highlight: opts.highlight || undefined, strike: opts.strike || false });
}

function para(children, opts = {}) {
  if (typeof children === 'string') children = [run(children)];
  return new Paragraph({
    children,
    spacing: opts.spacing || { before: 60, after: 60 },
    alignment: opts.align || AlignmentType.LEFT,
    bullet: opts.bullet ? { level: 0 } : undefined,
    numbering: opts.numbering || undefined,
  });
}

function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 28, bold: true, color: WHITE })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    shading: { fill: BRAND_BLUE, type: ShadingType.CLEAR },
    indent: { left: 120, right: 120 },
  });
}

function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: WHITE })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    shading: { fill: BRAND_MED, type: ShadingType.CLEAR },
    indent: { left: 120, right: 120 },
  });
}

function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 22, bold: true, color: BRAND_BLUE })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_MED } },
  });
}

function needsInput(text) {
  return run(text, { color: '7F0000', italic: true, highlight: 'yellow' });
}

// TABLE: two-col label/value ─────────────────────────────────────────────
function twoColTable(rows) {
  // page width 9360 DXA, col split 2200 / 7160
  const COL_W = [2200, 7160];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: COL_W,
    rows: rows.map(([label, valueChildren], i) => {
      const shade = i % 2 === 0 ? BRAND_PALE : WHITE;
      const mkCell = (content, w, bold = false) => new TableCell({
        borders: cellBorders('CCCCCC'),
        width: { size: w, type: WidthType.DXA },
        shading: { fill: shade, type: ShadingType.CLEAR },
        margins: CELL_MARGIN,
        children: [new Paragraph({
          children: typeof content === 'string'
            ? [run(content, { bold })]
            : content,
          spacing: { before: 40, after: 40 },
        })],
      });
      return new TableRow({
        children: [
          mkCell(label, COL_W[0], true),
          mkCell(valueChildren, COL_W[1]),
        ],
      });
    }),
  });
}

// TABLE: generic multi-col ────────────────────────────────────────────────
function multiColTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const mkCell = (content, w, isHeader = false) => new TableCell({
    borders: cellBorders('CCCCCC'),
    width: { size: w, type: WidthType.DXA },
    shading: { fill: isHeader ? BRAND_LIGHT : WHITE, type: ShadingType.CLEAR },
    margins: CELL_MARGIN,
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({
      children: typeof content === 'string'
        ? [run(content, { bold: isHeader, size: isHeader ? 18 : 20 })]
        : content,
      spacing: { before: 40, after: 40 },
    })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => mkCell(h, colWidths[i], true)),
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => {
          const bg = ri % 2 === 0 ? WHITE : BRAND_PALE;
          return new TableCell({
            borders: cellBorders('CCCCCC'),
            width: { size: colWidths[ci], type: WidthType.DXA },
            shading: { fill: bg, type: ShadingType.CLEAR },
            margins: CELL_MARGIN,
            verticalAlign: VerticalAlign.TOP,
            children: [new Paragraph({
              children: typeof cell === 'string' ? [run(cell, { size: 20 })] : cell,
              spacing: { before: 40, after: 40 },
            })],
          });
        }),
      })),
    ],
  });
}

function spacer() {
  return new Paragraph({ children: [new TextRun('')], spacing: { before: 80, after: 80 } });
}

// ── Document content ───────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: FONT, size: 20, color: GRAY_TEXT } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: WHITE },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: WHITE },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: FONT, color: BRAND_BLUE },
        paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            run('Qwipo Seller Store  |  User Story Specifications  |  US-12', { size: 16, color: '888888' }),
          ],
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_MED } },
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            run('© 2026 Qwipo  |  Confidential  |  Page ', { size: 16, color: '888888' }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '888888' }),
            run(' of ', { size: 16, color: '888888' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: '888888' }),
          ],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BRAND_MED } },
        })],
      }),
    },
    children: [

      // ── Cover block ─────────────────────────────────────────────────────
      new Paragraph({
        children: [run('QWIPO SELLER STORE', { bold: true, size: 40, color: WHITE })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80 },
        shading: { fill: BRAND_BLUE, type: ShadingType.CLEAR },
        indent: { left: 120, right: 120 },
      }),
      new Paragraph({
        children: [run('Seller Admin — Phase 1  |  Enhancement Stories', { size: 24, color: WHITE })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        shading: { fill: BRAND_BLUE, type: ShadingType.CLEAR },
        indent: { left: 120, right: 120 },
      }),
      new Paragraph({
        children: [run('User Story Specifications', { size: 24, italic: true, color: WHITE })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        shading: { fill: BRAND_BLUE, type: ShadingType.CLEAR },
        indent: { left: 120, right: 120 },
      }),

      spacer(),

      twoColTable([
        ['Document Type',  'User Story Specifications'],
        ['Module',         'Seller Admin — My SKU List Page'],
        ['Persona',        'Seller Admin (Distributor)'],
        ['Business Owner', 'Product Team (Qwipo Seller Store)'],
        ['Story',          'US-12'],
        ['Depends On',     'US-02 (View and Browse My SKU List Page), US-06 (SKU Detail — Price & Inventory Tab)'],
        ['Version',        '1.0 — Draft'],
        ['Date',           '3 June 2026'],
        ['Status',         'Ready for Dev'],
        ['Document Owner', 'Omkar Charankar'],
      ]),

      spacer(),
      spacer(),

      // ── Story heading ───────────────────────────────────────────────────
      h1('USER STORY 12'),
      new Paragraph({
        children: [run('My SKU List — Introduce MRP and Selling Price Columns', { bold: true, size: 26, color: BRAND_BLUE })],
        spacing: { before: 120, after: 80 },
      }),
      new Paragraph({
        children: [
          run('Epic: Seller Admin — Product Catalog Management', { size: 18, color: '888888' }),
          run('   |   Priority: High   |   Owner: Product Team', { size: 18, color: '888888' }),
        ],
        spacing: { before: 0, after: 160 },
      }),

      // ── Section 1 ───────────────────────────────────────────────────────
      h2('Section 1 — Basic Information'),
      spacer(),
      twoColTable([
        ['Story Title',       'My SKU List — Introduce MRP and Selling Price Columns'],
        ['Epic / Feature Link','Seller Admin — Product Catalog Management'],
        ['Business Owner',    'Product Team (Qwipo Seller Store)'],
        ['Priority',          'High — pricing visibility is a core daily-use need for distributor catalog review'],
        ['Sprint Target',     [needsInput('[NEEDS INPUT] Sprint ID / target date')]],
        ['User Persona',      'Seller Admin — distributor responsible for SKUs, pricing, and stock'],
        ['Depends On',        'US-02 (My SKU List Page), US-06 (SKU Detail — Price & Inventory Tab)'],
      ]),
      spacer(),

      // ── Section 2 ───────────────────────────────────────────────────────
      h2('Section 2 — Business Context'),
      spacer(),
      h3('WHY'),
      para([
        run('The Seller Admin reviews their product catalog regularly — before customer visits, after brand price changes, and during audit cycles. The current My SKU list page (US-02) surfaces SKU Code, SKU Name, Brand, Category, Status, ONDC Compliance, and Last Updated, but ', { size: 20 }),
        run('no pricing columns', { bold: true, size: 20 }),
        run('. To check MRP or Selling Price the admin must open each SKU\'s Detail page (Price & Inventory tab) individually — a minimum 3-click journey per SKU. Across a 60-SKU catalog that is 180+ clicks just to scan pricing. Adding MRP and Selling Price directly to the list eliminates this friction entirely: the admin scans both values at a glance, identifies outliers without drilling in, and acts only on the rows that require correction.', { size: 20 }),
      ], { spacing: { before: 60, after: 120 } }),

      h3('User Persona'),
      spacer(),
      multiColTable(
        ['Persona Name', 'Role', 'Goal', 'Pain Point'],
        [
          ['Seller Admin', 'Distributor using the Seller Store', 'Scan MRP and Selling Price for every SKU in one view, without opening each detail page', 'Pricing audit requires 3 clicks per SKU; no way to compare prices across the catalog at a glance'],
        ],
        [1800, 2200, 2880, 2480]
      ),
      spacer(),

      h3('Success Metrics'),
      para('Reduction in clicks required to audit catalog-wide pricing — from 3 clicks × N SKUs to 0 additional clicks (values visible on list).', { bullet: true }),
      para([needsInput('[NEEDS INPUT]'), run(' Baseline: "Details" page open rate pre-enhancement — measure the drop post-launch as a proxy for list-page pricing resolution.')], { bullet: true }),
      para([needsInput('[NEEDS INPUT]'), run(' Target: % of pricing-audit sessions that require zero detail-page opens within 60 days of release.')], { bullet: true }),
      spacer(),

      h3('Real-World Scenario'),
      para([
        run('A distributor is preparing for a morning route visit and wants to confirm that every active SKU in their catalog has a Selling Price set and that no SKU\'s Selling Price has accidentally exceeded its MRP. Previously, verifying this for 63 SKUs required opening each SKU\'s Detail page, reading the Price & Inventory tab, and returning to the list — a process that took 10-15 minutes. With MRP and Selling Price now visible as columns on the My SKU list, the admin opens the list, scans the two pricing columns down the page, spots any \'—\' (unset) or questionable values immediately, and drills into only those rows for correction. The same audit that took 15 minutes now takes under 60 seconds.'),
      ], { spacing: { before: 60, after: 120 } }),

      // ── Section 3 ───────────────────────────────────────────────────────
      h2('Section 3 — Functional Clarity'),
      spacer(),

      h3('User Story'),
      new Paragraph({
        children: [
          run('As a ', { italic: true, size: 21 }),
          run('Seller Admin', { italic: true, bold: true, size: 21 }),
          run(', I want to see ', { italic: true, size: 21 }),
          run('MRP and Selling Price for each SKU directly on the My SKU list page', { italic: true, bold: true, size: 21 }),
          run(', so that I can ', { italic: true, size: 21 }),
          run('audit pricing across my full catalog without opening each SKU\'s detail view', { italic: true, bold: true, size: 21 }),
          run('.', { italic: true, size: 21 }),
        ],
        shading: { fill: BRAND_PALE, type: ShadingType.CLEAR },
        spacing: { before: 120, after: 120 },
        indent: { left: 240, right: 240 },
      }),
      spacer(),

      h3('Acceptance Criteria'),
      spacer(),

      multiColTable(
        ['#', 'Acceptance Criterion'],
        [
          ['AC-1',
           'Given the Seller Admin navigates to "My SKU" from the left menu\nWhen the list renders with at least one SKU\nThen the table displays two new columns — "MRP" (column 5, after Category) and "Selling Price" (column 6, after MRP) — before the existing "Status" column.\nThe updated column order is: SKU Code | SKU Name | Brand | Category | MRP | Selling Price | Status | ONDC Compliance | Last Updated | Actions.'],
          ['AC-2',
           'Given a SKU has both MRP and Selling Price set\nWhen the row renders\nThen MRP shows as "₹565" and Selling Price shows as "₹525" (₹ symbol prefix, en-IN locale comma separators, no decimal places for whole-rupee amounts; paise shown to 2 decimal places if present, e.g. "₹117.50").'],
          ['AC-3',
           'Given a SKU has MRP or Selling Price not set (null / missing)\nWhen the row renders\nThen the corresponding cell displays "—" (em dash).\nThe cell does NOT display "₹0", "null", "undefined", or remain blank.'],
          ['AC-4',
           'Given the Seller Admin uses the search input, applies filters, or navigates to a different page\nWhen the list re-renders\nThen the MRP and Selling Price columns remain visible and correctly populated for all displayed rows.'],
          ['AC-5',
           'Given the Seller Admin views the My SKU list on a narrow viewport where horizontal scrolling is active\nWhen they scroll right\nThen the MRP and Selling Price columns are fully visible and readable via horizontal scroll.\nThe two columns are not sticky; SKU Code and SKU Name retain their existing sticky behaviour (if implemented per US-02).'],
          ['AC-6',
           'Given a SKU row shows "—" in the MRP or Selling Price column\nWhen the Seller Admin clicks "Details" on that row\nThen the system navigates to the SKU Detail page (Price & Inventory tab, US-06) where the admin can set the missing values.\nThe list columns are read-only — no inline edit is possible from the list.'],
        ],
        [1000, 8360]
      ),
      spacer(),

      // ── Business Rules ──────────────────────────────────────────────────
      h2('Business Rules'),
      spacer(),
      multiColTable(
        ['#', 'Rule'],
        [
          ['BR-1', 'MRP and Selling Price are read-only on the My SKU list page. Values are set and edited on the SKU Detail page, Price & Inventory tab (US-06).'],
          ['BR-2', 'MRP is always displayed first (column 5, after Category); Selling Price is always displayed second (column 6, after MRP).'],
          ['BR-3', 'Both values are formatted using the Indian numbering system (en-IN locale): ₹ symbol prefix, comma separators (e.g., ₹1,00,000 for one lakh). Whole-rupee amounts show no decimal places. Paise, if present, are shown to exactly two decimal places (e.g., ₹117.50).'],
          ['BR-4', 'When MRP or Selling Price is not set for a SKU, the cell displays "—" (em dash). It must not display "₹0", empty string, "null", or "undefined".'],
          ['BR-5', 'The two new columns are always visible for the Seller Admin role in Phase 1. They are not hidden behind a feature flag or a column-visibility toggle.'],
          ['BR-6', [needsInput('[NEEDS INPUT]'), run(' Whether Selling Price > MRP should be flagged visually on the list (e.g., red text, warning icon). Recommended: yes — flag it with red text on the Selling Price cell. Awaiting PM confirmation before implementation.')]],
          ['BR-7', 'Column headers are labelled "MRP" and "Selling Price" exactly — no sub-labels, currency suffixes (e.g., "(₹)"), or unit annotations in the header row.'],
          ['BR-8', 'The empty-state colSpan must cover all 10 columns (increased from 8) so the "no results" row spans the full table width.'],
        ],
        [1000, 8360]
      ),
      spacer(),

      // ── Edge Cases ─────────────────────────────────────────────────────
      h2('Edge Cases'),
      spacer(),
      multiColTable(
        ['#', 'Scenario', 'Expected Behaviour'],
        [
          ['EDGE-1', 'All SKUs in the catalog have neither MRP nor Selling Price set', 'Both columns show "—" for every row. No layout shift, overflow, or blank-cell weirdness.'],
          ['EDGE-2', 'A SKU has MRP set but Selling Price is not set', 'MRP cell shows the formatted ₹ value; Selling Price cell shows "—".'],
          ['EDGE-3', 'A very large MRP value (e.g., ₹1,00,00,000 — one crore)', 'en-IN formatting applies (₹1,00,00,000); cell wraps to a second line if necessary. No truncation, ellipsis, or overflow-hidden clipping.'],
          ['EDGE-4', 'Selling Price equals MRP exactly', 'Both cells show the same formatted value. No visual flag in Phase 1 (see BR-6 for the Selling Price > MRP case).'],
          ['EDGE-5', [needsInput('[NEEDS INPUT — pending BR-6]'), run(' Selling Price > MRP')], 'Awaiting PM decision. If confirmed: Selling Price cell renders in red text with a warning icon. If not confirmed for Phase 1: no visual change.'],
          ['EDGE-6', 'Search or filter produces zero results (filtered empty state)', 'The empty-state row renders with colSpan = 10 (all columns, including the two new pricing columns). Layout must not break.'],
          ['EDGE-7', 'User is on a mobile / narrow viewport', 'Horizontal scroll is required to see all 10 columns. MRP and Selling Price are accessible by scrolling right; they are not cropped or hidden.'],
          ['EDGE-8', 'MRP or Selling Price value is exactly ₹0 (zero, explicitly set)', [run('Cell displays "₹0", NOT "—". The "—" fallback applies only when the value is null / missing — a deliberate zero is a valid price and must be shown as '), run('"₹0"', { bold: true }), run('.')]],
        ],
        [800, 2800, 5760]
      ),
      spacer(),

      // ── Error Scenarios ─────────────────────────────────────────────────
      h2('Error Scenarios'),
      spacer(),
      para([
        run('MRP and Selling Price values are returned as part of the same SKU list API response used by US-02. No new API call is introduced. All existing error states from US-02 (ERR-SKU-01 through ERR-SKU-04) continue to apply — when the list fails to load, both pricing columns are absent along with all other list data. No new error codes are introduced by this enhancement.'),
      ], { spacing: { before: 60, after: 120 } }),

      multiColTable(
        ['Code', 'Trigger', 'User-Facing Message', 'System Behaviour'],
        [
          ['ERR-SKU-01\n(from US-02)', 'API timeout while loading SKU list', '"Unable to load SKUs. Please retry."', 'Show retry CTA on the table area; both pricing columns are absent until data loads successfully.'],
          ['ERR-SKU-02\n(from US-02)', 'SKU list API returns 5xx', '"Search is temporarily unavailable. Please try again."', 'Keep previously loaded list visible; show non-blocking toast; pricing columns display last-loaded values.'],
          ['ERR-SKU-03\n(from US-02)', 'Pagination request fails', '"Could not load the next page. Please retry."', 'Keep current page visible; offer retry; pricing columns on the current page remain visible.'],
          ['ERR-SKU-04\n(from US-02)', 'Session expired on the list page', '"Your session has expired. Please log in again."', 'Redirect to login; preserve target URL.'],
        ],
        [1400, 2200, 2800, 2960]
      ),
      spacer(),

      // ── Data Specification ──────────────────────────────────────────────
      h2('Data Specification — New List Columns'),
      spacer(),
      multiColTable(
        ['Field', 'Type', 'Required on List', 'Display Format', 'Source / Set Via'],
        [
          ['MRP', 'Number (currency)', 'No — shows "—" if null', '₹X,XX,XXX (en-IN locale, 0 decimal places for whole rupees; 2 decimal places if paise present)', 'SKU master record — set on the Price & Inventory tab (US-06)'],
          ['Selling Price', 'Number (currency)', 'No — shows "—" if null', '₹X,XX,XXX (en-IN locale, 0 decimal places for whole rupees; 2 decimal places if paise present)', 'SKU master record — set on the Price & Inventory tab (US-06)'],
        ],
        [1600, 1600, 1800, 2360, 2000]
      ),
      spacer(),

      // ── Out of Scope ─────────────────────────────────────────────────────
      h2('Out of Scope'),
      spacer(),
      multiColTable(
        ['Item', 'Reason / Deferral'],
        [
          ['Inline editing of MRP or Selling Price on the list page', 'Price edits are made on the SKU Detail page, Price & Inventory tab (US-06). The list is read-only.'],
          ['Sorting the list by MRP or Selling Price column', 'No sort controls exist on the My SKU list in Phase 1 (US-02 BR-5). Deferred to a later phase.'],
          ['Filtering by price range', 'The Filter drawer in US-02 does not include price-range facets. Deferred to a later phase.'],
          ['Visual warning when Selling Price > MRP', 'Deferred pending PM confirmation (see BR-6, EDGE-5).'],
          ['Displaying other pricing fields (cost price, margin %, tax)', 'Out of scope for this story. Only MRP and Selling Price are added in this enhancement.'],
          ['Displaying MRP / Selling Price on the Price List page', 'Separate screen (PriceList component). Not changed by this story.'],
        ],
        [3200, 6160]
      ),
      spacer(),

      // ── Open Questions ───────────────────────────────────────────────────
      h2('Open Questions'),
      spacer(),
      multiColTable(
        ['#', 'Question', 'Owner', 'Status'],
        [
          ['OQ-1', 'Should Selling Price > MRP trigger a visual warning on the list? (BR-6, EDGE-5)', 'Product Manager', [needsInput('[NEEDS INPUT]')]],
          ['OQ-2', 'Sprint ID / target date for this enhancement?', 'Product Manager', [needsInput('[NEEDS INPUT]')]],
          ['OQ-3', 'Should pricing columns be included in the Bulk Import export template (Update Price & Stock, US-04) so sellers can update them in bulk?', 'Product Manager', [needsInput('[NEEDS INPUT]')]],
        ],
        [700, 4000, 2000, 2660]
      ),
      spacer(),

    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('Documents/US-12-MySKU-MRP-SellingPrice-Columns.docx', buf);
  console.log('Written: Documents/US-12-MySKU-MRP-SellingPrice-Columns.docx');
}).catch(err => { console.error(err); process.exit(1); });
