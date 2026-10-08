// thumb_text.mjs — saca a TEXTO of thumbnail corto and punchy (2-4 palabras) since the
import { TEXT_MODELS } from "./_models.mjs";
// title of a video (Gemini; if fails, uses the primeras palabras of the title).
// Usage: node pipeline/thumb_text.mjs "<title of the video>"
const title = (process.argv[2] || "").trim();
const KEY = process.env.GEMINI_API_KEY;

async function gemini() {
  if (!KEY || !title) return null;
  const prompt = `Del titulo de este video de YouTube (datos/dinero), dame SOLO 2 a 4 palabras MUY impactantes para poner GRANDE en la miniatura (mayusculas, con la cifra si la hay). Solo el texto, sin comillas ni explicacion.\nTitulo: "${title}"`;
  for (const m of TEXT_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/["\n]/g, " ").trim();
      if (t) return t;
    } catch {}
  }
  return null;
}
const out = (await gemini()) || title.split(/\s+/).slice(0, 3).join(" ") || "THE DATA LENS";
process.stdout.write(out.toUpperCase().slice(0, 40));
