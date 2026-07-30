const ExcelJS = require('exceljs');
const path = require('path');

const OUT_DIR  = 'C:\\Users\\Lenovo\\Downloads';
const OUT_FILE = path.join(OUT_DIR, 'Eb2b-Digidukaan-ProdBacklog-Consolidated.xlsx');

// ---------- Styling ----------
const FONT_NAME = 'Arial';

const TITLE_FILL    = 'FF1F3864';
const TITLE_FONT    = 'FFFFFFFF';
const SUBTITLE_FILL = 'FFD9E1F2';
const HEADER_FILL   = 'FF1F3864';
const HEADER_FONT   = 'FFFFFFFF';

const appFill = {
  'Seller Admin': 'FFE6D9F2', // light purple
  'Seller User':  'FFD9F2D9', // light green
  'Buyer App':    'FFFFE4C4', // light peach
  'ONDC':         'FFFAD1DC', // light pink
};

const priorityFill = {
  'P0': 'FFE06666', // red
  'P1': 'FFF6B26B', // orange
  'P2': 'FFFFE599', // yellow
  'P3': 'FFD9D9D9', // grey
};

const statusFill = {
  'Open':        'FFFCE4D6',
  'In Progress': 'FFFFF2CC',
  'Discussion':  'FFDEEAF6',
  'Blocked':     'FFF4CCCC',
  'Done':        'FFD9EAD3',
  'Deferred':    'FFEFEFEF',
};

function thinBorder(cell) {
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left:   { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right:  { style: 'thin', color: { argb: 'FFBFBFBF' } },
  };
}

// ---------- Backlog data (consolidated, deduped, rewritten) ----------
// Columns: app | page | subject | description | priority | status | notes
const items = [
  // =====================================================================
  // ONDC PROTOCOL & INTEGRATION
  // =====================================================================
  ['ONDC', 'ON_SEARCH',
    'Add mandatory provider type (eB2B) in catalog response',
    'Bizom catalog response is missing the mandatory provider type "eB2B". This is a spec non-compliance against the RETeB2B specification and must be added in the ON_SEARCH payload.',
    'P1', 'Open',
    'Owner: Bizom. Share the exact JSON key location with Bizom for fix.'],

  ['ONDC', 'ON_SEARCH',
    'Include provider credentials object',
    'Provider credentials object is missing from the ON_SEARCH response. Required by RETeB2B spec for downstream consumer verification.',
    'P1', 'Open',
    'Owner: Bizom. Pending exact JSON key alignment with Bizom.'],

  ['ONDC', 'ON_SEARCH',
    'Make provider descriptor compliant with RETeB2B',
    'Provider descriptor block is not fully compliant with RETeB2B spec — needs alignment of fields and structure.',
    'P0', 'Open',
    'Owner: Bizom. Needs spec walkthrough.'],

  ['ONDC', 'ON_SEARCH',
    'Add brand details inside item tags',
    'Brand details are missing inside item tags in the catalog response. Required as per ON_Search spec for buyer-side filtering and display.',
    'P0', 'Open',
    'Owner: Bizom. Share field-level expectation.'],

  ['ONDC', 'ON_SEARCH',
    'Replace radius-based serviceability with pincode / polygon',
    'Serviceability is currently implemented by Bizom using a radius-based approach. Business requires pincode/polygon-based serviceability. This is a larger rework, not a quick fix.',
    'P0', 'Open',
    'Owner: Bizom. Bizom flagged this as a larger task; needs internal call and roadmap commitment.'],

  ['ONDC', 'ON_SEARCH',
    'Include schemes/offers in catalog response',
    'Schemes are not included in the ON_SEARCH catalog response. Today only a flat order-level discount is supported, which is auto-applied. Needed for personalized & SKU-level promotional selling.',
    'P0', 'Open',
    'Owner: Bizom. Depends on full schemes engine — see also Schemes Support, Slab Schemes, Combo, Free, Invoice-level.'],

  ['ONDC', 'P2P Flow',
    'Validate end-to-end P2P flow (SELECT → INIT → CONFIRM)',
    'Full peer-to-peer flow is not validated end-to-end. Must run SELECT → INIT → CONFIRM with real data and confirm each transition.',
    'P0', 'Open',
    'Owner: Bizom. Core B2B requirement. Planned for upcoming Bizom phase.'],

  ['ONDC', 'P2P Flow',
    'Support personalized schemes via P2P',
    'P2P personalization for schemes is not yet supported. Required to deliver retailer-specific schemes through ONDC.',
    'P0', 'Open',
    'Owner: Bizom. Planned for upcoming phase per Bizom.'],

  ['ONDC', 'P2P Flow',
    'Pass retailer credit limit through P2P',
    'Retailer credit limit is not exchanged via P2P. Blocks INIT/ON_INIT credit logic.',
    'P0', 'Open',
    'Owner: Bizom. Planned for upcoming phase per Bizom.'],

  ['ONDC', 'SELECT',
    'Pass customer info in SELECT (blocked on P2P)',
    'Customer information cannot currently be passed in SELECT because P2P is not live. Flow remains incomplete until P2P lands.',
    'P0', 'Blocked',
    'Blocked by P2P Flow.'],

  ['ONDC', 'SELECT',
    'Allow offers object in SELECT (blocked on schemes)',
    'Offers object cannot be included in SELECT because the schemes engine is not yet supported.',
    'P0', 'Blocked',
    'Blocked by Schemes Support.'],

  ['ONDC', 'ON_SELECT',
    'Return personalized offers in ON_SELECT',
    'Personalized offers are not being returned in ON_SELECT. Depends on P2P + schemes engine.',
    'P0', 'Blocked',
    'Blocked by P2P + Schemes Support.'],

  ['ONDC', 'ON_SELECT',
    'Validation screen at checkout — proceed with available items on stock issue',
    'When stock issues are detected at checkout, show a validation screen and let the buyer proceed with available items instead of failing the whole cart.',
    'P0', 'In Progress',
    'Owner: Qwipo. Work in progress; needed before exhibit go-live.'],

  ['ONDC', 'INIT',
    'Send customer registration ID in INIT',
    'Customer registration ID cannot be sent in INIT. Required for retailer identification end-to-end.',
    'P0', 'Blocked',
    'Blocked by P2P Flow.'],

  ['ONDC', 'INIT',
    'Allow offer selection in INIT',
    'Buyer cannot select offers during INIT because schemes are not yet supported.',
    'P0', 'Blocked',
    'Blocked by Schemes Support.'],

  ['ONDC', 'ON_INIT',
    'Return retailer credit limit in ON_INIT',
    'Retailer credit limit is not returned in ON_INIT response. Required for credit-based ordering logic.',
    'P0', 'Blocked',
    'Blocked by P2P credit-limit exchange.'],

  ['ONDC', 'ON_INIT',
    'Reinitiate SELECT flow when INIT expires',
    'When INIT has expired, the flow should automatically re-trigger SELECT instead of failing.',
    'P1', 'In Progress',
    'Owner: Qwipo. Work in progress; needed before exhibit go-live.'],

  ['ONDC', 'ON_CONFIRM',
    'Include BAP T&C in ON_CONFIRM (only BPP T&C received today)',
    'ON_CONFIRM today returns only BPP terms. Both BAP and BPP terms must be present for compliance.',
    'P1', 'Open',
    'Compliance issue.'],

  ['ONDC', 'Post-Order',
    'Emit unsolicited STATUS events',
    'Bizom is not emitting unsolicited STATUS events post-order, which breaks the lifecycle on the buyer side.',
    'P0', 'Done',
    'Marked done in earlier review — re-verify on next exhibit run.'],

  ['ONDC', 'Compliance',
    'Relay real data through ONDC protocol (no mocks)',
    'Exhibit environment must transmit real data through the ONDC protocol; even staged data must be protocol-compliant. No mocked payloads.',
    'P0', 'Open',
    'Owner: Bizom.'],

  ['ONDC', 'Compliance',
    'Submit network observability logs for exhibit',
    'Submit required logs to the ONDC network for the exhibit environment and complete compliance testing.',
    'P1', 'Open',
    'Owner: Qwipo. Confirm whether the ask is network observability logs.'],

  ['ONDC', 'Compliance',
    'Joint error classification (Qwipo vs Bizom)',
    'List errors observed in the last exhibit run-through and classify which side (Qwipo / Bizom) owns the fix.',
    'P1', 'Open',
    'Joint task.'],

  ['ONDC', 'Compliance',
    'Stabilize test-distributor end-to-end flow',
    'Make the currently activated test distributor flow stable end-to-end before exhibit go-live.',
    'P0', 'Open',
    'Owner: Bizom.'],

  ['ONDC', 'Compliance',
    'Catalog data validation feedback loop',
    'Download the catalog from the buyer app and send it back to Bizom for validation confirmation against source-of-truth data.',
    'P1', 'Open',
    'Owner: Bizom.'],

  ['ONDC', 'Logistics Pricing',
    'Category-wise rate card structure (per kg)',
    'Logistics rate card must be structured by category and priced per kg so the buyer app can compute delivery fees accurately.',
    'P0', 'Discussion',
    'Phase 1.'],

  ['ONDC', 'DP App',
    'Cash collection: discount, cash and credit entry',
    'DP app must support discount entry, cash entry and credit amount entry at collection time so settlement is accurate.',
    'P0', 'Discussion',
    'Phase 1.'],

  ['ONDC', 'DP App',
    'UPI QR visibility in DP app',
    'Show the UPI QR for collections inside the DP app.',
    'P0', 'Discussion',
    'Phase 1.'],

  ['ONDC', 'DP App',
    'Credit order identification',
    'DP app must identify credit-based orders distinctly so collection logic differs from cash/UPI orders.',
    'P1', 'Discussion',
    ''],

  ['ONDC', 'LBNP',
    'Collection reconciliation (Cash, UPI, Credit)',
    'Reconcile collections across Cash, UPI and Credit channels in LBNP. Based on bandwidth this can be pushed to Phase 2.',
    'P0', 'Discussion',
    'Phase 1 target; movable to Phase 2 on bandwidth.'],

  ['ONDC', 'Orders Page',
    'Multi-order selection with KPI map view',
    'Allow selecting multiple orders on the ONDC orders page and surface aggregated value & counts as KPIs in the map view.',
    'P1', 'Discussion',
    'Phase 2.'],

  ['ONDC', 'Delivery Scheduling',
    'Customer delivery day & scheduled delivery (ONDC)',
    'Through ONDC, allow customers to choose a delivery day / scheduled delivery date instead of NDD only. Covers delivery day assignment, scheduled delivery support and slot allocation as one feature.',
    'P2', 'Open',
    'Merges earlier items: Delivery Day Assignment, Scheduled Delivery Support, Delivery Slot Allocation. Needs ONDC discussion to close scope.'],

  // =====================================================================
  // BUYER APP
  // =====================================================================
  ['Buyer App', 'Home Screen',
    'New distributor-first home screen',
    'Revamp the buyer app home screen with a distributor-first structure. Flow: Seller Type → Distributor → Company → Category / Brand → Product List.',
    'P0', 'Discussion',
    'Owner: Vikas. Phase 1.'],

  ['Buyer App', 'Home Screen',
    'BMS-driven dynamic banners',
    'Dynamic banners and promotional campaigns configured from BMS should render on the home screen based on distributor type, company, category and brand mapping.',
    'P0', 'Discussion',
    'Depends on BMS Promotion module (Seller Admin).'],

  ['Buyer App', 'Distributors List',
    'Distributors list page',
    'Buyer-facing list of distributors with delivery metadata, MOV and available companies.',
    'P0', 'Discussion',
    'Header should show breadcrumbs + MOV + NDD fees.'],

  ['Buyer App', 'Distributor / Seller',
    'Distributor / seller detail page',
    'Dedicated distributor/seller detail page showing delivery options, MOV and the list of available companies.',
    'P0', 'Discussion',
    'Header: breadcrumbs + MOV + NDD fees.'],

  ['Buyer App', 'Company Category / Brand',
    'Company category & brand pages',
    'Dedicated pages for company categories and brands with structured navigation. Header shows breadcrumbs + MOV + NDD fees.',
    'P0', 'Discussion',
    ''],

  ['Buyer App', 'Product List',
    'Distributor product list page',
    'Distributor-scoped product listing page with breadcrumbs, MOV and NDD fees in header.',
    'P0', 'Discussion',
    ''],

  ['Buyer App', 'Cart',
    'Cart summary UI revamp',
    'Redesign the cart summary screen: improved hierarchy, cleaner product grouping, distributor / company visibility and easier checkout. Includes NDD or Beat-day selection at the seller level.',
    'P0', 'Discussion',
    'Phase 1.'],

  ['Buyer App', 'Order Summary',
    'Order summary UI revamp with radio-driven delivery selection',
    'Revamp order summary screen with radio button-based selection flow for delivery-related actions and improved order information visibility.',
    'P0', 'Discussion',
    ''],

  ['Buyer App', 'Search',
    'Product search across home, distributor, category, brand, PLP',
    'Enhance search functionality across Home Page, Distributor List, Category Pages, Brand Pages and Product Listing Pages with unified product search logic.',
    'P0', 'Discussion',
    ''],

  ['Buyer App', 'Delivery',
    'NDD + Beat delivery (buyer side)',
    'Show NDD only up to 2 PM; after the cut-off, NDD option is hidden. Beat-day delivery becomes the alternative. Expected delivery date is derived from weekday mapping, distributor-enabled area logic and seller working hours.',
    'P0', 'Discussion',
    'Phase 1. Needs a story written out. Paired with Seller Store delivery changes.'],

  ['Buyer App', 'Customer / P2P',
    'Send retailer info to all vendors via P2P search',
    'Buyer app must broadcast retailer/customer information to all vendors using the P2P Search mechanism so vendors can return personalized catalog & schemes.',
    'P0', 'Discussion',
    'Owner: Shubham. Phase 1.'],

  // =====================================================================
  // SELLER USER (Seller Store user-facing)
  // =====================================================================
  ['Seller User', 'Customer',
    'Polygon-driven auto customer creation',
    'Remove dependency on first-order placement for customer creation. Customers are auto-created from polygon serviceability mapping with Beat Name and Delivery Day pre-assigned at creation time.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Customer',
    'Auto-assign beat name and expected delivery day',
    'Each customer is auto-assigned a Beat Name and Expected Delivery Day based on the serviceability polygon configured by Super Admin.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Customer',
    'Customer view popup with delivery + control fields',
    'Company popup on the customer page shows Company Name, Beat Name, Delivery Day, Status and a Block / Unblock action.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Customer',
    'Customer detail page reflects serviceability',
    'Customer detail / list page surfaces Beat Name and Delivery Day pulled from the serviceability configuration.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Customer',
    'Customer export includes beat + delivery day',
    'Customer Data Export must include Company Name, Beat Name and Delivery Day columns.',
    'P1', 'Discussion',
    ''],

  ['Seller User', 'Customer',
    'Block / Unblock action in company popup',
    'Block and Unblock functionality available directly from the company popup on the customer page.',
    'P1', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Orders table column set (delivery + beat)',
    'Orders table columns: Order, Company, Retailer, Mobile, Value, Order Date, Expected Delivery Date, Beat Name, Beat Delivery Day, Delivery Type, Status, Actions.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Delivery classification badges (Urgent / Regular)',
    'Each order is classified into one of two delivery types — Urgent (red badge) or Regular (blue badge).',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Confirmed orders sub-tabs (All / Tomorrow / Beyond)',
    'Three sub-tabs on the Confirmed orders view with live counts: All, Tomorrow Deliveries, Beyond Tomorrow Deliveries.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Bulk update expected delivery date + WhatsApp notify',
    'On the Confirmed tab, seller can select multiple orders → click Update Delivery Date → pick a new Expected Delivery Date in a dialog (past dates blocked) → save. Success toast confirms reschedule and a WhatsApp notification is sent to every affected customer.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Per-order delivery logic fields',
    'Each order carries Expected Delivery Date (dispatch day), Beat Name (route / truck), Beat Delivery Day (derived weekday) and Delivery Type (Urgent / Regular).',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Auto-group confirmed orders: Tomorrow vs Beyond Tomorrow',
    'Confirmed orders auto-group by Expected Delivery Date relative to today: tomorrow → Tomorrow Deliveries; later → Beyond Tomorrow Deliveries.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Order list: expected delivery date column + filter',
    'Add Expected Delivery Date as a column and a filter on the order list page so sellers can plan dispatch.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Order detail: expected delivery + schedule visibility',
    'Order detail page shows full expected-delivery information and the delivery schedule / date timeline.',
    'P0', 'Discussion',
    ''],

  ['Seller User', 'Orders',
    'Order modification & partial cancellation workflow',
    'Allow partial cancellation or modification of an order before fulfillment completes.',
    'P2', 'Open',
    'Reduces operational dependency and improves customer flexibility.'],

  ['Seller User', 'Delivery',
    'Seller working hours & expected delivery date logic',
    'Seller working hours are valid until 2:00 PM. Orders placed before 2 PM show current expected delivery date; after 2 PM the expected delivery date shifts. Date determination uses geo polygon, delivery day mapping and seller working hours.',
    'P0', 'Discussion',
    'Phase 1. Implementation needed in Buyer App, Seller Store and order-placement flow.'],

  ['Seller User', 'Delivery',
    'NDD delivery fees (₹x / kg, fixed)',
    'Delivery fees for NDD are fixed at ₹x / kg from the logistics rate card. Today this is a Qwipo USP and does not go through the ONDC protocol — the rate card is saved and sent separately to the Buyer App.',
    'P0', 'Discussion',
    'Phase 1.'],

  ['Seller User', 'Delivery',
    'NDD + Beat delivery — seller-side customer module',
    'Seller Store: add a Delivery Day field at the customer level, configurable from Customer List and Customer Details. Delivery day auto-tags from polygon mapping, serviceability configuration and beat-wise delivery allocation. Apply to both new and old customers.',
    'P0', 'Discussion',
    'Phase 1. Paired with Buyer App NDD + Beat delivery item.'],

  ['Seller User', 'Logistics',
    'Logistics flow & event rework for delivery scheduling',
    'Rework logistics flow based on updated delivery-day logic, expected delivery timelines and order scheduling. Redefine state-wise event flow and data movement across Logistics Seller App, Logistics Buyer App and Logistics Ops — covering order state transitions, delivery scheduling events and expected delivery synchronization.',
    'P0', 'Discussion',
    'Phase 1.'],

  ['Seller User', 'Orders',
    'MOV differs for Sales Beat vs Non-Sales Beat',
    'Minimum order value must be configurable separately for Sales-Beat customers and Non-Sales-Beat customers.',
    'P1', 'Open',
    ''],

  ['Seller User', 'Invoicing',
    'Move away from JIT invoicing for current wholesalers',
    'Today the invoice for current wholesalers is generated from our side because of the JIT model. We need to move away from this so the distributor issues their own invoice.',
    'P1', 'Open',
    'Phase 2.'],

  // =====================================================================
  // SELLER ADMIN (Super Admin + BMS Admin)
  // =====================================================================
  ['Seller Admin', 'Manage Seller',
    'Serviceability tab: company → beat → delivery day → polygon',
    'Enhanced serviceability tab. User selects a Company, assigns a Beat Name, sets a Delivery Day and uploads a Polygon. One company can have multiple beats; the same delivery day can be mapped to multiple areas. Includes Save functionality.',
    'P0', 'Discussion',
    'Phase 1.'],

  ['Seller Admin', 'Manage Seller',
    'Multiple beats per company with different schedules',
    'Allow multiple beats for the same company, each with its own delivery schedule and area mapping.',
    'P0', 'Discussion',
    ''],

  ['Seller Admin', 'Manage Seller',
    'Bit-wise serviceability configuration with delivery day',
    'New bit-wise serviceability configuration: while creating a bit / serviceability area the user must define the associated delivery day. Customers mapped to a polygon / bit inherit the delivery day automatically — reflected on Customer List and Customer Details pages. Category-wise rate card from LBNP is set here so it can drive delivery fees in the Buyer App.',
    'P0', 'Discussion',
    'Phase 1. Enables structured route-wise / day-wise delivery planning.'],

  ['Seller Admin', 'BMS Promotion',
    'BMS: distributor type selection (Qwipo 2.0 vs Marketplace)',
    'Distributor type selection is the first step during BMS creation. The user must select either "Qwipo 2.0 Seller" or "Marketplace Distributor" before configuring anything else.',
    'P0', 'Discussion',
    ''],

  ['Seller Admin', 'BMS Promotion',
    'BMS: promotion type visibility by distributor type',
    'Promotion type options change dynamically based on distributor selection. Qwipo 2.0 Seller sees Banner and KPI options; Marketplace Distributor sees only Banner option.',
    'P0', 'Discussion',
    ''],

  ['Seller Admin', 'BMS Promotion',
    'BMS: distributor category mapping from NSC Master',
    'When a distributor type is selected, the corresponding distributor category list is loaded from the NSC Master Category List.',
    'P0', 'Discussion',
    ''],

  ['Seller Admin', 'BMS Promotion',
    'BMS: banner & KPI promotion management',
    'Admin can create banners and promotions linked to distributor type and categories. KPI promotions are applicable only for Qwipo 2.0 Sellers.',
    'P0', 'Discussion',
    ''],

  ['Seller Admin', 'Promotions',
    'In-app promotions with distributor targeting and clone',
    'Create in-app promotions with distributor-specific targeting and a clone-existing-promotion shortcut. Reduces dependency on WhatsApp campaigns and improves targeting.',
    'P0', 'Discussion',
    'Phase 1.'],

  ['Seller Admin', 'Offers / Schemes',
    'Schemes engine (qty / slab / discount)',
    'Enable the full schemes engine: quantity-based, slab-based and discount-based offers. Required by Colgate and critical for promotional selling.',
    'P1', 'Open',
    'Post Phase 1. Parent feature for the next four scheme items.'],

  ['Seller Admin', 'Offers / Schemes',
    'Slab-based schemes',
    'Configure multiple slabs with min / max quantity and applicable discount values. Supports quantity-based promotional structures.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Offers / Schemes',
    'Combo / bundle offers',
    'Allow bundled product offers like Buy X Get Y and combo discounts. Improves campaign flexibility and basket size.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Offers / Schemes',
    'Free product schemes',
    'Add free SKU / product as part of promotional offers. Supports trade and retailer incentive schemes.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Offers / Schemes',
    'Invoice-level offers',
    'Apply discounts or schemes at the overall invoice / cart level (not just SKU-level). Enables advanced offer calculations.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Notifications',
    'Customer notification for delayed delivery',
    'Automatically notify customers when deliveries are delayed or rescheduled. Improves customer communication and reduces support escalations.',
    'P1', 'Open',
    ''],

  ['Seller Admin', 'Notifications',
    'Distributor-targeted notifications',
    'Send notifications based on distributor mapping and scheme targeting. Eliminates generic notifications and improves engagement.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Notifications',
    'Deep link UTM tracking',
    'Add UTM parameters to deep links for campaign attribution and WhatsApp / open conversion tracking.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Notifications',
    'Notification bell + center',
    'Add a notification bell icon with alert indicators in the seller admin shell, backed by a Notification Center panel listing alerts and updates.',
    'P3', 'Deferred',
    'Merged from earlier Notification Bell (Hidden / Deferred) and Notification Center items.'],

  ['Seller Admin', 'Catalog / Products',
    'Product & variant structure (UPC, inner pack, group name)',
    'Define a standardized product hierarchy and variant structure using UPC, inner pack and group naming conventions. Ensures consistent catalog structure, accurate SKU mapping and scalable product management.',
    'P1', 'Discussion',
    ''],

  ['Seller Admin', 'Catalog / Products',
    'Category and brand image support',
    'Support uploading and displaying category-level and brand-level images in the storefront. Improves storefront branding and product discovery.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Catalog / Products',
    'SKU offer details',
    'Display offer applicability and scheme calculations on SKU detail pages. Improves transparency for retailers.',
    'P1', 'Discussion',
    ''],

  ['Seller Admin', 'Catalog / Products',
    'SKU bulk import',
    'Bulk SKU upload through Excel or CSV import. Reduces catalog onboarding effort.',
    'P2', 'Discussion',
    ''],

  ['Seller Admin', 'Catalog / Products',
    'SKU export',
    'Export the full SKU catalog (with attributes) to Excel / CSV for offline analysis.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Analytics',
    'Retailer reach analytics',
    'Track retailer acquisition source (WhatsApp, in-app campaigns, organic). Helps identify high-performing acquisition channels.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Analytics',
    'Campaign effectiveness analytics',
    'Correlate campaign timelines with sales and order spikes. Measures campaign ROI and effectiveness.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Analytics',
    'Promotion performance dashboard',
    'Dashboard for promotion reach, clicks, conversions and sales impact. Centralized campaign monitoring.',
    'P3', 'Deferred',
    'Future scope.'],

  ['Seller Admin', 'Analytics / Reports',
    'Scheme export report',
    'Download SKU + scheme performance data in a single report for weekly reviews.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Analytics / Reports',
    'Campaign export reports',
    'Export campaign performance and engagement reports for offline analysis and business reviews.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Promotions',
    'Campaign cloning',
    'Duplicate existing campaigns with one-click cloning. Reduces operational effort for recurring campaigns.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Promotions',
    'Distributor-specific campaigns',
    'Run campaigns scoped to specific distributors or retailer groups. Improves personalization and conversion.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Dashboard',
    'Seller dashboard (sales / revenue / orders)',
    'Seller-facing analytics dashboard with sales, revenue and order insights. Gives sellers operational visibility.',
    'P1', 'Discussion',
    ''],

  ['Seller Admin', 'Dashboard',
    'Admin dashboard (platform monitoring)',
    'Admin monitoring dashboard for platform-wide and seller operations. Enables centralized operational management.',
    'P1', 'Discussion',
    ''],

  ['Seller Admin', 'RBAC',
    'Sub-roles & access control',
    'Introduce role-based permissions and restricted access. Parent feature for Read-only, Finance-only and Operations roles.',
    'P2', 'Open',
    'Improves security and operational segregation.'],

  ['Seller Admin', 'RBAC',
    'Read-only viewer role',
    'A role that can only view data, with no edit permissions. Enables controlled access for stakeholders.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'RBAC',
    'Finance-only role',
    'Restrict access to finance and settlement modules only. Prevents unauthorized operational changes.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'RBAC',
    'Operations role',
    'Operational role scoped to order and fulfillment management. Enables role-specific workflows.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Seller Type',
    'Wholesaler seller type',
    'Add wholesaler-specific onboarding and B2B workflows as a distinct seller type. Supports wholesale business expansion.',
    'P1', 'Deferred',
    'Reserved for Phase 2.'],

  ['Seller Admin', 'Integrations',
    'ONDC integration (catalog / orders / offers)',
    'Core ONDC integration covering order, catalog and offer flows. Enables ONDC ecosystem participation.',
    'P0', 'In Progress',
    'In scope.'],

  ['Seller Admin', 'Integrations',
    'Bizom connector (DMS sync)',
    'Sync products, orders and inventory with Bizom DMS. Reduces manual reconciliation effort.',
    'P1', 'Open',
    ''],

  ['Seller Admin', 'Integrations',
    'Tally connector',
    'Enable accounting and invoice synchronization with Tally. Simplifies finance operations.',
    'P2', 'Open',
    ''],

  ['Seller Admin', 'Integrations',
    'SAP integration (Colgate)',
    'SAP synchronization for inventory, pricing, orders and schemes. Critical dependency for the Colgate integration.',
    'P1', 'Open',
    ''],

  ['Seller Admin', 'Integrations',
    'Generic ERP connectors',
    'Generic ERP integration support for enterprise customers. Enables future scalability.',
    'P3', 'Open',
    ''],

  ['Seller Admin', 'Settings',
    'Store settings → working hours',
    'Configure store operational timings and order acceptance windows. Improves delivery and order management.',
    'P1', 'Discussion',
    'Coming Soon.'],

  ['Seller Admin', 'Settings',
    'Consolidated settings page',
    'Centralized settings page for business and operational configurations. Consolidates user configurations.',
    'P2', 'Discussion',
    'Placeholder today.'],
];

// ---------- Build workbook ----------
async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Omkar Charankar';
  wb.created  = new Date();

  const ws = wb.addWorksheet('Backlog', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  // Column layout
  ws.columns = [
    { key: 'id',       width: 7  },
    { key: 'app',      width: 16 },
    { key: 'page',     width: 24 },
    { key: 'subject',  width: 50 },
    { key: 'desc',     width: 80 },
    { key: 'priority', width: 10 },
    { key: 'status',   width: 14 },
    { key: 'notes',    width: 42 },
  ];

  // ---------- Row 1: title ----------
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'eB2B / Digidukaan — Product Backlog (Consolidated)';
  titleCell.font  = { name: FONT_NAME, size: 16, bold: true, color: { argb: TITLE_FONT } };
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // ---------- Row 2: subtitle ----------
  ws.mergeCells('A2:H2');
  const subCell = ws.getCell('A2');
  const today = new Date().toISOString().slice(0, 10);
  subCell.value = `Source: Eb2b-Digidukaan-ProdBacklog.xlsx   |   Consolidated on: ${today}   |   Applications: Seller Admin · Seller User · Buyer App · ONDC`;
  subCell.font  = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF1F3864' } };
  subCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTITLE_FILL } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // ---------- Row 3: spacer ----------
  ws.getRow(3).height = 6;

  // ---------- Row 4: header ----------
  const headers = ['ID', 'Application', 'Page / Module', 'Subject', 'Description', 'Priority', 'Status', 'Notes'];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font  = { name: FONT_NAME, size: 11, bold: true, color: { argb: HEADER_FONT } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    thinBorder(cell);
  });
  headerRow.height = 28;

  // ---------- Data rows ----------
  // Generate IDs per-app: SA-001, SU-001, BA-001, ON-001
  const prefix = {
    'Seller Admin': 'SA',
    'Seller User':  'SU',
    'Buyer App':    'BA',
    'ONDC':         'ON',
  };
  const counters = { SA: 0, SU: 0, BA: 0, ON: 0 };

  items.forEach((row) => {
    const [app, page, subject, desc, priority, status, notes] = row;
    const pfx = prefix[app];
    counters[pfx] += 1;
    const id = `${pfx}-${String(counters[pfx]).padStart(3, '0')}`;

    const r = ws.addRow([id, app, page, subject, desc, priority, status, notes]);

    // Base cell styling
    r.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1F1F1F' } };
      cell.alignment = { vertical: 'top', wrapText: true };
      thinBorder(cell);
    });

    // ID — center, bold-ish
    const idCell = r.getCell(1);
    idCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1F3864' } };
    idCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Application — color tag
    const appCell = r.getCell(2);
    if (appFill[app]) {
      appCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: appFill[app] } };
    }
    appCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1F1F1F' } };
    appCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Page — centered vertically
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Subject — bold-ish
    r.getCell(4).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1F1F1F' } };

    // Priority — chip
    const prCell = r.getCell(6);
    if (priorityFill[priority]) {
      prCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: priorityFill[priority] } };
    }
    prCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1F1F1F' } };
    prCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Status — chip
    const stCell = r.getCell(7);
    if (statusFill[status]) {
      stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill[status] } };
    }
    stCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1F1F1F' } };
    stCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  // ---------- AutoFilter ----------
  const lastRow = 4 + items.length;
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to:   { row: lastRow, column: 8 },
  };

  // ---------- Save ----------
  await wb.xlsx.writeFile(OUT_FILE);
  console.log('Wrote:', OUT_FILE);
  console.log('Total items:', items.length);

  // Per-app counts
  const counts = {};
  for (const it of items) counts[it[0]] = (counts[it[0]] || 0) + 1;
  console.log('Breakdown:', counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
