import os from "node:os";
import { createApp } from "./app.js";
import { scheduleBackups } from "./backup.js";
import { migrateDb } from "./db/client.js";
import { announceCredentials, seedBase } from "./db/seed.js";
import { env } from "./env.js";

migrateDb();
const creds = seedBase();
if (creds) announceCredentials(creds);

const app = createApp();
app.listen(env.port, env.host, () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => `http://${i!.address}:${env.port}`);
  console.log("\n  Sistema del Taller Mecánico Fabián en marcha");
  console.log(`  En esta PC:          http://localhost:${env.port}`);
  for (const u of lan) console.log(`  Desde el celular:    ${u}  (conectado al WiFi del taller)`);
  console.log(`  Base de datos:       ${env.dbFile}`);
  console.log(`  Copias de seguridad: ${env.backupDir}\n`);
});
scheduleBackups();
