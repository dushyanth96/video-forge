// os_pulse_videoforge.mjs — PULSE of Video Forge for the AI OS. Only real data of the brain:
// plan of today/tomorrow (lineup), journal, ledger, year goal by window (monetization_report), YPP history
// and GitHub Actions runs. Video Forge is 100% automatic: its "needs" are only strategic decisions
// (never approve publications).
// Usage: node pipeline/os_pulse_videoforge.mjs <lineup.json> <journal.json> <ledger.json> <monet.json> <decision.json> <runs.json> <ypp_hist.json> <out.json>
import fs from "node:fs";
import { makePulse, validatePulse } from "./lib/os_contract.mjs";

const [lineupF, journalF, ledgerF, monetF, decisionF, runsF, yppHistF, outF] = process.argv.slice(2);
const rj = (f, d) => { try { const v = JSON.parse(fs.readFileSync(f, "utf8")); return v == null ? d : v; } catch { return d; } };
const now = Date.now();
const L = rj(lineupF, {});
const journal = rj(journalF, []);
const ledger = rj(ledgerF, []);
const monet = rj(monetF, {});
const decision = rj(decisionF, {});
// Only production: runs of main. A failure on a PR branch is not a failure of Video Forge.
const runs = rj(runsF, []).filter((r) => !r || r.headBranch == null || r.headBranch === "main");
const yppHist = rj(yppHistF, []);

const runsOf = (name) => (Array.isArray(runs) ? runs : []).filter((r) => r.workflowName === name).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
const lastRun = (name) => runsOf(name)[0] || null;
const runState = (r, active = "executing") => !r ? "idle" : r.status !== "completed" ? active : r.conclusion === "success" ? "completed" : r.conclusion === "failure" ? "failed" : "warning";

const T = L.today || { items: [], summary: {} };
const M = L.tomorrow || { items: [], summary: {} };
const oddly = (monet.channels && monet.channels.auto2) || {};
const ypp = oddly.ypp || null;
// Requirements of the chosen year-goal tier (Oddly: mid tier since 2026-09-14).
const full = ypp && ypp.tiers && ypp.tiers[(ypp && ypp.goal_tier) || "full"];
const shortsReq = full ? [...(full.reqs || []), ...(full.options || [])].find((r) => r.key === "shorts_views_90d") : null;
const subsReq = full ? (full.reqs || []).find((r) => r.key === "subs") : null;

// ---- Agents (status from real runs) ----
const brain = lastRun("Brain live (tomorrow's plan + continuous production)");
const produce = runsOf("Producir compilacion (Oddly Loop / canal auto)");
const producing = produce.filter((r) => r.status !== "completed");
const analytics = lastRun("Monetization Dashboard + Brain Report -> R2");
const trends = lastRun("Growth Radar (inteligencia de crecimiento YouTube)");
const agents = [
  { id: "content", name: "Content Agent", state: runState(brain, "thinking"), since: brain && brain.createdAt, detail: M.date ? `Plan for ${M.date}: ${(M.items || []).length} pieces` : "No plan yet" },
  { id: "publishing", name: "Publishing Agent", state: producing.length ? "executing" : ((M.summary || {}).programado ? "completed" : "idle"), since: producing[0] && producing[0].createdAt, detail: producing.length ? `${producing.length} production(s) in progress` : `${M.summary?.programado || 0} ready to go out on their own` },
  { id: "analytics", name: "Analytics Agent", state: runState(analytics, "analyzing"), since: analytics && analytics.createdAt, detail: shortsReq && shortsReq.cur != null ? `Shorts 90 days: ${shortsReq.cur.toLocaleString("es")}` : "Measuring" },
  { id: "trend", name: "Trend Agent", state: trends ? (trends.status !== "completed" ? "researching" : "observing") : "idle", since: trends && trends.createdAt, detail: "Weekly growth radar" },
];

// ---- Activity: the brain's log (real events) + execution failures ----
const AGENT_BY_KIND = { plan: "Content Agent", produccion: "Publishing Agent", autocritica: "Analytics Agent", ciclo: "Content Agent" };
// Without noise: if the log repeats the same text, keep only the most recent.
const seenText = new Set();
const journalRecent = (Array.isArray(journal) ? journal : []).slice(-60).reverse().filter((j) => { const k = String(j.text || ""); if (seenText.has(k)) return false; seenText.add(k); return true; }).slice(0, 20).reverse();
const activity = journalRecent.map((j) => ({ at: j.at, agent: AGENT_BY_KIND[j.kind] || "Content Agent", text: j.text, kind: j.kind, trust: "executed" }));
for (const r of (Array.isArray(runs) ? runs : []).filter((x) => x.conclusion === "failure" && now - Date.parse(x.createdAt) < 24 * 3600e3)) {
  activity.push({ at: r.updatedAt || r.createdAt, agent: "Orchestrator", text: `Failed: ${r.workflowName}`, kind: "error", trust: "executed", result: "review the run" });
}

// ---- Tasks: real productions ----
const tasks = produce.slice(0, 8).map((r) => ({
  id: String(r.databaseId), name: r.displayTitle && r.displayTitle !== r.workflowName ? r.displayTitle : "Produce Short", agent: "Publishing Agent",
  status: r.status === "queued" ? "QUEUED" : r.status !== "completed" ? "RUNNING" : r.conclusion === "success" ? "COMPLETED" : r.conclusion === "cancelled" ? "CANCELLED" : "FAILED",
  started: r.createdAt, updated: r.updatedAt, duration_s: r.status === "completed" ? (Date.parse(r.updatedAt) - Date.parse(r.createdAt)) / 1000 : null,
  result: r.status === "completed" && r.conclusion === "success" ? "Ready and in its slot" : null, next: r.status !== "completed" ? "Goes out on its own in its slot when done" : null, url: r.url,
}));

// ---- Decisions (only strategic) ----
const needs = [];
// The year goal was already decided by Juan (mid tier). Only asks for criterion again if the 28-day review fails.
const goalReview = L.oddly_goal && L.oddly_goal.review;
if (goalReview && goalReview.status === "FALLO") {
  needs.push({
    id: "vf-goal-review", title: "The interim milestone did not double the pace", severity: "warn", autonomy: "REVIEW",
    why: "The strategy of concentrating slots on the leader and testing hooks did not meet the 28-day criterion.",
    evidence: goalReview.verdict_note || "", impact: "Another strategy is needed for the year goal", risk: "high",
    actions: [{ id: "open-meta", label: "Review analysis", kind: "open" }],
  });
}
const dl = L.data_lens;
if (dl && dl.paused && dl.review_at && Date.parse(dl.review_at) - now < 3 * 86400e3) {
  needs.push({ id: "vf-datalens-review", title: "Data Lens pause review", severity: "info", autonomy: "REVIEW", why: "The 21-day weekly experiment window is met.", evidence: dl.best_views_so_far != null ? `Best experiment: ${dl.best_views_so_far} views (criterion ${dl.target_views_7d})` : "No measured experiments yet", actions: [{ id: "open-dl", label: "Review", kind: "open" }] });
}

// ---- Insights with qué/by qué/impacto/acción ----
const insights = [];
if (L.oddly_goal && shortsReq && shortsReq.per_day_actual != null) {
  const rv = L.oddly_goal.review;
  insights.push({
    what: `Year goal: ${L.oddly_goal.label}`,
    why: `28-day pace ${Math.round(shortsReq.per_day_actual).toLocaleString("es")}/day; the tier asks for ${Math.round(shortsReq.per_day_needed || 0).toLocaleString("es")}/day by ${ypp.deadline}`,
    impact: rv ? `First milestone: ${Math.round(rv.target_pace).toLocaleString("es")}/day by ${String(rv.review_at).slice(0, 10)}` : null,
    action: "Most slots to the leading niche and a couple of different hooks every week",
  });
}
const lead = (decision.candidates || []).filter((c) => c.sufficient).sort((a, b) => (b.rel || 0) - (a.rel || 0))[0];
if (lead && lead.rel != null) insights.push({ what: `${lead.label} performs ${lead.rel}× the channel median`, why: `Median of ${lead.median_vpd} views/day in 5-30 day videos`, impact: `Receives ${lead.slots} of ${decision.total} daily slots`, action: "Keep the split; reviewed in the ledger in 7 days", confidence: { value: lead.confidence, basis: `${lead.n} comparable videos` } });
const judged = (Array.isArray(ledger) ? ledger : []).filter((e) => e.status === "ACERTO" || e.status === "FALLO");
if (judged.length) { const hits = judged.filter((e) => e.status === "ACERTO").length; insights.push({ what: `The brain hit ${hits} of ${judged.length} judged decisions`, why: "Each decision is reviewed on its date against its own criterion", action: judged.length - hits >= 2 ? "Review the rules that failed" : "Keep measuring" }); }

// ---- Métricas with interpretación ----
const metrics = [];
if (shortsReq && shortsReq.cur != null) {
  metrics.push({ key: "shorts_views_90d", label: "Shorts views", value: shortsReq.cur, timeframe: "last 90 days", context: `requirement ${shortsReq.target.toLocaleString("es")}`, interpretation: `Pace ${Math.round(shortsReq.per_day_actual || 0).toLocaleString("es")}/day; needs ${Math.round(shortsReq.per_day_needed || 0).toLocaleString("es")}/day.`, series: (Array.isArray(yppHist) ? yppHist : []).map((h) => h.shorts_views_per_day_28d).filter((x) => x != null) });
}
if (subsReq && subsReq.cur != null) metrics.push({ key: "subs", label: "Subscribers", value: subsReq.cur, timeframe: "total", context: `requirement ${subsReq.target}`, interpretation: subsReq.per_day_actual != null ? `Pace ${subsReq.per_day_actual}/day; needs ${subsReq.per_day_needed}/day.` : "Measuring the pace with the daily history.", series: (Array.isArray(yppHist) ? yppHist : []).map((h) => h.subs).filter((x) => x != null) });

// ---- Estado y titular ----
const failures = (Array.isArray(runs) ? runs : []).filter((r) => r.conclusion === "failure" && now - Date.parse(r.createdAt) < 6 * 3600e3);
const ready = (T.summary || {}).programado || 0, tomorrowReady = (M.summary || {}).programado || 0;
let status = needs.length ? "attention" : "normal";
if (failures.length >= 3) status = "critical"; else if (failures.length) status = status === "normal" ? "attention" : status;
const headline = producing.length ? `Producing ${producing.length} piece${producing.length > 1 ? "s" : ""} for tomorrow`
  : tomorrowReady ? `${tomorrowReady} Shorts ready for tomorrow` : ready ? `${ready} Shorts go out today on their own` : "Plan in preparation";
const sub = ypp ? `All automatic. Year goal: ${(ypp.goal_label || "monetization").toLowerCase()}${ypp.feasibility === "improbable" ? ", far from the current pace" : ""}.` : "All automatic.";

const pulse = makePulse({ system: "video-forge", at: new Date(now).toISOString(), status, headline, sub, agents, activity, tasks, needs, insights, metrics }, now);
const v = validatePulse(pulse);
fs.writeFileSync(outF || "os_pulse_video-forge.json", JSON.stringify(pulse, null, 2));
console.log(`pulse video-forge: ${pulse.status} · "${pulse.headline}" · agents ${pulse.agents.length} · activity ${pulse.activity.length} · tasks ${pulse.tasks.length} · decisions ${pulse.needs.length} · insights ${pulse.insights.length} · valid ${v.ok}${v.ok ? "" : " (" + v.errors.join(", ") + ")"}`);
