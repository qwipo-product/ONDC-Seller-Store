// Third pass: (a) admin links companies to the seller so the
// Companies & Brands tab renders populated, (b) seller-side Central
// Catalog Sync screens for the Sync Catalog step.
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

async function linkCompany(page, companyName, screenshotName) {
  // open Add Company dialog
  await clickByText(page, "button", "add company");
  await sleep(800);
  // open the combobox
  await clickByText(page, 'div[role="dialog"] button', "choose a company");
  await sleep(600);
  // type to filter, then click matching option
  const search = await page.$('input[placeholder*="search" i]');
  if (search) await search.type(companyName.slice(0, 8), { delay: 25 });
  await sleep(600);
  await clickByText(page, '[role="option"], [cmdk-item], div[role="dialog"] button', companyName);
  await sleep(600);
  if (screenshotName) await shot(page, screenshotName, 300);
  await clickByText(page, 'div[role="dialog"] button', "link company", true);
  await sleep(1000);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ["--no-sandbox"],
  });

  // ---------- Admin: link companies ----------
  {
    const page = await browser.newPage();
    await login(page, SUPER_ADMIN);
    await page.goto(`${BASE}/admin/users/seller-prod-jsv`, { waitUntil: "networkidle0" });
    await sleep(1000);
    await clickByText(page, '[role="tab"]', "Companies & Brands");
    await sleep(800);

    await linkCompany(page, "Colgate", "step5-link-company-dialog");
    await linkCompany(page, "Lion Dates", null);
    await linkCompany(page, "MSK", null);
    await shot(page, "step5-companies-tab", 1000);
    await page.close();
  }

  // ---------- Seller: central catalog sync ----------
  {
    const page = await browser.newPage();
    await login(page, SELLER);
    await page.goto(`${BASE}/products/add-sku/central-catalog`, { waitUntil: "networkidle0" });
    await shot(page, "step5-central-catalog-brands", 1200);
    // click first brand card ("View Products" or the card itself)
    const clicked =
      (await clickByText(page, "button, a", "view products")) ||
      (await page.evaluate(() => {
        const card = document.querySelector('[class*="card" i], .grid > div');
        if (card) { card.click(); return true; }
        return false;
      }));
    if (clicked) {
      await shot(page, "step5-central-catalog-products", 1500);
    }
    await page.close();
  }

  await browser.close();
  console.log("done");
})();
