// Captures the Add Seller flow from the running Seller Store dev server
// as 1920x1080 PNG frames for the Hindi demo video.
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:5180";
const OUT = path.join(__dirname, "frames");
const SLIDES = path.join(__dirname, "slides");
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--window-size=1920,1080", "--force-device-scale-factor=1", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name) });
    console.log("captured", name);
  };

  // Find an element whose textContent contains `text`, among `selector` matches.
  const findByText = async (selector, text) => {
    const handle = await page.evaluateHandle(
      (sel, txt) => {
        const els = [...document.querySelectorAll(sel)];
        // prefer the deepest/last match so buttons win over containers
        const matches = els.filter((e) => e.textContent && e.textContent.trim().includes(txt));
        return matches.length ? matches[matches.length - 1] : null;
      },
      selector,
      text,
    );
    const el = handle.asElement();
    if (!el) throw new Error(`Element not found: ${selector} :: ${text}`);
    return el;
  };

  const clickText = async (selector, text) => {
    const el = await findByText(selector, text);
    await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await sleep(200);
    const box = await el.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(200);
  };

  const highlight = async (selector, text) => {
    const el = await findByText(selector, text);
    await el.evaluate((e) => {
      e.style.outline = "4px solid #f59e0b";
      e.style.outlineOffset = "3px";
      e.style.borderRadius = "10px";
    });
  };

  const clearHighlight = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('[style*="outline"]').forEach((e) => {
        e.style.outline = "";
        e.style.outlineOffset = "";
      });
    });
  };

  const typeInto = async (selector, value) => {
    await page.waitForSelector(selector, { timeout: 5000 });
    const el = await page.$(selector);
    await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await sleep(150);
    await el.click();
    await el.type(value, { delay: 15 });
  };

  const scrollToCenter = async (selector, text) => {
    const el = text ? await findByText(selector, text) : await page.$(selector);
    await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await sleep(250);
  };

  // ---------- Slides ----------
  for (const [file, out] of [
    ["intro.html", "01-intro.png"],
    ["checklist.html", "03-checklist.png"],
    ["outro.html", "13-outro.png"],
  ]) {
    await page.goto("file:///" + path.join(SLIDES, file).replace(/\\/g, "/"), { waitUntil: "networkidle0" });
    await sleep(400);
    await shot(out);
  }

  // ---------- Login as Super Admin ----------
  await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
  await sleep(600);
  await typeInto("#mobile", "9900000001");
  await clickText("button", "Send OTP");
  await typeInto("#otp", "1234");
  await clickText("button", "Verify OTP");
  await page.waitForFunction(() => location.pathname.startsWith("/admin"), { timeout: 15000 });
  console.log("logged in");
  await sleep(5000); // let the welcome toast disappear

  // ---------- Scene: Sellers page ----------
  await page.goto(BASE + "/admin/users", { waitUntil: "networkidle2" });
  await sleep(1200);
  await highlight("button", "Add Seller");
  await shot("02-sellers-page.png");
  await clearHighlight();

  // ---------- Scene: empty Add Seller form ----------
  await clickText("button", "Add Seller");
  await page.waitForFunction(() => location.pathname === "/admin/users/add", { timeout: 10000 });
  await sleep(1000);
  await shot("04-add-seller-empty.png");

  // ---------- Scene: basic info filled ----------
  await typeInto('input[placeholder="Enter full name"]', "Rajesh Sharma");
  await typeInto('input[placeholder="+91 98765 43210"]', "9876543210");
  await typeInto('input[placeholder^="Enter business name"]', "Sharma Agencies");
  await scrollToCenter('input[placeholder="Enter full name"]');
  await shot("05-basic-info.png");

  // ---------- Scene: PIN resolved ----------
  await typeInto('input[placeholder="6-digit PIN"]', "500003");
  await sleep(800); // wait for the simulated lookup
  await scrollToCenter('input[placeholder="6-digit PIN"]');
  await shot("06-pin-resolved.png");

  // ---------- Scene: address complete ----------
  await typeInto('input[placeholder="e.g. 12.9716"]', "17.4399");
  await typeInto('input[placeholder="e.g. 77.5946"]', "78.4983");
  await typeInto('input[placeholder^="e.g. Banjara Hills"]', "Secunderabad");
  await typeInto('input[placeholder^="Shop / door no."]', "Shop No. 12, MG Road, Near Clock Tower");
  await scrollToCenter('input[placeholder="e.g. 12.9716"]');
  await shot("07-address-complete.png");

  // ---------- Scene: company combobox open with search ----------
  await clickText("button", "Select a company...");
  await page.waitForSelector("[cmdk-input]", { timeout: 5000 });
  await sleep(400);
  await shot("08-company-list.png");

  // ---------- Scene: ITC selected -> all brands ----------
  await clickText('[cmdk-item]', "ITC");
  await sleep(600);
  await scrollToCenter("button", "Use all brands").catch(() => {});
  await scrollToCenter("span", "all 5 brands").catch(() => {});
  await shot("09-itc-all-brands.png");

  // ---------- Scene: pick specific brands ----------
  await clickText("button", "Pick specific brands");
  await sleep(400);
  // all chips start selected; deselect Bingo and Classmate
  await clickText("button", "Bingo");
  await clickText("button", "Classmate");
  await sleep(300);
  await scrollToCenter("button", "Aashirvaad");
  await shot("10-specific-brands.png");

  // ---------- Scene: add second company (Adani Wilmar, all brands) ----------
  await clickText("button", "Add another company");
  await sleep(400);
  await clickText("button", "Select a company...");
  await page.waitForSelector("[cmdk-input]", { timeout: 5000 });
  await page.type("[cmdk-input]", "Adani", { delay: 40 });
  await sleep(400);
  await clickText('[cmdk-item]', "Adani Wilmar");
  await sleep(600);
  await scrollToCenter("button", "Add another company");
  await shot("11-second-company.png");

  // ---------- Scene: save -> success ----------
  const saveBtn = await findByText("button", "Add Seller");
  await saveBtn.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await sleep(300);
  const box = await saveBtn.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => location.pathname === "/admin/users", { timeout: 15000 });
  await sleep(1200); // list + success toast visible
  await shot("12-saved.png");

  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
