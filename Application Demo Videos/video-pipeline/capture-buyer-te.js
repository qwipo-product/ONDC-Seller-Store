// Buyer App video — TELUGU version: same screens/frames, Telugu captions.
const path = require("path");
const { launch, sleep } = require("./capture-lib");

const SLIDES = path.join(__dirname, "slides");

const SCENES = [
  {
    out: "02-home.png", img: "Home Page - Distributors.png", pos: "22%",
    title: "Home Page — smart distributor sorting",
    bullets: [
      "🏠|Retailer యొక్క home — <b>ONDC DigiDukaan</b> powered",
      "🥇|Distributors ఇప్పుడు <b>earliest delivery</b> ప్రకారం sorted — ముందుగా deliver చేసేవాడు పైన",
      "📍|System retailer location → serve చేసే sellers → వాళ్ళ <b>beat days</b> check చేస్తుంది",
      "🗓️|ఈ రోజు beat day వెళ్ళిపోయిందా? Automatic గా <b>next beat day</b> కనిపిస్తుంది — తప్పుడు promise ఉండదు",
    ],
  },
  {
    out: "03-distributors.png", img: "Autherised Distributors - All list view.png", pos: "0%",
    title: "Distributor cards — delivery info ముందుగానే",
    bullets: [
      "🗓️|ప్రతి card మీద <b>Beat day delivery</b> — ఉదా: \"Fri, 28th (Beat day)\"",
      "⚡|Configure చేస్తే <b>Tomorrow delivery</b> కూడా — వేరే MOV తో",
      "💰|రెండు options కి <b>Seller MOV</b> స్పష్టంగా — ₹500 vs ₹2,500",
      "ℹ️|ఇది <b>information</b> మాత్రమే — ఎంపిక checkout లో జరుగుతుంది",
    ],
  },
  {
    out: "04-products.png", img: "Product list - Distributors.png", pos: "0%",
    title: "Product listing — delivery పక్కపక్కనే",
    bullets: [
      "🛍️|Distributor open చేయగానే products పైన అవే <b>Delivery by</b> chips",
      "🏷️|Margin, MRP, discounts తో పాటు <b>delivery day</b> కూడా ఎప్పుడూ కనిపిస్తుంది",
      "🧠|కొనేటప్పుడే తెలుసు — <b>సరుకు ఎప్పుడు వస్తుందో</b>",
    ],
  },
  {
    out: "05-cart.png", img: "Cart.png", pos: "0%",
    title: "Cart — అసలు ఎంపిక ఇక్కడే",
    bullets: [
      "🎯|ప్రతి seller items కింద <b>delivery options</b> — radio buttons",
      "✅|Default గా <b>Beat day pre-selected</b> — regular route delivery",
      "⚡|తొందరగా కావాలా? <b>Tomorrow</b> ఎంచుకోండి — ఎక్కువ MOV తో express delivery",
    ],
  },
  {
    out: "06-mov.png", img: "View Items - MOV Not Met.png", pos: "0%",
    title: "Dynamic MOV — app తానే guide చేస్తుంది",
    bullets: [
      "🔄|Delivery option మారగానే required <b>MOV మారుతుంది</b> — ₹500 vs ₹2,500",
      "➕|Order తక్కువగా ఉందా? App చెబుతుంది — <b>\"Add ₹2,212 More\"</b>",
      "📈|దుకాణదారుడికి exact గా తెలుసు — ఇంకా ఎంత add చేయాలో",
    ],
  },
  {
    out: "07-view-items.png", img: "View Items - MOV Met.png", pos: "0%",
    title: "View Items — ఆ seller products మాత్రమే",
    bullets: [
      "🎯|<b>View Items</b> click చేస్తే → ఆ seller products మాత్రమే కనిపిస్తాయి",
      "🙈|మిగతా distributors <b>hide</b> — ఎలాంటి confusion లేదు",
      "✅|అదే seller నుంచి items పెంచి <b>MOV పూర్తి</b> చేయడం సులభం",
    ],
  },
  {
    out: "09-summary.png", img: "Order Summary.png", pos: "0%",
    title: "Order Summary — ఇప్పుడు ఒకే consolidated view",
    bullets: [
      "🧾|ముందు: ప్రతి seller కి వేరు card | ఇప్పుడు: <b>ఒకే summary</b>",
      "🗓️|ప్రతి seller total, brands, వాళ్ళ <b>delivery day</b> — Tomorrow లేదా Beat day",
      "💳|Bill details + delivery address + <b>Place Order</b> — checkout simple, clean",
    ],
  },
  {
    out: "10-confirmed.png", img: "Order Confirmation.png", pos: "20%",
    title: "Order Confirmed — రోజు ముందే తెలుసు",
    bullets: [
      "🎉|Order placed — ప్రతి seller కి ఎంచుకున్న delivery day ప్రకారం",
      "🚚|Beat day orders <b>route వ్యాన్</b> లో — free delivery",
      "😊|Call లేదు, confusion లేదు — దుకాణదారుడు నిశ్చింతగా",
    ],
  },
];

(async () => {
  const A = await launch(path.join(__dirname, "frames-buyer-te"));

  await A.slide("buyer-intro-te.html", "01-intro.png");

  for (const s of SCENES) {
    const params = new URLSearchParams({ img: s.img, pos: s.pos, title: s.title });
    s.bullets.forEach((b, i) => params.set("b" + (i + 1), b));
    const url = "file:///" + path.join(SLIDES, "buyer-scene.html").replace(/\\/g, "/") + "?" + params.toString();
    await A.page.goto(url, { waitUntil: "networkidle0" });
    await sleep(700);
    await A.shot(s.out);
  }

  await A.slide("buyer-config-te.html", "08-config.png");
  await A.slide("buyer-benefits-te.html", "11-benefits.png");
  await A.slide("buyer-outro-te.html", "12-outro.png");

  await A.browser.close();
  console.log("DONE BUYER-TE");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
