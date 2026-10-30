/**
 * Recupera el acceso si se olvida la contraseña del administrador.
 * Uso: npm run cambiar-clave -- fabian NuevaClave123
 */
import { eq } from "drizzle-orm";
import { destroyUserSessions, hashPassword } from "../auth.js";
import { db, migrateDb } from "../db/client.js";
import { users } from "../db/schema.js";

migrateDb();
const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 6) {
  console.log("Uso: npm run cambiar-clave -- <usuario> <nueva contraseña de 6 o más caracteres>");
  process.exit(1);
}
const u = db.select().from(users).where(eq(users.username, username.toLowerCase())).get();
if (!u) {
  console.log(`No existe el usuario "${username}".`);
  process.exit(1);
}
db.update(users).set({ passwordHash: hashPassword(password), active: true }).where(eq(users.id, u.id)).run();
destroyUserSessions(u.id);
console.log(`Listo: la contraseña de ${u.name} (${u.username}) se cambió.`);
