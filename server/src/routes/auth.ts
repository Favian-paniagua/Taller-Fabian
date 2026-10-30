import { Router } from "express";
import rateLimit from "express-rate-limit";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { checkPassword, COOKIE, cookieOptions, createSession, destroySession, destroyUserSessions, hashPassword, requireAuth } from "../auth.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { ah, HttpError, parse } from "../http.js";
import { env } from "../env.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60e3, limit: env.isTest ? 1000 : 10, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true,
  message: { error: "Demasiados intentos. Espera 15 minutos y vuelve a intentar." },
});

authRouter.post("/login", loginLimiter, ah((req, res) => {
  const { username, password } = parse(z.object({
    username: z.string({ required_error: "Escribe tu usuario." }).trim().min(1, "Escribe tu usuario."),
    password: z.string({ required_error: "Escribe tu contraseña." }).min(1, "Escribe tu contraseña."),
  }), req.body);
  const u = db.select().from(users).where(and(eq(users.username, username.toLowerCase()), eq(users.active, true))).get();
  if (!u || !checkPassword(password, u.passwordHash)) throw new HttpError(401, "Usuario o contraseña incorrectos.");
  res.cookie(COOKIE, createSession(u.id), cookieOptions());
  res.json({ user: { id: u.id, name: u.name, username: u.username, role: u.role, specialty: u.specialty } });
}));

authRouter.post("/logout", ah((req, res) => {
  destroySession(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}));

authRouter.get("/me", requireAuth, ah((req, res) => res.json({ user: req.user })));

authRouter.post("/password", requireAuth, ah((req, res) => {
  const { current, next } = parse(z.object({
    current: z.string().min(1, "Escribe tu contraseña actual."),
    next: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres."),
  }), req.body);
  const u = db.select().from(users).where(eq(users.id, req.user!.id)).get()!;
  if (!checkPassword(current, u.passwordHash)) throw new HttpError(400, "La contraseña actual no es correcta.");
  db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, u.id)).run();
  destroyUserSessions(u.id);
  res.cookie(COOKIE, createSession(u.id), cookieOptions());
  res.json({ ok: true });
}));
