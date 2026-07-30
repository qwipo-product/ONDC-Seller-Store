// Generates Hindi narration (female Indian voice) per scene using Edge TTS.
const fs = require("fs");
const path = require("path");

// Optional suffix arg, e.g. `node tts.js -v2` → narration-v2.json + audio-v2/
// Optional third arg: voice name (default hi-IN-SwaraNeural).
const SUFFIX = process.argv[2] || "";
const VOICE = process.argv[3] || "hi-IN-SwaraNeural";
const AUDIO = path.join(__dirname, "audio" + SUFFIX);
fs.mkdirSync(AUDIO, { recursive: true });

(async () => {
  let MsEdgeTTS, OUTPUT_FORMAT;
  try {
    ({ MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts"));
  } catch {
    ({ MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts"));
  }

  const scenes = JSON.parse(fs.readFileSync(path.join(__dirname, `narration${SUFFIX}.json`), "utf8"));

  for (let i = 0; i < scenes.length; i++) {
    const n = String(i + 1).padStart(2, "0");
    const target = path.join(AUDIO, `${n}.mp3`);
    if (fs.existsSync(target)) { console.log(n, "exists, skipping"); continue; }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const tmpDir = path.join(AUDIO, `tmp-${n}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const res = await tts.toFile(tmpDir, scenes[i].text);
    const produced = res && res.audioFilePath ? res.audioFilePath : path.join(tmpDir, "audio.mp3");
    fs.copyFileSync(produced, target);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(n, "done", fs.statSync(target).size, "bytes");
  }
  console.log("ALL DONE");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
