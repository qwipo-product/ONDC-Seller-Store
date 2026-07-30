// Buyer App video: renders slide frames (static + parametrized phone-frame scenes).
const path = require("path");
const { launch, sleep } = require("./capture-lib");

const SLIDES = path.join(__dirname, "slides");

// Parametrized phone-frame scenes: real app screen inside a mockup + captions.
const SCENES = [
  {
    out: "02-home.png", img: "Home Page - Distributors.png", pos: "22%",
    title: "Home Page — smart distributor sorting",
    bullets: [
      "🏠|Retailer का home — <b>ONDC DigiDukaan</b> powered",
      "🥇|Distributors अब <b>earliest delivery</b> के हिसाब से sorted — जो सबसे पहले deliver करे, वो सबसे ऊपर",
      "📍|System retailer की location → serve करने वाले sellers → उनके <b>beat days</b> check करता है",
      "🗓️|आज beat day निकल चुका है? तो अपने आप <b>अगला beat day</b> दिखेगा — गलत promise कभी नहीं",
    ],
  },
  {
    out: "03-distributors.png", img: "Autherised Distributors - All list view.png", pos: "0%",
    title: "Distributor cards — delivery info पहले से",
    bullets: [
      "🗓️|हर card पर <b>Beat day delivery</b> — जैसे \"Fri, 28th (Beat day)\"",
      "⚡|Configured हो तो <b>Tomorrow delivery</b> भी — अलग MOV के साथ",
      "💰|दोनों options का <b>Seller MOV</b> साफ़ दिखता है — जैसे ₹500 vs ₹2,500",
      "ℹ️|ये सिर्फ़ <b>information</b> है — चुनना checkout पर होगा",
    ],
  },
  {
    out: "04-products.png", img: "Product list - Distributors.png", pos: "0%",
    title: "Product listing — delivery साथ-साथ चलती है",
    bullets: [
      "🛍️|Distributor खोलते ही products के ऊपर वही <b>Delivery by</b> chips",
      "🏷️|Margin, MRP, discounts के साथ-साथ <b>delivery day</b> भी हर वक़्त सामने",
      "🧠|खरीदते समय ही पता — <b>माल कब आएगा</b>",
    ],
  },
  {
    out: "05-cart.png", img: "Cart.png", pos: "0%",
    title: "Cart — यहाँ होता है असली चुनाव",
    bullets: [
      "🎯|हर seller के items के नीचे <b>delivery options</b> — radio buttons",
      "✅|Default में <b>Beat day pre-selected</b> — regular route की delivery",
      "⚡|जल्दी चाहिए? <b>Tomorrow</b> चुनिए — ज़्यादा MOV पर express delivery",
    ],
  },
  {
    out: "06-mov.png", img: "View Items - MOV Not Met.png", pos: "0%",
    title: "Dynamic MOV — app खुद guide करता है",
    bullets: [
      "🔄|Delivery option बदलते ही required <b>MOV बदल जाता है</b> — ₹500 vs ₹2,500",
      "➕|Order कम है? App बताता है — <b>\"Add ₹2,212 More\"</b>",
      "📈|दुकानदार को exactly पता — कितना और add करना है",
    ],
  },
  {
    out: "07-view-items.png", img: "View Items - MOV Met.png", pos: "0%",
    title: "View Items — सिर्फ़ उसी seller के products",
    bullets: [
      "🎯|<b>View Items</b> पर click → सिर्फ़ उसी seller के products दिखते हैं",
      "🙈|बाक़ी distributors <b>hide</b> — कोई confusion नहीं",
      "✅|उसी seller से items बढ़ाकर <b>MOV पूरा</b> करना आसान",
    ],
  },
  {
    out: "09-summary.png", img: "Order Summary.png", pos: "0%",
    title: "Order Summary — अब एक consolidated view",
    bullets: [
      "🧾|पहले: हर seller का अलग-अलग card | अब: <b>एक ही summary</b>",
      "🗓️|हर seller का total, brands, और उसका <b>delivery day</b> — Tomorrow या Beat day",
      "💳|Bill details + delivery address + <b>Place Order</b> — checkout simple और clean",
    ],
  },
  {
    out: "10-confirmed.png", img: "Order Confirmation.png", pos: "20%",
    title: "Order Confirmed — दिन पहले से पता",
    bullets: [
      "🎉|Order placed — हर seller को अपने चुने हुए delivery day पर",
      "🚚|Beat day वाले orders <b>route की गाड़ी</b> से — free delivery",
      "😊|ना call, ना confusion — दुकानदार निश्चिंत",
    ],
  },
];

(async () => {
  const A = await launch(path.join(__dirname, "frames-buyer"));

  await A.slide("buyer-intro.html", "01-intro.png");

  for (const s of SCENES) {
    const params = new URLSearchParams({ img: s.img, pos: s.pos, title: s.title });
    s.bullets.forEach((b, i) => params.set("b" + (i + 1), b));
    const url = "file:///" + path.join(SLIDES, "buyer-scene.html").replace(/\\/g, "/") + "?" + params.toString();
    await A.page.goto(url, { waitUntil: "networkidle0" });
    await sleep(700); // let the big PNG decode
    await A.shot(s.out);
  }

  await A.slide("buyer-config.html", "08-config.png");
  await A.slide("buyer-benefits.html", "11-benefits.png");
  await A.slide("buyer-outro.html", "12-outro.png");

  await A.browser.close();
  console.log("DONE BUYER");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
