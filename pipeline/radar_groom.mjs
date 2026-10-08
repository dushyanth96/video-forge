// Radar_groom.mjs — CAPA 2 of the Brain of the Radar: in vez of ACUMULAR issues, MANTIENE the backlog
// limpio and MEJORÁNDOSE. Toma the issues `Radar` ABIERTOS of a repo, detecta the that are
// RELACIONADOS (same objetivo/área) and the CONSOLIDA in UNO only, more completo: actualiza the that is
// queda (the more antiguo) with the version combinada and cierra the redundantes with a enlace. Uses LLM free.
// Not toca issues that not sean `Radar`. Conservador: only fusiona lo claramente relacionado.
//
// Uso: node pipeline/radar_groom.mjs            (TARGET=owner/repo, GH_TOKEN, keys de llm.mjs)
import { genText } from "./llm.mjs";

const REPO = (process.env.TARGET || process.env.GITHUB_REPOSITORY || "").trim();
const TOKEN = process.env.GH_TOKEN;
if (!REPO || !TOKEN) { console.error("Falta TARGET o GH_TOKEN"); process.exit(2); }
const api = (path, opts = {}) => fetch(`https://api.github.com${path}`, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "radar-groom", ...(opts.headers || {}) } });

// 1) Traer the issues `Radar` ABIERTOS (without PRs).
const issues = [];
for (let page = 1; page <= 5; page++) {
  const r = await api(`/repos/${REPO}/issues?labels=radar&state=open&per_page=100&page=${page}`);
  if (!r.ok) { console.error(`GET issues ${r.status}`); break; }
  const j = await r.json();
  for (const it of j) if (!it.pull_request) issues.push({ number: it.number, title: it.title, body: (it.body || "").slice(0, 700) });
  if (j.length < 100) break;
}
console.log(`${REPO}: ${issues.length} issues radar abiertos`);
if (issues.length < 2) { console.log("nada que consolidar"); process.exit(0); }

// 2) LLM: agrupar the RELACIONADOS and consolidar. Conservador.
const PROMPT = `Eres el curador del backlog de un radar de mejoras de un repo. Te doy los issues ABIERTOS (etiqueta "radar"). Encuentra grupos de issues que estén CLARAMENTE RELACIONADOS (mismo objetivo, misma área, o uno es sub-parte/duplicado del otro) y que convenga UNIR en un solo issue mejor. Sé CONSERVADOR: si no están claramente relacionados, NO los agrupes. No inventes issues que no estén en la lista.

Para cada grupo, produce un issue CONSOLIDADO que combine y mejore el contenido de todos (más completo y accionable, sin perder nada útil). Conserva el estilo del radar (Descripción, Referencias/fuentes si las hay, ubicación en el repo, y un "Prompt para implementar" claro).

ISSUES ABIERTOS:
${issues.map((i) => `#${i.number} · ${i.title}\n${i.body}`).join("\n---\n")}

Devuelve SOLO JSON:
{"groups":[{"keep": <número del issue que se queda, elige el MÁS ANTIGUO = número más bajo del grupo>, "close": [<números a cerrar por quedar unidos>], "title": "<título consolidado, profesional, imperativo, sin emoji>", "body": "<cuerpo consolidado en Markdown: Descripción, Referencias (si hay), Ubicación, Prompt para implementar>"}]}
Si no hay nada que consolidar, devuelve {"groups":[]}.`;

const raw = await genText(PROMPT, { json: true });
let plan = { groups: [] };
if (raw) { try { plan = JSON.parse(raw); } catch (e) { console.error("JSON inválido:", e.message); } }
const groups = (plan.groups || []).filter((g) => g && g.keep && Array.isArray(g.close) && g.close.length && g.title && g.body);
if (!groups.length) { console.log("El curador no encontró grupos para consolidar."); process.exit(0); }

// 3) Aplicar: actualizar the "keep" with the version consolidada and cerrar the redundantes with enlace.
const valid = new Set(issues.map((i) => i.number));
let done = 0;
for (const g of groups) {
  if (!valid.has(g.keep)) continue;
  const closes = g.close.filter((n) => valid.has(n) && n !== g.keep);
  if (!closes.length) continue;
  const body = `${g.body}\n\n---\n_Consolidado por el radar desde: ${closes.map((n) => "#" + n).join(", ")}._`;
  const up = await api(`/repos/${REPO}/issues/${g.keep}`, { method: "PATCH", body: JSON.stringify({ title: g.title, body }) });
  if (!up.ok) { console.error(`PATCH #${g.keep} ${up.status}`); continue; }
  for (const n of closes) {
    await api(`/repos/${REPO}/issues/${n}/comments`, { method: "POST", body: JSON.stringify({ body: `Consolidated into #${g.keep} by the radar (backlog grooming).` }) });
    await api(`/repos/${REPO}/issues/${n}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "not_planned" }) });
    console.log(`  #${n} -> consolidado en #${g.keep}`);
  }
  done++;
}
console.log(`Consolidación lista: ${done} grupo(s) unido(s) en ${REPO}.`);
