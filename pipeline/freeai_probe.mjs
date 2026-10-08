// freeai_probe.mjs — SONDA: descubre the contrato real of the API of video of Free.ai (modelos,
// formato of request/response, sincrono vs asincrono, campo of uso). Imprime everything in crudo.
// Uso: node pipeline/freeai_probe.mjs
// Env: FREEAI_API_KEY
const KEY = process.env.FREEAI_API_KEY;
const BASE = "https://api.free.ai";
if (!KEY) { console.log("Falta FREEAI_API_KEY"); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const show = (t, s) => console.log(`\n===== ${t} =====\n${s}`);

// 1) Modelos disponibles (for saber the string exacto of CogVideoX / video self-hosted).
try {
  const r = await fetch(`${BASE}/v1/models`, { headers: H });
  const t = await r.text();
  show(`GET /v1/models  [${r.status}]`, t.slice(0, 4000));
} catch (e) { show("GET /v1/models ERROR", e.message); }

// 2) Intentar generate a video corto with candidatos of modelo self-hosted.
const prompt = "cinematic aerial establishing shot of a modern city skyline at golden hour, film look, smooth camera push in";
for (const model of ["CogVideoX", "cogvideox", "cogvideox-5b", "self-hosted/cogvideox", "cogvideox-2b"]) {
  try {
    const r = await fetch(`${BASE}/v1/video/generate/`, {
      method: "POST", headers: H,
      body: JSON.stringify({ prompt, duration: 4, model }),
    });
    const t = await r.text();
    show(`POST /v1/video/generate  model=${model}  [${r.status}]`, t.slice(0, 3000));
    // If arranca bien (2xx) or da a error claro of "modelo not existe", already aprendimos.
    if (r.ok) { console.log(`\n>>> MODELO QUE FUNCIONA: ${model}`); break; }
    // 400 with "unknown model" -> probar the siguiente; others errores -> parar (not gastar).
    if (r.status !== 400 && r.status !== 404 && r.status !== 422) break;
  } catch (e) { show(`POST video model=${model} ERROR`, e.message); }
}
