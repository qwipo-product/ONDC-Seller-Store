// Assembles frames + Hindi narration into the final MP4.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("ffmpeg-static");

// Optional suffix arg, e.g. `node build-video.js -v2`
const SUFFIX = process.argv[2] || "";
const FRAMES = path.join(__dirname, "frames" + SUFFIX);
const AUDIO = path.join(__dirname, "audio" + SUFFIX);
const SEGS = path.join(__dirname, "segs" + SUFFIX);
fs.mkdirSync(SEGS, { recursive: true });

const scenes = JSON.parse(fs.readFileSync(path.join(__dirname, `narration${SUFFIX}.json`), "utf8"));

function run(args) {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + args.join(" ") + "\n" + (r.stderr || "").slice(-1500));
  return r;
}

function durationOf(file) {
  const r = spawnSync(ffmpeg, ["-i", file], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error("no duration for " + file);
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
}

const LEAD = 0.4;  // silence before narration starts on each scene
const TAIL = 0.8;  // silence after narration before the cut

const listFile = path.join(SEGS, "list.txt");
const lines = [];
let total = 0;

for (let i = 0; i < scenes.length; i++) {
  const n = String(i + 1).padStart(2, "0");
  const img = path.join(FRAMES, scenes[i].frame);
  const mp3 = path.join(AUDIO, `${n}.mp3`);
  const seg = path.join(SEGS, `${n}.mp4`);
  const dur = durationOf(mp3);
  const total_dur = +(dur + LEAD + TAIL).toFixed(2);

  run([
    "-y",
    "-loop", "1", "-framerate", "30", "-i", img,
    "-i", mp3,
    "-filter_complex", `[1:a]adelay=${LEAD * 1000}|${LEAD * 1000},apad[a]`,
    "-map", "0:v", "-map", "[a]",
    "-t", String(total_dur),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "24000", "-ac", "1", "-b:a", "96k",
    seg,
  ]);
  lines.push(`file '${seg.replace(/\\/g, "/")}'`);
  total += total_dur;
  console.log(`seg ${n}: ${total_dur}s (${scenes[i].frame})`);
}

fs.writeFileSync(listFile, lines.join("\n"));

const out = path.join(__dirname, `output${SUFFIX}.mp4`);
run(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", out]);
console.log(`FINAL: ${out} — ~${Math.round(total)}s total`);
