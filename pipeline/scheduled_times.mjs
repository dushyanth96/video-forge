// scheduled_times.mjs — imprime (CSV) the publishAt FUTUROS already programados of the channel, for that
// best_slot NOT repita slot (así the videos quedan escalonados, not all to the same hour).
// Uses YT_* (in Oddly Loop, the workflow mapea YT2_* -> YT_*). Silencioso ante cualquier failure.
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const tf = (u, o = {}, ms = 12000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
if (!YT_REFRESH_TOKEN) { process.stdout.write(""); process.exit(0); }
try {
  const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
  const token = tr.access_token; if (!token) { process.stdout.write(""); process.exit(0); }
  const H = { Authorization: `Bearer ${token}` };
  const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: H })).json();
  const item = (ch.items || [])[0] || {};
  const up = item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;
  let ids = [], page = "";
  if (up) { do { const j = await (await tf(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json(); ids.push(...(j.items || []).map((i) => i.contentDetails.videoId)); page = j.nextPageToken || ""; } while (page && ids.length < 200); }
  const now = Date.now(), times = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
    for (const v of j.items || []) { const p = (v.status || {}).publishAt; if (p && Date.parse(p) > now) times.push(p); }
  }
  process.stdout.write(times.join(","));
} catch { process.stdout.write(""); }
