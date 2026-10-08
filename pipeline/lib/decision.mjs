// decision.mjs — Engine of decisión of the Brain OS (Phase 5). PURO and testeable.
// Convierte lo that the neuronas already midieron (vistas/day, retención/hook, subs) in a
// RECOMPENSA rica in [0,1], puntúa cada candidato (expected_value/confidence/risk/cost/
// learning_value) and reparte the slots with a bandit Thompson (Beta) sembrado — así the
// exploración is principiada (the niches with pocos datos tienen posterior ancho and is
// prueban solos) en vez de proporcional-ganador ciego. Sin dependencias, determinista.
import { sampleConfidence } from "./analytics_math.mjs";

// --- RNG sembrado (mulberry32): determinista for tests and for estabilidad semanal. ---
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Semilla estable to partir of a texto (p. e.g.. the ISO-week): same week -> same reparto.
export function seedFrom(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str || "")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
// Saturación suave x/(x+1): ninguna métrica cruda domina; ref avoids dividir by yes same.
function sat(x, ref) { const v = Math.max(0, (+x || 0)) / (ref > 0 ? ref : 1); return v / (v + 1) * 2; }

// Recompensa rica in [0,1]: NOT only vistas — retención (hook) and crecimiento (subs) cuentan.
// m: { vpd, hook_score, subs_per_day }. ref: escalas of the channel { vpd, subs_per_day }.
// Renormaliza the pesos between the señales presentes (robusto to campos faltantes).
export function richReward(m = {}, ref = {}) {
  const W = { vpd: 0.5, hook: 0.3, subs: 0.2 };
  const parts = [];
  if (Number.isFinite(m.vpd)) parts.push([W.vpd, clamp01(sat(m.vpd, ref.vpd || 0))]);
  if (Number.isFinite(m.hook_score)) parts.push([W.hook, clamp01((+m.hook_score || 0) / 1.0)]);
  if (Number.isFinite(m.subs_per_day)) parts.push([W.subs, clamp01(sat(m.subs_per_day, ref.subs_per_day || 0))]);
  if (!parts.length) return 0;
  const wsum = parts.reduce((a, [w]) => a + w, 0);
  return clamp01(parts.reduce((a, [w, v]) => a + w * v, 0) / (wsum || 1));
}

// Posterior Beta a partir de (recompensa media, nº de muestras): pseudo-conteos.
// n=0 -> Beta(1,1) uniforme (máxima incertidumbre -> the bandit lo explora).
export function posterior(reward, samples) {
  const n = Math.max(0, +samples || 0);
  const r = clamp01(+reward || 0);
  return { alpha: 1 + r * n, beta: 1 + (1 - r) * n };
}

// Gamma(k,1) by Marsaglia-Tsang (valid k>=1; here alpha,beta>=1 always). or1,or2 of the RNG.
function gamma1(k, rand) {
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do {
      // normal estándar by Box-Muller with the RNG sembrado
      const u1 = Math.max(1e-12, rand()), u2 = rand();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.max(1e-12, rand());
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
// Muestra Beta(alpha,beta) = G(a)/(G(a)+G(b)).
export function sampleBeta(alpha, beta, rand) {
  const ga = gamma1(alpha, rand), gb = gamma1(beta, rand);
  return ga / (ga + gb || 1);
}

// Puntúa a candidato of way explicable (for logging/decision.JSON), without azar.
// c: { key, reward, samples, cost? }
export function scoreCandidate(c = {}) {
  const reward = clamp01(+c.reward || 0);
  const samples = Math.max(0, +c.samples || 0);
  const confidence = sampleConfidence(samples);       // 0..1, crece con la muestra
  const { alpha, beta } = posterior(reward, samples);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1)); // riesgo = varianza posterior
  const cost = Number.isFinite(c.cost) ? c.cost : 1;
  const learning_value = 1 - confidence;              // valor de información: alto si hay pocos datos
  return {
    key: c.key,
    expected_value: Math.round(reward * 1000) / 1000,
    confidence,
    risk: Math.round(variance * 1000) / 1000,
    cost,
    learning_value: Math.round(learning_value * 1000) / 1000,
    score: Math.round(reward * confidence * 1000) / 1000, // ranking explotación (el bandit hace el reparto real)
  };
}

// Reparto PORTFOLIO (for cadencia of contenido): proporcional to the score = reward*confidence.
// Descuenta the incertidumbre (a niche with 1 video with suerte NOT infla its cuota) but mantiene
// DIVERSIDAD — not colapsa to the #1 as the Thompson argmax. Determinista. Suma exacta by mayor-resto
// (Hamilton). minPerArm garantiza piso to the brazos elegibles.
// candidates: [{ key, reward, samples, cost?, eligible? }]. Devuelve { alloc, scores }.
export function proportionalByScore(candidates, total, opts = {}) {
  const cands = (candidates || []).filter((c) => c && c.key && c.eligible !== false);
  const T = Math.max(0, Math.floor(+total || 0));
  const alloc = {}; for (const c of cands) alloc[c.key] = 0;
  if (!cands.length || T === 0) return { alloc, scores: cands.map(scoreCandidate) };
  const scored = cands.map((c) => ({ key: c.key, s: Math.max(1e-6, scoreCandidate(c).score) }));
  const sum = scored.reduce((a, b) => a + b.s, 0) || 1;
  const quota = scored.map((x) => ({ key: x.key, exact: T * x.s / sum }));
  quota.forEach((q) => { alloc[q.key] = Math.floor(q.exact); });
  let used = Object.values(alloc).reduce((a, b) => a + b, 0);
  quota.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
  for (let i = 0; used < T; i++, used++) alloc[quota[i % quota.length].key]++; // reparte el resto
  const minPer = Math.max(0, Math.floor(+opts.minPerArm || 0));
  if (minPer > 0) {
    for (const c of cands) {
      while (alloc[c.key] < minPer) {
        const donor = Object.entries(alloc).sort((a, b) => b[1] - a[1])[0];
        if (!donor || donor[1] <= minPer || donor[0] === c.key) break;
        alloc[donor[0]]--; alloc[c.key]++;
      }
    }
  }
  return { alloc, scores: cands.map(scoreCandidate) };
}

// Reparte `total` slots between candidatos by Thompson sampling (a muestra Beta by ronda,
// the mayor θ is lleva the slot). Determinista with `seed`. minPerArm garantiza piso to the vivos.
// candidates: [{ key, reward, samples, eligible? }]. Devuelve { alloc, picks, scores }.
export function thompsonAllocate(candidates, total, opts = {}) {
  const cands = (candidates || []).filter((c) => c && c.key && c.eligible !== false);
  const T = Math.max(0, Math.floor(+total || 0));
  const alloc = {}; const picks = [];
  for (const c of cands) alloc[c.key] = 0;
  if (!cands.length || T === 0) return { alloc, picks, scores: cands.map(scoreCandidate) };
  const rand = rng(opts.seed != null ? opts.seed : 1);
  const post = cands.map((c) => ({ key: c.key, ...posterior(clamp01(+c.reward || 0), +c.samples || 0) }));
  for (let s = 0; s < T; s++) {
    let best = null, bestTheta = -1;
    for (const p of post) {
      const theta = sampleBeta(p.alpha, p.beta, rand);
      if (theta > bestTheta) { bestTheta = theta; best = p.key; }
    }
    alloc[best]++; picks.push(best);
  }
  // Piso mínimo by brazo elegible: roba slots to the that more tiene.
  const minPer = Math.max(0, Math.floor(+opts.minPerArm || 0));
  if (minPer > 0) {
    for (const c of cands) {
      while (alloc[c.key] < minPer) {
        const donor = Object.entries(alloc).sort((a, b) => b[1] - a[1])[0];
        if (!donor || donor[1] <= minPer || donor[0] === c.key) break;
        alloc[donor[0]]--; alloc[c.key]++;
      }
    }
  }
  return { alloc, picks, scores: cands.map(scoreCandidate) };
}
