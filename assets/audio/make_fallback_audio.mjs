// make_fallback_audio.mjs — sintetiza los stubs de audio CC0 del pipeline.
//
// Los assets de audio no se bajan de ningun sitio: este script los
// genera (PCM WAV 16-bit mono, 22050 Hz) con sintesis directa, sin
// ffmpeg ni dependencias. Todo es DETERMINISTA (ruido por LCG con
// seed fija: nada de Math.random ni Date.now), asi que regenerar es
// reproducir byte a byte el mismo archivo.
//
// Archivos que crea (relativos a este script):
//   bgm/bgm_bed.wav       cama lo-fi downtempo ~112 BPM, 64 beats
//                         (34.3 s, loop seamless: cada oscilador
//                         cuantiza su frecuencia a ciclos enteros
//                         del loop)
//   sfx/whoosh_subtle.wav transicion de escena / paneo (0.9 s)
//   sfx/pop_ui.wav        nodo de diagrama / SVG (0.16 s)
//   sfx/code_typing.wav   revelado de lineas de codigo (0.75 s)
//   sfx/data_ping.wav     chime de metrica / highlight (0.65 s)
//
// Uso: node assets/audio/make_fallback_audio.mjs [dirSalida]
// Env: ninguno. render.mjs lo llama solo si falta algun asset.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 22050;
const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- Ruido deterministico (LCG) — prohibido Math.random en este repo ----
function makeNoise(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1; // [-1, 1)
  };
}

// ---- Filtros de un polo (suavizan el caracter "lo-fi/muted") ----
function lowpass(samples, fc) {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y += a * (samples[i] - y);
    samples[i] = y;
  }
  return samples;
}
function highpass(samples, fc) {
  lowpass(samples, fc);
  const out = new Float32Array(samples.length);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] - prev;
    prev = samples[i];
  }
  return out;
}

// ---- WAV (RIFF, PCM16 mono) ----
export function wavBytes(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

// ============================ BGM: cama lo-fi ============================
// Downtempo electronico mutado: pad de acordes, arpegio suave, kick
// discreto y hats de offbeat. 112 BPM, 64 beats (16 compases,
// progresion Am-F-C-G de 16 beats = loop musical de 34.3 s).
export function synthBgm() {
  const bpm = 112;
  const beats = 64;
  const T = (beats * 60) / bpm; // 34.2857 s
  const n = Math.round(T * SR);
  const out = new Float32Array(n);
  // Frecuencia cuantizada a ciclos enteros del loop => la unión
  // del loop es inaudible (condicion necesaria para -stream_loop).
  const q = (f) => Math.max(1, Math.round(f * T)) / T;
  const secPerBeat = 60 / bpm;

  // Acordes (Hz): Am, F, C, G — cada uno 16 beats.
  const chords = [
    [110.0, 130.81, 164.81],
    [87.31, 110.0, 130.81],
    [98.0, 130.81, 164.81],
    [98.0, 123.47, 146.83],
  ];
  const chordBeats = 16;
  const chordSec = chordBeats * secPerBeat;

  // 1) Pad: cada acorde con ataque/soltura lentos (1 beat) y dos
  //    osciladores ligeramente desafinados por nota (voz "analoga").
  chords.forEach((chord, ci) => {
    const t0 = Math.round(ci * chordSec * SR);
    const t1 = Math.min(n, Math.round((ci + 1) * chordSec * SR));
    const atk = secPerBeat * SR, rel = secPerBeat * SR;
    chord.forEach((f) => {
      for (const det of [1, 1.004]) {
        const fq = q(f * det);
        let ph = 0;
        for (let i = t0; i < t1; i++) {
          const tl = (i - t0) / SR;
          const env = Math.min(1, tl / (atk / SR), (chordSec - tl) / (rel / SR));
          ph += (2 * Math.PI * fq) / SR;
          out[i] += 0.055 * env * Math.sin(ph);
        }
      }
    });
  });

  // 2) Arpegio: corcheas (cada medio beat) sobre los tonos del
  //    acorde, una octava arriba, con decaimiento corto (pluck).
  const arpStep = secPerBeat / 2;
  const notesPerChord = Math.round(chordSec / arpStep);
  for (let k = 0; k * arpStep < T; k++) {
    const ci = Math.floor((k * arpStep) / chordSec) % chords.length;
    const chord = chords[ci];
    const f = q(chord[[0, 1, 2, 1][k % 4]] * 2);
    const start = Math.round(k * arpStep * SR);
    let ph = 0;
    for (let i = 0; i < Math.round(0.24 * SR) && start + i < n; i++) {
      const tau = 0.09;
      const env = Math.exp(-i / (tau * SR));
      ph += (2 * Math.PI * f) / SR;
      out[start + i] += 0.075 * env * Math.sin(ph);
    }
  }

  // 3) Kick discreto en cada beat (barrido 70->45 Hz) y hat de
  //    offbeat (ruido filtrado, muy bajo).
  const noise = makeNoise(0xB06B12);
  for (let b = 0; b < beats; b++) {
    const ks = Math.round(b * secPerBeat * SR);
    let ph = 0;
    for (let i = 0; i < Math.round(0.11 * SR) && ks + i < n; i++) {
      const t = i / SR;
      const f = 70 - 25 * (t / 0.11);
      ph += (2 * Math.PI * f) / SR;
      out[ks + i] += 0.5 * Math.exp(-t / 0.045) * Math.sin(ph);
    }
    // hat en el offbeat (medio beat despues)
    const hs = Math.round((b + 0.5) * secPerBeat * SR);
    for (let i = 0; i < Math.round(0.035 * SR) && hs + i < n; i++) {
      out[hs + i] += 0.045 * Math.exp(-i / (0.012 * SR)) * noise();
    }
  }

  // 4) Piso de ruido tipo vinilo (casi imperceptible) + bajo
  //    paso que le da el character "muted" lo-fi.
  const hiss = makeNoise(0xF11E7A);
  for (let i = 0; i < n; i++) out[i] += 0.004 * hiss();
  lowpass(out, 3200);

  // Normaliza con suavidad (tanh) a pico 0.75.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak > 0 ? 0.75 / peak : 1;
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * g) * 0.9;
  return out;
}

// Escala la senal a un pico objetivo (los SFX deben sonar
// presentes aunque la ganancia de la mezcla los baje).
function normalize(samples, peakTarget) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak <= 0) return samples;
  const g = peakTarget / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

// ================================ SFX ====================================

// Transicion de escena / paneo: ruido con barrido de corte
// (sube y baja) y envolvente suave. 0.9 s.
export function synthWhoosh() {
  const dur = 0.9;
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const noise = makeNoise(0x02F6E1);
  for (let i = 0; i < n; i++) out[i] = noise();
  // Barrido del paso bajo: 500 -> 5200 -> 700 Hz (envolvente
  // triangular en t). Aproximacion por tramos de 64 muestras.
  const seg = 64;
  const tmp = new Float32Array(seg);
  for (let s = 0; s < n; s += seg) {
    const t = (s + seg / 2) / n; // 0..1
    const up = t < 0.55 ? t / 0.55 : (1 - t) / 0.45;
    const fc = 500 + 4700 * Math.max(0, Math.min(1, up));
    const len = Math.min(seg, n - s);
    for (let i = 0; i < len; i++) tmp[i] = out[s + i];
    lowpass(tmp.subarray(0, len), fc);
    for (let i = 0; i < len; i++) out[s + i] = tmp[i];
  }
  const hp = highpass(out, 300);
  // Envolvente: fade in 0.2 s, fade out 0.35 s.
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.2, Math.max(0, (dur - t) / 0.35));
    hp[i] *= 0.55 * env;
  }
  return normalize(hp, 0.7);
}

// Nodo de diagrama / SVG apareciendo: blip de sine con subida de
// tono rapidisima y decaimiento corto. 0.16 s.
export function synthPopUi() {
  const dur = 0.16;
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const ramp = Math.min(1, t / 0.045);
    const f = 650 + 850 * ramp; // 650 -> 1500 Hz
    ph += (2 * Math.PI * f) / SR;
    ph2 += (2 * Math.PI * f * 2) / SR;
    const env = Math.exp(-t / 0.045);
    out[i] = 0.6 * env * (Math.sin(ph) + 0.25 * Math.sin(ph2));
  }
  return out;
}

// Revelado de lineas de codigo: 7 clics de ruido corto, espaciados
// irregular (humanizado) y con alternancia de acento. 0.75 s.
export function synthCodeTyping() {
  const dur = 0.75;
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const noise = makeNoise(0xC0DE7A);
  const clicks = [0, 0.085, 0.17, 0.26, 0.38, 0.5, 0.63];
  clicks.forEach((at, k) => {
    const start = Math.round(at * SR);
    const gain = k % 2 ? 0.34 : 0.5; // acento alternado (humanizado)
    for (let i = 0; i < Math.round(0.03 * SR) && start + i < n; i++) {
      const t = i / SR;
      const env = Math.exp(-t / 0.012);
      out[start + i] += gain * env * (i < 6 ? noise() * 1.4 : noise());
    }
  });
  return normalize(highpass(out, 1500), 0.6);
}

// Chime de métrica / highlight: parciales mayores (G6+C7+G7) con
// decaimiento exponencial largo. 0.65 s.
export function synthDataPing() {
  const dur = 0.65;
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const partials = [
    [1567.98, 1.0], // G6
    [2093.0, 0.6], // C7
    [3135.96, 0.22], // G7
  ];
  for (const [f, g] of partials) {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * f) / SR;
      const atk = Math.min(1, t / 0.002); // ataque casi instantaneo
      out[i] += g * 0.5 * atk * Math.exp(-t / 0.16) * Math.sin(ph);
    }
  }
  return out;
}

// ============================== Escritura ================================
export const ASSET_TARGETS = [
  { sub: "bgm", file: "bgm_bed.wav", synth: synthBgm },
  { sub: "sfx", file: "whoosh_subtle.wav", synth: synthWhoosh },
  { sub: "sfx", file: "pop_ui.wav", synth: synthPopUi },
  { sub: "sfx", file: "code_typing.wav", synth: synthCodeTyping },
  { sub: "sfx", file: "data_ping.wav", synth: synthDataPing },
];

export function writeAll(baseDir = HERE) {
  const written = [];
  for (const t of ASSET_TARGETS) {
    const dir = path.join(baseDir, t.sub);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, t.file);
    fs.writeFileSync(file, wavBytes(t.synth()));
    written.push(file);
  }
  return written;
}

// CLI: solo cuando se ejecuta directamente (en tests, importar las
// funciones sin escribir nada).
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const base = process.argv[2] ? path.resolve(process.argv[2]) : HERE;
  const written = writeAll(base);
  for (const f of written) {
    console.log(`audio stub CC0 -> ${f} (${(fs.statSync(f).size / 1024).toFixed(0)}KB)`);
  }
}
