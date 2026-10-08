// llm_health.mjs — chequeo of qué proveedores of IA FREE are activos (tienen key and responden).
// Usage: node pipeline/llm_health.mjs   (needs the env/keys of the proveedores that quieras probar)
import { health } from "./llm.mjs";

const r = await health();
console.log("=== Proveedores de IA gratis ===");
for (const p of r) console.log(`${p.ok ? "✅" : "❌"} ${p.name.padEnd(14)} ${String(p.ms).padStart(5)}ms  ${p.sample || ""}`);
const okList = r.filter((p) => p.ok).map((p) => p.name);
console.log(`\nActivos: ${okList.length ? okList.join(", ") : "(ninguno — revisa keys)"}`);
// Conteo for the watchdog (the workflow avisa only if the cadena queda degradada).
try { const fs = await import("node:fs"); fs.writeFileSync("active_count.txt", String(okList.length)); } catch {}
