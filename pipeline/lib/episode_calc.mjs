// episode_calc.mjs — cálculo PURO of the memoria episódica (Phase 2). Determinista and testeable.
// A "episodio" = the hechos of a video + its performance RELATIVO to the baseline by-video of the channel.
import { median, pctVsBaseline } from "./analytics_math.mjs";

const DAY = 86400000;

// Vistas by day (vpd) of a video. Fecha inválida -> 0. Not divide by less of 1 day.
export function vpd(views, publishedAt, nowMs = Date.now()) {
  const pub = Date.parse(publishedAt);
  if (!Number.isFinite(pub)) return 0;
  const days = Math.max(1, (nowMs - pub) / DAY);
  return (Number(views) || 0) / days;
}

// Mediana of vpd of the videos MADUROS (edad >= matureDays): the baseline by-video of the channel.
// The recién publicados not is cuentan (still not miden; Analytics va 2-3 days atrás).
export function medianVpd(videos, nowMs = Date.now(), matureDays = 5) {
  const vals = (videos || [])
    .filter((v) => v && v.published_at && (nowMs - Date.parse(v.published_at)) / DAY >= matureDays)
    .map((v) => vpd(v.views, v.published_at, nowMs));
  return median(vals);
}

// Episodio of a video: hechos + performance relativo. The campos cognitivos quedan in null;
// the llenarán the neuronas of phases posteriores (Hook/Title/Experiment).
export function buildEpisode(v, medVpd, nowMs = Date.now()) {
  const seconds = Number(v.seconds) || 0;
  const _vpd = vpd(v.views, v.published_at, nowMs);
  return {
    video_id: v.video_id,
    title: v.title || "",
    format: seconds > 0 && seconds <= 90 ? "short" : "long",
    published_at: v.published_at || null,
    age_days: v.published_at ? Math.round((nowMs - Date.parse(v.published_at)) / DAY) : null,
    seconds,
    privacy: v.privacy || null,
    views: Number(v.views) || 0,
    likes: Number(v.likes) || 0,
    watch_min: Number(v.watch_min) || 0,
    vpd: Math.round(_vpd * 10) / 10,
    vs_baseline_pct: medVpd ? pctVsBaseline(_vpd, medVpd) : null,
    // Formato with the that is produjo (of the niche_map). Is lo that agrupa the to/B of formato.
    // null in the videos viejos: is produjeron before of registrarlo, and not is inventa.
    niche: v.niche || null,
    variant: v.variant || null,
    // Campos cognitivos (the llenan neuronas futuras — Phase 4/5):
    hook_type: null,
    title_type: null,
    topic: v.topic || null,
    hypothesis: null,
    result: null,
  };
}
