// episodes.mjs — Episodic Memory (Phase 2). Construye a episodio by video since the inventario of the
// channel (the that already vive in R2) + baseline by-video (mediana of vpd), and writes episodes.JSON.
// The workflow lo uploads to channel/episodes.JSON (Data Lens) or channel/auto2/episodes.JSON (Oddly).
// Uso: node pipeline/episodes.mjs <inventarioR2.json> <salida.json> [niche_map.json]
import fs from "node:fs";
import { medianVpd, buildEpisode } from "./lib/episode_calc.mjs";
import { anotarVideos } from "./lib/niche_map.mjs";
import { normalizarInventario } from "./lib/inventario.mjs";

const src = process.argv[2];
const out = process.argv[3] || "episodes.json";
let data = {};
try { data = JSON.parse(fs.readFileSync(src, "utf8")); }
catch (e) { console.error("episodes: no pude leer", src, "-", e.message); process.exit(0); }

// Mapa video -> categoria/variante (only Oddly lo tiene). Without the, the episodios salen
// igual that before but without variante: the to/B of formato simplemente not mide, not fails.
const mapaF = process.argv[4];
let mapa = {};
if (mapaF) { try { mapa = JSON.parse(fs.readFileSync(mapaF, "utf8")); } catch { mapa = {}; } }
const videos = anotarVideos(normalizarInventario(data), mapa);

const now = Date.now();
const medVpd = medianVpd(videos, now);
const episodes = videos.map((v) => buildEpisode(v, medVpd, now));
fs.writeFileSync(out, JSON.stringify({ at: new Date(now).toISOString(), median_vpd: medVpd, count: episodes.length, episodes }, null, 2));
console.log(`episodes: ${episodes.length} episodios, mediana vpd ${medVpd} -> ${out}`);
