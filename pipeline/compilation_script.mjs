// compilation_script.mjs — guionista of COMPILACIONES for the channel auto (Oddly Loop).
// The IA writes a narration CALMADA with a dato/curiosidad by clip (formato satisfying/
// ASMR + facts) = valor original TRANSFORMADOR (not only re-upload clips). Output = voicemap
// compatible con tts_kokoro.py y build_compilation.mjs: {title, beats:[{text,query,tipo,...}]}.
//
// Uso: node pipeline/compilation_script.mjs <niche> <out.json>
// Env: GEMINI_API_KEY
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";
import { revisar } from "./lib/titulos.mjs";

const [niche = "satisfying", out = "voicemap.json", variant = "narrado", kind = "video"] = process.argv.slice(2);

// Titles already publicados in the channel (the downloads the workflow since R2). Oddly repetia titles:
// the 2026-10-03 habia 3 titles exactos duplicados between 45 Shorts. Is much less that in
// Data Lens (22 of 45), but is free evitarlo. HERE ONLY is vigila the duplicado, NOT the
// plantilla generica: in Oddly the listicle rinde best that the resto (mediana 53 vs 36) and
// ademas is the brazo of control of the experiment of formato.
let titulosUsados = [];
try { titulosUsados = JSON.parse(fs.readFileSync("oddly_titles.json", "utf8")); } catch {}
if (!Array.isArray(titulosUsados)) titulosUsados = [];
const noRepetir = titulosUsados.slice(-60);
const bloqueNoRepetir = noRepetir.length
  ? `TITLES ALREADY USED on this channel — writing any of them again is forbidden: ${noRepetir.join(" | ")}. `
  : "";

/** Revisa el titulo, reintenta una vez con la queja, y si insiste no produce. */
async function tituloValido(titulo, rehacer) {
  let chequeo = revisar(titulo, titulosUsados, { prohibirGenerico: false });
  if (chequeo.ok) return titulo;
  console.error(`Titulo rechazado (${chequeo.motivo}): "${titulo}" — reintentando`);
  const nuevo = await rehacer(chequeo.queja);
  if (nuevo && revisar(nuevo, titulosUsados, { prohibirGenerico: false }).ok) return nuevo;
  console.error(`TITULO REPETIDO tras reintentar: "${nuevo || titulo}". No se produce.`);
  process.exit(1);
}
const isShort = kind === "short"; // Short = 9:16, ~6-8 clips, punchy (lo que más se descubre)
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(Boolean);
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const tf = (u, o = {}, ms = 30000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

// Sugerencia of queries of stock by niche (the IA can refinarlas). Sale of sources.JSON.
let sources = {};
try { sources = JSON.parse(fs.readFileSync("channel/auto2/sources.seed.json", "utf8")); } catch {}
const nicheCfg = (sources.niches || {})[niche] || {};
const label = nicheCfg.label || niche;
const pool = (nicheCfg.queries || ["satisfying"]).join(", ");
// Duration of the SHORT by CATEGORÍA: ASMR aguanta more largo (retención alta); ciencia va corto.
// Is a RANGO -> the IA/producción alarga only if the material really engancha ("lo entretenido").
const SHORT = nicheCfg.short || { min_beats: 6, max_beats: 8, clip_sec: 6 };

// ESTILO EXPERTO by niche (destilado of investigación of channels faceless that funcionan).
const NICHE_STYLE = {
  satisfying: "compilación 'oddly satisfying' con narración CALMADA y suave (vibra ASMR/relax); cada clip trae un dato curioso corto sobre lo que se ve (por qué es satisfactorio / la ciencia detrás).",
  narrativas: "HISTORIA con tensión real: gancho de intriga en 2s (giro/pregunta/afirmación contraintuitiva), narración TENSA y ajustada (frases cortas, ritmo), cada beat sube la apuesta con un giro, y un FINAL con vuelta de tuerca que da ganas de compartir. Recontrata la atención a la mitad con un cambio (revelación). Nada de relleno.",
  ciencia_humor: "DATO asombroso + HUMOR: estructura de chiste (montaje serio o predecible -> giro absurdo/inesperado = punchline). Timing: una pausa antes del remate. Observacional y relatable, no forzado. Ágil y punchy. Cada beat = un hecho que sorprende + un toque de humor seco.",
  naturaleza_relax: "naturaleza relajante con narración calmada y datos de la naturaleza; ritmo lento, cada beat una imagen bella con un dato asombroso.",
}[niche] || "narración calmada con un dato curioso por clip.";
// Reglas of RETENCIÓN that aplican to everything script narrated (lo that separa lo pro of lo genérico).
const EXPERT_RULES = "REGLAS DE RETENCIÓN: (1) el PRIMER beat engancha en los primeros 2 segundos (pattern interrupt / brecha de curiosidad / algo contraintuitivo); NADA de 'in this video'. (2) Frases CORTAS y rítmicas, aptas para voz. (3) A la mitad, un cambio que re-engancha. (4) El ÚLTIMO beat cierra fuerte (giro, remate o CTA de 3 palabras). (5) Cero relleno: si un beat no sube la apuesta, va fuera. (6) EDITA COMO CINE: piensa como EDITOR CINEMATOGRÁFICO — planifica VARIEDAD de planos (general → detalle → macro), RITMO que corta con el sonido, CONTRASTE visual entre beats consecutivos, y un ARCO emocional (calma → clímax → cierre). Elige queries de tomas con MOVIMIENTO y TEXTURA (cámara lenta, macro, dron), nunca estáticas ni genéricas.";

async function gemini(prompt) {
  if (!KEYS.length) return null;
  for (let round = 0; round < 3; round++) {
    for (let k = 0; k < KEYS.length; k++) {           // prueba cada API key (respaldo = doble cuota)
      for (const m of TEXT_MODELS) {
        try {
          const r = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEYS[k]}`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
          });
          if (r.status === 429 || r.status === 503) { console.error(`key${k + 1}/${m}: ${r.status}`); continue; }
          if (!r.ok) { console.error(`key${k + 1}/${m}: ${r.status}`); continue; }
          const j = await r.json();
          const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
          if (!t) continue;
          let p = null; try { p = JSON.parse(t); } catch { console.error(`key${k + 1}/${m}: JSON invalido`); continue; }
          if (p && Array.isArray(p.beats) && p.beats.length) return p; // solo un guion valido (con beats) cuenta; si no, reintenta
        } catch (e) { console.error(`key${k + 1}/${m}: ${e.message}`); }
      }
    }
    await sleep(15000); // todas las llaves/modelos saturados -> espero y reintento la ronda
  }
  return null;
}

// IDEA of the plan of the brain (brain_live): ángulo or brazo of experiment that esta pieza must respetar.
const IDEA = (process.env.ODDLY_IDEA || "").trim().slice(0, 300);
const ideaBlock = IDEA ? `ÁNGULO QUE EL CEREBRO QUIERE PROBAR EN ESTA PIEZA (respétalo; no inventes datos falsos): ${IDEA}\n` : "";

// Sanea lo that devuelve the modelo before of escribirlo. Gemini is a fuente of red: its
// respuesta not is of fiar by definicion, aunque the prompt sea nuestro. Here not can causar
// dano directo (the texto va to a JSON, and the subtitulo is pasa to ffmpeg by `textfile=`, that
// lee the file in vez of interpolarlo in the filtro), but is acota igual: fuera caracteres
// of control, espacios colapsados and a tope of largo. Of step avoids that a modelo that is va
// by the branches meta a parrafo where debia ir a frase.
function limpiar(valor, max) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// VARIANTE "un_hecho" (EXPERIMENTO de formato, 2026-10-03): UN sujeto, UN hecho, corto.
// By that: the channel lleva 518 videos with mediana of 46 vistas haciendo READY of 10-14 hechos
// genericos. The unico Short that desperto was "Why Baby Otters Hold Hands" (918 vistas, 20x the
// mediana): 18,7 seconds, a only animal, a only dato, metraje real of ESE animal and a title
// that is a pregunta concreta. Esta variante produce esa way for poder medirla contra the
// lista (A/B "formato_un_hecho_vs_lista" en ab_tests.mjs).
//
// The diferencias that is prueban, all to the vez because are A way, not cinco ajustes:
//   - A sujeto in everything the video (not 14 cosas distintas)
//   - A hecho sorprendente and especifico (not "14 triggers that resetean tu brain")
//   - 3-4 clips OF THE SAME sujeto (not a clip by hecho)
//   - ~15-20 s (no 60-91)
//   - title = pregunta concreta about ese sujeto
if (variant === "un_hecho") {
  const scr = await gemini(
    `Eres guionista de un canal faceless en INGLES (audiencia EEUU) tipo "${label}". ${ideaBlock}${bloqueNoRepetir}` +
    `Escribe un Short de UN SOLO HECHO: elige UN sujeto concreto (un animal, un objeto, un fenomeno) ` +
    `y UN hecho sorprendente y VERIFICABLE sobre el. Nada de listas, nada de "10 datos". ` +
    `El video entero muestra ESE sujeto: todas las queries de stock son del mismo sujeto, en planos distintos. ` +
    `Estructura: beat 1 = la pregunta/gancho en 2 segundos ("Why do X...?"), beats 2-3 = la respuesta ` +
    `con el dato, beat final = el remate. Entre 3 y 4 beats, frases CORTISIMAS (el video dura 15-20 segundos). ` +
    `El titulo es una PREGUNTA CONCRETA sobre el sujeto, no una promesa generica. ` +
    `Inspirate en el pool del nicho si encaja: ${pool}. ` +
    `Devuelve SOLO JSON: {"subject":"el sujeto en una palabra o dos","title":"pregunta concreta en ingles terminada en #Shorts","beats":[{"text":"1 frase corta en ingles","query":"termino stock en ingles DEL MISMO SUJETO","tipo":"intro|clip|reveal"}]}`
  );
  if (!scr || !Array.isArray(scr.beats) || !scr.beats.length) {
    console.error("Gemini no devolvio guion de un_hecho");
    process.exit(1);
  }
  const sujeto = limpiar(scr.subject, 40);
  const beats = scr.beats.slice(0, 4).map((b) => ({
    text: limpiar(b.text, 120),
    query: limpiar(b.query || sujeto || nicheCfg.queries?.[0] || niche, 60),
    tipo: ["intro", "clip", "reveal", "cta"].includes(b.tipo) ? b.tipo : "clip",
    pause_after: 0.1,
  }));
  const tituloBruto = limpiar(scr.title, 100) || `Why ${sujeto || "This"}? #Shorts`;
  const titulo = await tituloValido(tituloBruto, async (queja) => {
    const r = await gemini(`Devuelve SOLO {"title":"..."} con un titulo nuevo. ${queja}`);
    return limpiar(r && r.title, 100);
  });
  const voicemap = {
    lang: "en",
    title: titulo,
    niche, variant, kind,
    subject: sujeto || null,
    defaults: { pause_after: 0.1 },
    transform: { on_screen_insight: true, sound_design: true, narration: true },
    beats,
  };
  fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
  console.log(`Guion UN HECHO: "${voicemap.title}" · sujeto "${voicemap.subject}" · ${beats.length} beats -> ${out}`);
  process.exit(0);
}

// VARIANTE "puro" (ASMR without voice): NOT hay narration. Only curamos clips (queries) + title.
// Is lo more fiel to the ASMR real: mandan the SOUND and the VISUAL. Robusto: if Gemini not is,
// armamos the ready with the pool of the niche -> the producción NOT depende of the IA.
if (variant === "puro") {
  const scr = await gemini(
    `Eres curador de un canal ASMR / "oddly satisfying" en YouTube (audiencia EEUU). ${ideaBlock}${bloqueNoRepetir}` +
    `Elige 14 clips de stock MUY satisfying/ASMR (cortes limpios, agua, slime, arena cinética, prensa hidráulica, pintura, resina, etc.). ` +
    `Inspírate en o elige de: ${pool}. Cada "query" = término de búsqueda de stock en INGLES. ` +
    `Para cumplir con políticas de transformación (YPP inauthentic content), incluye para cada beat un breve texto o dato en pantalla relevante ("insight") que aporte valor único. ` +
    `Devuelve SOLO JSON: {"title":"título en inglés de alto CTR estilo 'Oddly Satisfying' (SIN clickbait falso)","beats":[{"query":"término stock en inglés","insight":"short text/fact on screen","tipo":"clip"}]}`
  );
  const rawBeats = (scr && Array.isArray(scr.beats) && scr.beats.length) ? scr.beats : (nicheCfg.queries || ["satisfying"]).map((q) => ({ query: q, insight: "Satisfying ASMR visual", tipo: "clip" }));
  // The fallback llevaba a title FIJO, asi that to partir of the second video without Gemini
  // chocaba consigo same always. Is diferencia by niche and day for that not colisione.
  const sello = new Date().toISOString().slice(0, 10);
  const tituloBase = (scr && scr.title)
    || (isShort ? `Oddly Satisfying ${niche} (${sello}) #Shorts` : `The Most Oddly Satisfying ${niche} Video (${sello})`);
  const title = await tituloValido(tituloBase, async (queja) => {
    const r = await gemini(`Devuelve SOLO {"title":"..."} con un titulo nuevo para un Short ASMR/satisfying. ${queja}`);
    return (r && r.title) || "";
  });
  const voicemap = {
    lang: "en", title, niche, variant, kind, defaults: { pause_after: 0 },
    transform: { on_screen_insight: true, sound_design: true, narration: false },
    beats: rawBeats.slice(0, isShort ? SHORT.max_beats : 16).map((b) => ({ text: b.insight || "", query: (b.query || nicheCfg.queries?.[0] || niche).trim(), tipo: b.tipo || "clip", pause_after: 0 })),
  };
  fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
  console.log(`Guion ASMR PURO ${isShort ? "SHORT " : ""}(con capas de valor): "${title}" · ${voicemap.beats.length} clips${scr ? "" : " (fallback pool, sin Gemini)"} -> ${out}`);
  process.exit(0);
}

// LEARNING: the titles that MORE rinden in este channel (vistas/day), inyectados by produce_Oddly
// since the reporte. The script imita its ESTILO of hook/estructura (not copia the topic) -> replicar lo top.
const LEARN = (process.env.ODDLY_LEARN || "").trim();
const learnBlock = LEARN ? `LO QUE MAS RINDE EN ESTE CANAL (estudia el ESTILO de gancho y estructura de estos ganadores y escribe en ese espiritu; NO copies el tema): ${LEARN}\n` : "";

const prompt =
  `Eres guionista EXPERTO de un canal faceless de YouTube en INGLES (audiencia EEUU) tipo "${label}". ` +
  `Estilo: ${NICHE_STYLE}\n${EXPERT_RULES}\n${learnBlock}${ideaBlock}${bloqueNoRepetir}` +
  `Escribe el guion de UNA compilación con ALTA RETENCION. Cada "beat" = un clip de stock con su narración corta. ` +
  `La narración da valor ORIGINAL (dato/curiosidad/comentario), no describe lo obvio. Tono acorde al nicho. ` +
  `El "query" de cada beat es un termino de busqueda de STOCK en ingles (elige de o inspirate en: ${pool}). ` +
  `Devuelve SOLO JSON:\n` +
  `{"title":"titulo en ingles de alto CTR (sin clickbait falso)${isShort ? " terminado en #Shorts" : ""}","beats":[{"text":"1-2 frases en ingles","query":"termino stock en ingles","tipo":"intro|clip|reveal|cta"}]}\n` +
  (isShort
    ? `Es un SHORT vertical: usa entre ${SHORT.min_beats} y ${SHORT.max_beats} beats. LO ENTRETENIDO manda: alarga (hacia ${SHORT.max_beats}) SOLO si cada clip realmente engancha; si no, corto (hacia ${SHORT.min_beats}). El PRIMER beat engancha en 2s; el ULTIMO es un CTA de 3 palabras a suscribirse. Frases cortisimas, sin relleno.`
    : `Usa 12 a 18 beats. El PRIMER beat engancha; el ULTIMO es un CTA suave a SUSCRIBIRSE. Nada de relleno.`);

const scr = await gemini(prompt);
if (!scr || !Array.isArray(scr.beats) || !scr.beats.length) { console.error("Gemini no devolvio guion de compilacion"); process.exit(1); }

const tituloNarrado = await tituloValido(scr.title || `${label} compilation`, async (queja) => {
  const r = await gemini(`Devuelve SOLO {"title":"..."} con un titulo nuevo. ${queja}`);
  return (r && r.title) || "";
});
const voicemap = {
  lang: "en",
  title: tituloNarrado,
  niche, variant, kind,
  defaults: { pause_after: isShort ? 0.15 : 0.35 },
  beats: scr.beats.map((b) => ({
    text: (b.text || "").trim(),
    query: (b.query || nicheCfg.queries?.[0] || niche).trim(),
    tipo: b.tipo || "clip",
    pause_after: isShort ? 0.15 : 0.35,
  })).filter((b) => b.text).slice(0, isShort ? SHORT.max_beats : 18),
};
fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
console.log(`Guion compilacion ${isShort ? "SHORT " : ""}(${niche}, ${variant}): "${voicemap.title}" · ${voicemap.beats.length} clips -> ${out}`);
