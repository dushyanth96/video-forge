// generate_script.mjs — script IN INGLES for motion graphics (channel SkillGroX).
//
// SkillGroX: Computer Science, System Architecture, Web/Cloud Engineering y
// AI Engineering. Tono preciso, autoritativo, alta densidad — cero relleno
// ("Hey guys!", "Welcome back" prohibidos).
//
// Estructura fija (Phase C): EXACTAMENTE 4 beats —
//   beat_1 hook       15-20s  problema / cuello de botella arquitectonico
//   beat_2 concept    50-65s  mecanica central (diagramas SVG animados)
//   beat_3 deep_dive  50-65s  bajo the capo, comparacion code/datos
//   beat_4 takeaway   15-20s  resumen + referencia a SkillGroX
// Total 120-180s (16:9 landscape): satisface AtoPlay (>60s) y YouTube.
//
// Rotacion autonoma: without topic (nor arg nor MOTIONGFX_TOPIC), elige the siguiente
// tema no usado de 4 pilares curados y lo registra en pipeline/data/past_topics.json
// for not repetir topic between corridas diarias (orden fijo = determinista).
//
// With GEMINI_API_KEY pide the script to Gemini; without the key uses a script
// deterministico incorporado (determinista = render reproducible).
//
// Uso: node pipeline/motiongfx/generate_script.mjs <out script.json> [topic]
// Env: GEMINI_API_KEY (optional), MOTIONGFX_TOPIC (topic by defecto)
import fs from "node:fs";
import path from "node:path";

const [outPath, topicArg] = process.argv.slice(2);
if (!outPath) { console.error("falta <out script.json>"); process.exit(1); }

// ---- Pilares curados (rotacion autonoma) ----
const PILLARS = [
  {
    pillar: "System Design",
    topics: ["Redis persistence", "B-Trees vs hash indexes", "Git internals", "Reverse proxies"],
  },
  {
    pillar: "Cloud & Web",
    topics: ["Docker namespaces", "WebSockets vs SSE", "edge workers", "cache invalidation"],
  },
  {
    pillar: "AI Engineering",
    topics: ["Vector databases", "LLM tokenizers", "local GGUF quantization"],
  },
  {
    pillar: "Modern Dev Growth",
    topics: ["Micro-SaaS architecture", "solo dev stack choices"],
  },
];
const ALL_TOPICS = PILLARS.flatMap((p) => p.topics.map((topic) => ({ topic, pillar: p.pillar })));

// ---- Estructura of beats: the unica way validates of script ----
const BEAT_SPEC = [
  { id: "beat_1", type: "hook", min: 15, max: 20, def: 18 },
  { id: "beat_2", type: "concept", min: 50, max: 65, def: 60 },
  { id: "beat_3", type: "deep_dive", min: 50, max: 65, def: 60 },
  { id: "beat_4", type: "takeaway", min: 15, max: 20, def: 18 },
];
const BEAT_TITLES = {
  hook: "The Bottleneck",
  concept: "How It Works",
  deep_dive: "Under the Hood",
  takeaway: "The Takeaway",
};

const HISTORY_PATH = path.join(import.meta.dirname, "..", "data", "past_topics.json");
const BASE_TAGS = ["SkillGroX", "Computer Science", "System Design", "Web Development"];
const CTA_URL = "https://skillgrox.com";
const WPS = 2.6; // palabras/segundo de narracion (mismo estimador que render.mjs)

// ---- Resolucion of the topic: arg CLI > MOTIONGFX_TOPIC > rotacion autonoma ----
function titleCase(t) {
  // Capitaliza only if the palabra empieza in minuscula: preserva siglas
  // (SSE, GGUF, LLM) y camel case (WebSockets, Micro-SaaS, B-Trees).
  return String(t).trim().replace(/\s+/g, " ")
    .split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

function readHistory() {
  try {
    const parsed = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed.map((t) => String(t)) : [];
  } catch {
    return []; // archivo ausente o corrupto = historial vacio
  }
}

// Elige the primer topic not used (orden fijo = determinista) and lo registra.
// If the 14 already is usaron, reinicia the ciclo since the principio.
function rotateTopic() {
  let history = readHistory();
  const used = new Set(history);
  let pick = ALL_TOPICS.find((t) => !used.has(t.topic));
  if (!pick) {
    history = [];
    pick = ALL_TOPICS[0];
    console.log("rotacion: los 14 temas ya se usaron — nuevo ciclo desde el principio");
  }
  history.push(pick.topic);
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");
  console.log(`rotacion autonoma: tema "${pick.topic}" (pilar: ${pick.pillar}) — registrado en past_topics.json`);
  return pick;
}

function pillarOf(topic) {
  const t = String(topic).toLowerCase();
  for (const p of PILLARS) {
    if (p.topics.some((x) => x.toLowerCase() === t)) return p.pillar;
  }
  return null;
}

const explicit = (topicArg || process.env.MOTIONGFX_TOPIC || "").trim();
const chosen = explicit
  ? { topic: explicit, pillar: pillarOf(explicit) }
  : rotateTopic();
const TOPIC = chosen.topic;
const PILLAR = chosen.pillar || "Custom";

// ---- Script deterministico of respaldo, by pilar ----
// ${T} is interpola with the topic elegido. Ingles preciso, ~150s, 4 beats.
const FALLBACKS = {
  "System Design": (T) => [
    {
      title: "The Wall Every System Hits",
      text: `Scale any system and you hit the wall, and it lives in the plumbing: ${T}. It looks like a detail, but it quietly sets your latency floor, your cost curve, and your worst-day reliability. Most teams discover it in production, at 3am. This is the tour they skipped.`,
    },
    {
      title: "The Trade-Off That Decides Everything",
      text: `The mechanics come down to one trade-off: work done up front, or work deferred until it hurts. ${T} sits exactly on that line. It is the layer that decides what gets computed, what gets stored, and what gets passed straight through — and that decision compounds. Picture a single request entering the system: it crosses this mechanism, and every microsecond spent there is paid by every user behind it, at every scale. An animated diagram traces that path: in, through the decision point, and back out. Watch where the milliseconds actually go. Most systems lose them not in one slow step, but in ten small ones that each look innocent. The structure of the mechanism — how it indexes, buffers, routes, or persists — determines whether those costs stay flat or grow with your traffic. Change the structure and the whole curve bends; ignore it and the curve bends you.`,
    },
    {
      title: "Two Implementations, One Workload",
      text: `Under the hood, the comparison is concrete. Take two ways to implement ${T} on the same workload: one optimizes for throughput, the other for tail latency. The difference shows up in the numbers that matter — cache misses, write amplification, memory pressure, recovery time — and can be an order of magnitude apart at p99. Benchmarks that report averages hide this; the tail is where users live. The honest trade-off has three variables: your read-write ratio, your recovery budget, and how much state you can afford to keep hot. Pick the structure that matches those, not the one with the best marketing chart. And measure on your own data, because the winner for one workload inverts on another. Every fast path is a deferred slow path: compaction, rebalancing, eviction, and failover collect a debt that comes due together. The implementations that survive budget that debt explicitly, spread it over time, and cap it before it caps you.`,
    },
    {
      title: "The Load-Bearing Decision",
      text: `The summary: ${T} is not a footnote — it is a load-bearing decision. Understand the mechanism, measure the tail, and revisit the structure before the growth curve revisits you. That is the SkillGroX standard: precise, under the hood, zero fluff. New deep dives every week at SkillGroX dot com.`,
    },
  ],
  "Cloud & Web": (T) => [
    {
      title: "The Abstraction Nobody Opens",
      text: `The internet runs on abstractions nobody opens, and ${T} is one of them. Get it wrong and the app works on your laptop but fails for ten million users. Get it right and latency drops, bills shrink, and incidents quiet down. That gap is this mechanism — under the hood, next.`,
    },
    {
      title: "What Runs Where",
      text: `The core mechanics start from an uncomfortable fact: the network is not a pipe, it is a constraint. ${T} is how engineers route around that constraint. It decides what runs where — in the browser, at the edge, or in the origin — and what state travels with each request. An animated diagram shows the journey: a client, a hop through the mechanism, and the response finding its way back. The subtle part is what stays where. Every byte of state must live somewhere, and every hop adds latency. The mechanism's job is to minimize the hops while keeping the state consistent, so the user gets one coherent conversation with a system that is actually dozens of machines negotiating in milliseconds. That negotiation is the design. When it is done well, failures become invisible; when it is not, they cascade.`,
    },
    {
      title: "The Crossover Point",
      text: `Under the hood, compare two real designs for ${T} on identical traffic. The first keeps everything centralized: simple to reason about, but every request pays the full round trip. The second pushes work closer to the user: faster tails, but distributed state that must be reconciled. The trade-off surfaces in cold starts, consistency windows, and the cost of invalidation — the moment your cached answer becomes a lie. Production numbers show the crossover precisely: below a certain request rate, simplicity wins; above it, distribution pays for itself. The honest metric is not average latency but the worst second of your worst hour. Design for that second and the average takes care of itself. Every distributed system is a bet on which failure is cheaper to survive — pick yours deliberately, measure it, and revisit it as traffic grows.`,
    },
    {
      title: "Where Systems Win or Lose",
      text: `The takeaway: ${T} is where cloud systems actually win or lose. Design for the worst second, keep state as close to the work as possible, and let the architecture absorb the growth. That is the SkillGroX standard — precise, under the hood, no fluff. New deep dives every week at SkillGroX dot com.`,
    },
  ],
  "AI Engineering": (T) => [
    {
      title: "The Hidden Cost Curve",
      text: `AI engineering has a hidden cost curve, and ${T} is where it bends. The demo works on a laptop; production breaks under traffic, data, and budgets. The difference is not the model — it is the machinery around it. Most teams learn that in production. This is the lesson they could have learned first.`,
    },
    {
      title: "Making Intelligence Fit the Budget",
      text: `The mechanics: ${T} is about making intelligence fit inside a budget. It starts with representation — how knowledge becomes numbers a machine can search, compare, or generate. An animated diagram traces one query: from raw input, through the mechanism, to a ranked result, with every step costing time and memory. The design tension is everywhere: recall versus precision, size versus speed, freshness versus stability. Each knob trades one for the other, and the right setting depends on what the system is asked to do. A search engine over millions of documents needs different trade-offs than a chat assistant over a fixed corpus. The mechanism is where those choices become physics — where abstractions meet the metal, and where small structural decisions compound into order-of-magnitude differences in cost and latency. That is where the budget is won.`,
    },
    {
      title: "The Numbers Decide",
      text: `Under the hood, the numbers decide. Compare two implementations of ${T} on the same workload: one optimized for accuracy, one for throughput. The gap lives in quantization error, memory bandwidth, index construction time, and the long tail of rare queries. Accuracy-optimized systems spend compute where it is rarely seen; throughput-optimized systems shave the expensive corners and measure what was lost. Production data shows the crossover clearly — past a certain query rate, the cheaper system wins on every metric that matters to users, including quality, because it can afford to rerank more. The trap is benchmarking on easy queries. Real traffic is a distribution: the rare, hard cases dominate cost. Measure the p99, budget for the tail, and size the mechanism for your worst hour, not your average one. The teams that win treat quality as a function of budget, not a promise.`,
    },
    {
      title: "Won in Production",
      text: `The takeaway: ${T} is where AI products are won or lost in production. Measure the tail, budget for the rare case, and treat every architectural knob as a trade — not a free lunch. That is the SkillGroX standard: precise, under the hood, zero fluff. New engineering deep dives every week at SkillGroX dot com.`,
    },
  ],
  "Modern Dev Growth": (T) => [
    {
      title: "The Solo Developer's Tax",
      text: `A solo developer ships faster than a team of ten — until the architecture decides otherwise. ${T} is where that decision is made. Choose wrong and every feature gets slower and every outage takes you offline. Choose right and one person can run a product that serves thousands. The difference is not effort — it is structure.`,
    },
    {
      title: "Optimize for the Team You Have",
      text: `The mechanics of ${T} start with a principle: optimize for the size of the team you have, not the team you imagine. That means boring technology, few moving parts, and one clear path from commit to customer. An animated diagram shows the stack as a pipeline: code, build, deploy, run — with the number of services you must babysit at each stage. Every additional service is a tax on attention, and attention is the solo developer's only scarce resource. The architecture that wins keeps the critical path short: a database, an app, a queue when you need one, and nothing else. Complexity should be added deliberately, one service at a time, each with a measured reason — never borrowed from a tutorial written for a company with a platform team.`,
    },
    {
      title: "Two Stacks, One Product",
      text: `Under the hood, compare two real stacks for ${T} on the same product. The first is maximalist: managed everything, auto-scaling, a service per concern. The second is minimal: one runtime, one database, static assets, scheduled jobs in cron. On identical traffic the bills differ by an order of magnitude — not because one is cheaper per unit, but because the maximalist stack charges for coordination: deployments, observability, and the cognitive load of distributed failure modes. The data comparison is blunt. Solo developers reliably out-ship on the minimal stack until traffic crosses a threshold that almost nobody reaches. The honest metric is features shipped per week, adjusted for incidents. Optimize that and the architecture disappears; chase hypotheticals and it consumes the roadmap. Complexity that nobody measured is debt that compounds silently — and the interest is paid in features never shipped.`,
    },
    {
      title: "A Decision About Attention",
      text: `The takeaway: ${T} is a decision about attention, not about hype. Ship on the smallest stack that works, add complexity only with a measured reason, and let the numbers — not the tutorials — drive the next service. That is the SkillGroX standard: precise, under the hood, no fluff. New deep dives every week at SkillGroX dot com.`,
    },
  ],
  Custom: (T) => [
    {
      title: "Past the Abstraction",
      text: `Most explanations stop at the abstraction. ${T} is what happens when you look past it — the mechanism that decides how the system actually behaves. It is where latency, cost, and reliability are set, long before anyone looks at a dashboard. This is the under-the-hood tour: precise, dense, and done in two minutes.`,
    },
    {
      title: "The Core Trade-Off",
      text: `The mechanics of ${T} come down to one trade-off: work done up front, or work deferred until it hurts. The mechanism sits exactly on that line. It decides what gets computed, what gets stored, and what gets passed straight through — and that decision compounds. An animated diagram traces a single operation: in, through the decision point, and back out. Watch where the time actually goes. Most systems lose it not in one slow step, but in ten small ones that each look innocent. The structure of the mechanism determines whether those costs stay flat or grow with scale. Change the structure and the whole curve bends; ignore it and the curve bends you. That is the whole subject, and the next beats show it with numbers.`,
    },
    {
      title: "The Honest Comparison",
      text: `Under the hood, the comparison is concrete. Take two ways to implement ${T} on the same workload: one optimizes for throughput, the other for tail latency. The difference surfaces in the numbers that matter — cache misses, write amplification, memory pressure, recovery time — and can be an order of magnitude apart at p99. Averages hide this; the tail is where users live. The honest trade-off has three variables: your read-write ratio, your recovery budget, and how much state you can keep hot. Pick the structure that matches those, not the one with the best marketing chart. Measure on your own data, because the winner for one workload inverts on another. Every fast path is a deferred slow path; the implementations that survive budget that debt explicitly and cap it before it caps you.`,
    },
    {
      title: "The SkillGroX Standard",
      text: `The summary: ${T} is a load-bearing decision, not a footnote. Understand the mechanism, measure the tail, and revisit the structure before the growth curve revisits you. That is the SkillGroX standard: precise, under the hood, zero fluff. New deep dives every week at SkillGroX dot com.`,
    },
  ],
};

function fallbackScript(topic, pillar) {
  const beats = (FALLBACKS[pillar] || FALLBACKS.Custom)(topic).map((b, i) => ({
    id: BEAT_SPEC[i].id,
    type: BEAT_SPEC[i].type,
    title: b.title,
    text: b.text,
    duration: BEAT_SPEC[i].def,
  }));
  return {
    title: `Under the Hood: How ${titleCase(topic)} Actually Works`,
    description: `Under the hood: how ${topic} actually works — the mechanics, the trade-offs, and the numbers that decide. A precise, high-density SkillGroX explainer for engineers who read past the abstraction. New deep dives on computer science, system architecture, cloud, and AI engineering every week at ${CTA_URL}.`,
    tags: [...BASE_TAGS],
    beats,
    source: "fallback",
    topic,
    pillar,
  };
}

// ---- Gemini (con GEMINI_API_KEY) ----
const PROMPT = `You are the head scriptwriter for SkillGroX, a faceless English YouTube channel about Computer Science, System Architecture, Web/Cloud Engineering and AI Engineering.
Tone: precise, authoritative, high-density. NEVER use filler ("Hey guys!", "Welcome back", "let's dive in") or hype. Every sentence must carry information.

TOPIC: ${TOPIC}
PILLAR: ${PILLAR}

Write a motion-graphics explainer, target 150 seconds of spoken narration (120-180s acceptable), EXACTLY 4 beats in this fixed order:
- beat_1 "hook" (15-20s, ~45 words): the problem / architectural bottleneck. A concrete, surprising fact or number.
- beat_2 "concept" (50-65s, ~140 words): the core mechanics — how it actually works under the hood, the kind of thing an animated SVG diagram would show.
- beat_3 "deep_dive" (50-65s, ~140 words): under the hood — code/data comparison, trade-offs, real numbers.
- beat_4 "takeaway" (15-20s, ~45 words): summary + a SkillGroX sign-off.

Rules:
- English ONLY. Plain, precise American English. Explain any jargon in one clause.
- Each beat is spoken narration. At least two beats contain a concrete number or percentage.
- No URLs in narration, no brand names, no copyrightable lyrics, no instructions that require on-screen text beyond captions.
- Title format: "Under the Hood: How <Concept> Actually Works".
- Description must end with a SkillGroX CTA that includes https://skillgrox.com.

Respond with ONLY a JSON object, no markdown, no commentary, exactly this shape:
{"title":"...","description":"...","tags":["SkillGroX","Computer Science","System Design","Web Development"],"beats":[{"type":"hook","title":"...","text":"..."},{"type":"concept","title":"...","text":"..."},{"type":"deep_dive","title":"...","text":"..."},{"type":"takeaway","title":"...","text":"..."}]}`;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Normaliza the output of Gemini to the schema exacto of Phase C.
// Devuelve null if not rinde exactamente 4 beats usables (the spec is fija).
function normalizeGemini(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const usable = (Array.isArray(parsed.beats) ? parsed.beats : [])
    .filter((b) => b && typeof b.text === "string" && b.text.trim());
  if (usable.length < BEAT_SPEC.length) return null;
  const four = usable.slice(0, BEAT_SPEC.length);
  if (usable.length !== BEAT_SPEC.length) {
    console.warn(`gemini dio ${usable.length} beats — tomando los primeros ${BEAT_SPEC.length}`);
  }
  const beats = four.map((b, i) => {
    const spec = BEAT_SPEC[i];
    const words = b.text.trim().split(/\s+/).length;
    const declared = parseFloat(b.duration);
    // Prefiere the duration declarada; if not the hay, estima by palabras.
    const duration = Number.isFinite(declared) && declared > 0
      ? clamp(Math.round(declared), spec.min, spec.max)
      : clamp(Math.round(words / WPS), spec.min, spec.max);
    return {
      id: spec.id,
      type: spec.type,
      title: typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 140) : BEAT_TITLES[spec.type],
      text: b.text.trim(),
      duration,
    };
  });
  // Forzar the CTA of SkillGroX in the description if Gemini lo omitio.
  let description = typeof parsed.description === "string" ? parsed.description.trim().slice(0, 4000) : "";
  if (!/skillgrox\.com/i.test(description)) {
    description = `${description.replace(/\s+$/, "")} More under-the-hood engineering deep dives from SkillGroX at ${CTA_URL}.`;
  }
  const title = typeof parsed.title === "string" && parsed.title.trim()
    ? parsed.title.trim().slice(0, 140)
    : `Under the Hood: How ${titleCase(TOPIC)} Actually Works`;
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String).filter(Boolean) : [];
  for (const t of BASE_TAGS) if (!tags.includes(t)) tags.push(t);
  return { title, description, tags: tags.slice(0, 12), beats };
}

async function viaGemini() {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) return null;
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  const url = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: PROMPT }] }],
    generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
  };
  for (const m of models) {
    try {
      const res = await fetch(url(m), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { console.error(`gemini ${m}: HTTP ${res.status}`); continue; }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { console.error(`gemini ${m}: sin texto en la respuesta`); continue; }
      const parsed = JSON.parse(text.replace(/^```(json)?/i, "").replace(/```$/, "").trim());
      const script = normalizeGemini(parsed);
      if (!script) { console.error(`gemini ${m}: estructura de beats invalida`); continue; }
      script.source = "gemini";
      script.topic = TOPIC;
      script.pillar = PILLAR;
      console.log(`guion via ${m}: ${script.beats.length} beats`);
      return script;
    } catch (e) {
      console.error(`gemini ${m}: ${e.message}`);
    }
  }
  return null;
}

// ---- Ensamblaje + autochequeo of the schema ----
let script = await viaGemini();
if (!script) script = fallbackScript(TOPIC, PILLAR);
script.duration_target = script.beats.reduce((s, b) => s + b.duration, 0);

// The spec is a contrato: validar before of write, fallar ruidoso in CI
// if something sale of the rango (never write a script invalid).
const problems = [];
if (script.beats.length !== BEAT_SPEC.length) problems.push(`beats != ${BEAT_SPEC.length}`);
script.beats.forEach((b, i) => {
  const spec = BEAT_SPEC[i];
  if (b.id !== spec.id || b.type !== spec.type) problems.push(`${b.id || i}: id/tipo invalido (esperado ${spec.id}/${spec.type})`);
  if (!(b.duration >= spec.min && b.duration <= spec.max)) problems.push(`${b.id}: duration ${b.duration} fuera de ${spec.min}-${spec.max}s`);
  if (!b.text || !b.text.trim()) problems.push(`${b.id}: sin texto`);
  if (!b.title || !b.title.trim()) problems.push(`${b.id}: sin titulo`);
});
if (!(script.duration_target >= 120 && script.duration_target <= 180)) problems.push(`duration_target ${script.duration_target} fuera de 120-180s`);
if (!/skillgrox\.com/i.test(script.description)) problems.push("description sin CTA de SkillGroX");
if (!Array.isArray(script.tags) || !script.tags.includes("SkillGroX")) problems.push("tags sin SkillGroX");
if (problems.length) {
  console.error("guion invalido: " + problems.join("; "));
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(script, null, 2));

const words = script.beats.reduce((s, b) => s + b.text.split(/\s+/).length, 0);
console.log(`guion -> ${outPath} (${script.beats.length} beats · ${script.duration_target}s · ~${words} palabras · fuente: ${script.source} · tema: ${TOPIC} · pilar: ${PILLAR})`);
