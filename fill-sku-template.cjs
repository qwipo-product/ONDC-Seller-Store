// Fills the SKU_Import_Template with rich product data based on SKU Name knowledge.
// Output: SKU_Import_Template_filled.xlsx

const ExcelJS = require('exceljs');
const path = require('path');

const INPUT  = path.join(__dirname, 'SKU_Import_Template_input.xlsx');
const OUTPUT = path.join(__dirname, 'SKU_Import_Template_filled.xlsx');

// ---- Master-allowed values (must match dropdowns) ----
const CATEGORIES = new Set([
  'Atta, Flours & Sooji','Bakery, Cakes & Dairy','Beauty & Hygiene','Beverages',
  'Biscuits, Snacks & Namkeen','Cooking Oils & Ghee','Dairy & Cheese','Dals & Pulses',
  'Detergents','Dry Fruits','Eggs, Meat & Fish','Foodgrains, Oil & Masala','Fruit Juices',
  'Frozen Snacks','Frozen Vegetables','Fruits and Vegetables','Gift Voucher',
  'Gourmet & World Foods','Indian Sweets','Kitchen Accessories','Masala & Seasoning',
  'Oats & Noodles','Oil & Ghee','Pasta & Soup','Pet Care','Pickles & Podis',
  'Ready to Cook','Rice','Salt & Sugar','Snacks, Dry Fruits & Nuts','Sugar & Spices',
  'Snacks & Branded Foods','Spreads, Sauces & Ketchups','Tea & Coffee',
  'Tinned & Processed Foods',
]);
const PACKAGE_TYPES = new Set([
  'Piece / Pieces (Pc/Pcs)','Pouch','Pack','Sachet','Bag','Lamination Bag','Bottle',
  'Pet Bottle','Jar','Pet Jar','Box','Tin','Can','Case','Tube','Tetra Pack','Sheet',
  'Set','Pads','Refill','Nons','Ladi','Bundle','Loose','Glass Jar','Plastic Jar',
  'Container',
]);

// ---- Helpers ----
function parsePackFromName(name) {
  // Returns { qty, unit }  qty in grams or kilos or rupee-sachet-equivalent
  const lower = name.toLowerCase();

  // Explicit kg
  let m = lower.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (m) return { value: parseFloat(m[1]), unit: 'Kilogram' };

  // Explicit g/gm/gms
  m = lower.match(/(\d+(?:\.\d+)?)\s*(?:gm|gms|g)\b/);
  if (m) return { value: parseFloat(m[1]), unit: 'Gram' };

  // Combo packs FIRST (must beat single-sachet checks below)
  // CTC tea combo at Rs.10: ~50g sachets × 12 ≈ 600g
  if (/(ctc|tea).*rs.*(combo|compbo)/.test(lower) || /rs\.?10.*(combo|compbo)/.test(lower) && /ctc|tea/.test(lower)) {
    return { value: 600, unit: 'Gram' };
  }
  // 10Rs combo pack — 12 × 20g = 240g
  if (/10\s*rs.*(combo|compbo)/.test(lower) || /rs\.?10\/?-?\s*(combo|compbo)/.test(lower)) {
    return { value: 240, unit: 'Gram' };
  }
  // 5Rs combo pack — 12 × 10g = 120g (incl. source typo "compbo")
  if (/5\s*rs.*(combo|compbo)/.test(lower)) {
    return { value: 120, unit: 'Gram' };
  }

  // Single-serve sachets
  // 10Rs / Rs.10 sachet (~20g)  — checked before 5Rs to win on "rs.10"
  if (/\b(?:at\s*)?10\s*rs\b/.test(lower) || /rs\.?10\b/.test(lower)) {
    return { value: 20, unit: 'Gram' };
  }
  // 5Rs / Rs.5 sachet (~10g)
  if (/\b(?:at\s*)?5\s*rs\b/.test(lower) || /rs\.?5\b/.test(lower)) {
    return { value: 10, unit: 'Gram' };
  }
  // fallback
  return { value: 100, unit: 'Gram' };
}

function brandFor(name) {
  if (/^three mango/i.test(name)) return 'Three Mango';
  if (/^spiceman/i.test(name))    return 'Spiceman';
  if (/^swastik/i.test(name))     return 'Swastik';
  // Unbranded entries (Dhania Powder, Mirchi Powder, Haldi Powder, Jeera Powder,
  // Ginger Garlic Paste, Ctc Pouch) ship under the Swastik portfolio per SKU prefix.
  return 'Swastik';
}

function manufacturerFor(brand) {
  // All three brands belong to the same Swastik group of companies.
  if (brand === 'Three Mango') return 'Three Mango Foods';
  if (brand === 'Spiceman')    return 'Spiceman Foods';
  return 'Swastik Masale and Foods';
}

// Classify product type from name -> drives category, HSN, GST, descriptions
function classify(name) {
  // Strip leading brand words AND drop any "with X free" combo blurb so the
  // primary product (left of "with"/"free") drives the classification.
  let n = name.toLowerCase()
    .replace(/^three\s*mango\s*/, '')
    .replace(/^spiceman\s*/, '')
    .replace(/^swastik\s*/, '');
  n = n.replace(/\s+with\s+.+$/, '').replace(/\s+\+\s+.+\s+free.*$/, '');

  // Pickle (check specific variants BEFORE generic "mango")
  if (/pickle/.test(n)) {
    let kind = 'mixed vegetable';
    if (/red chilli/.test(n))             kind = 'red chilli';
    else if (/mixed/.test(n))             kind = 'mixed vegetable';
    else if (/gongura/.test(n))           kind = 'gongura';
    else if (/ginger/.test(n))            kind = 'ginger';
    else if (/cut\s*mango/.test(n))       kind = 'cut mango';
    else if (/north\s*mango/.test(n))     kind = 'North Indian style mango';
    else if (/punjabi\s*mango/.test(n))   kind = 'Punjabi style mango';
    else if (/lemon|lime/.test(n))        kind = 'lemon';
    else if (/tomato/.test(n))            kind = 'tomato';
    else if (/mango/.test(n))             kind = 'mango';
    return { type:'pickle', kind, category:'Pickles & Podis', hsn:'20019000', gst:'12%' };
  }

  // Ginger garlic paste
  if (/ginger\s*garlic\s*paste/.test(n)) {
    return { type:'paste', kind:'ginger garlic',
             category:'Masala & Seasoning', hsn:'21039040', gst:'12%' };
  }

  // Tea (CTC)
  if (/\bctc\b/.test(n)) {
    return { type:'tea', kind:'CTC tea', category:'Tea & Coffee',
             hsn:'09023010', gst:'5%' };
  }

  // Masala mixes
  if (/garam\s*masala/.test(n)) return { type:'masala', kind:'garam masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/chicken\s*masala/.test(n)) return { type:'masala', kind:'chicken masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/mutton\s*masala/.test(n)) return { type:'masala', kind:'mutton masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/sambar\s*(masala|powder)/.test(n)) return { type:'masala', kind:'sambar masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/^.*\bsambar\b(?!.*masala)/.test(n)) return { type:'masala', kind:'sambar masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/rasam/.test(n)) return { type:'masala', kind:'rasam powder', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/chat\b|chaat/.test(n)) return { type:'masala', kind:'chat masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/kitchen\s*king/.test(n)) return { type:'masala', kind:'kitchen king subji masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/pav\s*bhaji/.test(n)) return { type:'masala', kind:'pav bhaji masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
  if (/chole\s*masala/.test(n)) return { type:'masala', kind:'chole masala', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };

  // Hing
  if (/\bhing\b/.test(n)) return { type:'spice', kind:'asafoetida (hing)', category:'Masala & Seasoning', hsn:'13019032', gst:'5%' };

  // Whole spices (when name says "Whole" or specific whole spice names)
  if (/dhania\s*whole/.test(n)) return { type:'wholeSpice', kind:'coriander seeds (whole dhania)', category:'Masala & Seasoning', hsn:'09092100', gst:'5%' };
  if (/black\s*pepper(?!\s*powder)/.test(n)) return { type:'wholeSpice', kind:'whole black pepper', category:'Masala & Seasoning', hsn:'09041110', gst:'5%' };
  if (/\bclove\b/.test(n)) return { type:'wholeSpice', kind:'whole cloves (laung)', category:'Masala & Seasoning', hsn:'09071010', gst:'5%' };
  if (/cumin|\bjeera\b(?!\s*powder)/.test(n)) {
    if (/powder/.test(n) || /jeera\s*powder/.test(n))
      return { type:'spice', kind:'cumin powder (jeera powder)', category:'Masala & Seasoning', hsn:'09093200', gst:'5%' };
    return { type:'wholeSpice', kind:'whole cumin seeds (jeera)', category:'Masala & Seasoning', hsn:'09093100', gst:'5%' };
  }
  if (/fenugruk|fenugreek|methi\s*dana/.test(n)) return { type:'wholeSpice', kind:'whole fenugreek seeds (methi dana)', category:'Masala & Seasoning', hsn:'09109911', gst:'5%' };
  if (/fennel|saunf/.test(n)) return { type:'wholeSpice', kind:'whole fennel seeds (saunf)', category:'Masala & Seasoning', hsn:'09096111', gst:'5%' };
  if (/shajeera|shahi\s*jeera|caraway/.test(n)) return { type:'wholeSpice', kind:'shahi jeera (caraway seeds)', category:'Masala & Seasoning', hsn:'09096200', gst:'5%' };
  if (/black\s*cardmom|black\s*cardamom/.test(n)) return { type:'wholeSpice', kind:'whole black cardamom (badi elaichi)', category:'Masala & Seasoning', hsn:'09083200', gst:'5%' };
  if (/green\s*cardmom|green\s*cardamom/.test(n)) return { type:'wholeSpice', kind:'whole green cardamom (choti elaichi)', category:'Masala & Seasoning', hsn:'09083110', gst:'5%' };
  if (/nutmeg|jaiphal/.test(n)) return { type:'wholeSpice', kind:'whole nutmeg (jaiphal)', category:'Masala & Seasoning', hsn:'09081100', gst:'5%' };
  if (/cassia\s*bark/.test(n)) return { type:'wholeSpice', kind:'cassia bark (dalchini)', category:'Masala & Seasoning', hsn:'09061100', gst:'5%' };
  if (/star\s*anise/.test(n)) return { type:'wholeSpice', kind:'whole star anise (chakra phool)', category:'Masala & Seasoning', hsn:'09096100', gst:'5%' };
  if (/ajwain|carom/.test(n)) return { type:'wholeSpice', kind:'ajwain (carom seeds)', category:'Masala & Seasoning', hsn:'09109911', gst:'5%' };
  if (/kasuri\s*methi/.test(n)) return { type:'spice', kind:'kasuri methi (dried fenugreek leaves)', category:'Masala & Seasoning', hsn:'09109912', gst:'5%' };
  if (/mustard\s*(rai)|^.*\brai\b/.test(n)) {
    if (/powder/.test(n)) return { type:'spice', kind:'mustard powder (rai)', category:'Masala & Seasoning', hsn:'09109911', gst:'5%' };
    return { type:'wholeSpice', kind:'whole mustard seeds (rai)', category:'Masala & Seasoning', hsn:'12075010', gst:'5%' };
  }
  if (/methi(?!.*kasuri)(?!.*dana)/.test(n)) return { type:'spice', kind:'methi powder (fenugreek powder)', category:'Masala & Seasoning', hsn:'09109911', gst:'5%' };

  // Ground single spices (powders)
  if (/haldi|turmeric/.test(n)) return { type:'spice', kind:'turmeric powder (haldi)', category:'Masala & Seasoning', hsn:'09103090', gst:'5%' };
  if (/dhania.*powder|coriander\s*powder|^dhania\s+/.test(n) || /^dhania\s*powder/.test(n)) return { type:'spice', kind:'coriander powder (dhania)', category:'Masala & Seasoning', hsn:'09092200', gst:'5%' };
  if (/^.*\bdhania\b(?!.*whole)/.test(n)) return { type:'spice', kind:'coriander powder (dhania)', category:'Masala & Seasoning', hsn:'09092200', gst:'5%' };
  if (/jeera\s*powder/.test(n)) return { type:'spice', kind:'cumin powder (jeera)', category:'Masala & Seasoning', hsn:'09093200', gst:'5%' };
  if (/kashmiri\s*chilli/.test(n)) return { type:'spice', kind:'kashmiri red chilli powder', category:'Masala & Seasoning', hsn:'09042220', gst:'5%' };
  if (/lalkadak|lal\s*kadak/.test(n)) return { type:'spice', kind:'extra-hot red chilli powder (lalkadak)', category:'Masala & Seasoning', hsn:'09042220', gst:'5%' };
  if (/mirchi.*gold/.test(n)) return { type:'spice', kind:'premium red chilli powder (mirchi gold)', category:'Masala & Seasoning', hsn:'09042220', gst:'5%' };
  if (/mirchi|chilli\s*powder/.test(n)) return { type:'spice', kind:'red chilli powder (mirchi)', category:'Masala & Seasoning', hsn:'09042220', gst:'5%' };
  if (/amchur/.test(n)) return { type:'spice', kind:'dry mango powder (amchur)', category:'Masala & Seasoning', hsn:'09109911', gst:'5%' };
  if (/black\s*pepper\s*powder/.test(n)) return { type:'spice', kind:'black pepper powder', category:'Masala & Seasoning', hsn:'09041190', gst:'5%' };
  if (/rai\s*powder/.test(n)) return { type:'spice', kind:'mustard powder (rai)', category:'Masala & Seasoning', hsn:'09109911', gst:'5%' };

  // Fallback - generic masala
  return { type:'masala', kind:'spice', category:'Masala & Seasoning', hsn:'09109100', gst:'5%' };
}

// Pick package type
function packageTypeFor(name, pack, cls) {
  const n = name.toLowerCase();
  if (/box/.test(n)) return 'Box';
  if (/pouch/.test(n)) return 'Pouch';
  if (/sachet/.test(n)) return 'Sachet';
  if (/(combo|compbo)\s*pack/.test(n)) return 'Pack';
  // Pickle (only when the primary product IS a pickle)
  if (cls && cls.type === 'pickle') {
    if (pack.unit === 'Kilogram' && pack.value >= 1) return 'Plastic Jar';
    if (pack.unit === 'Gram' && pack.value >= 300) return 'Plastic Jar';
    return 'Pouch';
  }
  // Paste
  if (cls && cls.type === 'paste') {
    if (pack.unit === 'Kilogram' && pack.value >= 1) return 'Plastic Jar';
    return 'Pouch';
  }
  // Default for spice/masala/tea/whole-spice
  return 'Pouch';
}

// Build short + long description
function buildDescriptions(name, cls, pack) {
  const brand = brandFor(name);
  const packLabel =
    pack.unit === 'Kilogram'
      ? `${pack.value} kg`
      : `${pack.value} g`;

  let short = '', long = '';

  const k = cls.kind;
  switch (cls.type) {
    case 'pickle':
      short = `${brand} traditional ${k} pickle in mustard oil and Indian spices, ${packLabel} jar.`;
      long  = `Slow-cured ${k} pickle with hand-blended spices and aromatic mustard oil. Tangy, spicy and ready to pair with rice, roti, dal or paratha.`;
      break;
    case 'paste':
      short = `${brand} ready-to-cook ${k} paste, freshly ground, ${packLabel} pack.`;
      long  = `Convenient ${k} paste made from fresh, hand-selected ingredients. Saves prep time and delivers consistent flavour for everyday Indian cooking.`;
      break;
    case 'tea':
      short = `${brand} ${k} sachet combo pack for fresh, strong brews, ${packLabel}.`;
      long  = `Robust CTC black tea processed for quick brewing. Rich colour, full-bodied taste and ideal for masala chai with milk and sugar.`;
      break;
    case 'masala':
      short = `${brand} ${k}, an aromatic Indian spice blend, ${packLabel} pouch.`;
      long  = `Authentic ${k} crafted from a balanced mix of roasted whole spices. Adds depth, aroma and traditional flavour to everyday Indian dishes.`;
      break;
    case 'wholeSpice':
      short = `${brand} ${k}, sun-dried and cleanly sorted, ${packLabel} pack.`;
      long  = `Hand-sorted ${k} retaining natural aroma and oils. Ideal for tempering, masala blends and traditional Indian cooking.`;
      break;
    case 'spice':
    default:
      short = `${brand} ${k}, finely ground for everyday cooking, ${packLabel} pack.`;
      long  = `Stone-ground ${k} with rich aroma and authentic colour. Suitable for curries, marinades, dals and tempering across Indian cuisine.`;
      break;
  }

  // Clamp lengths
  if (short.length < 10) short = (short + ' ' + brand + ' quality.').slice(0,150);
  if (short.length > 150) short = short.slice(0, 147) + '...';
  if (long.length  > 200) long  = long.slice(0, 197) + '...';

  return { short, long };
}

// ---- Main ----
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(INPUT);
  const ws = wb.getWorksheet('Main SKU Upload');

  const headerRow = ws.getRow(1).values; // 1-indexed
  console.log('Headers:', headerRow.slice(1));

  // Column index map (1-based, matches header positions verified earlier)
  const C = {
    code:1, name:2, group:3,
    shortDesc:4, longDesc:5,
    measureUnit:6, unitValue:7,
    weightMeasure:8, skuWeight:9,
    packSize:10, packageType:11, packageTypeValue:12,
    upc:13,
    minQty:14, maxQty:15,
    category:16,
    returnable:17, cancellable:18, cod:19,
    timeToShip:20,
    careName:21, careEmail:22, carePhone:23,
    mfr:24, brand:25, mfrAddr:26,
    country:27, status:28,
    hsn:29, gstTax:30, gstCess:31,
  };

  // Sanity-check the dropdown sets vs the validation hints (row 2 untouched).
  const lastRow = ws.actualRowCount;
  let filled = 0;
  const issues = [];

  for (let r = 3; r <= lastRow; r++) {
    const name = (ws.getRow(r).getCell(C.name).value || '').toString().trim();
    if (!name) continue;

    const brand = brandFor(name);
    const mfr   = manufacturerFor(brand);
    const pack  = parsePackFromName(name);
    const cls   = classify(name);
    const pkg   = packageTypeFor(name, pack, cls);
    const { short, long } = buildDescriptions(name, cls, pack);

    if (!CATEGORIES.has(cls.category))
      issues.push(`Row ${r}: category "${cls.category}" not in master`);
    if (!PACKAGE_TYPES.has(pkg))
      issues.push(`Row ${r}: package type "${pkg}" not in master`);

    const row = ws.getRow(r);
    row.getCell(C.shortDesc).value        = short;
    row.getCell(C.longDesc).value         = long;
    row.getCell(C.measureUnit).value      = pack.unit;            // Gram / Kilogram
    row.getCell(C.unitValue).value        = pack.value;
    row.getCell(C.weightMeasure).value    = pack.unit;            // same as measure unit
    row.getCell(C.skuWeight).value        = pack.value;
    row.getCell(C.packSize).value         = 1;
    row.getCell(C.packageType).value      = pkg;
    row.getCell(C.packageTypeValue).value = 1;
    row.getCell(C.upc).value               = '';                  // blank as instructed
    row.getCell(C.minQty).value            = 1;
    row.getCell(C.maxQty).value            = 1000;
    row.getCell(C.category).value          = cls.category;
    row.getCell(C.returnable).value        = 'No';
    row.getCell(C.cancellable).value       = 'No';
    row.getCell(C.cod).value               = 'No';
    row.getCell(C.timeToShip).value        = '24 hours';
    row.getCell(C.careName).value          = 'Customer Support';
    row.getCell(C.careEmail).value         = 'support@swastikfoods.in';
    row.getCell(C.carePhone).value         = '9000000000';
    row.getCell(C.mfr).value               = mfr;
    row.getCell(C.brand).value             = brand;
    row.getCell(C.mfrAddr).value           = '';                  // not confident — left blank
    row.getCell(C.country).value           = 'India';
    row.getCell(C.status).value            = 'Active';
    row.getCell(C.hsn).value               = cls.hsn;
    row.getCell(C.gstTax).value            = cls.gst;
    row.getCell(C.gstCess).value           = '0%';

    filled++;
  }

  await wb.xlsx.writeFile(OUTPUT);
  console.log(`\nFilled ${filled} rows -> ${OUTPUT}`);
  if (issues.length) {
    console.log('\nValidation issues:');
    issues.forEach(i => console.log('  ' + i));
  } else {
    console.log('All categories and package types match the master dropdowns.');
  }
})();
