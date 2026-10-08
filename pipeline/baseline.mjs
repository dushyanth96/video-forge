// baseline.mjs — BaselineNeuron (Phase 1). Lee weekly_stats.JSON and writes the baseline by channel:
//   baseline.JSON        (Data Lens)  -> the workflow lo uploads to channel/baseline.JSON
//   baseline_auto2.JSON  (Oddly)      -> the workflow lo uploads to channel/auto2/baseline.JSON
// Allows juzgar cada video/week by performance RELATIVO (+X% vs baseline) in vez of umbrales fijos.
// Uso: node pipeline/baseline.mjs [weekly_stats.json]
import fs from "node:fs";
import { computeBaseline } from "./lib/baseline_calc.mjs";

const src = process.argv[2] || "weekly_stats.json";
let data = {};
try { data = JSON.parse(fs.readFileSync(src, "utf8")); }
catch (e) { console.error("baseline: no pude leer", src, "-", e.message); process.exit(0); }

const chans = (data && data.channels) || {};
function write(chKey, file) {
  const c = chans[chKey];
  if (!c) { console.log(`baseline: sin datos de ${chKey} (omito)`); return; }
  const b = { channel: c.name || chKey, at: new Date().toISOString(), ...computeBaseline(c.weeks || []) };
  fs.writeFileSync(file, JSON.stringify(b, null, 2));
  console.log(`baseline ${chKey}: mediana ${b.median_weekly_views} vistas/sem sobre ${b.weeks_used} sem -> ${file}`);
}
write("data_lens", "baseline.json");
write("oddly", "baseline_auto2.json");
