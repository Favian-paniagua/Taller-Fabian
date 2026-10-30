import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../env.js";
import * as schema from "./schema.js";

if (env.dbFile !== ":memory:") fs.mkdirSync(path.dirname(env.dbFile), { recursive: true });

export const sqlite = new Database(env.dbFile);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;

/** Aplica las migraciones pendientes. Se llama al arrancar el servidor y en los scripts. */
export function migrateDb() {
  migrate(db, { migrationsFolder: env.migrationsDir });
}
