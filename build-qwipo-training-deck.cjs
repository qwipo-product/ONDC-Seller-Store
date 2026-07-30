// Qwipo Seller Store — Internal Training Deck
// Builds a 21-slide PPTX (1 cover + 20 content slides per spec).

const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333" x 7.5"
pres.author = "Qwipo Product Team";
pres.title = "Qwipo Seller Store — Internal Training Guide";
pres.subject = "Configuration, dependencies, validations and troubleshooting";

const SW = 13.333;
const SH = 7.5;

// ============================== Palette ==============================
const C = {
  navy:     "1E2761",
  navySoft: "2C3A75",
  steel:    "4B6CB7",
  ice:      "DCE6FF",
  bg:       "F5F7FB",
  surface:  "FFFFFF",
  coral:    "F39237",
  amber:    "FFC857",
  green:    "1FA875",
  red:      "E63946",
  text:     "1A1F36",
  muted:    "64748B",
  border:   "E2E8F0",
  cardAlt:  "F0F3FA",
};

const FH = "Calibri";
const FB = "Calibri";

const TOTAL = 20; // content slide count for "n/20" indicator

// ============================== Helpers ==============================
function sh() {
  // fresh shadow object every call (pptxgenjs mutates in place)
  return { type: "outer", blur: 10, offset: 2, angle: 90, color: "0F1B3D", opacity: 0.10 };
}

function pageChrome(slide, num) {
  slide.background = { color: C.bg };
  // bottom navy accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: SH - 0.05, w: SW, h: 0.05,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }
  });
  // footer tagline
  slide.addText("Qwipo Seller Store  ·  Internal Training Guide", {
    x: 0.5, y: SH - 0.40, w: 7, h: 0.25,
    fontSize: 9, fontFace: FB, color: C.muted, margin: 0
  });
  // page indicator
  if (num) {
    slide.addText(`${String(num).padStart(2, "0")} / ${String(TOTAL).padStart(2, "0")}`, {
      x: SW - 1.6, y: SH - 0.40, w: 1.1, h: 0.25,
      fontSize: 9, fontFace: FB, color: C.muted, align: "right", margin: 0
    });
  }
}

function header(slide, eyebrow, title, subtitle) {
  slide.addText(eyebrow, {
    x: 0.5, y: 0.32, w: 10, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.steel, bold: true, charSpacing: 6, margin: 0
  });
  slide.addText(title, {
    x: 0.5, y: 0.60, w: 12.3, h: 0.70,
    fontSize: 28, fontFace: FH, color: C.navy, bold: true, margin: 0
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 1.28, w: 12.3, h: 0.36,
      fontSize: 13, fontFace: FB, color: C.muted, margin: 0
    });
  }
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: opts.fill || C.surface },
    line: { color: opts.border || C.border, width: 0.75 },
    shadow: sh()
  });
  if (opts.accent) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h,
      fill: { color: opts.accent }, line: { color: opts.accent, width: 0 }
    });
  }
}

function numCircle(slide, x, y, d, num, opts = {}) {
  const bg = opts.bg || C.navy;
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: d, h: d,
    fill: { color: bg }, line: { color: bg, width: 0 }
  });
  slide.addText(String(num), {
    x, y, w: d, h: d,
    fontSize: opts.fontSize || Math.round(d * 26),
    fontFace: FH, color: opts.fg || "FFFFFF",
    bold: true, align: "center", valign: "middle", margin: 0
  });
}

function symbolCircle(slide, x, y, d, symbol, color) {
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: d, h: d,
    fill: { color: color }, line: { color: color, width: 0 }
  });
  slide.addText(symbol, {
    x, y, w: d, h: d,
    fontSize: Math.round(d * 36), fontFace: FH, color: "FFFFFF",
    bold: true, align: "center", valign: "middle", margin: 0
  });
}

function downArrow(slide, x, y, color) {
  slide.addShape(pres.shapes.DOWN_ARROW, {
    x, y, w: 0.20, h: 0.18,
    fill: { color: color || C.steel }, line: { color: color || C.steel, width: 0 }
  });
}

function rightArrow(slide, x, y, color) {
  slide.addShape(pres.shapes.RIGHT_ARROW, {
    x, y, w: 0.30, h: 0.18,
    fill: { color: color || C.steel }, line: { color: color || C.steel, width: 0 }
  });
}

function chip(slide, x, y, w, h, label, opts = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: h / 2,
    fill: { color: opts.fill || C.ice },
    line: { color: opts.border || (opts.fill || C.ice), width: 0 }
  });
  slide.addText(label, {
    x, y, w, h,
    fontSize: opts.fontSize || 11, fontFace: FH,
    color: opts.color || C.navy, bold: true,
    align: "center", valign: "middle", margin: 0
  });
}

function sectionLabel(slide, x, y, w, text, color) {
  slide.addText(text, {
    x, y, w, h: 0.28,
    fontSize: 10, fontFace: FH, color: color || C.muted,
    bold: true, charSpacing: 5, margin: 0
  });
}

// =========================== SLIDE: COVER ============================
{
  const slide = pres.addSlide();
  slide.background = { color: C.navy };

  // background motif: large faint OVAL bottom-right
  slide.addShape(pres.shapes.OVAL, {
    x: SW - 6, y: SH - 5, w: 9, h: 9,
    fill: { color: C.navySoft, transparency: 35 },
    line: { color: C.navySoft, width: 0 }
  });
  slide.addShape(pres.shapes.OVAL, {
    x: -2.5, y: -2.5, w: 5, h: 5,
    fill: { color: C.steel, transparency: 70 },
    line: { color: C.steel, width: 0 }
  });

  // eyebrow chip
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 0.9, w: 3.0, h: 0.42, rectRadius: 0.21,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("INTERNAL TRAINING", {
    x: 0.8, y: 0.9, w: 3.0, h: 0.42,
    fontSize: 11, fontFace: FH, color: "FFFFFF",
    bold: true, charSpacing: 6, align: "center", valign: "middle", margin: 0
  });

  // main title
  slide.addText("Qwipo Seller Store", {
    x: 0.8, y: 1.65, w: 11.5, h: 1.1,
    fontSize: 60, fontFace: FH, color: "FFFFFF", bold: true, margin: 0
  });
  slide.addText("Configuration & Training Guide", {
    x: 0.8, y: 2.80, w: 11.5, h: 0.7,
    fontSize: 32, fontFace: FH, color: C.ice, margin: 0
  });

  // descriptor line
  slide.addText(
    "Modules, dependencies, validations, common mistakes and troubleshooting — explained end to end.",
    {
      x: 0.8, y: 3.85, w: 11, h: 0.55,
      fontSize: 16, fontFace: FB, color: "FFFFFF", italic: true, margin: 0,
      transparency: 0
    }
  );

  // audience chips — equal width for visual rhythm
  const audiences = ["Product", "QA", "Operations", "Implementation", "Support", "Catalog"];
  sectionLabel(slide, 0.8, 4.85, 6, "AUDIENCE", "DCE6FF");
  const chipW = 1.75;
  const chipGap = 0.18;
  let cx = 0.8;
  audiences.forEach((a) => {
    chip(slide, cx, 5.20, chipW, 0.46, a, { fill: "FFFFFF", color: C.navy, fontSize: 13 });
    cx += chipW + chipGap;
  });

  // bottom meta
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 6.40, w: 11.7, h: 0.04,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("QWIPO  ·  PRODUCT TEAM", {
    x: 0.8, y: 6.55, w: 6, h: 0.32,
    fontSize: 11, fontFace: FH, color: C.ice, bold: true, charSpacing: 6, margin: 0
  });
  slide.addText("VERSION 1.0  ·  MAY 2026", {
    x: SW - 6.8, y: 6.55, w: 6, h: 0.32,
    fontSize: 11, fontFace: FH, color: C.ice, bold: true, charSpacing: 6,
    align: "right", margin: 0
  });
}

// ============== SLIDE 1 — Architecture Overview =====================
{
  const slide = pres.addSlide();
  pageChrome(slide, 1);
  header(slide, "MODULE 01  ·  ARCHITECTURE",
    "Seller Store Architecture Overview",
    "The complete dependency flow — every step must be completed in sequence.");

  // LEFT: vertical timeline of 10 steps
  const steps = [
    "Master Company",
    "Brand Creation",
    "Seller Creation",
    "Company & Brand Mapping",
    "ONDC Connector Setup",
    "Serviceability Setup (Polygon)",
    "SKU Creation / Catalog Upload",
    "Catalog Sync",
    "Buyer App Visibility",
    "Order Management"
  ];

  const lx = 0.7;          // timeline left
  const lwCard = 6.8;      // card width
  const startY = 1.85;
  const step = 0.49;       // vertical spacing between circles

  // continuous spine line behind circles
  slide.addShape(pres.shapes.RECTANGLE, {
    x: lx + 0.18, y: startY + 0.20, w: 0.04, h: step * (steps.length - 1),
    fill: { color: C.ice }, line: { color: C.ice, width: 0 }
  });

  steps.forEach((label, i) => {
    const y = startY + i * step;
    // numbered circle
    numCircle(slide, lx, y, 0.40, i + 1, { bg: C.navy, fontSize: 12 });
    // card with the label
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: lx + 0.60, y: y - 0.02, w: lwCard, h: 0.44, rectRadius: 0.06,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 },
      shadow: sh()
    });
    slide.addText(label, {
      x: lx + 0.78, y: y - 0.02, w: lwCard - 0.30, h: 0.44,
      fontSize: 13, fontFace: FH, color: C.text, bold: true,
      valign: "middle", margin: 0
    });
  });

  // RIGHT: Key Message card (navy)
  const rx = 8.40;
  const rw = 4.40;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: rx, y: 1.85, w: rw, h: 5.10,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }, shadow: sh()
  });
  // coral accent block at the top
  slide.addShape(pres.shapes.RECTANGLE, {
    x: rx, y: 1.85, w: rw, h: 0.10,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });

  slide.addText("KEY MESSAGE", {
    x: rx + 0.40, y: 2.15, w: rw - 0.80, h: 0.32,
    fontSize: 11, fontFace: FH, color: C.amber, bold: true, charSpacing: 6, margin: 0
  });

  // big quotation glyph
  slide.addText("“", {
    x: rx + 0.30, y: 2.40, w: 1.2, h: 1.2,
    fontSize: 96, fontFace: "Georgia", color: C.steel, bold: true, margin: 0
  });

  slide.addText(
    "If any one step is missed, products may not become visible in the Buyer App.",
    {
      x: rx + 0.40, y: 3.35, w: rw - 0.80, h: 2.0,
      fontSize: 22, fontFace: FH, color: "FFFFFF", bold: true, margin: 0
    }
  );

  slide.addShape(pres.shapes.RECTANGLE, {
    x: rx + 0.40, y: 5.55, w: 1.0, h: 0.04,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText(
    "Treat the dependency chain as gospel during onboarding and audits.",
    {
      x: rx + 0.40, y: 5.70, w: rw - 0.80, h: 0.9,
      fontSize: 12, fontFace: FB, color: C.ice, italic: true, margin: 0
    }
  );
}

// ============== SLIDE 2 — User Roles & Responsibilities =============
{
  const slide = pres.addSlide();
  pageChrome(slide, 2);
  header(slide, "MODULE 02  ·  PEOPLE",
    "User Roles & Responsibilities",
    "Three personas drive the Seller Store. Each owns a distinct slice of the workflow.");

  const roles = [
    {
      name: "Super Admin",
      tag: "Platform owner",
      initials: "SA",
      accent: C.navy,
      items: [
        "Create Companies",
        "Create Brands",
        "Create Sellers",
        "Configure Serviceability",
        "Configure ONDC Connectors",
        "Perform Catalog Sync"
      ]
    },
    {
      name: "Catalog User",
      tag: "Product data owner",
      initials: "CU",
      accent: C.coral,
      items: [
        "Create Products",
        "Upload SKUs",
        "Upload Images",
        "Configure Inventory",
        "Configure Pricing"
      ]
    },
    {
      name: "Seller User",
      tag: "Distributor / store",
      initials: "SU",
      accent: C.green,
      items: [
        "Login via OTP",
        "Manage Orders",
        "Manage Pricing",
        "Manage Schemes",
        "Confirm Deliveries"
      ]
    }
  ];

  const cardW = 4.05;
  const cardH = 5.10;
  const gap = 0.22;
  const startX = (SW - (cardW * 3 + gap * 2)) / 2;

  roles.forEach((r, idx) => {
    const x = startX + idx * (cardW + gap);
    const y = 1.85;

    // base card
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
    });
    // top accent
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: 0.50,
      fill: { color: r.accent }, line: { color: r.accent, width: 0 }
    });

    // role circle
    slide.addShape(pres.shapes.OVAL, {
      x: x + cardW / 2 - 0.45, y: y + 0.18, w: 0.90, h: 0.90,
      fill: { color: "FFFFFF" }, line: { color: r.accent, width: 2 }
    });
    slide.addText(r.initials, {
      x: x + cardW / 2 - 0.45, y: y + 0.18, w: 0.90, h: 0.90,
      fontSize: 26, fontFace: FH, color: r.accent, bold: true,
      align: "center", valign: "middle", margin: 0
    });

    // name + tag
    slide.addText(r.name, {
      x: x + 0.30, y: y + 1.20, w: cardW - 0.60, h: 0.42,
      fontSize: 20, fontFace: FH, color: C.text, bold: true,
      align: "center", margin: 0
    });
    slide.addText(r.tag, {
      x: x + 0.30, y: y + 1.62, w: cardW - 0.60, h: 0.30,
      fontSize: 11, fontFace: FB, color: C.muted, italic: true,
      align: "center", margin: 0
    });

    // divider line
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.40, y: y + 2.05, w: cardW - 0.80, h: 0.02,
      fill: { color: C.border }, line: { color: C.border, width: 0 }
    });

    // section label
    slide.addText("RESPONSIBILITIES", {
      x: x + 0.30, y: y + 2.18, w: cardW - 0.60, h: 0.28,
      fontSize: 9, fontFace: FH, color: r.accent, bold: true,
      charSpacing: 5, margin: 0
    });

    // list
    const lines = r.items.map((t, i) => ({
      text: t,
      options: {
        bullet: { code: "25CF" },
        color: C.text, fontSize: 13,
        breakLine: i < r.items.length - 1,
        paraSpaceAfter: 6
      }
    }));
    slide.addText(lines, {
      x: x + 0.40, y: y + 2.55, w: cardW - 0.70, h: 2.40,
      fontFace: FB, margin: 0
    });
  });
}

// ============== SLIDE 3 — Master Company Setup ======================
{
  const slide = pres.addSlide();
  pageChrome(slide, 3);
  header(slide, "MODULE 03  ·  COMPANY",
    "Master Company Setup",
    "Every seller must belong to a company. Companies sit at the top of the dependency tree.");

  // MANDATORY chip on right of title row
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: SW - 2.45, y: 0.62, w: 1.95, h: 0.42, rectRadius: 0.21,
    fill: { color: C.red }, line: { color: C.red, width: 0 }
  });
  slide.addText("MANDATORY", {
    x: SW - 2.45, y: 0.62, w: 1.95, h: 0.42,
    fontSize: 11, fontFace: FH, color: "FFFFFF", bold: true,
    charSpacing: 6, align: "center", valign: "middle", margin: 0
  });

  // LEFT card — Purpose + Examples
  const lx = 0.5, ly = 1.85, lw = 6.40, lh = 5.10;
  card(slide, lx, ly, lw, lh, { accent: C.navy });
  slide.addText("PURPOSE", {
    x: lx + 0.40, y: ly + 0.30, w: lw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 5, margin: 0
  });
  slide.addText("Every seller must belong to a company.", {
    x: lx + 0.40, y: ly + 0.62, w: lw - 0.80, h: 0.50,
    fontSize: 20, fontFace: FH, color: C.text, bold: true, margin: 0
  });
  slide.addText(
    "Companies are the parent entity in the catalog tree. Brands and SKUs hang off the company; no company means nothing downstream can be mapped or synced.",
    {
      x: lx + 0.40, y: ly + 1.20, w: lw - 0.80, h: 1.00,
      fontSize: 13, fontFace: FB, color: C.muted, margin: 0
    }
  );

  slide.addText("EXAMPLES", {
    x: lx + 0.40, y: ly + 2.55, w: lw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 5, margin: 0
  });
  const ex = ["ITC", "HUL", "Marico", "Nestle"];
  ex.forEach((name, i) => {
    const cx = lx + 0.40 + (i % 2) * 2.85;
    const cy = ly + 2.95 + Math.floor(i / 2) * 0.85;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: cx, y: cy, w: 2.65, h: 0.68, rectRadius: 0.10,
      fill: { color: C.cardAlt }, line: { color: C.border, width: 0.75 }
    });
    slide.addShape(pres.shapes.OVAL, {
      x: cx + 0.12, y: cy + 0.13, w: 0.42, h: 0.42,
      fill: { color: C.navy }, line: { color: C.navy, width: 0 }
    });
    slide.addText(name.charAt(0), {
      x: cx + 0.12, y: cy + 0.13, w: 0.42, h: 0.42,
      fontSize: 14, fontFace: FH, color: "FFFFFF", bold: true,
      align: "center", valign: "middle", margin: 0
    });
    slide.addText(name, {
      x: cx + 0.65, y: cy, w: 1.95, h: 0.68,
      fontSize: 16, fontFace: FH, color: C.text, bold: true,
      valign: "middle", margin: 0
    });
  });

  // RIGHT — two stacked callouts: Validation + Common Issue
  const rx = 7.15, rw = 5.65;
  // Validation
  card(slide, rx, 1.85, rw, 2.40, { accent: C.green });
  slide.addText("VALIDATION", {
    x: rx + 0.40, y: 2.05, w: rw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.green, bold: true, charSpacing: 5, margin: 0
  });
  symbolCircle(slide, rx + 0.40, 2.45, 0.40, "✓", C.green);
  slide.addText(
    "Always verify whether the company already exists before creating a new one.",
    {
      x: rx + 0.95, y: 2.40, w: rw - 1.30, h: 0.95,
      fontSize: 15, fontFace: FH, color: C.text, bold: true, margin: 0
    }
  );
  slide.addText(
    "Search by company name and check for spelling variants (ITC vs I.T.C) before clicking “Create”.",
    {
      x: rx + 0.40, y: 3.40, w: rw - 0.80, h: 0.70,
      fontSize: 12, fontFace: FB, color: C.muted, italic: true, margin: 0
    }
  );

  // Common Issue
  card(slide, rx, 4.55, rw, 2.40, { accent: C.red });
  slide.addText("COMMON ISSUE", {
    x: rx + 0.40, y: 4.75, w: rw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.red, bold: true, charSpacing: 5, margin: 0
  });
  symbolCircle(slide, rx + 0.40, 5.15, 0.40, "⚠", C.red);
  slide.addText(
    "Duplicate companies lead to incorrect mappings and catalog visibility issues.",
    {
      x: rx + 0.95, y: 5.10, w: rw - 1.30, h: 0.95,
      fontSize: 15, fontFace: FH, color: C.text, bold: true, margin: 0
    }
  );
  slide.addText(
    "Once a brand or SKU is mapped to the wrong company, the only fix is cleanup at the catalog layer.",
    {
      x: rx + 0.40, y: 6.10, w: rw - 0.80, h: 0.70,
      fontSize: 12, fontFace: FB, color: C.muted, italic: true, margin: 0
    }
  );
}

// ============== SLIDE 4 — Brand Creation ============================
{
  const slide = pres.addSlide();
  pageChrome(slide, 4);
  header(slide, "MODULE 04  ·  BRAND",
    "Brand Creation",
    "Products are organized and controlled through brands. Each brand belongs to exactly one company.");

  // LEFT — Purpose + Dependency
  const lx = 0.5, lw = 5.30;
  card(slide, lx, 1.85, lw, 5.10, { accent: C.coral });
  slide.addText("PURPOSE", {
    x: lx + 0.40, y: 2.05, w: lw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.coral, bold: true, charSpacing: 5, margin: 0
  });
  slide.addText("Why brands matter", {
    x: lx + 0.40, y: 2.38, w: lw - 0.80, h: 0.50,
    fontSize: 22, fontFace: FH, color: C.text, bold: true, margin: 0
  });
  slide.addText(
    "Brands carry pricing, schemes and visibility settings. Mapping a seller to a brand is what makes its products eligible for catalog sync.",
    {
      x: lx + 0.40, y: 2.95, w: lw - 0.80, h: 1.30,
      fontSize: 13, fontFace: FB, color: C.muted, margin: 0
    }
  );

  // Dependency banner
  slide.addShape(pres.shapes.RECTANGLE, {
    x: lx + 0.40, y: 4.40, w: lw - 0.80, h: 0.04,
    fill: { color: C.border }, line: { color: C.border, width: 0 }
  });

  slide.addText("DEPENDENCY", {
    x: lx + 0.40, y: 4.60, w: lw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.red, bold: true, charSpacing: 5, margin: 0
  });
  symbolCircle(slide, lx + 0.40, 5.00, 0.40, "!", C.red);
  slide.addText("Company must exist before creating brands.", {
    x: lx + 0.95, y: 4.95, w: lw - 1.30, h: 0.85,
    fontSize: 15, fontFace: FH, color: C.text, bold: true, margin: 0
  });
  slide.addText(
    "If the parent company isn’t created first, the brand dropdown will be empty and the form cannot be submitted.",
    {
      x: lx + 0.40, y: 5.95, w: lw - 0.80, h: 0.85,
      fontSize: 12, fontFace: FB, color: C.muted, italic: true, margin: 0
    }
  );

  // RIGHT — Examples: 2 company trees with 3 brand chips each
  const rx = 6.10, rw = 6.70;
  card(slide, rx, 1.85, rw, 5.10);
  slide.addText("EXAMPLES", {
    x: rx + 0.40, y: 2.05, w: rw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 5, margin: 0
  });

  // ITC tree
  const treeY1 = 2.55;
  // parent
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: rx + 0.40, y: treeY1, w: 1.40, h: 0.62, rectRadius: 0.10,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }
  });
  slide.addText("ITC", {
    x: rx + 0.40, y: treeY1, w: 1.40, h: 0.62,
    fontSize: 18, fontFace: FH, color: "FFFFFF", bold: true,
    align: "center", valign: "middle", margin: 0
  });
  // connector
  slide.addShape(pres.shapes.RIGHT_ARROW, {
    x: rx + 1.86, y: treeY1 + 0.22, w: 0.30, h: 0.18,
    fill: { color: C.steel }, line: { color: C.steel, width: 0 }
  });
  ["Aashirvaad", "Sunfeast", "Bingo"].forEach((b, i) => {
    chip(slide, rx + 2.30 + i * 1.40, treeY1 + 0.07, 1.30, 0.50, b,
      { fill: C.ice, color: C.navy, fontSize: 11 });
  });

  // HUL tree
  const treeY2 = 4.20;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: rx + 0.40, y: treeY2, w: 1.40, h: 0.62, rectRadius: 0.10,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("HUL", {
    x: rx + 0.40, y: treeY2, w: 1.40, h: 0.62,
    fontSize: 18, fontFace: FH, color: "FFFFFF", bold: true,
    align: "center", valign: "middle", margin: 0
  });
  slide.addShape(pres.shapes.RIGHT_ARROW, {
    x: rx + 1.86, y: treeY2 + 0.22, w: 0.30, h: 0.18,
    fill: { color: C.steel }, line: { color: C.steel, width: 0 }
  });
  ["Dove", "Lux", "Surf Excel"].forEach((b, i) => {
    chip(slide, rx + 2.30 + i * 1.40, treeY2 + 0.07, 1.30, 0.50, b,
      { fill: "FFE9D2", color: C.text, fontSize: 11 });
  });

  // bottom note
  slide.addShape(pres.shapes.RECTANGLE, {
    x: rx + 0.40, y: 5.70, w: rw - 0.80, h: 0.04,
    fill: { color: C.border }, line: { color: C.border, width: 0 }
  });
  slide.addText(
    "Pattern: one company → many brands. Brands inherit the company’s mapping.",
    {
      x: rx + 0.40, y: 5.95, w: rw - 0.80, h: 0.80,
      fontSize: 13, fontFace: FB, color: C.muted, italic: true, margin: 0
    }
  );
}

// ============== SLIDE 5 — Seller Creation ===========================
{
  const slide = pres.addSlide();
  pageChrome(slide, 5);
  header(slide, "MODULE 05  ·  SELLER",
    "Seller Creation",
    "Capture the seller’s legal, contact and location details. Several fields are load-bearing downstream.");

  // navigation breadcrumb chip (placed below subtitle to avoid overlap)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.78, w: 4.80, h: 0.40, rectRadius: 0.10,
    fill: { color: C.ice }, line: { color: C.ice, width: 0 }
  });
  slide.addText("NAVIGATE", {
    x: 0.60, y: 1.78, w: 1.00, h: 0.40,
    fontSize: 9, fontFace: FH, color: C.navy, bold: true,
    charSpacing: 4, valign: "middle", margin: 0
  });
  slide.addText("Super Admin  ›  Seller Management", {
    x: 1.95, y: 1.78, w: 3.35, h: 0.40,
    fontSize: 12, fontFace: FH, color: C.navy, bold: true, valign: "middle", margin: 0
  });

  // LEFT — Required Fields (2-col list)
  const lx = 0.5, lw = 6.95, ly = 2.30, lh = 4.65;
  card(slide, lx, ly, lw, lh, { accent: C.navy });
  slide.addText("REQUIRED FIELDS", {
    x: lx + 0.40, y: ly + 0.25, w: lw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 5, margin: 0
  });

  const fields = [
    "Business Name", "GST Number",
    "Mobile Number", "Contact Person",
    "Address",       "Pincode",
    "Latitude",      "Longitude"
  ];
  const colW = (lw - 0.80) / 2;
  fields.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx = lx + 0.40 + col * colW;
    const fy = ly + 0.75 + row * 0.95;
    numCircle(slide, fx, fy, 0.36, i + 1, { bg: C.steel, fontSize: 12 });
    slide.addText(f, {
      x: fx + 0.50, y: fy + 0.02, w: colW - 0.60, h: 0.32,
      fontSize: 14, fontFace: FH, color: C.text, bold: true, margin: 0
    });
    slide.addText("required", {
      x: fx + 0.50, y: fy + 0.34, w: colW - 0.60, h: 0.26,
      fontSize: 10, fontFace: FB, color: C.muted, italic: true, margin: 0
    });
  });

  // RIGHT — Important Notes
  const rx = 7.65, rw = 5.15;
  card(slide, rx, ly, rw, lh, { accent: C.coral });
  slide.addText("IMPORTANT NOTES", {
    x: rx + 0.40, y: ly + 0.25, w: rw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.coral, bold: true, charSpacing: 5, margin: 0
  });

  const notes = [
    { k: "GST Number",    v: "Used as the unique seller identifier across the platform.", color: C.navy },
    { k: "Mobile Number", v: "Used for OTP login by the seller user.",                     color: C.green },
    { k: "Address",       v: "Used for warehouse creation and location mapping.",          color: C.coral }
  ];
  notes.forEach((n, i) => {
    const ny = ly + 0.75 + i * 1.30;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: rx + 0.40, y: ny, w: 0.10, h: 1.05,
      fill: { color: n.color }, line: { color: n.color, width: 0 }
    });
    slide.addText(n.k, {
      x: rx + 0.60, y: ny, w: rw - 1.0, h: 0.36,
      fontSize: 14, fontFace: FH, color: C.text, bold: true, margin: 0
    });
    slide.addText(n.v, {
      x: rx + 0.60, y: ny + 0.38, w: rw - 1.0, h: 0.70,
      fontSize: 11, fontFace: FB, color: C.muted, margin: 0
    });
  });
}

// ============== SLIDE 6 — Company & Brand Mapping ===================
{
  const slide = pres.addSlide();
  pageChrome(slide, 6);
  header(slide, "MODULE 06  ·  MAPPING",
    "Company & Brand Mapping",
    "After Seller Creation, link the seller to the companies and brands they are allowed to sell.");

  // top process strip
  const stripY = 1.55;
  const proc = ["Seller Created", "Map Companies", "Map Brands"];
  let pcx = 0.5;
  proc.forEach((p, i) => {
    chip(slide, pcx, stripY, 2.50, 0.42, p, { fill: C.surface, color: C.navy, border: C.border, fontSize: 12 });
    // border on chip
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: pcx, y: stripY, w: 2.50, h: 0.42, rectRadius: 0.21,
      fill: { color: "FFFFFF", transparency: 100 },
      line: { color: C.border, width: 0.75 }
    });
    pcx += 2.50;
    if (i < proc.length - 1) {
      rightArrow(slide, pcx + 0.05, stripY + 0.12, C.steel);
      pcx += 0.50;
    }
  });

  // Example panel
  const ex_x = 0.5, ex_y = 2.20, ex_w = 12.33, ex_h = 4.75;
  card(slide, ex_x, ex_y, ex_w, ex_h);
  slide.addText("EXAMPLE", {
    x: ex_x + 0.40, y: ex_y + 0.25, w: 6, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 5, margin: 0
  });

  // Central seller node
  const cx = ex_x + 0.45;
  const cy = ex_y + 0.85;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: cx, y: cy, w: 3.30, h: 1.40,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }, shadow: sh()
  });
  slide.addText("ABC Distributor", {
    x: cx, y: cy + 0.18, w: 3.30, h: 0.50,
    fontSize: 20, fontFace: FH, color: "FFFFFF", bold: true,
    align: "center", margin: 0
  });
  slide.addText("Mapped seller", {
    x: cx, y: cy + 0.74, w: 3.30, h: 0.40,
    fontSize: 12, fontFace: FB, color: C.ice, italic: true,
    align: "center", margin: 0
  });

  // arrow line to columns
  slide.addShape(pres.shapes.RIGHT_ARROW, {
    x: cx + 3.40, y: cy + 0.62, w: 0.35, h: 0.18,
    fill: { color: C.steel }, line: { color: C.steel, width: 0 }
  });

  // Two mapping columns
  const m_x = ex_x + 4.45;
  const colW2 = 3.85;

  // Mapped Companies column
  slide.addShape(pres.shapes.RECTANGLE, {
    x: m_x, y: ex_y + 0.65, w: colW2, h: 0.45,
    fill: { color: C.cardAlt }, line: { color: C.cardAlt, width: 0 }
  });
  slide.addText("MAPPED COMPANIES", {
    x: m_x + 0.20, y: ex_y + 0.65, w: colW2 - 0.40, h: 0.45,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true,
    charSpacing: 5, valign: "middle", margin: 0
  });
  ["ITC", "HUL"].forEach((c2, i) => {
    chip(slide, m_x, ex_y + 1.25 + i * 0.65, colW2, 0.52, c2,
      { fill: C.surface, color: C.navy, fontSize: 14 });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: m_x, y: ex_y + 1.25 + i * 0.65, w: colW2, h: 0.52, rectRadius: 0.26,
      fill: { color: "FFFFFF", transparency: 100 },
      line: { color: C.navy, width: 1 }
    });
  });

  // Mapped Brands column
  const b_x = m_x + colW2 + 0.30;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: b_x, y: ex_y + 0.65, w: colW2, h: 0.45,
    fill: { color: "FFE9D2" }, line: { color: "FFE9D2", width: 0 }
  });
  slide.addText("MAPPED BRANDS", {
    x: b_x + 0.20, y: ex_y + 0.65, w: colW2 - 0.40, h: 0.45,
    fontSize: 10, fontFace: FH, color: "B0552A", bold: true,
    charSpacing: 5, valign: "middle", margin: 0
  });
  ["Aashirvaad", "Sunfeast", "Lux"].forEach((b2, i) => {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: b_x, y: ex_y + 1.25 + i * 0.65, w: colW2, h: 0.52, rectRadius: 0.26,
      fill: { color: C.surface }, line: { color: C.coral, width: 1 }
    });
    slide.addText(b2, {
      x: b_x, y: ex_y + 1.25 + i * 0.65, w: colW2, h: 0.52,
      fontSize: 14, fontFace: FH, color: C.coral, bold: true,
      align: "center", valign: "middle", margin: 0
    });
  });

  // Business Impact strip across bottom of the card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: ex_x + 0.30, y: ex_y + ex_h - 0.95, w: ex_w - 0.60, h: 0.65,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }
  });
  symbolCircle(slide, ex_x + 0.50, ex_y + ex_h - 0.83, 0.40, "i", C.coral);
  slide.addText("BUSINESS IMPACT", {
    x: ex_x + 1.05, y: ex_y + ex_h - 0.95, w: 2.5, h: 0.32,
    fontSize: 10, fontFace: FH, color: C.amber, bold: true, charSpacing: 5,
    valign: "middle", margin: 0
  });
  slide.addText(
    "Only mapped products become available for the seller. Mapping = visibility.",
    {
      x: ex_x + 1.05, y: ex_y + ex_h - 0.63, w: ex_w - 1.35, h: 0.35,
      fontSize: 13, fontFace: FH, color: "FFFFFF", bold: true,
      valign: "middle", margin: 0
    }
  );
}

// ============== SLIDE 7 — ONDC Connector Setup ======================
{
  const slide = pres.addSlide();
  pageChrome(slide, 7);
  header(slide, "MODULE 07  ·  CONNECTOR",
    "ONDC Connector Setup",
    "Without the ONDC Connector, the seller is invisible to ONDC buyers — no exceptions.");

  // CRITICAL chip on right of title row
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: SW - 2.05, y: 0.62, w: 1.55, h: 0.42, rectRadius: 0.21,
    fill: { color: C.red }, line: { color: C.red, width: 0 }
  });
  slide.addText("CRITICAL", {
    x: SW - 2.05, y: 0.62, w: 1.55, h: 0.42,
    fontSize: 11, fontFace: FH, color: "FFFFFF", bold: true,
    charSpacing: 6, align: "center", valign: "middle", margin: 0
  });

  // breadcrumb (placed below subtitle)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.78, w: 4.80, h: 0.40, rectRadius: 0.10,
    fill: { color: C.ice }, line: { color: C.ice, width: 0 }
  });
  slide.addText("NAVIGATE", {
    x: 0.60, y: 1.78, w: 1.00, h: 0.40,
    fontSize: 9, fontFace: FH, color: C.navy, bold: true,
    charSpacing: 4, valign: "middle", margin: 0
  });
  slide.addText("Seller  ›  Manage  ›  Connectors", {
    x: 1.95, y: 1.78, w: 3.35, h: 0.40,
    fontSize: 12, fontFace: FH, color: C.navy, bold: true, valign: "middle", margin: 0
  });

  // LEFT — Action steps
  const lx = 0.5, lw = 6.10, ly = 2.30, lh = 4.00;
  card(slide, lx, ly, lw, lh, { accent: C.green });
  slide.addText("ACTION", {
    x: lx + 0.40, y: ly + 0.25, w: lw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.green, bold: true, charSpacing: 5, margin: 0
  });

  // 2 steps
  const steps7 = [
    { label: "Select ONDC Connector", note: "From the available connector list" },
    { label: "Click Connect",         note: "No additional configuration required" }
  ];
  steps7.forEach((s, i) => {
    const sy = ly + 0.75 + i * 1.40;
    numCircle(slide, lx + 0.40, sy, 0.60, i + 1, { bg: C.green, fontSize: 22 });
    slide.addText(s.label, {
      x: lx + 1.15, y: sy, w: lw - 1.55, h: 0.40,
      fontSize: 18, fontFace: FH, color: C.text, bold: true, margin: 0
    });
    slide.addText(s.note, {
      x: lx + 1.15, y: sy + 0.42, w: lw - 1.55, h: 0.40,
      fontSize: 12, fontFace: FB, color: C.muted, italic: true, margin: 0
    });
  });

  // purpose footer
  slide.addShape(pres.shapes.RECTANGLE, {
    x: lx + 0.40, y: ly + 3.30, w: lw - 0.80, h: 0.02,
    fill: { color: C.border }, line: { color: C.border, width: 0 }
  });
  slide.addText("PURPOSE", {
    x: lx + 0.40, y: ly + 3.45, w: lw - 0.80, h: 0.24,
    fontSize: 9, fontFace: FH, color: C.muted, bold: true, charSpacing: 5, margin: 0
  });
  slide.addText("Connects seller catalog with the ONDC protocol.", {
    x: lx + 0.40, y: ly + 3.70, w: lw - 0.80, h: 0.32,
    fontSize: 13, fontFace: FH, color: C.text, bold: true, margin: 0
  });

  // RIGHT — Without ONDC warning
  const rx = 6.80, rw = 6.00;
  card(slide, rx, ly, rw, lh, { accent: C.red });
  slide.addText("WITHOUT ONDC CONNECTOR", {
    x: rx + 0.40, y: ly + 0.25, w: rw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.red, bold: true, charSpacing: 5, margin: 0
  });

  const fails = [
    "Products are NOT visible in the Buyer App.",
    "Seller cannot receive ONDC orders."
  ];
  fails.forEach((f, i) => {
    const fy = ly + 0.80 + i * 1.30;
    symbolCircle(slide, rx + 0.40, fy, 0.50, "✗", C.red);
    slide.addText(f, {
      x: rx + 1.05, y: fy - 0.05, w: rw - 1.45, h: 0.65,
      fontSize: 15, fontFace: FH, color: C.text, bold: true,
      valign: "middle", margin: 0
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: rx + 1.05, y: fy + 0.65, w: rw - 1.45, h: 0.02,
      fill: { color: C.border }, line: { color: C.border, width: 0 }
    });
    slide.addText(i === 0
      ? "ONDC discovery doesn’t pick up the seller catalog."
      : "Orders placed in the Buyer App never reach the Seller Store.",
    {
      x: rx + 1.05, y: fy + 0.72, w: rw - 1.45, h: 0.35,
      fontSize: 11, fontFace: FB, color: C.muted, italic: true, margin: 0
    });
  });

  // Bottom: "Most common onboarding mistake" banner
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 6.40, w: SW - 1.0, h: 0.55,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }, shadow: sh()
  });
  slide.addText("MOST COMMON ONBOARDING MISTAKE", {
    x: 0.75, y: 6.40, w: 5.5, h: 0.55,
    fontSize: 11, fontFace: FH, color: "FFFFFF", bold: true,
    charSpacing: 6, valign: "middle", margin: 0
  });
  slide.addText("ONDC Connector not configured.", {
    x: 6.30, y: 6.40, w: 6.5, h: 0.55,
    fontSize: 15, fontFace: FH, color: "FFFFFF", bold: true,
    align: "right", valign: "middle", margin: 0
  });
}

// ============== SLIDE 8 — Serviceability Setup ======================
{
  const slide = pres.addSlide();
  pageChrome(slide, 8);
  header(slide, "MODULE 08  ·  SERVICEABILITY",
    "Serviceability Setup",
    "Defines where retailers can purchase from this seller. Upload one polygon per company.");

  // breadcrumb (placed below subtitle)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.78, w: 4.20, h: 0.40, rectRadius: 0.10,
    fill: { color: C.ice }, line: { color: C.ice, width: 0 }
  });
  slide.addText("NAVIGATE", {
    x: 0.60, y: 1.78, w: 1.00, h: 0.40,
    fontSize: 9, fontFace: FH, color: C.navy, bold: true,
    charSpacing: 4, valign: "middle", margin: 0
  });
  slide.addText("Seller  ›  Serviceability", {
    x: 1.95, y: 1.78, w: 2.75, h: 0.40,
    fontSize: 12, fontFace: FH, color: C.navy, bold: true, valign: "middle", margin: 0
  });

  // 3 process step cards
  const stepsY = 2.45;
  const stepH = 2.45;
  const stepGap = 0.50;
  const stepCount = 3;
  const stepW = (SW - 1.0 - stepGap * (stepCount - 1)) / stepCount; // 3.94
  const stepData = [
    { num: 1, label: "Select Company",         note: "Choose from the seller’s mapped companies.", color: C.navy },
    { num: 2, label: "Upload GeoJSON Polygon", note: "Provide a valid polygon for the territory.",      color: C.coral },
    { num: 3, label: "Save",                   note: "Polygon is stored and applied immediately.",      color: C.green }
  ];
  let sx = 0.5;
  stepData.forEach((s, i) => {
    // card
    slide.addShape(pres.shapes.RECTANGLE, {
      x: sx, y: stepsY, w: stepW, h: stepH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
    });
    // top color band (decoration only — number is rendered below)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: sx, y: stepsY, w: stepW, h: 0.20,
      fill: { color: s.color }, line: { color: s.color, width: 0 }
    });
    // big number
    slide.addText(String(s.num), {
      x: sx, y: stepsY + 0.40, w: stepW, h: 1.10,
      fontSize: 76, fontFace: FH, color: s.color, bold: true,
      align: "center", margin: 0
    });
    // label
    slide.addText(s.label, {
      x: sx + 0.25, y: stepsY + 1.50, w: stepW - 0.50, h: 0.40,
      fontSize: 17, fontFace: FH, color: C.text, bold: true,
      align: "center", margin: 0
    });
    // note
    slide.addText(s.note, {
      x: sx + 0.25, y: stepsY + 1.92, w: stepW - 0.50, h: 0.50,
      fontSize: 11, fontFace: FB, color: C.muted, align: "center", italic: true, margin: 0
    });
    // arrow between cards
    if (i < stepCount - 1) {
      slide.addShape(pres.shapes.RIGHT_ARROW, {
        x: sx + stepW + 0.10, y: stepsY + stepH / 2 - 0.18, w: 0.30, h: 0.36,
        fill: { color: C.steel }, line: { color: C.steel, width: 0 }
      });
    }
    sx += stepW + stepGap;
  });

  // Purpose strip
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 5.10, w: SW - 1.0, h: 1.75,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }, shadow: sh()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 5.10, w: 0.10, h: 1.75,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("PURPOSE", {
    x: 0.80, y: 5.25, w: 6, h: 0.30,
    fontSize: 11, fontFace: FH, color: C.amber, bold: true, charSpacing: 6, margin: 0
  });
  slide.addText(
    "Defines where retailers can purchase from this seller.",
    {
      x: 0.80, y: 5.60, w: SW - 1.6, h: 0.55,
      fontSize: 22, fontFace: FH, color: "FFFFFF", bold: true, margin: 0
    }
  );
  slide.addText(
    "Retailers outside the configured polygon will not see this seller’s products in the Buyer App, even if the SKU is active and synced.",
    {
      x: 0.80, y: 6.20, w: SW - 1.6, h: 0.55,
      fontSize: 12, fontFace: FB, color: C.ice, italic: true, margin: 0
    }
  );
}

// ============== SLIDE 9 — Phase 1 Serviceability Rules ==============
{
  const slide = pres.addSlide();
  pageChrome(slide, 9);
  header(slide, "MODULE 09  ·  RULES",
    "Phase 1 Serviceability Rules",
    "What you can and cannot do with polygons in the current release.");

  // LEFT — Rules
  const lx = 0.5, lw = 7.30, ly = 1.85, lh = 4.50;
  card(slide, lx, ly, lw, lh, { accent: C.navy });
  slide.addText("CURRENT RULES", {
    x: lx + 0.40, y: ly + 0.25, w: lw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 5, margin: 0
  });

  const rules = [
    { ok: true,  text: "One Company = One Polygon",         note: "Each mapped company gets a single dedicated territory." },
    { ok: true,  text: "Polygon can be edited",             note: "Re-upload or adjust the GeoJSON whenever the territory changes." },
    { ok: false, text: "Polygon cannot be deleted",         note: "Only edits are permitted in Phase 1 — deletion is blocked." },
    { ok: false, text: "Beat-wise serviceability not supported", note: "Beat-level polygons are planned for a later phase." }
  ];
  rules.forEach((r, i) => {
    const ry = ly + 0.75 + i * 0.88;
    const col = r.ok ? C.green : C.red;
    const sym = r.ok ? "✓" : "✗";
    symbolCircle(slide, lx + 0.40, ry + 0.05, 0.42, sym, col);
    slide.addText(r.text, {
      x: lx + 1.00, y: ry, w: lw - 1.40, h: 0.38,
      fontSize: 15, fontFace: FH, color: C.text, bold: true, margin: 0
    });
    slide.addText(r.note, {
      x: lx + 1.00, y: ry + 0.38, w: lw - 1.40, h: 0.42,
      fontSize: 11, fontFace: FB, color: C.muted, italic: true, margin: 0
    });
  });

  // RIGHT — Examples (2 cards)
  const rx = 8.10, rw = 4.70;
  card(slide, rx, ly, rw, lh);
  slide.addText("EXAMPLES", {
    x: rx + 0.30, y: ly + 0.25, w: rw - 0.60, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 5, margin: 0
  });

  const ex9 = [
    { company: "ITC", region: "Mumbai Polygon", color: C.navy },
    { company: "HUL", region: "Pune Polygon",   color: C.coral }
  ];
  ex9.forEach((e, i) => {
    const ey = ly + 0.75 + i * 1.85;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: rx + 0.30, y: ey, w: rw - 0.60, h: 1.55,
      fill: { color: C.cardAlt }, line: { color: C.border, width: 0.75 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: rx + 0.30, y: ey, w: 0.10, h: 1.55,
      fill: { color: e.color }, line: { color: e.color, width: 0 }
    });
    slide.addText(e.company, {
      x: rx + 0.55, y: ey + 0.15, w: rw - 1.10, h: 0.40,
      fontSize: 20, fontFace: FH, color: e.color, bold: true, margin: 0
    });
    slide.addShape(pres.shapes.RIGHT_ARROW, {
      x: rx + 0.55, y: ey + 0.65, w: 0.30, h: 0.18,
      fill: { color: C.steel }, line: { color: C.steel, width: 0 }
    });
    slide.addText(e.region, {
      x: rx + 0.95, y: ey + 0.55, w: rw - 1.30, h: 0.38,
      fontSize: 15, fontFace: FH, color: C.text, bold: true, margin: 0
    });
    slide.addText(`Retailers in ${e.region.split(" ")[0]} can purchase from this seller.`, {
      x: rx + 0.55, y: ey + 1.05, w: rw - 1.10, h: 0.38,
      fontSize: 10, fontFace: FB, color: C.muted, italic: true, margin: 0
    });
  });

  // Bottom important banner
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 6.50, w: SW - 1.0, h: 0.45,
    fill: { color: C.amber }, line: { color: C.amber, width: 0 }, shadow: sh()
  });
  slide.addText("IMPORTANT", {
    x: 0.70, y: 6.50, w: 1.6, h: 0.45,
    fontSize: 11, fontFace: FH, color: C.text, bold: true,
    charSpacing: 6, valign: "middle", margin: 0
  });
  slide.addText("Products become visible only within configured polygons.", {
    x: 2.40, y: 6.50, w: SW - 2.9, h: 0.45,
    fontSize: 13, fontFace: FH, color: C.text, bold: true, valign: "middle", margin: 0
  });
}

// ============== SLIDE 10 — Polygon & Territory Management ===========
{
  const slide = pres.addSlide();
  pageChrome(slide, 10);
  header(slide, "MODULE 10  ·  TERRITORY",
    "Polygon & Territory Management",
    "Why getting polygons right matters — they decide who sees the seller and prevent territory conflicts.");

  // Why polygons matter — 4 benefit cards in 2x2 grid
  const benefits = [
    { title: "Prevent Distributor Conflicts", note: "Two distributors won’t fight over the same retailer.", color: C.navy },
    { title: "Territory Ownership",           note: "Crystal-clear ownership of each retailer cluster.",          color: C.coral },
    { title: "Retailer Allocation",           note: "Retailers are routed to the right seller automatically.",    color: C.green },
    { title: "Controlled Market Coverage",    note: "Plan and roll out coverage region by region.",               color: C.steel }
  ];
  const gridStartY = 1.85;
  const gridW = SW - 1.0;
  const cellW = (gridW - 0.30) / 2;
  const cellH = 1.95;
  const gridGap = 0.30;

  benefits.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * (cellW + gridGap);
    const y = gridStartY + row * (cellH + gridGap);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cellW, h: cellH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h: cellH,
      fill: { color: b.color }, line: { color: b.color, width: 0 }
    });
    // big number on right
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: x + cellW - 1.55, y: y + 0.10, w: 1.40, h: 1.10,
      fontSize: 60, fontFace: FH, color: C.cardAlt, bold: true,
      align: "right", margin: 0
    });
    slide.addText(b.title, {
      x: x + 0.35, y: y + 0.25, w: cellW - 2.0, h: 0.50,
      fontSize: 18, fontFace: FH, color: C.text, bold: true, margin: 0
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.35, y: y + 0.80, w: 0.50, h: 0.04,
      fill: { color: b.color }, line: { color: b.color, width: 0 }
    });
    slide.addText(b.note, {
      x: x + 0.35, y: y + 0.95, w: cellW - 0.70, h: 0.90,
      fontSize: 12, fontFace: FB, color: C.muted, margin: 0
    });
  });

  // Bottom validation strip
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 6.20, w: SW - 1.0, h: 0.75,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }, shadow: sh()
  });
  symbolCircle(slide, 0.75, 6.40, 0.36, "✓", C.green);
  slide.addText("VALIDATION", {
    x: 1.25, y: 6.20, w: 2.0, h: 0.40,
    fontSize: 11, fontFace: FH, color: C.amber, bold: true,
    charSpacing: 6, valign: "bottom", margin: 0
  });
  slide.addText(
    "Always verify uploaded GeoJSON before saving. Incorrect polygons lead to retailer visibility issues.",
    {
      x: 1.25, y: 6.55, w: SW - 2.0, h: 0.35,
      fontSize: 13, fontFace: FH, color: "FFFFFF", bold: true,
      valign: "top", margin: 0
    }
  );
}

// ============== SLIDE 11 — SKU Creation =============================
{
  const slide = pres.addSlide();
  pageChrome(slide, 11);
  header(slide, "MODULE 11  ·  CATALOG",
    "SKU Creation",
    "How catalog teams add products to the platform — manual entry, bulk uploads or DMS feeds.");

  // Performed By chip (placed below subtitle)
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.78, w: 5.40, h: 0.42, rectRadius: 0.21,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("PERFORMED BY", {
    x: 0.70, y: 1.78, w: 1.80, h: 0.42,
    fontSize: 10, fontFace: FH, color: "FFFFFF", bold: true,
    charSpacing: 5, valign: "middle", margin: 0
  });
  slide.addText("Catalog Team", {
    x: 2.55, y: 1.78, w: 3.20, h: 0.42,
    fontSize: 14, fontFace: FH, color: "FFFFFF", bold: true, valign: "middle", margin: 0
  });

  // METHODS — 3 cards in a row
  sectionLabel(slide, 0.5, 2.35, 4, "METHODS");
  const methodsY = 2.65;
  const methodH = 1.75;
  const methodGap = 0.30;
  const methodW = (SW - 1.0 - methodGap * 2) / 3;
  const methodData = [
    { n: 1, title: "Manual SKU Creation", note: "Enter one product at a time through the Catalog UI." },
    { n: 2, title: "Excel Bulk Upload",   note: "Upload a populated template to add many SKUs at once." },
    { n: 3, title: "DMS Integration",     note: "Pull SKUs automatically from the source DMS feed." }
  ];
  let mx = 0.5;
  methodData.forEach((m) => {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: mx, y: methodsY, w: methodW, h: methodH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: mx, y: methodsY, w: methodW, h: 0.08,
      fill: { color: C.navy }, line: { color: C.navy, width: 0 }
    });
    numCircle(slide, mx + 0.30, methodsY + 0.30, 0.55, m.n, { bg: C.navy, fontSize: 20 });
    slide.addText(m.title, {
      x: mx + 1.00, y: methodsY + 0.32, w: methodW - 1.20, h: 0.50,
      fontSize: 16, fontFace: FH, color: C.text, bold: true, margin: 0
    });
    slide.addText(m.note, {
      x: mx + 0.30, y: methodsY + 1.05, w: methodW - 0.50, h: 0.70,
      fontSize: 11, fontFace: FB, color: C.muted, italic: true, margin: 0
    });
    mx += methodW + methodGap;
  });

  // SKU Configuration — section
  sectionLabel(slide, 0.5, 4.50, 6, "SKU CONFIGURATION");
  slide.addText("Every SKU must be configured with these six attributes:", {
    x: 0.5, y: 4.80, w: SW - 1.0, h: 0.30,
    fontSize: 12, fontFace: FB, color: C.muted, italic: true, margin: 0
  });

  const config = [
    { k: "Product Name",     color: C.navy },
    { k: "Images",           color: C.coral },
    { k: "UOM",              color: C.steel },
    { k: "Inventory",        color: C.green },
    { k: "Pricing",          color: C.amber },
    { k: "Activation Status",color: C.red }
  ];
  const cgY = 5.25;
  const cgH = 1.50;
  const cgGap = 0.18;
  const cgCount = 6;
  const cgW = (SW - 1.0 - cgGap * (cgCount - 1)) / cgCount;
  let cgX = 0.5;
  config.forEach((c) => {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: cgX, y: cgY, w: cgW, h: cgH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: cgX, y: cgY, w: cgW, h: 0.08,
      fill: { color: c.color }, line: { color: c.color, width: 0 }
    });
    slide.addText(c.k, {
      x: cgX + 0.10, y: cgY + 0.40, w: cgW - 0.20, h: 0.75,
      fontSize: 13, fontFace: FH, color: C.text, bold: true,
      align: "center", valign: "middle", margin: 0
    });
    cgX += cgW + cgGap;
  });
}

// ============== SLIDE 12 — Catalog Sync =============================
{
  const slide = pres.addSlide();
  pageChrome(slide, 12);
  header(slide, "MODULE 12  ·  SYNC",
    "Catalog Sync",
    "How products move from the Catalog Module into the Seller Store.");

  // top mini-info row: Purpose + Navigate (placed below subtitle)
  const infoY = 1.78;
  // Purpose mini
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: infoY, w: 6.30, h: 0.65,
    fill: { color: C.surface }, line: { color: C.border, width: 0.75 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: infoY, w: 0.08, h: 0.65,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }
  });
  slide.addText("PURPOSE", {
    x: 0.70, y: infoY + 0.05, w: 1.60, h: 0.25,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 5, margin: 0
  });
  slide.addText("Move catalog products from Catalog Module to Seller Store.", {
    x: 0.70, y: infoY + 0.28, w: 6.0, h: 0.34,
    fontSize: 12, fontFace: FH, color: C.text, bold: true, margin: 0
  });

  // Navigate mini
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7.05, y: infoY, w: 5.75, h: 0.65,
    fill: { color: C.surface }, line: { color: C.border, width: 0.75 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7.05, y: infoY, w: 0.08, h: 0.65,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("NAVIGATE", {
    x: 7.25, y: infoY + 0.05, w: 1.60, h: 0.25,
    fontSize: 10, fontFace: FH, color: C.coral, bold: true, charSpacing: 5, margin: 0
  });
  slide.addText("Seller  ›  Companies & Brands  →  Sync Catalog", {
    x: 7.25, y: infoY + 0.28, w: 5.5, h: 0.34,
    fontSize: 12, fontFace: FH, color: C.text, bold: true, margin: 0
  });

  // Before vs After comparison
  sectionLabel(slide, 0.5, 2.62, 6, "BEFORE  vs  AFTER  SYNC");
  const cmpY = 2.92;
  const cmpH = 4.00;
  const cmpW = (SW - 1.0 - 0.60) / 2; // gap between cards

  // BEFORE
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: cmpY, w: cmpW, h: cmpH,
    fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: cmpY, w: cmpW, h: 0.65,
    fill: { color: C.muted }, line: { color: C.muted, width: 0 }
  });
  slide.addText("BEFORE SYNC", {
    x: 0.7, y: cmpY, w: cmpW - 0.4, h: 0.65,
    fontSize: 14, fontFace: FH, color: "FFFFFF", bold: true,
    charSpacing: 5, valign: "middle", margin: 0
  });
  symbolCircle(slide, 0.5 + cmpW / 2 - 0.40, cmpY + 1.10, 0.80, "0", C.muted);
  slide.addText("Seller has no products.", {
    x: 0.5 + 0.30, y: cmpY + 2.20, w: cmpW - 0.60, h: 0.50,
    fontSize: 18, fontFace: FH, color: C.text, bold: true, align: "center", margin: 0
  });
  slide.addText(
    "Storefront and Buyer App show no catalog — even if Companies & Brands are mapped.",
    {
      x: 0.5 + 0.50, y: cmpY + 2.80, w: cmpW - 1.0, h: 1.30,
      fontSize: 12, fontFace: FB, color: C.muted, italic: true,
      align: "center", margin: 0
    }
  );

  // big arrow between
  slide.addShape(pres.shapes.RIGHT_ARROW, {
    x: 0.5 + cmpW + 0.10, y: cmpY + cmpH / 2 - 0.20, w: 0.40, h: 0.40,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });

  // AFTER
  const ax = 0.5 + cmpW + 0.60;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: ax, y: cmpY, w: cmpW, h: cmpH,
    fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: ax, y: cmpY, w: cmpW, h: 0.65,
    fill: { color: C.green }, line: { color: C.green, width: 0 }
  });
  slide.addText("AFTER SYNC", {
    x: ax + 0.2, y: cmpY, w: cmpW - 0.4, h: 0.65,
    fontSize: 14, fontFace: FH, color: "FFFFFF", bold: true,
    charSpacing: 5, valign: "middle", margin: 0
  });
  slide.addText("Seller receives:", {
    x: ax + 0.30, y: cmpY + 0.90, w: cmpW - 0.60, h: 0.40,
    fontSize: 14, fontFace: FH, color: C.text, bold: true, align: "center", margin: 0
  });
  // 3 received chips stacked
  const recv = ["Products", "Pricing", "Schemes"];
  recv.forEach((r, i) => {
    const ry = cmpY + 1.45 + i * 0.78;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: ax + 0.85, y: ry, w: cmpW - 1.70, h: 0.62, rectRadius: 0.10,
      fill: { color: C.surface }, line: { color: C.green, width: 1.25 }
    });
    symbolCircle(slide, ax + 1.00, ry + 0.11, 0.40, "✓", C.green);
    slide.addText(r, {
      x: ax + 1.55, y: ry, w: cmpW - 2.35, h: 0.62,
      fontSize: 15, fontFace: FH, color: C.text, bold: true,
      valign: "middle", margin: 0
    });
  });
}

// ============== SLIDE 13 — Catalog Sync Logic =======================
{
  const slide = pres.addSlide();
  pageChrome(slide, 13);
  header(slide, "MODULE 13  ·  SYNC LOGIC",
    "Catalog Sync Logic",
    "Important system behaviour. Knowing this prevents “why isn’t my update showing up” tickets.");

  // top key insight banner (placed below subtitle)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.78, w: SW - 1.0, h: 0.95,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }, shadow: sh()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.78, w: 0.10, h: 0.95,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("SYNC ONLY IDENTIFIES", {
    x: 0.80, y: 1.88, w: 4.5, h: 0.30,
    fontSize: 11, fontFace: FH, color: C.amber, bold: true, charSpacing: 6, margin: 0
  });
  slide.addText("Delta Products", {
    x: 0.80, y: 2.13, w: 5.0, h: 0.55,
    fontSize: 28, fontFace: FH, color: "FFFFFF", bold: true, margin: 0
  });
  slide.addText("… and adds the missing products. Existing entries are left untouched.", {
    x: 5.60, y: 1.93, w: SW - 6.1, h: 0.70,
    fontSize: 14, fontFace: FH, color: C.ice, italic: true,
    align: "right", valign: "middle", margin: 0
  });

  // Supported vs Not Supported — 2 cards
  const cy = 2.95;
  const ch = 1.95;
  const cw = (SW - 1.0 - 0.30) / 2;

  // Supported
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: cy, w: cw, h: ch,
    fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: cy, w: 0.08, h: ch,
    fill: { color: C.green }, line: { color: C.green, width: 0 }
  });
  slide.addText("SUPPORTED", {
    x: 0.75, y: cy + 0.20, w: cw - 0.40, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.green, bold: true, charSpacing: 5, margin: 0
  });
  symbolCircle(slide, 0.75, cy + 0.65, 0.60, "✓", C.green);
  slide.addText("New SKU Creation", {
    x: 1.55, y: cy + 0.60, w: cw - 1.30, h: 0.50,
    fontSize: 20, fontFace: FH, color: C.text, bold: true, valign: "middle", margin: 0
  });
  slide.addText(
    "Brand-new SKUs flow from the Catalog Module into the Seller Store on every sync.",
    {
      x: 0.75, y: cy + 1.45, w: cw - 0.50, h: 0.55,
      fontSize: 12, fontFace: FB, color: C.muted, italic: true, margin: 0
    }
  );

  // Not Supported
  const nx = 0.5 + cw + 0.30;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: nx, y: cy, w: cw, h: ch,
    fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: nx, y: cy, w: 0.08, h: ch,
    fill: { color: C.red }, line: { color: C.red, width: 0 }
  });
  slide.addText("NOT SUPPORTED", {
    x: nx + 0.25, y: cy + 0.20, w: cw - 0.40, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.red, bold: true, charSpacing: 5, margin: 0
  });
  symbolCircle(slide, nx + 0.25, cy + 0.65, 0.60, "✗", C.red);
  slide.addText("Existing Product Updates", {
    x: nx + 1.05, y: cy + 0.60, w: cw - 1.30, h: 0.50,
    fontSize: 20, fontFace: FH, color: C.text, bold: true, valign: "middle", margin: 0
  });
  slide.addText(
    "Edits to existing SKUs (price, scheme, info) are NOT pushed to sellers automatically.",
    {
      x: nx + 0.25, y: cy + 1.45, w: cw - 0.50, h: 0.55,
      fontSize: 12, fontFace: FB, color: C.muted, italic: true, margin: 0
    }
  );

  // Bottom — Manual update list
  const my = 5.10;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: my, w: SW - 1.0, h: 1.85,
    fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: my, w: 0.08, h: 1.85,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });

  slide.addText("IF CATALOG UPDATES OCCUR", {
    x: 0.75, y: my + 0.18, w: 6, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.coral, bold: true, charSpacing: 5, margin: 0
  });
  slide.addText("Seller must manually update inside Seller Portal:", {
    x: 0.75, y: my + 0.48, w: SW - 1.5, h: 0.40,
    fontSize: 16, fontFace: FH, color: C.text, bold: true, margin: 0
  });

  const manual = ["Pricing", "Schemes", "Product Information"];
  let mxr = 0.75;
  const itemW = (SW - 1.5 - 0.40) / 3;
  manual.forEach((m, i) => {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: mxr, y: my + 1.05, w: itemW, h: 0.65, rectRadius: 0.10,
      fill: { color: C.cardAlt }, line: { color: C.coral, width: 1 }
    });
    numCircle(slide, mxr + 0.15, my + 1.20, 0.36, i + 1, { bg: C.coral, fontSize: 12 });
    slide.addText(m, {
      x: mxr + 0.65, y: my + 1.05, w: itemW - 0.80, h: 0.65,
      fontSize: 14, fontFace: FH, color: C.text, bold: true,
      valign: "middle", margin: 0
    });
    mxr += itemW + 0.20;
  });
}

// ============== SLIDE 14 — Product Visibility Journey ===============
{
  const slide = pres.addSlide();
  pageChrome(slide, 14);
  header(slide, "MODULE 14  ·  VISIBILITY",
    "Product Visibility Journey",
    "The path a single SKU travels from creation to its first appearance in the Buyer App.");

  // LEFT — vertical flow of 6 steps
  const journey = [
    "Product Creation",
    "Catalog Upload",
    "Catalog Sync",
    "Seller Store",
    "ONDC Connector",
    "Buyer App"
  ];
  const jx = 0.5, jw = 7.0;
  const startY = 2.00;
  const stepBlock = 0.78;

  // spine
  slide.addShape(pres.shapes.RECTANGLE, {
    x: jx + 0.38, y: startY + 0.35, w: 0.04, h: stepBlock * (journey.length - 1),
    fill: { color: C.ice }, line: { color: C.ice, width: 0 }
  });

  journey.forEach((j, i) => {
    const y = startY + i * stepBlock;
    const isLast = i === journey.length - 1;
    const color = isLast ? C.coral : (i === 0 ? C.navy : C.steel);
    numCircle(slide, jx + 0.20, y + 0.10, 0.45, i + 1, { bg: color, fontSize: 14 });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: jx + 0.85, y: y + 0.05, w: jw - 1.0, h: 0.55, rectRadius: 0.10,
      fill: { color: isLast ? "FFE9D2" : C.surface },
      line: { color: isLast ? C.coral : C.border, width: 0.75 },
      shadow: sh()
    });
    slide.addText(j, {
      x: jx + 1.10, y: y + 0.05, w: jw - 1.30, h: 0.55,
      fontSize: 15, fontFace: FH, color: isLast ? C.coral : C.text,
      bold: true, valign: "middle", margin: 0
    });
  });

  // RIGHT — Validation Checklist
  const rx = 8.10, rw = 4.70;
  const ry = 1.85, rh = 5.10;
  card(slide, rx, ry, rw, rh, { accent: C.green });
  slide.addText("VALIDATION CHECKLIST", {
    x: rx + 0.40, y: ry + 0.25, w: rw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.green, bold: true, charSpacing: 5, margin: 0
  });
  slide.addText("Before claiming a SKU is live, verify:", {
    x: rx + 0.40, y: ry + 0.55, w: rw - 0.80, h: 0.32,
    fontSize: 11, fontFace: FB, color: C.muted, italic: true, margin: 0
  });

  const checks = [
    "SKU Active",
    "Image Available",
    "Company Mapped",
    "ONDC Connected",
    "Serviceability Configured"
  ];
  checks.forEach((c, i) => {
    const cy = ry + 1.00 + i * 0.78;
    symbolCircle(slide, rx + 0.40, cy + 0.08, 0.42, "✓", C.green);
    slide.addText(c, {
      x: rx + 1.00, y: cy, w: rw - 1.40, h: 0.55,
      fontSize: 14, fontFace: FH, color: C.text, bold: true,
      valign: "middle", margin: 0
    });
  });
}

// ============== SLIDE 15 — Buyer App Visibility Checklist ===========
{
  const slide = pres.addSlide();
  pageChrome(slide, 15);
  header(slide, "MODULE 15  ·  GATING",
    "Buyer App Visibility Checklist",
    "Nine gates. A product appears in the Buyer App only when every single gate is green.");

  // 3x3 grid of green check items
  const checks15 = [
    "Company Exists",
    "Brand Exists",
    "Seller Created",
    "Company Mapping Completed",
    "ONDC Connector Connected",
    "Polygon Uploaded",
    "SKU Created",
    "Images Uploaded",
    "Catalog Sync Completed"
  ];
  const gx = 0.5;
  const gy = 1.85;
  const gw = SW - 1.0;
  const cellGap = 0.20;
  const cols = 3;
  const rows = 3;
  const cellW = (gw - cellGap * (cols - 1)) / cols;
  const cellH = 1.30;

  checks15.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gx + col * (cellW + cellGap);
    const y = gy + row * (cellH + cellGap);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cellW, h: cellH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h: cellH,
      fill: { color: C.green }, line: { color: C.green, width: 0 }
    });
    // step number tag top-right
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: x + cellW - 1.10, y: y + 0.05, w: 1.00, h: 0.40,
      fontSize: 28, fontFace: FH, color: C.cardAlt, bold: true,
      align: "right", margin: 0
    });
    symbolCircle(slide, x + 0.30, y + 0.30, 0.50, "✓", C.green);
    slide.addText(t, {
      x: x + 0.95, y: y + 0.32, w: cellW - 2.05, h: 0.65,
      fontSize: 14, fontFace: FH, color: C.text, bold: true,
      valign: "middle", margin: 0
    });
  });

  // Bottom warning banner
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 6.30, w: SW - 1.0, h: 0.65,
    fill: { color: C.red }, line: { color: C.red, width: 0 }, shadow: sh()
  });
  symbolCircle(slide, 0.75, 6.45, 0.36, "!", "FFFFFF");
  // give the inner symbol some contrast by using a darker red oval; redo
  // (overwrite the previous oval with a transparent inner glyph)
  // We rendered a white circle with white "!" — fix by adding a red glyph:
  slide.addText("!", {
    x: 0.75, y: 6.45, w: 0.36, h: 0.36,
    fontSize: 18, fontFace: FH, color: C.red, bold: true,
    align: "center", valign: "middle", margin: 0
  });
  slide.addText("Missing any one item may block visibility.", {
    x: 1.30, y: 6.30, w: SW - 1.80, h: 0.65,
    fontSize: 15, fontFace: FH, color: "FFFFFF", bold: true,
    valign: "middle", margin: 0
  });
}

// ============== SLIDE 16 — Order Flow ===============================
{
  const slide = pres.addSlide();
  pageChrome(slide, 16);
  header(slide, "MODULE 16  ·  ORDERS",
    "Order Flow",
    "From a buyer’s tap on “Place Order” all the way to a Completed state in the Seller Store.");

  // LEFT — vertical 8-step flow
  const flow = [
    "Buyer App",
    "Place Order",
    "Seller Store",
    "Accept / Reject",
    "Confirm Order",
    "Fulfillment",
    "Delivery",
    "Completed"
  ];
  const fx = 0.5;
  const fw = 7.0;
  const fy0 = 1.85;
  const fStep = 0.63;

  // spine
  slide.addShape(pres.shapes.RECTANGLE, {
    x: fx + 0.38, y: fy0 + 0.35, w: 0.04, h: fStep * (flow.length - 1),
    fill: { color: C.ice }, line: { color: C.ice, width: 0 }
  });

  flow.forEach((f, i) => {
    const y = fy0 + i * fStep;
    const isLast = i === flow.length - 1;
    const color = isLast ? C.green : (i === 0 ? C.navy : C.steel);
    numCircle(slide, fx + 0.20, y + 0.05, 0.45, i + 1, { bg: color, fontSize: 13 });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: fx + 0.85, y, w: fw - 1.0, h: 0.55, rectRadius: 0.10,
      fill: { color: isLast ? "D7F0E6" : C.surface },
      line: { color: isLast ? C.green : C.border, width: 0.75 },
      shadow: sh()
    });
    slide.addText(f, {
      x: fx + 1.10, y, w: fw - 1.30, h: 0.55,
      fontSize: 14, fontFace: FH, color: isLast ? C.green : C.text,
      bold: true, valign: "middle", margin: 0
    });
  });

  // RIGHT — Seller Actions
  const sx = 8.10, sw = 4.70;
  const sy = 1.85, slh = 5.10;
  card(slide, sx, sy, sw, slh, { accent: C.coral });
  slide.addText("SELLER ACTIONS", {
    x: sx + 0.40, y: sy + 0.25, w: sw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.coral, bold: true, charSpacing: 5, margin: 0
  });
  slide.addText("What sellers can do throughout the order lifecycle:", {
    x: sx + 0.40, y: sy + 0.55, w: sw - 0.80, h: 0.40,
    fontSize: 11, fontFace: FB, color: C.muted, italic: true, margin: 0
  });

  const actions = [
    { k: "Single Order Confirmation", note: "Confirm orders one at a time." },
    { k: "Bulk Order Confirmation",   note: "Confirm many orders in a single action." },
    { k: "Order Cancellation",        note: "Cancel unfulfillable orders before dispatch." },
    { k: "Excel Download",            note: "Download orders for offline reconciliation." }
  ];
  actions.forEach((a, i) => {
    const ay = sy + 1.05 + i * 0.95;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: sx + 0.40, y: ay, w: 0.08, h: 0.80,
      fill: { color: C.coral }, line: { color: C.coral, width: 0 }
    });
    slide.addText(a.k, {
      x: sx + 0.60, y: ay, w: sw - 1.00, h: 0.36,
      fontSize: 13, fontFace: FH, color: C.text, bold: true, margin: 0
    });
    slide.addText(a.note, {
      x: sx + 0.60, y: ay + 0.36, w: sw - 1.00, h: 0.44,
      fontSize: 10, fontFace: FB, color: C.muted, italic: true, margin: 0
    });
  });
}

// ============== SLIDE 17 — Logistics Workflow =======================
{
  const slide = pres.addSlide();
  pageChrome(slide, 17);
  header(slide, "MODULE 17  ·  LOGISTICS",
    "Logistics Workflow",
    "Two delivery paths for sellers — own fleet, or hand off to the logistics platform.");

  // LEFT — Option 1: Self Delivery
  const lx = 0.5, lw = 5.90, ly = 1.85, lh = 5.10;
  card(slide, lx, ly, lw, lh, { accent: C.navy });
  slide.addText("OPTION 1", {
    x: lx + 0.40, y: ly + 0.25, w: lw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.navy, bold: true, charSpacing: 6, margin: 0
  });
  slide.addText("Self Delivery", {
    x: lx + 0.40, y: ly + 0.58, w: lw - 0.80, h: 0.60,
    fontSize: 30, fontFace: FH, color: C.text, bold: true, margin: 0
  });
  slide.addText(
    "Seller handles the entire last-mile using their own staff or vehicles.",
    {
      x: lx + 0.40, y: ly + 1.20, w: lw - 0.80, h: 0.60,
      fontSize: 13, fontFace: FB, color: C.muted, italic: true, margin: 0
    }
  );

  // Center diagram: seller → buyer
  const tx = lx + 0.40, ty = ly + 2.05;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: tx, y: ty, w: lw - 0.80, h: 2.40,
    fill: { color: C.cardAlt }, line: { color: C.cardAlt, width: 0 }
  });
  // Seller circle
  slide.addShape(pres.shapes.OVAL, {
    x: tx + 0.50, y: ty + 0.55, w: 1.20, h: 1.20,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }
  });
  slide.addText("Seller", {
    x: tx + 0.50, y: ty + 0.55, w: 1.20, h: 1.20,
    fontSize: 16, fontFace: FH, color: "FFFFFF", bold: true,
    align: "center", valign: "middle", margin: 0
  });
  slide.addText("Own staff / vehicles", {
    x: tx + 0.20, y: ty + 1.80, w: 1.80, h: 0.32,
    fontSize: 10, fontFace: FB, color: C.muted, italic: true,
    align: "center", margin: 0
  });
  // arrow
  slide.addShape(pres.shapes.RIGHT_ARROW, {
    x: tx + 1.95, y: ty + 1.05, w: lw - 0.80 - 3.30, h: 0.20,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("direct delivery", {
    x: tx + 1.95, y: ty + 1.30, w: lw - 0.80 - 3.30, h: 0.30,
    fontSize: 10, fontFace: FB, color: C.muted, italic: true,
    align: "center", margin: 0
  });
  // Buyer circle
  slide.addShape(pres.shapes.OVAL, {
    x: tx + (lw - 0.80) - 1.70, y: ty + 0.55, w: 1.20, h: 1.20,
    fill: { color: C.green }, line: { color: C.green, width: 0 }
  });
  slide.addText("Buyer", {
    x: tx + (lw - 0.80) - 1.70, y: ty + 0.55, w: 1.20, h: 1.20,
    fontSize: 16, fontFace: FH, color: "FFFFFF", bold: true,
    align: "center", valign: "middle", margin: 0
  });
  slide.addText("Retailer", {
    x: tx + (lw - 0.80) - 2.00, y: ty + 1.80, w: 1.80, h: 0.32,
    fontSize: 10, fontFace: FB, color: C.muted, italic: true,
    align: "center", margin: 0
  });

  // RIGHT — Option 2: Logistics platform with 5-step flow
  const rx = 6.65, rw = 6.20;
  card(slide, rx, ly, rw, lh, { accent: C.coral });
  slide.addText("OPTION 2", {
    x: rx + 0.40, y: ly + 0.25, w: rw - 0.80, h: 0.28,
    fontSize: 10, fontFace: FH, color: C.coral, bold: true, charSpacing: 6, margin: 0
  });
  slide.addText("Move to Logistics Platform", {
    x: rx + 0.40, y: ly + 0.58, w: rw - 0.80, h: 0.60,
    fontSize: 26, fontFace: FH, color: C.text, bold: true, margin: 0
  });
  slide.addText(
    "Hand off the order to an integrated transport partner with end-to-end tracking.",
    {
      x: rx + 0.40, y: ly + 1.20, w: rw - 0.80, h: 0.60,
      fontSize: 13, fontFace: FB, color: C.muted, italic: true, margin: 0
    }
  );

  // 5-step flow
  const lo = [
    "Seller Store",
    "Logistics Connector",
    "Transport Partner",
    "Delivery Tracking",
    "Delivered"
  ];
  const loY0 = ly + 1.85;
  const loStep = 0.55;
  // spine
  slide.addShape(pres.shapes.RECTANGLE, {
    x: rx + 0.62, y: loY0 + 0.27, w: 0.04, h: loStep * (lo.length - 1),
    fill: { color: "FFE9D2" }, line: { color: "FFE9D2", width: 0 }
  });
  lo.forEach((l, i) => {
    const y = loY0 + i * loStep;
    const isLast = i === lo.length - 1;
    const color = isLast ? C.green : C.coral;
    numCircle(slide, rx + 0.45, y + 0.02, 0.40, i + 1, { bg: color, fontSize: 12 });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rx + 1.00, y, w: rw - 1.40, h: 0.45, rectRadius: 0.08,
      fill: { color: isLast ? "D7F0E6" : C.surface },
      line: { color: isLast ? C.green : C.border, width: 0.75 }
    });
    slide.addText(l, {
      x: rx + 1.20, y, w: rw - 1.80, h: 0.45,
      fontSize: 13, fontFace: FH, color: isLast ? C.green : C.text,
      bold: true, valign: "middle", margin: 0
    });
  });
}

// ============== SLIDE 18 — Troubleshooting Guide ====================
{
  const slide = pres.addSlide();
  pageChrome(slide, 18);
  header(slide, "MODULE 18  ·  SUPPORT",
    "Troubleshooting Guide",
    "Three of the most common production tickets — and the first thing to check for each.");

  const issues = [
    {
      issue: "Products not visible",
      color: C.coral,
      checks: ["Catalog Sync", "ONDC Connector", "Company Mapping"],
      escalate: "Validate end-to-end in Buyer App and re-run Sync."
    },
    {
      issue: "Retailers not visible",
      color: C.steel,
      checks: ["Polygon Upload", "Serviceability Setup"],
      escalate: "Re-validate polygon coordinates and re-upload."
    },
    {
      issue: "Seller cannot login",
      color: C.red,
      checks: ["Mobile Number", "OTP Service"],
      escalate: "Check Auth service logs and resend OTP."
    }
  ];

  const tY = 1.75;
  const tH = 5.25;
  const tGap = 0.30;
  const tW = (SW - 1.0 - tGap * 2) / 3;
  let tx = 0.5;
  issues.forEach((it, idx) => {
    // card
    slide.addShape(pres.shapes.RECTANGLE, {
      x: tx, y: tY, w: tW, h: tH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
    });
    // header band
    slide.addShape(pres.shapes.RECTANGLE, {
      x: tx, y: tY, w: tW, h: 1.30,
      fill: { color: it.color }, line: { color: it.color, width: 0 }
    });
    slide.addText("ISSUE " + String(idx + 1).padStart(2, "0"), {
      x: tx + 0.30, y: tY + 0.20, w: tW - 0.60, h: 0.30,
      fontSize: 10, fontFace: FH, color: "FFFFFF", bold: true,
      charSpacing: 6, margin: 0
    });
    slide.addText(it.issue, {
      x: tx + 0.30, y: tY + 0.55, w: tW - 0.60, h: 0.65,
      fontSize: 22, fontFace: FH, color: "FFFFFF", bold: true, margin: 0
    });
    // CHECK list
    slide.addText("FIRST, CHECK:", {
      x: tx + 0.30, y: tY + 1.55, w: tW - 0.60, h: 0.28,
      fontSize: 10, fontFace: FH, color: it.color, bold: true, charSpacing: 5, margin: 0
    });
    it.checks.forEach((c, ci) => {
      const cy = tY + 1.95 + ci * 0.80;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: tx + 0.30, y: cy, w: tW - 0.60, h: 0.62, rectRadius: 0.10,
        fill: { color: C.cardAlt }, line: { color: C.border, width: 0.75 }
      });
      numCircle(slide, tx + 0.45, cy + 0.12, 0.38, ci + 1, { bg: it.color, fontSize: 12 });
      slide.addText(c, {
        x: tx + 1.00, y: cy, w: tW - 1.20, h: 0.62,
        fontSize: 14, fontFace: FH, color: C.text, bold: true,
        valign: "middle", margin: 0
      });
    });

    // Escalation footer — uniform across all 3 cards, sits below the 3rd check item
    const efY = tY + tH - 0.85;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: tx + 0.30, y: efY - 0.08, w: tW - 0.60, h: 0.02,
      fill: { color: C.border }, line: { color: C.border, width: 0 }
    });
    slide.addText("IF STILL UNRESOLVED", {
      x: tx + 0.30, y: efY, w: tW - 0.60, h: 0.24,
      fontSize: 9, fontFace: FH, color: it.color, bold: true,
      charSpacing: 5, margin: 0
    });
    slide.addText(it.escalate, {
      x: tx + 0.30, y: efY + 0.26, w: tW - 0.60, h: 0.50,
      fontSize: 11, fontFace: FB, color: C.muted, italic: true, margin: 0
    });

    tx += tW + tGap;
  });
}

// ============== SLIDE 19 — Go Live Checklist ========================
{
  const slide = pres.addSlide();
  pageChrome(slide, 19);
  header(slide, "MODULE 19  ·  GO LIVE",
    "Go Live Checklist",
    "Tick every box before declaring a seller live. This is the final gate.");

  const items = [
    "Company Created",
    "Brand Created",
    "Seller Created",
    "Company Mapping",
    "Brand Mapping",
    "ONDC Connector Added",
    "Polygon Uploaded",
    "SKU Uploaded",
    "Images Uploaded",
    "Pricing Uploaded",
    "Inventory Updated",
    "Catalog Sync Completed",
    "Buyer App Validation Completed"
  ];

  // 13 items rendered as 5 + 5 + 3 (bottom row centered).
  const gx = 0.5;
  const gy = 1.95;
  const gw = SW - 1.0;
  const gridGap = 0.18;
  const cols = 5;
  const rows = 3;
  const cellW = (gw - gridGap * (cols - 1)) / cols;
  const cellH = (4.20 - gridGap * (rows - 1)) / rows;

  const rowCount = (rowIdx) => (rowIdx < 2 ? 5 : 3);
  const rowStartX = (rowIdx) => {
    const n = rowCount(rowIdx);
    const rowWidth = n * cellW + (n - 1) * gridGap;
    return (SW - rowWidth) / 2; // center
  };

  items.forEach((t, i) => {
    let row, col;
    if (i < 5)        { row = 0; col = i; }
    else if (i < 10)  { row = 1; col = i - 5; }
    else              { row = 2; col = i - 10; }
    const x = rowStartX(row) + col * (cellW + gridGap);
    const y = gy + row * (cellH + gridGap);

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cellW, h: cellH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 }, shadow: sh()
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h: cellH,
      fill: { color: C.green }, line: { color: C.green, width: 0 }
    });
    symbolCircle(slide, x + 0.18, y + cellH / 2 - 0.20, 0.40, "✓", C.green);
    slide.addText(t, {
      x: x + 0.70, y: y + 0.10, w: cellW - 0.85, h: cellH - 0.20,
      fontSize: 12, fontFace: FH, color: C.text, bold: true,
      valign: "middle", margin: 0
    });
    // step number tag top-right
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: x + cellW - 0.55, y: y + 0.04, w: 0.45, h: 0.26,
      fontSize: 9, fontFace: FH, color: C.muted, bold: true,
      align: "right", margin: 0
    });
  });

  // Footer celebratory banner spanning the bottom
  const bY = 6.30;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: bY, w: SW - 1.0, h: 0.65,
    fill: { color: C.green }, line: { color: C.green, width: 0 }, shadow: sh()
  });
  slide.addText("ALL GREEN → READY TO GO LIVE", {
    x: 0.75, y: bY, w: SW - 1.5, h: 0.65,
    fontSize: 16, fontFace: FH, color: "FFFFFF", bold: true,
    charSpacing: 6, align: "center", valign: "middle", margin: 0
  });
}

// ============== SLIDE 20 — Key Takeaways ============================
// (Built without pageChrome; navy background uses bespoke header/footer.)
{
  const slide = pres.addSlide();
  slide.background = { color: C.navy };

  // decorative background shapes
  slide.addShape(pres.shapes.OVAL, {
    x: -3, y: -3, w: 6, h: 6,
    fill: { color: C.navySoft, transparency: 30 }, line: { color: C.navySoft, width: 0 }
  });
  slide.addShape(pres.shapes.OVAL, {
    x: SW - 4, y: SH - 4, w: 9, h: 9,
    fill: { color: C.steel, transparency: 60 }, line: { color: C.steel, width: 0 }
  });

  // Eyebrow (orange)
  slide.addText("MODULE 20  ·  TAKEAWAYS", {
    x: 0.5, y: 0.40, w: 10, h: 0.30,
    fontSize: 11, fontFace: FH, color: C.amber, bold: true, charSpacing: 6, margin: 0
  });
  // page indicator (light blue on navy, top-right)
  slide.addText("20 / 20", {
    x: SW - 1.6, y: 0.40, w: 1.1, h: 0.30,
    fontSize: 11, fontFace: FB, color: C.ice, align: "right", margin: 0
  });

  // Title
  slide.addText("Key Takeaways", {
    x: 0.5, y: 0.75, w: 12.3, h: 0.80,
    fontSize: 36, fontFace: FH, color: "FFFFFF", bold: true, margin: 0
  });
  slide.addText("Remember the Golden Rule — follow this dependency chain and the rest falls into place.", {
    x: 0.5, y: 1.55, w: 12.3, h: 0.40,
    fontSize: 14, fontFace: FB, color: C.ice, italic: true, margin: 0
  });

  // Golden Rule chain — 3 rows of 3 chips for visual symmetry
  const chain = [
    "Company", "Brand", "Seller",
    "Mapping", "ONDC Connector", "Serviceability",
    "SKU Upload", "Catalog Sync", "Buyer App Visibility"
  ];

  const renderRow = (arr, y) => {
    const gap = 0.20;
    const arrowW = 0.45;
    const innerGap = arr.length - 1;
    const totalArrows = innerGap;
    const totalGaps = totalArrows * (gap * 2 + arrowW);
    const usable = SW - 1.0 - totalGaps;
    const chipW = usable / arr.length;
    let x = 0.5;
    arr.forEach((t, i) => {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: chipW, h: 0.78, rectRadius: 0.12,
        fill: { color: C.surface }, line: { color: C.surface, width: 0 }, shadow: sh()
      });
      // accent left band
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 0.78,
        fill: { color: C.coral }, line: { color: C.coral, width: 0 }
      });
      slide.addText(t, {
        x: x + 0.20, y, w: chipW - 0.30, h: 0.78,
        fontSize: 15, fontFace: FH, color: C.navy, bold: true,
        align: "center", valign: "middle", margin: 0
      });
      x += chipW;
      if (i < arr.length - 1) {
        x += gap;
        slide.addShape(pres.shapes.RIGHT_ARROW, {
          x, y: y + 0.28, w: arrowW, h: 0.22,
          fill: { color: C.amber }, line: { color: C.amber, width: 0 }
        });
        x += arrowW + gap;
      }
    });
  };

  renderRow(chain.slice(0, 3), 2.10);
  renderRow(chain.slice(3, 6), 3.05);
  renderRow(chain.slice(6, 9), 4.00);

  // Big quote / message
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 5.15, w: SW - 1.0, h: 1.65,
    fill: { color: C.navySoft }, line: { color: C.navySoft, width: 0 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 5.15, w: 0.10, h: 1.65,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("THE GOLDEN RULE", {
    x: 0.80, y: 5.25, w: 6, h: 0.30,
    fontSize: 11, fontFace: FH, color: C.amber, bold: true, charSpacing: 6, margin: 0
  });
  slide.addText("This dependency chain drives the entire Seller Store ecosystem.", {
    x: 0.80, y: 5.55, w: SW - 1.6, h: 0.45,
    fontSize: 20, fontFace: FH, color: "FFFFFF", bold: true, margin: 0
  });
  slide.addText(
    "Following this sequence eliminates most onboarding and product visibility issues.",
    {
      x: 0.80, y: 6.10, w: SW - 1.6, h: 0.55,
      fontSize: 13, fontFace: FB, color: C.ice, italic: true, margin: 0
    }
  );

  // Closing footer (custom — no pageChrome)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 6.95, w: SW - 1.0, h: 0.04,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
  slide.addText("THANK YOU", {
    x: 0.5, y: 7.05, w: 6, h: 0.30,
    fontSize: 11, fontFace: FH, color: C.amber, bold: true, charSpacing: 8, margin: 0
  });
  slide.addText("Qwipo Seller Store  ·  Internal Training Guide  ·  v1.0", {
    x: SW - 6.5, y: 7.05, w: 6, h: 0.30,
    fontSize: 11, fontFace: FB, color: C.ice, align: "right", italic: true, margin: 0
  });
  // bottom accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: SH - 0.05, w: SW, h: 0.05,
    fill: { color: C.coral }, line: { color: C.coral, width: 0 }
  });
}

// ============================ WRITE FILE ============================
pres.writeFile({ fileName: "Qwipo-Seller-Store-Training-Guide.pptx" })
  .then(name => console.log("Wrote:", name))
  .catch(err => { console.error(err); process.exit(1); });
