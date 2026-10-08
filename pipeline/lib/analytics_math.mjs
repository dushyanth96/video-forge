// analytics_math.mjs — utilidades PURAS of análisis (without red, without R2, deterministas).
// Base for the BASELINES of the Phase 1. NOT cambia ningún comportamiento existente:
// nadie lo importa still. Only aporta funciones testeables (semilla of the red of tests).

// Lunes (UTC) of the week ISO of a fecha "YYYY-MM-DD".
export function mondayUTC(dstr) {
  const dt = new Date(dstr + "T00:00:00Z");
  const back = (dt.getUTCDay() + 6) % 7; // 0 = lunes
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

// Mediana of a ready of números (ignora not-finitos). [] -> null.
export function median(values) {
  const xs = (values || []).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

// Delta % of a valor vs a base. Base 0 or inválida -> null.
export function pctVsBaseline(value, baseline) {
  const v = Number(value), b = Number(baseline);
  if (!Number.isFinite(v) || !Number.isFinite(b) || b === 0) return null;
  return Math.round(((v - b) / b) * 100);
}

// Confianza by tamaño of muestra (0..1): crece with n and satura. For "knowledge confidence" (Phase 1).
// n = k -> 0.5 ; n = 3k -> 0.75. Never supera 1.
export function sampleConfidence(n, k = 10) {
  const x = Math.max(0, Number(n) || 0);
  return Math.round((x / (x + k)) * 100) / 100;
}
