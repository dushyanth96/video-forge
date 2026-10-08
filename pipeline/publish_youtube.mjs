// publish_youtube.mjs — sube a YouTube (Data API v3) con OAuth2 (refresh token).
//
// ONLY corre with the approve of the owner. The discard NOT llama to este script:
// cero llamadas a YouTube = cero cuota gastada.
//
// Usage: node pipeline/publish_YouTube.mjs <video.mp4> <review.JSON> <out YouTube.JSON>
//
// Env (todas obligatorias, ninguna hardcodeada):
//   YT_CLIENT_ID       OAuth2 client id (Google Cloud Console)
//   YT_CLIENT_SECRET   OAuth2 client secret
//   YT_REFRESH_TOKEN   refresh token of the owner (flujo installed-app)
//   YT_PRIVACY         public | unlisted | private (default: public)
//   YT_CATEGORY_ID     default: 28 (Science & Technology)
import fs from "node:fs";

const [videoPath, reviewPath, outPath] = process.argv.slice(2);
if (!videoPath || !reviewPath || !outPath) {
  console.error("uso: publish_youtube.mjs <video.mp4> <review.json> <out youtube.json>");
  process.exit(1);
}
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  console.error("faltan YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN");
  process.exit(2);
}
if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size < 10000) {
  console.error("video faltante o vacio"); process.exit(1);
}
const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
const PRIVACY = process.env.YT_PRIVACY || "public";
const CATEGORY = process.env.YT_CATEGORY_ID || "28";

async function accessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error(`OAuth2 token exchange fallo (${r.status}): ${j.error_description || j.error || ""}`);
  }
  return j.access_token;
}

const CHUNK = 8 * 1024 * 1024;

async function resumableUpload(token) {
  const file = fs.readFileSync(videoPath);
  const meta = {
    snippet: {
      title: review.title,
      description: (review.description || "") + (review.tags?.length ? `\n\n${review.tags.map((t) => `#${t}`).join(" ")}` : ""),
      tags: review.tags || [],
      categoryId: CATEGORY,
    },
    status: { privacyStatus: PRIVACY, selfDeclaredMadeForKids: false },
  };
  // 1) Iniciar sesion resumible -> Location
  const init = await fetch(
    `https://youtube.upload.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(file.length),
      },
      body: JSON.stringify(meta),
    }
  );
  const location = init.headers.get("location");
  if (!init.ok || !location) {
    const t = await init.text().catch(() => "");
    throw new Error(`resumable init fallo (${init.status}): ${t.slice(0, 300)}`);
  }
  // 2) Upload by chunks with Content-Range (reanudable by if the red fails).
  let uploaded = 0;
  while (uploaded < file.length) {
    const end = Math.min(file.length, uploaded + CHUNK) - 1;
    const chunk = file.subarray(uploaded, end + 1);
    let r = await fetch(location, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-length": String(chunk.length),
        "content-range": `bytes ${uploaded}-${end}/${file.length}`,
      },
      body: chunk,
    });
    if (r.status === 308) {
      // 308: incompleto; the header Range dice cuantos bytes recibio.
      const range = r.headers.get("range") || "";
      const m = /bytes=0-(\d+)/.exec(range);
      uploaded = m ? +m[1] + 1 : uploaded + chunk.length;
      continue;
    }
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`upload chunk fallo (${r.status}): ${t.slice(0, 300)}`);
    }
    const j = await r.json().catch(() => ({}));
    if (!j.id) throw new Error("upload completo pero sin videoId en la respuesta");
    return j;
  }
  throw new Error("upload termino sin respuesta final");
}

try {
  const token = await accessToken();
  const video = await resumableUpload(token);
  const result = {
    ok: true,
    videoId: video.id,
    url: `https://youtu.be/${video.id}`,
    privacy: PRIVACY,
    title: review.title,
    at: new Date().toISOString(),
  };
  fs.mkdirSync(outPath.slice(0, Math.max(0, outPath.lastIndexOf("/") || -1)) || ".", { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`YOUTUBE PUBLICADO ✅ ${result.url} (privacy=${PRIVACY})`);
} catch (e) {
  console.error(`YOUTUBE FALLO ❌ ${e.message}`);
  fs.mkdirSync(outPath.slice(0, Math.max(0, outPath.lastIndexOf("/") || -1)) || ".", { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ ok: false, error: e.message, at: new Date().toISOString() }, null, 2));
  process.exit(1);
}
