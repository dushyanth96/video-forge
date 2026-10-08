import { describe, it, expect } from "vitest";
import { findOutliers } from "../pipeline/lib/video_score.mjs";

// Construye episodios maduros with vistas suficientes for pasar the pisos.
const ep = (id, titulo, pct) => ({
  video_id: id, title: titulo, format: "short",
  age_days: 20, views: 500, vpd: 10, vs_baseline_pct: pct,
});

// Titles that the clasificador lee as cada type of hook.
const lista = (n) => `${n} Oddly Satisfying Facts That Reset Your Brain`;
const pregunta = (n) => `Why Do Otters Hold Hands? ${n}`;

describe("findOutliers corregido por tasa base", () => {
  it("NO propone replicar el formato dominante solo por ser dominante", () => {
    // The caso real of Oddly: channel hecho casi entero of listicles. The ganadores are
    // listicles because EVERYTHING is listicle, not because the formato funcione.
    const eps = [];
    for (let i = 0; i < 90; i++) eps.push(ep(`l${i}`, lista(i), i < 20 ? 120 : -10));
    for (let i = 0; i < 10; i++) eps.push(ep(`q${i}`, pregunta(i), i < 2 ? 120 : -10));

    const r = findOutliers(eps);
    expect(r.count).toBeGreaterThan(0);
    // The hook dominante between ganadores is the same that the of the channel -> without lift.
    expect(r.pattern.hook.lift).toBeLessThan(1.3);
    expect(r.suggestion).toMatch(/NINGÚN patrón está sobre-representado/);
    expect(r.suggestion).toMatch(/PROBAR algo distinto/);
    // Lo that NOT must decir: "replicar".
    expect(r.suggestion).not.toMatch(/^Replicar/);
  });

  it("SÍ detecta un patrón cuando esta de verdad sobre-representado", () => {
    // The preguntas are the 10% of the channel but the 70% of the ganadores: eso yes is señal.
    const eps = [];
    for (let i = 0; i < 90; i++) eps.push(ep(`l${i}`, lista(i), i < 3 ? 120 : -10));
    for (let i = 0; i < 10; i++) eps.push(ep(`q${i}`, pregunta(i), i < 7 ? 200 : -10));

    const r = findOutliers(eps);
    expect(r.pattern.hook.lift).toBeGreaterThanOrEqual(1.3);
    expect(r.pattern.hook.count).toBeGreaterThanOrEqual(3);
    expect(r.suggestion).toMatch(/SOBRE-representado/);
  });

  it("no canta patrón con uno o dos ganadores sueltos (lift alto por azar)", () => {
    // A sola pregunta ganadora da lift enorme but not is evidencia of nothing.
    const eps = [];
    for (let i = 0; i < 90; i++) eps.push(ep(`l${i}`, lista(i), -10));
    eps.push(ep("q0", pregunta(0), 300));

    const r = findOutliers(eps);
    expect(r.count).toBe(1);
    expect(r.suggestion).not.toMatch(/^Replicar/);
  });

  it("reporta la proporcion del canal junto a la de los ganadores", () => {
    const eps = [];
    for (let i = 0; i < 90; i++) eps.push(ep(`l${i}`, lista(i), i < 20 ? 120 : -10));
    for (let i = 0; i < 10; i++) eps.push(ep(`q${i}`, pregunta(i), -10));
    const r = findOutliers(eps);
    expect(r.pattern.hook).toHaveProperty("base_rate");
    expect(r.pattern.hook).toHaveProperty("share");
    expect(r.pattern.base_rate_corrected).toBe(true);
  });

  it("sin outliers lo dice y no inventa patron", () => {
    const eps = [];
    for (let i = 0; i < 20; i++) eps.push(ep(`l${i}`, lista(i), -10));
    const r = findOutliers(eps);
    expect(r.count).toBe(0);
    expect(r.suggestion).toMatch(/Aún sin outliers/);
  });

  it("no revienta con entradas vacias", () => {
    for (const e of [[], null, undefined]) {
      const r = findOutliers(e);
      expect(r.count).toBe(0);
      expect(typeof r.suggestion).toBe("string");
    }
  });
});
