// hidden.mjs — ready of videos OCULTOS: never is programan nor is publican. Regla of Juan: lo oculto not sale.
// Fails CERRADO: if the ready not is can leer or not is valid devuelve null, and quien the uses NOT schedules nothing.
import fs from "node:fs";

export function parseHidden(text) {
  try {
    const j = JSON.parse(text);
    return Array.isArray(j) && j.every((x) => typeof x === "string") ? new Set(j) : null;
  } catch { return null; }
}

export function readHiddenFile(path) {
  try { return parseHidden(fs.readFileSync(path, "utf8")); } catch { return null; }
}

// Videos privados, without fecha of publishing futura and that not estén ocultos. Without ready valid: ninguno.
export function backlogToSchedule(videos, hidden, nowMs = Date.now()) {
  if (!(hidden instanceof Set)) return [];
  return (videos || []).filter((v) => {
    const st = (v && v.status) || {};
    const scheduled = st.publishAt && Date.parse(st.publishAt) > nowMs;
    return v && v.id && st.privacyStatus !== "public" && !scheduled && !hidden.has(v.id);
  }).map((v) => v.id);
}
