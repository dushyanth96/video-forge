import { describe, it, expect } from "vitest";
import { normalizarInventario, aplanar } from "../pipeline/lib/inventario.mjs";

// Before este test lanzaba `episodes.mjs` as proceso for probar the normalizacion. Fallaba
// 1 of cada ~9 corridas bajo the suite completa (7 procesos to the vez in Windows), and a test
// that fails to the azar is worse that uno that fails always: rompe the CI without decir nothing util.
// The logica is extrajo to lib/inventario.mjs and here is test directa. Without procesos, without flake.

describe("normalizarInventario: las tres formas de inventario", () => {
  it("cache del bot: { longs, shorts }", () => {
    const v = normalizarInventario({ longs: [{ video_id: "a", views: 100 }], shorts: [] });
    expect(v).toHaveLength(1);
    expect(v[0].views).toBe(100);
  });

  it("Oddly: { list }", () => {
    expect(normalizarInventario({ list: [{ video_id: "b", views: 50 }] })).toHaveLength(1);
  });

  it("Data Lens: { published } con los stats ANIDADOS — la forma que no entendia", () => {
    // Way real of channel/state.JSON. Era the that devolvia 0 episodios.
    const v = normalizarInventario({
      published: [
        { video_id: "c", title: "C", stats: { views: 406, likes: 9, comments: 1 } },
        { video_id: "d", title: "D", stats: { views: 321, likes: 4 } },
      ],
    });
    expect(v).toHaveLength(2);
    // Lo important: the vistas salen of stats.views in vez of quedarse in 0.
    expect(v.map((x) => x.views)).toEqual([406, 321]);
    expect(v[0].likes).toBe(9);
    expect(v[0].comments).toBe(1);
  });

  it("junta published y shorts, pero sin contar dos veces el mismo video", () => {
    const uno = { video_id: "e", stats: { views: 10 } };
    expect(normalizarInventario({ published: [uno], shorts: [uno] })).toHaveLength(1);
    expect(normalizarInventario({
      published: [uno], shorts: [{ video_id: "f", stats: { views: 2 } }],
    })).toHaveLength(2);
  });

  it("descarta entradas sin video_id", () => {
    const v = normalizarInventario({ published: [{ title: "sin id" }, { video_id: "g" }] });
    expect(v).toHaveLength(1);
    expect(v[0].video_id).toBe("g");
  });

  it("un inventario vacio da lista vacia y no revienta", () => {
    for (const x of [{}, { published: [] }, { list: [] }, null, undefined, "roto", 5]) {
      expect(normalizarInventario(x)).toEqual([]);
    }
  });

  it("prioriza published sobre las otras formas si vinieran mezcladas", () => {
    const v = normalizarInventario({
      published: [{ video_id: "p", stats: { views: 1 } }],
      list: [{ video_id: "l", views: 99 }],
    });
    expect(v.map((x) => x.video_id)).toEqual(["p"]);
  });
});

describe("aplanar", () => {
  it("no pisa los valores que ya vienen planos", () => {
    expect(aplanar({ video_id: "x", views: 7, stats: { views: 999 } }).views).toBe(7);
  });

  it("pone 0 cuando no hay ni plano ni anidado", () => {
    const a = aplanar({ video_id: "x" });
    expect(a.views).toBe(0);
    expect(a.likes).toBe(0);
  });

  it("respeta el 0 explicito (no lo confunde con ausente)", () => {
    expect(aplanar({ video_id: "x", views: 0, stats: { views: 50 } }).views).toBe(0);
  });

  it("aguanta entradas vacias", () => {
    expect(aplanar(null)).toBe(null);
  });
});
