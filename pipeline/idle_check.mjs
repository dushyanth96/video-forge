// idle_check.mjs — for the video diario of the channel principal (The Data Lens). Imprime "IDLE PEND":
//   IDLE = hours since the LAST video LARGO uploaded to the channel (cualquier privacidad).
//   PEND = cuantos videos LARGOS hay PRIVADOS without schedule (esperando that Juan the apruebe).
//
// The Shorts NOT cuentan in ninguno of the dos, and ese era the bug: is miraba cualquier video,
// asi that the Shorts diarios mantenian IDLE by debajo of 18h and the fabrica of largos never
// arrancaba (`produce_video.yml` dejo of correr the 2026-08-21).
// The cron produce only if IDLE > 18h and PEND < tope -> trabaja only when Juan not ha producido in
// 18h, acumula a par for approve, and NOT produce 'to lo loco'. Ante error, imprime "999 0" (deja producir).
import fs from "node:fs";
import { segundosISO, esLargo, SEGUNDOS_SHORT } from "./lib/duracion.mjs";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const tf = (u, o = {}, ms = 12000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
// Videos OCULTOS (retirados) NOT cuentan as "pendientes by approve" -> not bloquean the produccion.
let hidden = new Set();
try { hidden = new Set(JSON.parse(fs.readFileSync("hidden.json", "utf8"))); } catch {}
if (!YT_REFRESH_TOKEN) { process.stdout.write("999 0"); process.exit(0); }
try {
  const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
  const token = tr.access_token; if (!token) { process.stdout.write("999 0"); process.exit(0); }
  const H = { Authorization: `Bearer ${token}` };
  const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: H })).json();
  const item = (ch.items || [])[0] || {};
  const up = item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;
  let ids = [], page = "";
  if (up) { do { const j = await (await tf(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json(); ids.push(...(j.items || []).map((i) => i.contentDetails.videoId)); page = j.nextPageToken || ""; } while (page && ids.length < 200); }
  const now = Date.now(); let newest = 0, pending = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
    for (const v of j.items || []) {
      // Only the LARGOS deciden if toca producir: a Short of hace 2h not significa that the
      // fabrica de largos tenga trabajo hecho.
      if (!esLargo(segundosISO((v.contentDetails || {}).duration))) continue;
      const t = Date.parse(v.snippet.publishedAt) || 0; if (t > newest) newest = t;
      const st = v.status || {}; if (st.privacyStatus === "private" && !st.publishAt && !hidden.has(v.id)) pending++;
    }
  }
  const idleH = newest ? Math.round((now - newest) / 3600000) : 999;
  process.stdout.write(idleH + " " + pending);
} catch { process.stdout.write("999 0"); }
