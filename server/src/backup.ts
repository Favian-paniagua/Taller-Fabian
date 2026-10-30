import fs from "node:fs";
import path from "node:path";
import { sqlite } from "./db/client.js";
import { env } from "./env.js";

const NAME = /^taller-(\d{4}-\d{2}-\d{2})-(\d{4})\.db$/;
const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

export function listBackups() {
  if (!fs.existsSync(env.backupDir)) return [];
  return fs.readdirSync(env.backupDir).filter((f) => NAME.test(f)).map((f) => {
    const st = fs.statSync(path.join(env.backupDir, f));
    return { name: f, size: st.size, createdAt: st.mtimeMs };
  }).sort((a, b) => b.name.localeCompare(a.name));
}

/** Copia segura de la base (funciona aunque el sistema esté en uso) y borra las copias más viejas. */
export async function createBackup() {
  fs.mkdirSync(env.backupDir, { recursive: true });
  const name = `taller-${stamp()}.db`;
  const file = path.join(env.backupDir, name);
  await sqlite.backup(file);
  if (env.backupExtraDir) {
    try {
      fs.mkdirSync(env.backupExtraDir, { recursive: true });
      fs.copyFileSync(file, path.join(env.backupExtraDir, name));
    } catch (e) {
      console.warn("No se pudo guardar la copia extra en", env.backupExtraDir, e);
    }
  }
  for (const old of listBackups().slice(env.backupKeep)) fs.rmSync(path.join(env.backupDir, old.name), { force: true });
  return name;
}

export const backupPath = (name: string) => {
  if (!NAME.test(name)) return null;
  const p = path.join(env.backupDir, name);
  return fs.existsSync(p) ? p : null;
};

/** Una copia automática por día: revisa cada hora si ya se hizo la de hoy. */
export function scheduleBackups() {
  const today = () => stamp().slice(0, 10);
  const tick = () => {
    if (!listBackups().some((b) => b.name.startsWith(`taller-${today()}`))) {
      createBackup().then((n) => console.log(`Copia de seguridad guardada: ${n}`)).catch((e) => console.error("Falló la copia de seguridad:", e));
    }
  };
  setTimeout(tick, 10e3);
  return setInterval(tick, 3600e3);
}
