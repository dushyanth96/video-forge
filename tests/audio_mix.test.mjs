import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildMixCommand,
  planSfx,
  swellWindows,
  sfxForBeat,
  SFX_LIBRARY,
  SFX_KINDS,
  BGM_BASE_VOLUME,
  BGM_SWELL_GAIN,
  SIDECHAIN_PARAMS,
  MIN_SWELL_WINDOW_SEC,
} from "../pipeline/lib/audio_mix.mjs";
import { synthBgm, synthWhoosh, synthPopUi, synthCodeTyping, synthDataPing, wavBytes } from "../assets/audio/make_fallback_audio.mjs";

// ---- Fijas (the script of Phase C: 4 beats, hook/concept/deep_dive/takeaway) ----
const TIMING = {
  title: "Under the Hood",
  subtitle: "The numbers",
  total: 20,
  beats: [
    { text: "hook text", type: "hook", start: 3.2, end: 9.2 },
    { text: "concept text", type: "concept", start: 9.2, end: 13.2 },
    { text: "deep dive text", type: "deep_dive", start: 13.2, end: 17.2 },
    { text: "takeaway text", type: "takeaway", start: 17.2, end: 19.0 },
  ],
};

const FILES = {
  video: "/tmp/visual.mp4",
  voice: "/tmp/voiceover.mp3",
  bgm: "/tmp/bgm_bed.wav",
  out: "/tmp/out.mp4",
};

function sfxEvents(events) {
  return events.map((e) => ({ ...e, file: `/tmp/sfx_${e.kind}.wav` }));
}

// ============================ planSfx / sfxForBeat ============================
describe("sfxForBeat", () => {
  it("todo beat trae whoosh de transicion + el efecto de su tipo", () => {
    expect(sfxForBeat({ type: "hook" }).map((e) => e.kind)).toEqual(["whoosh_subtle", "data_ping"]);
    expect(sfxForBeat({ type: "concept" }).map((e) => e.kind)).toEqual(["whoosh_subtle", "pop_ui"]);
    expect(sfxForBeat({ type: "deep_dive" }).map((e) => e.kind)).toEqual(["whoosh_subtle", "code_typing"]);
    expect(sfxForBeat({ type: "takeaway" }).map((e) => e.kind)).toEqual(["whoosh_subtle", "data_ping"]);
  });
  it("tipo desconocido: solo el whoosh (nunca crashea)", () => {
    expect(sfxForBeat({ type: "nonsense" }).map((e) => e.kind)).toEqual(["whoosh_subtle"]);
    expect(sfxForBeat({}).map((e) => e.kind)).toEqual(["whoosh_subtle"]);
  });
});

describe("planSfx", () => {
  it("un evento por efecto, en el segundo exacto del cambio de beat", () => {
    const events = planSfx(TIMING);
    expect(events).toHaveLength(8); // 4 whoosh + 4 del tipo
    expect(events.filter((e) => e.kind === "whoosh_subtle").map((e) => e.atSec)).toEqual([3.2, 9.2, 13.2, 17.2]);
    expect(events.find((e) => e.kind === "data_ping").atSec).toBe(3.2);
    expect(events.find((e) => e.kind === "pop_ui").atSec).toBe(9.2);
    expect(events.find((e) => e.kind === "code_typing").atSec).toBe(13.2);
  });
  it("ignora beats que empiezan fuera del total", () => {
    const t = { total: 10, beats: [{ type: "hook", start: 3, end: 6 }, { type: "concept", start: 12, end: 14 }] };
    const events = planSfx(t);
    expect(events.every((e) => e.atSec < 10)).toBe(true);
    expect(events.filter((e) => e.kind === "pop_ui")).toHaveLength(0);
  });
});

// ============================== swellWindows ==============================
describe("swellWindows", () => {
  it("detecta el aire de intro y outro", () => {
    const wins = swellWindows(TIMING);
    expect(wins).toEqual([[0, 3.2], [19.0, 20.0]]);
  });
  it("detecta huecos entre beats", () => {
    const t = { total: 20, beats: [{ start: 2, end: 5 }, { start: 8, end: 10 }] };
    expect(swellWindows(t)).toEqual([[0, 2], [5, 8], [10, 20]]);
  });
  it("descarta ventanas mas cortas que el minimo (0.75s)", () => {
    const t = { total: 20, beats: [{ start: 0.5, end: 5 }, { start: 5.5, end: 19.6 }] };
    expect(swellWindows(t)).toEqual([]); // hueco 0.5 y outro 0.4: demasiado cortos
  });
  it("recorta el end del beat al total", () => {
    const t = { total: 15, beats: [{ start: 2, end: 99 }] };
    // the beat cubre until the total: only queda the intro
    expect(swellWindows(t)).toEqual([[0, 2]]);
  });
});

// ============================ buildMixCommand ============================
describe("buildMixCommand — fallback graceful", () => {
  it("devuelve null sin BGM ni SFX (el video ya trae la voz)", () => {
    expect(buildMixCommand({ ...FILES, bgmPath: null, sfxEvents: [], swellWindows: [], total: 20 })).toBe(null);
  });
});

describe("buildMixCommand — solo BGM (ducking)", () => {
  const cmd = buildMixCommand({
    ...FILES,
    bgmPath: FILES.bgm,
    sfxEvents: [],
    swellWindows: swellWindows(TIMING),
    total: TIMING.total,
  });

  it("3 entradas en orden: video, voz, BGM loopeado", () => {
    const inputs = [...cmd.matchAll(/-i "[^"]+"/g)].map((m) => m[0]);
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toBe(`-i "${FILES.video}"`);
    expect(inputs[1]).toBe(`-i "${FILES.voice}"`);
    expect(cmd).toContain(`-stream_loop -1 -i "${FILES.bgm}"`);
  });

  it("BGM base a 0.12 y ducking sidechain con los parametros pedidos", () => {
    expect(BGM_BASE_VOLUME).toBe(0.12);
    expect(cmd).toContain("volume=0.12");
    expect(SIDECHAIN_PARAMS).toBe("threshold=0.08:ratio=5:attack=50:release=300");
    expect(cmd).toContain("[bgm_swell][tts_sc]sidechaincompress=threshold=0.08:ratio=5:attack=50:release=300[bgm_ducked]");
    // The sidechain is the VOICE (2do input): comprime the music, not to the reves.
    expect(cmd).not.toContain("[tts][bgm");
  });

  it("swell de +5 dB (1.78) con enable por ventana", () => {
    expect(BGM_SWELL_GAIN).toBeCloseTo(10 ** (5 / 20), 2); // +5 dB, dentro de +4..+6
    expect(cmd).toContain("volume=1.78:enable='between(t,0,3.2)+between(t,19,20)'");
  });

  it("mezcla voz+BGM y mapea solo el video de la entrada 0", () => {
    expect(cmd).toContain("[bgm_ducked][tts]amix=inputs=2:duration=first:normalize=0[vox]");
    expect(cmd).toContain('-map 0:v:0 -map "[mixed_audio]"');
    expect(cmd).toContain("-c:v copy -c:a aac -b:a 192k");
    expect(cmd).toContain("-t 20 ");
  });

  it("sin ventanas de swell: el BGM va directo al sidechain (sin volume=1.78)", () => {
    const c = buildMixCommand({ ...FILES, bgmPath: FILES.bgm, sfxEvents: [], swellWindows: [], total: 20 });
    expect(c).toContain("[bgm_quiet][tts_sc]sidechaincompress");
    expect(c).not.toContain("volume=1.78");
  });
});

describe("buildMixCommand — BGM + SFX", () => {
  const events = sfxEvents(planSfx(TIMING));
  const cmd = buildMixCommand({
    ...FILES,
    bgmPath: FILES.bgm,
    sfxEvents: events,
    swellWindows: [],
    total: TIMING.total,
  });

  it("un input propio por evento SFX (el mismo archivo puede repetirse)", () => {
    const inputs = [...cmd.matchAll(/-i "[^"]+"/g)].map((m) => m[0]);
    expect(inputs).toHaveLength(3 + events.length); // video + voz + bgm + 8 sfx
    expect(inputs.filter((i) => i.includes("sfx_whoosh_subtle"))).toHaveLength(4);
  });

  it("cada SFX lleva adelay al segundo del beat y su ganancia de la libreria", () => {
    // orden by beat: whoosh + efecto of type (hook:data_ping, concept:pop_ui,
    // deep_dive:code_typing, takeaway:data_ping)
    expect(cmd).toContain("[3:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=3200:all=1,volume=0.25[sfx0]"); // whoosh beat 1
    expect(cmd).toContain("adelay=3200:all=1,volume=0.35[sfx1]"); // data_ping hook
    expect(cmd).toContain("adelay=9200:all=1,volume=0.3[sfx3]"); // pop_ui concept
    expect(cmd).toContain("adelay=13200:all=1,volume=0.2[sfx5]"); // code_typing deep_dive
    expect(cmd).toContain("adelay=17200:all=1,volume=0.35[sfx7]"); // data_ping takeaway
  });

  it("amix final junta voz + todos los SFX", () => {
    expect(cmd).toContain("[vox][sfx0][sfx1][sfx2][sfx3][sfx4][sfx5][sfx6][sfx7]amix=inputs=9:duration=first:normalize=0[mixed_pre]");
  });

  it("descarta eventos SFX en o después del final del video", () => {
    const late = [{ kind: "whoosh_subtle", atSec: 19.97, file: "/tmp/late.wav" }];
    const c = buildMixCommand({ ...FILES, bgmPath: FILES.bgm, sfxEvents: late, swellWindows: [], total: 20 });
    expect(c).not.toContain("late.wav");
    expect(c).toContain("amix=inputs=2"); // solo voz + BGM
  });
});

describe("buildMixCommand — SFX sin BGM", () => {
  it("la voz va directa al amix (sin sidechain) y sigue habiendo mezcla", () => {
    const cmd = buildMixCommand({
      ...FILES,
      bgmPath: null,
      sfxEvents: sfxEvents([{ kind: "data_ping", atSec: 3.2 }]),
      swellWindows: [],
      total: 20,
    });
    expect(cmd).toContain("volume=0.35[sfx0]");
    expect(cmd).toContain("[tts][sfx0]amix=inputs=2:duration=first:normalize=0[mixed_pre]");
    expect(cmd).not.toContain("sidechaincompress");
  });
});

// ============ validez sintactica of the -filter_complex (without ffmpeg) ============
describe("el -filter_complex ensamblado es un grafo de etiquetas valido", () => {
  function checkGraph(cmd) {
    const fc = cmd.match(/-filter_complex "([^"]+)"/)[1];
    expect(fc).not.toMatch(/;;/); // sin cadenas vacias
    expect(fc.startsWith(";")).toBe(false);
    expect(fc.endsWith(";")).toBe(false);
    // Corchetes balanceados
    expect((fc.match(/\[/g) || []).length).toBe((fc.match(/\]/g) || []).length);
    // All tag interna is define a vez and is consume a vez;
    // the inputs externas [N:to] is consumen a vez; the unico
    // output of the grafo ([mixed_audio]) is consume via -map.
    const labels = [...fc.matchAll(/\[([a-zA-Z0-9_:]+)\]/g)].map((m) => m[1]);
    const counts = {};
    for (const l of labels) counts[l] = (counts[l] || 0) + 1;
    const externals = labels.filter((l) => /^\d+:a$/.test(l));
    const internals = labels.filter((l) => !/^\d+:a$/.test(l));
    for (const l of externals) expect(counts[l]).toBe(1);
    const outputs = internals.filter((l) => counts[l] === 1);
    expect(outputs).toEqual(["mixed_audio"]);
    for (const l of internals) if (l !== "mixed_audio") expect(counts[l]).toBe(2);
    // amix=inputs=N coincide with the cantidad of tags that lo alimentan
    for (const m of fc.matchAll(/((?:\[[^\]]+\])+)amix=inputs=(\d+)/g)) {
      const feeders = [...m[1].matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]);
      expect(Number(m[2])).toBe(feeders.length);
    }
  }

  it("BGM + swell + 8 SFX", () => {
    checkGraph(buildMixCommand({
      ...FILES, bgmPath: FILES.bgm, sfxEvents: sfxEvents(planSfx(TIMING)),
      swellWindows: swellWindows(TIMING), total: TIMING.total,
    }));
  });
  it("solo BGM", () => {
    checkGraph(buildMixCommand({ ...FILES, bgmPath: FILES.bgm, sfxEvents: [], swellWindows: [], total: 20 }));
  });
  it("solo SFX", () => {
    checkGraph(buildMixCommand({
      ...FILES, bgmPath: null, sfxEvents: sfxEvents(planSfx(TIMING)),
      swellWindows: [], total: TIMING.total,
    }));
  });
});

// ============================ libreria de SFX ============================
describe("SFX_LIBRARY", () => {
  it("tiene los 4 efectos tactiles con ganancia", () => {
    expect(SFX_KINDS).toEqual(["whoosh_subtle", "pop_ui", "code_typing", "data_ping"]);
    for (const k of SFX_KINDS) {
      expect(SFX_LIBRARY[k].gain).toBeGreaterThan(0);
      expect(SFX_LIBRARY[k].gain).toBeLessThanOrEqual(1);
    }
  });
});

// ==================== sintesis fallback (determinista) ====================
describe("make_fallback_audio — sintesis CC0 determinista", () => {
  it("BGM: ~34.3 s a 22050 Hz (64 beats a 112 BPM), deterministico", () => {
    const a = synthBgm();
    const b = synthBgm();
    expect(a).toBeInstanceOf(Float32Array);
    expect(a.length).toBe(Math.round((64 * 60) / 112 * 22050));
    expect(Array.from(a.slice(0, 500))).toEqual(Array.from(b.slice(0, 500))); // sin Math.random
    let peak = 0;
    for (const v of a) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThanOrEqual(1);
  });
  it("SFX: duraciones pedidas, deterministicos, pico normalizado", () => {
    const cases = [
      [synthWhoosh, 0.9], [synthPopUi, 0.16], [synthCodeTyping, 0.75], [synthDataPing, 0.65],
    ];
    for (const [fn, dur] of cases) {
      const s = fn();
      expect(s.length).toBeCloseTo(dur * 22050, -1);
      const again = fn();
      expect(Array.from(s)).toEqual(Array.from(again));
      let peak = 0;
      for (const v of s) peak = Math.max(peak, Math.abs(v));
      expect(peak).toBeGreaterThan(0.3); // presentes en la mezcla
      expect(peak).toBeLessThanOrEqual(1);
    }
  });
  it("wavBytes escribe un RIFF/PCM16 mono con sizes correctos", () => {
    const buf = wavBytes(new Float32Array([0.5, -0.5, 0, 0.25]));
    expect(buf.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buf.toString("ascii", 8, 12)).toBe("WAVE");
    expect(buf.readUInt32LE(4)).toBe(36 + 8); // chunkSize = 36 + data
    expect(buf.readUInt32LE(40)).toBe(8); // data bytes = 4 samples * 2
    expect(buf.readUInt16LE(22)).toBe(1); // mono
    expect(buf.readUInt16LE(34)).toBe(16); // PCM 16-bit
  });
});

// ============== contratos of the phase: workflow + docs ==============
describe("motiongfx_daily.yml — persistencia de past_topics.json", () => {
  const yml = fs.readFileSync(path.join(import.meta.dirname, "..", ".github", "workflows", "motiongfx_daily.yml"), "utf8");

  it("restaura past_topics.json desde R2 antes del guion", () => {
    expect(yml).toContain("node pipeline/lib/r2_tool.mjs get motiongfx/past_topics.json pipeline/data/past_topics.json");
    const restoreAt = yml.indexOf("r2_tool.mjs get motiongfx/past_topics.json");
    const scriptAt = yml.indexOf("generate_script.mjs");
    expect(restoreAt).toBeGreaterThan(0);
    expect(restoreAt).toBeLessThan(scriptAt);
  });
  it("persiste past_topics.json en R2 con if: always() (aunque el render falle)", () => {
    expect(yml).toContain("if: always()");
    expect(yml).toContain("node pipeline/lib/r2_tool.mjs put motiongfx/past_topics.json pipeline/data/past_topics.json application/json");
  });
});

describe("docs/SETUP.md — referencia de build_composition.mjs corregida", () => {
  const md = fs.readFileSync(path.join(import.meta.dirname, "..", "docs", "SETUP.md"), "utf8");
  it("build_composition.mjs recibe timing.json, no script.json", () => {
    expect(md).toContain("build_composition.mjs work/timing.json work/composition.html voiceover.mp3");
    expect(md).not.toContain("build_composition.mjs work/script.json");
  });
  it("documenta el render completo (render.mjs)", () => {
    expect(md).toContain("render.mjs work work/script.json out/motion.mp4");
  });
});
