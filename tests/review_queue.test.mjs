import { describe, it, expect } from "vitest";
import {
  STATUS,
  TRANSITIONS,
  newReviewId,
  createReview,
  approve,
  discard,
  markPlatform,
  canTransition,
} from "../pipeline/lib/review_queue.mjs";

const mk = () =>
  createReview({
    id: newReviewId(),
    title: "The Hidden Economics of AI",
    description: "A motion-graphics explainer.",
    tags: ["ai", "economics"],
    asset: { videoKey: "motiongfx/pending/rv-x/video.mp4", videoSize: 12345, durationSec: 75 },
  });

describe("newReviewId", () => {
  it("empieza con rv- y es ordenable/único", () => {
    const a = newReviewId();
    const b = newReviewId();
    expect(a.startsWith("rv-")).toBe(true);
    expect(b).not.toBe(a);
  });
  it("cabe en los 64 bytes de callback_data de Telegram (vf:review:discard:<id>)", () => {
    const id = newReviewId();
    expect(`vf:review:discard:${id}`.length).toBeLessThanOrEqual(64);
  });
});

describe("createReview", () => {
  it("crea en pending con asset e historial", () => {
    const r = mk();
    expect(r.status).toBe(STATUS.PENDING);
    expect(r.asset.videoKey).toContain("motiongfx/pending/");
    expect(r.history[0].status).toBe(STATUS.PENDING);
    expect(r.youtube).toBe(null);
  });
  it("rechaza faltas (id, title, asset.videoKey)", () => {
    expect(() => createReview({ id: "", title: "x", asset: { videoKey: "k" } })).toThrow();
    expect(() => createReview({ id: "abc", title: "", asset: { videoKey: "k" } })).toThrow();
    expect(() => createReview({ id: "abc", title: "x", asset: {} })).toThrow();
  });
  it("ids que no son rv- se crean pero la máquina los rechaza al transicionar", () => {
    const r = createReview({ id: "not-rv", title: "x", asset: { videoKey: "k" } });
    expect(() => approve(r)).toThrow(/review invalido/);
    expect(canTransition(r, "approved")).toBe(false);
  });
});

describe("transiciones", () => {
  it("pending -> approved (approve)", () => {
    const r = approve(mk());
    expect(r.status).toBe(STATUS.APPROVED);
    expect(r.decidedAt).toBeTruthy();
    expect(r.history.map((h) => h.status)).toEqual(["pending", "approved"]);
  });
  it("pending -> discarded (discard) guarda el motivo", () => {
    const r = discard(mk(), "duplicado");
    expect(r.status).toBe(STATUS.DISCARDED);
    expect(r.reason).toBe("duplicado");
  });
  it("rechaza transiciones ilegales (la tabla de verdad)", () => {
    expect(() => discard(approve(mk()))).toThrow(/no permitida/);
    expect(() => markPlatform(mk(), "youtube", { ok: true })).toThrow(/no se puede publicar/);
    expect(() => approve(discard(mk()))).toThrow(/no permitida/);
    expect(() => approve(approve(mk()))).toThrow(/no permitida/);
  });
  it("canTransition refleja la tabla de verdad", () => {
    expect(canTransition(mk(), "approved")).toBe(true);
    expect(canTransition(mk(), "discarded")).toBe(true);
    expect(canTransition(approve(mk()), "published")).toBe(true);
    expect(canTransition(approve(mk()), "discarded")).toBe(false);
    expect(canTransition(discard(mk()), "approved")).toBe(false);
  });
});

describe("markPlatform (publicación multi-plataforma)", () => {
  it("YouTube OK -> published con url", () => {
    const r = markPlatform(approve(mk()), "youtube", {
      ok: true,
      videoId: "dQw4w9WgXcQ",
      privacy: "public",
    });
    expect(r.status).toBe(STATUS.PUBLISHED);
    expect(r.youtube.url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(r.publishedAt).toBeTruthy();
  });
  it("YouTube falla + AtoPlay skip -> sigue approved (no published)", () => {
    let r = markPlatform(approve(mk()), "youtube", { ok: false, detail: "quota" });
    r = markPlatform(r, "atoplay", { ok: false, detail: "skipped" });
    expect(r.status).toBe(STATUS.APPROVED);
    expect(r.publishedAt).toBe(null);
  });
  it("AtoPlay OK solo (sin YouTube) -> published", () => {
    const r = markPlatform(approve(mk()), "atoplay", { ok: true, detail: "ok" });
    expect(r.status).toBe(STATUS.PUBLISHED);
  });
  it("idempotente: re-marcar la misma plataforma no duplica entradas", () => {
    let r = markPlatform(approve(mk()), "youtube", { ok: true, videoId: "abc", privacy: "public" });
    r = markPlatform(r, "youtube", { ok: true, videoId: "abc", privacy: "public" });
    expect(r.platforms.filter((p) => p.platform === "youtube")).toHaveLength(1);
  });
});

describe("TRANSITIONS (contrato)", () => {
  it("pending solo puede approved|discarded; discarded y published son terminales", () => {
    expect(TRANSITIONS.pending).toEqual(["approved", "discarded"]);
    expect(TRANSITIONS.discarded).toEqual([]);
    expect(TRANSITIONS.published).toEqual([]);
    expect(TRANSITIONS.approved).toEqual(["published"]);
  });
});
