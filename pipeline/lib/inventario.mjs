// inventario.mjs — normaliza the inventario of videos, that llega in TRES formas distintas:
//   - cache of the bot (channel/inventory_cache.JSON): { longs, Shorts }
//   - estado de Data Lens (channel/state.json):     { published, shorts }  <- stats ANIDADOS
//   - estado de Oddly   (channel/auto2/state.json): { list }
//
// The tercera way hacia falta because the cache of the bot NOT is a fuente fiable: lo writes
// the Worker of Telegram only when alguien ABRE the app, and SIETE workflows lo borran to
// proposito for forzar the refresco. `episodes.mjs` encontraba the file ausente, sacaba
// "0 episodios", and the workflow restauraba the copia vieja of R2: everything the analisis of Data
// Lens llevaba 11 days congelado, and the alerta "Pipeline parado" medi­to the edad of the DATO.

/** Aplana los stats anidados de channel/state.json sin pisar valores ya planos. */
export function aplanar(v) {
  if (!v) return v;
  const st = v.stats || {};
  return {
    ...v,
    views: v.views != null ? v.views : (st.views || 0),
    likes: v.likes != null ? v.likes : (st.likes || 0),
    comments: v.comments != null ? v.comments : (st.comments || 0),
  };
}

/** Lista de videos lista para buildEpisode, venga el inventario en la forma que venga. */
export function normalizarInventario(data) {
  const d = data && typeof data === "object" ? data : {};
  let videos = [];
  if (Array.isArray(d.published)) videos = [...(d.published || []), ...(d.shorts || [])];
  else if (Array.isArray(d.longs) || Array.isArray(d.shorts)) videos = [...(d.longs || []), ...(d.shorts || [])];
  else if (Array.isArray(d.list)) videos = d.list;
  const vistos = new Set();
  return videos
    .map(aplanar)
    .filter((v) => v && v.video_id)
    // A video can estar in `published` and in `Shorts` to the vez.
    .filter((v) => (vistos.has(v.video_id) ? false : (vistos.add(v.video_id), true)));
}
