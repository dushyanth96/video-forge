// decide.mjs — DecisionNeuron (Brain OS Phase 5). Lee lo that the neuronas already midieron for a
// channel and writes a REGISTRO of decisión explicable (channel/brain/decision.JSON): candidatos
// with recompensa rica + score (expected_value/confidence/risk/learning_value) + the reparto of
// slots recomendado by the bandit Thompson, sembrado by ISO-week (estable dentro of the week).
// Is the fuente that consumen the rebalance of the channel, the Mini App and the dashboard (Phase 6).
// Uso: node pipeline/decide.mjs <state.json> <decisionOut.json> [total] [weekTag]
import fs from "node:fs";
import { richReward, scoreCandidate, proportionalByScore } from "./lib/decision.mjs";

const [stateFile, outFile, totalArg, weekArg] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

// ISO-week (same week -> same semilla -> same reparto; not salta in cada corrida).
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const state = read(stateFile, {});
const week = weekArg || isoWeek(new Date());

// Construye candidatos since the ranking of niches (vistas/day + nº of videos = muestras).
// Soporta the way of Oddly (niche_ranking:[{label,avg_vpd,videos}]) and a genérica (ranking:[{key,vpd,samples}]).
const rows = state.niche_ranking || state.ranking || [];
const rawCands = rows.map((r) => ({
  key: r.key || r.label,
  label: r.label || r.key,
  vpd: Math.max(0, +r.avg_vpd || +r.vpd || 0),
  samples: Math.max(0, +r.videos || +r.samples || 0),
})).filter((c) => c.key);

const refVpd = Math.max(1, ...rawCands.map((c) => c.vpd));
const candidates = rawCands.map((c) => {
  const reward = richReward({ vpd: c.vpd }, { vpd: refVpd });
  return { ...c, reward, ...scoreCandidate({ key: c.key, reward, samples: c.samples }) };
});

const total = Math.max(0, Math.floor(+totalArg || 0)) ||
  Object.values(state.cadence?.shorts_per_category || {}).reduce((a, b) => a + (+b || 0), 0) || 8;

const { alloc } = proportionalByScore(
  candidates.map((c) => ({ key: c.key, reward: c.reward, samples: c.samples })),
  total,
);

const decision = {
  at: new Date().toISOString(),
  week, engine: "score(reward*confidence)", total,
  ref: { vpd: refVpd },
  // FACT: vpd/samples medidos. INFERENCE: reward/score/alloc of the engine (not opinión).
  candidates: candidates.sort((a, b) => b.score - a.score),
  recommended_allocation: alloc,
  note: "Reparto por confianza (score = vistas/dia * confianza), no proporcional-ciego. Nada de producción está obligado a seguirlo; el rebalance del canal lo consume con fallback.",
};

fs.writeFileSync(outFile || "decision.json", JSON.stringify(decision, null, 2));
const line = candidates.map((c) => `${c.key} r=${c.reward.toFixed(2)}(n${c.samples})->${alloc[c.key] || 0}`).join(" · ");
console.log(`decide[${week}] total=${total}: ${line}`);
