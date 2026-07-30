const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");
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
(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await login(page, SELLER);
  await page.goto(`${BASE}/products/sku-detail/180000008`, { waitUntil: "networkidle0" });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, "step8-sku-detail.png") });
  console.log("captured step8-sku-detail");
  // scroll the detail page to show ONDC fields / image section
  await page.evaluate(() => {
    const sc = Array.from(document.querySelectorAll("*")).find(
      (e) => e.scrollHeight > e.clientHeight + 200 && e.clientHeight > 400
    );
    if (sc) sc.scrollTop = 700;
    else window.scrollTo(0, 700);
  });
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, "step8-sku-detail-mid.png") });
  console.log("captured step8-sku-detail-mid");
  await browser.close();
  console.log("done");
})();
