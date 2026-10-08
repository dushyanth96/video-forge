// audio_mix.mjs — mezcla of audio of the pipeline of motion graphics (logica PURA).
//
// Construye the comando ffmpeg that junta 3 channels:
//   - input 0: video already renderizado (is uses ONLY its track visual, -map 0:v:0)
//   - entrada 1: voiceover / TTS
//   - input 2: BGM, loopeado to the duration of the video (-stream_loop -1)
//   - inputs 3..N: SFX disparados in the cambios of beat (timing.JSON)
//
// Ducking: sidechaincompress downloads the BGM mientras the voice is activa and,
// when the voice is suelta (pausas between frases), the release=300 deja that the
// BGM vuelva to upload. Además, the ventanas without beats (intro, huecos, outro)
// suben the BGM +5 dB (rango pedido: +4..+6 dB).
//
// SCORE of corrección: the snippet clásico "[tts][bgm_quiet]sidechaincompress"
// aplastaría the VOICE contra the music (the sidechain is the 2do input). Here the
// orden is [bgm][tts_sc]sidechaincompress: the BGM is the señal and the voice the
// sidechain, that is lo that produce the ducking pedido ("BGM to -24 dB with voice").
//
// Devuelve null when not hay BGM nor SFX: the video renderizado already trae the
// voice and not hay nothing that mezclar (fallback graceful: voice sola, without fallar).
//
// Pureza (regla of the repo): without I/or nor red — render.mjs resuelve rutas,
// ejecuta the comando and aplica the fallbacks.

// BGM base to 0.12 (~-18 dB): cama downloads bajo the narration.
export const BGM_BASE_VOLUME = 0.12;
// +5 dB (punto medio of the rango +4..+6 dB pedido) in ventanas without voice/beats.
export const BGM_SWELL_GAIN = 1.78;
// Parametros de ducking pedidos: umbral 0.08 (~-22 dB), ratio 5:1,
// attack 50 ms, release 300 ms.
export const SIDECHAIN_PARAMS = "threshold=0.08:ratio=5:attack=50:release=300";
// Ventanas more cortas that esto not valen the pena as "pausa" of swell.
export const MIN_SWELL_WINDOW_SEC = 0.75;

// Libreria of SFX (assets/audio/sfx/). gain = ganancia relativa of the efecto.
export const SFX_LIBRARY = {
  whoosh_subtle: { gain: 0.25 }, // transiciones de escena / paneo de camara
  pop_ui: { gain: 0.3 }, // nodos de diagrama / elementos SVG apareciendo
  code_typing: { gain: 0.2 }, // revelado de lineas de sintaxis / codigo
  data_ping: { gain: 0.35 }, // chimes de highlight / métricas
};
export const SFX_KINDS = Object.keys(SFX_LIBRARY);

// Cada cambio of beat trae a whoosh (transition of scene); the type of beat
// decide the efecto tactil that lo acompaña.
const SFX_BY_BEAT_TYPE = {
  hook: ["data_ping"], // el dato sorpresa del gancho resuena
  concept: ["pop_ui"], // diagrama: nodos apareciendo
  deep_dive: ["code_typing"], // bajo el capo: revelado de código
  takeaway: ["data_ping"], // cierre: el resumen queda marcado
};

// Efectos for a beat: always the whoosh of transition + the of the type.
export function sfxForBeat(beat) {
  const kinds = ["whoosh_subtle", ...(SFX_BY_BEAT_TYPE[String(beat.type)] || [])];
  return kinds.map((kind) => ({ kind }));
}

// Plan of SFX to partir of the timing: a evento by efecto, in the second exacto
// of the cambio of beat (data-start of the beat in timing.JSON).
export function planSfx(timing) {
  const events = [];
  for (const b of timing.beats || []) {
    const atSec = parseFloat(b.start);
    if (!Number.isFinite(atSec) || !(atSec < parseFloat(timing.total))) continue;
    for (const e of sfxForBeat(b)) events.push({ kind: e.kind, atSec: +atSec.toFixed(2) });
  }
  return events;
}

// Ventanas "of aire": complemento of the beats dentro of [0, total].
// Are the pausas estructurales (intro, huecos, outro) where the BGM uploads +5 dB.
export function swellWindows(timing) {
  const total = Math.max(0, parseFloat(timing.total) || 0);
  const beats = (timing.beats || [])
    .filter((b) => Number.isFinite(parseFloat(b.start)) && parseFloat(b.start) < total)
    .sort((a, b) => parseFloat(a.start) - parseFloat(b.start));
  const r2 = (n) => +n.toFixed(2);
  const wins = [];
  let cursor = 0;
  for (const b of beats) {
    const start = parseFloat(b.start);
    const end = Math.min(Math.max(start, parseFloat(b.end) || start), total);
    if (start - cursor >= MIN_SWELL_WINDOW_SEC) wins.push([r2(cursor), r2(start)]);
    cursor = Math.max(cursor, end);
  }
  if (total - cursor >= MIN_SWELL_WINDOW_SEC) wins.push([r2(cursor), r2(total)]);
  return wins;
}

// Expresión enable='...' of ffmpeg for the ventanas of swell.
function swellEnable(windows) {
  return windows.map(([a, b]) => `between(t,${a},${b})`).join("+");
}

// Comando ffmpeg completo (string) or null if not hay nothing that mezclar.
//
// opts: {
//   videoPath (or video), voiceoverPath (or voice), outPath (or out),
//   total,
//   bgmPath: string|null,
//   sfxEvents: [{ file, atSec, gain? }],  // file ALREADY resuelta in
//     disco; sin gain, se usa SFX_LIBRARY[kind].gain
//   swellWindows: [[aSec, bSec], ...],
// }
export function buildMixCommand(opts) {
  const videoPath = opts.videoPath || opts.video;
  const voiceoverPath = opts.voiceoverPath || opts.voice;
  const outPath = opts.outPath || opts.out;
  const total = opts.total;
  const T = +Number.parseFloat(total).toFixed(2);
  const bgmPath = opts.bgmPath || null;
  const events = (opts.sfxEvents || []).filter(
    (e) => e && e.file && Number.isFinite(parseFloat(e.atSec)) && parseFloat(e.atSec) < T - 0.05
  );
  if (!bgmPath && !events.length) return null;

  // Inputs: 0=video, 1=voiceover, 2=BGM (if hay), 3..N = a input by
  // evento SFX (the same file can repetirse: cada evento needs its
  // propio adelay, and a label of ffmpeg only is can consumir a vez).
  const inputs = [`-i "${videoPath}"`, `-i "${voiceoverPath}"`];
  if (bgmPath) inputs.push(`-stream_loop -1 -i "${bgmPath}"`);

  const F = [];
  // Voice: formato común, relleno of silencio until the duration total (the voice
  // termina before that the video: intro + outro). With BGM is abre a second
  // branch (asplit) for alimentar the sidechain of the ducking; without BGM the branch
  // not existe — a tag generada and never consumida rompe the grafo.
  const VOICE_PRE =
    `aformat=sample_rates=48000:channel_layouts=stereo,` +
    `apad=whole_dur=${T},atrim=0:${T},asetpts=N/SR/TB`;
  let voiceBus;
  if (bgmPath) {
    F.push(`[1:a]${VOICE_PRE},asplit=2[tts][tts_sc]`);
  } else {
    F.push(`[1:a]${VOICE_PRE}[tts]`);
    voiceBus = "[tts]";
  }

  if (bgmPath) {
    F.push(`[2:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${T},asetpts=N/SR/TB[bgm_loop]`);
    F.push(`[bgm_loop]volume=${BGM_BASE_VOLUME}[bgm_quiet]`);
    let bgmBus = "[bgm_quiet]";
    const wins = opts.swellWindows || [];
    if (wins.length) {
      F.push(`[bgm_quiet]volume=${BGM_SWELL_GAIN}:enable='${swellEnable(wins)}'[bgm_swell]`);
      bgmBus = "[bgm_swell]";
    }
    // Ducking: the BGM is comprime contra the voice (sidechain = tts_sc).
    // bgmBus ALREADY lleva its corchetes: not envolverlo other vez.
    F.push(`${bgmBus}[tts_sc]sidechaincompress=${SIDECHAIN_PARAMS}[bgm_ducked]`);
    F.push(`[bgm_ducked][tts]amix=inputs=2:duration=first:normalize=0[vox]`);
    voiceBus = "[vox]";
  }

  // SFX: uno by evento, with adelay to the second of the cambio of beat.
  const sfxLabels = [];
  events.forEach((e) => {
    const idx = inputs.length;
    inputs.push(`-i "${e.file}"`);
    const ms = Math.max(0, Math.round(parseFloat(e.atSec) * 1000));
    const lbl = `sfx${sfxLabels.length}`;
    // Ganancia: the of the evento or, if not trae, the of the libreria
    // by type (the plan of planSfx not lleva gain explicito).
    const gain =
      Number.parseFloat(e.gain) ||
      (SFX_LIBRARY[e.kind] && SFX_LIBRARY[e.kind].gain) ||
      1;
    F.push(
      `[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,` +
        `adelay=${ms}:all=1,volume=${gain}[${lbl}]`
    );
    sfxLabels.push(`[${lbl}]`);
  });

  if (sfxLabels.length) {
    F.push(`${voiceBus}${sfxLabels.join("")}amix=inputs=${sfxLabels.length + 1}:duration=first:normalize=0[mixed_pre]`);
    F.push(`[mixed_pre]atrim=0:${T},asetpts=N/SR/TB[mixed_audio]`);
  } else {
    F.push(`${voiceBus}atrim=0:${T},asetpts=N/SR/TB[mixed_audio]`);
  }

  return (
    `ffmpeg -y ${inputs.join(" ")} ` +
    `-filter_complex "${F.join(";")}" ` +
    `-map 0:v:0 -map "[mixed_audio]" ` +
    `-c:v copy -c:a aac -b:a 192k -t ${T} -movflags +faststart "${outPath}"`
  );
}
