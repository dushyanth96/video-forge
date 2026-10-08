// niche_map.mjs — lee the mapa video_id -> categoria of the channel auto (Oddly), that now
// tambien stores the VARIANTE of formato with the that is produjo cada video.
//
// By that existe: the mapa era `{ "abc123": "animales_tiernos" }`, a string suelto. With eso
// is can rankear by categoria, but NOT is can medir a pregunta of formato: "a hecho
// concreto rinde more that a ready of 14?". The to/B by cohortes (lib/ab_test.mjs) agrupa by
// the valor of a campo of the video, asi that the variante tiene that viajar with cada video.
//
// Compatibilidad: the ~518 videos already publicados are guardados as string. Esos siguen
// leyendose igual and quedan with variant=null (not entran in the to/B, that is lo correct: not
// sabemos with that formato is hicieron). The new is guardan as { n, v }.

/** Normaliza una entrada del mapa, venga en formato viejo (string) o nuevo ({n, v}). */
export function leerEntrada(entrada) {
  if (typeof entrada === "string") return { niche: entrada || null, variant: null };
  if (entrada && typeof entrada === "object") {
    return {
      niche: entrada.n || entrada.niche || null,
      variant: entrada.v || entrada.variant || null,
    };
  }
  return { niche: null, variant: null };
}

/** Entrada nueva para guardar en el mapa. */
export function nuevaEntrada(niche, variant) {
  return { n: niche || null, v: variant || null };
}

/**
 * Pega `niche` and `variant` to cada video of the inventario, leyendo the mapa.
 * Not pisa lo that the video already traiga: the mapa is the fuente, but if the inventario
 * already resolvio the dato, is respeta.
 */
export function anotarVideos(videos, mapa) {
  const m = mapa && typeof mapa === "object" ? mapa : {};
  return (videos || []).map((v) => {
    if (!v || !v.video_id) return v;
    const { niche, variant } = leerEntrada(m[v.video_id]);
    return { ...v, niche: v.niche || niche, variant: v.variant || variant };
  });
}

/** Cuantos videos del mapa tienen variante registrada (para saber si el A/B ya puede medir). */
export function conVariante(mapa) {
  const m = mapa && typeof mapa === "object" ? mapa : {};
  return Object.values(m).filter((e) => leerEntrada(e).variant).length;
}
