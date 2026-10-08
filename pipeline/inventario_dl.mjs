// inventario_dl.mjs — resuelve THE inventario of The Data Lens, of a vez and for all.
//
// By that existe: `channel/inventory_cache.JSON` NOT is a fuente of datos. Lo writes the
// Worker of the bot of Telegram (bot/src/index.js) and only when alguien ABRE the app, and SIETE
// workflows lo borran to proposito for invalidar the cache of the bot. Still asi, cuatro workflows
// lo leian as if fuera the true of the channel. Result medido the 2026-10-04: `episodes.yml`
// sacaba "0 episodios" and everything the analisis of Data Lens llevaba 11 days congelado about a
// copia vieja, mientras the alerta decia "Pipeline parado" midiendo the edad of the DATO.
//
// The true of the channel is `channel/state.JSON`, that mantiene `channel_report.yml`. The cache
// only is uses if trae datos (is more fresco when existe); if not, is cae to the estado.
//
// Uso: node pipeline/inventario_dl.mjs <cache.json> <state.json> <salida.json>
// Output: { fuente, list, longs, Shorts } — cada consumidor toma the way that needs.
import fs from "node:fs";
import { normalizarInventario } from "./lib/inventario.mjs";
import { segundosISO, esLargo } from "./lib/duracion.mjs";

const [cacheF, stateF, outF = "inventario_dl.json"] = process.argv.slice(2);
const leer = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return {}; } };

const deCache = normalizarInventario(leer(cacheF));
const deState = normalizarInventario(leer(stateF));
// The cache gana only if trae something; if viene vacio or deleted, sends the estado.
const [list, fuente] = deCache.length ? [deCache, "cache del bot"] : [deState, "channel/state.json"];

// Is reparte by DURATION, not by the tag that trajera the origen: is the same cut that
// uses YouTube for Shorts and not depende of as lo clasificara quien escribio the file.
const longs = list.filter((v) => esLargo(v.seconds != null ? v.seconds : segundosISO(v.duration)));
const shorts = list.filter((v) => !longs.includes(v));

fs.writeFileSync(outF, JSON.stringify({ at: new Date().toISOString(), fuente, list, longs, shorts }, null, 2));
console.log(`inventario data-lens: ${list.length} videos (${longs.length} largos, ${shorts.length} shorts) · fuente: ${fuente} -> ${outF}`);
if (!list.length) console.warn("AVISO: inventario VACIO en las dos fuentes. Lo que lea de aqui no significa nada.");
