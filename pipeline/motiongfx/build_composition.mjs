// build_composition.mjs — composicion HyperFrames 100% CODE-RENDERED (ingles).
//
// Diseño: docs/design_system.md (SkillGrox Design System v1.0), integrado
// con UNA adaptacion explicita: el lienzo 9:16 vertical (1080x1920) del
// spec se adapta a 16:9 LANDSCAPE (1920x1080) para AtoPlay y YouTube
// long-form. Misma area de pixeles, asi las tallas de tipografia del spec
// se conservan; los margenes de safe-area se re-escalan proporcionalmente.
//
// Reglas del sistema que aplica aqui:
//   - Tipografias (SOLO 3, via Google Fonts): League Spartan ExtraBold
//     (ganchos, statements, numeros), Alex Brush (keywords, visibilidad
//     minima 1.2s), Inter Regular (texto de apoyo/caption). Nada mas.
//   - Color 70/20/10: #0B0B0B fondo (70%) / #FFFFFF texto primario (20%)
//     / #FF6B00 acento (10%, solo ganchos, keywords, numeros, progreso).
//   - Lineas cortas: 4-8 palabras por linea; "un frame = una idea".
//   - Beats 2 y 3 (concept/deep_dive): PANTALLA DIVIDIDA — captions a la
//     izquierda, diagrama/code SVG animado a la derecha (adaptacion 16:9).
//   - Alex Brush: fade + micro subida 250-500ms, nunca < 1.2s visible.
//   - Animaciones cortas (150-350ms de entrada, 200ms de salida), cortes
//     duros con fades breves (100-250ms) entre escenas.
//   - Safe area, jerarquia de 4 niveles, progreso "0X / 0N", marca pequeña.
//
// Uso: node pipeline/motiongfx/build_composition.mjs <timing.json> <out.html> [audio]
// En tests se importa buildComposition(timing) — pura, sin disco (tests/build_composition.test.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const f2 = (n) => Number(n).toFixed(2);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ============================ Builder (puro) ============================
// Toma un timing ({ title, subtitle, total, beats[] }) y devuelve el HTML
// de la composicion. Sin disco ni red: la E/S vive en el CLI de abajo.
export function buildComposition(timing, { audioFile = "voiceover.mp3" } = {}) {
const total = Math.max(1, parseFloat(timing.total) || 0);
const beats = (timing.beats || []).filter((b) => b.start < total);

// ======================== Design system (docs/design_system.md) ========================
// Lienzo: adaptacion 16:9 del spec 9:16 (1080x1920 -> 1920x1080).
const W = 1920, H = 1080;
// Safe-area del spec (80/120/300 sobre lienzo de 1080 de ancho) re-escalada
// proporcionalmente: horizontal x(1920/1080), vertical x(1080/1920).
const MX = 140, MT = 90, MB = 170;
const MAX_TEXT_W = 1160;                       // el texto nunca cruza toda la pantalla
const SPLIT_L = 740, SPLIT_GAP = 80, SPLIT_R = 820; // 740+80+820 = 1640 = W - 2*MX
const C = { bg: "#0B0B0B", surface: "#111111", primary: "#FFFFFF", secondary: "#B8B8B8", muted: "#777777", accent: "#FF6B00" };
const SZ = { hook: 100, headline: 88, keyword: 110, caption: 48, captionSmall: 44, body: 40, meta: 30, hero: 150 };
const KEYWORD_MIN = 1.2, KEYWORD_PREF_MAX = 2.5, CTA_MIN = 1.5;
const A = { in: 0.25, out: 0.2, keywordIn: 0.4, trans: 0.25 }; // segundos (spec §20-23)

// ---- Cifras gigantes (detector del canal principal, en ingles) ----
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
const COUNT = "views|users|subscribers|people|customers|stores|employees|downloads|followers|queries|dollars";
const magAbbr = { trillion: "T", billion: "B", million: "M", thousand: "K" };
function extractFigure(text) {
  const t = " " + String(text).replace(/,/g, "") + " ";
  let m = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s?(trillion|billion|million|thousand)\\s(${COUNT})`, "i"));
  if (m) return { big: m[1] + magAbbr[m[2].toLowerCase()], sub: m[3].toUpperCase() };
  const wordRe = /(?=\b([a-z]+)(?:[-\s]([a-z]+))?\s(trillion|billion|million|thousand)\s(dollars|people|users|views|subscribers|customers|stores|employees|downloads|followers|queries)?)/gi;
  let wm;
  while ((wm = wordRe.exec(t))) {
    wordRe.lastIndex = wm.index + 1;
    if (!WORDNUM[wm[1].toLowerCase()]) continue;
    let n = WORDNUM[wm[1].toLowerCase()];
    if (wm[2] && WORDNUM[wm[2].toLowerCase()]) {
      const w2 = WORDNUM[wm[2].toLowerCase()];
      n = w2 === 100 ? n * w2 : n + w2;
    }
    if (wm[4] && !/dollar/i.test(wm[4])) return { big: n + magAbbr[wm[3].toLowerCase()], sub: wm[4].toUpperCase() };
    const money = /dollar/i.test(wm[4] || "") || /\$/.test(text);
    return { big: (money ? "$" : "") + n + magAbbr[wm[3].toLowerCase()], sub: "" };
  }
  m = t.match(/\$\s?(\d+(?:\.\d+)?)\s?(trillion|billion|million|thousand)\b/i);
  if (m) return { big: "$" + m[1] + magAbbr[m[2].toLowerCase()], sub: "" };
  m = t.match(/(\d+(?:\.\d+)?)\s?(?:percent|%)/i);
  if (m) return { big: m[1] + "%", sub: "" };
  m = text.match(/\$\s?\d[\d,]{2,}/);
  if (m) return { big: m[0].replace(/\s/g, ""), sub: "" };
  m = t.match(new RegExp(`(\\d{4,})\\s?(${COUNT})`, "i"));
  if (m) { const n = +m[1]; const big = n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M" : Math.round(n / 1000) + "K"; return { big, sub: m[2].toUpperCase() }; }
  return null;
}

// ---- Envoltura de lineas: 4-8 palabras por linea (spec §13) ----
function wrapLines(text, minW = 4, maxW = 8) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxW) return [words.join(" ")];
  const target = Math.max(minW, Math.min(maxW, Math.round(words.length / Math.ceil(words.length / maxW))));
  const lines = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= target) { lines.push(cur.join(" ")); cur = []; }
  }
  if (cur.length) {
    const last = lines[lines.length - 1];
    if (last && cur.length < minW && last.split(" ").length + cur.length <= maxW) {
      lines[lines.length - 1] = last + " " + cur.join(" ");
    } else lines.push(cur.join(" "));
  }
  return lines;
}

// ---- Seleccion automatica de keywords (spec §43) ----
// Prioriza conceptos (palabras largas y con contenido); ignora articulos,
// preposiciones, pronombres y relleno. 1-2 por escena, nunca todas.
const STOP = new Set(("a an the and or but if then else when at by for with about against between into through during before after above below to from up down in out on off over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just should now is are was were be been being have has had having do does did doing would could ought i you he she it we they them his her its our their this that these those what which who whom how why dont doesnt didnt youre were isnt wasnt youve youll weve well theyll lets let us one two three first second also may might must shall").split(" "));
function pickKeywords(text, n = 1) {
  const seen = new Set();
  return String(text).replace(/[^\w\s'-]/g, "").split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase().replace(/['-]/g, "")))
    .filter((w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.length - a.length)
    .slice(0, n)
    .map((w) => w.toUpperCase());
}

// ---- Statement con keyword inline (spec §15/§16/§25) ----
// mode "hook": keyword naranja dentro de League Spartan.
// mode "brush": keyword en Alex Brush dentro de League Spartan (+subrayado opcional,
// activado por el caller para la keyword del takeaway, §38).
function statementHtml(text, kw, mode, underlined) {
  const words = String(text).split(/\s+/);
  const kwLower = String(kw || "").toLowerCase();
  const idx = kwLower ? words.findIndex((w) => w.replace(/[^\w'-]/g, "").toLowerCase() === kwLower) : -1;
  if (idx >= 0) {
    if (mode === "brush") {
      words[idx] = `<span class="kw-brush">${esc(words[idx])}${underlined ? '<span class="uline"></span>' : ""}</span>`;
    } else {
      words[idx] = `<span class="kw-orange">${esc(words[idx])}</span>`;
    }
  }
  // La keyword ya es HTML (su <span>): solo escapar el resto de las palabras.
  return words.map((w, j) => (j === idx ? w : esc(w))).join(" ");
}

// ---- Layout por beat (spec §40: HOOK/PROBLEM/INSIGHT/EXPLANATION/TAKEAWAY) ----
function layoutFor(b, i) {
  const t = String(b.type || "").toLowerCase();
  if (t === "hook") return "hook";
  if (t === "concept") return "split-diagram";
  if (t === "deep_dive") return "split-code";
  if (t === "takeaway" || t === "cta") return "takeaway";
  // Fallback por indice: beats 2 y 3 (1-based) -> pantalla dividida (16:9).
  if (i === 1) return "split-diagram";
  if (i === 2) return "split-code";
  return "headline";
}

// ---- SVG: diagrama de nodos (beat CONCEPT, lado derecho) ----
function svgDiagram(kw, words) {
  const hub = (kw || "CORE").toUpperCase().slice(0, 12);
  const pad = ["DATA", "FLOW", "CORE", "SYSTEM", "MODEL"];
  const spokes = [];
  for (const w of words.slice(0, 8)) {
    const label = w.replace(/[^\w'-]/g, "").toUpperCase().slice(0, 12);
    if (label && label !== hub && spokes.length < 3 && !spokes.includes(label)) spokes.push(label);
  }
  while (spokes.length < 3) { const p = pad[spokes.length]; if (!spokes.includes(p)) spokes.push(p); else pad.push(p + "X"); }
  const cx = 410, cy = 285, NW = 230, NH = 92;
  const pos = [[165, 105], [655, 105], [165, 465]];
  const len = (x, y) => Math.hypot(x - cx, y - cy).toFixed(1);
  const lines = pos.map(([x, y]) =>
    `<line class="dline" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke-dasharray="${len(x, y)}" stroke-dashoffset="${len(x, y)}" data-len="${len(x, y)}"/>`).join("");
  const nodes = [`<g class="dnode hubn" transform="translate(${cx - NW / 2},${cy - NH / 2})"><rect width="${NW}" height="${NH}" rx="18"/><text x="${NW / 2}" y="${NH / 2 + 11}" text-anchor="middle">${esc(hub)}</text></g>`]
    .concat(pos.map(([x, y], i) =>
      `<g class="dnode" transform="translate(${x - NW / 2},${y - NH / 2})"><rect width="${NW}" height="${NH}" rx="18"/><text x="${NW / 2}" y="${NH / 2 + 11}" text-anchor="middle">${esc(spokes[i])}</text></g>`)).join("");
  return `<svg viewBox="0 0 820 579" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${lines}${nodes}</svg>`;
}

// ---- SVG: panel de codigo (beat DEEP_DIVE, lado derecho) ----
function svgCode(words) {
  const w = words.map((x) => x.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 10)).filter((x) => x.length >= 2);
  const pad = ["data", "system", "model", "flow", "core", "engine"];
  while (w.length < 6) w.push(pad[w.length % pad.length]);
  const T = (cls, txt) => `<tspan class="${cls}">${esc(txt)}</tspan>`;
  const lines = [
    [T("ckw", "import"), T("cd", " { "), T("cfn", w[0]), T("cd", " } from "), T("cstr", `"./${w[1]}.mjs"`), T("cd", ";")],
    [T("ckw", "const"), T("cd", " "), T("cfn", w[2]), T("cd", " = "), T("ckw", "await"), T("cd", " "), T("cfn", w[0]), T("cd", "("), T("cfn", w[3]), T("cd", ");")],
    [T("ckw", "if"), T("cd", " (!"), T("cfn", w[2]), T("cd", ") "), T("ckw", "throw"), T("cd", " "), T("ckw", "new"), T("cd", " "), T("cfn", "Error"), T("cd", "("), T("cstr", `"${w[4]}"`), T("cd", ");")],
    [T("ckw", "return"), T("cd", " "), T("cfn", w[2]), T("cd", ".map("), T("cfn", w[5]), T("cd", ");")],
    [T("ccm", `// ${w[0]} -> ${w[1]} pipeline`)],
  ];
  const rows = lines.map((toks, i) => {
    const y = 52 + i * 92;
    return `<g class="cline"><text class="lineno" x="36" y="${y}">${String(i + 1).padStart(2, "0")}</text><text class="codetxt" x="96" y="${y}">${toks.join("")}</text></g>`;
  }).join("");
  const lastY = 52 + (lines.length - 1) * 92;
  return `<svg viewBox="0 0 820 579" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rows}<rect class="caret" x="96" y="${lastY - 26}" width="16" height="34" rx="3"/></svg>`;
}

// ============================ Escenas ============================
const INTRO = 3.2, OUTRO = 3.0;
const firstBeat = beats.length ? beats[0].start : INTRO;
const lastEnd = beats.length ? Math.min(beats[beats.length - 1].end, total) : total - OUTRO;

const els = [];   // HTML
const tw = [];    // tweens GSAP (tiempos absolutos, seek-safe)
const trackOf = (i) => 3 + i; // pistas unicas por escena (solapamiento seguro)

// ---- Intro: tarjeta de titulo (spec §25: League Spartan + Alex Brush + Inter) ----
if (firstBeat > 1) {
  const titleKws = pickKeywords(timing.title || "Video Forge Explains", 1);
  const titleKw = titleKws[0] || "EXPLAINED";
  const titleWords = String(timing.title || "Video Forge Explains").split(/\s+/);
  const ti = titleWords.findIndex((w) => w.replace(/[^\w'-]/g, "").toUpperCase() === titleKw);
  if (ti >= 0) titleWords[ti] = `<span class="kw-brush">${esc(titleWords[ti])}</span>`;
  els.push(`<div class="clip scene intro" id="intro" data-start="0" data-duration="${f2(firstBeat)}" data-track-index="2">
      <div class="eyebrow">Motion Graphics · Explainer</div>
      <div class="intro-title">${titleWords.map((w, j) => (j === ti ? w : esc(w))).join(" ")}</div>
      <div class="intro-sub">${esc(timing.subtitle || "The numbers behind the story")}</div>
    </div>`);
  tw.push(`tl.fromTo("#intro .eyebrow",{opacity:0,y:18},{opacity:1,y:0,duration:${A.in},ease:"power3.out"},0.15);`);
  tw.push(`tl.fromTo("#intro .intro-title",{opacity:0,y:30},{opacity:1,y:0,duration:0.35,ease:"power3.out"},0.3);`);
  tw.push(`tl.fromTo("#intro .intro-sub",{opacity:0},{opacity:1,duration:${A.in},ease:"power2.out"},0.55);`);
  tw.push(`tl.to("#intro",{opacity:0,duration:${A.trans},ease:"power1.in"},${f2(Math.max(0.2, firstBeat - A.trans))});`);
}

// ---- Beats ----
let heroEnd = -99;
beats.forEach((b, i) => {
  const start = b.start;
  const end = Math.min(b.end, total);
  let dur = Math.max(0.4, end - start);
  const layout = layoutFor(b, i);
  const kws = pickKeywords(b.text || "", 1);
  const kw = kws[0] || null;
  const words = String(b.text || "").split(/\s+/);
  const fig = extractFigure(b.text || "");
  const showHero = fig && (b.type === "stat" || b.type === "hook" || b.type === "cta" || b.type === "insight") && start - heroEnd >= 3.0;
  const tr = `#beat${i}`;

  if (layout === "split-diagram" || layout === "split-code") {
    // ===== PANTALLA DIVIDIDA (adaptacion 16:9, beats 2 y 3) =====
    // Izquierda: kicker + captions (Inter, 4-7 palabras/linea) + keyword
    // Alex Brush. Derecha: panel con SVG animado (diagrama o codigo).
    const capLines = wrapLines(b.text || "", 4, 7);
    const capSize = capLines.length > 4 ? SZ.captionSmall : SZ.caption; // §44: ajuste suave
    const capHtml = capLines.map((line) => {
      let html = esc(line);
      if (kw) { const re = new RegExp(`\\b(${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "i"); html = html.replace(re, `<span class="cap-kw">$1</span>`); }
      return `<div class="cap-line"${capSize !== SZ.caption ? ` style="font-size:${capSize}px"` : ""}>${html}</div>`;
    }).join("");
    const panelSvg = layout === "split-diagram" ? svgDiagram(kw, words) : svgCode(words);
    const panelName = layout === "split-diagram" ? "concept.map" : `${words.map((x) => x.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 12)).find((x) => x.length >= 2) || "engine"}.mjs`;
    els.push(`<div class="clip scene split" id="beat${i}" data-start="${f2(start)}" data-duration="${f2(dur)}" data-track-index="${trackOf(i)}">
      <div class="split-left">
        <div class="kicker">${esc((b.type || "beat").toUpperCase())} · ${String(i + 1).padStart(2, "0")}</div>
        <div class="caps">${capHtml}</div>
        ${kw ? `<div class="split-kw">${esc(kw)}</div>` : ""}
      </div>
      <div class="panel" id="panel${i}">
        <div class="panel-bar"><span class="dot" style="background:${C.accent}"></span><span class="dot" style="background:${C.secondary}"></span><span class="dot" style="background:${C.muted}"></span><span class="panel-name">${esc(panelName)}</span></div>
        ${panelSvg}
      </div>
    </div>`);
    // Tiempos: kicker +0.10, captions +0.15 (stagger 100ms), keyword +0.45
    // (fade+subida 400ms, visible desde +0.85), panel +0.10.
    tw.push(`tl.fromTo("${tr} .kicker",{opacity:0,x:-24},{opacity:1,x:0,duration:${A.in},ease:"power3.out"},${f2(start + 0.1)});`);
    tw.push(`tl.fromTo("${tr} .cap-line",{opacity:0,y:16},{opacity:1,y:0,duration:0.2,ease:"power2.out",stagger:0.1},${f2(start + 0.15)});`);
    tw.push(`tl.fromTo("#panel${i}",{opacity:0,scale:0.985},{opacity:1,scale:1,duration:0.3,ease:"power2.out",transformOrigin:"50% 50%"},${f2(start + 0.1)});`);
    if (layout === "split-diagram") {
      tw.push(`tl.to("#panel${i} .dline",{strokeDashoffset:0,duration:0.4,ease:"power2.out",stagger:0.15},${f2(start + 0.3)});`);
      tw.push(`tl.fromTo("#panel${i} .dnode",{scale:0.5,opacity:0},{scale:1,opacity:1,duration:0.45,ease:"back.out(1.6)",stagger:0.15,transformOrigin:"50% 50%"},${f2(start + 0.5)});`);
    } else {
      tw.push(`tl.fromTo("#panel${i} .cline",{opacity:0,y:14},{opacity:1,y:0,duration:0.2,ease:"power2.out",stagger:0.22},${f2(start + 0.25)});`);
    }
    if (kw) {
      // Regla de visibilidad minima de Alex Brush (spec §3): >= 1.2s,
      // preferido 1.2-2.5s. La keyword entra a +0.45 y se apaga a los
      // 2.5s o con la escena (lo que ocurra primero).
      const kwFull = start + 0.85;
      const kwFade = Math.min(end - A.out, kwFull + KEYWORD_PREF_MAX);
      if (kwFade - kwFull < KEYWORD_MIN) {
        // Beat demasiado corto: se extiende la escena para cumplir 1.2s.
        const needEnd = kwFull + KEYWORD_MIN + A.out;
        console.warn(`build_composition: beat ${i + 1} @${f2(start)}s demasiado corto — escena extendida a ${f2(needEnd)}s para cumplir la regla de 1.2s de Alex Brush`);
        dur = needEnd - start;
        els[els.length - 1] = els[els.length - 1].replace(`data-duration="${f2(Math.max(0.4, end - start))}"`, `data-duration="${f2(dur)}"`);
        tw.push(`tl.fromTo("${tr} .split-kw",{opacity:0,y:22},{opacity:1,y:0,duration:${A.keywordIn},ease:"power2.out"},${f2(start + 0.45)});`);
        tw.push(`tl.to("${tr} .split-kw",{opacity:0,duration:${A.out},ease:"power1.in"},${f2(kwFull + KEYWORD_MIN - A.out)});`);
        tw.push(`tl.to("${tr}",{opacity:0,duration:${A.out},ease:"power1.in"},${f2(needEnd - A.out)});`);
      } else {
        tw.push(`tl.fromTo("${tr} .split-kw",{opacity:0,y:22},{opacity:1,y:0,duration:${A.keywordIn},ease:"power2.out"},${f2(start + 0.45)});`);
        tw.push(`tl.to("${tr} .split-kw",{opacity:0,duration:${A.out},ease:"power1.in"},${f2(kwFade - A.out)});`);
        tw.push(`tl.to("${tr}",{opacity:0,duration:${A.out},ease:"power1.in"},${f2(Math.max(start + 0.2, end - A.out))});`);
      }
    } else {
      tw.push(`tl.to("${tr}",{opacity:0,duration:${A.out},ease:"power1.in"},${f2(Math.max(start + 0.2, end - A.out))});`);
    }
  } else {
    // ===== CENTRADO: HOOK / TAKEAWAY / HEADLINE =====
    const isTakeaway = layout === "takeaway";
    const size = layout === "hook" ? SZ.hook : SZ.headline;
    const mode = layout === "hook" ? "hook" : "brush";
    const stmt = statementHtml(b.text || "", kw, mode, isTakeaway);
    els.push(`<div class="clip scene center" id="beat${i}" data-start="${f2(start)}" data-duration="${f2(dur)}" data-track-index="${trackOf(i)}">
      <div class="kicker">${esc((b.type || "beat").toUpperCase())} · ${String(i + 1).padStart(2, "0")}</div>
      ${showHero ? `<div class="hero"><div class="hero-big">${esc(fig.big)}</div>${fig.sub ? `<div class="hero-sub">${esc(fig.sub)}</div>` : ""}</div>` : ""}
      <div class="statement${layout === "hook" ? " hook" : ""}">${stmt}</div>
    </div>`);
    // Hook (§20): fondo 0.00s, statement entra 0.05-0.15s, estable hasta 1.5s.
    tw.push(`tl.fromTo("${tr} .kicker",{opacity:0,x:-24},{opacity:1,x:0,duration:${A.in},ease:"power3.out"},${f2(start + 0.08)});`);
    tw.push(`tl.fromTo("${tr} .statement",{opacity:0,y:26},{opacity:1,y:0,duration:0.3,ease:"power3.out"},${f2(start + 0.12)});`);
    if (isTakeaway && kw) {
      // Subrayado de keyword Alex Brush (§38): izquierda->derecha 200-400ms.
      tw.push(`tl.to("${tr} .uline",{scaleX:1,duration:0.3,ease:"power2.out"},${f2(start + 0.65)});`);
    }
    if (showHero) {
      heroEnd = Math.min(end - 0.3, start + 3.4);
      tw.push(`tl.fromTo("${tr} .hero-big",{opacity:0,scale:0.6,y:40},{opacity:1,scale:1,y:0,duration:0.5,ease:"back.out(1.7)"},${f2(start + 0.3)});`);
      if (fig.sub) tw.push(`tl.fromTo("${tr} .hero-sub",{opacity:0,y:14},{opacity:1,y:0,duration:0.3,ease:"power3.out"},${f2(start + 0.5)});`);
      tw.push(`tl.to("${tr} .hero",{opacity:0,duration:${A.out},ease:"power1.in"},${f2(heroEnd)});`);
    }
    tw.push(`tl.to("${tr}",{opacity:0,duration:${A.out},ease:"power1.in"},${f2(Math.max(start + 0.2, end - A.out))});`);
  }
});

// ---- Outro: tarjeta CTA (spec §26/§27: League Spartan + Alex Brush + Inter, >=1.5s) ----
if (total - lastEnd > CTA_MIN) {
  const outroKws = pickKeywords(timing.title || "Video Forge Explains", 1);
  els.push(`<div class="clip scene outro" id="outro" data-start="${f2(lastEnd)}" data-duration="${f2(total - lastEnd)}" data-track-index="${3 + beats.length}">
      <div class="outro-mark">VIDEO FORGE</div>
      <div class="outro-kw">${esc(outroKws[0] || "EXPLAINED")}</div>
      <div class="outro-sub">Review before upload · Motion graphics, zero footage</div>
    </div>`);
  tw.push(`tl.fromTo("#outro .outro-mark",{opacity:0,letterSpacing:"0.6em"},{opacity:1,letterSpacing:"0.35em",duration:0.6,ease:"power2.out"},${f2(lastEnd + 0.2)});`);
  tw.push(`tl.fromTo("#outro .outro-kw",{opacity:0,y:22},{opacity:1,y:0,duration:${A.keywordIn},ease:"power2.out"},${f2(lastEnd + 0.55)});`);
  tw.push(`tl.fromTo("#outro .outro-sub",{opacity:0},{opacity:1,duration:0.25,ease:"power2.out"},${f2(lastEnd + 0.9)});`);
}

// ---- Indicador de progreso (spec §39): "0X / 0N", Inter 30px, naranja activo ----
beats.forEach((b, i) => {
  const end = Math.min(b.end, total);
  els.push(`<div class="clip prog" id="prog${i}" data-start="${f2(b.start)}" data-duration="${f2(Math.max(0.3, end - b.start))}" data-track-index="${40 + i}"><span class="on">${String(i + 1).padStart(2, "0")}</span> / ${String(beats.length).padStart(2, "0")}</div>`);
  tw.push(`tl.fromTo("#prog${i}",{opacity:0},{opacity:1,duration:${A.out},ease:"power1.out"},${f2(b.start)});`);
  tw.push(`tl.to("#prog${i}",{opacity:0,duration:${A.out},ease:"power1.in"},${f2(Math.max(b.start + 0.1, end - 0.1))});`);
});

// ============================ HTML ============================
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=${W}, height=${H}" />
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Inter:wght@400&family=League+Spartan:wght@800&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--bg:${C.bg};--surface:${C.surface};--primary:${C.primary};--secondary:${C.secondary};--muted:${C.muted};--accent:${C.accent}}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--bg)}
  body{font-family:"Inter",system-ui,sans-serif;font-weight:400;color:var(--primary)}
  #root{position:relative;width:${W}px;height:${H}px;background:var(--bg);overflow:hidden}
  /* Fondo quieto (spec §9): grilla tenue + vigneta. Sin blobs de color:
     el negro #0B0B0B ocupa el ~70% de la proporcion 70/20/10. */
  #grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:72px 72px}
  #vig{position:absolute;inset:0;background:radial-gradient(115% 115% at 50% 42%,transparent 58%,rgba(0,0,0,.55))}
  #particles{position:absolute;inset:0;width:${W}px;height:${H}px}
  /* Escenas: un frame = una idea (spec §1). Safe area adaptada al 16:9. */
  .scene{position:absolute;inset:0;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${MT}px ${MX}px ${MB}px}
  .scene.split{flex-direction:row;align-items:stretch;justify-content:flex-start;text-align:left;gap:${SPLIT_GAP}px}
  .kicker{font-size:${SZ.meta}px;letter-spacing:5px;color:var(--muted);text-transform:uppercase;margin-bottom:34px}
  /* LEVEL 1 — League Spartan ExtraBold (ganchos/statements) */
  .statement{font-family:"League Spartan";font-weight:800;font-size:${SZ.headline}px;line-height:1.1;letter-spacing:-1px;color:var(--primary);max-width:${MAX_TEXT_W}px}
  .statement.hook{font-size:${SZ.hook}px}
  .kw-orange{color:var(--accent)}
  /* LEVEL 2 — Alex Brush (keyword emocional, >=1.2s) */
  .kw-brush{font-family:"Alex Brush";font-weight:400;font-size:1.22em;color:var(--accent);position:relative;letter-spacing:0}
  .uline{position:absolute;left:2%;right:2%;bottom:-0.14em;height:6px;border-radius:3px;background:var(--accent);transform:scaleX(0);transform-origin:left center}
  /* Numeros (spec §31): League Spartan 100-150px, naranja */
  .hero{margin-bottom:30px}
  .hero-big{font-family:"League Spartan";font-weight:800;font-size:${SZ.hero}px;line-height:1;letter-spacing:-4px;color:var(--accent)}
  .hero-sub{font-size:${SZ.body}px;color:var(--secondary);margin-top:16px;letter-spacing:3px;text-transform:uppercase}
  /* Pantalla dividida: columna izquierda (captions Inter) */
  .split-left{flex:0 0 ${SPLIT_L}px;display:flex;flex-direction:column;justify-content:center}
  .caps{margin-bottom:6px}
  .cap-line{font-size:${SZ.caption}px;line-height:1.28;color:var(--primary);margin-bottom:6px;max-width:${SPLIT_L}px}
  .cap-kw{color:var(--accent)}
  .split-kw{font-family:"Alex Brush";font-weight:400;font-size:${SZ.keyword}px;line-height:1.15;color:var(--accent);margin-top:30px}
  /* Panel derecho: tarjeta #111111 con SVG animado */
  .panel{flex:0 0 ${SPLIT_R}px;height:640px;align-self:center;background:var(--surface);border:1px solid rgba(255,255,255,.08);border-radius:24px;overflow:hidden;opacity:0}
  .panel-bar{display:flex;align-items:center;gap:12px;padding:20px 26px;border-bottom:1px solid rgba(255,255,255,.07)}
  .dot{width:13px;height:13px;border-radius:50%}
  .panel-name{font-size:28px;color:var(--muted);letter-spacing:1px;margin-left:8px}
  .panel svg{display:block;width:100%;height:519px}
  /* Diagrama de nodos */
  .dnode{transform-box:fill-box;transform-origin:center}
  .dnode rect{fill:var(--bg);stroke:var(--secondary);stroke-width:2.5}
  .dnode.hubn rect{stroke:var(--accent);stroke-width:3.5}
  .dnode text{fill:var(--primary);font-family:"Inter";font-size:30px;font-weight:400}
  .dnode.hubn text{fill:var(--accent)}
  .dline{stroke:var(--accent);stroke-width:3;opacity:.55;stroke-linecap:round}
  /* Panel de codigo */
  .cline{opacity:0}
  .lineno{fill:var(--muted);font-family:"Inter";font-size:28px}
  .codetxt{fill:var(--primary);font-family:"Inter";font-size:30px}
  .ckw{fill:var(--accent)} .cfn{fill:var(--primary)} .cstr{fill:var(--secondary)} .ccm{fill:var(--muted)} .cd{fill:var(--primary)}
  .caret{fill:var(--accent);animation:blink 1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
  /* Intro / Outro (tarjetas estaticas, spec §25/§26) */
  .eyebrow{font-size:${SZ.meta}px;letter-spacing:6px;color:var(--muted);text-transform:uppercase;margin-bottom:30px}
  .intro-title{font-family:"League Spartan";font-weight:800;font-size:96px;line-height:1.05;letter-spacing:-1.5px;color:var(--primary);max-width:${MAX_TEXT_W}px}
  .intro-sub{font-size:${SZ.body}px;color:var(--secondary);margin-top:30px;max-width:900px;line-height:1.3}
  .outro-mark{font-family:"League Spartan";font-weight:800;font-size:110px;letter-spacing:.28em;text-indent:.28em;color:var(--primary)}
  .outro-kw{font-family:"Alex Brush";font-weight:400;font-size:${SZ.keyword}px;color:var(--accent);margin-top:14px}
  .outro-sub{font-size:34px;color:var(--secondary);margin-top:28px}
  /* Progreso (spec §39) y marca (spec §28) */
  .prog{position:absolute;top:${MT + 6}px;right:${MX}px;font-size:${SZ.meta}px;color:var(--muted);letter-spacing:2px;opacity:0}
  .prog .on{color:var(--accent)}
  #brand{position:absolute;top:${MT + 6}px;left:${MX}px;font-size:${SZ.meta}px;color:var(--muted);letter-spacing:3px}
</style></head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${f2(total)}" data-fps="30" data-width="${W}" data-height="${H}">
    <canvas id="particles" width="${W}" height="${H}"></canvas>
    <div id="grid"></div><div id="vig"></div>

    <audio id="voz" class="clip" data-start="0" data-duration="${f2(total)}" data-track-index="90" src="${audioFile}"></audio>

    ${els.join("\n    ")}

    <div id="brand">VIDEO FORGE</div>
  </div>

  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    const T = ${f2(total)};

    // Partículas en Canvas: LCG determinista (seed fija = mismos frames en
    // cada render y cada seek). Paleta del sistema: blanco (20%) con un
    // 15% de puntos naranja de acento (10%).
    (function () {
      const cv = document.getElementById("particles"), cx = cv.getContext("2d");
      let seed = 123456789;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const P = [];
      for (let i = 0; i < 70; i++) P.push({ x: rnd() * ${W}, y: rnd() * ${H}, r: 1 + rnd() * 1.8, vx: (rnd() - 0.5) * 14, vy: (rnd() - 0.5) * 14, a: 0.05 + rnd() * 0.13, o: rnd() < 0.15 });
      const draw = (t) => {
        cx.clearRect(0, 0, ${W}, ${H});
        for (const p of P) {
          const x = ((p.x + p.vx * t) % ${W} + ${W}) % ${W};
          const y = ((p.y + p.vy * t) % ${H} + ${H}) % ${H};
          cx.globalAlpha = p.a;
          cx.fillStyle = p.o ? "#FF6B00" : "#FFFFFF";
          cx.beginPath(); cx.arc(x, y, p.r, 0, 6.2832); cx.fill();
        }
        cx.globalAlpha = 1;
      };
      draw(0);
      tl.eventCallback("onUpdate", () => draw(tl.time()));
    })();

    ${tw.join("\n    ")}

    window.__timelines["main"] = tl;
  </script>
</body></html>`;

  return html;
}

// CLI: solo cuando se ejecuta directamente (en tests, importar la
// funcion sin escribir nada).
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const [timingPath, outPath, audioFile = "voiceover.mp3"] = process.argv.slice(2);
  if (!timingPath || !outPath) { console.error("uso: build_composition.mjs <timing.json> <out.html> [audio]"); process.exit(1); }
  const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
  const total = Math.max(1, parseFloat(timing.total) || 0);
  const beats = (timing.beats || []).filter((b) => b.start < total);
  const html = buildComposition(timing, { audioFile });
  fs.writeFileSync(outPath, html);
  const nScenes = (html.match(/class="clip scene/g) || []).length;
  const nSplit = (html.match(/class="clip scene split/g) || []).length;
  console.log(`Composicion MOTION GRAPHICS (code-rendered, design system v1.0): ${outPath}`);
  console.log(`  ${f2(total)}s · ${beats.length} beats · ${nScenes} escenas (${nSplit} split 16:9) · 1920x1080 · League Spartan / Alex Brush / Inter`);
}
