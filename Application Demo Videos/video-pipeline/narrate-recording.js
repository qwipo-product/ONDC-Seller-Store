// Adds time-synced Hindi narration over the user's screen recording.
// Keeps the original video track untouched (-c:v copy), replaces audio.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("ffmpeg-static");

const INPUT = "C:\\Users\\User\\Videos\\Screen Recordings\\Screen Recording 2026-07-21 142439.mp4";
const OUT_DIR = path.join(__dirname, "rec-audio");
const OUTPUT = path.join(__dirname, "output-onboarding.mp4");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Timeline mapped from sampled frames (video is 1:59).
// Each segment: narration starts at `start` sec; should finish before next start.
const SEGMENTS = [
  {
    start: 0.2,
    text: "नमस्ते! ये है Qwipo Retailer App — ONDC DigiDukaan से powered। आज देखेंगे — नया retailer register और KYC कैसे करता है। Qwipo app खोलिए।",
  },
  {
    start: 15.8,
    text: "Login बहुत ही simple है — अपना mobile number डालिए और Get OTP पर click कीजिए। OTP आते ही डालिए, और Verify। बस — ना password, ना username।",
  },
  {
    start: 31,
    text: "पहली बार आने पर onboarding screen खुलती है। Shop location GPS से अपने आप fetch हो जाती है — बस एक tap। फिर business का नाम और business type चुनकर Proceed कीजिए।",
  },
  {
    start: 48,
    text: "और ये रहा home page — Wholesalers, Authorised Distributors, deals और offers। लेकिन ordering शुरू करने से पहले, ऊपर नीले Complete KYC button पर click कीजिए।",
  },
  {
    start: 63,
    text: "KYC के दो आसान steps हैं। पहला — basic information: आपका नाम, email, business type, और shop location — जो GPS से आ जाती है। फिर Next।",
  },
  {
    start: 80,
    text: "दूसरा step — ID proofs। Shop की photo upload कीजिए, shop owner का photo ID — जैसे Aadhaar card। GST certificate और shop registration optional हैं। नीचे Terms of Use agree करके Register पर click कीजिए।",
  },
  {
    start: 103,
    text: "बस — registration पूरा! अब retailer home page से order करना शुरू कर सकता है। इतना आसान है Qwipo पर onboarding। धन्यवाद!",
  },
];

function run(args) {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error("ffmpeg failed\n" + (r.stderr || "").slice(-1200));
  return r;
}

function durationOf(file) {
  const r = spawnSync(ffmpeg, ["-i", file], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error("no duration for " + file);
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
}

(async () => {
  let MsEdgeTTS, OUTPUT_FORMAT;
  try {
    ({ MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts"));
  } catch {
    ({ MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts"));
  }

  // 1) Synthesize each segment
  for (let i = 0; i < SEGMENTS.length; i++) {
    const target = path.join(OUT_DIR, `${i}.mp3`);
    if (!fs.existsSync(target)) {
      const tts = new MsEdgeTTS();
      await tts.setMetadata("hi-IN-SwaraNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const tmp = path.join(OUT_DIR, `tmp-${i}`);
      fs.mkdirSync(tmp, { recursive: true });
      const res = await tts.toFile(tmp, SEGMENTS[i].text);
      fs.copyFileSync(res.audioFilePath, target);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    SEGMENTS[i].dur = durationOf(target);
    const next = SEGMENTS[i + 1] ? SEGMENTS[i + 1].start : 119;
    const slot = next - SEGMENTS[i].start;
    const fit = SEGMENTS[i].dur <= slot ? "OK " : "OVER";
    console.log(`seg ${i}: start=${SEGMENTS[i].start}s dur=${SEGMENTS[i].dur.toFixed(1)}s slot=${slot.toFixed(1)}s ${fit}`);
  }

  // 2) Mix: each clip delayed to its start over silence, then mux with video
  const inputs = [];
  const chains = [];
  SEGMENTS.forEach((s, i) => {
    inputs.push("-i", path.join(OUT_DIR, `${i}.mp3`));
    const ms = Math.round(s.start * 1000);
    chains.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`);
  });
  const mixInputs = SEGMENTS.map((_, i) => `[a${i}]`).join("");
  const filter = `${chains.join(";")};${mixInputs}amix=inputs=${SEGMENTS.length}:normalize=0[mix];[mix]apad[aout]`;

  run([
    "-y",
    "-i", INPUT,
    ...inputs,
    "-filter_complex", filter,
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy",
    "-c:a", "aac", "-ar", "24000", "-ac", "1", "-b:a", "96k",
    "-shortest",
    OUTPUT,
  ]);
  console.log("FINAL:", OUTPUT);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
