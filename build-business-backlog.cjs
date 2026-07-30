const ExcelJS = require('exceljs');
const path = require('path');

const OUT_FILE = path.join('C:\\Users\\Lenovo\\Downloads', 'Eb2b-Digidukaan-ProdBacklog-Business.xlsx');

// ---------- Styling ----------
const FONT_NAME      = 'Arial';
const TITLE_FILL     = 'FF1F3864';
const TITLE_FONT     = 'FFFFFFFF';
const SUBTITLE_FILL  = 'FFD9E1F2';
const HEADER_FILL    = 'FF1F3864';
const HEADER_FONT    = 'FFFFFFFF';

const deptFill = {
  'Product — Buyer App':      'FFFFE4C4',
  'Product — Seller Store':   'FFD9F2D9',
  'Product — Super Admin':    'FFE6D9F2',
  'Product — BMS Admin':      'FFFAD1DC',
  'Product — Catalog':        'FFFFF2CC',
  'Product — Offers':         'FFFCE4D6',
  'Product — Settings':       'FFE2EFDA',
  'Product — Notifications':  'FFEAD1DC',
  'Marketing':                'FFDEEAF6',
  'Analytics':                'FFD9EAD3',
  'Security / RBAC':          'FFF4CCCC',
  'Integrations':             'FFD0E0E3',
  'ONDC / Logistics':         'FFFFD7D7',
  'Business':                 'FFEFEFEF',
};

const priorityFill = {
  'P0': 'FFE06666',
  'P1': 'FFF6B26B',
  'P2': 'FFFFE599',
  'P3': 'FFD9D9D9',
};

const statusFill = {
  'Discussion':  'FFDEEAF6',
  'In Progress': 'FFFFF2CC',
  'Pending':     'FFFCE4D6',
  'Coming Soon': 'FFD9EAD3',
  'In Scope':    'FFD9EAD3',
  'Deferred':    'FFEFEFEF',
  'Future':      'FFEFEFEF',
};

const phaseFill = {
  'Phase 1':       'FFD9EAD3',
  'Phase 2':       'FFFFF2CC',
  'Post Phase 1':  'FFFCE4D6',
  'Backlog':       'FFEFEFEF',
  'Future':        'FFEFEFEF',
};

function thinBorder(cell) {
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left:   { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right:  { style: 'thin', color: { argb: 'FFBFBFBF' } },
  };
}

// ---------- Backlog: business / product language only ----------
// [department, module, feature, description, businessImpact, phase, owner, status, priority]
const items = [

  // ====================================================================
  // PHASE 1 — Delivery Model Revamp (NDD + Beat) and supporting work
  // ====================================================================
  ['Product — Seller Store', 'Customer Module',
    'Customer Auto-Creation from Serviceability',
    'Customers are auto-created from the polygon/serviceability mapping with Beat Name and Delivery Day pre-assigned, instead of waiting for the first order. Works for both newly mapped customers and existing ones.',
    'Removes manual customer setup, eliminates the chicken-and-egg "no customer until first order" problem, and ensures every customer has a beat and delivery day from day one.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Customer Module',
    'Customer List & Detail — Beat and Delivery Day Visibility',
    'Customer list and detail pages display Company Name, Beat Name, Delivery Day, Status and a Block/Unblock action directly on the company popup.',
    'Gives sellers a single, glanceable view of who their customer is, when they get serviced, and whether they are active — without opening multiple screens.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Customer Module',
    'Customer Export with Beat & Delivery Day',
    'Customer data export includes Company Name, Beat Name and Delivery Day columns.',
    'Sellers can plan routes and share customer lists with field teams offline using the same beat/delivery structure used in the app.',
    'Phase 1', '', 'Discussion', 'P1'],

  ['Product — Seller Store', 'Customer Module',
    'Block / Unblock Customer from Company Popup',
    'Block and Unblock actions are available inline from the company popup on the customer page.',
    'Sellers can quickly suspend a defaulting or problematic retailer without navigating away.',
    'Phase 1', '', 'Discussion', 'P1'],

  ['Product — Super Admin', 'Manage Seller',
    'Serviceability Tab — Company, Beat, Delivery Day, Polygon',
    'Inside Manage Seller, an enhanced serviceability tab lets the admin pick a Company, assign a Beat Name, set a Delivery Day, and upload a Polygon. One company can have multiple beats, and the same delivery day can be mapped to multiple areas.',
    'Centralizes route, day and area planning. Drives every downstream delivery decision (buyer-facing dates, seller order tagging, customer beat assignment) from a single source of truth.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Super Admin', 'Manage Seller',
    'Multi-Beat per Company with Independent Schedules',
    'A single company can run multiple beats, each with its own delivery schedule and area mapping.',
    'Reflects how distributors actually operate (different routes on different days) and unlocks accurate beat planning at scale.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Super Admin', 'Serviceability',
    'Bit-wise Serviceability Configuration with Delivery Day',
    'When creating a bit/serviceability area the user must define the associated delivery day. Customers mapped to that bit/polygon automatically inherit it and the delivery day shows on the customer list and detail pages. The category-wise rate card from LBNP is configured here so the Buyer App can compute delivery fees.',
    'Enables structured route-wise/day-wise delivery planning and is the single configuration point that powers delivery fees, expected delivery dates, and beat-day tagging everywhere.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Catalog / Working Hours',
    'Seller Working Hours & Expected Delivery Date Logic',
    'Seller working hours are valid until 2:00 PM. Orders placed before 2 PM show the current expected delivery date; orders placed after 2 PM shift to the next eligible date. The date is derived from geo polygon, delivery day mapping and seller working hours. Applies in Buyer App, Seller Store and the order placement flow.',
    'Sets clear, system-driven delivery expectations for buyers and removes ambiguous promises — directly improving on-time delivery rate and reducing reschedule conversations.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Delivery',
    'NDD + Beat Delivery on Buyer App',
    'Next-Day Delivery option is visible to buyers only until 2 PM and is hidden after that. Beat-day delivery is shown as the alternative. The expected delivery date is derived from weekday mapping, distributor-enabled area logic and seller working hours.',
    'Sets correct customer expectations for delivery, avoids over-promising, and makes the buyer app behave like a real ordering platform instead of a wishlist.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Delivery',
    'NDD + Beat Delivery on Seller Store',
    'Adds the Delivery Day field at customer level (configurable from Customer List and Customer Details). Delivery day auto-tags from polygon mapping, serviceability config and beat-wise allocation. Applies to new and existing customers.',
    'Aligns seller-side data with the buyer-side promise, so every order placed has a consistent delivery story end-to-end.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Delivery',
    'NDD Delivery Fee (per kg, fixed by category)',
    'NDD delivery fee is fixed at ₹x / kg, sourced from the logistics rate card. For now it is a Qwipo USP (does not flow through the ONDC protocol) — the rate card is saved centrally and sent to the Buyer App separately.',
    'Monetises NDD as a premium service and gives Qwipo a differentiated, immediate-delivery offering vs marketplaces.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Orders',
    'Orders Table — Delivery-Aware Columns',
    'Orders table shows: Order, Company, Retailer, Mobile, Value, Order Date, Expected Delivery Date, Beat Name, Beat Delivery Day, Delivery Type, Status, Actions.',
    'Sellers can plan dispatch and route loading directly from the orders page without exporting or cross-referencing other screens.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Orders',
    'Delivery Classification — Urgent vs Regular',
    'Every order is tagged either Urgent (red badge) or Regular (blue badge) so it is visible at a glance.',
    'Drives prioritisation in the warehouse and on the route — urgent orders never get lost inside a long order list.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Orders',
    'Confirmed Orders Sub-Tabs (All / Tomorrow / Beyond Tomorrow)',
    'On the Confirmed tab, three sub-tabs with live counts: All, Tomorrow Deliveries, Beyond Tomorrow Deliveries. Orders auto-group by Expected Delivery Date relative to today.',
    'Sellers see exactly what needs to ship tomorrow vs what can wait — replaces ad-hoc filtering.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Orders',
    'Bulk Reschedule Expected Delivery Date with WhatsApp Alert',
    'Seller selects confirmed orders on the Confirmed tab → Update Delivery Date → picks a new Expected Delivery Date (past dates blocked) → saves. Success toast confirms the reschedule and a WhatsApp message is sent to every affected customer.',
    'Lets sellers handle real-world disruptions (vehicle, stock, weather) at scale without manual follow-up, and protects retailer trust by proactively communicating delays.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Orders',
    'Order List & Detail — Expected Delivery Date Column and Filter',
    'Order list page adds Expected Delivery Date as a column and a filter. Order detail page shows full expected-delivery information and the delivery schedule.',
    'Improves operational tracking and lets sellers slice orders by delivery date for daily planning.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Seller Store', 'Logistics',
    'Logistics Flow & Event Rework for New Delivery Model',
    'Rework logistics workflow based on the updated delivery-day logic, expected delivery timelines and order scheduling. Includes state-wise event redefinition and data alignment across Logistics Seller App, Logistics Buyer App and Logistics Operations.',
    'Without this, the new delivery model exists only in screens but does not flow through fulfilment — preventing real-world rollout.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Home Screen',
    'Distributor-First Buyer App Home Screen',
    'Revamped home screen with a distributor-first structure. Flow: Seller Type → Distributor → Company → Category / Brand → Product List.',
    'Mirrors how retailers actually shop in B2B (by who they buy from, not by individual SKU), reducing time-to-cart and increasing repeat ordering.',
    'Phase 1', 'Vikas', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Home Screen',
    'BMS-Driven Banners on Home',
    'Dynamic banners and promotions configured from BMS render on home based on distributor type, company, category and brand mapping.',
    'Lets the marketing team push targeted creative without app releases and personalises the home screen per buyer.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Distributors',
    'Distributors List Page',
    'Buyer-facing list of available distributors with MOV and NDD-fees visible up front; header carries breadcrumbs + MOV + NDD fees.',
    'Buyers can compare distributors before committing — improves the marketplace feel and supports multi-distributor cart growth.',
    'Phase 1', 'Vikas', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Distributor / Seller',
    'Distributor / Seller Detail Page',
    'Dedicated distributor/seller page showing delivery options, MOV, and the list of available companies.',
    'Establishes the distributor as a first-class entity in the buyer experience — supports trust and discovery.',
    'Phase 1', 'Vikas', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Catalog Navigation',
    'Company Category & Brand Pages',
    'Dedicated pages for company categories and brands with structured navigation. Header shows breadcrumbs + MOV + NDD fees consistently.',
    'Makes deep catalog discovery natural and keeps purchasing context (which distributor, what MOV) visible at all times.',
    'Phase 1', 'Vikas', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Product List',
    'Distributor Product Listing Page',
    'Distributor-scoped product listing page with breadcrumbs, MOV and NDD-fees in the header.',
    'Buyers stay anchored to a distributor while browsing, which improves basket size and avoids cross-distributor cart confusion.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Cart',
    'Cart Summary UI Revamp',
    'Redesigned cart summary: cleaner product grouping, distributor/company visibility, NDD or Beat-day selection at seller level, and easier checkout.',
    'Reduces cart drop-off and makes the delivery promise explicit before order placement.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Order Summary',
    'Order Summary UI Revamp (Radio-Based Delivery Selection)',
    'Order summary uses radio-button selection for delivery actions and surfaces order details cleanly.',
    'Buyers make a clear, intentional delivery choice instead of guessing — fewer wrong-day disputes.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Search',
    'Unified Product Search across Home, Distributors, Category, Brand, PLP',
    'Single product-search experience that works on Home, Distributor List, Category, Brand and Product Listing pages.',
    'Buyers can search from wherever they are — critical for fast reorder behaviour in B2B.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — Buyer App', 'Customer Discovery',
    'Retailer Discovery via Vendor Network (P2P Search)',
    'When a buyer searches, retailer/customer information is shared with all vendors on the network so each vendor can respond with their availability, price and schemes for that retailer.',
    'Unlocks personalised pricing and scheme visibility at scale — the foundational capability for ONDC B2B selling.',
    'Phase 1', 'Shubham', 'Discussion', 'P0'],

  // ====================================================================
  // PHASE 1 — BMS Admin (Promotions Foundation)
  // ====================================================================
  ['Product — BMS Admin', 'BMS Promotion',
    'BMS — Distributor Type Selection (First Step)',
    'Distributor Type selection is the first step in BMS creation. The user must select "Qwipo 2.0 Seller" or "Marketplace Distributor" before anything else.',
    'Forces a clear targeting decision up front, preventing mis-targeted promotions and wasted spend.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — BMS Admin', 'BMS Promotion',
    'BMS — Promotion Type Visibility by Distributor Type',
    'Promotion options change dynamically based on distributor type. Qwipo 2.0 Sellers see Banner and KPI options; Marketplace Distributors see Banner only.',
    'Keeps non-applicable options out of the way and reduces accidental misuse of KPI promotions.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — BMS Admin', 'BMS Promotion',
    'BMS — Distributor Category Mapping from NSC Master',
    'When a distributor type is selected, the corresponding distributor category list is shown from the NSC Master Category List.',
    'Removes manual data entry and keeps promotion targeting aligned with the master category structure.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Product — BMS Admin', 'BMS Promotion',
    'BMS — Banner & KPI Promotion Management',
    'Admin can create banners and promotions linked to distributor type and categories. KPI promotions are reserved for Qwipo 2.0 Sellers.',
    'Gives the marketing team a self-serve tool to run targeted, distributor-aware campaigns.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['Marketing', 'Promotions',
    'In-App Promotions Creation with Clone',
    'Marketing creates in-app promotions with distributor-specific targeting and can clone an existing promotion.',
    'Reduces dependency on WhatsApp campaigns and improves targeting; cloning speeds up recurring weekly/seasonal pushes.',
    'Phase 1', '', 'Discussion', 'P0'],

  // ====================================================================
  // PHASE 1 — ONDC / Logistics readiness
  // ====================================================================
  ['ONDC / Logistics', 'Logistics Pricing',
    'Category-Wise Logistics Rate Card (per kg)',
    'Logistics rate card structured by category and priced per kg, configured centrally and consumed by the Buyer App for delivery fees.',
    'Makes delivery economics transparent and lets us monetise heavy/light categories differently — a margin lever.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['ONDC / Logistics', 'DP App',
    'DP App — Cash Collection (Discount, Cash, Credit Entry)',
    'Delivery Person app supports entering discount, cash collected and credit amount at the doorstep.',
    'Captures the real outcome of every delivery (collected vs credit), which is the foundation for accurate settlement and limit management.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['ONDC / Logistics', 'DP App',
    'DP App — UPI QR Visibility',
    'Delivery Person can show a UPI QR at the doorstep for digital collection.',
    'Reduces cash handling, accelerates collection-to-bank, and improves auditability.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['ONDC / Logistics', 'DP App',
    'DP App — Credit Order Identification',
    'DP app clearly distinguishes credit-based orders from cash/UPI orders.',
    'Prevents collection mistakes at the doorstep (no asking cash on a credit order) and keeps DP behaviour aligned with retailer agreements.',
    'Phase 1', '', 'Discussion', 'P1'],

  ['ONDC / Logistics', 'LBNP',
    'Collection Reconciliation (Cash, UPI, Credit)',
    'End-of-day reconciliation across Cash, UPI and Credit collection channels in LBNP. Based on bandwidth this can move to Phase 2.',
    'Operations finance gets one source of truth for collections — no more side spreadsheets, fewer settlement disputes.',
    'Phase 1', '', 'Discussion', 'P0'],

  ['ONDC / Logistics', 'ONDC Compliance',
    'ONDC RETeB2B Exhibit Readiness',
    'Make the ONDC exhibit run protocol-compliant end-to-end: relay real (non-mocked) data, submit required network observability logs, classify previous-run errors jointly with Bizom, and stabilise the test distributor flow.',
    'Without this we cannot demo a credible ONDC exhibit. Required for ONDC programme participation and external visibility.',
    'Phase 1', 'Qwipo + Bizom', 'In Progress', 'P0'],

  ['ONDC / Logistics', 'ONDC Compliance',
    'ONDC Catalog Compliance (Bizom)',
    'Align the catalog response with the RETeB2B specification: provider type, provider credentials, provider descriptor, brand details inside item tags, and schemes inside the catalog response. Move serviceability from radius-based to pincode/polygon-based.',
    'A catalog that does not meet ONDC spec cannot transact on the network. This unblocks the entire buyer experience on ONDC.',
    'Phase 1', 'Bizom', 'Pending', 'P0'],

  ['ONDC / Logistics', 'ONDC Compliance',
    'ONDC P2P + Schemes + Credit Limit on Network',
    'Enable the personalised B2B flow through ONDC: pass retailer info (P2P), exchange retailer credit limit, and surface personalised schemes through SELECT/INIT/CONFIRM. End-to-end flow must be validated on the network.',
    'Personalised pricing, schemes and credit are the core of B2B distribution. Without these we are not a real B2B platform on ONDC — only a catalog viewer.',
    'Phase 1', 'Bizom', 'Pending', 'P0'],

  ['ONDC / Logistics', 'Checkout',
    'Checkout — Proceed with Available Items on Stock Issue',
    'When stock issues are detected at checkout, show a validation screen and let the buyer proceed with available items instead of failing the whole cart.',
    'Recovers cart value that would otherwise be abandoned and matches buyer expectations from consumer e-commerce.',
    'Phase 1', 'Qwipo', 'In Progress', 'P0'],

  ['ONDC / Logistics', 'Checkout',
    'Auto Re-Initiate Order Flow on Session Expiry',
    'If the order initiation step expires, the system automatically restarts the cart-to-confirm flow instead of dropping the buyer.',
    'Removes a major checkout drop-off and protects conversion on slow networks.',
    'Phase 1', 'Qwipo', 'In Progress', 'P1'],

  // ====================================================================
  // PHASE 2 — ONDC ops
  // ====================================================================
  ['ONDC / Logistics', 'Orders Page',
    'Multi-Order Selection with KPI Map View',
    'Select multiple orders on the ONDC orders page and see aggregated value and counts as KPIs on a map view.',
    'Gives ops a regional/route view of order load and value — supports better DP allocation and capacity planning.',
    'Phase 2', '', 'Discussion', 'P1'],

  // ====================================================================
  // POST PHASE 1 — Schemes Engine
  // ====================================================================
  ['Product — Offers', 'Schemes',
    'Schemes Engine (Quantity / Slab / Discount)',
    'Full schemes engine covering quantity-based, slab-based and discount-based offers.',
    'Required by Colgate and critical for promotional selling. Without it we cannot run real B2B trade promotions.',
    'Post Phase 1', '', 'Pending', 'P1'],

  ['Product — Offers', 'Schemes',
    'Slab-Based Schemes',
    'Configure multiple slabs with min/max quantity and applicable discount values.',
    'Supports quantity-led trade structures that drive larger baskets.',
    'Post Phase 1', '', 'Pending', 'P1'],

  ['Product — Offers', 'Schemes',
    'Combo / Bundle Offers (Buy X Get Y)',
    'Bundled product offers including Buy X Get Y and combo discounts.',
    'Expands the type of campaigns marketing can run, including launch and clearance pushes.',
    'Post Phase 1', '', 'Pending', 'P2'],

  ['Product — Offers', 'Schemes',
    'Free Product Schemes',
    'Add a free SKU or product as part of a promotional offer.',
    'Supports brand-trade incentive schemes (sample, trial, primary push) without manual workarounds.',
    'Post Phase 1', '', 'Pending', 'P2'],

  ['Product — Offers', 'Schemes',
    'Invoice-Level Offers',
    'Apply discounts or schemes at the overall invoice / cart level (not just per SKU).',
    'Enables advanced offer structures — common in distributor pricing books.',
    'Post Phase 1', '', 'Pending', 'P2'],

  ['Product — Offers', 'SKU Page',
    'SKU Offer Visibility on Product Page',
    'Show offer applicability and scheme calculations on the SKU detail page.',
    'Buyers understand exactly what they pay and why, increasing conversion and trust.',
    'Post Phase 1', '', 'Coming Soon', 'P1'],

  // ====================================================================
  // BACKLOG — Catalog & Operations
  // ====================================================================
  ['Product — Catalog', 'Products',
    'Standardised Product & Variant Structure (UPC / Inner Pack / Group)',
    'Define a standardised product hierarchy and variant structure using UPC, inner pack and group naming conventions.',
    'Ensures consistent catalog, accurate SKU mapping and scalable product management as the catalog grows across distributors.',
    'Backlog', '', 'Discussion', 'P1'],

  ['Product — Catalog', 'Storefront',
    'Category & Brand Image Support',
    'Upload and display category-level and brand-level images on the storefront.',
    'Improves storefront branding and product discovery — a baseline expectation buyers carry over from consumer apps.',
    'Backlog', '', 'Pending', 'P2'],

  ['Product — Catalog', 'Products',
    'SKU Bulk Import (Excel / CSV)',
    'Bulk SKU upload through Excel or CSV.',
    'Cuts catalog onboarding effort from days to minutes — essential when bringing on a new distributor.',
    'Backlog', '', 'Coming Soon', 'P1'],

  ['Product — Catalog', 'Products',
    'SKU Export',
    'Export the full SKU catalog (with attributes) to Excel / CSV.',
    'Lets sellers audit and reconcile their catalog offline.',
    'Backlog', '', 'Pending', 'P2'],

  ['Product — Seller Store', 'Orders',
    'Order Modification / Partial Cancellation',
    'Allow partial cancellation or modification of an order before fulfilment completes.',
    'Reduces ops escalations and improves customer flexibility — currently every change is a manual workaround.',
    'Backlog', '', 'Pending', 'P1'],

  ['Product — Seller Store', 'Orders',
    'MOV Separation — Sales Beat vs Non-Sales Beat',
    'Minimum Order Value is configurable separately for Sales-Beat and Non-Sales-Beat customers.',
    'Lets us run different commercial policies for high-touch beat customers vs occasional walk-in retailers.',
    'Backlog', '', 'Pending', 'P1'],

  ['Product — Seller Store', 'Invoicing',
    'Move Away from JIT-Issued Invoices for Current Wholesalers',
    'Today the invoice for current wholesalers is generated by Qwipo because of the JIT model. We need to move away from this so the distributor issues their own invoice.',
    'Cleans up the commercial relationship, reduces our compliance exposure, and aligns the platform with how distributors actually want to sell.',
    'Phase 2', '', 'Pending', 'P1'],

  ['ONDC / Logistics', 'Delivery Scheduling',
    'Customer-Chosen Delivery Day / Scheduled Delivery',
    'Allow customers to choose a delivery day and scheduled delivery preference through ONDC — covering delivery day assignment, scheduled delivery support and slot allocation as a single capability.',
    'Supports planned deliveries beyond NDD and improves buyer experience for predictable, recurring orders.',
    'Backlog', '', 'Pending', 'P2'],

  // ====================================================================
  // BACKLOG — Marketing & Analytics
  // ====================================================================
  ['Marketing', 'Promotions',
    'Distributor-Specific Campaigns',
    'Run campaigns scoped to specific distributors or retailer groups.',
    'Improves personalisation and conversion — moves us away from generic, all-network blasts.',
    'Backlog', '', 'Pending', 'P2'],

  ['Marketing', 'Automation',
    'Campaign Cloning',
    'One-click duplication of an existing campaign.',
    'Reduces operational effort for recurring weekly/monthly pushes.',
    'Backlog', '', 'Pending', 'P2'],

  ['Marketing', 'Notifications',
    'Distributor-Targeted Notifications',
    'Send notifications based on distributor mapping and scheme targeting instead of broadcast.',
    'Eliminates noisy generic alerts and improves engagement / open rates.',
    'Backlog', '', 'Pending', 'P2'],

  ['Marketing', 'Notifications',
    'Deep Link UTM Tracking',
    'Add UTM parameters to deep links so we can attribute installs, opens and orders to specific WhatsApp / campaign sends.',
    'Without this, marketing is flying blind on what works. UTMs unlock data-driven spend decisions.',
    'Backlog', '', 'Pending', 'P2'],

  ['Marketing', 'Reporting',
    'Scheme Performance Export',
    'Download SKU and scheme performance data in a single report.',
    'Supports weekly trade reviews and management reporting without manual stitching.',
    'Backlog', '', 'Pending', 'P2'],

  ['Marketing', 'Reporting',
    'Campaign Performance Export',
    'Export campaign performance and engagement reports.',
    'Lets marketing analyse and share results offline — table-stakes for any agency or partner conversation.',
    'Backlog', '', 'Pending', 'P2'],

  ['Analytics', 'Marketing',
    'Retailer Acquisition Source Analytics',
    'Track where each retailer came from (WhatsApp, in-app campaign, organic, referral, etc.).',
    'Identifies the most cost-effective acquisition channels — directly informs marketing spend.',
    'Backlog', '', 'Pending', 'P2'],

  ['Analytics', 'Marketing',
    'Campaign Effectiveness Analytics',
    'Correlate campaign timelines with sales and order spikes.',
    'Measures campaign ROI and effectiveness instead of going on gut feel.',
    'Backlog', '', 'Pending', 'P2'],

  ['Analytics', 'Marketing',
    'Promotion Performance Dashboard',
    'Dashboard for promotion reach, clicks, conversions and sales impact.',
    'Centralised campaign monitoring so leadership and marketing share the same view.',
    'Future', '', 'Future', 'P3'],

  ['Analytics', 'Seller',
    'Seller Dashboard (Sales / Revenue / Orders)',
    'Seller-facing analytics dashboard covering sales, revenue and order trends.',
    'Gives sellers operational visibility — increases stickiness and supports renewal conversations.',
    'Backlog', '', 'Coming Soon', 'P1'],

  ['Analytics', 'Admin',
    'Admin Dashboard (Platform Monitoring)',
    'Admin monitoring dashboard for platform-wide and seller operations.',
    'Centralised operational management — the single screen leadership opens daily.',
    'Backlog', '', 'Coming Soon', 'P1'],

  // ====================================================================
  // BACKLOG — Notifications & Settings
  // ====================================================================
  ['Product — Notifications', 'Customer Comms',
    'Automated Customer Notification for Delayed Delivery',
    'Notify customers automatically when deliveries are delayed or rescheduled.',
    'Reduces inbound support volume and protects retailer trust during disruptions.',
    'Backlog', '', 'Pending', 'P1'],

  ['Product — Notifications', 'In-App',
    'Notification Bell + Notification Center',
    'Notification bell icon with alert indicator and a Notification Center panel that lists all alerts and updates.',
    'Gives users a single place to catch up on what changed — reduces "did I miss something?" anxiety.',
    'Backlog', '', 'Deferred', 'P3'],

  ['Product — Settings', 'Store',
    'Store Settings — Working Hours',
    'Configure store operational timings and order acceptance windows.',
    'Ensures we do not accept orders the seller cannot fulfil — directly improves delivery reliability.',
    'Backlog', '', 'Coming Soon', 'P1'],

  ['Product — Settings', 'Platform',
    'Consolidated Settings Page',
    'Centralised settings page for business and operational configurations.',
    'Cleans up scattered configuration screens; reduces onboarding time for new admin users.',
    'Backlog', '', 'Pending', 'P2'],

  // ====================================================================
  // BACKLOG — Security / RBAC
  // ====================================================================
  ['Security / RBAC', 'Access Control',
    'Sub-Roles & Permission-Based Access Control',
    'Role-based permissions with restricted access. Parent capability for the role-specific items below.',
    'Improves security, supports separation of duties, and is a compliance ask from enterprise customers.',
    'Backlog', '', 'Pending', 'P1'],

  ['Security / RBAC', 'Access Control',
    'Read-Only Viewer Role',
    'A user role that can only view data, with no edit permissions.',
    'Enables controlled access for stakeholders (auditors, partners, leadership) without operational risk.',
    'Backlog', '', 'Pending', 'P2'],

  ['Security / RBAC', 'Access Control',
    'Finance-Only Role',
    'Restrict a user to finance and settlement modules only.',
    'Prevents finance staff from accidentally changing operational data.',
    'Backlog', '', 'Pending', 'P2'],

  ['Security / RBAC', 'Access Control',
    'Operations Role',
    'Operations role scoped to order and fulfilment management.',
    'Operations staff get exactly what they need and nothing more — fewer mistakes, tighter audit trail.',
    'Backlog', '', 'Pending', 'P2'],

  // ====================================================================
  // BACKLOG — Integrations
  // ====================================================================
  ['Integrations', 'ONDC',
    'ONDC Integration (Catalog / Orders / Offers)',
    'Core ONDC integration covering catalog, orders and offers.',
    'Enables ONDC ecosystem participation and unlocks the buyer-side network.',
    'Phase 1', '', 'In Scope', 'P0'],

  ['Integrations', 'Bizom',
    'Bizom Connector (DMS Sync)',
    'Sync products, orders and inventory with Bizom DMS.',
    'Reduces manual reconciliation between Qwipo and the distributor DMS — table-stakes for Bizom-using distributors.',
    'Backlog', '', 'Pending', 'P1'],

  ['Integrations', 'Tally',
    'Tally Connector',
    'Accounting and invoice synchronisation with Tally.',
    'Simplifies finance operations for SMB distributors — most run Tally as their book of record.',
    'Backlog', '', 'Pending', 'P2'],

  ['Integrations', 'SAP (Colgate)',
    'SAP Integration for Colgate',
    'SAP synchronisation for inventory, pricing, orders and schemes.',
    'Critical dependency for onboarding Colgate — without it, the Colgate deal cannot move.',
    'Backlog', '', 'Pending', 'P1'],

  ['Integrations', 'Generic ERP',
    'Generic ERP Connectors',
    'Generic ERP integration support for enterprise customers.',
    'Enables future enterprise scale beyond Tally/SAP-specific deals.',
    'Future', '', 'Pending', 'P3'],

  // ====================================================================
  // BACKLOG — Business / Seller Type expansion
  // ====================================================================
  ['Business', 'Seller Type',
    'Wholesaler Seller Type',
    'Add wholesaler-specific onboarding and B2B workflows as a distinct seller type.',
    'Opens up the wholesale market segment — meaningfully larger TAM than the current distributor base.',
    'Phase 2', '', 'Deferred', 'P1'],

];

// ---------- Build workbook ----------
async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Omkar Charankar';
  wb.created = new Date();

  const ws = wb.addWorksheet('Backlog', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  ws.columns = [
    { key: 'no',     width: 6  },
    { key: 'dept',   width: 22 },
    { key: 'module', width: 22 },
    { key: 'feat',   width: 50 },
    { key: 'desc',   width: 70 },
    { key: 'impact', width: 60 },
    { key: 'phase',  width: 13 },
    { key: 'pri',    width: 9  },
    { key: 'owner',  width: 14 },
    { key: 'status', width: 13 },
  ];

  // Row 1: title
  ws.mergeCells('A1:J1');
  const title = ws.getCell('A1');
  title.value = 'eB2B / Digidukaan — Product Backlog (Business View)';
  title.font  = { name: FONT_NAME, size: 16, bold: true, color: { argb: TITLE_FONT } };
  title.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Row 2: subtitle
  ws.mergeCells('A2:J2');
  const sub = ws.getCell('A2');
  const today = new Date().toISOString().slice(0, 10);
  sub.value = `Owner: Product Team   |   Last updated: ${today}   |   Phase 1 cut-off: 28-May   |   Phase 2: Post 1st phase`;
  sub.font  = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF1F3864' } };
  sub.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTITLE_FILL } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // Row 3: spacer
  ws.getRow(3).height = 6;

  // Row 4: header
  const headers = [
    '#', 'Department', 'Module', 'Feature / Backlog Item',
    'Description', 'What it Solves / Business Impact',
    'Release Phase', 'Priority', 'Owner', 'Current Status',
  ];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font  = { name: FONT_NAME, size: 11, bold: true, color: { argb: HEADER_FONT } };
    c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    thinBorder(c);
  });
  headerRow.height = 30;

  // Data rows
  items.forEach((row, idx) => {
    const [dept, module, feat, desc, impact, phase, owner, status, priority] = row;
    const r = ws.addRow([idx + 1, dept, module, feat, desc, impact, phase, priority, owner, status]);

    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1F1F1F' } };
      cell.alignment = { vertical: 'top', wrapText: true };
      thinBorder(cell);
    });

    // # — bold, centered
    const noCell = r.getCell(1);
    noCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1F3864' } };
    noCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Department — color tag
    const dCell = r.getCell(2);
    if (deptFill[dept]) {
      dCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: deptFill[dept] } };
    }
    dCell.font = { name: FONT_NAME, size: 10, bold: true };
    dCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Module
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Feature — bold
    r.getCell(4).font = { name: FONT_NAME, size: 10, bold: true };

    // Phase chip
    const phCell = r.getCell(7);
    if (phaseFill[phase]) {
      phCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: phaseFill[phase] } };
    }
    phCell.font = { name: FONT_NAME, size: 10, bold: true };
    phCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Priority chip
    const prCell = r.getCell(8);
    if (priorityFill[priority]) {
      prCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: priorityFill[priority] } };
    }
    prCell.font = { name: FONT_NAME, size: 10, bold: true };
    prCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Owner
    r.getCell(9).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Status chip
    const stCell = r.getCell(10);
    if (statusFill[status]) {
      stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill[status] } };
    }
    stCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  // AutoFilter
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to:   { row: 4 + items.length, column: 10 },
  };

  await wb.xlsx.writeFile(OUT_FILE);
  console.log('Wrote:', OUT_FILE);
  console.log('Total items:', items.length);

  const byPhase = {};
  const byDept = {};
  for (const it of items) {
    byPhase[it[5]] = (byPhase[it[5]] || 0) + 1;
    byDept[it[0]] = (byDept[it[0]] || 0) + 1;
  }
  console.log('By phase:', byPhase);
  console.log('By dept:', byDept);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
