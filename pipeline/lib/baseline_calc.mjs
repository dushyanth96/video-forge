// baseline_calc.mjs — cálculo PURO of the baseline of a channel to partir of its weeks
// (formato of weekly_stats.JSON). Determinista and testeable. Base of the juicio RELATIVO of the brain.
import { median, pctVsBaseline } from "./analytics_math.mjs";

// Baseline of a channel. Uses ONLY weeks completas (days >= 7) and with señal (views > 0),
// for not contaminar the mediana with weeks parciales or of arranque in cero.
export function computeBaseline(weeks) {
  const full = (weeks || []).filter((w) => w && (w.days == null || w.days >= 7) && (w.views || 0) > 0);
  const views = full.map((w) => w.views || 0);
  const medViews = median(views);
  const best = full.reduce((b, w) => ((w.views || 0) > ((b && b.views) || -1) ? w : b), null);
  const recent = full.length ? full[full.length - 1] : null;
  return {
    weeks_used: full.length,
    median_weekly_views: medViews,
    median_weekly_likes: median(full.map((w) => w.likes || 0)),
    median_weekly_subs_net: median(full.map((w) => (w.subs_net != null ? w.subs_net : 0))),
    best_week: best ? { week: best.week, views: best.views || 0 } : null,
    recent_week: recent
      ? { week: recent.week, views: recent.views || 0, vs_median_pct: pctVsBaseline(recent.views || 0, medViews) }
      : null,
  };
}
