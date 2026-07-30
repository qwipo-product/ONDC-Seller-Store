// Rebuilds the onboarding video in the series style:
// - crops the phone out of the user's screen recording (motion preserved)
// - places it on the branded 1920x1080 background
// - overlays scene-wise caption panels (timed)
// - lays the synced Hindi narration underneath
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("ffmpeg-static");
const puppeteer = require("puppeteer-core");

const INPUT = "C:\\Users\\User\\Videos\\Screen Recordings\\Screen Recording 2026-07-21 142439.mp4";
const SLIDES = path.join(__dirname, "slides");
const ASSETS = path.join(__dirname, "onb-assets");
const AUDIO = path.join(__dirname, "rec-audio");
const OUTPUT = path.join(__dirname, "output-onboarding-styled.mp4");
const DUR = 118.9;
fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(AUDIO, { recursive: true });

// Segments: narration + caption panel share the same window.
const SEGMENTS = [
  {
    start: 0.2, capUntil: 15.8, step: "Step 1 — App खोलिए",
    title: "Qwipo Retailer App — शुरुआत",
    bullets: [
      "📱|Phone पर <b>Qwipo app</b> खोलिए — ONDC DigiDukaan powered",
      "🟣|Splash के बाद सीधे login screen",
    ],
    text: "नमस्ते! ये है Qwipo Retailer App — ONDC DigiDukaan से powered। आज देखेंगे — नया retailer register और KYC कैसे करता है। Qwipo app खोलिए।",
  },
  {
    start: 15.8, capUntil: 31, step: "Step 2 — Login",
    title: "Mobile number + OTP — बस इतना ही",
    bullets: [
      "🔢|<b>Mobile number</b> डालिए → Get OTP",
      "✅|OTP डालकर <b>Verify</b> — ना password, ना username",
    ],
    text: "Login बहुत ही simple है — अपना mobile number डालिए और Get OTP पर click कीजिए। OTP आते ही डालिए, और Verify। बस — ना password, ना username।",
  },
  {
    start: 31, capUntil: 48, step: "Step 3 — On Boarding",
    title: "Shop की basic जानकारी",
    bullets: [
      "📍|<b>Shop location</b> — GPS से एक tap में fetch",
      "🏪|Business का नाम + <b>business type</b> → Proceed",
    ],
    text: "पहली बार आने पर onboarding screen खुलती है। Shop location GPS से अपने आप fetch हो जाती है — बस एक tap। फिर business का नाम और business type चुनकर Proceed कीजिए।",
  },
  {
    start: 48, capUntil: 63, step: "Step 4 — Home Page",
    title: "Home तैयार — पर पहले KYC",
    bullets: [
      "🏠|Wholesalers, Authorised Distributors, deals और offers",
      "🔵|Ordering से पहले — <b>Complete KYC</b> button पर click",
    ],
    text: "और ये रहा home page — Wholesalers, Authorised Distributors, deals और offers। लेकिन ordering शुरू करने से पहले, ऊपर नीले Complete KYC button पर click कीजिए।",
  },
  {
    start: 63, capUntil: 80, step: "Step 5 — KYC (1/2)",
    title: "Basic Information",
    bullets: [
      "👤|नाम, email, <b>business type</b>",
      "📍|Shop location — GPS से auto → <b>Next</b>",
    ],
    text: "KYC के दो आसान steps हैं। पहला — basic information: आपका नाम, email, business type, और shop location — जो GPS से आ जाती है। फिर Next।",
  },
  {
    start: 80, capUntil: 102.5, step: "Step 6 — KYC (2/2)",
    title: "ID Proofs upload",
    bullets: [
      "🖼️|<b>Shop photo</b> + owner का photo ID (जैसे Aadhaar)",
      "📄|GST certificate और shop registration — <b>optional</b>",
      "☑️|Terms agree करके <b>Register</b>",
    ],
    text: "दूसरा step — ID proofs। Shop की photo upload कीजिए, shop owner का photo ID — जैसे Aadhaar card। GST certificate और shop registration optional हैं। नीचे Terms of Use agree करके Register पर click कीजिए।",
  },
  {
    start: 102.5, capUntil: DUR, step: "Step 7 — Ready!",
    title: "Registration पूरा — distributors से जुड़िए",
    bullets: [
      "🎉|<b>Authorised Distributors</b> — approve हुए seller पर View Store",
      "⏳|बाक़ी पर Register / <b>In Progress</b> — यहीं से ordering शुरू",
    ],
    text: "बस — registration पूरा! Authorised Distributors में — approve हुए distributor पर View Store, बाक़ी पर Register या In Progress। यहीं से ordering शुरू। धन्यवाद!",
  },
];

function run(args) {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error("ffmpeg failed\n" + (r.stderr || "").slice(-1500));
}

function durationOf(file) {
  const r = spawnSync(ffmpeg, ["-i", file], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error("no duration for " + file);
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
}

(async () => {
  // ---------- 1) Render background + caption panels ----------
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--force-device-scale-factor=1", "--hide-scrollbars"],
  });
  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto("file:///" + path.join(SLIDES, "onboarding-bg.html").replace(/\\/g, "/"), { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(ASSETS, "bg.png") });

  await page.setViewport({ width: 1160, height: 640 });
  for (let i = 0; i < SEGMENTS.length; i++) {
    const s = SEGMENTS[i];
    const params = new URLSearchParams({ step: s.step, title: s.title });
    s.bullets.forEach((b, j) => params.set("b" + (j + 1), b));
    await page.goto(
      "file:///" + path.join(SLIDES, "onboarding-panel.html").replace(/\\/g, "/") + "?" + params.toString(),
      { waitUntil: "networkidle0" },
    );
    await page.screenshot({ path: path.join(ASSETS, `panel${i}.png`), omitBackground: true });
  }
  await browser.close();
  console.log("assets rendered");

  // ---------- 2) Narration clips (reuse cache; regen if text changed) ----------
  let MsEdgeTTS, OUTPUT_FORMAT;
  try {
    ({ MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts"));
  } catch {
    ({ MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts"));
  }
  for (let i = 0; i < SEGMENTS.length; i++) {
    const target = path.join(AUDIO, `${i}.mp3`);
    const hashFile = path.join(AUDIO, `${i}.txt`);
    const prev = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, "utf8") : "";
    if (!fs.existsSync(target) || prev !== SEGMENTS[i].text) {
      const tts = new MsEdgeTTS();
      await tts.setMetadata("hi-IN-SwaraNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const tmp = path.join(AUDIO, `tmp-${i}`);
      fs.mkdirSync(tmp, { recursive: true });
      const res = await tts.toFile(tmp, SEGMENTS[i].text);
      fs.copyFileSync(res.audioFilePath, target);
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.writeFileSync(hashFile, SEGMENTS[i].text);
      console.log(`tts ${i} regenerated`);
    }
    const dur = durationOf(target);
    const slot = (SEGMENTS[i + 1] ? SEGMENTS[i + 1].start : DUR) - SEGMENTS[i].start;
    console.log(`seg ${i}: start=${SEGMENTS[i].start}s dur=${dur.toFixed(1)}s slot=${slot.toFixed(1)}s ${dur <= slot ? "OK" : "OVER"}`);
  }

  // ---------- 3) Composite ----------
  const inputs = [
    "-loop", "1", "-framerate", "30", "-t", String(DUR), "-i", path.join(ASSETS, "bg.png"), // 0
    "-i", INPUT, // 1
  ];
  SEGMENTS.forEach((_, i) => inputs.push("-i", path.join(ASSETS, `panel${i}.png`))); // 2..8
  SEGMENTS.forEach((_, i) => inputs.push("-i", path.join(AUDIO, `${i}.mp3`))); // 9..15

  const parts = [];
  parts.push(`[1:v]crop=370:772:16:44,scale=450:940[ph]`);
  parts.push(`[0:v][ph]overlay=130:70[v0]`);
  SEGMENTS.forEach((s, i) => {
    const from = i === 0 ? 0 : s.start;
    parts.push(`[v${i}][${2 + i}:v]overlay=690:300:enable='between(t,${from},${s.capUntil})'[v${i + 1}]`);
  });
  parts.push(`[v${SEGMENTS.length}]format=yuv420p[vout]`);
  const audioParts = [];
  SEGMENTS.forEach((s, i) => {
    const ms = Math.round(s.start * 1000);
    audioParts.push(`[${2 + SEGMENTS.length + i}:a]adelay=${ms}|${ms}[a${i}]`);
  });
  const mixIn = SEGMENTS.map((_, i) => `[a${i}]`).join("");
  const filter =
    parts.join(";") + ";" + audioParts.join(";") + `;${mixIn}amix=inputs=${SEGMENTS.length}:normalize=0,apad[aout]`;

  run([
    "-y",
    ...inputs,
    "-filter_complex", filter,
    "-map", "[vout]", "-map", "[aout]",
    "-t", String(DUR),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30",
    "-c:a", "aac", "-ar", "24000", "-ac", "1", "-b:a", "96k",
    OUTPUT,
  ]);
  console.log("FINAL:", OUTPUT);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
