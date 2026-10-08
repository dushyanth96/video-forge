// evidence_rules.mjs — generates EVIDENCIA for the registro of hipótesis (Brain OS Phase 4b, §18).
// Honesto: cada regla compara a señal of the video contra the baseline of the channel (not opinión).
// PURO and testeable. Cierra the loop retención -> evidencia -> hipótesis.
import { classifyHook } from "./hook_calc.mjs";

function median(xs) {
  const a = (xs || []).filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// episodes: [{video_id, title, ...}] · retentionById: {video_id -> {early_drop_pct, hook_score, ...}}
// Devuelve [{hypothesis_id, direction:+1|-1, weight, episode_id, note}].
export function gatherEvidence(episodes, retentionById) {
  const eps = episodes || [];
  const ret = retentionById || {};
  const ev = [];
  // Baseline: mediana of the caída inicial (only videos with curva).
  const medDrop = median(eps.map((e) => (ret[e.video_id] || {}).early_drop_pct));
  if (medDrop == null) return ev;
  for (const e of eps) {
    const r = ret[e.video_id];
    if (!r || !Number.isFinite(r.early_drop_pct)) continue;
    // Hipótesis: the hooks with PREGUNTA mejoran the retención inicial.
    // Evidencia +1 if its caída inicial is <= the mediana of the channel; -1 if is worse.
    if (classifyHook(e.title) === "question") {
      ev.push({
        hypothesis_id: "global-question-hook",
        direction: r.early_drop_pct <= medDrop ? 1 : -1,
        weight: 1,
        episode_id: e.video_id,
        note: `hook=pregunta · caída inicial ${r.early_drop_pct}% vs mediana ${medDrop}%`,
      });
    }
  }
  return ev;
}
