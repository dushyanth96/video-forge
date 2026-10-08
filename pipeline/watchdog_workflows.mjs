// watchdog_workflows.mjs — vigila that the CRONS OF PRODUCCIÓN sigan vivos. Detecta tres muertes silenciosas:
//   1) DESACTIVADO: GitHub apaga the workflows with cron after 60 days or by fallos -> dejan of correr without avisar.
//   2) ATRASADO: the last run is more viejo that the tolerancia -> the cron is detuvo.
//   3) FAILS REPETIDO: 2+ of the últimos 3 runs fallaron -> something is rompió and not is auto-cura.
// Lee the API of Actions of the propio repo (token of Actions with permiso Actions:read).
// Outputs: wf_report.txt (legible) + wf_fail.txt (nº of problemas, for decidir if avisar).
import fs from "node:fs";

const REPO = process.env.GITHUB_REPOSITORY || "juanberrio0399/video-forge";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "video-forge-watchdog" };

// Workflows KEY + tolerancia of atraso (≈ intervalo of the cron × 2.5). If the last run is more viejo -> muerto.
const CRIT = [
  { f: "report_auto2.yml", label: "Reporte Oddly (feed de la app)", maxAgeH: 6 },   // cada 2h
  { f: "channel_report.yml", label: "Reporte Data Lens", maxAgeH: 16 },              // cada 6h
  { f: "space_short.yml", label: "Short de Espacio (Oddly)", maxAgeH: 30 },          // diario
  { f: "daily_oddly.yml", label: "Producción Oddly (cadencia)", maxAgeH: 30 },       // diario
  { f: "channel_brain.yml", label: "El Cerebro (salud)", maxAgeH: 30 },              // diario
  { f: "sync_playlists.yml", label: "Sync playlists", maxAgeH: 30 },                 // diario
  { f: "brain_optimize.yml", label: "El Cerebro (aprendizaje)", maxAgeH: 120 },      // lun+jue
  { f: "radar_scan.yml", label: "Radar — barrido semanal", maxAgeH: 216 },           // lunes (radar-bot)
  { f: "radar_groom.yml", label: "Radar — groomer", maxAgeH: 216 },                  // jueves (radar-bot)
  { f: "bilibili_repost.yml", label: "Repost Bilibili (Oddly)", maxAgeH: 30 },       // diario mediodía
];

async function jget(url) { const r = await fetch(url, { headers: H }); if (!r.ok) throw new Error(r.status + " " + (await r.text().catch(() => "")).slice(0, 80)); return r.json(); }

// Estado of cada workflow (active / disabled_inactivity / disabled_manually) by its nombre of file.
const states = {};
try { const wf = await jget(`https://api.github.com/repos/${REPO}/actions/workflows?per_page=100`); (wf.workflows || []).forEach((w) => { states[w.path.split("/").pop()] = w.state; }); } catch (e) { console.error("no pude listar workflows:", e.message); }

const lines = []; let fails = 0;
const now = Date.now();
for (const c of CRIT) {
  const st = states[c.f];
  if (st && st !== "active") { lines.push(`❌ ${c.label} (${c.f}): DESACTIVADO por GitHub (${st}) — el cron NO corre`); fails++; continue; }
  let runs;
  try { runs = (await jget(`https://api.github.com/repos/${REPO}/actions/workflows/${c.f}/runs?per_page=5`)).workflow_runs || []; }
  catch (e) { lines.push(`⚠️ ${c.label} (${c.f}): no pude leer runs (${e.message})`); continue; }
  if (!runs.length) { lines.push(`⚠️ ${c.label} (${c.f}): sin runs aún`); continue; }
  const ageH = (now - Date.parse(runs[0].created_at)) / 3.6e6;
  const done = runs.filter((r) => r.status === "completed").slice(0, 3);
  const failedN = done.filter((r) => r.conclusion === "failure").length;
  const problems = [];
  if (ageH > c.maxAgeH) problems.push(`atrasado (último hace ${ageH.toFixed(0)}h > ${c.maxAgeH}h) → el cron pudo detenerse`);
  if (failedN >= 2) problems.push(`falla repetido (${failedN}/${done.length} últimos)`);
  if (problems.length) { lines.push(`❌ ${c.label} (${c.f}): ${problems.join(" · ")}`); fails++; }
  else if (done[0] && done[0].conclusion === "failure") lines.push(`⚠️ ${c.label}: el último run falló (1 vez; espero al próximo antes de alarmar)`);
  else lines.push(`✅ ${c.label}: hace ${ageH.toFixed(0)}h, ${done[0]?.conclusion || "en curso"}`);
}

const report = lines.join("\n");
console.log("=== Watchdog de workflows de producción ===");
console.log(report);
console.log(`\nProblemas: ${fails}`);
fs.writeFileSync("wf_report.txt", report);
fs.writeFileSync("wf_fail.txt", String(fails));
