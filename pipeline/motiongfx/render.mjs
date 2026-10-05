// render.mjs — orquestador del pipeline de motion graphics (ingles, code-rendered).
//
//   script.json -> TTS por beat (Gemini) -> timing.json
//              -> build_composition.mjs -> hyperframes render -> MP4 visual
//              -> FFmpeg: voz + BGM (ducking sidechain) + SFX -> MP4 final
//
// Audio: assets/audio/bgm/ y assets/audio/sfx/. Si falta algun
// asset, se sintetizan stubs CC0 deterministicos
// (assets/audio/make_fallback_audio.mjs, sin ffmpeg); si eso
// tambien falla, el pipeline sigue con voz sola — nunca falla
// por el audio.
//
// Uso: node pipeline/motiongfx/render.mjs <workDir> <script.json> <out.mp4>
// Env: GEMINI_API_KEY (TTS), MOTIONGFX_SILENT=1 (beats sin voz, para tests),
//      HF_VERSION (default 0.7.68, la misma del package.json)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  buildMixCommand,
  planSfx,
  swellWindows,
  SFX_LIBRARY,
  SFX_KINDS,
} from "../lib/audio_mix.mjs";

const [workDir, scriptPath, outMp4] = process.argv.slice(2);
if (!workDir || !scriptPath || !outMp4) {
  console.error("uso: render.mjs <workDir> <script.json> <out.mp4>");
  process.exit(1);
}

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const beats = (script.beats || []).filter((b) => b && b.text);
if (!beats.length) { console.error("guion sin beats"); process.exit(1); }

const HF_VERSION = process.env.HF_VERSION || "0.7.68";
const INTRO = 3.2, OUTRO = 3.0, PAD = 0.5;
const SILENT = process.env.MOTIONGFX_SILENT === "1";

fs.mkdirSync(workDir, { recursive: true });
fs.cpSync(path.join(import.meta.dirname, "..", "..", "hyperframes.json"), path.join(workDir, "hyperframes.json"));

function probeDuration(file) {
  try {
    const out = execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${file}"`).toString().trim();
    return parseFloat(out) || 0;
  } catch { return 0; }
}

// ---- 1) TTS por beat (voz inglesa) ----
const beatFiles = [];
const beatDurs = [];
for (let i = 0; i < beats.length; i++) {
  const txt = path.join(workDir, `beat_${i}.txt`);
  const mp3 = path.join(workDir, `beat_${i}.mp3`);
  fs.writeFileSync(txt, beats[i].text);
  if (SILENT) {
    // Estimacion determinista para tests: usa la duracion declarada en el
    // guion (Phase C: 4 beats clavados a 18/60/60/18s); sin ella, ~2.6
    // palabras/seg + aire.
    const declared = parseFloat(beats[i].duration);
    beatDurs.push(Number.isFinite(declared) && declared > 0 ? declared : beats[i].text.split(/\s+/).length / 2.6 + 0.4);
  } else {
    const KEY = process.env.GEMINI_API_KEY;
    if (!KEY) { console.error("Falta GEMINI_API_KEY (TTS) — o usa MOTIONGFX_SILENT=1 para probar sin voz"); process.exit(1); }
    execSync(`node "${path.join(import.meta.dirname, "..", "gemini_tts.mjs")}" "${txt}" "${mp3}" Charon`, { stdio: "inherit" });
    const d = probeDuration(mp3);
    if (d <= 0) { console.error(`TTS sin audio en beat ${i}`); process.exit(1); }
    beatDurs.push(d);
  }
  beatFiles.push(mp3);
}

// ---- 2) Unir la voz en un solo MP3 + timing.json ----
const listFile = path.join(workDir, "concat.txt");
if (!SILENT) {
  fs.writeFileSync(listFile, beatFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -af "loudnorm=I=-14:TP=-1.5" -c:a libmp3lame -b:a 192k "${path.join(workDir, "voiceover.mp3")}"`, { stdio: "inherit" });
} else {
  // Voz "silenciosa": mp3 de silencio con la duracion estimada total.
  const est = beatDurs.reduce((s, d) => s + d, 0);
  execSync(`ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t ${est.toFixed(2)} -c:a libmp3lame -b:a 192k "${path.join(workDir, "voiceover.mp3")}"`, { stdio: "inherit" });
}
const voiceDur = probeDuration(path.join(workDir, "voiceover.mp3")) || beatDurs.reduce((s, d) => s + d, 0);

// Ajusto los beats a la duracion REAL del audio (proporcional).
const sumBeats = beatDurs.reduce((s, d) => s + d, 0) || 1;
const scale = voiceDur / sumBeats;
let t = INTRO;
const timing = {
  title: script.title || "Video Forge Explains",
  subtitle: "The numbers behind the story",
  beats: beats.map((b, i) => {
    const dur = beatDurs[i] * scale + PAD;
    const beat = { text: b.text, type: b.type || "story", start: +t.toFixed(2), end: +(t + dur).toFixed(2) };
    t += dur;
    return beat;
  }),
  total: +(t + OUTRO).toFixed(2),
};
fs.writeFileSync(path.join(workDir, "timing.json"), JSON.stringify(timing, null, 2));

// ---- 3) Composicion (code-rendered) ----
execSync(`node "${path.join(import.meta.dirname, "build_composition.mjs")}" "${path.join(workDir, "timing.json")}" "${path.join(workDir, "index.html")}" voiceover.mp3`, { stdio: "inherit" });

// ---- 4) HyperFrames render (solo visual; el audio se mezcla despues) ----
const visualMp4 = path.join(workDir, "visual.mp4");
const atts = 2;
let ok = false;
for (let att = 1; att <= atts && !ok; att++) {
  try {
    execSync(
      `npx --yes hyperframes@${HF_VERSION} render --quality standard --workers 3 --browser-timeout 300 -o "${visualMp4}"`,
      { cwd: workDir, stdio: "inherit", timeout: 3300 * 1000 }
    );
    ok = fs.existsSync(visualMp4) && fs.statSync(visualMp4).size > 10000;
  } catch (e) {
    console.error(`intento ${att} de render fallo: ${e.message.slice(0, 300)}`);
  }
}
if (!ok) { console.error("HyperFrames no produjo el video"); process.exit(1); }

// ---- 5) Audio polish: voz + BGM (ducking) + SFX por cambio de beat ----
const AUDIO_DIR = path.join(import.meta.dirname, "..", "..", "assets", "audio");
const GEN_AUDIO = path.join(AUDIO_DIR, "make_fallback_audio.mjs");
// MP3 propio del usuario gana sobre el WAV sintetizado.
function findAudio(sub, name) {
  for (const ext of [".mp3", ".wav"]) {
    const p = path.join(AUDIO_DIR, sub, name + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const bgmFound = findAudio("bgm", "bgm_bed");
const sfxFound = SFX_KINDS.map((k) => findAudio("sfx", k));
if (!bgmFound || sfxFound.some((p) => !p)) {
  // Fallback CC0: sintetiza los stubs que faltan (deterministas,
  // <1s, sin ffmpeg). Si falla, se usa lo que haya — o nada.
  try {
    execSync(`node "${GEN_AUDIO}"`, { stdio: "ignore" });
  } catch (e) {
    console.error(`sintesis de audio fallback fallo: ${e.message.slice(0, 200)}`);
  }
}
const bgm = bgmFound || findAudio("bgm", "bgm_bed");
const sfxFiles = sfxFound.map((p, i) => p || findAudio("sfx", SFX_KINDS[i]));

const sfxEvents = planSfx(timing)
  .filter((e) => sfxFiles[SFX_KINDS.indexOf(e.kind)])
  .map((e) => ({
    file: sfxFiles[SFX_KINDS.indexOf(e.kind)],
    atSec: e.atSec,
    gain: SFX_LIBRARY[e.kind].gain,
  }));

const mixCmd = buildMixCommand({
  videoPath: visualMp4,
  voiceoverPath: path.join(workDir, "voiceover.mp3"),
  bgmPath: bgm,
  sfxEvents,
  swellWindows: swellWindows(timing),
  total: timing.total,
  outPath: outMp4,
});

if (mixCmd) {
  try {
    execSync(mixCmd, { stdio: "inherit" });
    console.log(`mezcla de audio: voz + BGM (ducking) + ${sfxEvents.length} SFX`);
  } catch (e) {
    console.error(`mezcla de audio fallo: ${e.message.slice(0, 300)} — sigo con voz sola`);
    fs.copyFileSync(visualMp4, outMp4);
  }
} else {
  // Sin BGM ni SFX: el video renderizado ya trae la voz.
  console.log("sin assets de audio — video con voz sola");
  fs.copyFileSync(visualMp4, outMp4);
}
fs.rmSync(visualMp4, { force: true });

const dur = probeDuration(outMp4);
console.log(`MOTION GRAPHICS OK -> ${outMp4} · ${dur.toFixed(1)}s · ${(fs.statSync(outMp4).size / 1e6).toFixed(1)}MB`);
