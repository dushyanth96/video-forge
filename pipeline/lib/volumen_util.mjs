// volumen_util.mjs — ¿upload the volumen sirve of something, or hay that cambiar the formato?
//
// By that existe: the Brain tenia a regla fija for Oddly — "if va atras, more
// volumen of the ganador" — that subia the cadencia of 8 to 12 Shorts/day. For Data Lens
// already habia aprendido lo contrario ("the volumen not arregla 0 vistas"), but Oddly
// seguia with the regla vieja.
//
// Medido the 2026-10-03 in the channel real: 518 videos publicados, 67 suscriptores, and
// the Shorts maduros dan a MEDIANA OF 46 VISTAS. to ese ritmo, 4/day durante 90 days
// are ~16.500 vistas contra a meta of 10.000.000: falta a factor of ~600x. Upload to
// 12/day lo deja in ~50.000, that sigue siendo 200x corto. or sea: producir more only
// multiplica videos that nadie ve, and gasta 50% more of computo for nothing.
//
// The regla correcta not is a opinion about the volumen, is aritmetica: the volumen
// sirve when the VISTAS BY VIDEO that already tienes, multiplicadas by the maximo of
// videos that puedes hacer, alcanzan the meta. If not alcanzan nor of lejos, the problema
// is the formato (that nadie lo distribuye), and more cantidad not lo toca.

/** Cuanto puede estirarse el rendimiento actual antes de que sea iluso esperarlo. */
const FACTOR_ILUSORIO = 5;

/**
 * @param {object} e
 * @param {number} and.vistasTotales  vistas acumuladas of the channel
 * @param {number} e.videos         videos publicados
 * @param {number} e.metaVistas     meta de vistas
 * @param {number} and.diasRestantes  days until the fecha limite
 * @param {number} [and.cadenciaAlta] videos/day when is empuja
 * @param {number} [e.cadenciaNormal] videos/dia de crucero
 * @returns {{vistasPorVideo:number, vistasPorVideoNecesarias:number, factor:number,
 *            volumenSirve:boolean, cadencia:number, reestructurar:boolean, razon:string}}
 */
export function decidirVolumen({
  vistasTotales,
  videos,
  metaVistas,
  diasRestantes,
  cadenciaAlta = 12,
  cadenciaNormal = 8,
}) {
  const vids = Math.max(1, Number(videos) || 0);
  const dias = Math.max(1, Number(diasRestantes) || 1);
  const faltan = Math.max(0, (Number(metaVistas) || 0) - (Number(vistasTotales) || 0));

  // Already is cumplio: not hay nothing that empujar.
  if (faltan === 0) {
    return {
      vistasPorVideo: (Number(vistasTotales) || 0) / vids,
      vistasPorVideoNecesarias: 0,
      factor: 0,
      volumenSirve: true,
      cadencia: cadenciaNormal,
      reestructurar: false,
      razon: "meta cumplida — cadencia de crucero",
    };
  }

  const vistasPorVideo = (Number(vistasTotales) || 0) / vids;
  // Lo that tendria that rendir cada video new if produjeramos to the maximo cada day.
  const necesarias = faltan / (cadenciaAlta * dias);

  // Without historial not is can juzgar: is empuja, that is lo that allows medir.
  if (vistasPorVideo <= 0) {
    return {
      vistasPorVideo: 0,
      vistasPorVideoNecesarias: necesarias,
      factor: Infinity,
      volumenSirve: true,
      cadencia: cadenciaAlta,
      reestructurar: false,
      razon: "sin vistas medidas todavia — empujar para tener datos",
    };
  }

  const factor = necesarias / vistasPorVideo;

  // The volumen alcanza with lo that already rinde cada video.
  if (factor <= 1) {
    return {
      vistasPorVideo, vistasPorVideoNecesarias: necesarias, factor,
      volumenSirve: true, cadencia: cadenciaAlta, reestructurar: false,
      razon: `el volumen alcanza: cada video rinde ${Math.round(vistasPorVideo)} y harian falta ${Math.round(necesarias)}`,
    };
  }

  // Hace falta more of lo that rinde today, but esta to the alcance of a mejora normal.
  if (factor <= FACTOR_ILUSORIO) {
    return {
      vistasPorVideo, vistasPorVideoNecesarias: necesarias, factor,
      volumenSirve: true, cadencia: cadenciaAlta, reestructurar: false,
      razon: `hay que subir ${factor.toFixed(1)}x las vistas por video (${Math.round(vistasPorVideo)} -> ${Math.round(necesarias)}): alcanzable, empujar volumen`,
    };
  }

  // Here the volumen already not is the palanca: nor produciendo to the maximo is llega.
  return {
    vistasPorVideo, vistasPorVideoNecesarias: necesarias, factor,
    volumenSirve: false, cadencia: cadenciaNormal, reestructurar: true,
    razon: `mas volumen NO cierra la brecha: cada video rinde ${Math.round(vistasPorVideo)} vistas y harian falta ${Math.round(necesarias)} (${Math.round(factor)}x) incluso a ${cadenciaAlta}/dia — el problema es el formato, no la cantidad`,
  };
}
