// notify_review.mjs — manda el video a Telegram con botones de REVIEW-BEFORE-UPLOAD:
//
//        [ 🚀 Approve & Publish ]   [ 🗑️ Discard ]
//
// Los callbacks llegan al Worker como "vf:review:approve:<id>" /
// "vf:review:discard:<id>" (el Worker es quien dispara los workflows).
//
// Uso:
//   node pipeline/notify_review.mjs send   <review.json> <video.mp4>
//   node pipeline/notify_review.mjs status <review.json> "<mensaje>"
//
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (o TG_CHAT_ID / OWNER_CHAT_ID),
//      WATCH_BASE_URL (solo si el video pasa de 50MB, para el enlace firmado
//      /watch/<key>?t=<token>)
import fs from "node:fs";

const [cmd, reviewPath, arg2] = process.argv.slice(2);
const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID || process.env.OWNER_CHAT_ID;
if (!BOT || !CHAT) { console.error("faltan TELEGRAM_BOT_TOKEN y TG_CHAT_ID"); process.exit(1); }
if (!reviewPath) { console.error("uso: notify_review.mjs send|status <review.json> [...]"); process.exit(1); }

const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
const api = (method, payload) =>
  fetch(`https://api.telegram.org/bot${BOT}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });

const buttons = (id) => ({
  inline_keyboard: [[
    { text: "🚀 Approve & Publish", callback_data: `vf:review:approve:${id}` },
    { text: "🗑️ Discard", callback_data: `vf:review:discard:${id}` },
  ]],
});

const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function sendVideo() {
  const videoPath = arg2;
  if (!videoPath || !fs.existsSync(videoPath)) { console.error("falta <video.mp4>"); process.exit(1); }
  const size = fs.statSync(videoPath).size;
  const caption =
    `🎬 *Motion Graphics — pending review*\n\n` +
    `*${review.title}*\n\n` +
    `${review.asset.durationSec ? `⏱ ${fmtDur(review.asset.durationSec)} · ` : ""}📦 ${(size / 1e6).toFixed(1)} MB\n` +
    `ID \`${review.id}\`\n\n` +
    `Approve to publish to YouTube + AtoPlay, or discard to cancel (no upload, no quota burned).`;
  // Telegram bot: archivos hasta 50MB por sendVideo.
  if (size <= 48 * 1024 * 1024) {
    const fd = new FormData();
    fd.append("chat_id", CHAT);
    fd.append("caption", caption);
    fd.append("parse_mode", "Markdown");
    fd.append("reply_markup", JSON.stringify(buttons(review.id)));
    fd.append("video", new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" }), "motion.mp4");
    const r = await fetch(`https://api.telegram.org/bot${BOT}/sendVideo`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("sendVideo fallo:", j.description || r.status); process.exit(1); }
    console.log(`video + botones enviados al chat ${CHAT} (review ${review.id})`);
    return;
  }
  // >50MB: enlace firmado al Worker (/watch/<key>?t=<hmac>) como en el canal.
  const base = process.env.WATCH_BASE_URL;
  if (!base) { console.error("el video supera 50MB y no hay WATCH_BASE_URL para el enlace firmado"); process.exit(1); }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(BOT), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode("watch:" + review.asset.videoKey)))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const url = `${base.replace(/\/$/, "")}/watch/${encodeURIComponent(review.asset.videoKey)}?t=${sig}`;
  const r = await api("sendMessage", {
    chat_id: CHAT, parse_mode: "Markdown",
    text: `🎬 *Motion Graphics — pending review*\n\n*${review.title}*\n\n⏱ ${fmtDur(review.asset.durationSec || 0)} · ${(size / 1e6).toFixed(1)} MB\n👉 [Watch preview](${url})\nID \`${review.id}\`\n\nApprove to publish to YouTube + AtoPlay, or discard to cancel (no upload, no quota burned).`,
    reply_markup: buttons(review.id),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("sendMessage fallo:", j.description || r.status); process.exit(1); }
  console.log(`preview con botones enviada al chat ${CHAT} (review ${review.id})`);
}

async function sendStatus() {
  const msg = arg2 || "";
  const r = await api("sendMessage", { chat_id: CHAT, parse_mode: "Markdown", text: msg.replace(/"/g, '\\"') });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("status fallo:", j.description || r.status); process.exit(1); }
  console.log("estado enviado al chat", CHAT);
}

if (cmd === "send") await sendVideo();
else if (cmd === "status") await sendStatus();
else { console.error("comando desconocido (usa send|status)"); process.exit(1); }
