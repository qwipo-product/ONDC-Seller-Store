// Bulk Import workflow shots for the Step 7 enhancement:
// (a) Bulk Import dropdown open, (b) Add New SKUs (template upload) dialog.
const puppeteer = require("puppeteer-core");
const path = require("path");
const BASE = "http://localhost:5180";
const OUT = path.resolve(__dirname, "onboarding-shots");
const SELLER = "9900000002", OTP = "1234";
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
  let otp = inputs[inputs.length - 1];
  for (const inp of inputs) {
    const ph = await page.evaluate((el) => el.placeholder || "", inp);
    if (/otp|code|digit/i.test(ph)) { otp = inp; break; }
  }
  await otp.type(OTP, { delay: 20 });
  for (const b of await page.$$("button")) {
    const t = await page.evaluate((el) => el.textContent, b);
    if (t && /verify|sign in|login|continue/i.test(t)) { await b.click(); break; }
  }
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 8000 }).catch(() => {});
  await sleep(700);
}

async function clickByText(page, selector, text) {
  for (const b of await page.$$(selector)) {
    const t = await page.evaluate((el) => (el.textContent || "").replace(/\s+/g, " ").trim(), b);
    if (t.toLowerCase().includes(text.toLowerCase())) { await b.click(); return true; }
  }
  console.warn("not found:", text);
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await login(page, SELLER);
  await page.goto(`${BASE}/products/my-sku`, { waitUntil: "networkidle0" });
  await sleep(1200);

  // (a) open the Bulk Import dropdown
  await clickByText(page, "button", "bulk import");
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, "step7-bulk-import-menu.png") });
  console.log("captured step7-bulk-import-menu");

  // (b) open Add New SKUs dialog
  await clickByText(page, '[role="menuitem"]', "add new skus");
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT, "step7-bulk-import-dialog.png") });
  console.log("captured step7-bulk-import-dialog");

  await browser.close();
  console.log("done");
})();
