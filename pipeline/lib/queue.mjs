// queue.mjs — capacidad of publishing / profundidad of queue (Brain OS). PURO and testeable.
// Cierra the cuello of the loop of learning: if already hay >~1 day agendado, NOT is produce more (the queue
// drena and the brain ve results to ~1 day in vez of to ~1 week). Same grilla of hours that
// best_slot.mjs (6 slots ET/day, tope conceptual 1 by slot for not amontonar 2/hour of golpe).
const DAY = 86400000;

// Offset ET (maneja horario of verano) for a fecha dada.
export function etOffsetHours(d) {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
      .formatToParts(d).find((p) => p.type === "timeZoneName").value;
    const m = s.match(/GMT([+-]?\d{1,2})/); return m ? parseInt(m[1], 10) : -4;
  } catch { return -4; }
}
// Mismas slots that best_slot.mjs (6/day; fin of week / lunes / resto).
export function bestHoursET(dow) {
  if (dow === 0 || dow === 6) return [9, 11, 13, 15, 18, 20];
  if (dow === 1) return [11, 13, 15, 17, 19, 21];
  return [10, 12, 14, 16, 18, 20];
}

// Generates the slots (ms UTC) of the próximos `days` days, with hours of datos if is pasan.
export function generateSlots(nowMs, days, dataHours) {
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const slots = [];
  for (let day = 0; day < days; day++) {
    const probe = new Date(nowMs + day * DAY);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(probe);
    const y = +parts.find((p) => p.type === "year").value, mo = +parts.find((p) => p.type === "month").value, da = +parts.find((p) => p.type === "day").value;
    const dow = dowMap[parts.find((p) => p.type === "weekday").value] ?? 2;
    const off = etOffsetHours(probe);
    for (const h of (dataHours && dataHours.length ? dataHours : bestHoursET(dow))) slots.push(Date.UTC(y, mo - 1, da, h - off, 0, 0));
  }
  return slots.sort((a, b) => a - b);
}

// Parsea the CSV of publishAt (lo emite scheduled_times.mjs) to ms futuros.
export function parseOccupied(csv, nowMs = Date.now()) {
  return String(csv || "").split(",").map((s) => Date.parse(s.trim())).filter((n) => !isNaN(n) && n > nowMs).sort((a, b) => a - b);
}

// Cupos LIBRES dentro of the ventana [now+minAheadH, now+bufferH]: slots without nothing agendado
// cerca (±30 min). Is cuántos videos NEW caben without pasar the buffer -> the tope of producción of today.
// Devuelve además the photo of the queue (for mostrarla and for "queue consciente").
export function freeSlotsInWindow(occupiedCsv, opts = {}) {
  const nowMs = opts.nowMs || Date.now();
  const bufferH = opts.bufferHours != null ? +opts.bufferHours : 30;
  const minAheadH = opts.minAheadHours != null ? +opts.minAheadHours : 2;
  const dataHours = opts.dataHours || null;
  // perSlot = cupos by slot: 1 = ritmo cómodo; 2 = AGRESIVO (uses the tope real 2/hour of best_slot).
  // When the channel va atrás of the meta, is uploads to 2 for not frenar the volumen agresivo (12/day).
  const perSlot = Math.max(1, Math.min(2, Math.floor(+opts.perSlot || 1)));
  const occ = Array.isArray(occupiedCsv) ? occupiedCsv.slice().sort((a, b) => a - b) : parseOccupied(occupiedCsv, nowMs);
  const minMs = nowMs + minAheadH * 3600000;
  const maxMs = nowMs + bufferH * 3600000;
  const days = Math.ceil(bufferH / 24) + 2;
  const slots = generateSlots(nowMs, days, dataHours);
  const nearCount = (s) => occ.filter((o) => Math.abs(o - s) < 30 * 60 * 1000).length;
  let free = 0;
  for (const s of slots) {
    if (s < minMs || s > maxMs) continue;
    free += Math.max(0, perSlot - nearCount(s)); // cupos libres en la franja (hasta perSlot)
  }
  const scheduledAhead = occ.length;
  const lastPublishAt = occ.length ? new Date(occ[occ.length - 1]).toISOString() : null;
  const firstPublishAt = occ.length ? new Date(occ[0]).toISOString() : null;
  return { free, buffer_hours: bufferH, per_slot: perSlot, scheduled_ahead: scheduledAhead, first_publish_at: firstPublishAt, last_publish_at: lastPublishAt };
}
