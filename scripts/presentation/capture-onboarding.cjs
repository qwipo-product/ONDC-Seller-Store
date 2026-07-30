// Capture Seller Store screens matching the "Seller Onboarding to Buyer App
// Visibility" checklist, for the business-team deck.
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:5180";
const OUT = path.resolve(__dirname, "onboarding-shots");
fs.mkdirSync(OUT, { recursive: true });

const SUPER_ADMIN = "9900000001";
const SELLER = "9900000002";
const OTP = "1234";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, mobile) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await page.waitForSelector('input[placeholder*="mobile" i]');
  await page.type('input[placeholder*="mobile" i]', mobile, { delay: 20 });
  for (const b of await page.$$("button")) {
    const t = await page.evaluate((el) => el.textContent, b);
    if (t && t.trim().toLowerCase() === "send otp") { await b.click(); break; }
  }
  await sleep(700);
  const inputs = await page.$$("input");
  let otpInput = null;
  for (const inp of inputs) {
    const ph = await page.evaluate((el) => el.placeholder || "", inp);
    if (/otp|code|digit/i.test(ph)) { otpInput = inp; break; }
  }
  if (!otpInput && inputs.length > 1) otpInput = inputs[inputs.length - 1];
  await otpInput.type(OTP, { delay: 20 });
  for (const b of await page.$$("button")) {
    const t = await page.evaluate((el) => el.textContent, b);
    if (t && /verify|sign in|login|continue/i.test(t)) { await b.click(); break; }
  }
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 8000 }).catch(() => {});
  await sleep(700);
}

async function shot(page, name, wait = 900) {
  await sleep(wait);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log("captured", name);
}

async function goSnap(page, route, name, wait) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0" });
  await shot(page, name, wait);
}

async function clickTab(page, label) {
  const tabs = await page.$$('[role="tab"], button');
  for (const b of tabs) {
    const t = await page.evaluate((el) => (el.textContent || "").replace(/\s+/g, " ").trim(), b);
    if (t.toLowerCase().includes(label.toLowerCase())) {
      await b.click();
      return true;
    }
  }
  console.warn("tab not found:", label);
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ["--no-sandbox"],
  });

  // ---------- Login screen ----------
  {
    const page = await browser.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
    await shot(page, "login");
    await page.close();
  }

  // ---------- Admin flow ----------
  {
    const page = await browser.newPage();
    await login(page, SUPER_ADMIN);

    // Step 1: Companies & Brands
    await goSnap(page, "/admin/companies", "step1-companies");
    // Try opening the Add Company dialog
    for (const b of await page.$$("button")) {
      const t = await page.evaluate((el) => el.textContent, b);
      if (t && /add company/i.test(t)) {
        await b.click();
        await shot(page, "step1-add-company-dialog", 700);
        await page.keyboard.press("Escape");
        break;
      }
    }

    // Step 2: Add Seller form (top + scrolled to GPS/company section)
    await goSnap(page, "/admin/users/add", "step2-add-seller-top");
    await page.evaluate(() => {
      const el = document.querySelector("main") || document.scrollingElement;
      const sc = Array.from(document.querySelectorAll("*")).find(
        (e) => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 400
      );
      (sc || el).scrollTop = 900;
    });
    await shot(page, "step2-add-seller-mid", 600);
    await page.evaluate(() => {
      const sc = Array.from(document.querySelectorAll("*")).find(
        (e) => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 400
      );
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await shot(page, "step2-add-seller-bottom", 600);

    // Seller detail: use first seller in list
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle0" });
    await sleep(800);
    await shot(page, "step2-sellers-list", 200);
    // Open the first seller via its "Manage" button
    let onDetail = false;
    for (const b of await page.$$("button, a")) {
      const t = await page.evaluate((el) => el.textContent, b);
      if (t && t.trim().toLowerCase() === "manage") {
        await b.click();
        await sleep(1500);
        onDetail = /\/admin\/users\/.+/.test(await page.evaluate(() => window.location.pathname));
        break;
      }
    }
    if (onDetail) {
      await shot(page, "step2-seller-profile", 1000);

      // Step 3: Serviceability tab
      await clickTab(page, "Serviceability");
      await shot(page, "step3-serviceability", 2500);

      // Step 4: Connector tab
      await clickTab(page, "Connector");
      await shot(page, "step4-connectors", 900);

      // Step 5: Companies & Brands tab (Sync Catalog)
      await clickTab(page, "Companies & Brands");
      await shot(page, "step5-sync-catalog", 1000);
    } else {
      console.warn("no seller link found");
    }
    await page.close();
  }

  // ---------- Seller flow ----------
  {
    const page = await browser.newPage();
    await login(page, SELLER);

    // Step 6: dashboard after login
    await goSnap(page, "/", "step6-seller-dashboard");

    // Step 7: My SKU
    await goSnap(page, "/products/my-sku", "step7-my-sku", 1200);

    // Step 7b: Import SKUs flow
    await goSnap(page, "/products/add-sku", "step7-add-sku");

    // Step 8: SKU detail — click first SKU row/link on My SKU
    await page.goto(`${BASE}/products/my-sku`, { waitUntil: "networkidle0" });
    await sleep(1000);
    const skuLinks = await page.$$('a[href*="/products/sku-detail/"]');
    if (skuLinks.length) {
      const href = await page.evaluate((el) => el.getAttribute("href"), skuLinks[0]);
      await page.goto(`${BASE}${href}`, { waitUntil: "networkidle0" });
      await shot(page, "step8-sku-detail", 1200);
    } else {
      const row = await page.$("table tbody tr");
      if (row) {
        await row.click();
        await sleep(1400);
        await shot(page, "step8-sku-detail", 200);
      }
    }

    // Step 9: Price list / price & inventory
    await goSnap(page, "/products/price-list", "step9-price-list", 1200);

    // Step 10: Communication settings
    await goSnap(page, "/settings/communication", "step10-communication", 1000);

    await page.close();
  }

  await browser.close();
  console.log("done");
})();
