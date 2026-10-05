// r2_tool.mjs — CLI minimalista para R2 via la API REST de Cloudflare
// (mismo patron que pipeline/comment_reply.mjs; sin wrangler).
//
// Uso:
//   node pipeline/lib/r2_tool.mjs get    <key> <outFile>
//   node pipeline/lib/r2_tool.mjs put    <key> <file> [contentType]
//   node pipeline/lib/r2_tool.mjs delete <key>
//   node pipeline/lib/r2_tool.mjs copy   <srcKey> <dstKey>
//   node pipeline/lib/r2_tool.mjs head   <key>          (imprime size o 1/0)
//
// Env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, BUCKET (default video-forge)
const [cmd, a, b, c] = process.argv.slice(2);
const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, BUCKET = "video-forge" } = process.env;
if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error("faltan CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");
  process.exit(1);
}
if (!cmd || !a) { console.error("uso: r2_tool.mjs get|put|delete|copy|head <key> [...]"); process.exit(1); }

const BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${BUCKET}/objects`;
const H = { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` };
const u = (key) => `${BASE}/${encodeURIComponent(key)}`;

async function run() {
  if (cmd === "get") {
    const r = await fetch(u(a), { headers: H });
    if (!r.ok) { console.error(`get ${a}: ${r.status}`); process.exit(1); }
    const buf = Buffer.from(await r.arrayBuffer());
    const fs = await import("node:fs");
    fs.mkdirSync(b.slice(0, Math.max(0, b.lastIndexOf("/") || -1)) || ".", { recursive: true });
    fs.writeFileSync(b, buf);
    console.log(`r2 get ${a} -> ${b} (${(buf.length / 1e6).toFixed(1)}MB)`);
  } else if (cmd === "put") {
    const fs = await import("node:fs");
    if (!fs.existsSync(a)) { console.error(`put: ${a} no existe`); process.exit(1); }
    const body = fs.readFileSync(a);
    const r = await fetch(u(b), { method: "PUT", headers: { ...H, "content-type": c || "application/octet-stream" }, body });
    if (!r.ok) { console.error(`put ${b}: ${r.status} ${(await r.text()).slice(0, 200)}`); process.exit(1); }
    console.log(`r2 put ${b} (${(body.length / 1e6).toFixed(1)}MB)`);
  } else if (cmd === "delete") {
    const r = await fetch(u(a), { method: "DELETE", headers: H });
    if (!r.ok && r.status !== 404) { console.error(`delete ${a}: ${r.status}`); process.exit(1); }
    console.log(`r2 delete ${a}`);
  } else if (cmd === "copy") {
    // La API REST de Cloudflare no tiene copy server-side: get + put.
    const src = await fetch(u(a), { headers: H });
    if (!src.ok) { console.error(`copy: ${a} no existe (${src.status})`); process.exit(1); }
    const buf = Buffer.from(await src.arrayBuffer());
    const r = await fetch(u(b), { method: "PUT", headers: { ...H, "content-type": src.headers.get("content-type") || "application/octet-stream" }, body: buf });
    if (!r.ok) { console.error(`copy ${a} -> ${b}: ${r.status} ${(await r.text()).slice(0, 200)}`); process.exit(1); }
    console.log(`r2 copy ${a} -> ${b} (${(buf.length / 1e6).toFixed(1)}MB)`);
  } else if (cmd === "head") {
    const r = await fetch(u(a), { method: "HEAD", headers: H });
    console.log(r.ok ? `${a} exists (${r.headers.get("content-length") || "?"} bytes)` : `${a} missing`);
    process.exit(r.ok ? 0 : 1);
  } else {
    console.error("comando desconocido"); process.exit(1);
  }
}
await run();
