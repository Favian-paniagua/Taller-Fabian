import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { count } from "drizzle-orm";
import { hashPassword } from "../auth.js";
import { env } from "../env.js";
import { db, migrateDb } from "./client.js";
import { DEFAULT_SETTINGS, PARTS, SERVICES } from "./catalog.js";
import { parts, services, settings, users } from "./schema.js";

const bs = (n: number) => Math.round(n * 100);

/** Contraseña inicial fácil de dictar: sin letras que se confundan (0/O, 1/l). */
export function randomPassword(len = 8) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(len), (b) => abc[b % abc.length]).join("");
}

/**
 * Datos iniciales del taller: configuración, usuario administrador, tarifario y catálogo de repuestos (con stock en 0).
 * Solo se ejecuta si la base está vacía. Devuelve las credenciales del administrador cuando lo crea.
 */
export function seedBase(opts: { adminPassword?: string; withCatalog?: boolean } = {}) {
  const now = Date.now();
  const hasUsers = db.select({ n: count() }).from(users).get()!.n > 0;
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    db.insert(settings).values({ key, value }).onConflictDoNothing().run();
  }
  if (hasUsers) return null;
  const password = opts.adminPassword || process.env.ADMIN_PASSWORD || randomPassword();
  db.transaction((tx) => {
    tx.insert(users).values({ name: "Fabián", username: "fabian", passwordHash: hashPassword(password), role: "admin", specialty: "Dueño", createdAt: now }).run();
    if (tx.select({ n: count() }).from(services).get()!.n === 0) {
      tx.insert(services).values(SERVICES.map(([name, category, price]) => ({ name, category, price: bs(price) }))).run();
    }
    if (opts.withCatalog !== false && tx.select({ n: count() }).from(parts).get()!.n === 0) {
      tx.insert(parts).values(PARTS.map(([code, name, category, cost, price, minStock, location]) => ({ code, name, category, cost: bs(cost), price: bs(price), minStock, location, stock: 0, createdAt: now }))).run();
    }
  });
  return { username: "fabian", password };
}

/** Guarda las credenciales iniciales en un archivo para que no se pierdan, y las muestra en pantalla. */
export function announceCredentials(c: { username: string; password: string }) {
  const msg = [
    "",
    "  Primer ingreso al sistema del taller",
    "  ------------------------------------",
    `  Usuario:    ${c.username}`,
    `  Contraseña: ${c.password}`,
    "",
    "  Cámbiala en Ajustes > Mi cuenta después de entrar.",
    "",
  ].join("\n");
  console.log(msg);
  if (env.dbFile !== ":memory:") {
    try { fs.writeFileSync(path.join(env.dataDir, "primer-ingreso.txt"), msg.trim() + "\n"); } catch { /* no es crítico */ }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrateDb();
  const c = seedBase();
  if (c) announceCredentials(c);
  else console.log("La base ya tenía datos: no se cambió nada.");
}
