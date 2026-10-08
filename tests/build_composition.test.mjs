import { describe, it, expect, vi } from "vitest";
import { buildComposition } from "../pipeline/motiongfx/build_composition.mjs";

// ---- Fija: 7 beats that cubren all the layouts
// (hook, concept, deep_dive, stat, takeaway, concept corto, cta) ----
const TIMING = {
  title: "The Psychology Of Discipline",
  subtitle: "The numbers behind the story",
  beats: [
    { text: "You're not lazy. You're overloaded.", type: "hook", start: 3.2, end: 8.0 },
    { text: "Most people think discipline is about willpower. It is actually about system design.", type: "concept", start: 8.0, end: 20.0 },
    { text: "A pipeline turns raw inputs into finished work without constant supervision.", type: "deep_dive", start: 20.0, end: 32.0 },
    { text: "Over 2 billion people struggle with focus every single day.", type: "stat", start: 32.0, end: 40.0 },
    { text: "Discipline is consistency.", type: "takeaway", start: 40.0, end: 46.0 },
    { text: "Small systems beat big goals.", type: "concept", start: 46.0, end: 47.5 },
    { text: "Start today. Stay consistent.", type: "cta", start: 47.5, end: 51.0 },
  ],
  total: 54.0,
};

// Ejecuta the <script> of a composicion with stubs of navegador.
// Captura ReferenceErrors (identificadores filtrados of the builder) that
// node --check not ve, and devuelve the tweens construidos.
function runScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no se encontro <script>");
  const code = m[1];
  const tweens = [];
  const mkTl = () => ({
    fromTo: (...a) => tweens.push(["fromTo", ...a]),
    to: (...a) => tweens.push(["to", ...a]),
    from: (...a) => tweens.push(["from", ...a]),
    eventCallback: () => {},
    time: () => 0,
  });
  const tl = mkTl();
  const gsap = { timeline: () => tl };
  const ctx2d = { clearRect() {}, beginPath() {}, arc() {}, fill() {} };
  const documentStub = { getElementById: () => ({ getContext: () => ctx2d }) };
  const windowStub = {};
  const fn = new Function("gsap", "document", "window", "console", `${code}\nreturn window.__timelines;`);
  const timelines = fn(gsap, documentStub, windowStub, console);
  return { timelines, tweens };
}

// ============================ runtime of the <script> ============================
describe("script de la composicion (smoke de runtime)", () => {
  it("se ejecuta sin errores y registra window.__timelines.main", () => {
    const { timelines } = runScript(buildComposition(TIMING));
    expect(timelines).toBeTruthy();
    expect(timelines.main).toBeTruthy();
  });

  it("construye tweens: cada beat, intro, outro y progreso se animan", () => {
    const { tweens } = runScript(buildComposition(TIMING));
    expect(tweens.length).toBeGreaterThan(20);
    const sels = tweens.map(([, sel]) => sel);
    for (let i = 0; i < TIMING.beats.length; i++) {
      expect(sels.some((s) => s.startsWith(`#beat${i}`)), `beat ${i} sin tweens`).toBe(true);
    }
    expect(sels.some((s) => s.startsWith("#intro"))).toBe(true);
    expect(sels.some((s) => s.startsWith("#outro"))).toBe(true);
    expect(sels.some((s) => s.startsWith("#prog0"))).toBe(true);
  });

  it("todo tween tiene selector '#...' y posicion absoluta numerica (seek-safe)", () => {
    const { tweens } = runScript(buildComposition(TIMING));
    // to(target,vars,pos) -> pos en a[2]; fromTo(target,from,to,pos) -> pos en a[4].
    for (const [kind, sel, , a3, a4] of tweens) {
      const pos = kind === "to" ? a3 : a4;
      expect(typeof sel === "string" && sel.startsWith("#"), `selector raro en ${kind}: ${sel}`).toBe(true);
      expect(typeof pos === "number" && Number.isFinite(pos), `posicion no numerica en ${kind} @ ${sel}: ${pos}`).toBe(true);
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThanOrEqual(TIMING.total);
    }
  });

  it("es determinista: nada de Date.now / Math.random / fetch", () => {
    const code = buildComposition(TIMING).match(/<script>([\s\S]*?)<\/script>/)[1];
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\bfetch\b/);
    expect(buildComposition(TIMING)).toBe(buildComposition(TIMING));
  });
});

// ============================ design system (docs/design_system.md) ============================
describe("design system v1.0", () => {
  const html = buildComposition(TIMING);

  it("lienzo 16:9 (1920x1080) con canvas de particulas del mismo tamaño", () => {
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
    expect(html).toContain('<canvas id="particles" width="1920" height="1080">');
  });

  it("paleta 70/20/10: #0B0B0B fondo / #FFFFFF primario / #FF6B00 acento", () => {
    expect(html).toContain("--bg:#0B0B0B");
    expect(html).toContain("--surface:#111111");
    expect(html).toContain("--primary:#FFFFFF");
    expect(html).toContain("--accent:#FF6B00");
  });

  it("solo las 3 tipografias del sistema (League Spartan, Alex Brush, Inter)", () => {
    expect(html).toContain("family=Alex+Brush");
    expect(html).toContain("family=Inter:wght@400");
    expect(html).toContain("family=League+Spartan:wght@800");
    for (const m of html.matchAll(/font-family:"([^"]+)"/g)) {
      expect(["League Spartan", "Alex Brush", "Inter"]).toContain(m[1]);
    }
  });

  it("safe area 16:9 re-escalada del spec 9:16 (padding 90/140/170)", () => {
    expect(html).toContain("padding:90px 140px 170px");
  });

  it("un frame = una idea: 9 escenas (intro + 7 beats + outro), 3 split 16:9", () => {
    expect((html.match(/class="clip scene/g) || []).length).toBe(9);
    expect((html.match(/class="clip scene split/g) || []).length).toBe(3);
  });

  it("regla HyperFrames 1: todo clip lleva data-start, data-duration y data-track-index", () => {
    const clips = [...html.matchAll(/<[^>]*class="clip[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(clips.length).toBeGreaterThan(10);
    for (const tag of clips) {
      expect(tag).toMatch(/data-start="/);
      expect(tag).toMatch(/data-duration="/);
      expect(tag).toMatch(/data-track-index="/);
    }
  });

  it("cifra gigante: el stat '2 billion people' vira hero 2B / PEOPLE (spec §31)", () => {
    expect(html).toContain('class="hero-big">2B<');
    expect(html).toContain('class="hero-sub">PEOPLE<');
  });

  it("indicador de progreso '0X / 0N' por beat (spec §39)", () => {
    expect(html).toContain('class="on">01</span> / 07');
    expect(html).toContain('class="on">07</span> / 07');
  });

  it("Alex Brush visible >= 1.2s: beat corto extiende su escena (spec §3)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = buildComposition(TIMING);
    // Beat 6 (index 5) dura 1.5s; the regla extiende the scene to 2.25s.
    expect(out).toMatch(/id="beat5" data-start="46\.00" data-duration="2\.25"/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("demasiado corto"));
    // mockRestore() deletes the historial of llamadas in vitest: restaurar
    // only after of the asserts.
    warn.mockRestore();
  });

  it("keyword Alex Brush con subrayado en el takeaway (spec §38)", () => {
    const { tweens } = runScript(html);
    expect(tweens.some(([k, sel]) => k === "to" && sel === "#beat4 .uline")).toBe(true);
  });

  it("pista de voz aparte, src por defecto voiceover.mp3 y configurable", () => {
    expect(html).toContain('<audio id="voz" class="clip" data-start="0" data-duration="54.00" data-track-index="90" src="voiceover.mp3">');
    expect(buildComposition(TIMING, { audioFile: "mi_voz.mp3" })).toContain('src="mi_voz.mp3"');
  });
});

// ============================ bordes ============================
describe("bordes", () => {
  it("timing sin beats: no crashea, sigue registrando timeline", () => {
    const { timelines, tweens } = runScript(buildComposition({ title: "T", subtitle: "S", total: 10, beats: [] }));
    expect(timelines.main).toBeTruthy();
    expect(tweens.length).toBeGreaterThan(0);
  });

  it("beats con start >= total se filtran (no generan escenas)", () => {
    const html = buildComposition({
      title: "T", subtitle: "S", total: 10,
      beats: [
        { text: "valid beat here", type: "hook", start: 1.0, end: 5.0 },
        { text: "late beat here", type: "hook", start: 12.0, end: 15.0 },
      ],
    });
    expect(html).toContain('id="beat0"');
    expect(html).not.toContain('id="beat1"');
  });

  it("beats vacios o texto ausente: fallback sin crashear", () => {
    const { timelines } = runScript(buildComposition({ title: "T", subtitle: "S", total: 10, beats: [{ type: "hook", start: 1, end: 5 }] }));
    expect(timelines.main).toBeTruthy();
  });
});
