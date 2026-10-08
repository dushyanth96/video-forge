// muestra.mjs — ¿hay datos suficientes for concluir something, or estamos adivinando?
//
// By that existe: the Brain daba veredictos without mirar of cuantos datos salian. With 46
// vistas of mediana, YouTube nor siquiera devuelve curva of retencion for the mayoria of
// the videos (the 2026-10-03: 6 of 15), and still asi the sistema concluia. A veredicto sacado
// of 2 videos is lee igual that uno sacado of 200, and eso hace tomar decisiones of produccion
// about ruido.
//
// The regla here not is estadistica of true (with estas muestras not the hay): is honestidad
// about cuanto is sabe. Preferimos "not is can concluir" to a veredicto bonito and vacio.

import { sampleConfidence } from "./analytics_math.mjs";

/** Minimo para arriesgar una lectura, y a partir de cuanto se considera solida. */
export const MINIMO = 5;
export const SOLIDA = 20;

/**
 * Evalua the tamano of a muestra.
 * @param {number} n cuantas observaciones hay
 * @param {{minimo?:number, solida?:number, that?:string}} opts
 * @returns {{n:number, suficiente:boolean, nivel:string, confianza:number, aviso:string|null}}
 */
export function evaluarMuestra(n, opts = {}) {
  const num = Math.max(0, Math.floor(Number(n) || 0));
  const minimo = opts.minimo != null ? opts.minimo : MINIMO;
  const solida = opts.solida != null ? opts.solida : SOLIDA;
  const que = opts.que || "datos";
  const confianza = sampleConfidence(num);

  let nivel, aviso;
  if (num === 0) {
    nivel = "nula";
    aviso = `sin ${que}: no se puede concluir nada todavia`;
  } else if (num < minimo) {
    nivel = "pobre";
    aviso = `solo ${num} ${que} (hacen falta ${minimo}): cualquier lectura es ruido`;
  } else if (num < solida) {
    nivel = "suficiente";
    aviso = null;
  } else {
    nivel = "solida";
    aviso = null;
  }

  return { n: num, suficiente: num >= minimo, nivel, confianza, aviso };
}

/**
 * Cobertura of a dato that not always existe (p. e.g.. the curva of retencion, that YouTube
 * only devuelve if hubo vistas suficientes). Avisa when falta in demasiados.
 * @returns {{conDato:number, total:number, pct:number, suficiente:boolean, aviso:string|null}}
 */
export function cobertura(conDato, total, opts = {}) {
  const c = Math.max(0, Math.floor(Number(conDato) || 0));
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const minPct = opts.minPct != null ? opts.minPct : 0.6;
  const que = opts.que || "dato";
  const pct = t ? c / t : 0;
  if (!t) {
    return { conDato: c, total: 0, pct: 0, suficiente: false, aviso: `sin ${que}: no hay de donde leer` };
  }
  if (pct < minPct) {
    return {
      conDato: c, total: t, pct: +pct.toFixed(2), suficiente: false,
      aviso: `${que} solo en ${c} de ${t} (${Math.round(pct * 100)}%): muy pocas vistas para que YouTube lo devuelva, asi que lo que se lea de ahi NO representa al canal`,
    };
  }
  return { conDato: c, total: t, pct: +pct.toFixed(2), suficiente: true, aviso: null };
}

/** Linea corta para el mensaje de Telegram. `null` si no hay nada que avisar. */
export function lineaAviso(avisos) {
  const xs = (avisos || []).filter(Boolean);
  if (!xs.length) return null;
  return `⚠️ Muestra: ${xs.join(" · ")}. Los veredictos de arriba valen poco hasta que haya mas datos.`;
}
