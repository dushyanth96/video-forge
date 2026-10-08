// llm.mjs — Generación of TEXTO with CADENA of proveedores of IA FREE (without tarjeta), for máxima
// capacidad and CERO frenos by cuota. Test in orden and uses the first that tenga key and responda:
//   Gemini -> Cerebras -> Groq -> Cloudflare Workers AI -> SambaNova -> OpenRouter -> GitHub Models.
// The proveedores WITHOUT key is saltan solos: Juan va agregando keys (secrets) and is activan automáticamente.
// Casi all are OpenAI-compatible; Gemini and Cloudflare are nativos. With JSON=true pide JSON valid.
//
//   import { genText } from "./llm.mjs";
//   const raw = await genText(PROMPT, { json: true });
//
// Env (todas opcionales): GEMINI_API_KEY(,2), CLOUDFLARE_ACCOUNT_ID+CLOUDFLARE_API_TOKEN,
//   GROQ_API_KEY, CEREBRAS_API_KEY, SAMBANOVA_API_KEY, OPENROUTER_API_KEY, GH_MODELS_TOKEN.
import { TEXT_MODELS } from "./_models.mjs";

const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
function cleanJson(t) { t = String(t || "").replace(/```json|```/g, "").trim(); const a = t.indexOf("{"), b = t.lastIndexOf("}"); return (a >= 0 && b > a) ? t.slice(a, b + 1) : t; }

// ---- Gemini (nativo)
const GKEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
async function gemini(prompt, json) {
  for (let r = 0; r < 2; r++) for (const k of GKEYS) for (const m of TEXT_MODELS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: json ? { responseMimeType: "application/json", temperature: 0.9 } : { temperature: 0.9 } }) }, 45000);
      if (res.status === 429) { await new Promise((s) => setTimeout(s, 1000)); continue; }
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      if (t) return t;
    } catch {}
  }
  return null;
}

// ---- Cloudflare Workers AI (nativo)
async function cloudflare(prompt, json) {
  const A = process.env.CLOUDFLARE_ACCOUNT_ID, T = process.env.CLOUDFLARE_API_TOKEN;
  if (!A || !T) return null;
  for (const m of ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast", "@cf/meta/llama-3.1-8b-instruct"]) {
    try {
      const res = await tf(`https://api.cloudflare.com/client/v4/accounts/${A}/ai/run/${m}`, { method: "POST", headers: { Authorization: `Bearer ${T}`, "content-type": "application/json" }, body: JSON.stringify({ messages: [...(json ? [{ role: "system", content: "Respond ONLY with a single valid, minified JSON object. No markdown, no prose." }] : []), { role: "user", content: prompt }], temperature: 0.9, max_tokens: 2048 }) });
      if (!res.ok) { if (process.env.LLM_DIAG) cloudflare._err = m + " → " + res.status + " " + (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 140); continue; }
      const j = await res.json();
      // Workers AI devuelve or {result:{response:"..."}} (clásico) or formato OpenAI {result:{choices:[{message:{content}}]}} (modelos new).
      let raw = j?.result?.choices?.[0]?.message?.content ?? j?.result?.response ?? j?.result?.output_text ?? j?.result;
      if (raw && typeof raw === "object") raw = raw.response || raw.output_text || raw.text || (Array.isArray(raw) ? raw.map((x) => (typeof x === "string" ? x : x?.text || "")).join("") : "");
      const t = String(raw || "").trim();
      if (t) return json ? cleanJson(t) : t;
      if (process.env.LLM_DIAG) cloudflare._err = m + " → ok pero sin texto: " + JSON.stringify(j).replace(/\s+/g, " ").slice(0, 180);
    } catch (e) { if (process.env.LLM_DIAG) cloudflare._err = m + " → EXC " + (e && e.message ? e.message : e); }
  }
  return null;
}

// ---- OpenAI-compatible genérico (Groq, Cerebras, SambaNova, OpenRouter, GitHub Models)
// Proveedor OpenAI-compatible with RESOLUCIÓN DINÁMICA of modelo: in vez of a nombre fijo (that is
// rompe when the proveedor renombra/retira modelos), consulta /models in vivo and elige the best según
// a ready of preferencias. Así the cadena "not fails" aunque cambien the catálogos. Cachea the elegido.
function oai(name, url, key, prefs, extra = {}) {
  if (!key) return null;
  const base = url.replace(/\/chat\/completions$/, "");
  const wanted = Array.isArray(prefs) ? prefs : [prefs];
  let model = null, resolved = false;
  async function resolveModel(self) {
    if (resolved) return model;
    resolved = true;
    try {
      const r = await tf(`${base}/models`, { headers: { Authorization: `Bearer ${key}`, ...extra } });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        let ids = ((j && (j.data || j.models || j.body)) || []).map((m) => m.id || m.name).filter(Boolean);
        if (process.env.LLM_DIAG && self) self._models = ids.slice(0, 40).join(" | ");
        // Discard modelos that NOT are of chat (clasificación/guard/audio/embeddings/etc.) for not elegir uno invalid.
        const CHAT = ids.filter((id) => !/guard|whisper|tts|embed|moderat|safety|rerank|vision|audio|transcri|prompt-guard|classif/i.test(id));
        ids = CHAT.length ? CHAT : ids;
        for (const p of wanted) { const hit = ids.find((id) => (p instanceof RegExp ? p.test(id) : id === p)); if (hit) { model = hit; break; } }
        if (!model && ids.length) {
          const free = ids.filter((id) => !/gpt-oss/i.test(id)); const pool = free.length ? free : ids; // gpt-oss suele requerir pago; úsalo solo si no hay otro
          model = pool.find((id) => /(70b|72b|8x7b|large)/i.test(id)) || pool.find((id) => /(llama|qwen|gemma|mixtral|instruct)/i.test(id)) || pool[0];
        }
      } else if (process.env.LLM_DIAG && self) { self._err = "/models " + r.status; }
    } catch {}
    if (!model) model = wanted.find((p) => typeof p === "string") || null; // respaldo: primera preferencia literal
    return model;
  }
  return { name, async run(prompt, json) {
    try {
      const m = await resolveModel(this);
      if (!m) { if (process.env.LLM_DIAG && !this._err) this._err = "sin modelo disponible"; return null; }
      const mk = (withFmt) => { const b = { model: m, messages: [...(json ? [{ role: "system", content: "Respond ONLY with a single valid, minified JSON object. No markdown, no code fences, no prose." }] : []), { role: "user", content: prompt }], temperature: 0.9 }; if (json && withFmt) b.response_format = { type: "json_object" }; return b; };
      let r = await tf(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", ...extra }, body: JSON.stringify(mk(true)) });
      // Algunos modelos not soportan response_format -> retry without él before of rendirse.
      if (!r.ok && json && r.status === 400) r = await tf(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", ...extra }, body: JSON.stringify(mk(false)) });
      if (!r.ok) { if (process.env.LLM_DIAG) this._err = "(" + m + ") " + r.status + " " + (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 150); return null; }
      const j = await r.json();
      const t = j?.choices?.[0]?.message?.content || "";
      return t ? (json ? cleanJson(t) : t.trim()) : null;
    } catch { return null; }
  } };
}

// Cadena of proveedores FREE. Orden = the CONFIRMADOS that responden first (Gemini→Groq→OpenRouter→
// Cloudflare); Cerebras/SambaNova van to the final as respaldo (today piden tarjeta: fallan fast and is saltan,
// but is activan solos if algún day tienen cupo free). GitHub Models is quitó (GitHub lo is retirando).
// Is saltan the that not tengan key. Cada oai() auto-resuelve the modelo vía /models (to test of renombres).
const PROVIDERS = [
  { name: "Gemini", run: gemini, on: GKEYS.length ? 1 : 0 },
  oai("Groq", "https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, [/llama-3\.3-70b-versatile/i, /llama.*3\.3.*70b/i, /llama.*70b.*versatile/i, /llama.*70b/i, /llama.*instruct/i]),
  oai("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY, [/meta-llama\/llama-3\.3-70b-instruct:free/i, /llama.*3\.3.*70b.*:free/i, /llama.*70b.*:free/i, /:free/i], { "HTTP-Referer": "https://github.com/juanberrio0399/video-forge", "X-Title": "video-forge" }),
  { name: "Cloudflare", run: cloudflare, on: (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) ? 1 : 0 },
  oai("Cerebras", "https://api.cerebras.ai/v1/chat/completions", process.env.CEREBRAS_API_KEY, [/^llama-3\.3-70b$/, /llama.*3\.3.*70b/i, /llama.*70b/i, /llama/i, /gemma/i, /qwen/i]),
  oai("SambaNova", "https://api.sambanova.ai/v1/chat/completions", process.env.SAMBANOVA_API_KEY, [/Meta-Llama-3\.3-70B-Instruct/i, /llama.*3\.3.*70b/i, /llama.*70b/i, /llama/i]),
].filter(Boolean).filter((p) => p.on !== 0);

// Chequeo of salud: test CADA proveedor with key and dice cuál responde (for validar keys new).
export async function health() {
  const out = [];
  for (const p of PROVIDERS) {
    const t0 = Date.now();
    let ok = false, sample = "";
    try { const r = await p.run('Reply with exactly this JSON and nothing else: {"ok":true}', true); sample = String(r || "").replace(/\s+/g, " ").slice(0, 50); ok = /"?ok"?\s*:\s*true/i.test(String(r || "")); } catch (e) { sample = e.message; }
    if (!ok && !sample) sample = p._err || (p.run && p.run._err) || ""; // diagnóstico: status+body del fallo (con LLM_DIAG)
    if (!ok && process.env.LLM_DIAG && p._models) sample += "  [models: " + p._models + "]";
    out.push({ name: p.name, ok, ms: Date.now() - t0, sample });
  }
  return out;
}

// Generates texto probando the cadena of proveedores free. Devuelve string or null.
export async function genText(prompt, { json = true } = {}) {
  for (const p of PROVIDERS) {
    try { const t = await p.run(prompt, json); if (t) { if (p.name !== "Gemini") console.error(`Texto por ${p.name} (proveedor gratis de respaldo)`); return t; } } catch {}
  }
  console.error("Ningún proveedor de IA respondió (revisa keys/cuotas).");
  return null;
}
