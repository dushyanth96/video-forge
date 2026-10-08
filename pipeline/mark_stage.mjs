// mark_stage.mjs — marca etapas hechas by video in a registro (channel/videos.JSON).
// Only rastrea lo that NOT is deduce of YouTube: thumbnail and Shorts. (script/voice/render/seo
// is dan by hechos if the video already esta uploaded; published is lee in vivo of the channel.)
// Uso: node pipeline/mark_stage.mjs <videos.json> <video_id> "<title>" <etapas,csv>
import fs from "node:fs";

const [path, videoId, title = "", stagesCSV = ""] = process.argv.slice(2);
if (!videoId) process.exit(0);
let db = {};
try { db = JSON.parse(fs.readFileSync(path, "utf8")) || {}; } catch {}
const e = db[videoId] || { stages: {} };
if (title) e.title = title;
e.stages = e.stages || {};
for (const s of stagesCSV.split(",").map((x) => x.trim()).filter(Boolean)) e.stages[s] = true;
e.updated_at = new Date().toISOString();
db[videoId] = e;
fs.writeFileSync(path, JSON.stringify(db, null, 2));
console.log("registro:", videoId, "->", stagesCSV);
