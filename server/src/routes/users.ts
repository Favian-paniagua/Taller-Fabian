import { Router } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { destroyUserSessions, hashPassword, requireAdmin } from "../auth.js";
import { db } from "../db/client.js";
import { orders, users } from "../db/schema.js";
import { ah, HttpError, idParam, notFound, parse } from "../http.js";
import { ACTIVE_STATES } from "../services/orders.js";

export const usersRouter = Router();

const pub = { id: users.id, name: users.name, username: users.username, role: users.role, specialty: users.specialty, active: users.active, createdAt: users.createdAt };

/** Mecánicos activos para asignar en las órdenes. */
usersRouter.get("/mechanics", ah((_req, res) => {
  res.json(db.select({ id: users.id, name: users.name, specialty: users.specialty }).from(users)
    .where(and(eq(users.role, "mecanico"), eq(users.active, true))).orderBy(asc(users.name)).all());
}));

usersRouter.get("/users", requireAdmin, ah((_req, res) => {
  const list = db.select(pub).from(users).orderBy(asc(users.role), asc(users.name)).all();
  const load = db.select({ id: orders.mechanicId, n: sql<number>`count(*)` }).from(orders).where(inArray(orders.state, ACTIVE_STATES)).groupBy(orders.mechanicId).all();
  res.json(list.map((u) => ({ ...u, activeOrders: load.find((l) => l.id === u.id)?.n ?? 0 })));
}));

const userBody = z.object({
  name: z.string().trim().min(2, "Escribe el nombre completo."),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "El usuario debe tener de 3 a 30 letras o números, sin espacios."),
  role: z.enum(["admin", "mecanico"]).default("mecanico"),
  specialty: z.string().trim().max(60).default(""),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

usersRouter.post("/users", requireAdmin, ah((req, res) => {
  const b = parse(userBody, req.body);
  const id = db.insert(users).values({ name: b.name, username: b.username, role: b.role, specialty: b.specialty, passwordHash: hashPassword(b.password), createdAt: Date.now() }).returning({ id: users.id }).get().id;
  res.status(201).json(db.select(pub).from(users).where(eq(users.id, id)).get());
}));

usersRouter.patch("/users/:id", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const b = parse(userBody.omit({ password: true }).partial().extend({ active: z.boolean().optional() }), req.body);
  const u = db.select().from(users).where(eq(users.id, id)).get();
  if (!u) throw notFound("El usuario");
  if (id === req.user!.id && (b.active === false || b.role === "mecanico")) throw new HttpError(400, "No puedes desactivarte ni quitarte el rol de administrador a ti mismo.");
  db.update(users).set(b).where(eq(users.id, id)).run();
  if (b.active === false) destroyUserSessions(id);
  res.json(db.select(pub).from(users).where(eq(users.id, id)).get());
}));

usersRouter.post("/users/:id/password", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const { password } = parse(z.object({ password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.") }), req.body);
  if (!db.select({ id: users.id }).from(users).where(eq(users.id, id)).get()) throw notFound("El usuario");
  db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, id)).run();
  if (id !== req.user!.id) destroyUserSessions(id);
  res.json({ ok: true });
}));
