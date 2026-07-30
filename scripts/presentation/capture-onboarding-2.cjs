// Second pass: populated seller-detail tabs (AMARNATH PALLA has 38
// production beats seeded) + ONDC connect flow driven through the UI.
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:5180";
const OUT = path.resolve(__dirname, "onboarding-shots");
fs.mkdirSync(OUT, { recursive: true });

const SUPER_ADMIN = "9900000001";
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
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("captured", name);
}

async function clickByText(page, selector, text, exact = false) {
  for (const b of await page.$$(selector)) {
    const t = await page.evaluate((el) => (el.textContent || "").replace(/\s+/g, " ").trim(), b);
    const ok = exact ? t.toLowerCase() === text.toLowerCase() : t.toLowerCase().includes(text.toLowerCase());
    if (ok) { await b.click(); return true; }
  }
  console.warn("not found:", text);
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await login(page, SUPER_ADMIN);

  // Find AMARNATH PALLA via search
  await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle0" });
  await sleep(800);
  await page.type('input[placeholder*="Search" i]', "AMARNATH", { delay: 30 });
  await sleep(900);
  // Click the row's Manage button
  await clickByText(page, "button, a", "manage", true);
  await sleep(1500);
  console.log("url:", await page.evaluate(() => window.location.pathname));

  // Profile tab (populated seller)
  await shot(page, "step2-seller-profile", 800);

  // Serviceability tab — beats list
  await clickByText(page, '[role="tab"]', "Serviceability");
  await shot(page, "step3-serviceability", 2000);
  // Map view if available
  const hadMap = await clickByText(page, "button", "map view");
  if (hadMap) {
    await shot(page, "step3-serviceability-map", 4000);
    await page.keyboard.press("Escape");
    await sleep(800);
  }

  // Connector tab — add ONDC through the UI
  await clickByText(page, '[role="tab"]', "Connector");
  await sleep(800);
  const isConnected = await page.evaluate(() =>
    /ONDC/.test(document.body.innerText) && /Connected/.test(document.body.innerText)
  );
  if (!isConnected) {
    await clickByText(page, "button", "add connector");
    await shot(page, "step4-add-connector-dialog", 900);
    // Choose ONDC tile
    await clickByText(page, 'div[role="dialog"] button', "Open Network");
    await sleep(800);
    await shot(page, "step4-connect-ondc-dialog", 300);
    // Fill Seller ID + API Key
    await page.type('div[role="dialog"] input[placeholder*="seller ID" i]', "JSV-HYD-0042", { delay: 20 });
    await page.type('div[role="dialog"] input[placeholder*="API key" i]', "ondc-live-7f3a9c21", { delay: 20 });
    await clickByText(page, 'div[role="dialog"] button', "connect", true);
    await sleep(1200);
  }
  await shot(page, "step4-connectors", 800);

  // Companies & Brands tab — Sync Catalog
  await clickByText(page, '[role="tab"]', "Companies & Brands");
  await shot(page, "step5-sync-catalog", 1200);
  // Click Sync Catalog button to show the result state
  const hadSync = await clickByText(page, "button", "sync catalog");
  if (hadSync) {
    await shot(page, "step5-sync-catalog-result", 2500);
  }

  await page.close();
  await browser.close();
  console.log("done");
})();
