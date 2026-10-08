// compliance_check.mjs — GATE LEGAL of the channel automático #2. Before of publish a
// compilation, verifies that EVERYTHING the material sea usable legalmente and that the pieza sea
// TRANSFORMADORA. Sale 1 (BLOQUEA the publishing) if something not cumple. Sale 0 if is safe.
//
// Uso: node pipeline/compliance_check.mjs <manifest.json> [sources.json]
// manifest.json = { niche, clips:[{clip_id,source,license,url,attribution}], transform:{narration,editing,original_script} }
import fs from "node:fs";

const [manifestPath, sourcesPath = "channel/auto2/sources.seed.json"] = process.argv.slice(2);

function readJSON(p, dflt) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return dflt; } }
const src = readJSON(sourcesPath, {});
const allow = new Set((src.allow_licenses || []).map((s) => String(s).toLowerCase()));
const deny = new Set((src.deny_sources || []).map((s) => String(s).toLowerCase()));
const denyLic = new Set((src.deny_licenses || []).map((s) => String(s).toLowerCase()));
const m = readJSON(manifestPath, null);

const fails = [];
if (!m || !Array.isArray(m.clips) || !m.clips.length) {
  fails.push("manifiesto vacío o sin clips");
} else {
  m.clips.forEach((c, i) => {
    const lic = String(c.license || "").toLowerCase();
    const source = String(c.source || "unknown").toLowerCase();
    const tag = c.clip_id || c.url || `clip#${i + 1}`;
    if (deny.has(source)) fails.push(`${tag}: fuente PROHIBIDA (${source})`);
    else if (denyLic.has(lic)) fails.push(`${tag}: licencia PROHIBIDA (${lic} — share-alike/no-comercial no sirven para monetizar)`);
    else if (!allow.has(lic)) fails.push(`${tag}: licencia no permitida (${lic || "sin licencia"})`);
    // CC-BY (and CC-BY-SA if is colara) exigen atribución.
    if ((lic === "cc-by") && !String(c.attribution || "").trim()) fails.push(`${tag}: CC-BY sin atribución`);
  });
}

// The pieza must ser TRANSFORMADORA. Dos caminos válidos:
//  to) narration original (voice that agrega valor), or
//  b) piezas of SOUND (ASMR/relax): curaduría + edición/secuencia + diseño of sound original.
// Basta with UNO. Lo that NOT vale is re-upload clips tal cual, without edición nor curaduría.
const tr = (m && m.transform) || {};
const transformador = !!tr.narration || (!!tr.editing && !!tr.original_script) || !!tr.sound_design;
if (!transformador) fails.push("la pieza no es transformadora (sin narración, ni edición/guion, ni diseño de sonido original)");

if (fails.length) {
  fs.writeFileSync("compliance_fail.txt", fails.join("\n"));
  console.error("🚫 COMPLIANCE FALLA — NO se publica:\n- " + fails.join("\n- "));
  process.exit(1);
}
console.log(`✅ Compliance OK: ${m.clips.length} clips con licencia + pieza transformadora. Seguro publicar.`);
process.exit(0);
