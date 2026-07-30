// Build deck: Product & Price Sync Workflow – Current State Understanding
// Discussion with Venkat Manohar | 1 June 2026

const path = require("path");
const globalNodeModules = "C:\\Users\\Lenovo\\AppData\\Roaming\\npm\\node_modules";
require("module").Module._nodeModulePaths = (function (orig) {
  return function (from) {
    const paths = orig.call(this, from);
    paths.push(globalNodeModules);
    return paths;
  };
})(require("module").Module._nodeModulePaths);

const pptxgen = require(path.join(globalNodeModules, "pptxgenjs"));
const React = require(path.join(globalNodeModules, "react"));
const ReactDOMServer = require(path.join(globalNodeModules, "react-dom/server"));
const sharp = require(path.join(globalNodeModules, "sharp"));
const FA = require(path.join(globalNodeModules, "react-icons/fa"));

// Palette - Deep Ocean / Executive
const C = {
  bgDark: "0F2A47",      // primary deep navy
  bgDeepest: "0A1F36",   // even deeper for title
  teal: "1C7293",        // mid teal
  tealLight: "5DA9C4",   // light teal accent
  cream: "F4F7FA",       // page bg
  card: "FFFFFF",
  border: "E2E8F0",
  text: "1E293B",        // dark slate
  muted: "64748B",       // muted gray
  amber: "E08A1F",       // warning/highlight
  amberSoft: "FEF3E2",   // warning bg
  green: "0F9D7B",       // future/positive
  greenSoft: "E6F6F1",
  red: "C0392B",         // risk
  redSoft: "FBEDEA",
  white: "FFFFFF",
};

const makeShadow = () => ({
  type: "outer", blur: 8, offset: 2, angle: 90,
  color: "000000", opacity: 0.08,
});

function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconPng(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
  pres.title = "Product & Price Sync Workflow – Current State Understanding";
  pres.author = "Omkar Charankar";

  const W = 13.3, H = 7.5;

  // Pre-render icons used across slides
  const ic = {
    sellerPortal: await iconPng(FA.FaStore, "#" + C.white, 256),
    partnerPortal: await iconPng(FA.FaExchangeAlt, "#" + C.white, 256),
    ondc: await iconPng(FA.FaNetworkWired, "#" + C.white, 256),
    buyerApp: await iconPng(FA.FaMobileAlt, "#" + C.white, 256),
    arrowDown: await iconPng(FA.FaArrowDown, "#" + C.tealLight, 256),
    arrowRight: await iconPng(FA.FaArrowRight, "#" + C.tealLight, 256),
    clock: await iconPng(FA.FaClock, "#" + C.amber, 256),
    cart: await iconPng(FA.FaShoppingCart, "#" + C.green, 256),
    warn: await iconPng(FA.FaExclamationTriangle, "#" + C.amber, 256),
    bolt: await iconPng(FA.FaBolt, "#" + C.green, 256),
    check: await iconPng(FA.FaCheckCircle, "#" + C.green, 256),
    cross: await iconPng(FA.FaTimesCircle, "#" + C.red, 256),
    sync: await iconPng(FA.FaSyncAlt, "#" + C.teal, 256),
    gear: await iconPng(FA.FaCog, "#" + C.teal, 256),
    chart: await iconPng(FA.FaChartLine, "#" + C.teal, 256),
    db: await iconPng(FA.FaDatabase, "#" + C.teal, 256),
    eye: await iconPng(FA.FaEye, "#" + C.teal, 256),
    layers: await iconPng(FA.FaLayerGroup, "#" + C.teal, 256),
    info: await iconPng(FA.FaInfoCircle, "#" + C.tealLight, 256),
    target: await iconPng(FA.FaBullseye, "#" + C.amber, 256),
    forward: await iconPng(FA.FaRocket, "#" + C.green, 256),
    handshake: await iconPng(FA.FaHandshake, "#" + C.amber, 256),
  };

  // ---------- Helpers ----------
  function addPageFrame(slide, pageNum, total) {
    // Background
    slide.background = { color: C.cream };

    // Top accent bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: W, h: 0.18,
      fill: { color: C.bgDark }, line: { color: C.bgDark, width: 0 },
    });

    // Footer text
    slide.addText("Product & Price Sync Workflow  |  Discussion with Venkat Manohar  |  1 June 2026", {
      x: 0.5, y: H - 0.4, w: 10, h: 0.3,
      fontSize: 9, fontFace: "Calibri", color: C.muted, align: "left", margin: 0,
    });
    slide.addText(`${pageNum} / ${total}`, {
      x: W - 1.0, y: H - 0.4, w: 0.5, h: 0.3,
      fontSize: 9, fontFace: "Calibri", color: C.muted, align: "right", margin: 0,
    });
  }

  function addSlideTitle(slide, title, eyebrow) {
    // Eyebrow / section label
    if (eyebrow) {
      slide.addText(eyebrow.toUpperCase(), {
        x: 0.5, y: 0.45, w: 12, h: 0.3,
        fontSize: 11, fontFace: "Calibri", color: C.teal,
        bold: true, charSpacing: 4, margin: 0,
      });
    }
    slide.addText(title, {
      x: 0.5, y: eyebrow ? 0.78 : 0.55, w: 12.3, h: 0.8,
      fontSize: 30, fontFace: "Georgia", color: C.bgDark,
      bold: true, margin: 0,
    });
  }

  function addCard(slide, x, y, w, h, fill = C.card) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h,
      fill: { color: fill },
      line: { color: C.border, width: 0.75 },
      shadow: makeShadow(),
    });
  }

  function addAccentStripe(slide, x, y, h, color) {
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h,
      fill: { color }, line: { color, width: 0 },
    });
  }

  const TOTAL = 12;
  let page = 0;

  // ============================================================
  // SLIDE 1 — Title
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    s.background = { color: C.bgDeepest };

    // Decorative diagonal accents
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: W, h: 0.25,
      fill: { color: C.teal }, line: { color: C.teal, width: 0 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: H - 0.25, w: W, h: 0.25,
      fill: { color: C.teal }, line: { color: C.teal, width: 0 },
    });

    // Faint circular motif
    s.addShape(pres.shapes.OVAL, {
      x: W - 4.5, y: -2, w: 6, h: 6,
      fill: { color: C.teal, transparency: 75 },
      line: { color: C.teal, width: 0 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: -2, y: H - 3, w: 5, h: 5,
      fill: { color: C.teal, transparency: 80 },
      line: { color: C.teal, width: 0 },
    });

    // Eyebrow
    s.addText("INTERNAL DISCUSSION NOTE", {
      x: 0.8, y: 1.5, w: 10, h: 0.4,
      fontSize: 14, fontFace: "Calibri", color: C.tealLight,
      bold: true, charSpacing: 8, margin: 0,
    });

    // Title
    s.addText("Product & Price Sync Workflow", {
      x: 0.8, y: 2.0, w: 11.5, h: 1.1,
      fontSize: 48, fontFace: "Georgia", color: C.white,
      bold: true, margin: 0,
    });
    s.addText("Current State Understanding", {
      x: 0.8, y: 3.1, w: 11.5, h: 0.9,
      fontSize: 36, fontFace: "Georgia", color: C.tealLight,
      italic: true, margin: 0,
    });

    // Divider line
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.85, y: 4.3, w: 1.5, h: 0.06,
      fill: { color: C.tealLight }, line: { color: C.tealLight, width: 0 },
    });

    // Meta block
    s.addText([
      { text: "Discussion with  ", options: { color: "C9D6E2", fontSize: 16 } },
      { text: "Venkat Manohar", options: { color: C.white, fontSize: 16, bold: true, breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "Date  ", options: { color: "C9D6E2", fontSize: 16 } },
      { text: "1 June 2026", options: { color: C.white, fontSize: 16, bold: true, breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "Prepared by  ", options: { color: "C9D6E2", fontSize: 16 } },
      { text: "Omkar Charankar", options: { color: C.white, fontSize: 16, bold: true } },
    ], {
      x: 0.85, y: 4.55, w: 8, h: 2,
      fontFace: "Calibri", valign: "top", margin: 0,
    });

    // Right side: badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: W - 4.3, y: 5.4, w: 3.4, h: 1.1,
      fill: { color: C.teal },
      line: { color: C.teal, width: 0 },
      rectRadius: 0.1,
    });
    s.addText("CURRENT  STATE", {
      x: W - 4.3, y: 5.45, w: 3.4, h: 0.4,
      fontSize: 11, fontFace: "Calibri", color: C.tealLight,
      bold: true, align: "center", charSpacing: 6, margin: 0,
    });
    s.addText("Seller Portal → ONDC → Buyer App", {
      x: W - 4.3, y: 5.85, w: 3.4, h: 0.6,
      fontSize: 16, fontFace: "Georgia", color: C.white,
      bold: true, align: "center", margin: 0,
    });
  }

  // ============================================================
  // SLIDE 2 — Objective
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Objective of Discussion", "01  ·  Context");

    // Left: large quote / objective card
    addCard(s, 0.5, 1.9, 7.5, 4.7);
    addAccentStripe(s, 0.5, 1.9, 4.7, C.teal);

    s.addImage({ data: ic.target, x: 0.85, y: 2.15, w: 0.55, h: 0.55 });
    s.addText("Why this discussion happened", {
      x: 1.55, y: 2.15, w: 6, h: 0.5,
      fontSize: 18, fontFace: "Calibri", color: C.bgDark, bold: true, margin: 0,
    });

    s.addText(
      "A price updated in the Seller Portal was not immediately reflected in the Seller Partner Portal and the Buyer Application — even after clicking the “Sync” option.",
      {
        x: 0.85, y: 2.85, w: 6.9, h: 1.4,
        fontSize: 16, fontFace: "Calibri", color: C.text, margin: 0,
        paraSpaceAfter: 6,
      }
    );

    s.addText("Venkat explained:", {
      x: 0.85, y: 4.45, w: 6.9, h: 0.35,
      fontSize: 13, fontFace: "Calibri", color: C.muted, bold: true, margin: 0,
    });

    s.addText([
      { text: "Current architecture", options: { bullet: true, breakLine: true } },
      { text: "Existing data flow between systems", options: { bullet: true, breakLine: true } },
      { text: "Known limitations", options: { bullet: true, breakLine: true } },
      { text: "The reason for the observed behavior", options: { bullet: true } },
    ], {
      x: 1.0, y: 4.8, w: 6.5, h: 1.8,
      fontSize: 14, fontFace: "Calibri", color: C.text, margin: 0,
      paraSpaceAfter: 4,
    });

    // Right: highlight callout
    addCard(s, 8.4, 1.9, 4.4, 4.7, C.bgDark);
    s.addImage({ data: ic.info, x: 8.75, y: 2.2, w: 0.5, h: 0.5 });
    s.addText("KEY QUESTION", {
      x: 9.4, y: 2.25, w: 3.2, h: 0.4,
      fontSize: 11, fontFace: "Calibri", color: C.tealLight,
      bold: true, charSpacing: 4, margin: 0,
    });

    s.addText(
      "“Why does ‘Sync’ in the Partner Portal not bring in the latest price from the Seller Portal?”",
      {
        x: 8.75, y: 2.9, w: 3.8, h: 2.3,
        fontSize: 18, fontFace: "Georgia", color: C.white,
        italic: true, margin: 0,
      }
    );

    s.addShape(pres.shapes.RECTANGLE, {
      x: 8.75, y: 5.3, w: 0.7, h: 0.04,
      fill: { color: C.tealLight }, line: { color: C.tealLight, width: 0 },
    });
    s.addText("Answer follows in the rest of the deck.", {
      x: 8.75, y: 5.45, w: 3.8, h: 0.9,
      fontSize: 12, fontFace: "Calibri", color: "C9D6E2", italic: true, margin: 0,
    });
  }

  // ============================================================
  // SLIDE 3 — System Architecture
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Current System Architecture", "02  ·  The Four Entities");

    // Subtitle
    s.addText("The ecosystem currently consists of four major entities, linked in a linear data flow:", {
      x: 0.5, y: 1.65, w: 12.3, h: 0.35,
      fontSize: 13, fontFace: "Calibri", color: C.muted, italic: true, margin: 0,
    });

    // 4 cards in a row with arrows between
    const cardY = 2.4;
    const cardH = 3.0;
    const cardW = 2.65;
    const gap = 0.45;
    const startX = 0.5;
    const entities = [
      {
        title: "Seller Portal",
        role: "Source of Truth",
        icon: ic.sellerPortal,
        bullets: ["Products", "Pricing", "Inventory", "Images & attributes"],
        color: C.bgDark,
      },
      {
        title: "Seller Partner Portal",
        role: "Intermediary Layer",
        icon: ic.partnerPortal,
        bullets: ["Stores a copy of Seller data", "Used for ONDC integrations"],
        color: C.teal,
      },
      {
        title: "ONDC Network",
        role: "Catalog Distributor",
        icon: ic.ondc,
        bullets: ["Consumes catalog from", "the Partner Portal"],
        color: C.teal,
      },
      {
        title: "Buyer Application",
        role: "End Consumer",
        icon: ic.buyerApp,
        bullets: ["Displays products to buyers", "Receives catalog via ONDC"],
        color: C.bgDark,
      },
    ];

    entities.forEach((e, i) => {
      const x = startX + i * (cardW + gap);
      // Card
      addCard(s, x, cardY, cardW, cardH);
      // Top header (colored)
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: cardY, w: cardW, h: 1.05,
        fill: { color: e.color }, line: { color: e.color, width: 0 },
      });
      // Icon
      s.addImage({ data: e.icon, x: x + cardW / 2 - 0.3, y: cardY + 0.2, w: 0.6, h: 0.6 });
      // Step number
      s.addText(`STEP ${i + 1}`, {
        x, y: cardY + 0.78, w: cardW, h: 0.3,
        fontSize: 10, fontFace: "Calibri", color: "C9D6E2",
        bold: true, align: "center", charSpacing: 4, margin: 0,
      });
      // Title
      s.addText(e.title, {
        x: x + 0.15, y: cardY + 1.2, w: cardW - 0.3, h: 0.45,
        fontSize: 17, fontFace: "Georgia", color: C.bgDark,
        bold: true, align: "center", margin: 0,
      });
      // Role
      s.addText(e.role, {
        x: x + 0.15, y: cardY + 1.65, w: cardW - 0.3, h: 0.3,
        fontSize: 11, fontFace: "Calibri", color: C.teal,
        italic: true, align: "center", margin: 0,
      });

      // Bullets
      const bulletItems = e.bullets.map((b, idx) => ({
        text: b,
        options: { bullet: true, breakLine: idx < e.bullets.length - 1 },
      }));
      s.addText(bulletItems, {
        x: x + 0.25, y: cardY + 2.05, w: cardW - 0.4, h: 0.9,
        fontSize: 11, fontFace: "Calibri", color: C.text, margin: 0,
        paraSpaceAfter: 2,
      });

      // Arrow between cards
      if (i < entities.length - 1) {
        const ax = x + cardW + 0.05;
        s.addImage({ data: ic.arrowRight, x: ax, y: cardY + cardH / 2 - 0.18, w: 0.35, h: 0.35 });
      }
    });

    // Bottom callout
    addCard(s, 0.5, 5.65, 12.3, 1.15, C.amberSoft);
    addAccentStripe(s, 0.5, 5.65, 1.15, C.amber);
    s.addImage({ data: ic.info, x: 0.78, y: 5.95, w: 0.45, h: 0.45 });
    s.addText("WHY THE PARTNER PORTAL EXISTS", {
      x: 1.35, y: 5.78, w: 11, h: 0.3,
      fontSize: 10, fontFace: "Calibri", color: C.amber,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText(
      "ONDC integrations were originally built around the Partner Portal — that is why the system continues to route data through this intermediary layer instead of connecting Seller Portal directly to ONDC.",
      {
        x: 1.35, y: 6.05, w: 11.3, h: 0.7,
        fontSize: 12, fontFace: "Calibri", color: C.text, margin: 0,
      }
    );
  }

  // ============================================================
  // SLIDE 4 — How Sync Works Today (nightly batch)
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "How Product & Price Sync Works Today", "03  ·  Nightly Synchronization");

    // Left: 3 step cards (vertical)
    const stepX = 0.5;
    const stepW = 6.4;
    const steps = [
      {
        n: "1",
        title: "Seller Updates",
        body: "Seller makes changes in the Seller Portal: price, inventory, product / brand images, product attributes, company details.",
        icon: ic.gear,
      },
      {
        n: "2",
        title: "Fetch Process Runs",
        body: "Changes are NOT immediately pushed. A scheduled fetch process pulls data from the Seller Portal and stores updated records in the Partner Portal.",
        icon: ic.db,
      },
      {
        n: "3",
        title: "Sync to ONDC → Buyer App",
        body: "Once data is in the Partner Portal, it is broadcast to ONDC, which propagates updates to Buyer Applications.",
        icon: ic.sync,
      },
    ];
    let y = 1.7;
    steps.forEach((st) => {
      addCard(s, stepX, y, stepW, 1.45);
      addAccentStripe(s, stepX, y, 1.45, C.teal);
      // Step number circle
      s.addShape(pres.shapes.OVAL, {
        x: stepX + 0.3, y: y + 0.3, w: 0.85, h: 0.85,
        fill: { color: C.bgDark }, line: { color: C.bgDark, width: 0 },
      });
      s.addText(st.n, {
        x: stepX + 0.3, y: y + 0.3, w: 0.85, h: 0.85,
        fontSize: 26, fontFace: "Georgia", color: C.white,
        bold: true, align: "center", valign: "middle", margin: 0,
      });
      s.addImage({ data: st.icon, x: stepX + 1.35, y: y + 0.2, w: 0.4, h: 0.4 });
      s.addText(st.title, {
        x: stepX + 1.85, y: y + 0.18, w: stepW - 2.0, h: 0.45,
        fontSize: 16, fontFace: "Calibri", color: C.bgDark, bold: true, margin: 0,
      });
      s.addText(st.body, {
        x: stepX + 1.35, y: y + 0.7, w: stepW - 1.55, h: 0.75,
        fontSize: 12, fontFace: "Calibri", color: C.text, margin: 0,
      });
      y += 1.6;
    });

    // Right: data flow diagram
    addCard(s, 7.3, 1.7, 5.5, 4.95, C.bgDark);
    s.addText("REQUIRED DATA FLOW", {
      x: 7.5, y: 1.9, w: 5.1, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.tealLight,
      bold: true, charSpacing: 4, align: "center", margin: 0,
    });
    s.addText("Before Sync can deliver fresh data", {
      x: 7.5, y: 2.2, w: 5.1, h: 0.35,
      fontSize: 13, fontFace: "Calibri", color: C.white,
      italic: true, align: "center", margin: 0,
    });

    const flowNodes = ["Seller Portal", "Fetch Process", "Partner Portal", "Sync", "ONDC", "Buyer App"];
    const flowY = 2.7;
    const nodeH = 0.4;
    const nodeGap = 0.22;
    flowNodes.forEach((n, i) => {
      const ny = flowY + i * (nodeH + nodeGap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 8.6, y: ny, w: 2.9, h: nodeH,
        fill: { color: C.teal }, line: { color: C.teal, width: 0 },
        rectRadius: 0.05,
      });
      s.addText(n, {
        x: 8.6, y: ny, w: 2.9, h: nodeH,
        fontSize: 12, fontFace: "Calibri", color: C.white,
        bold: true, align: "center", valign: "middle", margin: 0,
      });
      if (i < flowNodes.length - 1) {
        s.addImage({
          data: ic.arrowDown,
          x: 9.85, y: ny + nodeH - 0.02, w: 0.22, h: 0.22,
        });
      }
    });

    // Bottom warning strip
    addCard(s, 0.5, 6.45, 12.3, 0.55, C.amberSoft);
    addAccentStripe(s, 0.5, 6.45, 0.55, C.amber);
    s.addImage({ data: ic.warn, x: 0.78, y: 6.58, w: 0.32, h: 0.32 });
    s.addText(
      "Clicking “Sync” in the Partner Portal does NOT fetch new data from the Seller Portal — it only acts on data already present in the Partner Portal.",
      {
        x: 1.25, y: 6.5, w: 11.4, h: 0.5,
        fontSize: 12, fontFace: "Calibri", color: C.text,
        bold: true, valign: "middle", margin: 0,
      }
    );
  }

  // ============================================================
  // SLIDE 5 — Why Price Wasn't Updated
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Why the Price Was Not Updated in Partner Portal", "04  ·  Root Cause");

    // Left: scenario timeline
    addCard(s, 0.5, 1.7, 6.5, 5.0);
    addAccentStripe(s, 0.5, 1.7, 5.0, C.red);
    s.addImage({ data: ic.cross, x: 0.78, y: 1.95, w: 0.5, h: 0.5 });
    s.addText("OBSERVED SCENARIO", {
      x: 1.4, y: 1.95, w: 5, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.red,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText("What actually happened", {
      x: 1.4, y: 2.25, w: 5, h: 0.4,
      fontSize: 18, fontFace: "Calibri", color: C.bgDark, bold: true, margin: 0,
    });

    const events = [
      "Seller updated price in the Seller Portal.",
      "User clicked “Sync” in the Partner Portal.",
      "Partner Portal still displayed the old price.",
    ];
    events.forEach((e, i) => {
      const ey = 2.95 + i * 0.85;
      s.addShape(pres.shapes.OVAL, {
        x: 0.85, y: ey + 0.05, w: 0.4, h: 0.4,
        fill: { color: C.red }, line: { color: C.red, width: 0 },
      });
      s.addText(String(i + 1), {
        x: 0.85, y: ey + 0.05, w: 0.4, h: 0.4,
        fontSize: 13, fontFace: "Calibri", color: C.white,
        bold: true, align: "center", valign: "middle", margin: 0,
      });
      s.addText(e, {
        x: 1.45, y: ey, w: 5.3, h: 0.6,
        fontSize: 14, fontFace: "Calibri", color: C.text,
        valign: "middle", margin: 0,
      });
    });

    // Quote
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.85, y: 5.7, w: 0.06, h: 0.85,
      fill: { color: C.teal }, line: { color: C.teal, width: 0 },
    });
    s.addText(
      "“Sync does not retrieve new data from the Seller Portal. It only works on data already available in the Partner Portal.”",
      {
        x: 1.1, y: 5.7, w: 5.7, h: 0.85,
        fontSize: 12, fontFace: "Georgia", color: C.text,
        italic: true, margin: 0,
      }
    );
    s.addText("— Venkat Manohar", {
      x: 1.1, y: 6.3, w: 5.7, h: 0.25,
      fontSize: 10, fontFace: "Calibri", color: C.muted, margin: 0,
    });

    // Right: state comparison
    addCard(s, 7.3, 1.7, 5.5, 5.0);
    s.addText("STATE AT THE MOMENT OF SYNC", {
      x: 7.5, y: 1.9, w: 5.1, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.teal,
      bold: true, charSpacing: 4, align: "center", margin: 0,
    });
    s.addText("Where the new price lives — and where it doesn’t", {
      x: 7.5, y: 2.2, w: 5.1, h: 0.35,
      fontSize: 12, fontFace: "Calibri", color: C.muted,
      italic: true, align: "center", margin: 0,
    });

    const rows = [
      { sys: "Seller Portal", val: "NEW PRICE", ok: true },
      { sys: "Partner Portal", val: "OLD PRICE", ok: false },
      { sys: "Buyer App", val: "OLD PRICE", ok: false },
    ];
    rows.forEach((r, i) => {
      const ry = 2.85 + i * 0.95;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 7.5, y: ry, w: 5.1, h: 0.8,
        fill: { color: r.ok ? C.greenSoft : C.redSoft },
        line: { color: r.ok ? C.green : C.red, width: 0.5 },
      });
      s.addImage({
        data: r.ok ? ic.check : ic.cross,
        x: 7.7, y: ry + 0.2, w: 0.4, h: 0.4,
      });
      s.addText(r.sys, {
        x: 8.25, y: ry + 0.12, w: 2, h: 0.6,
        fontSize: 14, fontFace: "Calibri", color: C.text,
        bold: true, valign: "middle", margin: 0,
      });
      s.addText(r.val, {
        x: 10.3, y: ry + 0.12, w: 2.2, h: 0.6,
        fontSize: 14, fontFace: "Calibri",
        color: r.ok ? C.green : C.red,
        bold: true, align: "right", valign: "middle", margin: 0,
      });
    });

    s.addText(
      "Until the fetch process executes, Partner Portal and Buyer App will keep showing stale information — even after a Sync click.",
      {
        x: 7.5, y: 5.9, w: 5.1, h: 0.7,
        fontSize: 11, fontFace: "Calibri", color: C.muted,
        italic: true, align: "center", margin: 0,
      }
    );
  }

  // ============================================================
  // SLIDE 6 — Current Refresh Frequency
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Current Refresh Frequency", "05  ·  One Cycle Per Day");

    // Left: big stat
    addCard(s, 0.5, 1.7, 5.0, 5.0, C.bgDark);
    s.addImage({ data: ic.clock, x: 2.4, y: 1.95, w: 1.0, h: 1.0 });
    s.addText("ONCE", {
      x: 0.6, y: 3.05, w: 4.8, h: 1.4,
      fontSize: 72, fontFace: "Georgia", color: C.white,
      bold: true, align: "center", margin: 0,
    });
    s.addText("PER DAY", {
      x: 0.6, y: 4.4, w: 4.8, h: 0.45,
      fontSize: 22, fontFace: "Calibri", color: C.tealLight,
      bold: true, align: "center", charSpacing: 6, margin: 0,
    });
    s.addText(
      "Most catalog updates are refreshed only during the nightly processing cycle.",
      {
        x: 0.8, y: 5.0, w: 4.4, h: 1.5,
        fontSize: 13, fontFace: "Calibri", color: "C9D6E2",
        italic: true, align: "center", margin: 0,
      }
    );

    // Right: table — change types
    addCard(s, 5.8, 1.7, 7.0, 5.0);
    s.addText("Change types and whether they reflect immediately", {
      x: 6.0, y: 1.9, w: 6.6, h: 0.35,
      fontSize: 13, fontFace: "Calibri", color: C.muted, italic: true, margin: 0,
    });

    const changeTypes = [
      "Price Update",
      "Inventory Update",
      "Product Image Update",
      "Brand Image Update",
      "Product Attribute Update",
      "Company Information Update",
    ];
    // Header
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.0, y: 2.4, w: 6.6, h: 0.45,
      fill: { color: C.bgDark }, line: { color: C.bgDark, width: 0 },
    });
    s.addText("CHANGE TYPE", {
      x: 6.15, y: 2.4, w: 4.4, h: 0.45,
      fontSize: 11, fontFace: "Calibri", color: C.white,
      bold: true, valign: "middle", charSpacing: 3, margin: 0,
    });
    s.addText("IMMEDIATE REFLECTION", {
      x: 10.4, y: 2.4, w: 2.1, h: 0.45,
      fontSize: 11, fontFace: "Calibri", color: C.white,
      bold: true, align: "right", valign: "middle", charSpacing: 3, margin: 0,
    });
    changeTypes.forEach((ct, i) => {
      const ry = 2.85 + i * 0.55;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 6.0, y: ry, w: 6.6, h: 0.55,
        fill: { color: i % 2 === 0 ? C.cream : C.white },
        line: { color: C.border, width: 0.4 },
      });
      s.addText(ct, {
        x: 6.2, y: ry, w: 4.0, h: 0.55,
        fontSize: 13, fontFace: "Calibri", color: C.text,
        valign: "middle", margin: 0,
      });
      // "No" pill
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 11.4, y: ry + 0.12, w: 1.1, h: 0.32,
        fill: { color: C.redSoft }, line: { color: C.red, width: 0.5 },
        rectRadius: 0.05,
      });
      s.addText("NO", {
        x: 11.4, y: ry + 0.12, w: 1.1, h: 0.32,
        fontSize: 11, fontFace: "Calibri", color: C.red,
        bold: true, align: "center", valign: "middle", charSpacing: 3, margin: 0,
      });
    });

    s.addText(
      "All such changes generally wait until the next refresh cycle.",
      {
        x: 6.0, y: 6.2, w: 6.6, h: 0.35,
        fontSize: 12, fontFace: "Calibri", color: C.muted,
        italic: true, margin: 0,
      }
    );
  }

  // ============================================================
  // SLIDE 7 — Cart & Checkout Real-Time Validation
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Special Handling for Cart & Checkout", "06  ·  The Real-Time Exception");

    s.addText(
      "There is one important exception to the nightly model: the cart and checkout flow performs real-time validation against the Seller.",
      {
        x: 0.5, y: 1.65, w: 12.3, h: 0.5,
        fontSize: 13, fontFace: "Calibri", color: C.muted, italic: true, margin: 0,
      }
    );

    // Left: what cart validates
    addCard(s, 0.5, 2.25, 6.2, 4.5);
    addAccentStripe(s, 0.5, 2.25, 4.5, C.green);
    s.addImage({ data: ic.cart, x: 0.78, y: 2.5, w: 0.55, h: 0.55 });
    s.addText("WHAT THE CART CHECKS", {
      x: 1.45, y: 2.55, w: 4.5, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.green,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText("Real-time cart validation", {
      x: 1.45, y: 2.85, w: 4.5, h: 0.4,
      fontSize: 18, fontFace: "Calibri", color: C.bgDark, bold: true, margin: 0,
    });

    const checks = [
      "Is the SKU still active?",
      "Has the price changed?",
      "Has the SKU configuration changed?",
      "Has the case / pack configuration changed?",
    ];
    checks.forEach((c, i) => {
      const cy = 3.55 + i * 0.65;
      s.addImage({ data: ic.check, x: 0.85, y: cy + 0.05, w: 0.35, h: 0.35 });
      s.addText(c, {
        x: 1.35, y: cy, w: 5.0, h: 0.5,
        fontSize: 13, fontFace: "Calibri", color: C.text,
        valign: "middle", margin: 0,
      });
    });

    // Right: outcome — three rows showing divergence
    addCard(s, 6.9, 2.25, 5.9, 4.5);
    s.addText("OUTCOME WHEN CART VALIDATES", {
      x: 7.1, y: 2.45, w: 5.5, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.teal,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText("Latest Seller price wins — for items in the cart", {
      x: 7.1, y: 2.78, w: 5.5, h: 0.4,
      fontSize: 16, fontFace: "Calibri", color: C.bgDark, bold: true, margin: 0,
    });

    const cartRows = [
      { label: "Product Listing", value: "Old Price", color: C.red, bg: C.redSoft },
      { label: "Partner Portal", value: "Old Price", color: C.red, bg: C.redSoft },
      { label: "Cart Calculation", value: "Latest Seller Price", color: C.green, bg: C.greenSoft },
    ];
    cartRows.forEach((r, i) => {
      const ry = 3.5 + i * 1.0;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 7.1, y: ry, w: 5.5, h: 0.8,
        fill: { color: r.bg }, line: { color: r.color, width: 0.5 },
      });
      s.addText(r.label, {
        x: 7.3, y: ry, w: 2.6, h: 0.8,
        fontSize: 13, fontFace: "Calibri", color: C.text,
        bold: true, valign: "middle", margin: 0,
      });
      s.addText(r.value, {
        x: 10.0, y: ry, w: 2.4, h: 0.8,
        fontSize: 14, fontFace: "Calibri", color: r.color,
        bold: true, align: "right", valign: "middle", margin: 0,
      });
    });
  }

  // ============================================================
  // SLIDE 8 — Why Product Page Shows Old But Order Uses New
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Why the Product Page Shows Old Price, but the Order Uses New", "07  ·  Same Product, Two Prices");

    s.addText(
      "Different screens use different refresh mechanisms — that is why two prices appear in the same flow.",
      {
        x: 0.5, y: 1.65, w: 12.3, h: 0.4,
        fontSize: 13, fontFace: "Calibri", color: C.muted, italic: true, margin: 0,
      }
    );

    // Three explanatory cards
    const cards = [
      {
        title: "Product Listing",
        body: "Displays cached catalog data — refresh has not happened yet.",
        result: "OLD",
        color: C.red,
        soft: C.redSoft,
        icon: ic.eye,
      },
      {
        title: "Cart / Checkout",
        body: "Runs real-time validation and fetches the latest Seller price.",
        result: "NEW",
        color: C.green,
        soft: C.greenSoft,
        icon: ic.cart,
      },
      {
        title: "Order Creation",
        body: "Uses the updated price from the latest cart validation.",
        result: "NEW",
        color: C.green,
        soft: C.greenSoft,
        icon: ic.check,
      },
    ];

    const cardW = 4.0;
    const startX = 0.5;
    const gap = 0.35;
    cards.forEach((c, i) => {
      const x = startX + i * (cardW + gap);
      addCard(s, x, 2.2, cardW, 2.8);
      addAccentStripe(s, x, 2.2, 2.8, c.color);
      s.addImage({ data: c.icon, x: x + 0.3, y: 2.45, w: 0.45, h: 0.45 });
      s.addText(c.title, {
        x: x + 0.85, y: 2.45, w: cardW - 1.0, h: 0.45,
        fontSize: 17, fontFace: "Calibri", color: C.bgDark, bold: true, margin: 0,
      });
      s.addText(c.body, {
        x: x + 0.3, y: 3.05, w: cardW - 0.5, h: 1.05,
        fontSize: 12, fontFace: "Calibri", color: C.text, margin: 0,
      });
      // Result pill
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.3, y: 4.2, w: cardW - 0.5, h: 0.6,
        fill: { color: c.soft }, line: { color: c.color, width: 1 },
        rectRadius: 0.08,
      });
      s.addText(`${c.result} PRICE USED`, {
        x: x + 0.3, y: 4.2, w: cardW - 0.5, h: 0.6,
        fontSize: 14, fontFace: "Calibri", color: c.color,
        bold: true, align: "center", valign: "middle", charSpacing: 4, margin: 0,
      });
    });

    // Bottom: example comparison row
    addCard(s, 0.5, 5.25, 12.3, 1.45, C.bgDark);
    s.addText("EXAMPLE OBSERVED DURING TESTING", {
      x: 0.75, y: 5.4, w: 6, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.tealLight,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText("Product Page", {
      x: 0.75, y: 5.75, w: 3, h: 0.45,
      fontSize: 14, fontFace: "Calibri", color: "C9D6E2", margin: 0,
    });
    s.addText("₹ 42", {
      x: 0.75, y: 6.1, w: 3, h: 0.55,
      fontSize: 32, fontFace: "Georgia", color: C.white, bold: true, margin: 0,
    });

    s.addText("vs.", {
      x: 4.0, y: 5.85, w: 1.0, h: 0.6,
      fontSize: 24, fontFace: "Georgia", color: C.tealLight,
      italic: true, align: "center", valign: "middle", margin: 0,
    });

    s.addText("Order Amount", {
      x: 5.0, y: 5.75, w: 3, h: 0.45,
      fontSize: 14, fontFace: "Calibri", color: "C9D6E2", margin: 0,
    });
    s.addText("₹ 176", {
      x: 5.0, y: 6.1, w: 3, h: 0.55,
      fontSize: 32, fontFace: "Georgia", color: C.tealLight, bold: true, margin: 0,
    });

    s.addText(
      "Both behaviors are currently expected under the existing design.",
      {
        x: 8.3, y: 5.85, w: 4.7, h: 0.7,
        fontSize: 13, fontFace: "Calibri", color: C.white,
        italic: true, valign: "middle", align: "right", margin: 0,
      }
    );
  }

  // ============================================================
  // SLIDE 9 — Current Known System Limitations
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Current Known System Limitations", "08  ·  Where It Hurts Today");

    const lims = [
      {
        title: "Data Latency",
        body: "Noticeable delay across Seller → Partner Portal → Buyer App. This creates inconsistency between systems.",
        icon: ic.clock,
        color: C.amber,
      },
      {
        title: "Performance Concerns",
        body: "Large catalogs, multiple sellers and distributors — real-time sync of everything risks performance bottlenecks.",
        icon: ic.chart,
        color: C.teal,
      },
      {
        title: "Queue / Processing Delays",
        body: "Delays caused by queue processing, integration limitations, and ONDC communication overhead. Exact bottleneck needs technical investigation.",
        icon: ic.layers,
        color: C.bgDark,
      },
      {
        title: "Inconsistent User Experience",
        body: "Different components refresh differently — e.g. Product Page = ₹42 while Order Amount = ₹176.",
        icon: ic.eye,
        color: C.red,
      },
    ];

    // 2x2 grid
    const cardW = 6.05;
    const cardH = 2.4;
    const xCol = [0.5, 6.75];
    const yRow = [1.8, 4.3];
    lims.forEach((L, i) => {
      const x = xCol[i % 2];
      const y = yRow[Math.floor(i / 2)];
      addCard(s, x, y, cardW, cardH);
      addAccentStripe(s, x, y, cardH, L.color);

      // Letter badge
      const letter = ["A", "B", "C", "D"][i];
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.3, y: y + 0.3, w: 0.6, h: 0.6,
        fill: { color: L.color }, line: { color: L.color, width: 0 },
      });
      s.addText(letter, {
        x: x + 0.3, y: y + 0.3, w: 0.6, h: 0.6,
        fontSize: 18, fontFace: "Georgia", color: C.white,
        bold: true, align: "center", valign: "middle", margin: 0,
      });

      s.addImage({ data: L.icon, x: x + cardW - 0.85, y: y + 0.32, w: 0.55, h: 0.55 });

      s.addText(L.title, {
        x: x + 1.1, y: y + 0.3, w: cardW - 2.1, h: 0.55,
        fontSize: 18, fontFace: "Calibri", color: C.bgDark,
        bold: true, valign: "middle", margin: 0,
      });
      s.addText(L.body, {
        x: x + 0.3, y: y + 1.0, w: cardW - 0.55, h: 1.35,
        fontSize: 13, fontFace: "Calibri", color: C.text, margin: 0,
      });
    });
  }

  // ============================================================
  // SLIDE 10 — Future Direction
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Future Direction", "09  ·  Where the Platform Is Heading");

    s.addText(
      "Kranthi’s team is already working on a revised design approach that moves away from nightly bulk refresh.",
      {
        x: 0.5, y: 1.65, w: 12.3, h: 0.4,
        fontSize: 13, fontFace: "Calibri", color: C.muted, italic: true, margin: 0,
      }
    );

    // From → To
    // FROM card
    addCard(s, 0.5, 2.25, 5.6, 2.5);
    addAccentStripe(s, 0.5, 2.25, 2.5, C.red);
    s.addText("FROM", {
      x: 0.78, y: 2.4, w: 2, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.red,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText("Nightly Bulk Refresh", {
      x: 0.78, y: 2.75, w: 5.0, h: 0.55,
      fontSize: 22, fontFace: "Georgia", color: C.bgDark, bold: true, margin: 0,
    });
    s.addText(
      "Entire catalog is reprocessed in a single cycle, regardless of how few items actually changed.",
      {
        x: 0.78, y: 3.4, w: 5.0, h: 1.2,
        fontSize: 13, fontFace: "Calibri", color: C.text, margin: 0,
      }
    );

    // Arrow
    s.addImage({ data: ic.arrowRight, x: 6.3, y: 3.25, w: 0.5, h: 0.5 });

    // TO card
    addCard(s, 7.2, 2.25, 5.6, 2.5, C.greenSoft);
    addAccentStripe(s, 7.2, 2.25, 2.5, C.green);
    s.addText("TO", {
      x: 7.48, y: 2.4, w: 2, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.green,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText("Incremental Updates", {
      x: 7.48, y: 2.75, w: 5.0, h: 0.55,
      fontSize: 22, fontFace: "Georgia", color: C.bgDark, bold: true, margin: 0,
    });
    s.addText(
      "Only changed products are synchronized — closer to event-driven propagation.",
      {
        x: 7.48, y: 3.4, w: 5.0, h: 1.2,
        fontSize: 13, fontFace: "Calibri", color: C.text, margin: 0,
      }
    );

    // Benefits
    addCard(s, 0.5, 5.0, 12.3, 1.95);
    addAccentStripe(s, 0.5, 5.0, 1.95, C.green);
    s.addImage({ data: ic.forward, x: 0.78, y: 5.2, w: 0.5, h: 0.5 });
    s.addText("EXPECTED BENEFITS", {
      x: 1.4, y: 5.25, w: 8, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.green,
      bold: true, charSpacing: 4, margin: 0,
    });

    const benefits = [
      "Faster updates",
      "Reduced latency",
      "Better user experience",
      "More accurate pricing visibility",
      "Less dependency on nightly cycles",
    ];
    const bW = (12.3 - 0.5) / 5;
    benefits.forEach((b, i) => {
      const bx = 0.7 + i * bW;
      s.addImage({ data: ic.check, x: bx, y: 5.78, w: 0.35, h: 0.35 });
      s.addText(b, {
        x: bx, y: 6.2, w: bW - 0.1, h: 0.65,
        fontSize: 12, fontFace: "Calibri", color: C.text,
        bold: true, margin: 0,
      });
    });

    // Status note
    s.addText("This redesign is still under development.", {
      x: 0.5, y: 7.05, w: 12.3, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.muted,
      italic: true, align: "right", margin: 0,
    });
  }

  // ============================================================
  // SLIDE 11 — Key Management Takeaways
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    addPageFrame(s, page, TOTAL);
    addSlideTitle(s, "Key Management Takeaways", "10  ·  Where We Stand");

    // Left: Current State
    addCard(s, 0.5, 1.7, 6.2, 5.0);
    addAccentStripe(s, 0.5, 1.7, 5.0, C.teal);
    s.addImage({ data: ic.gear, x: 0.78, y: 1.95, w: 0.5, h: 0.5 });
    s.addText("CURRENT STATE", {
      x: 1.4, y: 1.97, w: 4.5, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.teal,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText("How the platform behaves today", {
      x: 1.4, y: 2.27, w: 4.7, h: 0.4,
      fontSize: 16, fontFace: "Calibri", color: C.bgDark, bold: true, margin: 0,
    });
    s.addText([
      { text: "Seller Portal is the source of truth.", options: { bullet: true, breakLine: true } },
      { text: "Partner Portal holds a copied version of data.", options: { bullet: true, breakLine: true } },
      { text: "Price changes do not immediately reach Partner Portal.", options: { bullet: true, breakLine: true } },
      { text: "A fetch process must run before Sync can work.", options: { bullet: true, breakLine: true } },
      { text: "Most catalog updates refresh only via scheduled processing.", options: { bullet: true, breakLine: true } },
      { text: "Cart and checkout use real-time validation — and may use newer prices than the product listing.", options: { bullet: true } },
    ], {
      x: 0.78, y: 2.85, w: 5.8, h: 3.7,
      fontSize: 12.5, fontFace: "Calibri", color: C.text,
      margin: 0, paraSpaceAfter: 6,
    });

    // Right: Business Risks
    addCard(s, 6.95, 1.7, 5.85, 5.0);
    addAccentStripe(s, 6.95, 1.7, 5.0, C.red);
    s.addImage({ data: ic.warn, x: 7.2, y: 1.95, w: 0.5, h: 0.5 });
    s.addText("BUSINESS RISKS", {
      x: 7.8, y: 1.97, w: 4.5, h: 0.3,
      fontSize: 11, fontFace: "Calibri", color: C.red,
      bold: true, charSpacing: 4, margin: 0,
    });
    s.addText("Impact on buyers, sellers, and testing", {
      x: 7.8, y: 2.27, w: 5.0, h: 0.4,
      fontSize: 16, fontFace: "Calibri", color: C.bgDark, bold: true, margin: 0,
    });
    s.addText([
      { text: "Buyers can see outdated prices.", options: { bullet: true, breakLine: true } },
      { text: "Partner Portal may display stale catalog data.", options: { bullet: true, breakLine: true } },
      { text: "Testing becomes difficult — different screens show different values.", options: { bullet: true, breakLine: true } },
      { text: "Price transparency and user trust can be impacted.", options: { bullet: true } },
    ], {
      x: 7.2, y: 2.85, w: 5.5, h: 3.7,
      fontSize: 12.5, fontFace: "Calibri", color: C.text,
      margin: 0, paraSpaceAfter: 8,
    });
  }

  // ============================================================
  // SLIDE 12 — Recommendation
  // ============================================================
  {
    page++;
    const s = pres.addSlide();
    s.background = { color: C.bgDeepest };

    // Top accent
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: W, h: 0.25,
      fill: { color: C.teal }, line: { color: C.teal, width: 0 },
    });

    // Decorative circle
    s.addShape(pres.shapes.OVAL, {
      x: W - 5, y: -2, w: 7, h: 7,
      fill: { color: C.teal, transparency: 80 },
      line: { color: C.teal, width: 0 },
    });

    s.addText("11  ·  Recommendation", {
      x: 0.8, y: 0.7, w: 8, h: 0.4,
      fontSize: 13, fontFace: "Calibri", color: C.tealLight,
      bold: true, charSpacing: 4, margin: 0,
    });

    s.addText("Move toward an Event-Driven Sync Model", {
      x: 0.8, y: 1.2, w: 12, h: 1.0,
      fontSize: 36, fontFace: "Georgia", color: C.white,
      bold: true, margin: 0,
    });

    s.addText(
      "Price, inventory, and catalog changes should propagate immediately from Seller Portal → Partner Portal → ONDC → Buyer Apps — eliminating dependency on nightly refreshes and reducing catalog inconsistencies.",
      {
        x: 0.8, y: 2.3, w: 11.7, h: 1.4,
        fontSize: 16, fontFace: "Calibri", color: "C9D6E2",
        italic: true, margin: 0,
      }
    );

    // Three pillars
    const pillars = [
      { title: "Event-Driven", body: "Updates trigger propagation the moment a change is saved in the Seller Portal.", icon: ic.bolt },
      { title: "Incremental", body: "Only changed records flow — no full-catalog reprocessing each night.", icon: ic.sync },
      { title: "Consistent", body: "Product listing, Partner Portal, and cart all see the same up-to-date price.", icon: ic.handshake },
    ];
    const pW = 4.0;
    const pGap = 0.25;
    const pStartX = (W - (pW * 3 + pGap * 2)) / 2;
    pillars.forEach((p, i) => {
      const x = pStartX + i * (pW + pGap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: 4.0, w: pW, h: 2.4,
        fill: { color: "FFFFFF", transparency: 90 },
        line: { color: C.tealLight, width: 1 },
        rectRadius: 0.1,
      });
      s.addImage({ data: p.icon, x: x + 0.3, y: 4.2, w: 0.5, h: 0.5 });
      s.addText(p.title, {
        x: x + 0.95, y: 4.2, w: pW - 1.1, h: 0.5,
        fontSize: 18, fontFace: "Calibri", color: C.white,
        bold: true, valign: "middle", margin: 0,
      });
      s.addText(p.body, {
        x: x + 0.3, y: 4.85, w: pW - 0.55, h: 1.45,
        fontSize: 12, fontFace: "Calibri", color: "C9D6E2", margin: 0,
      });
    });

    // Closing line
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.8, y: 6.85, w: 1.4, h: 0.05,
      fill: { color: C.tealLight }, line: { color: C.tealLight, width: 0 },
    });
    s.addText("Discussion with Venkat Manohar  |  1 June 2026  |  Prepared by Omkar Charankar", {
      x: 0.8, y: 6.95, w: 12, h: 0.4,
      fontSize: 11, fontFace: "Calibri", color: "8AA3BA", margin: 0,
    });
  }

  // Write file
  await pres.writeFile({ fileName: "Product-Price-Sync-Workflow-Discussion-2026-06-01.pptx" });
  console.log("Deck written.");
})();
