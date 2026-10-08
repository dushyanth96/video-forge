// publish_AtoPlay.mjs — publishes in AtoPlay automatizando the navegador with
// Playwright (IN THE NUBE: GitHub Actions, Chromium headless).
//
// AtoPlay not tiene API pública documentada, así that replicamos the flujo web
// humano: login → upload → metadatos → publicar.
//
// Usage: node pipeline/publish_AtoPlay.mjs <video.mp4> <review.JSON> <out AtoPlay.JSON>
//
// Env:
//   ATOPLAY_EMAIL         usuario/email de AtoPlay (requerido)
//   ATOPLAY_PASSWORD      contraseña of AtoPlay (required)
//   ATOPLAY_CHANNEL_NAME  channel destino (default: "skillgrox")
//   ATOPLAY_CATEGORY      categoría (default: "Technology")
//
// Without ATOPLAY_EMAIL / ATOPLAY_PASSWORD -> SKIP limpio (exit 0); never
// bloquea the publishing of YouTube.
import fs from "node:fs";

const [videoPath, reviewPath, outPath] = process.argv.slice(2);
if (!videoPath || !reviewPath || !outPath) {
  console.error("uso: publish_atoplay.mjs <video.mp4> <review.json> <out atoplay.json>");
  process.exit(1);
}

const EMAIL = (process.env.ATOPLAY_EMAIL || "").trim();
const PASSWORD = process.env.ATOPLAY_PASSWORD || "";
const CHANNEL = (process.env.ATOPLAY_CHANNEL_NAME || "").trim() || "skillgrox";
const CATEGORY = (process.env.ATOPLAY_CATEGORY || "").trim() || "Technology";
// Base URL anulable (default https://AtoPlay.com) — útil for tests locales.
const BASE = (process.env.ATOPLAY_BASE_URL || "").trim().replace(/\/$/, "") || "https://atoplay.com";
const LOGIN_URL = `${BASE}/login`;
const UPLOAD_URL = `${BASE}/video-upload`;

const write = (obj) => {
  const dir = outPath.slice(0, Math.max(0, outPath.lastIndexOf("/") || -1)) || ".";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2));
};

// Without credenciales -> SKIP limpio. Is evalúa BEFORE of importar Playwright
// for that the skip not dependa of that the paquete esté instalado.
if (!EMAIL || !PASSWORD) {
  console.log("ATOPLAY no configurado (ATOPLAY_EMAIL / ATOPLAY_PASSWORD) — SKIP");
  write({ ok: false, skipped: true, reason: "not configured", at: new Date().toISOString() });
  process.exit(0);
}
if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size < 10000) {
  console.error("video faltante o vacio");
  process.exit(1);
}

// Metadatos of the review (title / description / tags).
let review = {};
try { review = JSON.parse(fs.readFileSync(reviewPath, "utf8")); } catch { review = {}; }
const TITLE = String(review.title || "Video Forge").slice(0, 100);
const DESCRIPTION = String(review.description || "");
const TAGS = (Array.isArray(review.tags) ? review.tags : []).map(String).filter(Boolean).slice(0, 10);

const log = (...a) => console.log(...a);

const { chromium } = await import("playwright");

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

// Evidencia for depurar: capturas bajo work/ (the workflow the deletes to the final).
let step = 0;
const shot = async (label) => {
  try {
    await page.screenshot({ path: `work/shots/${String(++step).padStart(2, "0")}_${label}.png` });
  } catch {}
};

// Rellena the PRIMER campo that exista between the selectores dados.
const fillFirst = async (selectors, value) => {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.fill(value).catch(() => {});
      return true;
    }
  }
  return false;
};

// Elige a <option> (by texto exacto) in the primer <select> that the tenga.
const pickInSelects = async (text) => {
  const selects = page.locator("select");
  const n = await selects.count();
  for (let i = 0; i < n; i++) {
    const s = selects.nth(i);
    const opts = await s.locator("option").allTextContents().catch(() => []);
    if (opts.some((o) => o.trim().toLowerCase() === text.toLowerCase())) {
      await s.selectOption({ label: text }).catch(() => {});
      return true;
    }
  }
  return false;
};

// Abre a dropdown custom (combobox / button) and pincha the option by texto.
const pickInDropdown = async (text) => {
  const trigger = page
    .locator('[role="combobox"], [data-testid*="channel" i], button:has-text("channel" i), div[role="button"]:has-text("channel" i)')
    .first();
  if (!(await trigger.count().catch(() => 0))) return false;
  await trigger.click().catch(() => {});
  const opt = page.getByText(text, { exact: true }).first();
  if (!(await opt.count().catch(() => 0))) return false;
  await opt.click().catch(() => {});
  return true;
};

try {
  // ---- 1) Login ----
  log("→ Logging in to AtoPlay…");
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  const emailOk = await fillFirst([
    'input[type="email"]',
    'input[name*="email" i]',
    'input[placeholder*="email" i]',
    'input[name*="user" i]',
    'input[placeholder*="user" i]',
  ], EMAIL);
  const passOk = await fillFirst(['input[type="password"]'], PASSWORD);
  if (!emailOk || !passOk) throw new Error("no se encontraron los campos de login en la página");
  await page.getByRole("button", { name: /sign in|log in|login/i }).first().click();
  await page.waitForURL((u) => !/\/login/i.test(u.toString()), { timeout: 45000 }).catch(() => {});
  if (/\/login/i.test(page.url())) throw new Error("el login no redirigió — ¿credenciales incorrectas?");
  log("✅ Logged in");
  await shot("logged_in");

  // ---- 2) Pagina de upload ----
  log("→ Navigating to upload page…");
  await page.goto(UPLOAD_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 30000 });
  log("→ Uploading video…");
  await fileInput.setInputFiles(videoPath);
  await shot("file_attached");

  // ---- 3) Metadatos ----
  await fillFirst([
    'input[placeholder*="title" i]',
    'input[name*="title" i]',
    'textarea[placeholder*="title" i]',
  ], TITLE);
  await fillFirst([
    'textarea[placeholder*="description" i]',
    'textarea[name*="description" i]',
    'input[placeholder*="description" i]',
  ], DESCRIPTION);

  // Channel: first a <select> nativo, then a dropdown custom.
  log(`→ Setting channel to ${CHANNEL}…`);
  let channelSet = await pickInSelects(CHANNEL);
  if (!channelSet) channelSet = await pickInDropdown(CHANNEL);
  if (!channelSet) log(`⚠️ no se pudo seleccionar el canal "${CHANNEL}" (¿cambió el DOM de AtoPlay?)`);

  // Categoría (default: Technology).
  log(`→ Setting category to ${CATEGORY}…`);
  if (!await pickInSelects(CATEGORY)) log(`⚠️ no se pudo seleccionar la categoría "${CATEGORY}"`);

  // Tags (si hay campo).
  if (TAGS.length) {
    const tagEl = page.locator('input[placeholder*="tag" i], input[name*="tag" i]').first();
    if (await tagEl.count().catch(() => 0)) {
      for (const t of TAGS) {
        await tagEl.type(t, { delay: 20 }).catch(() => {});
        await page.keyboard.press("Enter").catch(() => {});
        await page.waitForTimeout(250);
      }
      log(`→ Tags added: ${TAGS.join(", ")}`);
    }
  }
  await shot("form_filled");

  // ---- 4) Publicar ----
  log("→ Publishing…");
  const pubBtn = page.getByRole("button", { name: /publish|upload|done|finish/i }).last();
  await pubBtn.scrollIntoViewIfNeeded().catch(() => {});
  await pubBtn.click();

  // Esperar of true: barra of progreso -> toast/navegación of éxito.
  const deadline = Date.now() + 12 * 60 * 1000; // videos grandes: hasta 12 min
  let success = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(4000);
    const txt = (await page.locator("body").innerText().catch(() => "")) || "";
    if (/(upload|publish|video)[^\n]{0,40}(complete|successful|success|published|done)/i.test(txt)) {
      success = true;
      break;
    }
    const pm = txt.match(/(\d{1,3})\s*%/);
    if (pm) log(`   uploading… ${pm[1]}%`);
  }
  if (!success) throw new Error("no se detectó la confirmación de publicación en AtoPlay (timeout)");

  log("✅ ATOPLAY success — published");
  await shot("published");
  write({ ok: true, platform: "atoplay", channel: CHANNEL, url: page.url(), at: new Date().toISOString() });
  await browser.close();
  process.exit(0);
} catch (e) {
  await shot("error");
  try { fs.writeFileSync("work/page.html", await page.content()); } catch {}
  console.error(`ATOPLAY FALLO ❌ (YouTube NO se ve afectado): ${e.message}`);
  write({ ok: false, platform: "atoplay", error: e.message, at: new Date().toISOString() });
  await browser.close().catch(() => {});
  process.exit(1);
}
