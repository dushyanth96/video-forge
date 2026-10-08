// best_slot.mjs — imprime the NEXT best hour (ET) libre as ISO UTC, for schedule.
// Hours: if existe best_hours.JSON (lo writes the reporte with the hours that MORE RINDEN by
// datos of the channel), uses esas; if not, the hours investigadas by defecto. Avoids chocar with the
// ocupadas (arg CSV), reparte in huecos and topa 2 by hour.
// Uso: node pipeline/best_slot.mjs [ocupadas_iso_csv]
import fs from "node:fs";
const occupied = (process.argv[2] || "").split(",").filter(Boolean).map((s) => Date.parse(s)).filter((n) => !isNaN(n));
// Hours by DATOS of the propio channel (best_hours.JSON) if the hay; if not, null -> research.
let DATA_HOURS = null;
try { const bh = JSON.parse(fs.readFileSync("best_hours.json", "utf8")); if (bh && Array.isArray(bh.hours) && bh.hours.length) DATA_HOURS = bh.hours; } catch {}

function etOffsetHours(d) {
  try { const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName").value; const m = s.match(/GMT([+-]?\d{1,2})/); return m ? parseInt(m[1], 10) : -4; } catch { return -4; }
}
// Slots (ET) by day. 6/day (blitz of Shorts, with tope 2/hour = 12 cupos/day). Pico day/tarde/noche EEUU.
function bestHoursET(dow) { if (dow === 0 || dow === 6) return [9, 11, 13, 15, 18, 20]; if (dow === 1) return [11, 13, 15, 17, 19, 21]; return [10, 12, 14, 16, 18, 20]; }

const now = Date.now(), minAhead = now + 2 * 3600 * 1000;
const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
let slots = [];
for (let day = 0; day < 21; day++) {
  const probe = new Date(now + day * 86400 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(probe);
  const y = +parts.find((p) => p.type === "year").value, mo = +parts.find((p) => p.type === "month").value, da = +parts.find((p) => p.type === "day").value;
  const dow = dowMap[parts.find((p) => p.type === "weekday").value] ?? 2;
  const off = etOffsetHours(probe);
  for (const h of (DATA_HOURS || bestHoursET(dow))) slots.push(Date.UTC(y, mo - 1, da, h - off, 0, 0));
}
slots.sort((a, b) => a - b);
// Cuantos already programados caen in the SAME hour (±30 min) of esta slot.
const nearCount = (s) => occupied.filter((o) => Math.abs(o - s) < 30 * 60 * 1000).length;
// Pase 1: first slot futura VACÍA -> reparte uniforme (1 by hour mientras haya huecos).
for (const s of slots) { if (s < minAhead) continue; if (nearCount(s) === 0) { process.stdout.write(new Date(s).toISOString()); process.exit(0); } }
// Pase 2: if ALL the slots already tienen 1, uso the first with less of 2 (TOPE = 2 by hour).
for (const s of slots) { if (s < minAhead) continue; if (nearCount(s) < 2) { process.stdout.write(new Date(s).toISOString()); process.exit(0); } }
process.stdout.write(new Date(now + 3 * 3600 * 1000).toISOString());
