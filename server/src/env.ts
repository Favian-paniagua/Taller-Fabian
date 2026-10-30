import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Carpeta raíz del paquete del servidor (funciona igual desde src/ con tsx y desde dist/ compilado). */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Si existe server/.env, se cargan sus valores (por ejemplo BACKUP_EXTRA_DIR o PORT). */
const envFile = path.join(SERVER_ROOT, ".env");
if (fs.existsSync(envFile) && process.env.NODE_ENV !== "test") {
  try { process.loadEnvFile(envFile); } catch (e) { console.warn("No se pudo leer server/.env:", e); }
}

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(SERVER_ROOT, "data");

export const env = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
  dataDir,
  dbFile: process.env.DB_FILE || path.join(dataDir, "taller.db"),
  backupDir: process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(dataDir, "copias"),
  /** Carpeta extra opcional para una segunda copia (por ejemplo, una memoria USB o una carpeta de Google Drive). */
  backupExtraDir: process.env.BACKUP_EXTRA_DIR ? path.resolve(process.env.BACKUP_EXTRA_DIR) : "",
  backupKeep: Number(process.env.BACKUP_KEEP || 30),
  migrationsDir: path.join(SERVER_ROOT, "drizzle"),
  webDist: path.resolve(SERVER_ROOT, "..", "web", "dist"),
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  isTest: process.env.NODE_ENV === "test",
};
