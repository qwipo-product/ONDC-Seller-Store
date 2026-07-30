// Builds a consolidated Seller Store Issue Tracker workbook.
// Master sheet is the only editable surface. All other tabs are FILTER()-driven
// views and are locked.

const ExcelJS = require('exceljs');
const path = require('path');

const OUT = 'C:\\Users\\Lenovo\\Downloads\\Seller-Store-Issue-Tracker-Master.xlsx';
const FONT = { name: 'Calibri', size: 11 };
const FONT_BOLD = { name: 'Calibri', size: 11, bold: true };
const FONT_HEADER = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
const FONT_TITLE = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };

const COLORS = {
  brand: 'FF1F4E79',       // dark blue header
  brandLight: 'FFD9E1F2',  // light blue stripe
  subHeader: 'FF305496',   // sub-header blue
  protected: 'FFFFF2CC',   // light cream banner for view-only tabs
  bandAlt: 'FFF2F2F2',     // alt row
  p0: 'FFC00000',
  p1: 'FFED7D31',
  p2: 'FFFFC000',
  p3: 'FF92D050',
  statusOpen: 'FFFCE4D6',
  statusProgress: 'FFFFF2CC',
  statusNeedInfo: 'FFE1D5E7',
  statusEnh: 'FFD9E1F2',
  statusClosed: 'FFC6EFCE',
  statusBlock: 'FFFFC7CE',
};

// ---------- canonical column schema ----------
const COLUMNS = [
  { key: 'id',        header: 'Issue ID',              width: 12 },
  { key: 'date',      header: 'Date Raised',           width: 13 },
  { key: 'source',    header: 'Source / App',          width: 22 },
  { key: 'module',    header: 'Module / Section',      width: 26 },
  { key: 'page',      header: 'Page / Screen',         width: 30 },
  { key: 'title',     header: 'Issue Title',           width: 38 },
  { key: 'desc',      header: 'Description',           width: 60 },
  { key: 'raisedBy',  header: 'Raised By',             width: 22 },
  { key: 'isBug',     header: 'Is Bug?',               width: 10 },
  { key: 'type',      header: 'Issue Type',            width: 18 },
  { key: 'priority',  header: 'Priority',              width: 11 },
  { key: 'routedTo',  header: 'Routed To',             width: 16 },
  { key: 'owner',     header: 'Owner / Assignee',      width: 18 },
  { key: 'status',    header: 'Status',                width: 17 },
  { key: 'qaComment', header: 'QA Comments',           width: 42 },
  { key: 'devNotes',  header: 'Dev / Action Taken',    width: 38 },
  { key: 'target',    header: 'Target Date',           width: 13 },
  { key: 'closed',    header: 'Closed Date',           width: 13 },
  { key: 'remarks',   header: 'Remarks',               width: 38 },
];
const N_COLS = COLUMNS.length;
const lastColLetter = colLetter(N_COLS);

function colLetter(n) {
  let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s;
}

// ---------- consolidated seed data ----------
// from F1 Issues primary table (rows 1-9)
const f1Issues = [
  ['Pricing', 'Pricing', 'SKU price updated, But it\'s not reflecting in Buyer side', 'Jagadish', 'No', 'High', 'Open', 'Kranthi', 'System Current Behavior'],
  ['Discount', 'Discount', 'The coupon is visible in the Wholesalers section but cannot be applied because the coupon option is not displayed during checkout.', 'Venkat', 'Yes', 'Low', 'Open', 'Kranthi', ''],
  ['Customer', 'Orders > Customer View', 'Gst details of gst registered customer details are not showing (they need it to have a GST details under seller details, Orders Page --> View)', 'Jagadish', 'No', 'High', 'Need More Info', 'Raghu', 'Discussed this in call and should be treated as Enhancement, GST details need to show'],
  ['Cart Page', 'Cart Page', 'SKU names are not displaying on the cart page.', 'Srikanth Upputuri', 'No', 'Medium', 'Enhancement', 'Omkar', 'It will be in View Items. If need in Cart it will be an enhancement'],
  ['Order page', 'Order page', 'Seller name is being displayed instead of the Brand Name.', 'Srikanth Upputuri', 'No', 'Medium', 'Enhancement', 'Omkar', 'Designed As is'],
  ['Product Image Page', 'SKU Detail', 'AS Brand 15L product is displaying the pack image instead of the correct 15L product image (SKU Name - A S Brand Pooja Gingelly Oil, 15 Kg Tin image is showing as packet instead of TIN - Sri Sarada Enterprises)', 'Srikanth Upputuri', '', 'Medium', 'Need More Info', 'Raghu', 'Provided more information'],
  ['Order Summary', 'Order Summary', 'One or more sellers haven\'t confirmed your order yet. Please wait a moment and try again. This msg is getting once 2nd order placing (1st order already done couple of minutes back)', 'Jagadish', 'No', 'High', 'Open', 'Kranthi', 'System Current Behavior'],
  ['SKU Page', 'SKU Page', 'The image showing here is not showing properly if we click on the image it is showing the total correct image', 'Jagadish', 'No', 'Medium', 'Closed', '', 'Banner Image Uploaded. Show it will drag'],
  ['SKU Page', 'SKU Page', 'SKU name is not visible in full, Currently it\'s showing half of the SKU (Cycle Om Shanti Pure Puja Til Oil, 50)', 'Jagadish', 'Yes', 'High', 'Enhancement', 'Omkar', 'Current System Behavior'],
];

// F1 Enhancements sheet
const f1Enh = [
  ['Pricing', 'My SKU', 'Simplify individual SKU price update flow', 'If a seller wants to change the price of an individual for one or two SKUs there is a three step process but it will be simple if we reduce the step as it must be like the JIT price update one step process', 'Jagadish'],
  ['Order page', 'Order Summary', 'Show Brand Name on final order page', 'Brand Name should be shown on the final order page.', 'Srikanth'],
];

// F2 Vendor Management (23 rows)
const f2Vendor = [
  ['P0','GPS Coordinates Visibility Across Order Lifecycle','Sai Krishna Distributor has requested that GPS coordinates of the customer location be displayed on the Order Details page throughout the entire order lifecycle. The GPS coordinates should be visible before order confirmation, after confirmation, and even after delivery. This will help the distributor and delivery teams quickly identify the customer\'s exact location. This feature will be especially useful for offline deliveries, where the distributor can directly share the GPS coordinates with the delivery person, reducing delivery delays and improving location accuracy.','mahadev Enterprises','Seller Portal > Orders list Page'],
  ['P0','Remove Single-Unit Visibility for Pack-Based SKUs','The distributor has requested that few products sold only in pack quantities should not display single-piece quantity options in the application. For products that are sold only as packs (such as inner packs or bundled units), the single-piece visibility should be removed to avoid confusion and ensure customers place orders in the correct pack quantities.','mahadev Enterprises','Customer app > List Page'],
  ['P0','Display Customer GST Number in Order Details and Exports','Venkateshwara Distributor and Mahadev Distributor have requested GST Number visibility for customers. Currently, customer GST numbers are not displayed in the application. The GST Number should be shown on the Order Details page and also included in order export reports (Excel) wherever applicable. This is important for GST-registered customers, as distributors need to verify GST details before generating invoices.','mahadev Enterprises & Venkateswara','Seller Portal > Orders page > Customer GST number'],
  ['P0','Display MRP and Selling Price on MySKU List Page','Sri Sartha Enterprises has requested that the MySKU List page display both MRP and Selling Price (SP) for each SKU. Currently, users need to open the SKU Details page or download the Excel file to view and update pricing information. Displaying MRP and SP directly on the MySKU List page will make it easier to identify products and perform quick price updates without additional steps.','Sarda Enterprises','Seller Portal > My SKU list Page'],
  ['P0','Reduce Steps for SKU Price Updates','Currently, users need to click the "View" button and navigate to the next page then clicking on price & stock tab to see and update SKU pricing details. This adds 3 steps to the process. The request is to display key pricing information, such as MRP and Selling Price, directly when the user clicks the "View" button or within the same list page.','All','Seller Portal > My SKU list Page'],
  ['P0','Order Map View in Seller Portal','A Map View option is required in the Seller Portal Orders page, similar to the functionality available in the Logistics Buyer application. This will allow distributors to view all customer orders on a map, making it easier to identify customer locations and plan deliveries. Additionally, a "Share Location" or "Copy Map Link" option should be provided for each order, allowing users to easily share the customer\'s location with delivery personnel handling offline deliveries.','All','Seller Portal > My Orders list Page'],
  ['P0-Issue','Offers and Schemes (QPS) Not Working','We found that the Offers and Schemes (QPS - Quantity Purchase Scheme) functionality is not working as expected in the application. Even when products meet the configured scheme criteria, the discounted final value is still not showing.','','Customer app > Schemes'],
  ['P0','Removing Distributor name display','Distributor name should not be displayed in the Customer App. Their concern is that different customers may have different pricing based on factors such as credit terms. If customers see the distributor name along with pricing, they may compare prices with other customers and raise questions about price differences, leading to unnecessary discussions and confusion.','Sai Krishna','Customer app'],
  ['P1','Reduce Clicks in Customer Ordering Journey','Feedback regarding the ordering flow in the Customer App. Currently, customers need to navigate through multiple tabs and screens to place an order for products across different brands. For example, customers have to go through several steps before reaching the product listing page, which requires multiple clicks. The distributor suggested simplifying the navigation and reducing the number of clicks required to reach products.','Sai Krishna','Customer app'],
  ['P0-Issue','Distributor WhatsApp Notification Issue for New Orders','We found that Distributors are not receiving whatsapp notifications when a new order is placed, even after updating their mobile number and WhatsApp details in the Settings page.','Sai Krishna','Seller Portal > Settings Page'],
  ['P0','Separate Display for Wholesale and Distributor Products','Raised a concern regarding the display of Distributor Brands and Wholesale Brands on the same page. Currently, both Distributor Brands and Wholesale Brands are shown together, which creates confusion for customers as well as internal teams. The request is to separate Wholesale Brands from Distributor Brands by displaying them under a dedicated tab, section, or page with a clear "Wholesale" label.','Sai Krishna','Customer app'],
  ['P1','Replace Company Name column with Area Name in Orders Page','Requested an enhancement to the Orders List page (Sales Orders / Delivered Orders). Currently, multiple customers may have similar or identical store names, making it difficult to identify the correct customer. The suggestion is to replace the Company Name displayed below the customer name with the Area Name.','Sai Krishna','Seller Portal > Orders list Page'],
  ['P0-Issue','Order Status Sync Issue Between Logistics and Seller Systems','We found an issue with an order from Sairam Enterprises. The order was marked as "Delivered" offline from the Logistics Buyer app. However, even after the delivery was completed, the order status in the Seller Store Orders List page is still showing as "Confirmed." Once an order is marked as Delivered in the logistics flow, the same status should be automatically updated and reflected in the Seller Store Orders List page.','Sairam Enterprises','Logistic Buyer <> Seller Store Order Status'],
  ['P0-Issue','Message During Second Order Placement','Once after placing and for second order it is saying this message ("Sellers Are Still Confirming") and we need to return and then it is saying successful.','','Customer app'],
  ['P0-Issue','Image Visibility','Images not showing properly fit in the product list page, showing properly in the cart page.','','Customer app'],
  ['P0','Category-wise SKU Display Sequence','Option to configure the display sequence of Categories. This will allow them to arrange brands in their preferred order, making it easier to browse and manage pricing of products. The MySKU page should display products based on the distributor-defined brand sequence.','Sai Krishna','Seller Portal > My SKU list Page'],
  ['P0','Shortcode for every SKU','They would like to have a shortcode for every SKU and an option to configure or update these shortcodes as needed. For example, instead of displaying or searching for the full SKU name "Freedom Sunflower Oil 1L", they can use a shortcode like "FR1". The shortcode should be visible on the MySKU page and should also work in the search functionality.','Sai Krishna','Seller Portal > My SKU list Page'],
  ['P1','Hide SKU Code column','SKU Code should not be displayed on the MySKU List page. Since users primarily identify products using the SKU Shortcode, displaying both SKU Code and Shortcode creates unnecessary clutter on the screen. Instead, only the SKU Shortcode should be shown on the list page.','Sai Krishna','Seller Portal > My SKU list Page'],
  ['P2-Service Request','Remove Karnataka Soaps Brand tag from Mahadev','Issue Identified: For Mahadev Enterprises, there was a mistake happened during brand sync to sellers. The intention was to sync products from the Karkana brand, but Karnataka Soaps brand were linked instead. We have already updated the GeoJSON file and inactivated the affected SKUs so that they are no longer visible in the Customer App. However, the Karnataka Soaps brand SKUs are still appearing on the Seller MySKU List page.','mahadev Enterprises','Seller Portal > My SKU list Page'],
  ['P0-Issue','Holiday and Store Closure Configuration for Order Acceptance','Currently, distributors do not have an option to temporarily stop accepting orders for holidays, weekly offs, or other planned closures. An enhancement is required to allow distributors to mark specific dates as Holidays, Week Offs, or Temporary Store Closures. During these periods, customers should not be able to place orders through the Customer App.','All','Seller Portal > Settings Page'],
  ['P0','Single SKU Creation in Seller Portal','Currently, the Seller Portal supports only bulk SKU import, which requires users to fill multiple fields and upload an Excel file even when they need to create just one SKU. Distributors have requested a Single SKU Creation option that allows them to add individual SKUs directly from the portal without using the bulk import process.','All','Seller Portal > My SKU list Page'],
  ['P0','Bottree 50-Meter Customer Creation Restriction','Mahadev Enterprises is using Bottree software for billing. Currently, a new customer can be created only after the salesperson captures the shop image and GPS location through Bottree app. Since Bottree restricts customer creation within a 50-meter radius of the distributor location, we suggested that the salesperson move beyond this range and then create the customer.','mahadev Enterprises','Customer creation in Bottree'],
  ['P1','Customer level pricing (credit / non-credit)','Support customer-segment pricing — distinct rates for credit customers vs. non-credit customers.','','Seller Portal > Pricing'],
];

// F2 Customer App - Sales (9 rows) — same content as F1 secondary table & F3
const f2Sales = [
  ['Search issue','Customer App > Global Search','Global search results not showing all relevant SKUs','Search results are not showing correctly / relevant SKUs are not appearing in global search.','While searching for "Freedom," only 2-3 Sunflower Oil SKUs are displayed; all available SKUs are not appearing in the search results.'],
  ['Coupons Apply','Customer App > Coupons & Offers / Promotions','Rice coupons live but cannot be applied at checkout','Rice coupons are live in the Wholesalers section but cannot be applied during checkout.','Retailers unable to avail coupon apply option or benefits while placing orders.'],
  ['Images','Customer App > SKU Logos','Missing / incorrect SKU images','Some SKU logos/images are missing, and incorrect images are displayed for certain products.','All A.S Brand SKUs are showing the same image, and a few Double Horse product images are incorrectly updated.'],
  ['Configuration Issue','Customer App > SKU Type','SKU type mapping wrong for cases / bags','SKU type for cases and bags is showing incorrectly / not mapped properly.','Cases and bag SKU types need correct mapping in the app.'],
  ['Pricing Issue','Customer App > Product Catalog','Incorrect selling prices for distributor products','Some distributor products are displaying incorrect selling prices in the app.','All Venkateswara Agencies SKUs are displaying the same selling price.'],
  ['App Buffering','Sales Aid > Login Page > Home Screen','Sales Aid app slow to load home screen','Sales Aid app is taking too much time to load from the login page to the customer home screen, showing buffering.','App is buffering for a long time before opening home screen.'],
  ['Low Basket Value','Customer App > Cart / Order Management','MOV (Minimum Order Value) not visible per distributor','Retailers cannot track or control the Minimum Order Value (MOV) effectively.','Request to display MOV for every distributor to help retailers plan and place orders accordingly.'],
  ['Distributor Qty Base Price Slab','Customer App > Product Pricing','Quantity-based price slab not working','Quantity-based price slab is not showing or working correctly.','Price slab is not updating based on selected quantity.'],
  ['Cart Issue','Customer App > Cart Page','SKU count not shown in cart','Total SKU count is not displayed in the cart; only cart value is visible.','Displaying the SKU count will help retailers easily track, add, or remove items accordingly.'],
];

// ---------- normalize into Master rows ----------
function pad(n) { return String(n).padStart(3, '0'); }
const rows = [];
let n = 0;

// F1 primary issues
for (const r of f1Issues) {
  n++;
  const [mod, page, desc, raisedBy, isBug, prio, status, owner, remarks] = r;
  const type = (status === 'Enhancement') ? 'Enhancement' : (isBug === 'Yes' ? 'Bug' : 'Bug / Observation');
  rows.push({
    id: 'ISS-' + pad(n),
    date: '01-Jun-2026',
    source: 'Seller Portal',
    module: mod,
    page: page,
    title: desc.length > 70 ? desc.slice(0, 70) + '…' : desc,
    desc,
    raisedBy,
    isBug: isBug || 'No',
    type,
    priority: prio || 'Medium',
    routedTo: (status === 'Enhancement' ? 'Product' : (status === 'Need More Info' ? 'Business' : 'Dev')),
    owner,
    status: status || 'Open',
    qaComment: '',
    devNotes: '',
    target: '',
    closed: status === 'Closed' ? '01-Jun-2026' : '',
    remarks,
  });
}

// F1 Enhancements
for (const r of f1Enh) {
  n++;
  const [mod, page, title, desc, raisedBy] = r;
  rows.push({
    id: 'ISS-' + pad(n), date: '01-Jun-2026', source: 'Seller Portal',
    module: mod, page, title, desc, raisedBy,
    isBug: 'No', type: 'Enhancement', priority: 'Medium',
    routedTo: 'Product', owner: '', status: 'Enhancement',
    qaComment: '', devNotes: '', target: '', closed: '', remarks: '',
  });
}

// F2 Vendor Management
const priMap = { 'P0': 'High', 'P0-Issue': 'High', 'P0-issue': 'High', 'P1': 'Medium', 'P2-Service Request': 'Low' };
for (const r of f2Vendor) {
  n++;
  const [pri, title, desc, raisedBy, page] = r;
  const isIssue = pri.toLowerCase().includes('issue');
  const isServiceReq = pri.toLowerCase().includes('service');
  const type = isIssue ? 'Bug' : (isServiceReq ? 'Service Request' : 'Enhancement');
  const status = isIssue ? 'Open' : (isServiceReq ? 'Open' : 'Enhancement');
  const routedTo = isIssue ? 'Dev' : (isServiceReq ? 'Operations' : 'Product');
  const mod = (page.split('>')[1] || page).trim();
  rows.push({
    id: 'ISS-' + pad(n), date: '01-Jun-2026', source: page.includes('Customer app') ? 'Customer App' : 'Seller Portal',
    module: mod, page, title, desc, raisedBy,
    isBug: isIssue ? 'Yes' : 'No', type, priority: priMap[pri] || 'Medium',
    routedTo, owner: '', status,
    qaComment: '', devNotes: '', target: '', closed: '', remarks: pri,
  });
}

// F2 Customer App - Sales / F3 (deduped)
for (const r of f2Sales) {
  n++;
  const [issueType, section, title, desc, remarks] = r;
  rows.push({
    id: 'ISS-' + pad(n), date: '01-Jun-2026', source: section.startsWith('Sales Aid') ? 'Sales Aid App' : 'Customer App',
    module: (section.split('>')[1] || section).trim(),
    page: section,
    title, desc, raisedBy: 'Sales / Business Team',
    isBug: 'Yes', type: 'Bug',
    priority: 'High', routedTo: 'Dev', owner: '',
    status: 'Open',
    qaComment: '', devNotes: '', target: '', closed: '', remarks,
  });
}

console.log('Consolidated rows:', rows.length);

// ============================================================
// BUILD WORKBOOK
// ============================================================
const wb = new ExcelJS.Workbook();
wb.creator = 'Seller Store QA';
wb.created = new Date('2026-06-02T00:00:00Z');
// Force Excel to recompute formulas on open — so the view-tab FILTER spills appear immediately.
wb.calcProperties.fullCalcOnLoad = true;

// ----- Reference Lists (hidden) for drop-downs -----
const refs = wb.addWorksheet('Lists');
const lists = {
  Source:   ['Seller Portal', 'Customer App', 'Sales Aid App', 'Logistics Buyer', 'ONDC', 'Other'],
  Priority: ['P0 - Critical', 'High', 'Medium', 'Low'],
  IssueType:['Bug', 'Enhancement', 'Service Request', 'Bug / Observation', 'Question', 'Duplicate'],
  RoutedTo: ['Dev', 'QA', 'Product', 'Design', 'Business', 'Operations', 'DevOps', 'Logistics'],
  Status:   ['Open', 'In Progress', 'Need More Info', 'Enhancement', 'Blocked', 'Ready for QA', 'Resolved', 'Closed', 'Duplicate', "Won't Fix"],
  IsBug:    ['Yes', 'No'],
};
let col = 1;
for (const [name, vals] of Object.entries(lists)) {
  refs.getCell(1, col).value = name;
  refs.getCell(1, col).font = FONT_BOLD;
  for (let i = 0; i < vals.length; i++) refs.getCell(i + 2, col).value = vals[i];
  // named range
  const colL = colLetter(col);
  wb.definedNames.add(`Lists!$${colL}$2:$${colL}$${vals.length + 1}`, `list_${name}`);
  col++;
}
refs.state = 'hidden';
refs.columns.forEach(c => { c.width = 22; c.font = FONT; });

// ----- Master Tracker -----
const master = wb.addWorksheet('Master Tracker', {
  views: [{ state: 'frozen', xSplit: 1, ySplit: 3, showGridLines: false }],
});

// title banner row 1
master.mergeCells(1, 1, 1, N_COLS);
const titleCell = master.getCell(1, 1);
titleCell.value = 'Seller Store — Issue & Enhancement Master Tracker';
titleCell.font = FONT_TITLE;
titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
master.getRow(1).height = 28;

// instruction row 2
master.mergeCells(2, 1, 2, N_COLS);
const instrCell = master.getCell(2, 1);
instrCell.value = '✎ Editable. Business team adds rows (Issue ID auto-fills). QA fills Status / Routed To / Owner / QA Comments. Other tabs update automatically.';
instrCell.font = { ...FONT, italic: true, color: { argb: 'FF7F6000' } };
instrCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
instrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.protected } };
master.getRow(2).height = 22;

// header row 3
const hdr = master.getRow(3);
COLUMNS.forEach((c, i) => {
  const cell = hdr.getCell(i + 1);
  cell.value = c.header;
  cell.font = FONT_HEADER;
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
  cell.border = { top:{style:'thin',color:{argb:'FF8EA9DB'}}, bottom:{style:'thin',color:{argb:'FF8EA9DB'}}, left:{style:'thin',color:{argb:'FF8EA9DB'}}, right:{style:'thin',color:{argb:'FF8EA9DB'}} };
});
hdr.height = 36;
COLUMNS.forEach((c, i) => { master.getColumn(i + 1).width = c.width; });

// data rows start at row 4
const DATA_START = 4;
const MAX_ROWS = 500; // capacity for new issues
rows.forEach((r, i) => {
  const row = master.getRow(DATA_START + i);
  COLUMNS.forEach((c, j) => {
    row.getCell(j + 1).value = r[c.key];
  });
});

// formatting for ALL data rows (seeded + future blanks)
for (let i = 0; i < MAX_ROWS; i++) {
  const row = master.getRow(DATA_START + i);
  row.height = 38;
  COLUMNS.forEach((c, j) => {
    const cell = row.getCell(j + 1);
    cell.font = FONT;
    cell.alignment = { vertical: 'top', wrapText: true,
      horizontal: ['id','date','priority','isBug','target','closed'].includes(c.key) ? 'center' : 'left' };
    cell.border = {
      top:    { style: 'hair', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'hair', color: { argb: 'FFBFBFBF' } },
      left:   { style: 'hair', color: { argb: 'FFBFBFBF' } },
      right:  { style: 'hair', color: { argb: 'FFBFBFBF' } },
    };
    // alt band
    if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bandAlt } };
  });
}

// AutoFilter on header
master.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: N_COLS } };

// Data validation drop-downs
function applyDV(letterCol, formula) {
  for (let r = DATA_START; r < DATA_START + MAX_ROWS; r++) {
    master.getCell(`${letterCol}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Pick from list',
      error: 'Use one of the drop-down values, or update Lists tab.',
    };
  }
}
applyDV(colLetter(COLUMNS.findIndex(c => c.key === 'source') + 1),    '=list_Source');
applyDV(colLetter(COLUMNS.findIndex(c => c.key === 'isBug') + 1),     '=list_IsBug');
applyDV(colLetter(COLUMNS.findIndex(c => c.key === 'type') + 1),      '=list_IssueType');
applyDV(colLetter(COLUMNS.findIndex(c => c.key === 'priority') + 1),  '=list_Priority');
applyDV(colLetter(COLUMNS.findIndex(c => c.key === 'routedTo') + 1),  '=list_RoutedTo');
applyDV(colLetter(COLUMNS.findIndex(c => c.key === 'status') + 1),    '=list_Status');

// Conditional formatting — Priority column
const priCol = colLetter(COLUMNS.findIndex(c => c.key === 'priority') + 1);
const cfRange = `${priCol}${DATA_START}:${priCol}${DATA_START + MAX_ROWS - 1}`;
master.addConditionalFormatting({
  ref: cfRange,
  rules: [
    { type: 'containsText', operator: 'containsText', text: 'P0', priority: 1,
      style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.p0 } },
               font: { ...FONT_BOLD, color: { argb: 'FFFFFFFF' } } } },
    { type: 'containsText', operator: 'containsText', text: 'High', priority: 2,
      style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.p1 } },
               font: { ...FONT_BOLD, color: { argb: 'FFFFFFFF' } } } },
    { type: 'containsText', operator: 'containsText', text: 'Medium', priority: 3,
      style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.p2 } },
               font: FONT_BOLD } },
    { type: 'containsText', operator: 'containsText', text: 'Low', priority: 4,
      style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.p3 } },
               font: FONT_BOLD } },
  ],
});

// Conditional formatting — Status column
const stCol = colLetter(COLUMNS.findIndex(c => c.key === 'status') + 1);
const stRange = `${stCol}${DATA_START}:${stCol}${DATA_START + MAX_ROWS - 1}`;
master.addConditionalFormatting({
  ref: stRange,
  rules: [
    { type: 'containsText', operator: 'containsText', text: 'Closed',      priority: 1, style: { fill: { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.statusClosed}}, font: FONT_BOLD } },
    { type: 'containsText', operator: 'containsText', text: 'Resolved',    priority: 2, style: { fill: { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.statusClosed}}, font: FONT_BOLD } },
    { type: 'containsText', operator: 'containsText', text: 'In Progress', priority: 3, style: { fill: { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.statusProgress}}, font: FONT_BOLD } },
    { type: 'containsText', operator: 'containsText', text: 'Need More Info', priority: 4, style: { fill: { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.statusNeedInfo}}, font: FONT_BOLD } },
    { type: 'containsText', operator: 'containsText', text: 'Enhancement', priority: 5, style: { fill: { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.statusEnh}}, font: FONT_BOLD } },
    { type: 'containsText', operator: 'containsText', text: 'Blocked',     priority: 6, style: { fill: { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.statusBlock}}, font: FONT_BOLD } },
    { type: 'containsText', operator: 'containsText', text: 'Open',        priority: 7, style: { fill: { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.statusOpen}}, font: FONT_BOLD } },
  ],
});

// ============================================================
// View-only filtered tabs using FILTER()
// ============================================================
const MASTER_RANGE = `'Master Tracker'!$A$${DATA_START}:$${lastColLetter}$${DATA_START + MAX_ROWS - 1}`;
const COL_OF = (key) => COLUMNS.findIndex(c => c.key === key) + 1;
const colRange = (key) => `'Master Tracker'!$${colLetter(COL_OF(key))}$${DATA_START}:$${colLetter(COL_OF(key))}$${DATA_START + MAX_ROWS - 1}`;

function buildViewSheet(name, subtitle, filterFormulaInner, bannerColor) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 3, showGridLines: false }],
  });
  ws.mergeCells(1, 1, 1, N_COLS);
  const t = ws.getCell(1, 1);
  t.value = `${name} — view only`;
  t.font = FONT_TITLE;
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bannerColor || COLORS.subHeader } };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, N_COLS);
  const s = ws.getCell(2, 1);
  s.value = `🔒 Read-only. ${subtitle} Rows refresh automatically from Master Tracker.`;
  s.font = { ...FONT, italic: true, color: { argb: 'FF7F6000' } };
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.protected } };
  ws.getRow(2).height = 22;

  const h = ws.getRow(3);
  COLUMNS.forEach((c, i) => {
    const cell = h.getCell(i + 1);
    cell.value = c.header;
    cell.font = FONT_HEADER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
  });
  h.height = 36;
  COLUMNS.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

  // Single FILTER formula in A4 — dynamic array spills the matching Master rows.
  // _xlfn._xlws prefix is the OOXML-compliant way to store FILTER. No cached
  // result and fullCalcOnLoad=true at workbook level → Excel recomputes on open.
  const formula = `_xlfn._xlws.FILTER(${MASTER_RANGE}, (${filterFormulaInner})*(${colRange('id')}<>""), "No rows match yet.")`;
  const a4 = ws.getCell(`A${DATA_START}`);
  a4.value = { formula };

  // No per-cell or column-level styling in the spill region. Any non-default
  // cell style would block Excel's FILTER spill (cells must be truly empty).
  // We get banding through workbook-level conditional formatting, which lives
  // in <conditionalFormatting> and does not emit <c> nodes.
  ws.addConditionalFormatting({
    ref: `A${DATA_START}:${lastColLetter}${DATA_START + MAX_ROWS - 1}`,
    rules: [
      {
        type: 'expression',
        formulae: [`AND($A${DATA_START}<>"No rows match yet.", $A4<>"", MOD(ROW(),2)=0)`],
        priority: 100,
        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bandAlt } } },
      },
    ],
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: N_COLS } };

  // protect sheet — locked by default
  ws.protect('SellerStoreQA', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    autoFilter: true,
    sort: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
  });
  return ws;
}

buildViewSheet(
  'Enhancements',
  'Lists every row where Issue Type or Status = Enhancement.',
  `((${colRange('type')}="Enhancement")+(${colRange('status')}="Enhancement")>0)`,
  'FF2E75B6'
);
buildViewSheet(
  'Dev',
  'Lists every row routed to the Dev team.',
  `(${colRange('routedTo')}="Dev")`,
  'FFC00000'
);
buildViewSheet(
  'QA',
  'Lists every row routed to QA.',
  `(${colRange('routedTo')}="QA")`,
  'FF7030A0'
);
buildViewSheet(
  'Product',
  'Lists every row routed to Product or Design.',
  `((${colRange('routedTo')}="Product")+(${colRange('routedTo')}="Design")>0)`,
  'FFED7D31'
);
buildViewSheet(
  'Business',
  'Lists every row routed to Business or Operations.',
  `((${colRange('routedTo')}="Business")+(${colRange('routedTo')}="Operations")>0)`,
  'FF548235'
);
buildViewSheet(
  'Open',
  'Lists every row that is Open, In Progress, Need More Info, Blocked, or Ready for QA.',
  `((${colRange('status')}="Open")+(${colRange('status')}="In Progress")+(${colRange('status')}="Need More Info")+(${colRange('status')}="Blocked")+(${colRange('status')}="Ready for QA")>0)`,
  'FFBF8F00'
);
buildViewSheet(
  'Closed',
  'Lists every row that is Closed, Resolved, Duplicate, or Won\'t Fix.',
  `((${colRange('status')}="Closed")+(${colRange('status')}="Resolved")+(${colRange('status')}="Duplicate")+(${colRange('status')}="Won\'t Fix")>0)`,
  'FF548235'
);

// ============================================================
// Dashboard sheet
// ============================================================
const dash = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }] });
dash.mergeCells(1, 1, 1, 6);
const dT = dash.getCell(1, 1);
dT.value = 'Seller Store — Issue Tracker Dashboard';
dT.font = FONT_TITLE;
dT.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
dT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
dash.getRow(1).height = 30;

dash.mergeCells(2, 1, 2, 6);
const dS = dash.getCell(2, 1);
dS.value = '🔒 Read-only. All numbers recompute from Master Tracker.';
dS.font = { ...FONT, italic: true, color: { argb: 'FF7F6000' } };
dS.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
dS.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.protected } };

const statusCol = colLetter(COL_OF('status'));
const prioCol   = colLetter(COL_OF('priority'));
const routeCol  = colLetter(COL_OF('routedTo'));
const moduleCol = colLetter(COL_OF('module'));
const typeCol   = colLetter(COL_OF('type'));
const idCol     = colLetter(COL_OF('id'));
const mtRange = (c) => `'Master Tracker'!${c}${DATA_START}:${c}${DATA_START + MAX_ROWS - 1}`;

// Total row
dash.getCell(4, 1).value = 'Total tracked issues';
dash.getCell(4, 1).font = { ...FONT_BOLD, size: 12 };
dash.mergeCells(4, 1, 4, 2);
dash.getCell(4, 3).value = { formula: `COUNTA(${mtRange(idCol)})` };
dash.getCell(4, 3).font = { ...FONT_BOLD, size: 12 };
dash.getCell(4, 3).alignment = { horizontal: 'center' };

function dashBlockAt(startRow, startCol, title, items, valueColLetter) {
  dash.mergeCells(startRow, startCol, startRow, startCol + 2);
  const h = dash.getCell(startRow, startCol);
  h.value = title;
  h.font = { ...FONT_HEADER, size: 12 };
  h.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeader } };
  dash.getRow(startRow).height = 22;
  for (let i = 0; i < items.length; i++) {
    const r = startRow + 1 + i;
    const labelCell = dash.getCell(r, startCol);
    labelCell.value = items[i];
    labelCell.font = FONT;
    labelCell.alignment = { horizontal: 'left', indent: 1 };
    labelCell.border = { top:{style:'hair',color:{argb:'FFBFBFBF'}}, bottom:{style:'hair',color:{argb:'FFBFBFBF'}}, left:{style:'hair',color:{argb:'FFBFBFBF'}}, right:{style:'hair',color:{argb:'FFBFBFBF'}} };
    dash.mergeCells(r, startCol, r, startCol + 1);
    const valCell = dash.getCell(r, startCol + 2);
    valCell.value = { formula: `COUNTIF(${mtRange(valueColLetter)}, "${items[i]}")` };
    valCell.font = FONT_BOLD;
    valCell.alignment = { horizontal: 'center' };
    valCell.border = { top:{style:'hair',color:{argb:'FFBFBFBF'}}, bottom:{style:'hair',color:{argb:'FFBFBFBF'}}, left:{style:'hair',color:{argb:'FFBFBFBF'}}, right:{style:'hair',color:{argb:'FFBFBFBF'}} };
  }
}

dashBlockAt(6, 1, 'By Status',    lists.Status,    statusCol);
dashBlockAt(6, 4, 'By Priority',  lists.Priority,  prioCol);
const rowAfterStatus = 6 + Math.max(lists.Status.length, lists.Priority.length) + 2;
dashBlockAt(rowAfterStatus, 1, 'By Routed To', lists.RoutedTo, routeCol);
dashBlockAt(rowAfterStatus, 4, 'By Issue Type', lists.IssueType, typeCol);

dash.getColumn(1).width = 22; dash.getColumn(2).width = 18; dash.getColumn(3).width = 10;
dash.getColumn(4).width = 22; dash.getColumn(5).width = 18; dash.getColumn(6).width = 10;

dash.protect('SellerStoreQA', { selectLockedCells: true, selectUnlockedCells: true });

// Reorder: Dashboard first, then Master, then views, then Lists
const desired = ['Dashboard','Master Tracker','Open','Enhancements','Dev','QA','Product','Business','Closed','Lists'];
wb.worksheets.sort((a, b) => desired.indexOf(a.name) - desired.indexOf(b.name));
// exceljs reorders via `orderNo` — but the above sort on the array doesn't always rewrite; do it explicitly
for (let i = 0; i < desired.length; i++) {
  const ws = wb.getWorksheet(desired[i]);
  if (ws) ws.orderNo = i;
}

wb.xlsx.writeFile(OUT).then(() => {
  console.log('✓ Wrote', OUT);
  console.log('  Sheets:', wb.worksheets.map(w => w.name).join(', '));
});
