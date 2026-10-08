// os_orchestrator.mjs — ORCHESTRATOR of the AI OS. Normaliza with the contrato the pulses of Video Forge, Viento and
// Radar (lo that not cumple the contrato is descarta and is reporta), aplica "without señal" to the viejos and arma the
// GLOBAL that ven the tres Mini Apps: estado, titular, decisiones, actividad, tareas vivas and prioridad of the day.
// Uso: node pipeline/os_orchestrator.mjs <out_global.json> <pulse1.json> [pulse2.json ...]
//      Writes además os_pulse_<system>.norm.JSON by cada pulse valid.
import fs from "node:fs";
import { makePulse, mergeGlobal, validatePulse } from "./lib/os_contract.mjs";

const [outF, ...pulseFiles] = process.argv.slice(2);
const now = Date.now();
const pulses = [], problems = [];
for (const f of pulseFiles) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { problems.push(`${f}: ilegible o ausente`); continue; }
  if (!raw || !raw.system) { problems.push(`${f}: sin sistema`); continue; }
  try {
    const p = makePulse(raw, Date.parse(raw.at) || now);
    const v = validatePulse(p);
    if (!v.ok) problems.push(`${p.system}: ${v.errors.join(", ")}`);
    pulses.push(p);
    fs.writeFileSync(`os_pulse_${p.system}.norm.json`, JSON.stringify(p, null, 2));
  } catch (e) { problems.push(`${f}: ${e.message}`); }
}
const global = mergeGlobal(pulses, now, { maxAgeMin: 180 });
global.orchestrator = { pulses_ok: pulses.length, problems };
fs.writeFileSync(outF || "os_global.json", JSON.stringify(global, null, 2));
console.log(`orchestrator: ${global.status} · sistemas ${global.systems.map((s) => `${s.system}=${s.status}${s.stale ? "(sin señal)" : ""}`).join(" ")} · decisiones ${global.counts.needs} · activos ${global.counts.active}`);
if (problems.length) console.log(`  problemas: ${problems.join(" | ")}`);
