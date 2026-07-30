// Re-renders only the v3 mobile slide to frames-v3/09-mobile.png.
const path = require("path");
const { launch } = require("./capture-lib");

(async () => {
  const A = await launch(path.join(__dirname, "frames-v3"));
  await A.slide("v3-mobile.html", "09-mobile.png");
  await A.browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
