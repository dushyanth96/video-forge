// make_review.mjs — arma el item de Review-Before-Upload (estado: pending).
//
// Uso: node pipeline/motiongfx/make_review.mjs <script.json> <video.mp4> <out review.json>
//      [r2Prefix]   (default "motiongfx/pending")
//
// El video YA esta renderizado; aqui solo se registra para revision.
// La subida a YouTube NO ocurre aqui: solo con el approve del owner.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createReview, newReviewId } from "../lib/review_queue.mjs";

const [scriptPath, videoPath, outPath, r2Prefix = "motiongfx/pending"] = process.argv.slice(2);
if (!scriptPath || !videoPath || !outPath) {
  console.error("uso: make_review.mjs <script.json> <video.mp4> <out review.json> [r2Prefix]");
  process.exit(1);
}
if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size < 10000) {
  console.error("video faltante o vacio"); process.exit(1);
}
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));

function probe(entry, args) {
  try { return execSync(`ffprobe -v error -show_entries ${entry} -of default=nw=1:nk=1 "${videoPath}"`).toString().trim(); } catch { return ""; }
}
const dur = parseFloat(probe("format=duration")) || 0;
const vtype = probe("stream=codec_type");
if (!vtype.includes("video")) { console.error("el MP4 no tiene pista de video"); process.exit(1); }

const id = newReviewId();
const r2Key = `${r2Prefix.replace(/^\/+|\/+$/g, "")}/${id}/video.mp4`;
const review = createReview({
  id,
  title: script.title || "Video Forge Explains",
  description: script.description || "",
  tags: script.tags || [],
  asset: { videoKey: r2Key, videoSize: fs.statSync(videoPath).size, durationSec: Math.round(dur) },
});
fs.mkdirSync(path.dirname(outPath) || ".", { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(review, null, 2));
console.log(`REVIEW PENDING -> ${outPath}`);
console.log(`  id: ${id} · ${Math.round(dur)}s · ${(review.asset.videoSize / 1e6).toFixed(1)}MB · r2: ${r2Key}`);
