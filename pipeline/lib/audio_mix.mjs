// audio_mix.mjs — mezcla de audio del pipeline de motion graphics (logica PURA).
//
// Construye el comando ffmpeg que junta 3 canales:
//   - entrada 0: video ya renderizado (se usa SOLO su pista visual, -map 0:v:0)
//   - entrada 1: voiceover / TTS
//   - entrada 2: BGM, loopeado a la duracion del video (-stream_loop -1)
//   - entradas 3..N: SFX disparados en los cambios de beat (timing.json)
//
// Ducking: sidechaincompress baja el BGM mientras la voz está activa y,
// cuando la voz se suelta (pausas entre frases), el release=300 deja que el
// BGM vuelva a subir. Además, las ventanas sin beats (intro, huecos, outro)
// suben el BGM +5 dB (rango pedido: +4..+6 dB).
//
// NOTA de corrección: el snippet clásico "[tts][bgm_quiet]sidechaincompress"
// aplastaría la VOZ contra la musica (el sidechain es el 2do input). Aquí el
// orden es [bgm][tts_sc]sidechaincompress: el BGM es la señal y la voz el
// sidechain, que es lo que produce el ducking pedido ("BGM a -24 dB con voz").
//
// Devuelve null cuando no hay BGM ni SFX: el video renderizado ya trae la
// voz y no hay nada que mezclar (fallback graceful: voz sola, sin fallar).
//
// Pureza (regla del repo): sin I/O ni red — render.mjs resuelve rutas,
// ejecuta el comando y aplica los fallbacks.

// BGM base a 0.12 (~-18 dB): cama baja bajo la narración.
export const BGM_BASE_VOLUME = 0.12;
// +5 dB (punto medio del rango +4..+6 dB pedido) en ventanas sin voz/beats.
export const BGM_SWELL_GAIN = 1.78;
// Parametros de ducking pedidos: umbral 0.08 (~-22 dB), ratio 5:1,
// attack 50 ms, release 300 ms.
export const SIDECHAIN_PARAMS = "threshold=0.08:ratio=5:attack=50:release=300";
// Ventanas mas cortas que esto no valen la pena como "pausa" de swell.
export const MIN_SWELL_WINDOW_SEC = 0.75;

// Libreria de SFX (assets/audio/sfx/). gain = ganancia relativa del efecto.
export const SFX_LIBRARY = {
  whoosh_subtle: { gain: 0.25 }, // transiciones de escena / paneo de camara
  pop_ui: { gain: 0.3 }, // nodos de diagrama / elementos SVG apareciendo
  code_typing: { gain: 0.2 }, // revelado de lineas de sintaxis / codigo
  data_ping: { gain: 0.35 }, // chimes de highlight / métricas
};
export const SFX_KINDS = Object.keys(SFX_LIBRARY);

// Cada cambio de beat trae un whoosh (transición de escena); el tipo de beat
// decide el efecto tactil que lo acompaña.
const SFX_BY_BEAT_TYPE = {
  hook: ["data_ping"], // el dato sorpresa del gancho resuena
  concept: ["pop_ui"], // diagrama: nodos apareciendo
  deep_dive: ["code_typing"], // bajo el capo: revelado de código
  takeaway: ["data_ping"], // cierre: el resumen queda marcado
};

// Efectos para un beat: siempre el whoosh de transición + el del tipo.
export function sfxForBeat(beat) {
  const kinds = ["whoosh_subtle", ...(SFX_BY_BEAT_TYPE[String(beat.type)] || [])];
  return kinds.map((kind) => ({ kind }));
}

// Plan de SFX a partir del timing: un evento por efecto, en el segundo exacto
// del cambio de beat (data-start del beat en timing.json).
export function planSfx(timing) {
  const events = [];
  for (const b of timing.beats || []) {
    const atSec = parseFloat(b.start);
    if (!Number.isFinite(atSec) || !(atSec < parseFloat(timing.total))) continue;
    for (const e of sfxForBeat(b)) events.push({ kind: e.kind, atSec: +atSec.toFixed(2) });
  }
  return events;
}

// Ventanas "de aire": complemento de los beats dentro de [0, total].
// Son las pausas estructurales (intro, huecos, outro) donde el BGM sube +5 dB.
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

// Expresión enable='...' de ffmpeg para las ventanas de swell.
function swellEnable(windows) {
  return windows.map(([a, b]) => `between(t,${a},${b})`).join("+");
}

// Comando ffmpeg completo (string) o null si no hay nada que mezclar.
//
// opts: {
//   videoPath (o video), voiceoverPath (o voice), outPath (o out),
//   total,
//   bgmPath: string|null,
//   sfxEvents: [{ file, atSec, gain? }],  // file YA resuelta en
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

  // Entradas: 0=video, 1=voiceover, 2=BGM (si hay), 3..N = un input por
  // evento SFX (el mismo archivo puede repetirse: cada evento necesita su
  // propio adelay, y un label de ffmpeg solo se puede consumir una vez).
  const inputs = [`-i "${videoPath}"`, `-i "${voiceoverPath}"`];
  if (bgmPath) inputs.push(`-stream_loop -1 -i "${bgmPath}"`);

  const F = [];
  // Voz: formato común, relleno de silencio hasta la duración total (la voz
  // termina antes que el video: intro + outro). Con BGM se abre una segunda
  // rama (asplit) para alimentar el sidechain del ducking; sin BGM la rama
  // no existe — una etiqueta generada y nunca consumida rompe el grafo.
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
    // Ducking: el BGM se comprime contra la voz (sidechain = tts_sc).
    // bgmBus YA lleva sus corchetes: no envolverlo otra vez.
    F.push(`${bgmBus}[tts_sc]sidechaincompress=${SIDECHAIN_PARAMS}[bgm_ducked]`);
    F.push(`[bgm_ducked][tts]amix=inputs=2:duration=first:normalize=0[vox]`);
    voiceBus = "[vox]";
  }

  // SFX: uno por evento, con adelay al segundo del cambio de beat.
  const sfxLabels = [];
  events.forEach((e) => {
    const idx = inputs.length;
    inputs.push(`-i "${e.file}"`);
    const ms = Math.max(0, Math.round(parseFloat(e.atSec) * 1000));
    const lbl = `sfx${sfxLabels.length}`;
    // Ganancia: la del evento o, si no trae, la de la libreria
    // por tipo (el plan de planSfx no lleva gain explicito).
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
