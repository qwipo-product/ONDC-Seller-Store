const ExcelJS = require('exceljs');
const path = require('path');

const outputPath = path.join(__dirname, 'Feature-Discussion-Summary-21May2026.xlsx');

const moduleColors = {
  'Super Admin':        'FFD9E8FB',
  'Seller Admin':       'FFD9F2D9',
  'Buyer Application':  'FFFFE4C4',
  'Orders Module':      'FFFFF8B3',
  'Customer Module':    'FFE6D9F2',
  'BMS Admin':          'FFFAD1DC',
};

const HEADER_FILL = 'FF1F3864';
const HEADER_FONT = 'FFFFFFFF';
const FONT_NAME   = 'Arial';

function setBorders(cell) {
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left:   { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right:  { style: 'thin', color: { argb: 'FFBFBFBF' } },
  };
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Omkar Charankar';
  wb.created = new Date();

  const ws = wb.addWorksheet('Discussion Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: '#',              key: 'id',      width: 5  },
    { header: 'Module',         key: 'module',  width: 20 },
    { header: 'Application',    key: 'app',     width: 18 },
    { header: 'Page / Section', key: 'page',    width: 40 },
    { header: 'Change Type',    key: 'type',    width: 24 },
    { header: 'Description',    key: 'desc',    width: 90 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    setBorders(cell);
  });
  headerRow.height = 30;

  const rows = [
    [1, 'Super Admin', 'Super Admin',
      'Manage Seller > Seller Creation > Serviceability Tab',
      'Enhancement',
      'Enhanced serviceability tab: user selects a Company, assigns a Beat Name, sets Delivery Day, and uploads a Polygon. One company can have multiple beats; the same delivery day can be mapped to multiple areas. Includes Save functionality. Enables company-wise serviceability configuration and geographic delivery mapping.'],

    [2, 'Seller Admin', 'Seller Admin',
      'Customer Creation Flow',
      'Impact - Auto-Assignment',
      'Customer is auto-assigned Beat Name and Expected Delivery Day based on the serviceability polygon configured in Super Admin. Reduces manual mapping effort and fully automates delivery planning.'],

    [3, 'Seller Admin', 'Seller Admin',
      'Customer List Page',
      'Impact - Data Display',
      'Serviceability data (Beat Name & Delivery Day) is reflected on the customer list page, giving sellers visibility into each customer\'s assigned delivery schedule.'],

    [4, 'Buyer Application', 'Buyer App',
      'Distributor List Page',
      'Impact - Data Display',
      'Delivery Day (derived from polygon mapping) is displayed so buyers can see the distributor\'s delivery schedule before placing an order.'],

    [5, 'Buyer Application', 'Buyer App',
      'Order Placement Flow / Orders List / Order Details Page',
      'Impact - Data Display',
      'Beat Name is used during order creation for structured order routing. Delivery Day is shown on the Orders List and Order Details pages, giving buyers full delivery visibility post-order.'],

    [6, 'Orders Module', 'Seller Admin',
      'Orders Page > Columns',
      'Enhancement - New Columns',
      'New columns added to the orders table: Expected Delivery Date, Expected Delivery Day, and Delivery Type. Improves delivery tracking, operational planning visibility, and order categorization.'],

    [7, 'Orders Module', 'Seller Admin',
      'Orders Page > Classification / Delivery Types',
      'Enhancement - New Statuses',
      'Three new delivery types introduced - NDD Requested (next-day priority delivery), Sales Beat Order (standard scheduled beat delivery), and Non Sales Beat Order (orders outside the planned beat cycle). Enables fast-track delivery identification and beat-wise operational planning.'],

    [8, 'Orders Module', 'Seller Admin',
      'Orders Page > Confirmed Orders View',
      'New Feature - Tab Split',
      'Confirmed orders now have two sub-tabs: "Tomorrow Deliveries" for immediate dispatch planning, and "Beyond Tomorrow Deliveries" for future order management.'],

    [9, 'Customer Module', 'Seller Admin',
      'Customer View Page / Company Popup',
      'Enhancement',
      'Customer view page and company popup now display Company Name, Beat Name, Delivery Day, Status, and Block Action - providing complete customer serviceability visibility and control over the customer\'s ordering ability.'],

    [10, 'Customer Module', 'Seller Admin',
      'Customer Creation Logic / Polygon-Based Customer Sync / Seller Customer List',
      'New Logic - Backend',
      'Remove dependency on first-order placement: customers can now exist before placing any order. When serviceability is set up, backend fetches all customers within the polygon and auto-creates them in the Seller Customer List with Beat Name and Delivery Day pre-assigned. Fully automated onboarding and mapping.'],

    [11, 'BMS Admin', 'BMS Admin',
      'Distributor Management > Distributor Type',
      'New Feature',
      'New distributor type selection step before banner creation - user selects either "Qwipo 2.0 Wholesaler" or "Marketplace Distributor". Supports distributor categorization and marketplace-specific onboarding flows.'],

    [12, 'BMS Admin', 'BMS Admin',
      'Banner Management / Promotions',
      'New Feature',
      'Introduce banner creation feature for distributor promotions. Admin can create promotional banners tied to the selected distributor type to improve distributor visibility.'],
  ];

  rows.forEach((r) => {
    const row = ws.addRow(r);
    const moduleName = r[1];
    const fill = moduleColors[moduleName];
    row.eachCell((cell, colNumber) => {
      cell.font = { name: FONT_NAME, size: 10, bold: colNumber === 2 };
      cell.alignment = {
        vertical: 'middle',
        wrapText: true,
        horizontal: (colNumber === 1) ? 'center' : 'left',
      };
      setBorders(cell);
      if (fill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      }
    });
    row.height = 70;
  });

  await wb.xlsx.writeFile(outputPath);
  console.log('Created:', outputPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
