// titles.mjs — avoids the dos defectos that mataron to The Data Lens.
//
// Medido in the channel the 2026-10-03 (45 Shorts listados, 3 suscriptores, 121 videos):
//
// 1) IS REPETIAN THE TITLES. Seis titles distintos ocupaban 22 of the 45 videos:
//    "The Deadliest Siege in Human History" x7, "The Deadliest Volcano Eruption in
//    History" x6, "The Deadliest Gamble in Human History" x3... The pipeline IF evitaba
//    repetir TOPICS (history_used.JSON), but never miro the TITLES: dos topics distintos
//    (Leningrado, Constantinopla) colapsan in the same title generico. YouTube lee eso
//    as contenido repetitivo, and many of esos videos quedaron in CERO vistas.
//
// 2) THE TITLE GENERICO RINDE 6 VECES LESS. Partiendo the 45 in dos grupos:
//      generico ("The Deadliest/Worst X in History"): n=33, mediana 2, media 7, 10 ceros
//      especifico (a historia concreta):            n=12, mediana 12, media 82
//    The cinco best are all concretos: "The Single Signature That Destroyed German
//    Democracy" (406), "The Single Key That Doomed The Titanic" (321), "The Lab Accident
//    That Saved Millions of Lives" (105).
//
// The same way that the unico Short that desperto in Oddly ("Why Baby Otters Hold Hands").
// Dos channels distintos apuntando to lo same: concreto and especifico le gana to superlativo
// generico.

/** Quita adornos para comparar titulos: hashtags, puntuacion, mayusculas, espacios. */
export function normalizar(titulo) {
  return String(titulo ?? "")
    .toLowerCase()
    .replace(/#\w+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Este titulo ya se uso? Compara normalizado, asi que "#Shorts" o un punto no engañan. */
export function esDuplicado(titulo, usados) {
  const t = normalizar(titulo);
  if (!t) return false;
  return (usados || []).some((u) => normalizar(u) === t);
}

// Superlativos that producen titles intercambiables. Not is that the palabra sea mala: is that
// "The <superlativo> <cosa> in (Human) History" describe mil videos distintos by igual, and
// by eso the modelo cae there a and other vez.
const SUPERLATIVOS = ["deadliest", "worst", "biggest", "greatest", "largest", "most dangerous", "craziest", "wildest", "scariest"];

/**
 * Detecta the way "The <superlativo> ... in (Human|Recorded) History", that is the plantilla
 * in the that the modelo is queda atrapado.
 */
export function esGenerico(titulo) {
  const t = normalizar(titulo);
  if (!t) return false;
  const tieneSuper = SUPERLATIVOS.some((s) => t.includes(s));
  if (!tieneSuper) return false;
  // "in history" / "in human history" / "in recorded history" to the final: the plantilla completa.
  return /\bin (human |recorded |world )?history\b/.test(t);
}

/**
 * Revisa a title recien generated contra the dos reglas.
 * @returns {{ok:boolean, motivo:string|null, queja:string|null}} `queja` is the texto that is
 *          le devuelve to the modelo for that lo reintente sabiendo THAT hizo mal.
 */
export function revisar(titulo, usados, opts = {}) {
  // `prohibirGenerico` is apaga in Oddly to proposito. There the plantilla listicle NOT rinde
  // worse (mediana 53 contra 36 of the resto, medido the 2026-10-03) and ademas is the BRAZO OF
  // CONTROL of the experiment of formato: prohibirla dejaria the to/B without with that comparar.
  const prohibirGenerico = opts.prohibirGenerico !== false;
  const t = String(titulo ?? "").trim();
  if (!t) return { ok: false, motivo: "vacio", queja: "El titulo vino vacio. Escribe uno." };
  if (esDuplicado(t, usados)) {
    return {
      ok: false, motivo: "duplicado",
      queja: `El titulo "${t}" YA SE USO en este canal. Escribe uno distinto, sobre el angulo concreto de ESTE video.`,
    };
  }
  if (prohibirGenerico && esGenerico(t)) {
    return {
      ok: false, motivo: "generico",
      queja: `El titulo "${t}" usa la plantilla "The <superlativo> ... in History", que en este canal rinde 6 veces menos (mediana 2 vistas contra 12) y se repite sola. Escribe un titulo sobre el detalle CONCRETO de esta historia: el objeto, la persona o la decision exacta.`,
    };
  }
  return { ok: true, motivo: null, queja: null };
}
