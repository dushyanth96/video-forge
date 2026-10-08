// plan_capacity.mjs — recorta the plan diario to the cupos that caben in the buffer (~24-30h) and writes
// the photo of the queue (Brain OS: loop of learning apretado). If the queue already is llena, deja the
// plan vacío -> today not is produce and the queue DRENA (the brain ve results to ~1 day, not to ~1 week).
// Uso: node pipeline/plan_capacity.mjs <plan.txt> <occupiedCsv> <bufferHours> <queueOut.json> [perSlot]
//   perSlot: 1 = ritmo cómodo; 2 = AGRESIVO (12/day, when the Brain dice that the channel va atrás).
//   Imprime in stdout the nº of cupos libres (for presupuestar también the clips).
import fs from "node:fs";
import { freeSlotsInWindow } from "./lib/queue.mjs";

const [planFile, occCsv, bufferArg, queueOut, perSlotArg] = process.argv.slice(2);
const bufferHours = +bufferArg || 30;
const perSlot = +perSlotArg || 1;

let dataHours = null;
try { const bh = JSON.parse(fs.readFileSync("best_hours.json", "utf8")); if (bh && Array.isArray(bh.hours) && bh.hours.length) dataHours = bh.hours; } catch {}

const q = freeSlotsInWindow(occCsv || "", { bufferHours, dataHours, perSlot });

let lines = [];
try { lines = fs.readFileSync(planFile, "utf8").split("\n").filter((l) => l.trim()); } catch {}
const keep = Math.max(0, Math.min(lines.length, q.free));
const trimmed = lines.slice(0, keep);
fs.writeFileSync(planFile, trimmed.length ? trimmed.join("\n") + "\n" : "");

const queue = {
  at: new Date().toISOString(),
  buffer_hours: bufferHours,
  per_slot: q.per_slot,
  aggressive: q.per_slot >= 2,
  free_slots: q.free,
  scheduled_ahead: q.scheduled_ahead,
  first_publish_at: q.first_publish_at,
  last_publish_at: q.last_publish_at,
  planned_today: lines.length,
  produced_today: keep,
  skipped_today: lines.length - keep,
  note: "Producción topada a la capacidad del buffer: si la cola está llena hoy no se produce y drena (loop de aprendizaje ~1 día).",
};
if (queueOut) fs.writeFileSync(queueOut, JSON.stringify(queue, null, 2));

console.error(`plan_capacity: cola ${q.scheduled_ahead} agendados (hasta ${q.last_publish_at || "—"}) · cupos libres ${q.free} · plan ${lines.length}->${keep}`);
process.stdout.write(String(q.free)); // el workflow lo captura para presupuestar los clips
