/**
 * video-forge-bot — channel brain on Telegram (Cloudflare Worker).
 *
 * Flow: Telegram -> (webhook) this Worker -> triggers GitHub Actions.
 * The results (audio/MP4) are sent to the chat by each workflow via notify_telegram.sh.
 *
 * Security:
 *  - Verifies the secret Telegram header (X-Telegram-Bot-Api-Secret-Token).
 *  - Only answers OWNER_CHAT_ID (Juan). Any other chat is ignored.
 *  - The GitHub token lives as a Worker secret, never in the code.
 */

import { WorkerEntrypoint } from "cloudflare:workers";
import { APP_HTML } from "./miniapp.js";
import { APP2_HTML } from "./miniapp_v2.js";
import { osStateFrom, applyStaleness } from "../../pipeline/lib/os_contract.mjs";
import { approve as reviewApprove, discard as reviewDiscard } from "../../pipeline/lib/review_queue.mjs";
import { osUnifiedHtml, withOsBar } from "../../shared/os-unified.mjs";
import { osShellHtml } from "../../shared/os-shell.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Mini App (pro "app-like" interface inside Telegram).
    if (url.pathname === "/os") {
      // AI OS: common app (Pulse · Work · Decisions) for Video Forge. The detailed panel stays on /app2.
      return new Response(osUnifiedHtml({ build: env.APP_BUILD }), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache    "} });
    }
    // Old entries (/app2, /app) from buttons already sent, BotFather or a chat menu: they open the AI OS.
    // The detailed panel opens from the OS with ?from=os (and returns to the OS with the back button).
    if ((url.pathname === "/app2" || url.pathname === "/app") && url.searchParams.get("from") !== "os") {
      return new Response(osUnifiedHtml({ build: env.APP_BUILD }), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache    "} });
    }
    // AI OS in a single bot: full panels of the three systems, with a "‹ Brain / where you are" bar.
    const panelMatch = request.method === "GET" && url.pathname.match(/^\/p\/(video-forge|radar|viento)$/);
    if (panelMatch) {
      const id = panelMatch[1];
      const labels = { "video-forge": "Video Forge · Channel Panel", radar: "Radar · Repo Panel", viento: "Viento · Store Panel    "};
      let html;
      if (id === "video-forge") html = APP2_HTML.replace("__BUILD__", String(env.APP_BUILD || "dev"));
      else {
        const svc = id === "radar" ? env.RADAR : env.VIENTO;
        if (!svc) return new Response("Panel not connected", { status: 503 });
        const r = await svc.fetch(new Request("https://os.internal/app?from=os"));
        html = await r.text();
      }
      return new Response(withOsBar(html, labels[id]), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache    "} });
    }
    // API of the Radar and Viento panels: the single bot validates the session and forwards it over the internal channel.
    const apiMatch = url.pathname.match(/^\/v\/(radar|viento)(\/api\/[a-z0-9\/_-]+)$/);
    if (apiMatch) {
      const jsonH = { "content-type": "application/json", "cache-control": "no-store    "};
      const user = await validateInitData(request.headers.get("X-Init-Data") || "", env);
      if (!user) return new Response(JSON.stringify({ error: "unauthorized    "}), { status: 403, headers: jsonH });
      const svc = apiMatch[1] === "radar" ? env.RADAR : env.VIENTO;
      if (!svc) return new Response(JSON.stringify({ error: "panel not connected    "}), { status: 503, headers: jsonH });
      const init = { method: request.method, headers: { "content-type": request.headers.get("content-type") || "application/json    "} };
      if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
      const r = await svc.fetch(new Request("https://os.internal" + apiMatch[2] + url.search, init));
      return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "application/json", "cache-control": "no-store    "} });
    }
    if (url.pathname === "/app2") {
      // Mini App v2 (brain monitor), in parallel to /app until the cut-over.
      // Build per deploy (APP_BUILD): the app compares it with /api/state and reloads itself if it went stale in the webview.
      return new Response(APP2_HTML.replace("__BUILD__", String(env.APP_BUILD || "dev")), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache    "} });
    }
    if (url.pathname === "/app") {
      // no-store: the Telegram Mini App caches the WebView; without this it keeps serving a stale version.
      return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache    "} });
    }
    if (url.pathname.startsWith("/api/")) {
      const t0 = Date.now();
      try {
        const resp = await handleApi(request, env, url);
        console.log(`[api] ${url.pathname} ${Date.now() - t0}ms`);   // validate timings against the logs (wrangler tail)
        return resp;
      } catch (e) {
        // Log the FULL error server-side (for debugging), but NEVER leak details to the client.
        console.error(`[api] ${url.pathname} ERROR ${Date.now() - t0}ms: ${(e && e.stack) || e}`);
        return new Response(JSON.stringify({ error: "server    "}), { status: 500, headers: { "content-type": "application/json    "} });
      }
    }
    // Watch the video by link (streaming from R2). Telegram via bot does not allow sending
    // files >50MB; the channel video is ~250MB, so it is watched from here.
    if (request.method === "GET" && url.pathname.startsWith("/watch/")) {
      const key = decodeURIComponent(url.pathname.slice("/watch/".length));
      return handleWatch(request, env, key, url.searchParams.get("t"));
    }
    // Health check / root (GET): useful to test that the Worker is alive.
    if (request.method !== "POST") {
      // Health only at the root; any other unknown route is 404 (used to answer 200).
      return url.pathname === "/" ? new Response("video-forge-bot OK") : new Response("not found", { status: 404 });
    }

    // 1) Verify the POST comes from Telegram (secret header).
    const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!env.TELEGRAM_WEBHOOK_SECRET || !safeEqual(got, env.TELEGRAM_WEBHOOK_SECRET)) {
      // Diagnostics for `wrangler tail`: never logs the secret value.
      if (!env.TELEGRAM_WEBHOOK_SECRET) {
        console.error("webhook 403: the Worker has no TELEGRAM_WEBHOOK_SECRET (run `wrangler secret put TELEGRAM_WEBHOOK_SECRET`)");
      } else if (got == null) {
        console.error("webhook 403: Telegram did not send X-Telegram-Bot-Api-Secret-Token; re-register the webhook with setWebhook?secret_token=...");
      } else {
        console.error("webhook 403: X-Telegram-Bot-Api-Secret-Token does not match TELEGRAM_WEBHOOK_SECRET (header length=" + got.length + ", worker=" + String(env.TELEGRAM_WEBHOOK_SECRET).length + ")");
      }
      return new Response("forbidden", { status: 403 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }

    try {
      if (update.callback_query) {
        await handleCallback(update.callback_query, env);
      } else if (update.message) {
        await handleMessage(update.message, env);
      }
    } catch (err) {
      // We never crash the webhook (Telegram would retry); log and continue.
      console.error("handler error", err);
    }
    // Always 200 so Telegram does not retry.
    return new Response("ok");
  },
  // Reliable clock of the AI OS (Cloudflare Cron Trigger every 30 min). GitHub Actions delays and drops
  // frequent crons; here they are fired via workflow_dispatch. The GitHub crons remain as backup: the
  // Orchestrator cancels overlapping runs and the brain does not duplicate production thanks to its claims.
  async scheduled(event, env, ctx) {
    const t = new Date(event.scheduledTime || Date.now());
    const jobs = ["os_orchestrator.yml"];
    if (t.getUTCHours() % 2 === 0 && t.getUTCMinutes() < 30) jobs.push("brain_live.yml");
    ctx.waitUntil((async () => {
      const results = await Promise.all(jobs.map(async (wf) => {
        try {
          const r = await ghDispatch(env, wf, {});
          if (!r.ok && r.status !== 204) console.error("[clock] could not dispatch", wf, r.status);
          return { wf, status: r.status };
        } catch (e) { console.error("[clock]", wf, e && e.message); return { wf, status: 0, error: String(e && e.message).slice(0, 120) }; }
      }));
      try { await env.R2.put("os/clock.json", JSON.stringify({ at: new Date().toISOString(), cron: event.cron || null, jobs: results }), { httpMetadata: { contentType: "application/json    "} }); } catch (e) { console.error("[clock] heartbeat", e && e.message); }
    })());
  },
};

// Serves a video from R2 over HTTP with Range support (streaming + seek in the
// browser). Only exposes the safe prefixes (video/ and recipe/); NEVER voice/ nor
// states. So Juan sees the result without the 50MB Telegram limit.
async function handleWatch(request, env, key, token) {
  if (!env.R2) return new Response("no storage", { status: 500 });
  if (!/^(video|recipe|voices)\/[^?]+\.(mp4|mov|webm|jpg|jpeg|png|webp|mp3|wav|m4a)$/.test(key)) {
    return new Response("not allowed", { status: 403 });
  }
  // TODO file requires a signed link (HMAC): video, voices and recipes. Before, video/ and voices/ were open
  // and anyone with the URL could download the production video even though it stayed private (QA finding).
  const good = await watchToken(env, key);
  if (!good || !safeEqual(token, good)) return new Response("unauthorized", { status: 403 });
  const rangeHeader = request.headers.get("Range");
  let opts = {};
  const m = rangeHeader && /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (m) {
    const offset = parseInt(m[1], 10);
    opts.range = m[2] ? { offset, length: parseInt(m[2], 10) - offset + 1 } : { offset };
  }
  const obj = await env.R2.get(key, opts);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", (obj.httpMetadata && obj.httpMetadata.contentType) || "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-store");
  const size = obj.size;
  if (m && obj.range) {
    const start = obj.range.offset || 0;
    const len = obj.range.length != null ? obj.range.length : size - start;
    headers.set("Content-Range", `bytes ${start}-${start + len - 1}/${size}`);
    headers.set("Content-Length", String(len));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(obj.body, { status: 200, headers });
}

// ---------- Mini App: API (auth via Telegram initData) ----------
async function hmacBytes(keyBytes, msg) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256    "}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
// Signed token for /watch links of personal content (recipe/). Same secret
// the workflows use (TELEGRAM_BOT_TOKEN), so whoever builds the reel can sign the link.
// CONSTANT-TIME comparison of secrets/hex (prevents timing attacks). For
// fixed-length tokens/HMACs; the length comparison leaks nothing useful here.
function safeEqual(a, b) {
  a = String(a == null ? "" : a); b = String(b == null ? "" : b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function watchToken(env, key) {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const h = toHex(await hmacBytes(new TextEncoder().encode(env.TELEGRAM_BOT_TOKEN), "watch:" + key));
  return h.slice(0, 32);
}

// Validates the initData sent by the Telegram Web App. Returns the user if valid
// and is the OWNER; otherwise null. (Official Telegram algorithm with HMAC-SHA256.)
async function validateInitData(initData, env) {
  if (!initData || !env.TELEGRAM_BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = await hmacBytes(new TextEncoder().encode("WebAppData"), env.TELEGRAM_BOT_TOKEN);
  const check = toHex(await hmacBytes(secret, dcs));
  if (!safeEqual(check, hash)) return null;
  // Freshness: reject initData older than 24 h (closes long-term replay).
  const authDate = +(params.get("auth_date") || 0);
  if (!authDate || (Date.now() / 1000 - authDate) > 86400) return null;
  let user;
  try { user = JSON.parse(params.get("user") || "null"); } catch { return null; }
  if (!user || !isOwner(user.id, env)) return null;
  return user;
}

const APP_WORKFLOWS = new Set([
  "render_phased.yml", "voice_parallel.yml", "channel_report.yml", "shorts_plan.yml",
  "shorts_final.yml", "publish_youtube.yml", "set_privacy.yml", "recipe_reel.yml",
  "produce_video.yml", "seo_regen.yml", "thumbnail_only.yml", "voice_samples.yml",
  "schedule_youtube.yml", "daily_video.yml", "photo_edit.yml", "niche_radar.yml",
  "report_auto2.yml", "produce_oddly.yml", "publish_oddly.yml", "build_asmr_library.yml", "daily_oddly.yml", "set_oddly_branding.yml", "clip_pd.yml", "clip_nasa.yml", "clip_wikimedia.yml", "clip_pixabay.yml", "clip_pexels.yml", "clip_archive_cc.yml", "subir_manual.yml",
  "history_short.yml",
  "motiongfx_daily.yml", "review_publish.yml", "review_discard.yml",
]);

// ---- Review-Before-Upload (motion graphics) ----
// The video lives in R2 (motiongfx/pending/<id>/video.mp4) and its state in
// motiongfx/reviews/<id>.json. Approving triggers review_publish.yml (YouTube +
// AtoPlay); discarding triggers review_discard.yml (cleanup, WITHOUT YouTube).
const REVIEW_KEY = (id) => `motiongfx/reviews/${id}.json`;
async function reviewMsg(env, cb, text) {
  const chatId = cb.message?.chat?.id;
  const mid = cb.message?.message_id;
  const payload = { chat_id: chatId, message_id: mid, text, parse_mode: "Markdown    "};
  // If the original message is a video, the edit goes by caption.
  const method = cb.message?.video ? "editMessageCaption" : "editMessageText";
  try {
    await tg(env, method, payload);
  } catch {
    await tg(env, "sendMessage", { chat_id: chatId, text, parse_mode: "Markdown    "});
  }
}
async function handleReviewAction(env, cb, action) {
  const [verb, id] = (action || "").split(":");
  if (!id || !id.startsWith("rv-")) {
    return tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "Invalid review    "});
  }
  const key = REVIEW_KEY(id);
  const obj = env.R2 ? await env.R2.get(key) : null;
  if (!obj) {
    return reviewMsg(env, cb, `❌ Review \`${id}\` not found (already decided or expired?).`);
  }
  let review;    try { review = JSON.parse(await obj.text()); } catch { return reviewMsg(env, cb, `❌ Review \`${id}\` corrupt in R2.`); }
  if (review.status !== "pending") {
    // Idempotency: a duplicate button does NOT re-publish nor spend quota.
    return reviewMsg(env, cb, `ℹ️ Review \`${id}\` is already *${review.status}* (${review.decidedAt ? new Date(review.decidedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : ""}).`);
  }
  if (verb === "approve") {
    try {
      const next = reviewApprove(review);
      await env.R2.put(key, JSON.stringify(next), { httpMetadata: { contentType: "application/json    "} });
      const r = await ghDispatch(env, "review_publish.yml", { review_id: id });
      return reviewMsg(env, cb, r.ok
        ? `🚀 *Approved!* Publishing to YouTube + AtoPlay…\nI'll notify you when it's live.\nID \`${id}\``
        : `🚀 *Approved!* But could not dispatch review_publish.yml (${r.status}). Check the Worker secrets.`);
    } catch (e) {
      console.error("[review] approve error", e);
      return reviewMsg(env, cb, `❌ Could not approve: ${String(e && e.message).slice(0, 120)}`);
    }
  }
  if (verb === "discard") {
    try {
      const next = reviewDiscard(review);
      await env.R2.put(key, JSON.stringify(next), { httpMetadata: { contentType: "application/json    "} });
      const r = await ghDispatch(env, "review_discard.yml", { review_id: id });
      return reviewMsg(env, cb, r.ok
        ? `🗑️ *Discarded.* Upload cancelled — temp assets cleaning up.\nYouTube was never called (no quota burned).\nID \`${id}\``
        : `🗑️ *Discarded.* But could not dispatch review_discard.yml (${r.status}).`);
    } catch (e) {
      console.error("[review] discard error", e);
      return reviewMsg(env, cb, `❌ Could not discard: ${String(e && e.message).slice(0, 120)}`);
    }
  }
  return tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "Unknown action    "});
}

// Available voices for the channel (with their sample in R2). engine/kvoice are used in the voice.
const VOICE_OPTIONS = [
  { id: "gemini_charon", label: "Gemini Announcer (Charon)", engine: "gemini", kvoice: "", sample: "voices/sample_gemini_charon.mp3    "},
  { id: "kokoro_am_michael", label: "Kokoro Michael (American)", engine: "kokoro", kvoice: "am_michael", sample: "voices/sample_kokoro_am_michael.mp3    "},
  { id: "kokoro_am_adam", label: "Kokoro Adam (American)", engine: "kokoro", kvoice: "am_adam", sample: "voices/sample_kokoro_am_adam.mp3    "},
  { id: "kokoro_bm_george", label: "Kokoro George (British)", engine: "kokoro", kvoice: "bm_george", sample: "voices/sample_kokoro_bm_george.mp3    "},
  { id: "kokoro_bm_lewis", label: "Kokoro Lewis (British)", engine: "kokoro", kvoice: "bm_lewis", sample: "voices/sample_kokoro_bm_lewis.mp3    "},
  { id: "kokoro_af_heart", label: "Kokoro Heart (female)", engine: "kokoro", kvoice: "af_heart", sample: "voices/sample_kokoro_af_heart.mp3    "},
  { id: "kokoro_af_bella", label: "Kokoro Bella (female)", engine: "kokoro", kvoice: "af_bella", sample: "voices/sample_kokoro_af_bella.mp3    "},
  { id: "kokoro_bf_emma", label: "Kokoro Emma (British)", engine: "kokoro", kvoice: "bf_emma", sample: "voices/sample_kokoro_bf_emma.mp3    "},
];

// Trends analysis with Gemini (are the upcoming videos aligned?).
async function geminiTrends(env) {
  if (!env.GEMINI_API_KEY) return { error: "GEMINI_API_KEY is missing in the Worker (add it to the deploy).    "};
  const state = (await r2json(env, "channel/state.json")) || {};
  const up = (state.upcoming || []).map((u) => `#${u.n}: ${u.topic}`).join("\n") || "(none)";
  const pub = (state.published || []).map((v) => v.title).join("; ") || "(none)";
  const prompt = `You are the strategist of a faceless data/money YouTube channel (English, US market). Already published: ${pub}. Upcoming planned videos:\n${up}\n\nAnswer in ENGLISH, brief and concrete (no filler): for EACH upcoming topic, one line with view potential HIGH/MEDIUM/LOW based on trends and current audience interest + a short tweak to improve it. At the end, suggest 1-2 hot MISSING topics we should add.`;
  for (const m of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "content-type": "application/json    "},
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!r.ok) continue;
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return { analysis: t };
    } catch {}
  }
  return { error: "Could not analyze (Gemini did not respond).    "};
}

// PERFORMANCE analysis: which videos perform best (views + watch minutes) and what to replicate.
async function geminiInsights(env) {
  if (!env.GEMINI_API_KEY) return { error: "GEMINI_API_KEY is missing in the Worker.    "};
  const inv = await channelInventory(env);
  const vids = [...(inv.longs || []), ...(inv.shorts || [])]
    .filter((v) => v.privacy === "public")
    .map((v) => ({ t: v.title, type: (v.seconds || 0) <= 60 ? "short" : "long", views: v.views || 0, watch: v.watch_min || 0 }))
    .sort((a, b) => b.views - a.views);
  if (!vids.length) return { error: "No public videos with metrics to analyze yet.    "};
  const lines = vids.map((v) => `- [${v.type}] ${v.t} — ${v.views} views, ${v.watch} min watched`).join("\n");
  const prompt = `You are the growth strategist of a faceless data/money YouTube channel (English, US). Published videos with their REAL performance:\n${lines}\n\nAnalyze and answer in ENGLISH, brief and actionable (no filler):\n1) Which topics/formats perform BEST (by views and watch minutes) and WHAT they have in common (topic, angle, title style).\n2) What does NOT work.\n3) 3-4 CONCRETE ideas for next videos that REPLICATE what works, with the tentative title in ENGLISH. Prioritize views and retention.`;
  for (const m of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "content-type": "application/json    "},
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!r.ok) continue;
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return { analysis: t };
    } catch {}
  }
  return { error: "Could not analyze (Gemini did not respond).    "};
}

// ET offset (America/New_York) vs UTC on a given date (-4 EDT / -5 EST) — handles DST.
function etOffsetHours(d) {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset    "}).formatToParts(d).find((p) => p.type === "timeZoneName").value;
    const m = s.match(/GMT([+-]?\d{1,2})/); return m ? parseInt(m[1], 10) : -4;
  } catch { return -4; }
}
// BEST publish hours (ET) per weekday — TWO slots/day so we can publish >=2/day:
//  weekend: 9AM and 3PM · Monday: 3PM and 7PM · Tue-Fri: 12PM and 5PM.
function bestHoursET(dow) { if (dow === 0 || dow === 6) return [9, 11, 13, 15, 18, 20]; if (dow === 1) return [11, 13, 15, 17, 19, 21]; return [10, 12, 14, 16, 18, 20]; }
// Chronological list of ALL the slots (best hour) of the next `days` days, in UTC ms.
function upcomingSlotList(days, dataHours) {
  const out = [], now = Date.now();
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  for (let day = 0; day < days; day++) {
    const probe = new Date(now + day * 86400 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short    "}).formatToParts(probe);
    const y = +parts.find((p) => p.type === "year").value, mo = +parts.find((p) => p.type === "month").value, da = +parts.find((p) => p.type === "day").value;
    const dow = dowMap[parts.find((p) => p.type === "weekday").value] ?? 2;
    const off = etOffsetHours(probe);
    for (const h of ((dataHours && dataHours.length) ? dataHours : bestHoursET(dow))) out.push(Date.UTC(y, mo - 1, da, h - off, 0, 0));
  }
  return out.sort((a, b) => a - b);
}
// Next BEST free (ET) slot (>=2h ahead). Spread: first EMPTY windows; if all
// have 1, allows a 2nd at the same hour (CAP 2/hour). Only looks at the occupied ones of THIS channel.
function nextBestSlot(occupiedMs, dataHours) {
  const minAhead = Date.now() + 2 * 3600 * 1000;
  const near = (s) => occupiedMs.filter((o) => Math.abs(o - s) < 30 * 60 * 1000).length;
  const slots = upcomingSlotList(21, dataHours);
  for (const s of slots) { if (s < minAhead) continue; if (near(s) === 0) return new Date(s).toISOString(); }
  for (const s of slots) { if (s < minAhead) continue; if (near(s) < 2) return new Date(s).toISOString(); }
  return null;
}
// Day-by-day calendar: each day with its slots (best hour), marked FULL (scheduled video) or FREE.
function buildCalendar(scheduled, days) {
  const now = Date.now();
  const isoETDate = (ms) => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit    "}).formatToParts(new Date(ms)); return p.find((x) => x.type === "year").value + "-" + p.find((x) => x.type === "month").value + "-" + p.find((x) => x.type === "day").value; };
  const fmtDay = (ms) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", day: "numeric", month: "short    "}).format(new Date(ms));
  const fmtTime = (ms) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(ms));
  const items = (scheduled || []).map((s) => ({ ms: Date.parse(s.publish_at), title: s.title, type: s.type, video_id: s.video_id })).filter((x) => x.ms > now).sort((a, b) => a.ms - b.ms);
  const used = new Set(), daysMap = new Map();
  for (const slotMs of upcomingSlotList(days)) {
    if (slotMs < now - 30 * 60000) continue;
    const dkey = isoETDate(slotMs);
    if (!daysMap.has(dkey)) daysMap.set(dkey, { date: dkey, label: fmtDay(slotMs), slots: [] });
    let match = null;
    for (let i = 0; i < items.length; i++) { if (used.has(i)) continue; if (Math.abs(items[i].ms - slotMs) < 3600 * 1000) { match = items[i]; used.add(i); break; } }
    daysMap.get(dkey).slots.push({ time: fmtTime(slotMs), filled: !!match, title: match ? match.title : null, type: match ? match.type : null });
  }
  // Scheduled at NON-standard hours (manual reschedules): show them anyway, to not hide anything.
  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue; const it = items[i]; const dkey = isoETDate(it.ms);
    if (!daysMap.has(dkey)) daysMap.set(dkey, { date: dkey, label: fmtDay(it.ms), slots: [] });
    daysMap.get(dkey).slots.push({ time: fmtTime(it.ms), filled: true, title: it.title, type: it.type, off_slot: true });
  }
  return [...daysMap.values()].sort((a, b) => a.date.localeCompare(b.date));
}
// Schedules a video at the next best free slot (used by /api/schedule and /api/approve).
async function doSchedule(env, vid, isProductionVideo) {
  const inv = await channelInventory(env);
  const occupied = [...(inv.longs || []), ...(inv.shorts || [])].filter((v) => v.publish_at && Date.parse(v.publish_at) > Date.now()).map((v) => Date.parse(v.publish_at));
  // Also count what was just scheduled locally, so two videos don't land in the same slot.
  const prevLocal = (await r2json(env, "channel/scheduled_local.json")) || [];
  prevLocal.forEach((s) => { if (s.publish_at && s.video_id !== vid && Date.parse(s.publish_at) > Date.now()) occupied.push(Date.parse(s.publish_at)); });
  // Hours from channel DATA (the best performing ones) if the report calculated them; otherwise, research.
  const bh = await r2json(env, "channel/best_hours.json");
  const dataHours = bh && Array.isArray(bh.hours) && bh.hours.length ? bh.hours : null;
  const slot = nextBestSlot(occupied, dataHours);
  if (!slot) return { ok: false, error: "no free slot found    "};
  const r = await ghDispatch(env, "schedule_youtube.yml", { video_id: vid, publish_at: slot });
  if (r.ok) {
    if (isProductionVideo) {
      for (const f of ["render_pending.json", "quality.json", "package.json", "seo_approved.json", "video_id.txt"]) { try { await env.R2.delete(`video/0001-youtube-money/${f}`); } catch {} }
    }
    const title = (inv.longs || []).concat(inv.shorts || []).find((v) => v.video_id === vid);
    const rec = { video_id: vid, publish_at: slot, title: (title && title.title) || "Video", type: (title && (title.seconds || 0) <= 60) ? "short" : "long", at: new Date().toISOString() };
    const merged = [...prevLocal.filter((s) => s.video_id !== vid), rec];
    try { await env.R2.put("channel/scheduled_local.json", JSON.stringify(merged), { httpMetadata: { contentType: "application/json    "} }); } catch {}
    try { await env.R2.delete("channel/inventory_cache.json"); } catch {}
  }
  return { ok: r.ok, publish_at: slot };
}

async function handleApi(request, env, url) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json    "} });
  const initData = request.headers.get("X-Init-Data") || "";
  const user = await validateInitData(initData, env);
  if (!user) return json({ error: "unauthorized    "}, 403);
  const chatId = env.OWNER_CHAT_ID;

  if (url.pathname === "/api/state") {
    const _t0 = Date.now(); const _T = (l) => console.log(`[t] ${l} ${Date.now() - _t0}ms`);   // DEBUG timers
    // PERF: starts the base reads + inventory in PARALLEL. channelInventory makes calls to
    // YouTube; having the R2 reads run at the same time (not in series) saves round trips.
    const [stateRaw, planRaw, hiddenRaw, inv] = await Promise.all([
      r2json(env, "channel/state.json"),
      r2json(env, "shorts/0001-youtube-money/plan.json"),
      r2json(env, "channel/hidden_videos.json"),
      channelInventory(env),   // REAL inventory (cached 10 min): longs + shorts + subs/views
    ]);
    _T("base+inv");
    const state = stateRaw || {};
    const plan = planRaw || {};
    const approvedShorts = (plan.shorts || []).filter((s) => s.approved);
    // HIDDEN (removed duplicates): out of the ENTIRE app (tree, matrix, counters...).
    const hidden = new Set(hiddenRaw || []);
    if (hidden.size) {
      inv.longs = (inv.longs || []).filter((v) => !hidden.has(v.video_id));
      inv.shorts = (inv.shorts || []).filter((v) => !hidden.has(v.video_id));
    }
    const seedPub = state.published || [];
    if (inv.longs && inv.longs.length) {
      state.published = inv.longs.map((v) => {
        const seed = seedPub.find((p) => p.video_id === v.video_id) || {};
        return { video_id: v.video_id, title: v.title, privacy: v.privacy, published_at: v.published_at, n: seed.n, ai_score: seed.ai_score, stats: { views: v.views, likes: v.likes } };
      });

    }
    // PERF: privacy/views of the plan shorts. The INVENTORY already brings them (fresh/cached),
    // so they are used from there; ONLY YouTube is asked for those not in the inventory (normally
    // none). Before, this was a YouTube call on EVERY load (~4s); now almost always 0 calls.
    const planShorts = plan.shorts || [];
    const invById = {};
    for (const v of [...(inv.longs || []), ...(inv.shorts || [])]) invById[v.video_id] = { privacy: v.privacy, views: v.views };
    const missingIds = planShorts.filter((s) => s.video_id && !invById[s.video_id]).map((s) => s.video_id);
    const ytMissing = missingIds.length ? await ytStatus(env, missingIds) : {};
    const yt = { ...invById, ...ytMissing };
    _T(`yt(missing=${missingIds.length})`);
    // Counters: how many long videos and how many shorts (what Juan asked for).
    state.long_count = (state.published || []).length;
    state.shorts_count = (inv.shorts || []).length;
    state.shorts_public = (inv.shorts || []).filter((s) => s.privacy === "public").length;
    // Compact list of ALL the videos (longs + shorts) with type, views and duration.
    state.all_videos = [
      ...(inv.longs || []).map((v) => ({ type: "long", video_id: v.video_id, title: v.title, privacy: v.privacy, publish_at: v.publish_at || null, views: v.views, seconds: v.seconds, watch_min: v.watch_min || 0, avg_sec: v.avg_sec || 0 })),
      ...(inv.shorts || []).map((v) => ({ type: "short", video_id: v.video_id, title: v.title, privacy: v.privacy, publish_at: v.publish_at || null, views: v.views, seconds: v.seconds, watch_min: v.watch_min || 0, avg_sec: v.avg_sec || 0 })),
    ];
    state.analytics_ok = !!inv.analytics_ok;
    state.analytics = inv.analytics || null;
    // SCHEDULED: videos with publishAt in the future (YouTube publishes them alone at that hour).
    // When published, YouTube removes publishAt and they become public -> they disappear from this list.
    const nowMs = Date.now();
    const invAll = [...(inv.longs || []), ...(inv.shorts || [])];
    const fromYT = invAll
      .filter((v) => v.publish_at && Date.parse(v.publish_at) > nowMs)
      .map((v) => ({ video_id: v.video_id, title: v.title, type: (v.seconds || 0) <= 90 ? "short" : "long", publish_at: v.publish_at }));
    // + LOCAL record (just scheduled, before YouTube confirms). Discards those that already
    // appear on YouTube (avoids duplicates) or are already public (already published) or whose time passed.
    const schedLocal = (await r2json(env, "channel/scheduled_local.json")) || [];
    const publicIds = new Set(invAll.filter((v) => v.privacy === "public").map((v) => v.video_id));
    const ytIds = new Set(fromYT.map((v) => v.video_id));
    const fromLocal = schedLocal.filter((s) => s.publish_at && Date.parse(s.publish_at) > nowMs && !publicIds.has(s.video_id) && !ytIds.has(s.video_id));
    state.scheduled = [...fromYT, ...fromLocal].sort((a, b) => Date.parse(a.publish_at) - Date.parse(b.publish_at));
    // Day-by-day CALENDAR (next 12 days): best hours, marked full/free. Goal: >=2/day.
    state.calendar = buildCalendar(state.scheduled, 12);
    state.totals = {
      views: inv.total_views || state.all_videos.reduce((s, v) => s + (v.views || 0), 0),
      watch_min: state.all_videos.reduce((s, v) => s + (v.watch_min || 0), 0),
      subs: inv.subs || 0,
      videos: (inv.longs || []).length + (inv.shorts || []).length,
      longs: (inv.longs || []).length,
      shorts: (inv.shorts || []).length,
    };
    // FACTORY: real capacity/throughput (published in 7 days, FREE from the inventory) + duration experiment.
    const wk = Date.now() - 7 * 86400 * 1000;
    const pub7 = invAll.filter((v) => v.published_at && Date.parse(v.published_at) >= wk);
    const exp = (await r2json(env, "channel/experiments.json")) || {};
    state.factory = {
      pub_7d: pub7.length,
      pub_7d_long: pub7.filter((v) => (v.seconds || 0) > 60).length,
      pub_7d_short: pub7.filter((v) => (v.seconds || 0) <= 60).length,
      per_day: +(pub7.length / 7).toFixed(1),
      duration: exp.duration || null,
    };
    // CHANNEL ANALYSIS: "how promising" score + problems/rejections (what the API exposes) + AI narrative.
    {
      const A = inv.analytics || {};
      const daily = A.daily || [];
      const sumV = (arr) => arr.reduce((s, x) => s + (x.views || 0), 0);
      const last3 = sumV(daily.slice(-3)), prev3 = sumV(daily.slice(-6, -3));
      const trend = prev3 > 0 ? (last3 - prev3) / prev3 : (last3 > 0 ? 1 : 0);
      const avgSec = (A.last28 && A.last28.avg_sec) || 0;
      const avgLen = (inv.longs || []).length ? ((inv.longs).reduce((s, v) => s + (v.seconds || 0), 0) / inv.longs.length) : 0;
      const retention = avgLen > 0 ? Math.min(1, avgSec / avgLen) : 0;
      const recent = invAll.filter((v) => v.published_at && (Date.now() - Date.parse(v.published_at)) < 14 * 86400 * 1000).length;
      const watchHours = (state.totals.watch_min || 0) / 60;
      const yppSubs = Math.min(1, (inv.subs || 0) / 1000), yppHours = Math.min(1, watchHours / 4000);
      const gScore = Math.max(0, Math.min(1, (trend + 1) / 2)) * 35;
      const rScore = retention * 30;
      const cScore = Math.min(1, recent / 6) * 20;
      const yScore = ((yppSubs + yppHours) / 2) * 15;
      const promise = Math.round(gScore + rScore + cScore + yScore);
      const label = promise >= 66 ? "Promising" : promise >= 40 ? "Building" : "Starting";
      const problems = invAll
        .filter((v) => v.rejection_reason || (v.upload_status && !["processed", "uploaded"].includes(v.upload_status)))
        .map((v) => ({ video_id: v.video_id, title: v.title, reason: v.rejection_reason || v.upload_status }));
      state.analysis = {
        promise, label,
        factors: { crecimiento: Math.round(gScore), retencion: Math.round(rScore), cadencia: Math.round(cScore), ypp: Math.round(yScore) },
        trend_pct: Math.round(trend * 100), retention_pct: Math.round(retention * 100), recent_14d: recent,
        problems, ai: (await r2json(env, "channel/analysis.json")) || null,
      };
    }
    // PERF: these 5 reads are independent -> in PARALLEL (before one after another).
    const [nicheRadar, brainJson, strategyJson, weeklyJson, auto2Json, auto2HiddenRaw] = await Promise.all([
      r2json(env, "channel/niche_radar.json"),    // niche radar (Oddly)
      r2json(env, "channel/brain.json"),           // the Brain (daily health of the 2 channels)
      r2json(env, "channel/brain/strategy.json"),  // learned strategy (Brain 2.0)
      r2json(env, "channel/weekly_stats.json"),    // week-by-week analysis (ISO Analytics)
      r2json(env, "channel/auto2/state.json"),     // real state of Oddly Loop
      r2json(env, "channel/auto2/hidden_videos.json"), // Oddly hidden: they don't exist for the app
    ]);
    state.niche_radar = nicheRadar || null;
    state.brain = brainJson || null;
    state.strategy = strategyJson || null;
    state.weekly = weeklyJson || null;
    state.auto2 = auto2Json || null;
    // Oddly HIDDEN (unpublished or pulled from the queue): out of the ENTIRE app, same as in Data Lens.
    if (state.auto2 && Array.isArray(state.auto2.list) && Array.isArray(auto2HiddenRaw) && auto2HiddenRaw.length) {
      const oh = new Set(auto2HiddenRaw);
      state.auto2.list = state.auto2.list.filter((v) => !oh.has(v.video_id));
      state.auto2.videos = state.auto2.list.length;
    }
    _T("radar-block");
    // "manual" in Oddly = ONLY what Juan marks (channel/auto2/manual_videos.json). Bot by default.
    if (state.auto2 && Array.isArray(state.auto2.list)) {
      const om = new Set((await r2json(env, "channel/auto2/manual_videos.json")) || []);
      state.auto2.list.forEach((v) => { v.manual = om.has(v.video_id); });
      // DURABLE "🕒 Scheduling…" marker (channel/auto2/pending_sched.json): keeps the state
      // even if the app reloads and even if the report (2h) doesn't reflect the change yet. Cleans itself:
      // if the video is already public/scheduled (confirmed) or the TTL passed (backstop ~3h).
      const pend = (await r2json(env, "channel/auto2/pending_sched.json")) || [];
      if (pend.length) {
        const nowMs = Date.now(), TTL = 3 * 3600 * 1000;
        const byId = {}; state.auto2.list.forEach((v) => { byId[v.video_id] = v; });
        const kept = [];
        for (const p of pend) {
          if (!p || !p.video_id) continue;
          const v = byId[p.video_id];
          const confirmed = v && (v.privacy === "public" || (v.publish_at && Date.parse(v.publish_at) > nowMs));
          const expired = !p.at || (nowMs - Date.parse(p.at)) > TTL;
          if (confirmed || expired) continue; // already reflects itself, or expired -> back to "to review"
          kept.push(p);
          if (v) v.pending_sched = p.mode || "schedule"; // the client paints it "Scheduling…"
        }
        if (kept.length !== pend.length) { try { await env.R2.put("channel/auto2/pending_sched.json", JSON.stringify(kept), { httpMetadata: { contentType: "application/json    "} }); } catch {} }
      }
    }
    // BILIBILI (multiplatform repost, Phase 2): pending queue + reposted log, to see it in the app.
    try {
      const [bqR, blogR, postedR] = await Promise.all([
        r2json(env, "channel/oddly/bilibili_queue.json"),
        r2json(env, "channel/oddly/bilibili_log.json"),
        r2json(env, "channel/oddly/bilibili_posted.json"),
      ]);
      const bq = bqR || [], blog = blogR || [], posted = postedR || [];
      const postedSet = new Set(Array.isArray(posted) ? posted : []);
      const pending = (Array.isArray(bq) ? bq : []).filter((q) => q && q.video_id && !postedSet.has(q.video_id));
      state.bilibili = {
        channel: "Oddly_Loop",
        posted_total: Array.isArray(posted) ? posted.length : 0,
        pending: pending.map((q) => ({ title: q.title || "Short", at: q.at || null })).slice(0, 10),
        log: (Array.isArray(blog) ? blog : []).slice(0, 12),
      };
    } catch { state.bilibili = null; }

    // PENDING TO APPROVE (for the Summary window): private unscheduled from each channel.
    // Data Lens uses its inventory (hidden already filtered); Oddly uses its list. The "🕒 Scheduling…"
    // (pending_sched) do NOT count as to-review: they are already in motion.
    // Video Forge is 100% automatic (Juan's decision): NOTHING is approved or scheduled by hand. The private
    // without date is what the brain hid or what is in production; never "to approve".
    state.pending_approve = { data_lens: 0, oddly: 0, total: 0, note: "all automatic    "};
    // MONETIZATION GOAL (YPP) with daily pace measurement — each channel its goal.
    const dlLikes = invAll.reduce((s, v) => s + (v.likes || 0), 0);
    // PERF: the 2 monetization goals in PARALLEL (each reads+writes R2).
    const odLikes = state.auto2 ? (state.auto2.list || []).reduce((s, v) => s + (v.likes || 0), 0) : 0;
    const [dlMonet, odMonet] = await Promise.all([
      monetTrack(env, "data-lens", { subs: inv.subs || 0, watch_hours: ((state.totals && state.totals.watch_min) || 0) / 60, views: inv.total_views || 0, likes: dlLikes }).catch(() => null),
      state.auto2 ? monetTrack(env, "auto2", { subs: state.auto2.subs || 0, total_views: state.auto2.total_views || 0 }).catch(() => null) : Promise.resolve(null),
    ]);
    if (dlMonet) state.monet_goal = dlMonet;
    if (state.auto2 && odMonet) state.auto2.monet_goal = odMonet;
    _T("monet");
    // Video TREE: each LONG with its nested SHORTS below (Videos tab, as Juan asked for).
    // short->parent mapping: persistent ledger (channel/shorts_map.json) + the current plan (for_video_id).
    // PERF: shorts_map + videos + manual are independent -> in PARALLEL.
    const [shortsMapR, vledgerR, manualR] = await Promise.all([
      r2json(env, "channel/shorts_map.json"),     // short->parent map (persistent ledger)
      r2json(env, "channel/videos.json"),          // factory ledger (STAGES of each video)
      r2json(env, "channel/manual_videos.json"),   // ids marked "manual" by Juan
    ]);
    const shortsMap = shortsMapR || {};
    if (plan.for_video_id) (plan.shorts || []).forEach((s) => { if (s.video_id) shortsMap[s.video_id] = plan.for_video_id; });
    const byParent = {};
    (inv.shorts || []).forEach((sh) => { const p = shortsMap[sh.video_id]; if (p) (byParent[p] = byParent[p] || []).push(sh); });
    const vledger = vledgerR || {};
    // "manual" = ONLY what Juan marks by hand (channel/manual_videos.json). By default EVERYTHING is from the
    // Bot (all production is uploaded via the factory). Juan notifies when he uploads something manual and that id
    // enters the list. So no Bot video shows as "manual" due to an incomplete ledger.
    const manualSet = new Set(manualR || []);
    const slimV = (v) => ({ video_id: v.video_id, title: (v.title || "").replace(/ #Shorts$/, ""), privacy: v.privacy, views: v.views || 0, watch_min: v.watch_min || 0, manual: manualSet.has(v.video_id), niche_label: dlLabel(v.title) });
    state.video_tree = (inv.longs || []).map((l) => ({ ...slimV(l), shorts: (byParent[l.video_id] || []).map(slimV) }));
    const groupedIds = new Set(Object.values(byParent).flat().map((s) => s.video_id));
    state.video_tree_ungrouped = (inv.shorts || []).filter((sh) => !groupedIds.has(sh.video_id)).map(slimV);
    // Control MATRIX per long video: check of what's done + possible actions.
    // published = live from the channel; thumbnail = record; shorts = record OR the plan
    // (if the plan is for this video and its approved shorts are already uploaded) -> auto-corrects.
    const planFor = plan.for_video_id;
    const planApproved = (plan.shorts || []).filter((s) => s.approved);
    const planShortsDone = planApproved.length > 0 && planApproved.every((s) => s.video_id);
    state.video_matrix = await Promise.all((inv.longs || []).map(async (v) => {
      const st = (vledger[v.video_id] || {}).stages || {};
      // The thumbnail already comes resolved in the cached inventory (avoids 1 R2.head per video on EVERY request).
      const thumbUrl = v.thumb_url || null;
      const scheduled = !!v.publish_at; // has publish time = already scheduled (not "to review")
      return {
        video_id: v.video_id, title: v.title, public: v.privacy === "public", scheduled, publish_at: v.publish_at || null,
        views: v.views, watch_min: v.watch_min || 0, manual: manualSet.has(v.video_id), niche_label: dlLabel(v.title),
        thumb_url: thumbUrl, thumb_approved: !!st.thumb_approved,
        stages: {
          // "published" = already managed: public LIVE or SCHEDULED (publishes itself at its hour).
          publicado: v.privacy === "public" || scheduled,
          miniatura: !!st.thumbnail, // ✓ = applied on YouTube (thumb_url = only generated, to approve)
          // shorts DONE if: the record says so, OR the video ALREADY HAS shorts on the channel (byParent),
          // OR the current plan is for this video and its approved shorts were already uploaded.
          shorts: !!st.shorts || ((byParent[v.video_id] || []).length > 0) || !!(planFor && planFor === v.video_id && planShortsDone),
        },
      };
    }));
    // GLOBAL shorts pending: how many PUBLIC videos still lack shorts (from the WHOLE channel,
    // not just the latest). The per-video detail with the "+Do" button goes in "Control per video".
    state.shorts_pending_videos = (state.video_matrix || [])
      .filter((v) => v.public && !((v.stages || {}).shorts))
      .map((v) => ({ video_id: v.video_id, title: v.title }));
    state.shorts_pending_count = state.shorts_pending_videos.length;
    // Shorts "done" = there are approved ones and ALL are uploaded (they have video_id).
    const shortsDone = approvedShorts.length > 0 && approvedShorts.every((s) => s.video_id);
    (state.published || []).forEach((v, i) => { v.shorts_done = i === 0 ? shortsDone : false; });
    // Groups the shorts under the video they belong to (for now, the 1st published).
    const firstVid = (state.published || [])[0] || {};
    const shortsWith = approvedShorts.map((s) => ({
      title: s.title, video_id: s.video_id || null,
      privacy: s.video_id ? (yt[s.video_id] ? yt[s.video_id].privacy : "private") : "—",
      views: s.video_id && yt[s.video_id] ? yt[s.video_id].views : 0,
    }));
    state.shorts_groups = shortsWith.length ? [{ n: firstVid.n || 1, title: firstVid.title || "Video 1", shorts: shortsWith }] : [];
    state.shorts_list = shortsWith;
    // Full shorts PROPOSAL (to approve/generate/publish FROM the app).
    // State per short: pending (undecided) | approved | skipped | uploaded.
    // Scheduled time (publishAt) of each uploaded short, from the YouTube inventory.
    const shortPub = {}; invAll.forEach((v) => { if (v.publish_at) shortPub[v.video_id] = v.publish_at; });
    state.shorts_proposal = planShorts.map((s) => {
      const uploaded = !!s.video_id;
      // pending = still undecided (approved!=true and NOT skipped). skipped ONLY if skipped===true.
      const st = uploaded ? "uploaded" : (s.approved === true ? "approved" : (s.skipped === true ? "skipped" : "pending"));
      return {
        n: s.n, title: s.title || ("Short #" + ((s.n || 0) + 1)), hook: s.hook || "", caption: s.caption || "",
        hashtags: s.hashtags || [], dur: s.dur || null, start: s.start != null ? s.start : null, end: s.end != null ? s.end : null,
        state: st, video_id: s.video_id || null,
        privacy: uploaded ? (yt[s.video_id] ? yt[s.video_id].privacy : "private") : null,
        publish_at: uploaded ? (shortPub[s.video_id] || null) : null,
        views: uploaded && yt[s.video_id] ? yt[s.video_id].views : 0,
      };
    });
    const sp = state.shorts_proposal;
    // Shorts are made from the latest PUBLIC video (not from a scheduled/private one).
    const latestPublic = (state.published || []).find((v) => v.privacy === "public") || {};
    // Is the current plan for the LATEST public video? (to not suggest extra).
    const forCurrent = !!(plan.for_video_id && latestPublic.video_id && plan.for_video_id === latestPublic.video_id);
    const anyToAct = sp.some((s) => s.state === "pending" || s.state === "approved");
    const allDone = sp.some((s) => s.state === "uploaded") && !anyToAct;
    // Is the PARENT VIDEO of these shorts already public? Shorts of a private/scheduled video
    // must not be published (they'd drive traffic to a video nobody sees).
    const parentVid = invAll.find((v) => v.video_id === plan.for_video_id);
    const parentPublic = !!(parentVid && parentVid.privacy === "public");
    state.shorts_status = {
      total: sp.length,
      pending: sp.filter((s) => s.state === "pending").length,
      approved_pend: sp.filter((s) => s.state === "approved").length,
      uploaded: sp.filter((s) => s.state === "uploaded").length,
      all_done: allDone,
      for_current: forCurrent,
      parent_id: plan.for_video_id || null,
      parent_public: parentPublic,
      parent_title: (parentVid && parentVid.title) || null,
      // Suggest ONLY if there is ALREADY a public video, nothing to decide/generate, and (no plan or it's for another video).
      can_suggest: !!latestPublic.video_id && !anyToAct && (sp.length === 0 || !forCurrent),
      latest_video_id: latestPublic.video_id || null,
    };
    // Advance NEXT: remove the ones already produced (channel/produced.json = {done:[ns]}).
    // PERF: ALL of these are independent -> IN PARALLEL (before: ~8 R2 reads + R2 usage + the
    // GitHub call, all in series = the bulk of the ~2s delay per load).
    const [producedR, learn, elog, toolsHealthR, craft, r2u, reg, vchoice, runsCacheR] = await Promise.all([
      r2json(env, "channel/produced.json"),      // topics already produced (advances the queue)
      r2json(env, "channel/learnings.json"),      // continuous improvement (learnings)
      r2json(env, "channel/error_log.json"),      // learnings from errors
      r2json(env, "channel/tools_health.json"),   // tools health
      r2json(env, "channel/craft_feedback.json"), // render self-improvement
      r2Usage(env),                               // R2 usage (10GB limit)
      r2json(env, "voice/registry.json"),         // available voices
      r2json(env, "channel/voice_choice.json"),   // chosen voice
      r2json(env, "channel/_cache/actions_runs.json"), // Actions runs CACHED in R2 (15s)
    ]);
    // Advance NEXT: remove the already-produced + fallback by # of PUBLIC longs.
    const produced = producedR || { done: [] };
    const doneSet = new Set(produced.done || []);
    const publicLongCount = (state.published || []).filter((v) => v.privacy === "public").length;
    state.upcoming = (state.upcoming || []).filter((u) => !doneSet.has(u.n) && u.n > publicLongCount);
    // Fresh channel metrics (from the inventory, every 10 min).
    if (inv.at) {
      state.channel_stats = { subs: inv.subs, total_views: inv.total_views, videos: (inv.longs || []).length + (inv.shorts || []).length };
      state.monetization = state.monetization || {};
      state.monetization.subs = inv.subs;
    }
    state.inventory_at = inv.at;
    state.build = String(env.APP_BUILD || "dev");
    state.learnings = learn ? { brief: learn.brief || "", source: learn.source || "", top: (learn.top || []).slice(0, 5), at: learn.generated_at || null } : null;
    state.error_learnings = elog ? { incidents: (elog.incidents || []).slice(-6).reverse(), patterns: elog.patterns || [], at: elog.updated_at || null } : null;
    state.tools_health = toolsHealthR;
    state.craft = craft ? { footage: craft.footage_feedback || "", hook: craft.hook || "", score: craft.score || 0, fixes: craft.fixes || {}, at: craft.at || null } : null;
    const usedGb = (r2u.bytes || 0) / (1024 * 1024 * 1024);
    state.r2 = { used_gb: Math.round(usedGb * 100) / 100, count: r2u.count || 0, limit_gb: 10, pct: Math.min(100, Math.round((usedGb / 10) * 100)) };
    let voices = [];
    if (reg) voices = Object.values(reg).map((v) => v.label);
    state.voices = voices;
    state.voices_pick = {
      current: (vchoice && vchoice.id) || "gemini_charon",
      options: await Promise.all(VOICE_OPTIONS.map(async (v) => ({ id: v.id, label: v.label, sample_url: "/watch/" + v.sample + "?t=" + (await watchToken(env, v.sample)) }))),
    };
    _T("post-reads");
    // Runs: active (in progress) + PROBLEMS (recent failures, with the step that failed).
    // PERF: cache in R2 (shared between isolates). If fresh (<15s) it avoids the GitHub call (~900ms).
    let runs;
    if (runsCacheR && runsCacheR.at && Date.now() - Date.parse(runsCacheR.at) < 15000) {
      runs = runsCacheR.runs || [];
    } else {
      const runsRes = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs?per_page=50`);
      runs = runsRes.ok ? ((await runsRes.json()).workflow_runs || []) : [];
      try { await env.R2.put("channel/_cache/actions_runs.json", JSON.stringify({ at: new Date().toISOString(), runs }), { httpMetadata: { contentType: "application/json    "} }); } catch {}
    }
    // Active runs WITH current step + % + ETA (to watch live in the app, short).
    const actRuns = runs.filter((r) => r.status !== "completed");
    // PERF: step detail of the first 3 active runs, IN PARALLEL (before: one after another in the loop).
    const jobsRes = await Promise.all(actRuns.slice(0, 3).map((r) => ghApi(env, `/repos/${env.GH_REPO}/actions/runs/${r.id}/jobs`).catch(() => ({ ok: false }))));
    state.active = [];
    for (let ai = 0; ai < actRuns.length; ai++) {
      const r = actRuns[ai];
      const mins = r.run_started_at ? Math.max(0, Math.round((Date.now() - Date.parse(r.run_started_at)) / 60000)) : 0;
      let step = r.status === "queued" ? "queued…" : "starting…";
      // Only the first 3 active runs have detail (requested above in parallel).
      const jr = ai < 3 ? jobsRes[ai] : { ok: false };
      if (jr.ok) {
        const jobs = (await jr.json()).jobs || [];
        const job = jobs.find((j) => j.status === "in_progress") || jobs[0];
        const steps = (job && job.steps) || [];
        const total = steps.length, done = steps.filter((s) => s.status === "completed").length;
        const cur = steps.find((s) => s.status === "in_progress");
        if (cur) step = `step ${Math.min(done + 1, total)}/${total}: ${cur.name}`;
        else if (total && done === total) step = "closing…";
      }
      const exp = expectedMin(r.name);
      state.active.push({ name: r.name, wf: (r.path || "").split("/").pop(), status: r.status, step, pct: r.status === "queued" ? 0 : Math.min(99, Math.round((mins / exp) * 100)), eta: Math.max(0, exp - mins) });
    }
    // PROBLEMS without repeats: only the LATEST run per workflow, and only if it failed
    // (so each error shows up ONCE and clears itself when you retry successfully).
    const latestByWf = {};
    for (const r of runs) { const wf = r.path || r.name; if (!latestByWf[wf]) latestByWf[wf] = r; }
    // Recent errors (24h), last failed run per workflow — ONLY from valid CURRENT
    // workflows (APP_WORKFLOWS). So deleted/experimental ones (clip_cc, clip_vimeo) don't show up as
    // "unresolved errors" when they no longer exist or are dead-ends.
    const fails = Object.values(latestByWf).filter((r) => r.conclusion === "failure" && (Date.now() - Date.parse(r.updated_at)) < 24 * 3600 * 1000 && APP_WORKFLOWS.has((r.path || "").split("/").pop())).slice(0, 8);
    state.problems = [];
    for (const r of fails) {
      // Without requesting /jobs here (saves Cloudflare subrequests): the step/detail loads on
      // click of "View error" (/api/error-detail). So /api/state doesn't blow up on subrequests.
      state.problems.push({ name: r.name, step: "", url: r.html_url, run_id: r.id, workflow: (r.path || "").split("/").pop() });
    }
    // CURRENT PRODUCTION: AI rating + SEO package + preview. PERF: the 6 reads IN PARALLEL.
    const [quality, pkg, idoRes, thHead, renderPending, approvedFlag] = await Promise.all([
      r2json(env, "video/0001-youtube-money/quality.json"),
      r2json(env, "video/0001-youtube-money/package.json"),
      env.R2.get("video/0001-youtube-money/video_id.txt").catch(() => null),
      env.R2.head("video/0001-youtube-money/thumbnail.jpg").catch(() => null),
      r2json(env, "video/0001-youtube-money/render_pending.json"),
      r2json(env, "video/0001-youtube-money/seo_approved.json"),
    ]);
    let seoVideoId = null;
    if (idoRes) { try { seoVideoId = (await idoRes.text()).trim(); } catch {} }
    const thumbUrl = thHead ? "/watch/video/0001-youtube-money/thumbnail.jpg?t=" + (await watchToken(env, "video/0001-youtube-money/thumbnail.jpg")) : null;
    // Approved only if the approved title == the current title (if you regenerate the SEO, it resets).
    const isApproved = !!(approvedFlag && approvedFlag.approved && pkg && approvedFlag.title === pkg.title);
    // The production video is ALREADY published (public) => the SEO step finished, it hides.
    const prodPublished = !!(seoVideoId && (inv.longs || []).some((v) => v.video_id === seoVideoId && v.privacy === "public"));
    state.production = {
      approved: isApproved,
      done: prodPublished,
      render_pending: !!renderPending,
      render_qa: renderPending ? { ok: renderPending.qa_ok !== false, warning: renderPending.qa_warning || "", duration: renderPending.duration || 0 } : null,
      quality: quality || null,
      seo: pkg ? {
        title: pkg.title || null, description: pkg.description || null,
        tags: pkg.tags || [], hashtags: pkg.hashtags || [],
        thumbnail_text: pkg.thumbnail_text || null, chapters: pkg.chapters || [],
        pinned_comment: pkg.pinned_comment || null, validation: pkg.validation || null,
      } : null,
      video_id: seoVideoId,
      watch_url: "/watch/video/0001-youtube-money/video.mp4?t=" + (await watchToken(env, "video/0001-youtube-money/video.mp4")),
      thumb_url: thumbUrl,
    };
    return json(state);
  }

  if (url.pathname === "/api/trends") {
    return json(await geminiTrends(env));
  }

  if (url.pathname === "/api/insights") {
    return json(await geminiInsights(env));
  }

  if (url.pathname === "/api/os") {
    // AI OS in one bot: global state, the three complete pulses, what the brain decides and the clock.
    const now = Date.now();
    const [base, pRadar, pViento, live, ledger, journal, decision, clock] = await Promise.all([
      osStateFrom((k) => r2json(env, k), "video-forge", now),
      r2json(env, "os/pulse/radar.json"), r2json(env, "os/pulse/viento.json"),
      r2json(env, "channel/auto2/lineup.json"), r2json(env, "channel/brain/ledger.json"),
      r2json(env, "channel/brain/journal.json"), r2json(env, "channel/brain/decision.json"), r2json(env, "os/clock.json"),
    ]);
    const stale = (x) => (x && x.system && x.at ? applyStaleness(x, now) : null);
    return json({
      ...base,
      pulses: { "video-forge": base.pulse, radar: stale(pRadar), viento: stale(pViento) },
      brain: { live: live || null, ledger: Array.isArray(ledger) ? ledger.slice(-40) : [], journal: Array.isArray(journal) ? journal.slice(-40) : [], decision: decision || null },
      clock: clock || null,
      build: String(env.APP_BUILD || "dev"),
    });
  }

  if (url.pathname === "/api/brain") {
    // Brain OS Phases 5-6: records the brain ALREADY computes (decision engine + monetization
    // dashboard). Lazy: the Mini App only requests it when opening the Brain tab (doesn't touch /api/state).
    // v2: plus, ALL Brain OS records per channel (scores/A-B/alerts/bank/report/crosscheck)
    // + hypotheses and global hooks. All in parallel; each file is optional (null if it doesn't exist).
    const dl = (f) => `channel/${f}`, od = (f) => `channel/auto2/${f}`, br = (f) => `channel/brain/${f}`;
    const keys = [
      br("decision.json"), br("monetization_report.json"), od("queue.json"), br("hypotheses.json"), br("hooks.json"),
      dl("scores.json"), dl("ab_tests.json"), dl("alerts.json"), br("creative_bank.json"), br("experiment_report.json"), dl("cross_validation.json"),
      od("scores.json"), od("ab_tests.json"), od("alerts.json"), od("creative_bank.json"), od("experiment_report.json"), od("cross_validation.json"),
      // Live Brain (audit): today/tomorrow lineup, journal, decision ledger and YPP metrics per window.
      od("lineup.json"), br("journal.json"), br("ledger.json"), od("ypp.json"), dl("ypp.json"),
    ];
    const v = await Promise.all(keys.map((k) => r2json(env, k)));
    const N = (x) => x || null;
    return json({
      live: N(v[17]), journal: Array.isArray(v[18]) ? v[18].slice(-60) : [], ledger: Array.isArray(v[19]) ? v[19].slice(-40) : [],
      ypp: { "auto2": N(v[20]), "data-lens": N(v[21]) },
      decision: N(v[0]), monetization: N(v[1]), queue: N(v[2]), hypotheses: v[3] || [], hooks: N(v[4]),
      ch: {
        "data-lens": { scores: N(v[5]), ab: N(v[6]), alerts: N(v[7]), bank: N(v[8]), report: N(v[9]), cross: N(v[10]) },
        "auto2": { scores: N(v[11]), ab: N(v[12]), alerts: N(v[13]), bank: N(v[14]), report: N(v[15]), cross: N(v[16]) },
      },
    });
  }

  if (url.pathname === "/api/error-detail") {
    // Brings the EXACT ERROR (last lines of the failed step's log) to view in the app.
    const runId = url.searchParams.get("run") || "";
    if (!/^\d+$/.test(runId)) return json({ error: "invalid run    "}, 400);
    try {
      const jr = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs/${runId}/jobs`);
      if (!jr.ok) return json({ detail: "Could not read the run.    "});
      const jobs = (await jr.json()).jobs || [];
      // Job that broke: failed, or cancelled (timeout), or the last non-successful.
      const job = jobs.find((j) => j.conclusion === "failure") || jobs.find((j) => j.conclusion === "cancelled")
        || jobs.filter((j) => j.conclusion && j.conclusion !== "success").pop();
      if (!job) return json({ detail: "No step with an error found in that run. Open the full log on GitHub (↗).    "});
      const failedStep = (job.steps || []).find((s) => s.conclusion === "failure") || (job.steps || []).find((s) => s.conclusion === "cancelled");
      const lr = await fetch(`https://api.github.com/repos/${env.GH_REPO}/actions/jobs/${job.id}/logs`, { headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "video-forge    "}, redirect: "follow    "});
      if (!lr.ok) return json({ detail: `Could not read the inline log (HTTP ${lr.status}${lr.status === 410 ? " — the log already expired on GitHub" : ""}). Open the full log with ↗.`, step: (failedStep && failedStep.name) || job.name });
      const text = await lr.text();
      const lines = text.split("\n").map((l) => l.replace(/^\S+\s/, "")).filter((l) => l.trim());
      const tail = lines.slice(-45).join("\n").slice(-2800);
      return json({ detail: tail || "(empty log) — open the full one with ↗.", step: (failedStep && failedStep.name) || job.name });
    } catch (e) { return json({ detail: "Error reading the detail: " + e.message }); }
  }

  if (url.pathname === "/api/schedule" && request.method === "POST") {
    // Schedules the video at the NEXT best free hour (US). YouTube publishes it on its own at that hour.
    let body = {}; try { body = await request.json(); } catch {}
    let vid = body.video_id;
    const isProductionVideo = !vid; // no video_id in the body = the PRODUCTION video (active slot). With video_id = a SHORT or another one.
    if (!vid) { try { const ido = await env.R2.get("video/0001-youtube-money/video_id.txt"); if (ido) vid = (await ido.text()).trim(); } catch {} }
    if (!vid || !/^[A-Za-z0-9_-]{6,20}$/.test(vid)) return json({ error: "video not found to schedule    "}, 400);
    const res = await doSchedule(env, vid, isProductionVideo);
    if (!res.ok) return json({ error: res.error || "could not schedule    "}, 500);
    return json({ ok: true, publish_at: res.publish_at });
  }

  if (url.pathname === "/api/approve" && request.method === "POST") {
    // Approve the description/SEO AND schedule the video at the next best hour (US), in a single tap.
    const pkg = await r2json(env, "video/0001-youtube-money/package.json");
    const title = pkg ? pkg.title || "" : "";
    await env.R2.put("video/0001-youtube-money/seo_approved.json",
      JSON.stringify({ approved: true, title, at: new Date().toISOString() }),
      { httpMetadata: { contentType: "application/json    "} });
    // Take the video from the active slot and schedule it automatically at the best hour.
    let vid = null;
    try { const ido = await env.R2.get("video/0001-youtube-money/video_id.txt"); if (ido) vid = (await ido.text()).trim(); } catch {}
    if (vid && /^[A-Za-z0-9_-]{6,20}$/.test(vid)) {
      const res = await doSchedule(env, vid, true);
      return json({ ok: true, title, scheduled: res.ok, publish_at: res.publish_at || null, schedule_error: res.ok ? null : (res.error || "could not schedule") });
    }
    return json({ ok: true, title, scheduled: false });
  }

  if (url.pathname === "/api/voice" && request.method === "POST") {
    // Choose the channel voice (used in the next production).
    let body = {};
    try { body = await request.json(); } catch {}
    const opt = VOICE_OPTIONS.find((v) => v.id === body.id);
    if (!opt) return json({ error: "unknown voice    "}, 400);
    await env.R2.put("channel/voice_choice.json", JSON.stringify({ id: opt.id, engine: opt.engine, kvoice: opt.kvoice, label: opt.label }), { httpMetadata: { contentType: "application/json    "} });
    return json({ ok: true, label: opt.label });
  }

  if (url.pathname === "/api/oddly-publish" && request.method === "POST") {
    // Schedule/publish an Oddly Loop video WITH a durable marker, so it does NOT drop and
    // reappear as "to review" while the report (2h) refreshes the inventory. Writes
    // channel/auto2/pending_sched.json (read live by /api/state) -> the video shows "🕒 Scheduling…"
    // until it's actually scheduled/public, or until it's cleaned by failure/TTL.
    let body = {}; try { body = await request.json(); } catch {}
    const vid = String(body.video_id || "");
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(vid)) return json({ error: "invalid video_id    "}, 400);
    const cur = (await r2json(env, "channel/auto2/pending_sched.json")) || [];
    // clear=true -> remove the marker (the client calls it when the workflow FAILS: back to "to review").
    if (body.clear) {
      const kept = cur.filter((p) => p && p.video_id !== vid);
      await env.R2.put("channel/auto2/pending_sched.json", JSON.stringify(kept), { httpMetadata: { contentType: "application/json    "} });
      return json({ ok: true, cleared: true });
    }
    const mode = body.mode === "public" ? "public" : "schedule";
    const r = await ghDispatch(env, "publish_oddly.yml", { video_id: vid, mode });
    if (!r.ok) return json({ ok: false, error: r.error || "could not    "});
    const rec = { video_id: vid, mode, at: new Date().toISOString() };
    const merged = [...cur.filter((p) => p && p.video_id !== vid), rec];
    await env.R2.put("channel/auto2/pending_sched.json", JSON.stringify(merged), { httpMetadata: { contentType: "application/json    "} });
    return json({ ok: true, mode });
  }

  if (url.pathname === "/api/oddly-manual" && request.method === "POST") {
    // Marks/unmarks an Oddly video as "mine" (manual) -> painted PURPLE in the calendar.
    // Toggle on channel/auto2/manual_videos.json. /api/state re-reads that file live,
    // so the color changes instantly (without waiting for the 2h report).
    let body = {}; try { body = await request.json(); } catch {}
    const vid = String(body.video_id || "");
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(vid)) return json({ error: "invalid video_id    "}, 400);
    const cur = (await r2json(env, "channel/auto2/manual_videos.json")) || [];
    const set = new Set(cur);
    let manual;
    if (set.has(vid)) { set.delete(vid); manual = false; } else { set.add(vid); manual = true; }
    await env.R2.put("channel/auto2/manual_videos.json", JSON.stringify([...set]), { httpMetadata: { contentType: "application/json    "} });
    return json({ ok: true, manual });
  }

  if (url.pathname === "/api/thumb-approve" && request.method === "POST") {
    // Step 1: APPROVE the thumbnail (marks it, does NOT put it on YouTube yet).
    let body = {};
    try { body = await request.json(); } catch {}
    const vid = String(body.video_id || "");
    if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) return json({ error: "invalid video_id    "}, 400);
    const db = (await r2json(env, "channel/videos.json")) || {};
    const e = db[vid] || { stages: {} };
    e.stages = e.stages || {};
    e.stages.thumb_approved = true;
    e.updated_at = new Date().toISOString();
    db[vid] = e;
    await env.R2.put("channel/videos.json", JSON.stringify(db, null, 2), { httpMetadata: { contentType: "application/json    "} });
    return json({ ok: true });
  }

  if (url.pathname === "/api/short" && request.method === "POST") {
    // Approve or skip a proposed short (updates the plan in R2), from the app.
    let body = {};
    try { body = await request.json(); } catch {}
    const n = Number(body.n);
    if (!Number.isInteger(n) || !["approve", "skip"].includes(body.action)) return json({ error: "invalid parameters    "}, 400);
    const ok = await markShort(env, n, body.action === "approve");
    return json({ ok });
  }

  if (url.pathname === "/api/dispatch" && request.method === "POST") {
    let body = {};
    try { body = await request.json(); } catch {}
    if (!APP_WORKFLOWS.has(body.workflow)) return json({ error: "workflow not allowed    "}, 400);
    // Validate the shape of known inputs (defense in depth).
    const inputs = body.inputs || {};
    if (inputs.video_id != null && !/^[A-Za-z0-9_-]{11}$/.test(String(inputs.video_id))) return json({ error: "invalid video_id    "}, 400);
    if (inputs.privacy != null && !["public", "private", "unlisted"].includes(String(inputs.privacy))) return json({ error: "invalid privacy    "}, 400);
    if (inputs.n != null && !/^\d{1,4}$/.test(String(inputs.n))) return json({ error: "invalid n    "}, 400);
    if (inputs.notes != null) inputs.notes = String(inputs.notes).slice(0, 500);
    if (inputs.topic != null) inputs.topic = String(inputs.topic).slice(0, 300);
    if (inputs.niche != null && !["satisfying", "narrativas", "ciencia_humor", "naturaleza_relax"].includes(String(inputs.niche))) return json({ error: "invalid niche    "}, 400);
    if (inputs.variant != null && !["puro", "narrado"].includes(String(inputs.variant))) return json({ error: "invalid variant    "}, 400);
    if (inputs.kind != null && !["video", "short"].includes(String(inputs.kind))) return json({ error: "invalid kind    "}, 400);
    if (inputs.format != null && !["16:9", "9:16"].includes(String(inputs.format))) return json({ error: "invalid format    "}, 400);
    if (inputs.mode != null && !["schedule", "public"].includes(String(inputs.mode))) return json({ error: "invalid mode    "}, 400);
    const r = await ghDispatch(env, body.workflow, inputs);
    return json({ ok: r.ok, status: r.status });
  }

  if (url.pathname === "/api/upload" && request.method === "POST") {
    let form;
    try { form = await request.formData(); } catch { return json({ error: "invalid body (expected multipart)    "}, 400); }
    const kind = form.get("kind");
    if (kind === "photo") {
      const f = form.get("file");
      if (!f) return json({ error: "no file    "}, 400);
      await env.R2.put(editKey(chatId, "source"), new Uint8Array(await f.arrayBuffer()), { httpMetadata: { contentType: "image/jpeg    "} });
      const { mode, prompt } = parseEdit(form.get("prompt") || "");
      const r = await ghDispatch(env, "photo_edit.yml", { chat_id: String(chatId), mode, prompt: prompt || "", strength: "suave    "});
      await putEditState(env, chatId, { awaiting: false, mode, prompt, strength: "suave    "});
      return json({ ok: r.ok });
    }
    if (kind === "voice") {
      const f = form.get("file");
      if (!f) return json({ error: "no file    "}, 400);
      const slug = slugifyVoice(form.get("name") || "voice");
      await env.R2.put(`voice/ref_${slug}.mp3`, new Uint8Array(await f.arrayBuffer()), { httpMetadata: { contentType: "audio/mpeg    "} });
      const reg = (await r2json(env, "voice/registry.json")) || {};
      reg[slug] = { label: form.get("name") || slug, key: `voice/ref_${slug}.mp3` };
      await env.R2.put("voice/registry.json", JSON.stringify(reg), { httpMetadata: { contentType: "application/json    "} });
      return json({ ok: true });
    }
    if (kind === "recipe") {
      const files = form.getAll("file");
      if (!files.length) return json({ error: "no files    "}, 400);
      let n = 0;
      for (const f of files) {
        const idx = String(n).padStart(3, "0");
        const ext = (f.type || "").startsWith("video") ? "mp4" : "jpg";
        await env.R2.put(recipeKey(chatId, `media/${idx}.${ext}`), new Uint8Array(await f.arrayBuffer()), { httpMetadata: { contentType: f.type || "image/jpeg    "} });
        n++;
      }
      const text = form.get("text") || "";
      if (text) await env.R2.put(recipeKey(chatId, "text"), text, { httpMetadata: { contentType: "text/plain; charset=utf-8    "} });
      await setRecipeState(env, chatId, { active: false, n });
      const r = await ghDispatch(env, "recipe_reel.yml", { chat_id: String(chatId), count: String(n) });
      return json({ ok: r.ok });
    }
    return json({ error: "unknown kind    "}, 400);
  }

  // "My Clips": Juan uploads a clip from the Mini App -> saved to R2 (streamed, no
  // buffer) and triggers subir_manual.yml (AI SEO + upload to Oddly + schedule + playlist).
  // The body IS the raw video (not multipart) to avoid loading it into Worker memory.
  if (url.pathname === "/api/upload-clip" && request.method === "POST") {
    const ct = request.headers.get("content-type") || "";
    if (!/^video\//.test(ct)) return json({ error: "the file must be a video    "}, 400);
    const size = +(request.headers.get("content-length") || 0);
    if (!size) return json({ error: "could not measure the video size; retry the upload    "}, 411);
    if (size > 100 * 1024 * 1024) return json({ error: "The clip exceeds ~100MB (uploader limit for now). Trim it or lower the quality.    "}, 413);
    if (!request.body) return json({ error: "no video    "}, 400);
    const cid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = `clipper/manual/${cid}.mp4`;
    await env.R2.put(key, request.body, { httpMetadata: { contentType: ct } });
    const caption = (url.searchParams.get("caption") || "").slice(0, 300);
    const r = await ghDispatch(env, "subir_manual.yml", { r2_key: key, caption });
    return json({ ok: r.ok, cid });
  }

  return json({ error: "route not found    "}, 404);
}

// Queries YouTube for the REAL status (privacy + views) of several videos by id.
async function ytStatus(env, ids) {
  ids = [...new Set((ids || []).filter(Boolean))];
  if (!ids.length || !env.YT_REFRESH_TOKEN) return {};
  try {
    const token = await ytToken(env); // cached token (avoids requesting it twice per request)
    if (!token) return {};
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status,statistics&id=${ids.join(",")}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const out = {};
    for (const it of j.items || []) out[it.id] = {
      privacy: it.status && it.status.privacyStatus,
      views: +((it.statistics && it.statistics.viewCount) || 0),
      likes: +((it.statistics && it.statistics.likeCount) || 0),
    };
    return out;
  } catch { return {}; }
}

// ISO8601 duration (PT#M#S) -> seconds.
function isoDurSec(d) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || "") || [];
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}
// YouTube OAuth token (refresh). Cached in memory ~50 min: several functions (ytStatus,
// channelInventory) share it within the same request (and across requests of the same isolate)
// -> the token is not requested twice per app refresh.
let _ytTok = { token: null, exp: 0 };
async function ytToken(env) {
  if (!env.YT_REFRESH_TOKEN) return null;
  if (_ytTok.token && Date.now() < _ytTok.exp) return _ytTok.token;
  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded    "},
      body: new URLSearchParams({ client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: "refresh_token    "}),
      signal: AbortSignal.timeout(6000),
    });
    const tj = await tr.json();
    if (tj.access_token) { _ytTok = { token: tj.access_token, exp: Date.now() + 50 * 60 * 1000 }; return tj.access_token; }
    return null;
  } catch { return null; }
}
// REAL channel inventory (longs vs shorts) + subs/views. Cached 10 min in R2 to
// avoid spending YouTube quota on every app refresh. The list updates itself.
async function channelInventory(env) {
  const cached = await r2json(env, "channel/inventory_cache.json");
  if (cached && cached.at && (Date.now() - Date.parse(cached.at) < 10 * 60 * 1000)) return cached;
  const token = await ytToken(env);
  if (!token) return cached || { longs: [], shorts: [], subs: 0, total_views: 0, at: null, stale: true };
  const H = { Authorization: `Bearer ${token}` };
  try {
    const ch = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&mine=true", { headers: H })).json();
    const item = ch.items && ch.items[0];
    const up = item && item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;
    if (!up) return cached || { longs: [], shorts: [], subs: 0, total_views: 0, at: null, stale: true };
    let ids = [], page = "";
    do {
      const j = await (await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json();
      ids.push(...(j.items || []).map((i) => i.contentDetails.videoId));
      page = j.nextPageToken || "";
    } while (page && ids.length < 200);
    const longs = [], shorts = [];
    for (let i = 0; i < ids.length; i += 50) {
      const j = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics,contentDetails&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
      for (const v of j.items || []) {
        const secs = isoDurSec(v.contentDetails.duration);
        const st = v.status || {};
        const row = { video_id: v.id, title: v.snippet.title, privacy: st.privacyStatus, publish_at: st.publishAt || null, published_at: v.snippet.publishedAt.slice(0, 10), views: +((v.statistics || {}).viewCount || 0), likes: +((v.statistics || {}).likeCount || 0), seconds: secs, upload_status: st.uploadStatus || null, rejection_reason: st.rejectionReason || null };
        if (secs > 0 && secs <= 90) shorts.push(row); else longs.push(row); // <=90s: covers Shorts that go a bit over 60s
      }
    }
    longs.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
    shorts.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
    // WATCH time per video (minutes watched) — Analytics API (requires yt-analytics scope).
    let analyticsOk = false, analytics = null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const start28 = new Date(Date.now() - 28 * 86400 * 1000).toISOString().slice(0, 10);
      const a = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=${today}&metrics=estimatedMinutesWatched,averageViewDuration&dimensions=video&sort=-estimatedMinutesWatched&maxResults=200`, { headers: H });
      if (a.ok) {
        const aj = await a.json();
        analyticsOk = true;
        const wm = {};
        for (const row of aj.rows || []) wm[row[0]] = { watch_min: Math.round(row[1] || 0), avg_sec: Math.round(row[2] || 0) };
        for (const v of longs) { const w = wm[v.video_id] || {}; v.watch_min = w.watch_min || 0; v.avg_sec = w.avg_sec || 0; }
        for (const v of shorts) { const w = wm[v.video_id] || {}; v.watch_min = w.watch_min || 0; v.avg_sec = w.avg_sec || 0; }
        // Totals + daily series of the last 28 days (for the analytics dashboard).
        try {
          const [totRes, dayRes] = await Promise.all([
            fetch(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start28}&endDate=${today}&metrics=views,estimatedMinutesWatched,subscribersGained,averageViewDuration`, { headers: H }),
            fetch(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start28}&endDate=${today}&dimensions=day&metrics=views,estimatedMinutesWatched&sort=day`, { headers: H }),
          ]);
          const tj2 = totRes.ok ? await totRes.json() : null;
          const dj = dayRes.ok ? await dayRes.json() : null;
          const tr2 = (tj2 && tj2.rows && tj2.rows[0]) || [];
          analytics = {
            last28: { views: tr2[0] || 0, minutes: Math.round(tr2[1] || 0), subs_gained: tr2[2] || 0, avg_sec: Math.round(tr2[3] || 0) },
            daily: ((dj && dj.rows) || []).map((r) => ({ d: r[0], views: r[1] || 0, min: Math.round(r[2] || 0) })),
          };
        } catch {}
      }
    } catch {}
    // Generated thumbnail (for the app) — resolved ONCE here (cached 10 min), NOT on every /api/state.
    // Before, this was 1 R2.head per video on EVERY request -> blew the subrequest limit as the channel grew.
    for (const v of longs) {
      try { const th = await env.R2.head(`video/0001-youtube-money/thumb_${v.video_id}.jpg`); v.thumb_url = th ? `/watch/video/0001-youtube-money/thumb_${v.video_id}.jpg?t=${await watchToken(env, `video/0001-youtube-money/thumb_${v.video_id}.jpg`)}` : null; } catch { v.thumb_url = null; }
    }
    const inv = { longs, shorts, subs: +(((item.statistics || {}).subscriberCount) || 0), total_views: +(((item.statistics || {}).viewCount) || 0), analytics_ok: analyticsOk, analytics, at: new Date().toISOString() };
    await env.R2.put("channel/inventory_cache.json", JSON.stringify(inv), { httpMetadata: { contentType: "application/json    "} });
    return inv;
  } catch { return cached || { longs: [], shorts: [], subs: 0, total_views: 0, at: null, stale: true }; }
}

// Reads a JSON from R2 (or null). Resilient: an R2 network blip returns null, doesn't kill /api/state.
// SUBCATEGORY of The Data Lens (inferred from the title) — SAME logic as pipeline/manage_playlists.mjs,
// so the app badge and the YouTube playlist match.
function dlNiche(t) { t = (t || "").toLowerCase();
  if (/1 ?million|1,000,000|views? (pay|pays)|per view|creator|youtuber|\breels?\b|tiktok|spotify|roblox|devex|payout|monetiz/.test(t)) return "creator_economy";
  if (/where your|actually goes|hidden|really costs|\bcut\b|dirty|\bscam\b|\btax\b|\$\d/.test(t)) return "costos_ocultos";
  if (/inflation|interest rate|\bfed\b|\bmarket\b|\beconomy\b|every second|money supply|recession/.test(t)) return "dinero_mercados";
  if (/google|netflix|mcdonald|apple|amazon|uber|tesla|microsoft|openai|\bmeta\b|snapchat|instagram|nvidia|disney|costco|how .* makes/.test(t)) return "big_tech";
  return "big_tech"; }
const DL_LABEL = { big_tech: "Big Tech", creator_economy: "Creator Economy", costos_ocultos: "Hidden Costs", dinero_mercados: "Money & Markets    "};
const dlLabel = (title) => DL_LABEL[dlNiche(title)];

// ===== MONETIZATION GOALS (YPP) — realistic deadline per channel, measured DAY BY DAY =====
// Each channel its goal according to its focus. Editable here. The pace is measured with the last 7 days
// of snapshots (channel/…/monetization_history.json) to know if we're on track or behind.
// AUDIT BR-01/02: this is only a REFERENCE of totals for the classic app. The real YouTube Partner Program
// requirements per window (Shorts 90 days, non-Shorts hours 365 days) are measured by ypp_metrics.mjs and
// shown by v2 from monetization_report.json. No more made-up goals here (likes / 200k views).
const MONET_GOALS = {
  "data-lens": { path: "longform", deadline: "2026-12-31", targets: [
    { key: "subs", label: "Subscribers", target: 1000 },
    { key: "watch_hours", label: "Total watch hours (reference, not the 365-day window)", target: 4000 },
  ] },
  "auto2": { path: "shorts", deadline: "2026-12-31", targets: [
    { key: "subs", label: "Subscribers", target: 1000 },
    { key: "total_views", label: "Total views (reference, not the 90-day Shorts views)", target: 10000000 },
  ] },
};
async function monetTrack(env, chKey, current) {
  const goal = MONET_GOALS[chKey]; if (!goal) return null;
  const hkey = chKey === "auto2" ? "channel/auto2/monetization_history.json" : "channel/monetization_history.json";
  let hist = (await r2json(env, hkey)) || []; if (!Array.isArray(hist)) hist = [];
  const today = new Date().toISOString().slice(0, 10);
  const snap = { date: today };
  goal.targets.forEach((t) => { snap[t.key] = Math.round(current[t.key] || 0); });
  // One snapshot per day (idempotent): if the last one is from today it refreshes it, otherwise it appends.
  const last = hist.length ? hist[hist.length - 1] : null;
  // PERF: if today's snapshot is already saved IDENTICAL, DON'T rewrite R2 (avoids an R2.put of ~700ms per load).
  const unchanged = last && last.date === today && goal.targets.every((t) => last[t.key] === snap[t.key]);
  if (last && last.date === today) hist[hist.length - 1] = snap; else hist.push(snap);
  hist = hist.slice(-120);
  if (!unchanged) { try { await env.R2.put(hkey, JSON.stringify(hist), { httpMetadata: { contentType: "application/json    "} }); } catch {} }
  const daysLeft = Math.max(0, Math.ceil((Date.parse(goal.deadline) - Date.now()) / 86400000));
  const win = hist.filter((h) => (Date.parse(today) - Date.parse(h.date)) / 86400000 <= 7);
  const reqs = goal.targets.map((t) => {
    const cur = Math.round(current[t.key] || 0);
    const need = Math.max(0, t.target - cur);
    const pctv = Math.min(100, Math.floor((cur / t.target) * 100));
    const perDayNeeded = daysLeft > 0 ? need / daysLeft : need;
    let perDayActual = null, projDate = null;
    if (win.length >= 2) { const a = win[0], b = win[win.length - 1]; const dd = (Date.parse(b.date) - Date.parse(a.date)) / 86400000; if (dd > 0) perDayActual = ((b[t.key] || 0) - (a[t.key] || 0)) / dd; }
    if (perDayActual > 0 && need > 0) projDate = new Date(Date.now() + Math.ceil(need / perDayActual) * 86400000).toISOString().slice(0, 10);
    const done = cur >= t.target;
    const onTrack = done ? true : (perDayActual == null ? null : perDayActual >= perDayNeeded);
    return { key: t.key, label: t.label, cur, target: t.target, pct: pctv, per_day_needed: Math.max(0, perDayNeeded), per_day_actual: perDayActual, proj_date: projDate, on_track: onTrack, done };
  });
  const allDone = reqs.every((r) => r.done);
  const measuring = reqs.some((r) => !r.done && r.on_track === null);
  const behind = reqs.some((r) => !r.done && r.on_track === false);
  return { path: goal.path, deadline: goal.deadline, days_left: daysLeft, status: allDone ? "done" : measuring ? "measuring" : behind ? "behind" : "ontrack", reqs };
}
async function r2json(env, key) {
  if (!env.R2) return null;
  try { const o = await env.R2.get(key); if (!o) return null; return JSON.parse(await o.text()); } catch { return null; }
}

// R2 storage usage (to stay under the free 10 GB limit). Cached 6h: it changes slowly and the
// list() loop consumes subrequests -> recalculated a few times a day, not on every app refresh.
async function r2Usage(env) {
  const cached = await r2json(env, "channel/r2usage.json");
  if (cached && cached.at && (Date.now() - Date.parse(cached.at) < 6 * 60 * 60 * 1000)) return cached;
  if (!env.R2) return cached || { bytes: 0, count: 0, at: null };
  try {
    let bytes = 0, count = 0, cursor, guard = 0;
    do {
      const res = await env.R2.list({ limit: 1000, cursor });
      for (const o of res.objects || []) { bytes += o.size || 0; count++; }
      cursor = res.truncated ? res.cursor : undefined;
    } while (cursor && ++guard < 12);
    const usage = { bytes, count, at: new Date().toISOString() };
    await env.R2.put("channel/r2usage.json", JSON.stringify(usage), { httpMetadata: { contentType: "application/json    "} });
    return usage;
  } catch { return cached || { bytes: 0, count: 0, at: null }; }
}

// ---------- Message handling ----------

async function handleMessage(message, env) {
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();

  // /id works for anyone: helps Juan find out his chat id.
  if (text === "/id") {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: `Your chat id is: ${chatId}\nSet it as the OWNER_CHAT_ID secret.`,
    });
  }

  // From here on, owner only.
  if (!isOwner(chatId, env)) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "Unauthorized. This bot is private.",
    });
  }

  // AI OS in one bot: store commands and shortcuts to the brain and Radar.
  {
    // No lookbehind regex (CodeQL ReDoS): first token and no "@bot".
    const first = ((text.split(" ")[0] || "").split("\n")[0] || "").toLowerCase();
    const atPos = first.indexOf("@");
    const c0 = atPos >= 0 ? first.slice(0, atPos) : first;
    if (env.VIENTO && ["/pedidos", "/pautas", "/fases", "/analiza", "/creativo", "/tienda"].includes(c0)) {
      const t2 = c0 === "/tienda" ? "/estado" + text.slice(first.length) : text;
      await env.VIENTO.fetch(new Request("https://os.internal/api/tg", { method: "POST", headers: { "content-type": "application/json    "}, body: JSON.stringify({ message: { ...message, text: t2 } }) }));
      return;
    }
    if (c0 === "/radar" || c0 === "/cerebro" || c0 === "/os") {
      const isRadar = c0 === "/radar";
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: isRadar ? "📡 Radar: your repos, improvements and PRs ready to review." : "🧠 The Brain: what it decided, why, and what's coming.",
        reply_markup: { inline_keyboard: [[{ text: isRadar ? "📡 Open Radar" : "🧠 Open the Brain", web_app: { url: "https://video-forge-bot.tienvo.workers.dev" + (isRadar ? "/p/radar?from=os" : "/os") } }]] },
      });

    }
  }

  // Phase 8 — RECIPE MODE: if collecting a recipe, EVERYTHING (photos/videos/text) goes to
  // the RECIPE (in order), NOT to the retouch. Exit with /listo (builds the reel) or /cancelar.
  {
    const rs = await getRecipeState(env, chatId);
    if (rs && rs.active) {
      const t = (message.text || "").trim();
      if (t === "/cancelar") return recipeCancel(env, chatId);
      if (t === "/listo") return recipeBuild(env, chatId, rs);
      if (Array.isArray(message.photo) && message.photo.length) return recipeAddMedia(message, env, chatId, rs, "photo");
      if (message.video) return recipeAddMedia(message, env, chatId, rs, "video");
      if (t && !t.startsWith("/")) return recipeAddText(env, chatId, rs, t);
      return tg(env, "sendMessage", { chat_id: chatId, text: "🍳 Recipe mode. Send photos/videos + the text. When done: /done (or /cancel).    "});
    }
  }

  // Phase 7: if you send a PHOTO, it goes to the image editor.
  if (Array.isArray(message.photo) && message.photo.length) {
    return handlePhotoEdit(message, env, chatId);
  }

  // Phase 8: if you send an AUDIO / voice note, it registers as a selectable voice.
  if (message.voice || message.audio) {
    return handleVoiceRegister(message, env, chatId);
  }

  // Menu buttons (reply keyboard) -> equivalent command.
  const BTN = {
    "🎙️ Generate voice": "/voz",
    "🎬 Render": "/render",
    "📊 Status": "/status",
    "🆕 New video": "/nuevo",
    "❓ Help": "/help",
    "🏠 Menu": "/start",
  };
  const line = BTN[text] || text;
  const [cmd, ...rest] = line.split(/\s+/);
  const arg = rest.join(" ").trim();

  // Phase 8: if it's waiting for the NAME of a just-sent voice, the text is the name.
  if (cmd && !cmd.startsWith("/") && !(text in BTN) && env.R2) {
    const vpend = await env.R2.get(`voice/pending/${chatId}.json`);
    if (vpend) return finalizeVoice(env, chatId, line);
  }

  // Phase 7: if there's a photo in edit waiting for the "what to change", the text is the instruction.
  if (cmd && !cmd.startsWith("/") && !(text in BTN)) {
    const st = await getEditState(env, chatId);
    if (st && st.awaiting && env.R2 && (await env.R2.get(editKey(chatId, "source")))) {
      const { mode, prompt } = parseEdit(line);
      return dispatchEdit(env, chatId, mode, prompt);
    }
  }

  switch ((cmd || "").toLowerCase()) {
    case "/start":
    case "/help":
      return sendMenu(env, chatId);

    case "/nuevo": {
      // The full pipeline (topic -> script -> voice -> render) is under construction.
      // For now we make clear it doesn't make the video alone yet.
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text:
          "🚧 /new (automatic full video) is under construction.\n\n" +
          "For now we make the videos step by step:\n" +
          "🎙️ /voz — generate the narration\n" +
          "🎬 /render — render the video\n" +
          "📊 /status — see the progress",
      });

    }

    case "/render": {
      if (await busyGuard(env, chatId)) return;
      // By phases: each ~3 min segment passes its test (7.5) and at the end they're joined.
      const r = await ghDispatch(env, "render_phased.yml", {});
      return ack(env, chatId, r, "Phased render (each segment passes the test, then they're joined)");
    }

    case "/voz": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "voice_parallel.yml", {});
      return ack(env, chatId, r, "Voice generation (fast, in parallel)");
    }

    case "/estado":
      return sendStatus(env, chatId);

    case "/receta":
      return recipeStart(env, chatId);

    case "/panel":
    case "/canal":
      return sendPanel(env, chatId);

    case "/reporte": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "channel_report.yml", {});
      return ack(env, chatId, r, "Channel report (fresh YouTube metrics)");
    }

    case "/shorts": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "shorts_plan.yml", {});
      return ack(env, chatId, r, "Shorts analysis (the AI suggests how many and which)");
    }

    case "/generarshorts": {
      if (await busyGuard(env, chatId)) return;
      const napp = await countApprovedShorts(env);
      if (!napp) return tg(env, "sendMessage", { chat_id: chatId, text: "No approved shorts yet. Run /shorts, approve the ones you want, then /generarshorts.    "});
      // FINAL pipeline: announcer voice + karaoke + logo + music (native vertical).
      const r = await ghDispatch(env, "shorts_final.yml", {});
      return ack(env, chatId, r, `Generating ${napp} final short(s) — voice+karaoke+logo+music`);
    }

    case "/listo":
      // Only makes sense in recipe mode; if it arrives here there was no active recipe.
      return tg(env, "sendMessage", { chat_id: chatId, text: "No active recipe. Start with /receta.    "});

    default:
      return sendMenu(env, chatId);
  }
}

async function handleCallback(cb, env) {
  const chatId = cb.message?.chat?.id;
  const data = cb.data || "";
  if (!isOwner(chatId, env)) {
    return tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "Unauthorized    "});
  }
  // Store buttons (arrive with "v:" prefix): the store resolves them via the internal channel and responds itself.
  if (data.startsWith("v:") && env.VIENTO) {
    await env.VIENTO.fetch(new Request("https://os.internal/api/tg", { method: "POST", headers: { "content-type": "application/json    "}, body: JSON.stringify({ callback_query: { ...cb, data: data.slice(2) } }) }));
    return;
  }
  // Dismisses the button's hourglass immediately.
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });

  // Menu/submenu navigation (edits the same message).
  if (data === "home" || data === "menu:home") return showMenu(env, cb, "home");
  if (data === "menu:video") return showMenu(env, cb, "video");
  if (data === "menu:channel") return showMenu(env, cb, "channel");
  if (data === "menu:photo") return showMenu(env, cb, "photo");
  if (data === "menu:voices") return showMenu(env, cb, "voices");
  if (data === "menu:recipes") return showMenu(env, cb, "recipes");
  if (data === "menu:help") return showMenu(env, cb, "help");
  if (data === "voces:list") return listVoices(env, cb);
  // ---- Review-Before-Upload: motion graphics buttons (vf:review:...) ----
  // approve -> review_publish.yml (YouTube + AtoPlay) · discard -> review_discard.yml
  // (discard NEVER touches YouTube: zero quota spent).
  if (data.startsWith("vf:review:")) return handleReviewAction(env, cb, data.slice("vf:review:".length));

  switch (data) {
    case "voz": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "voice_parallel.yml", {});
      return ack(env, chatId, r, "Voice generation (in parallel)");
    }
    case "render": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "render_phased.yml", {});
      return ack(env, chatId, r, "Render in phases (each stretch passes the gate, then they are joined)");
    }
    case "estado":
      return sendStatus(env, chatId);
    case "receta":
      return recipeStart(env, chatId);
    case "panel":
      return sendPanel(env, chatId);
    case "reporte": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "channel_report.yml", {});
      return ack(env, chatId, r, "Channel report (fresh YouTube metrics)");
    }
    case "shorts_plan": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "shorts_plan.yml", {});
      return ack(env, chatId, r, "Shorts analysis (the AI suggests how many and which)");
    }
    case "nuevo":
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text:
          "🚧 Automatic full video: under construction.\n\n" +
          "For now, step by step: 🎙️ Generate voice · 🎬 Render · 📊 Status",
      });

    case "menu":
    case "help":
      return sendMenu(env, chatId);
    // ---- Phase 7: photo editor buttons ----
    case "edit_save": {
      // Storage rule: on finish, delete the SOURCE (the result was already delivered).
      if (env.R2) {
        await env.R2.delete(editKey(chatId, "source"));
        await env.R2.delete(editKey(chatId, "result"));
        await env.R2.delete(editKey(chatId, "state"));
      }
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✅ Done, saved. I deleted the original (you only keep the result I sent you). Send me another photo whenever you want.",
      });

    }
    case "edit_again":
      return reDispatchEdit(env, chatId);
    case "edit_softer":
      return reEditStrength(env, chatId, "suave");
    case "edit_stronger":
      return reEditStrength(env, chatId, "fuerte");
    case "edit_change": {
      const st = await getEditState(env, chatId);
      await putEditState(env, chatId, { awaiting: true, mode: (st && st.mode) || "retoque", prompt: (st && st.prompt) || "    "});
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✏️ Tell me the new change for the SAME photo (e.g.: 'white background', 'more light', 'cleaner skin').",
      });

    }

    // ---- SEO gate (Step 1): approve the publication or regenerate the SEO ----
    case "seo_regen": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "seo_regen.yml", {});
      return ack(env, chatId, r, "Regenerating the SEO (from the AI's comments)");
    }
    case "pub_ok": {
      return tg(env, "sendMessage", {
        chat_id: chatId,
        parse_mode: "Markdown",
        text:
          "✅ *Publication approved.* The video keeps this SEO on YouTube (private).\n\n" +
          "When you set it *Public* in Studio, the next step is the *Shorts*: the AI will tell you how many to make, from which moments and how long, and you approve them one by one.\n\n" +
          "🎬 Write /shorts when you want to start that.",
      });

    }

    default:
      // Approval buttons that bring the results (voice/video).
      if (data.startsWith("approve:")) {
        if (await busyGuard(env, chatId)) return;
        // Publish to YouTube as PRIVATE (so Juan reviews it before making it public).
        const r = await ghDispatch(env, "publish_youtube.yml", {});
        return ack(env, chatId, r, "Publishing to YouTube (private, for your review)");
      }
      if (data.startsWith("regen:")) {
        if (await busyGuard(env, chatId)) return;
        const r = await ghDispatch(env, "render_phased.yml", {});
        return ack(env, chatId, r, "Regenerating by phases");
      }
      if (data.startsWith("short_pub:")) {
        const vid = data.slice("short_pub:".length);
        const r = await ghDispatch(env, "set_privacy.yml", { video_id: vid, privacy: "public    "});
        return ack(env, chatId, r, `Publishing the short (${vid})`);
      }
      if (data.startsWith("short_keep:")) {
        return tg(env, "sendMessage", { chat_id: chatId, text: "⏸️ Done, that short stays private. You can publish it later.    "});
      }
      if (data.startsWith("short_ok:") || data.startsWith("short_no:")) {
        const n = parseInt(data.split(":")[1], 10);
        const approved = data.startsWith("short_ok:");
        const ok = await markShort(env, n, approved);
        return tg(env, "sendMessage", {
          chat_id: chatId,
          text: ok
            ? (approved ? `✅ Short #${n + 1} approved. When done, /buildshorts to assemble them.` : `❌ Short #${n + 1} skipped.`)
            : "Could not update the short (did you run /shorts first?).",
        });

      }
      if (data.startsWith("change:")) {
        return tg(env, "sendMessage", {
          chat_id: chatId,
          text:
            "✏️ What do you want to change? Tell me (e.g.: 'bigger subtitles', " +
            "'fewer numbers', 'another color') and I'll adjust it for the next version.",
        });

      }
      return;
  }
}

// ---------- Views ----------

// Two-level menu: home (sections) + one submenu per section. Direct and minimal.
const KB = {
  home: {
    inline_keyboard: [
      [{ text: "🧠 Open the Brain", web_app: { url: "https://video-forge-bot.tienvo.workers.dev/os    "} }],
      [{ text: "🎬 Channels", web_app: { url: "https://video-forge-bot.tienvo.workers.dev/p/video-forge?from=os    "} }, { text: "🛍️ Store", web_app: { url: "https://video-forge-bot.tienvo.workers.dev/p/viento?from=os    "} }, { text: "📡 Repos", web_app: { url: "https://video-forge-bot.tienvo.workers.dev/p/radar?from=os    "} }],
      [{ text: "🎬 Video", callback_data: "video    "}, { text: "📊 Channel", callback_data: "channel    "}],
      [{ text: "🖼️ Photo", callback_data: "photo    "}, { text: "🎤 Voices", callback_data: "voices    "}],
      [{ text: "🍳 Recipes", callback_data: "recipe    "}, { text: "❓ Help", callback_data: "help    "}],
    ],
  },
  canal: {
    inline_keyboard: [
      [{ text: "📋 View panel (schedule)", callback_data: "panel    "}],
      [{ text: "🔄 Fresh report (metrics)", callback_data: "reporte    "}],
      [{ text: "🎬 Suggest Shorts (AI)", callback_data: "shorts_plan    "}],
      [{ text: "⬅️ Back", callback_data: "home    "}],
    ],
  },
  video: {
    inline_keyboard: [
      [{ text: "🎙️ Generate voice", callback_data: "voz    "}],
      [{ text: "🎬 Render", callback_data: "render    "}],
      [{ text: "📊 Status", callback_data: "status    "}],
      [{ text: "⬅️ Back", callback_data: "home    "}],
    ],
  },
  foto: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "home    "}]] },
  voces: {
    inline_keyboard: [
      [{ text: "📋 View saved voices", callback_data: "voices:list    "}],
      [{ text: "⬅️ Back", callback_data: "home    "}],
    ],
  },
  recetas: {
    inline_keyboard: [
      [{ text: "🍳 New recipe", callback_data: "recipe    "}],
      [{ text: "⬅️ Back", callback_data: "home    "}],
    ],
  },
  ayuda: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "home    "}]] },
};

const TXT = {
  home: "*video-forge* — control center\n\nPick a section:",
  channel: "*📊 Channel — direction*\n\n📋 Panel — schedule of upcoming videos + monetization (live).\n🔄 Report — pulls fresh YouTube metrics (subs, views, likes).",
  video: "*🎬 Video*\n\n🎙️ Generate voice — channel narration, in your voice.\n🎬 Render — builds the video BY PHASES (each ~3 min segment passes the 7.5 test and they're joined at the end).\n📊 Status — what's being done now.",
  photo: "*🖼️ Photo*\n\nSend me a photo: I clean the skin and raise the texture, without changing your face (~5-7 min).\nFor the background, write *background ...* when you send it (e.g.: background white).",
  voces: "*🎤 Voices*\n\nSend me a voice note and I name it. Useful for narration (your voice or your wife's).",
  recipes: "*🍳 Recipes*\n\nSend me the *photos/videos* of your recipe (in the order you want the reel) + the *text* of the preparation. I improve your shots, complete what's missing with related clips/images, narrate in your voice, and add the step subtitles.\n\nTap *New recipe* to start.",
  help: "*❓ Help* — what you can do:\n\n• *Photo* → send it and I retouch it (skin/light/color, without changing your face).\n• *Voice note* → I save it with a name to narrate (your voice or your wife's).\n• *Video* → I generate the voice and render the channel video BY PHASES (each segment passes 7.5).\n• *Recipe* → /recipe, send photos/videos + the text and I build a 9:16 reel with voice and subtitles.\n\nEverything runs in the cloud; I'll notify here when it's done. Only you can use the bot.",
};

async function sendMenu(env, chatId) {
  // Telegram menu button that opens the Mini App (app-like interface).
  await tg(env, "setChatMenuButton", {
    chat_id: chatId,
    menu_button: { type: "web_app", text: "Brain", web_app: { url: "https://video-forge-bot.tienvo.workers.dev/os?v=" + encodeURIComponent(String(env.APP_BUILD || "dev")) } },
  });
  await tg(env, "setMyCommands", {
    commands: [
      { command: "start", description: "🏠 Menu    "},
      { command: "cerebro", description: "🧠 Open the Brain (AI OS)    "},
      { command: "tienda", description: "🛍️ Store status    "},
      { command: "pedidos", description: "🧾 Latest orders    "},
      { command: "pautas", description: "📣 Meta campaigns    "},
      { command: "radar", description: "📡 Repos and PRs    "},
      { command: "voz", description: "🎙️ Generate the narration    "},
      { command: "render", description: "🎬 Render the video (by phases)    "},
      { command: "receta", description: "🍳 Build a recipe reel    "},
      { command: "panel", description: "📊 Channel panel (schedule)    "},
      { command: "reporte", description: "🔄 Channel metrics report    "},
      { command: "shorts", description: "🎬 Suggest Shorts from the latest video    "},
      { command: "estado", description: "⏳ What's being done now    "},
    ],
  });
  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "Markdown",
    reply_markup: KB.home,
    text: TXT.home,
  });
}

// Changes the current message to the requested submenu (without opening a new message).
function showMenu(env, cb, key) {
  const k = KB[key] ? key : "home";
  return tg(env, "editMessageText", {
    chat_id: cb.message.chat.id,
    message_id: cb.message.message_id,
    parse_mode: "Markdown",
    reply_markup: KB[k],
    text: TXT[k],
  });
}

async function listVoices(env, cb) {
  let reg = {};
  if (env.R2) {
    const r = await env.R2.get("voice/registry.json");
    if (r) { try { reg = JSON.parse(await r.text()); } catch {} }
  }
  const names = Object.values(reg).map((v) => "• " + (v.label || "")).join("\n") || "_(none yet)_";
  return tg(env, "editMessageText", {
    chat_id: cb.message.chat.id,
    message_id: cb.message.message_id,
    parse_mode: "Markdown",
    reply_markup: KB.voces,
    text: "*🎤 Saved voices*\n\n" + names + "\n\nSend me a voice note to add another.",
  });
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- Shorts: approve/skip each proposed short (updates the plan in R2) ----
const SHORTS_KEY = "shorts/0001-youtube-money/plan.json";

async function markShort(env, n, approved) {
  if (!env.R2) return false;
  const o = await env.R2.get(SHORTS_KEY);
  if (!o) return false;
  let plan;
  try { plan = JSON.parse(await o.text()); } catch { return false; }
  const s = (plan.shorts || []).find((x) => x.n === n);
  if (!s) return false;
  s.approved = approved;
  s.skipped = !approved;
  await env.R2.put(SHORTS_KEY, JSON.stringify(plan), { httpMetadata: { contentType: "application/json    "} });
  return true;
}

async function countApprovedShorts(env) {
  if (!env.R2) return 0;
  const o = await env.R2.get(SHORTS_KEY);
  if (!o) return 0;
  try {
    const plan = JSON.parse(await o.text());
    return (plan.shorts || []).filter((x) => x.approved && !x.video_id).length;
  } catch { return 0; }
}

// Direction panel: reads the channel state (channel/state.json in R2) and shows
// the schedule + monetization live. For fresh metrics use /reporte.
async function sendPanel(env, chatId) {
  let st = null;
  if (env.R2) {
    const o = await env.R2.get("channel/state.json");
    if (o) { try { st = JSON.parse(await o.text()); } catch {} }
  }
  if (!st) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "📊 No channel data yet. Run /report once to initialize it (pulls YouTube metrics and saves the state).",
    });
  }
  const mon = st.monetization || {};
  const pub = st.published || [];
  const up = st.upcoming || [];
  const L = [];
  L.push(`<b>📊 Panel — ${esc(st.channel?.name || "The Data Lens")}</b>`);
  if (st.channel_stats) L.push(`👥 ${st.channel_stats.subs} subs · 👁️ ${st.channel_stats.total_views} views · 🎬 ${st.channel_stats.videos} videos`);
  L.push("");
  L.push(`<b>Published (${pub.length}):</b>`);
  for (const v of pub.slice(-5)) {
    const s = v.stats || {};
    L.push(`• ${esc(v.title || v.video_id)} — ${v.privacy}${v.privacy === "public" ? ` · ${s.views || 0} views` : ""}`);
  }
  L.push("");
  L.push(`<b>Schedule:</b>`);
  for (const u of up.slice(0, 6)) L.push(`• #${u.n} · ${u.target_date} — ${esc(u.topic)}`);
  L.push("");
  L.push(`<b>Monetization:</b> subs ${mon.subs ?? "?"}/1000 · hours ${mon.watch_hours ?? "?"}/4000 · ${mon.elegible ? "✅ eligible" : "❌ not yet"}`);
  if (st.updated_at) L.push(`\n<i>Metrics: ${String(st.updated_at).slice(0, 16).replace("T", " ")} UTC · /reporte to refresh</i>`);
  return tg(env, "sendMessage", { chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true, text: L.join("\n") });
}

// Shows ONLY what's being done now (in progress or queued), with the current
// step and the minutes it's been running. No history (it would be too long).
async function sendStatus(env, chatId) {
  const res = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs?per_page=20`);
  if (!res.ok) {
    return tg(env, "sendMessage", { chat_id: chatId, text: `Could not read the status (${res.status}).` });
  }
  const active = ((await res.json()).workflow_runs || []).filter((r) => r.status !== "completed");

  if (!active.length) {      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✅ Nothing in progress now.\n\nSend /voice or /render to start. The result arrives here when it's done.",
      });

  }

  const blocks = [];
  for (const r of active) {
    const mins = r.run_started_at
      ? Math.max(0, Math.round((Date.now() - Date.parse(r.run_started_at)) / 60000))
      : 0;

    let paso = r.status === "queued" ? "queued…" : "starting…";
    const jr = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs/${r.id}/jobs`);
    if (jr.ok) {
      const job = ((await jr.json()).jobs || [])[0];
      const steps = (job && job.steps) || [];
      const total = steps.length;
      const done = steps.filter((s) => s.status === "completed").length;
      const cur = steps.find((s) => s.status === "in_progress");
      if (cur) paso = `step ${Math.min(done + 1, total)}/${total}: ${esc(cur.name)}`;
      else if (total && done === total) paso = "closing…";
    }

    const exp = expectedMin(r.name);
    const pct = r.status === "queued" ? 0 : Math.min(99, Math.round((mins / exp) * 100));
    const eta = Math.max(0, exp - mins);
    blocks.push(
      `⏳ <a href="${r.html_url}">${esc(r.name)}</a>\n     ${paso}\n     ${pct}% · ~${eta} min left (running ${mins})`
    );
  }

  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    text:
      "⏳ <b>In progress now</b>\n\n" +
      blocks.join("\n\n") +
      "\n\nTap the name to see the live detail. I'll notify here when it's done.",
  });
}

// ---------- Helpers ----------

function isOwner(chatId, env) {
  return env.OWNER_CHAT_ID && String(chatId) === String(env.OWNER_CHAT_ID);
}

function ack(env, chatId, r, label) {
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: r.ok ? `⏳ ${label} triggered. I'll notify when it's done.` : `❌ Could not trigger (${r.status}).`,
  });
}

// Expected minutes by work type (for the % and approximate ETA).
function expectedMin(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("fases") || n.includes("phased")) return 90;  // phases in parallel, each 3 attempts
  if (n.includes("shorts")) return (n.includes("final") || n.includes("subir")) ? 25 : 4;  // generate shorts vs analyze
  if (n.includes("render")) return 40;   // full video render (up to 3 attempts)
  if (n.includes("recipe")) return 25;
  if (n.includes("voiceover") || n.includes("voice")) return 18;
  if (n.includes("photo")) return 7;
  return 12;
}

// Active runs (in progress or queued). null = could not read GitHub.
async function activeRuns(env) {
  const res = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs?per_page=20`);
  if (!res.ok) return null;
  return ((await res.json()).workflow_runs || []).filter((r) => r.status !== "completed");
}

function runProgress(r) {
  const mins = r.run_started_at ? Math.max(0, Math.round((Date.now() - Date.parse(r.run_started_at)) / 60000)) : 0;
  const exp = expectedMin(r.name);
  const pct = r.status === "queued" ? 0 : Math.min(99, Math.round((mins / exp) * 100));
  return { mins, pct, eta: Math.max(0, exp - mins) };
}

// If something heavy is in progress, warn (with % and ETA) and return true (busy).
async function busyGuard(env, chatId) {
  const act = await activeRuns(env);
  if (!act || !act.length) return false;
  const r = act[0];
  const p = runProgress(r);
  await tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    text: `⏳ Wait: something is in progress.\n<b>${esc(r.name)}</b> — ${p.pct}%${p.eta ? ` · ~${p.eta} min left` : ""}\n\nI'll notify here when it's done. Tap 📊 Status for the detail.`,
  });
  return true;
}

function tg(env, method, payload) {
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json    "},
    body: JSON.stringify(payload),
  });
}

function ghApi(env, path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    // Timeout: a SLOW GitHub API (not down) must not hang /api/state.
    signal: init.signal || AbortSignal.timeout(6000),
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "video-forge-bot",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
}

function ghDispatch(env, workflow, inputs) {
  return ghApi(env, `/repos/${env.GH_REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs }),
  });
}

// ---------- Phase 7: photo editor (PRO retouch that preserves identity) ----------
// You send a photo -> the Worker saves the SOURCE to R2 and triggers `photo_edit.yml`
// (GitHub Actions), which retouches it WITHOUT changing facial features (GFPGAN + Real-ESRGAN) or
// changes the background (rembg) and returns it to the chat with buttons. The SOURCE lives in
// R2 ONLY while you iterate; on "Save" it's deleted (Juan's storage rule).
// (Not done in the Worker because img2img regenerates the face; we want identity.)

function editKey(chatId, kind) {
  return `edit/${chatId}/${kind}`;
}

async function getEditState(env, chatId) {
  if (!env.R2) return null;
  const o = await env.R2.get(editKey(chatId, "state"));
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch { return null; }
}

function putEditState(env, chatId, st) {
  return env.R2.put(editKey(chatId, "state"), JSON.stringify(st), {
    httpMetadata: { contentType: "application/json    "},
  });
}  // From what the user types, it deduces the mode: "fondo/background" -> change background.
function parseEdit(caption) {
  const c = (caption || "").toLowerCase();
  if (/\bfondo\b|\bfondos\b|\bbackground\b/.test(c)) return { mode: "fondo", prompt: caption || "    "};
  return { mode: "retoque", prompt: caption || "    "};
}

async function handlePhotoEdit(message, env, chatId) {
  if (!env.R2) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "The photo editor is not active yet (needs a redeploy with R2).",
    });
  }
  const photos = message.photo;
  const fileId = photos[photos.length - 1].file_id; // the largest one
  const caption = (message.caption || "").trim();

  const bytes = await tgDownloadFile(env, fileId);
  if (!bytes) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "Could not download the photo, retry.    "});
  }
  // Saves the SOURCE in R2 (to be able to iterate). Deleted on Save.
  await env.R2.put(editKey(chatId, "source"), bytes, { httpMetadata: { contentType: "image/jpeg    "} });

  const { mode, prompt } = parseEdit(caption);
  return dispatchEdit(env, chatId, mode, prompt);
}

// Triggers the retouch workflow with the SOURCE already in R2.
async function dispatchEdit(env, chatId, mode, prompt, strength) {
  strength = strength || "soft"; // default SOFT (natural retouch, not plastic)
  await putEditState(env, chatId, { awaiting: false, mode, prompt, strength });
  const r = await ghDispatch(env, "photo_edit.yml", {
    chat_id: String(chatId),
    mode,
    prompt: prompt || "",
    strength,
  });
  if (!r.ok) {
    return tg(env, "sendMessage", { chat_id: chatId, text: `❌ Could not start the retouch (${r.status}).` });
  }
  const txt = mode === "fondo"
    ? "🖼️ Changing the background and polishing, without touching your face. Takes ~5-7 min and I'll send it here."
    : `🖼️ Pro retouch (${strength}) — cleaner skin + texture, SAME face. Takes ~5-7 min and I'll send it here.`;
  return tg(env, "sendMessage", { chat_id: chatId, text: txt });
}

// "Otra vez" (another attempt): re-triggers with the same source (still in R2), same mode/prompt/strength.
async function reDispatchEdit(env, chatId) {
  const src = env.R2 && (await env.R2.get(editKey(chatId, "source")));
  if (!src) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "I don't have a photo in edit. Send me a photo first.    "});
  }
  const st = await getEditState(env, chatId);
  return dispatchEdit(env, chatId, (st && st.mode) || "retouch", (st && st.prompt) || "", (st && st.strength) || "soft");
}  // Calibrate: redo the SAME photo with another smoothness (soft | medium | strong).
async function reEditStrength(env, chatId, strength) {
  const src = env.R2 && (await env.R2.get(editKey(chatId, "source")));
  if (!src) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "I don't have a photo in edit. Send me a photo first.    "});
  }
  const st = await getEditState(env, chatId);
  return dispatchEdit(env, chatId, (st && st.mode) || "retouch", (st && st.prompt) || "", strength);
}

// ---------- Phase 8: RECIPE (9:16 reel with your photos/videos + Pexels/IA + voice + subtitles) ----------
// In "recipe mode" the photos are NOT retouched: they're collected IN ORDER to build the reel.
function recipeKey(chatId, kind) { return `recipe/${chatId}/${kind}`; }

async function getRecipeState(env, chatId) {
  if (!env.R2) return null;
  const o = await env.R2.get(recipeKey(chatId, "state"));
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch { return null; }
}
function setRecipeState(env, chatId, s) {
  return env.R2.put(recipeKey(chatId, "state"), JSON.stringify(s), { httpMetadata: { contentType: "application/json    "} });
}

async function recipeStart(env, chatId) {
  if (!env.R2) return tg(env, "sendMessage", { chat_id: chatId, text: "Can't yet (needs R2).    "});
  await setRecipeState(env, chatId, { active: true, n: 0 });
  await env.R2.delete(recipeKey(chatId, "text"));
  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "Markdown",
    text: "🍳 *Recipe mode activated.*\n\nSend me, IN THE ORDER you want the reel:\n• the recipe *photos/videos* (one by one)\n• the recipe *text* (ingredients and steps, however you like)\n\nI narrate with your registered voice. For what's missing, I add related clips/images.\nWhen done write */done* (or */cancel*).",
  });
}

async function recipeAddMedia(message, env, chatId, rs, kind) {
  const fileId = kind === "photo" ? message.photo[message.photo.length - 1].file_id : message.video.file_id;
  const bytes = await tgDownloadFile(env, fileId);
  if (!bytes) return tg(env, "sendMessage", { chat_id: chatId, text: "Could not download that media, retry.    "});
  const idx = String(rs.n).padStart(3, "0");
  const ext = kind === "video" ? "mp4" : "jpg";
  await env.R2.put(recipeKey(chatId, `media/${idx}.${ext}`), bytes, {
    httpMetadata: { contentType: kind === "video" ? "video/mp4" : "image/jpeg    "},
  });
  rs.n += 1;
  await setRecipeState(env, chatId, rs);
  return tg(env, "sendMessage", { chat_id: chatId, text: `📎 ${kind === "video" ? "Video received" : "Photo received"} (${rs.n}). Keep sending or write /done.` });
}

async function recipeAddText(env, chatId, rs, t) {
  const prev = await env.R2.get(recipeKey(chatId, "text"));
  const acc = (prev ? (await prev.text()) + "\n" : "") + t;
  await env.R2.put(recipeKey(chatId, "text"), acc, { httpMetadata: { contentType: "text/plain; charset=utf-8    "} });
  return tg(env, "sendMessage", { chat_id: chatId, text: "📝 Recipe noted. Keep sending or write /done.    "});
}

async function recipeCancel(env, chatId) {
  await setRecipeState(env, chatId, { active: false, n: 0 });
  return tg(env, "sendMessage", { chat_id: chatId, text: "🍳 Recipe canceled.    "});
}

async function recipeBuild(env, chatId, rs) {
  if (!rs.n) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "I didn't receive photos/videos. Send at least one and then /listo.    "});
  }
  await setRecipeState(env, chatId, { active: false, n: rs.n });
  const r = await ghDispatch(env, "recipe_reel.yml", { chat_id: String(chatId), count: String(rs.n) });
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: r.ok
      ? `🍳 Building your recipe reel (${rs.n} media + related clips, voice and subtitles). Takes a few minutes and I'll send it here.`
      : `❌ Could not start the reel (${r.status}).`,
  });
}

// Downloads a file from Telegram by file_id -> Uint8Array.
async function tgDownloadFile(env, fileId) {
  const r = await tg(env, "getFile", { file_id: fileId });
  const j = await r.json();
  const fp = j && j.result && j.result.file_path;
  if (!fp) return null;
  const fr = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fp}`);
  if (!fr.ok) return null;
  return new Uint8Array(await fr.arrayBuffer());
}

// ---------- Phase 8: register a voice by sending audio (to narrate recipes) ----------
// You send a voice note / audio -> saved as a selectable voice in R2 (private,
// NEVER in the public repo). Chatterbox clones the timbre from that audio. Cloning
// another real person's voice requires their permission (Juan's wife's voice was
// AUTHORIZED by her, 2026-07-24). The `voice/registry.json` registry lists available voices.

function slugifyVoice(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "voz";
}

async function handleVoiceRegister(message, env, chatId) {
  if (!env.R2) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "I can't save voices yet (needs R2).    "});
  }
  const a = message.voice || message.audio;
  const bytes = await tgDownloadFile(env, a.file_id);
  if (!bytes) return tg(env, "sendMessage", { chat_id: chatId, text: "Could not download the audio, retry.    "});
  await env.R2.put(`voice/pending/${chatId}`, bytes, { httpMetadata: { contentType: "audio/ogg    "} });

  const caption = (message.caption || "").trim();
  if (caption) return finalizeVoice(env, chatId, caption);

  await env.R2.put(`voice/pending/${chatId}.json`, JSON.stringify({ awaiting: true }), {
    httpMetadata: { contentType: "application/json    "},
  });
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: "🎤 Audio received. What do I call this voice? Tell me a short name (e.g.: \"wife\", \"me\").",
  });
}

async function finalizeVoice(env, chatId, name) {
  const slug = slugifyVoice(name);
  const pend = await env.R2.get(`voice/pending/${chatId}`);
  if (!pend) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "I don't have a pending audio. Send me the voice note first.    "});
  }
  const bytes = new Uint8Array(await pend.arrayBuffer());
  await env.R2.put(`voice/ref_${slug}.mp3`, bytes, { httpMetadata: { contentType: "audio/mpeg    "} });

  let reg = {};
  const r = await env.R2.get("voice/registry.json");
  if (r) { try { reg = JSON.parse(await r.text()); } catch {} }
  reg[slug] = { label: name, key: `voice/ref_${slug}.mp3` };
  await env.R2.put("voice/registry.json", JSON.stringify(reg), { httpMetadata: { contentType: "application/json    "} });

  await env.R2.delete(`voice/pending/${chatId}`);
  await env.R2.delete(`voice/pending/${chatId}.json`);
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: `✅ Voice saved as "${slug}". I'll use it to narrate (e.g.: recipe reels). Send another voice whenever you want.`,
  });
}

// Telegram relay of the AI OS (ONLY via Service Binding; no public URL). The store sends its notifications via
// this single bot. Its buttons carry the "v:" prefix so handleCallback hands them back to the store.
export class OSBot extends WorkerEntrypoint {
  async fetch(request) {
    const env = this.env;
    const m = new URL(request.url).pathname.match(/^\/tg\/([A-Za-z]+)$/);
    const allowed = ["sendMessage", "sendPhoto", "sendDocument", "editMessageText", "editMessageCaption", "editMessageReplyMarkup", "answerCallbackQuery", "deleteMessage"];
    if (!m || !allowed.includes(m[1])) return new Response(JSON.stringify({ ok: false, description: "method not allowed    "}), { status: 400, headers: { "content-type": "application/json    "} });
    const prefix = (mk) => {
      try {
        const o = typeof mk === "string" ? JSON.parse(mk) : mk;
        if (o && Array.isArray(o.inline_keyboard)) o.inline_keyboard.forEach((row) => (row || []).forEach((b) => { if (b && b.callback_data && !String(b.callback_data).startsWith("v:")) b.callback_data = ("v:" + b.callback_data).slice(0, 64); }));
        return o;
      } catch { return mk; }
    };
    const ct = request.headers.get("content-type") || "";
    let init;
    if (ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      if (fd.has("reply_markup")) fd.set("reply_markup", JSON.stringify(prefix(fd.get("reply_markup"))));
      init = { method: "POST", body: fd };
    } else {
      const body = await request.json().catch(() => ({}));
      if (body && body.reply_markup) body.reply_markup = prefix(body.reply_markup);
      init = { method: "POST", headers: { "content-type": "application/json    "}, body: JSON.stringify(body || {}) };
    }
    return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${m[1]}`, init);
  }
}
