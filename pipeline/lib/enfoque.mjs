// enfoque.mjs — in that channel sends the Brain.
//
// Decision of Juan (2026-10-04): the Brain decide ONLY about Oddly Loop. The Data Lens
// queda fuera de sus veredictos, acciones y presion de meta — pero sus METRICAS se siguen
// recogiendo and mostrando, because wants poder verlas.
//
// Not is a regla new nor a interruptor aparte: the ledger of the Brain ALREADY registraba the
// pausa of Data Lens (`type: "channel_pause"`, the writes brain_live.mjs) with its criterio and
// its fecha of revision. `brain_live` the respetaba; `channel_brain` not is habia enterado and
// seguia emitiendo "🔴 REESTRUCTURAR" and pidiendo acciones of a channel pausado.
//
// Asi that esto not decide nothing: lee the decision that already estaba tomada and the hace valer.

/** Busca la pausa activa de un canal en el ledger. Devuelve la entrada o null. */
export function pausaDe(ledger, canal) {
  if (!Array.isArray(ledger)) return null;
  return ledger.find((e) => e && e.type === "channel_pause" && e.channel === canal) || null;
}

/**
 * ¿The Brain must emitir veredictos and acciones for este channel?
 * Pausado -> NO decide (pero sus metricas se siguen mostrando).
 */
export function decideSobre(ledger, canal) {
  return !pausaDe(ledger, canal);
}

/** Linea para el mensaje: dice que esta en pausa, desde cuando y con que criterio. */
export function lineaPausa(pausa) {
  if (!pausa) return null;
  const desde = pausa.at ? String(pausa.at).slice(0, 10) : "?";
  const rev = pausa.review_at ? String(pausa.review_at).slice(0, 10) : null;
  const crit = pausa.criterion && pausa.criterion.value != null
    ? `se reanuda si ${pausa.metric || "la metrica"} ${pausa.criterion.op || ">="} ${pausa.criterion.value}`
    : null;
  return `⏸️ en PAUSA desde ${desde}${rev ? ` · se revisa el ${rev}` : ""}${crit ? ` · ${crit}` : ""}. El Cerebro no decide sobre este canal; las métricas se siguen midiendo.`;
}
