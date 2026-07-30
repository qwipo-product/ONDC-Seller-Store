// Video 3: Serviceability — delivery beats on MAHADEVA ENTERPRISES.
const path = require("path");
const { launch } = require("./capture-lib");

(async () => {
  const A = await launch(path.join(__dirname, "frames-v3"));
  const { page, sleep } = A;

  // Slides
  await A.slide("v3-intro.html", "01-intro.png");
  await A.slide("v3-challenge.html", "02-challenge.png");
  await A.slide("v3-what-is-beat.html", "03-what-is-beat.png");
  await A.slide("v3-mobile.html", "09-mobile.png");
  await A.slide("v3-rules.html", "10-rules.png");
  await A.slide("v3-outro.html", "11-outro.png");

  await A.login();

  // ---------- Serviceability tab with seeded beats ----------
  await A.goto("/admin/users/seller-prod-mahadeva");
  await sleep(800);
  await A.clickText('[role="tab"]', "Serviceability");
  await sleep(1000);
  await A.shot("04-serviceability-tab.png");

  // ---------- Map view for the company's beats ----------
  await A.clickText('[role="button"]', "Map");
  await sleep(3500); // let leaflet tiles load
  await A.shot("05-map-view.png");
  // close the dialog (X button or Escape)
  await page.keyboard.press("Escape");
  await sleep(600);

  // ---------- Add beat dialog (empty) ----------
  await A.clickText('[role="button"]', "Add beats");
  await page.waitForSelector('input[placeholder="e.g. KPHB 1"]', { timeout: 5000 });
  await sleep(500);
  await A.shot("06-add-beat-empty.png");

  // ---------- Fill the beat ----------
  // Company (pre-filled when opened from the company row; select defensively)
  const comboOpen = await page.$$eval("button", (els) =>
    els.some((e) => e.textContent && e.textContent.includes("Search company linked")),
  );
  if (comboOpen) {
    await A.clickText("button", "Search company linked");
    await page.waitForSelector("[cmdk-input]", { timeout: 5000 });
    await page.type("[cmdk-input]", "Mahadev", { delay: 40 });
    await sleep(400);
    await A.clickText("[cmdk-item]", "Mahadev All Brands");
    await sleep(400);
  }
  await A.typeInto('input[placeholder="e.g. KPHB 1"]', "Bachupally 1");
  // Delivery days — chips named by weekday
  await A.clickText("button", "Monday");
  await A.clickText("button", "Thursday");
  await sleep(200);
  // Polygon upload
  const fileInputs = await page.$$('input[type="file"]');
  const fileInput = fileInputs[fileInputs.length - 1];
  await fileInput.uploadFile(path.join(__dirname, "bachupally-1.geojson"));
  await sleep(1500); // validation + preview map tiles
  await A.scrollToCenter('input[placeholder="e.g. KPHB 1"]');
  await sleep(1500);
  await A.shot("07-add-beat-filled.png");

  // ---------- Save ----------
  await A.clickText("button", "Save");
  await sleep(1500);
  await A.scrollToCenter("span", "Bachupally 1").catch(() => {});
  await A.shot("08-beat-saved.png");

  await A.browser.close();
  console.log("DONE V3");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
