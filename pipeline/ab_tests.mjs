// ab_tests.mjs — corre the to/B by cohortes about the videos already scoreados (Growth Phase 3).
// Lee scores.JSON (cada video trae hook_type + vs_baseline_pct + mature) and decide the ganador of
// cada experiment -> ab_tests.JSON. Nothing of producción cambia; is medición + veredicto.
// Uso: node pipeline/ab_tests.mjs <scores.json> <abOut.json>
import fs from "node:fs";
import { runExperiment } from "./lib/ab_test.mjs";

const [scoresF, outF] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const videos = (read(scoresF, {}).scores) || [];

// Experiments activos: A variable to the vez. Métrica = performance vs baseline of the channel (%).
const EXPERIMENTS = [
  { id: "hook_question_vs_statement", variable: "hook_type", metric: "vs_baseline_pct", variants: ["question", "statement"], min_per_variant: 4, min_lift: 20 },
  { id: "hook_curiosity_vs_statement", variable: "hook_type", metric: "vs_baseline_pct", variants: ["curiosity", "statement"], min_per_variant: 4, min_lift: 20 },
  // EXPERIMENT OF THE FORMATO (2026-10-03). Hipotesis: a HECHO concreto about A sujeto, corto
  // and with metraje real of ese sujeto, rinde more that a READY of 10-14 hechos genericos.
  // Of where sale: auditoria of the channel. 41 Shorts maduros medidos to mano dan mediana of 46
  // vistas; the unico that desperto was "Why Baby Otters Hold Hands" with 918 (20x), that is
  // justo ese formato. Is n=1, or sea a hipotesis, not a conclusion: by eso is mide.
  // min_lift alto (50%) to proposito: with 46 of mediana, a mejora chica is ruido.
  { id: "formato_un_hecho_vs_lista", variable: "variant", metric: "vs_baseline_pct", variants: ["un_hecho", "narrado"], min_per_variant: 5, min_lift: 50 },
];

const experiments = EXPERIMENTS.map((e) => runExperiment(videos, e));
const out = { at: new Date().toISOString(), n_videos: videos.length, experiments };
fs.writeFileSync(outF || "ab_tests.json", JSON.stringify(out, null, 2));

for (const r of experiments) {
  const parts = r.variants.map((v) => `${v}: n${r.measured[v] ? r.measured[v].n : 0} μ${r.measured[v] ? r.measured[v].mean : "—"}`).join(" vs ");
  console.log(`AB ${r.id}: ${parts} -> ${r.verdict}${r.lift != null ? ` (lift ${r.lift})` : ""}`);
}
