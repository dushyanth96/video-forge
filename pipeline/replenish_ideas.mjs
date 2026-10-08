// replenish_ideas.mjs — mantiene the queue of PROXIMOS videos ALWAYS with >=10 ideas by delante.
// If quedan less of 10 without producir, Gemini generates the that falten (alineadas to lo that funciona +
// tendencias, in INGLES, WITHOUT repetir topics already usados/planeados), with its n and fecha, and the agrega to
// state.upcoming. Asi the fabrica never is queda without ideas.
//
// Uso: node pipeline/replenish_ideas.mjs <state.json> <out_state.json> [produced.json] [target=10]
// Env: GEMINI_API_KEY. Optional: LEARNINGS (brief of lo that rinde) for alinear the ideas.
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [statePath, outPath, producedPath = "", targetArg = "10"] = process.argv.slice(2);
const TARGET = Math.max(1, parseInt(targetArg, 10) || 10);
const KEY = process.env.GEMINI_API_KEY;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
async function gemini(prompt) {
  if (!KEY) return null;
  for (let round = 0; round < 2; round++) {
    for (const m of TEXT_MODELS) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
        });
        if (r.status === 429 || r.status === 503) { await sleep(8000); continue; }
        if (!r.ok) continue;
        const j = await r.json();
        const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
        const arr = JSON.parse(t);
        if (Array.isArray(arr)) return arr;
        if (arr && Array.isArray(arr.ideas)) return arr.ideas;
      } catch {}
    }
  }
  return null;
}

const up = Array.isArray(state.upcoming) ? state.upcoming : [];
const published = Array.isArray(state.published) ? state.published : [];

// Cuantas quedan WITHOUT producir: fuera the already producidas (produced.JSON) and the cubiertas by
// the largos PUBLICOS. Eso is lo that hay "by delante".
let doneSet = new Set();
if (producedPath && fs.existsSync(producedPath)) {
  try { doneSet = new Set((JSON.parse(fs.readFileSync(producedPath, "utf8")).done) || []); } catch {}
}
const publicLongCount = published.filter((v) => v.privacy === "public").length;
const remaining = up.filter((u) => !doneSet.has(u.n) && u.n > publicLongCount);

const need = TARGET - remaining.length;
if (need <= 0) {
  fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
  console.log(`Cola OK: ${remaining.length} ideas por delante (objetivo ${TARGET}). No genero nada.`);
  process.exit(0);
}

// Avoid duplicados: all the topics already planeados + publicados.
const usedTitles = [...up.map((u) => u.topic), ...published.map((v) => v.title)].filter(Boolean);
const learn = (process.env.LEARNINGS || "").trim();
// DIRECCION of the channel (configurable). If existe channel/direction.JSON, generates in ese estilo;
// if not, cae to the estilo historico (money/negocios). Asi the channel is can PIVOTAR without tocar code.
let DIR = null;
try { DIR = JSON.parse(fs.readFileSync("channel/direction.json", "utf8")); } catch {}
const prompt = DIR
  ? `Eres estratega de un canal faceless de YouTube de DATOS en INGLES (mercado EE.UU.).\n` +
    `ESTILO/DIRECCION ACTUAL: ${DIR.style || ""}\n` +
    `Rota entre estas direcciones:\n${(DIR.directions || []).map((d) => `- ${d.desc}`).join("\n")}\n` +
    `Propon ${need} IDEAS NUEVAS de alta retencion, REPARTIDAS entre las direcciones, distintas y NO repetidas respecto a:\n- ${usedTitles.join("\n- ") || "(ninguna)"}\n` +
    (learn ? `\nLo que esta FUNCIONANDO (alinea a esto):\n${learn}\n` : "") +
    `\nDevuelve SOLO un array JSON de ${need} objetos: {"topic":"titulo en INGLES con cifra o gancho de curiosidad","why":"1 linea en ESPAÑOL de por que jala vistas"}.`
  : `Eres estratega de un canal faceless de YouTube de DATOS/DINERO en INGLES (mercado EE.UU.), estilo "how much money X makes".\n` +
    `Propon ${need} IDEAS NUEVAS de video (largas, alta retencion), distintas y NO repetidas respecto a estas ya usadas/planeadas:\n- ${usedTitles.join("\n- ") || "(ninguna)"}\n` +
    (learn ? `\nLo que esta FUNCIONANDO en el canal (alinea las ideas a esto):\n${learn}\n` : "") +
    `\nDevuelve SOLO un array JSON de ${need} objetos: {"topic":"titulo tentativo en INGLES (estilo curioso, con una cifra o gancho)","why":"1 linea en ESPAÑOL de por que jala vistas"}. Temas de dinero/negocios/plataformas que la gente de EE.UU. googlea.`;

const ideas = await gemini(prompt);
if (!ideas || !ideas.length) {
  fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
  console.log("No pude generar ideas (Gemini no respondio). Dejo la cola como estaba.");
  process.exit(0);
}

// Numeracion and fechas: seguir after of the mayor n and of the last fecha.
const maxN = Math.max(0, ...up.map((u) => +u.n || 0), publicLongCount);
let lastDate = up.map((u) => u.target_date).filter(Boolean).sort().pop();
let base = lastDate ? new Date(lastDate + "T00:00:00Z") : new Date();
if (isNaN(base.getTime())) base = new Date();

const added = [];
ideas.slice(0, need).forEach((idea, i) => {
  const topic = String(idea.topic || "").trim();
  if (!topic) return;
  base = new Date(base.getTime() + 3 * 24 * 3600 * 1000); // ~1 video cada 3 dias
  added.push({ n: maxN + 1 + i, topic, why: String(idea.why || "").trim(), target_date: base.toISOString().slice(0, 10), auto: true });
});

state.upcoming = [...up, ...added];
fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
console.log(`Cola rellenada: tenia ${remaining.length} por delante, agregue ${added.length} -> objetivo ${TARGET}.`);
added.forEach((a) => console.log(`  + #${a.n} ${a.topic} (${a.target_date})`));
