// review_queue.mjs — maquina de estados de Review-Before-Upload (pura, sin I/O).
//
// Estados: pending -> approved | discarded ; approved -> published.
// El estado vive en R2 como JSON (motiongfx/reviews/<id>.json); este modulo
// solo valida transiciones y devuelve el nuevo estado. Asi el Worker, los
// workflows y los tests comparten LA MISMA logica sin credenciales.
//
// Uso:
//   import { createReview, approve, discard, markPublished, transitions } from "./review_queue.mjs";

export const STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  DISCARDED: "discarded",
  PUBLISHED: "published",
});

// Transiciones permitidas (la tabla de verdad del flujo).
export const TRANSITIONS = Object.freeze({
  pending: ["approved", "discarded"],
  approved: ["published"],
  discarded: [],
  published: [],
});

const ID_PREFIX = "rv-";

// ID corto y ordenable: rv-<timestamp base36>-<4 hex>. Cabe holgado en los
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

// Crea el item de revision a partir del guion + el video ya renderizado.
// `asset` = { videoKey, videoSize, durationSec } — referencia al MP4 en R2.
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

// Approve: solo desde pending. El workflow de publicacion corre DESPUES.
export function approve(review) {
  return apply(review, STATUS.APPROVED, { decidedAt: new Date().toISOString() });
}

// Discard: cancela la subida SIN tocar YouTube (cero cuota gastada) y
// marca los assets temporales para limpieza.
export function discard(review, reason = "") {
  const next = apply(review, STATUS.DISCARDED, { decidedAt: new Date().toISOString() });
  if (reason) next.reason = String(reason);
  return next;
}

// Marca una plataforma publicada. Se acumula en platforms[]; cuando al menos
// YouTube OK, el estado pasa a published.
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
  // Publicado = aprobado + al menos una plataforma OK.
  const anyOk = platforms.some((p) => p.ok);
  next.status = anyOk ? STATUS.PUBLISHED : STATUS.APPROVED;
  if (anyOk && !next.publishedAt) next.publishedAt = entry.at;
  next.updatedAt = entry.at;
  next.history = [...(next.history || []), { status: next.status, at: entry.at, platform }];
  return next;
}

// ¿Puede este review dispararse de nuevo? (idempotencia: un approve duplicado
// NO debe re-subir el video ni gastar cuota extra).
export function canTransition(review, nextStatus) {
  return validReview(review) && TRANSITIONS[review.status].includes(nextStatus);
}
