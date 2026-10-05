# Video Forge — English Motion Graphics Pipeline Setup

Complete, itemized setup for the **code-rendered motion graphics pipeline** with
**Review-Before-Upload on Telegram** and **multi-platform auto-publish**.
No credentials are assumed — every secret below must be created by you and added
where indicated. Total cost: $0 (all free tiers; no stock footage is used, so no
Pexels/Pixabay account is needed).

## Architecture (what runs where)

```
GitHub Actions (motiongfx_daily.yml, daily 10:00 ET / on demand)
  │  1. English script  (Gemini)      pipeline/motiongfx/generate_script.mjs
  │  2. English TTS     (Gemini)      pipeline/gemini_tts.mjs
  │  3. Code render     (HyperFrames) pipeline/motiongfx/*.mjs  — CSS/Canvas/GSAP only
  │  4. QA gate         (Gemini)      pipeline/qa_check.mjs
  │  5. Upload MP4 → R2               pipeline/lib/r2_tool.mjs
  └─> review record (pending) in R2 ──> Telegram message with buttons
                                         [🚀 Approve & Publish]  [🗑️ Discard]
        │ approve                                    │ discard
        ▼                                            ▼
  review_publish.yml                         review_discard.yml
  YouTube (OAuth2) + AtoPlay                 cancel + delete temp assets
                                             (NO YouTube API call — zero quota)
```

The Telegram bot (Cloudflare Worker, `bot/src/index.js`) receives the button
presses and dispatches the matching workflow via the GitHub API.

---

## Step 0 — Fork and clone

1. Fork `video-forge` on GitHub to your account.
2. Clone your fork and enter it:
   ```bash
   git clone https://github.com/<YOUR-USERNAME>/video-forge
   cd video-forge
   ```

## Step 1 — Create the credentials

### 1.1 Google AI Studio — `GEMINI_API_KEY`
*(script writing + English TTS + QA gate)*
1. Open https://aistudio.google.com/apikey (sign in with Google).
2. Click **Create API key** → copy the value. Free tier includes Gemini TTS.

### 1.2 Telegram — `TELEGRAM_BOT_TOKEN`, `OWNER_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`
1. Open **@BotFather** in Telegram → `/newbot` → pick name & username → it replies
   with `TELEGRAM_BOT_TOKEN` (format `123456:ABC-DEF...`).
2. Get your own chat id: open **@userinfobot** (or https://chatid.gg) → reply is
   your numeric `OWNER_CHAT_ID` (e.g. `987654321`). Only this chat can approve.
3. Generate the webhook secret locally (any random string):
   ```bash
   openssl rand -hex 16
   ```
   → that is `TELEGRAM_WEBHOOK_SECRET`.

### 1.3 GitHub — `GH_TOKEN`
*(the Worker uses it to trigger review workflows)*
1. GitHub → Settings → **Developer settings** → **Fine-grained personal access tokens**
   → **Generate new token**.
2. Resource owner: **your account**. Repository access: **Only select repositories** →
   your fork.
3. Permissions → Repository permissions → **Actions: Read and Write** (nothing else needed).
4. Generate, copy the token → `GH_TOKEN`.

### 1.4 Cloudflare — `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` + R2 bucket
*(stores the MP4s and review records)*
1. Cloudflare dashboard → right-hand menu → **Account ID** → copy → `CLOUDFLARE_ACCOUNT_ID`.
2. **My Profile** → **API Tokens** → **Create Token** → use template
   **"Edit Cloudflare Workers"** (or custom token) with:
   - Account → **R2: Edit** (read/write/delete objects — required)
   - Account → **Cloudflare Workers: Edit** (required for the bot deploy)
   → `CLOUDFLARE_API_TOKEN`.
3. Create the R2 bucket: **R2 Object Storage** → **Create bucket** → name it exactly
   `video-forge` (this name is hardcoded in `bot/wrangler.toml` and
   `pipeline/lib/r2_tool.mjs`). Free tier: 10 GB.

### 1.5 Google Cloud — `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`
*(YouTube upload via Data API v3, OAuth2 installed-app flow)*
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → OAuth consent screen** → **External** → fill name/email → save.
4. **Credentials → Create Credentials → OAuth client ID** → application type
   **Desktop app** → copy `YT_CLIENT_ID` and `YT_CLIENT_SECRET`.
5. Get the refresh token with the OAuth 2.0 Playground
   (https://developers.google.com/oauthplayground):
   - Gear icon ⚙️ → **Use your own OAuth credentials** → paste the client id/secret.
   - Scope: `https://www.googleapis.com/auth/youtube.upload`
   - **Authorize APIs** → allow → **Exchange authorization code for tokens**.
   - Copy the long-lived `refresh_token` → `YT_REFRESH_TOKEN`.
   (Never share the refresh token; it grants upload to your channel.)

### 1.6 AtoPlay — `ATOPLAY_EMAIL`, `ATOPLAY_PASSWORD`, `ATOPLAY_CHANNEL_NAME` *(optional)*
*(AtoPlay has no public API, so this step logs in and uploads through the real
website with Playwright — no API key exists.)*
1. Your AtoPlay account email → `ATOPLAY_EMAIL`, and its password → `ATOPLAY_PASSWORD`.
2. The destination channel is a repo **variable** `ATOPLAY_CHANNEL_NAME` (default
   `skillgrox`) — create that channel in your AtoPlay dashboard first.
3. If you skip AtoPlay, publishing still works for YouTube (AtoPlay step logs a
   clean "not configured — SKIP").

## Step 2 — Add GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Where it comes from | Used by |
|---|---|---|
| `GEMINI_API_KEY` | §1.1 | motiongfx_daily (script, TTS, QA) |
| `TELEGRAM_BOT_TOKEN` | §1.2 | all review flows, deploy-bot |
| `OWNER_CHAT_ID` | §1.2 | all review flows (review card recipient) |
| `TELEGRAM_WEBHOOK_SECRET` | §1.2 | deploy-bot (webhook security) |
| `GH_TOKEN` | §1.3 | deploy-bot → Worker (dispatches review workflows) |
| `CLOUDFLARE_API_TOKEN` | §1.4 | R2 upload/cleanup + Worker deploy |
| `CLOUDFLARE_ACCOUNT_ID` | §1.4 | R2 + Worker deploy |
| `YT_CLIENT_ID` | §1.5 | review_publish → YouTube |
| `YT_CLIENT_SECRET` | §1.5 | review_publish → YouTube |
| `YT_REFRESH_TOKEN` | §1.5 | review_publish → YouTube |
| `ATOPLAY_EMAIL` | §1.6 (optional) | review_publish → AtoPlay |
| `ATOPLAY_PASSWORD` | §1.6 (optional) | review_publish → AtoPlay |

**Not needed:** `MOTIONGFX_PEXELS_KEY`, `MOTIONGFX_PIXABAY_KEY` — stock footage is
disabled in this pipeline (100% code-rendered motion graphics).

## Step 3 — Point the bot at your fork

Edit `bot/wrangler.toml` and set the repo the bot triggers workflows in:

```toml
[vars]
GH_REPO = "<YOUR-USERNAME>/video-forge"
```

(Commit the change, or the next deploy picks it up — the Worker reads this var at runtime.)

## Step 4 — Deploy the Telegram bot

No local install needed — it deploys from the cloud:

1. GitHub → **Actions** tab → **"Deploy bot (Cloudflare)"** → **Run workflow**.
2. The job deploys the Worker, pushes all worker secrets (bot token, GH token,
   chat id, webhook secret, Gemini key, YouTube OAuth trio), registers the
   Telegram webhook, and sets the bot menu.
3. Success ends with `✅ Bot desplegado y webhook activo`.

## Step 5 — Verify

1. Send `/estado` to your bot in Telegram → it replies with the queue state.
2. Test the whole chain on demand: **Actions → "Motion Graphics Daily" → Run workflow**.
   ~10 min later you get the review card with the two buttons.
3. Press **🗑️ Discard** once to confirm cleanup works, then **🚀 Approve & Publish**
   to publish to YouTube (and AtoPlay if configured).

## Optional variables

| Variable | Default | Meaning |
|---|---|---|
| `YT_PRIVACY` (repo *variable*) | `public` | YouTube privacy (`private`, `unlisted`, `public`) |
| `YT_CATEGORY_ID` (repo *variable*) | `28` | YouTube category id (28 = Science & Technology) |
| `ATOPLAY_CHANNEL_NAME` (repo *variable*) | `skillgrox` | AtoPlay channel to publish into |
| `ATOPLAY_CATEGORY` (env) | `Technology` | AtoPlay video category |
| `MOTIONGFX_TTS` (local dev) | off | set `1` to also synthesize TTS locally |

Daily schedule: `0 14 * * *` UTC (10:00 ET) in `.github/workflows/motiongfx_daily.yml`.

## Run locally (no secrets needed for render steps)

```bash
npm install
# English script (no API needed unless MOTIONGFX_TTS=1)
node pipeline/motiongfx/generate_script.mjs work/script.json
# Full render: TTS -> timing.json -> composition -> HyperFrames -> audio mix (BGM ducking + SFX)
node pipeline/motiongfx/render.mjs work work/script.json out/motion.mp4
# Composition only, from the timing.json that render.mjs writes:
node pipeline/motiongfx/build_composition.mjs work/timing.json work/composition.html voiceover.mp3
```

The render step requires `ffmpeg` and the HyperFrames Chrome browser
(`npx --yes hyperframes@0.7.68 browser ensure`) — both are installed automatically
on the GitHub runner.

## How Review-Before-Upload works

- Every render produces an R2 record `rv-<ts>-<hex>.json` in state `pending` plus the
  MP4 under `reviews/<id>/`.
- **Approve** → `review_publish.yml` re-checks the record is still `pending`
  (idempotent — double-clicks can't double-upload), uploads to YouTube via OAuth2,
  optionally to AtoPlay, and marks the record `approved`.
- **Discard** → `review_discard.yml` marks `discarded`, deletes the MP4 and all
  temp assets from R2, and notifies you. It deliberately has **no YouTube
  credentials and makes zero YouTube API calls** — discarding never burns quota.
