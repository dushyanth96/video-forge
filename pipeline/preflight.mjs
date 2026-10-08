// preflight.mjs — PRE-VUELO before of producir: validates that the herramientas CRITICAS esten OK.
// Retries lo transitorio (429/blips) some veces; if something CRITICO sigue caido, sale 1 (ABORTA)
// for NOT arrancar a produccion that fallaria to half. Asi "in produccion not hay errores".
// Stores tools_health.JSON (for the app) and preflight.JSON (motivo).
// Uso: node pipeline/preflight.mjs
// Env: GEMINI_API_KEY, PEXELS_API_KEY, YT_CLIENT_ID/SECRET/REFRESH
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const { GEMINI_API_KEY, PEXELS_API_KEY, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const tools = [];

// Chequeo with retries for lo transitorio. critical=true -> can abortar the produccion.
async function check(name, critical, fn, { retries = 3, wait = 20000 } = {}) {
  let detail = "";
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fn();
      if (r.ok) { tools.push({ name, ok: true, detail: r.detail || "OK", critical }); return; }
      detail = r.detail || "fallo";
    } catch (e) { detail = e.message; }
    if (i < retries) { console.log(`  ${name}: ${detail} -> reintento ${i + 1}/${retries} en ${wait / 1000}s`); await sleep(wait); }
  }
  tools.push({ name, ok: false, detail, critical });
}

// ---- CRITICOS (without esto the produccion fails) ----
await check("Gemini (guion/SEO)", true, async () => {
  if (!GEMINI_API_KEY) return { ok: false, detail: "sin API key" };
  // Test SEVERAL modelos (auto-adapta to the that responda), igual that the scripts reales -> not marca
  // caido only because a nombre of modelo dio 404. If alguno responde, Gemini esta OK.
  let saw429 = false;
  for (const m of TEXT_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }) });
    if (r.ok) return { ok: true, detail: `OK (${m})` };
    if (r.status === 429) saw429 = true;
  }
  return { ok: false, detail: saw429 ? "429 (cuota/transitorio)" : "ningun modelo respondio" };
});
await check("Kokoro (voz)", true, async () => {
  const r = await fetch("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin", { method: "HEAD", redirect: "follow" });
  return { ok: r.ok, detail: r.ok ? "modelos accesibles" : `HTTP ${r.status}` };
}, { retries: 2 });
await check("YouTube API (subir/publicar)", true, async () => {
  if (!YT_REFRESH_TOKEN) return { ok: false, detail: "sin OAuth" };
  const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
  if (!t.access_token) return { ok: false, detail: "no pude renovar el token OAuth" };
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", { headers: { Authorization: `Bearer ${t.access_token}` } });
  return { ok: r.ok, detail: r.ok ? "OK" : `HTTP ${r.status}` };
}, { retries: 2 });

// ---- NO CRITICOS (tienen fallback; no abortan) ----
await check("Pollinations (imagenes IA)", false, async () => {
  const r = await fetch("https://image.pollinations.ai/prompt/test?width=64&height=64&nologo=true&model=flux");
  return { ok: r.ok, detail: r.ok ? "OK" : `HTTP ${r.status} (cae a otra fuente)` };
}, { retries: 1, wait: 8000 });
await check("Pexels (footage)", false, async () => {
  if (!PEXELS_API_KEY) return { ok: false, detail: "sin key (cae a imagenes IA)" };
  const r = await fetch("https://api.pexels.com/videos/search?query=money&per_page=1", { headers: { Authorization: PEXELS_API_KEY } });
  return { ok: r.ok, detail: r.ok ? "OK" : `HTTP ${r.status}` };
}, { retries: 1, wait: 8000 });

const criticalDown = tools.filter((t) => !t.ok && t.critical);
const down = tools.filter((t) => !t.ok);
fs.writeFileSync("tools_health.json", JSON.stringify({ tools, ok: tools.length - down.length, total: tools.length, down: down.length, critical_down: criticalDown.length, at: new Date().toISOString() }, null, 2));
fs.writeFileSync("preflight.json", JSON.stringify({ pass: criticalDown.length === 0, critical_down: criticalDown.map((t) => `${t.name}: ${t.detail}`) }, null, 2));

console.log(`\nPRE-VUELO: ${criticalDown.length === 0 ? "OK ✅ (herramientas criticas al dia)" : "ABORTAR ❌"}`);
tools.forEach((t) => console.log(`  ${t.ok ? "✅" : (t.critical ? "🔴" : "🟡")} ${t.name}: ${t.detail}`));
if (criticalDown.length) {
  fs.writeFileSync("preflight_reason.txt", criticalDown.map((t) => `🔴 ${t.name}: ${t.detail}`).join("\n"));
  process.exit(1); // ABORTA la produccion
}
