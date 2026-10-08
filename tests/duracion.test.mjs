import { describe, it, expect } from "vitest";
import { segundosISO, esLargo, SEGUNDOS_SHORT } from "../pipeline/lib/duracion.mjs";

describe("segundosISO", () => {
  it("lee los formatos que devuelve YouTube", () => {
    expect(segundosISO("PT50S")).toBe(50);
    expect(segundosISO("PT1M30S")).toBe(90);
    expect(segundosISO("PT13M58S")).toBe(838);
    expect(segundosISO("PT1H2M3S")).toBe(3723);
    expect(segundosISO("P1DT2H")).toBe(93600);
  });

  it("devuelve 0 con basura, no NaN", () => {
    for (const x of [null, undefined, "", "abc", 0, {}]) expect(segundosISO(x)).toBe(0);
  });
});

describe("esLargo", () => {
  it("los Shorts REALES del canal no son largos", () => {
    // Duraciones medidas in Oddly the 2026-10-03.
    expect(esLargo(segundosISO("PT18S"))).toBe(false);   // el otter, 18,7s
    expect(esLargo(segundosISO("PT50S"))).toBe(false);
    expect(esLargo(segundosISO("PT1M31S"))).toBe(false);
    expect(esLargo(segundosISO("PT1M30S"))).toBe(false); // 91s, el listicle largo
  });

  it("un video de 13:58 SI es largo", () => {
    expect(esLargo(segundosISO("PT13M58S"))).toBe(true);
  });

  it("el corte es el de YouTube: 3 minutos", () => {
    expect(SEGUNDOS_SHORT).toBe(180);
    expect(esLargo(180)).toBe(false);  // exactamente 3 min sigue siendo Short
    expect(esLargo(181)).toBe(true);
  });

  it("duracion desconocida NO cuenta como largo", () => {
    // Important: if the API not devuelve duration, preferimos NOT contarlo as largo.
    // Contarlo mantendria the bug (a video without duration reiniciaria the contador).
    for (const x of [0, null, undefined, NaN, "x"]) expect(esLargo(x)).toBe(false);
  });
});

describe("el bug que esto arregla", () => {
  it("un dia de Shorts NO deberia contar como 'hubo un video largo'", () => {
    // Lo that veia idle_check before: subidas of the day, all Shorts. If alguna account as
    // largo, IDLE is reinicia and the fabrica never arranca — that is lo that pasaba.
    const subidasDelDia = ["PT50S", "PT1M31S", "PT18S", "PT1M30S", "PT55S"];
    const hayLargo = subidasDelDia.some((d) => esLargo(segundosISO(d)));
    expect(hayLargo).toBe(false);
  });

  it("pero un largo de verdad si lo reinicia", () => {
    const subidas = ["PT50S", "PT13M58S", "PT18S"];
    expect(subidas.some((d) => esLargo(segundosISO(d)))).toBe(true);
  });
});
