// Shared puppeteer helpers for the demo-video captures.
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:5180";
const SLIDES = path.join(__dirname, "slides");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--window-size=1920,1080", "--force-device-scale-factor=1", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const api = {
    browser,
    page,
    sleep,
    shot: async (name) => {
      await page.screenshot({ path: path.join(outDir, name) });
      console.log("captured", name);
    },
    slide: async (file, out) => {
      await page.goto("file:///" + path.join(SLIDES, file).replace(/\\/g, "/"), { waitUntil: "networkidle0" });
      await sleep(400);
      await api.shot(out);
    },
    findByText: async (selector, text) => {
      const handle = await page.evaluateHandle(
        (sel, txt) => {
          const els = [...document.querySelectorAll(sel)];
          const matches = els.filter((e) => e.textContent && e.textContent.trim().includes(txt));
          return matches.length ? matches[matches.length - 1] : null;
        },
        selector,
        text,
      );
      const el = handle.asElement();
      if (!el) throw new Error(`Element not found: ${selector} :: ${text}`);
      return el;
    },
    clickText: async (selector, text) => {
      const el = await api.findByText(selector, text);
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await sleep(200);
      const box = await el.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(250);
    },
    highlight: async (selector, text) => {
      const el = await api.findByText(selector, text);
      await el.evaluate((e) => {
        e.style.outline = "4px solid #f59e0b";
        e.style.outlineOffset = "3px";
        e.style.borderRadius = "10px";
      });
    },
    clearHighlight: async () => {
      await page.evaluate(() => {
        document.querySelectorAll('[style*="outline"]').forEach((e) => {
          e.style.outline = "";
          e.style.outlineOffset = "";
        });
      });
    },
    typeInto: async (selector, value, nth = 0) => {
      await page.waitForSelector(selector, { timeout: 5000 });
      const els = await page.$$(selector);
      const el = els[nth < 0 ? els.length + nth : nth];
      if (!el) throw new Error(`No element #${nth} for ${selector}`);
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await sleep(150);
      await el.click();
      await el.type(value, { delay: 15 });
    },
    scrollToCenter: async (selector, text) => {
      const el = text ? await api.findByText(selector, text) : await page.$(selector);
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await sleep(250);
    },
    login: async () => {
      await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
      await sleep(600);
      await api.typeInto("#mobile", "9900000001");
      await api.clickText("button", "Send OTP");
      await api.typeInto("#otp", "1234");
      await api.clickText("button", "Verify OTP");
      await page.waitForFunction(() => location.pathname.startsWith("/admin"), { timeout: 15000 });
      console.log("logged in");
      await sleep(5000); // welcome toast fade-out
    },
    goto: async (p) => {
      await page.goto(BASE + p, { waitUntil: "networkidle2" });
      await sleep(1000);
    },
    // Click the element whose trimmed text EXACTLY equals `text` (last match).
    // Needed for sidebar items like "Sellers" that are substrings of other text.
    clickExact: async (selector, text) => {
      const handle = await page.evaluateHandle(
        (sel, txt) => {
          const els = [...document.querySelectorAll(sel)];
          const matches = els.filter((e) => e.textContent && e.textContent.trim() === txt);
          return matches.length ? matches[matches.length - 1] : null;
        },
        selector,
        text,
      );
      const el = handle.asElement();
      if (!el) throw new Error(`Exact element not found: ${selector} :: ${text}`);
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await sleep(200);
      const box = await el.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(250);
    },
  };
  return api;
}

module.exports = { launch, sleep, BASE };
