// Video 2: Company & Brand creation + seller tagging + ONDC connector.
const path = require("path");
const { launch } = require("./capture-lib");

(async () => {
  const A = await launch(path.join(__dirname, "frames-v2"));
  const { page, sleep } = A;

  // Slides
  await A.slide("v2-intro.html", "01-intro.png");
  await A.slide("v2-outro.html", "14-outro.png");

  await A.login();

  // ---------- Companies & Brands page ----------
  await A.goto("/admin/companies");
  await sleep(500);
  await A.highlight("button", "Add Company");
  await A.shot("02-companies-page.png");
  await A.clearHighlight();

  // ---------- Add Company dialog (empty) ----------
  await A.clickText("button", "Add Company");
  await page.waitForSelector('input[placeholder="e.g. ITC Limited"]', { timeout: 5000 });
  await sleep(500);
  await A.shot("03-add-company-empty.png");

  // ---------- Fill: Parle Products + 3 brands ----------
  await A.typeInto('input[placeholder="e.g. ITC Limited"]', "Parle Products");
  await A.typeInto('input[placeholder^="Brand name"]', "Parle-G", 0);
  await A.clickText("button", "Add brand");
  await sleep(300);
  await A.typeInto('input[placeholder^="Brand name"]', "Krackjack", -1);
  await A.clickText("button", "Add brand");
  await sleep(300);
  await A.typeInto('input[placeholder^="Brand name"]', "Monaco", -1);
  await sleep(300);
  await A.shot("04-add-company-filled.png");

  // ---------- Categories tab ----------
  await A.clickText('[role="tab"]', "Categories");
  await sleep(500);
  await A.shot("05-categories-tab.png");
  await A.clickText('[role="tab"]', "Brands");
  await sleep(300);

  // ---------- Save ----------
  await A.clickText('button', "Add Company"); // dialog footer CTA is the last match
  await sleep(1200);
  await A.scrollToCenter("p", "Parle Products").catch(() => {});
  await A.shot("06-company-created.png");
  await sleep(3500); // let the toast fade before next scene

  // ---------- Seller detail: Companies & Brands tab ----------
  // SPA navigation (sidebar → search → Manage) so the in-memory catalog
  // keeps the newly created Parle Products company.
  await A.clickExact("a, button, span", "Sellers");
  await sleep(1000);
  await A.typeInto('input[placeholder^="Search by seller name"]', "MAHADEVA");
  await sleep(800);
  await A.clickText("button", "Manage");
  await page.waitForFunction(() => location.pathname.includes("/admin/users/"), { timeout: 10000 });
  await sleep(1000);
  await A.clickText('[role="tab"]', "Companies & Brands");
  await sleep(600);
  await A.highlight("button", "Add Company");
  await A.shot("07-seller-catalog-tab.png");
  await A.clearHighlight();

  // ---------- Link a Company dialog ----------
  await A.clickText("button", "Add Company");
  await page.waitForSelector("[cmdk-input]", { timeout: 5000 }).catch(() => {});
  await sleep(400);
  await A.clickText("button", "Choose a company…");
  await page.waitForSelector("[cmdk-input]", { timeout: 5000 });
  await page.type("[cmdk-input]", "Parle", { delay: 40 });
  await sleep(400);
  await A.clickText("[cmdk-item]", "Parle Products");
  await sleep(500);
  await A.shot("08-link-company-dialog.png");

  // ---------- Link it ----------
  await A.clickText("button", "Link Company");
  await sleep(1200);
  await A.shot("09-company-linked.png");
  await sleep(3500);

  // ---------- Connector tab ----------
  await A.clickText('[role="tab"]', "Connector");
  await sleep(600);
  await A.highlight("button", "Add Connector");
  await A.shot("10-connector-tab.png");
  await A.clearHighlight();

  // ---------- Add Connector chooser ----------
  await A.clickText("button", "Add Connector");
  await sleep(600);
  await A.shot("11-connector-chooser.png");

  // ---------- Connect ONDC ----------
  await A.clickText("button", "Open Network for Digital Commerce");
  await page.waitForSelector('input[placeholder="Enter seller ID"]', { timeout: 5000 });
  await A.typeInto('input[placeholder="Enter seller ID"]', "MAHADEVA-HYD-500072");
  await A.typeInto('input[placeholder="Enter API key"]', "qwp-ondc-93f2-secure-key");
  await sleep(300);
  await A.shot("12-ondc-config.png");
  await A.clickText("button", "Connect");
  await sleep(1000);

  // ---------- Add Qwipo Logistics too (one click), final state ----------
  await A.clickText("button", "Add Connector");
  await sleep(500);
  await A.clickText("button", "Qwipo Logistics");
  await sleep(1200);
  await A.shot("13-connectors-done.png");

  await A.browser.close();
  console.log("DONE V2");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
