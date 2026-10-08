// ypp.mjs — Requisitos REALES of the YouTube Partner Program medidos by VENTANA (auditoría BR-01/02/03). PURO.
// Reemplaza the error of medir "vistas of Shorts" with the total histórico of the channel: the requisito is a
// ventana MÓVIL (Shorts: 90 days; hours vistas: 365 days, without Shorts). Dato ausente = null ("without dato"),
// NEVER cero. Evalúa dos niveles: intermedio (fan funding) and completo (anuncios), and the VIABILIDAD of
// llegar before of the plazo comparando the ritmo real with the necessary.
// Umbrales públicos to the fecha of diseño: confirmarlos in YouTube Studio for the país of the channel.

const DAY = 86400000;

export const YPP_TIERS = {
  expanded: {
    label: "Nivel intermedio",
    reqs: [
      { key: "subs", label: "Suscriptores", target: 500, kind: "stock" },
      { key: "uploads_90d", label: "Subidas públicas (90 días)", target: 3, kind: "rolling", window: 90 },
    ],
    either: [
      { key: "shorts_views_90d", label: "Vistas de Shorts (90 días)", target: 3000000, kind: "rolling", window: 90, pace_key: "shorts_views_per_day_28d" },
      { key: "watch_hours_365d", label: "Horas vistas sin Shorts (365 días)", target: 3000, kind: "rolling", window: 365, pace_key: "watch_hours_per_day_28d" },
    ],
  },
  full: {
    label: "Monetización completa",
    reqs: [{ key: "subs", label: "Suscriptores", target: 1000, kind: "stock" }],
    either: [
      { key: "shorts_views_90d", label: "Vistas de Shorts (90 días)", target: 10000000, kind: "rolling", window: 90, pace_key: "shorts_views_per_day_28d" },
      { key: "watch_hours_365d", label: "Horas vistas sin Shorts (365 días)", target: 4000, kind: "rolling", window: 365, pace_key: "watch_hours_per_day_28d" },
    ],
  },
};

// Orden of gravedad for agregar estados (menor = worse).
export const STATUS_RANK = { improbable: 0, sin_dato: 1, en_riesgo: 2, midiendo: 3, en_camino: 4, cumplido: 5 };
const num = (x) => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));

// Ritmo real of a métrica of STOCK (suscriptores): pendiente between snapshots with dato of the últimos
// `lookbackDays`, exigiendo a tramo mínimo for not extrapolar ruido of a day.
export function stockPace(history, key, nowMs, lookbackDays = 14, minSpanDays = 5) {
  const pts = (Array.isArray(history) ? history : [])
    .map((h) => ({ t: Date.parse(h && h.date), v: num(h && h[key]) }))
    .filter((p) => Number.isFinite(p.t) && p.v !== null && nowMs - p.t <= lookbackDays * DAY && p.t <= nowMs)
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const span = (b.t - a.t) / DAY;
  if (span < minSpanDays) return null;
  return (b.v - a.v) / span;
}

export function classify(ratio, done) {
  if (done) return "cumplido";
  if (ratio === null) return "midiendo";
  if (ratio >= 1) return "en_camino";
  if (ratio >= 0.5) return "en_riesgo";
  return "improbable";
}

// Evalúa A requisito. snap: {subs, Shorts_views_90d, ...}; history: snapshots diarios.
export function evaluateRequirement(req, snap = {}, history = [], opts = {}) {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const deadlineMs = opts.deadline ? Date.parse(opts.deadline) : null;
  const daysLeft = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - nowMs) / DAY)) : null;
  const cur = num(snap[req.key]);
  const base = { key: req.key, label: req.label, target: req.target, kind: req.kind, window: req.window || null };
  if (cur === null) return { ...base, cur: null, pct: null, status: "sin_dato", ratio: null, per_day_actual: null, per_day_needed: null };
  const done = cur >= req.target;
  const pct = Math.min(100, Math.round((cur / req.target) * 1000) / 10);
  let perDayActual = null, perDayNeeded = null, latestStart = null, paceSource = null;
  if (req.kind === "rolling") {
    // Ventana móvil: hay that SOSTENER target/window by day durante all the ventana. The ritmo ACTUAL is
    // mide with the últimos 28 days if existe (in a channel joven, promediar the ventana entera lo subestima).
    perDayNeeded = req.target / req.window;
    const recent = req.pace_key ? num(snap[req.pace_key]) : null;
    perDayActual = recent !== null ? recent : cur / req.window;
    paceSource = recent !== null ? "28d" : "ventana";
    if (deadlineMs) latestStart = new Date(deadlineMs - req.window * DAY).toISOString().slice(0, 10);
  } else {
    const need = Math.max(0, req.target - cur);
    perDayNeeded = daysLeft ? need / daysLeft : need;
    perDayActual = stockPace(history, req.key, nowMs);
  }
  const ratio = done ? 1 : (perDayActual === null || !perDayNeeded ? null : Math.round((perDayActual / perDayNeeded) * 1000) / 1000);
  return {
    ...base, cur, pct, status: classify(ratio, done), ratio,
    per_day_actual: perDayActual === null ? null : Math.round(perDayActual * 100) / 100,
    per_day_needed: perDayNeeded === null ? null : Math.round(perDayNeeded * 100) / 100,
    latest_start: latestStart,
    pace_source: paceSource,
  };
}

// Agrega estados: cualquier "improbable" manda; luego falta de dato; luego riesgo.
export function worstStatus(statuses) {
  const s = statuses.filter(Boolean);
  if (!s.length) return "sin_dato";
  return s.slice().sort((a, b) => STATUS_RANK[a] - STATUS_RANK[b])[0];
}

// Evalúa a nivel: all the `reqs` + the BEST option of `either` (basta with a).
export function evaluateTier(tier, snap, history, opts = {}) {
  const reqs = tier.reqs.map((r) => evaluateRequirement(r, snap, history, opts));
  const options = (tier.either || []).map((r) => evaluateRequirement(r, snap, history, opts));
  const withData = options.filter((o) => o.status !== "sin_dato");
  const best = withData.length
    ? withData.slice().sort((a, b) => (STATUS_RANK[b.status] - STATUS_RANK[a.status]) || ((b.ratio || 0) - (a.ratio || 0)))[0]
    : options[0] || null;
  const all = best ? [...reqs, best] : reqs;
  const pending = all.filter((r) => r.status !== "cumplido" && r.ratio !== null);
  const limiting = pending.slice().sort((a, b) => a.ratio - b.ratio)[0] || all.find((r) => r.status === "sin_dato") || null;
  return { label: tier.label, status: worstStatus(all.map((r) => r.status)), reqs, options, best_option: best ? best.key : null, limiting: limiting ? limiting.key : null };
}

// Evaluación completa of the channel: niveles, next hito and viabilidad frente to the plazo.
export function evaluateYpp(snap, history, opts = {}) {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const deadline = opts.deadline || "2026-12-31";
  const o = { nowMs, deadline };
  const expanded = evaluateTier(YPP_TIERS.expanded, snap || {}, history || [], o);
  const full = evaluateTier(YPP_TIERS.full, snap || {}, history || [], o);
  const next = expanded.status === "cumplido" ? "full" : "expanded";
  return {
    at: new Date(nowMs).toISOString(), deadline,
    days_left: Math.max(0, Math.ceil((Date.parse(deadline) - nowMs) / DAY)),
    tiers: { expanded, full },
    next_milestone: next,
    // Viabilidad of the META elegida (Oddly: nivel intermedio by decisión of Juan); the completa queda aparte.
    feasibility: (opts.goalTier === "expanded" ? expanded : full).status,
    feasibility_full: full.status,
    goal_tier: opts.goalTier === "expanded" ? "expanded" : "full",
    goal_label: YPP_TIERS[opts.goalTier === "expanded" ? "expanded" : "full"].label,
    missing: [...new Set([...expanded.reqs, ...expanded.options, ...full.reqs, ...full.options].filter((r) => r.status === "sin_dato").map((r) => r.key))],
  };
}
