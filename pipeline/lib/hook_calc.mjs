// hook_calc.mjs — HookNeuron PURO (Brain OS Phase 4b). Clasifica the TYPE of hook since the title
// and resume the memoria of hooks (ganadores vs fallidos). Heurístico: is a CLASIFICACIÓN that the
// sistema validates with datos (retención), not a true absoluta.

export function classifyHook(title) {
  const raw = title || "";
  const t = raw.trim().toLowerCase();
  if (!t) return "unknown";
  if (raw.includes("?") || /^¿/.test(raw.trim()) ||
      /^(why|how|what|when|who|where|which|can|does|is|are|do|did|would|should)\b/.test(t)) return "question";
  if (/^\$?\d/.test(t) || /^(top|the top)\b/.test(t)) return "number";
  if (/\b(secret|nobody|never|hidden|truth|actually|really|surprising|shocking)\b/.test(t)) return "curiosity";
  if (/\b(vs\.?|versus|before|after|instead)\b/.test(t)) return "contrast";
  return "statement";
}

// Memoria of hooks: by type -> cuántos, retención media to the 10% (hook_score) and caída inicial media.
// Only account videos that tienen curva of retención (the demás not miden the hook still).
export function summarizeHooks(episodes, retentionById) {
  const by = {};
  for (const e of episodes || []) {
    const ret = (retentionById || {})[e.video_id];
    if (!ret || !Number.isFinite(ret.hook_score)) continue;
    const k = classifyHook(e.title);
    (by[k] = by[k] || { count: 0, hook_scores: [], early_drops: [] });
    by[k].count++;
    by[k].hook_scores.push(ret.hook_score);
    if (Number.isFinite(ret.early_drop_pct)) by[k].early_drops.push(ret.early_drop_pct);
  }
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const out = {};
  for (const [k, v] of Object.entries(by)) {
    const hs = avg(v.hook_scores), ed = avg(v.early_drops);
    out[k] = {
      count: v.count,
      avg_hook_score: hs == null ? null : Math.round(hs * 1000) / 1000,
      avg_early_drop_pct: ed == null ? null : Math.round(ed),
    };
  }
  return out;
}
