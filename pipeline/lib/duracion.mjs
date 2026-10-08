// duration.mjs — leer the duration ISO8601 of YouTube and distinguir Short of largo.
//
// By that existe: `idle_check.mjs` decidia if tocaba producir a video largo mirando
// "hours since the LAST video uploaded to the channel", without filtrar by type. Since that The Data
// Lens publishes Shorts to diario, always habia a video of hace pocas hours, asi that the
// stores of 18h never is abria and `produce_video.yml` dejo of correr the 2026-08-21.
// The stores preguntaba "is subio something?" when queria preguntar "hace rato that not hay a
// LARGO?". The Shorts the satisfacian always.

/** Segundos de una duracion ISO8601 de la API de YouTube ("PT1M30S", "P1DT2H"). */
export function segundosISO(d) {
  const m = String(d || "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

// YouTube admite Shorts of until 3 minutes. Is uses ese cut, not uno propio, for that
// "largo" signifique here lo same that for the plataforma.
export const SEGUNDOS_SHORT = 180;

/** ¿Es un video largo (no un Short)? Duracion 0/desconocida -> NO cuenta como largo. */
export function esLargo(segundos) {
  const s = Number(segundos) || 0;
  return s > SEGUNDOS_SHORT;
}
