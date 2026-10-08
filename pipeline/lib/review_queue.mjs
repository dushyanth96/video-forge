// review_queue.mjs — maquina de estados de Review-Before-Upload (pura, sin I/O).
//
// Estados: pending -> approved | discarded ; approved -> published.
// The estado vive in R2 as JSON (motiongfx/reviews/<id>.JSON); este modulo
// only validates transiciones and devuelve the new estado. Asi the Worker, the
// workflows and the tests comparten THE SAME logica without credenciales.
//
// Uso:
//   import { createReview, approve, discard, markPublished, transitions } from "./review_queue.mjs";

export const STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  DISCARDED: "discarded",
  PUBLISHED: "published",
});

// Transiciones permitidas (the tabla of true of the flujo).
export const TRANSITIONS = Object.freeze({
  pending: ["approved", "discarded"],
  approved: ["published"],
  discarded: [],
  published: [],
});

const ID_PREFIX = "rv-";

// ID corto and ordenable: rv-<timestamp base36>-<4 hex>. Cabe holgado in the
// 64 bytes de callback_data de Telegram ("vf:review:approve:" = 18 chars).
export function newReviewId(now = new Date()) {
  const t = now.getTime().toString(36);
  const r = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${ID_PREFIX}${t}${r}`;
}

function validReview(review) {
  return (
    review &&
    typeof review === "object" &&
    typeof review.id === "string" &&
    review.id.startsWith(ID_PREFIX) &&
    TRANSITIONS[review.status] !== undefined
  );
}

// Creates the item of revision to partir of the script + the video already renderizado.
// `asset` = { videoKey, videoSize, durationSec } — referencia to the MP4 in R2.
export function createReview({ id, title, description = "", tags = [], asset, createdAt = new Date().toISOString() }) {
  if (!id || !title || !asset || !asset.videoKey) {
    throw new Error("createReview requiere id, title y asset.videoKey");
  }
  return {
    id,
    status: STATUS.PENDING,
    title: String(title),
    description: String(description),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    asset: {
      videoKey: String(asset.videoKey),
      videoSize: asset.videoSize || null,
      durationSec: asset.durationSec || null,
    },
    createdAt,
    updatedAt: createdAt,
    decidedAt: null,
    publishedAt: null,
    youtube: null, // { videoId, url, privacy }
    platforms: [], // [{ platform, ok, detail, at }]
    history: [{ status: STATUS.PENDING, at: createdAt }],
  };
}

function apply(review, nextStatus, extra = {}) {
  if (!validReview(review)) throw new Error("review invalido");
  const allowed = TRANSITIONS[review.status];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`transicion no permitida: ${review.status} -> ${nextStatus}`);
  }
  const now = new Date().toISOString();
  const next = {
    ...review,
    status: nextStatus,
    updatedAt: now,
    history: [...(review.history || []), { status: nextStatus, at: now }],
    ...extra,
  };
  return next;
}

// Approve: only since pending. The workflow of publishing corre AFTER.
export function approve(review) {
  return apply(review, STATUS.APPROVED, { decidedAt: new Date().toISOString() });
}

// Discard: cancela the upload WITHOUT tocar YouTube (cero cuota gastada) and
// marca the assets temporales for limpieza.
export function discard(review, reason = "") {
  const next = apply(review, STATUS.DISCARDED, { decidedAt: new Date().toISOString() });
  if (reason) next.reason = String(reason);
  return next;
}

// Marca a plataforma publicada. Is acumula in platforms[]; when to the less
// YouTube OK, the estado pasa to published.
export function markPlatform(review, platform, result) {
  if (!validReview(review)) throw new Error("review invalido");
  if (review.status !== STATUS.APPROVED && review.status !== STATUS.PUBLISHED) {
    throw new Error(`no se puede publicar desde ${review.status}`);
  }
  const entry = {
    platform: String(platform),
    ok: !!result.ok,
    detail: result.detail || "",
    at: new Date().toISOString(),
  };
  const platforms = [...(review.platforms || []).filter((p) => p.platform !== platform), entry];
  const next = { ...review, platforms };
  if (platform === "youtube" && result.ok && result.videoId) {
    next.youtube = { videoId: result.videoId, url: `https://youtu.be/${result.videoId}`, privacy: result.privacy || "public" };
  }
  // Published = aprobado + to the less a plataforma OK.
  const anyOk = platforms.some((p) => p.ok);
  next.status = anyOk ? STATUS.PUBLISHED : STATUS.APPROVED;
  if (anyOk && !next.publishedAt) next.publishedAt = entry.at;
  next.updatedAt = entry.at;
  next.history = [...(next.history || []), { status: next.status, at: entry.at, platform }];
  return next;
}

// ¿Can este review dispararse of new? (idempotencia: a approve duplicado
// NOT must re-upload the video nor gastar cuota extra).
export function canTransition(review, nextStatus) {
  return validReview(review) && TRANSITIONS[review.status].includes(nextStatus);
}
