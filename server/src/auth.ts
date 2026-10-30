import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "./db/client.js";
import { sessions, users } from "./db/schema.js";
import { env } from "./env.js";
import { forbidden, HttpError } from "./http.js";

export const COOKIE = "taller_sesion";

export type SessionUser = { id: number; name: string; username: string; role: "admin" | "mecanico"; specialty: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const hashPassword = (plain: string) => bcrypt.hashSync(plain, 10);
export const checkPassword = (plain: string, hash: string) => bcrypt.compareSync(plain, hash);
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db.insert(sessions).values({ id: sha(token), userId, createdAt: now, expiresAt: now + env.sessionDays * 86400e3 }).run();
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
  return token;
}

export function destroySession(token?: string) {
  if (token) db.delete(sessions).where(eq(sessions.id, sha(token))).run();
}

export function destroyUserSessions(userId: number) {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "strict" as const,
  secure: false, // la red del taller es local (http); en la nube con https se cambia a true
  maxAge: env.sessionDays * 86400e3,
  path: "/",
});

/** Lee la cookie de sesión y carga el usuario en req.user. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    const row = db
      .select({ id: users.id, name: users.name, username: users.username, role: users.role, specialty: users.specialty })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, sha(token)), gt(sessions.expiresAt, Date.now()), eq(users.active, true)))
      .get();
    if (row) req.user = row;
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Tu sesión terminó. Vuelve a ingresar."));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Tu sesión terminó. Vuelve a ingresar."));
  if (req.user.role !== "admin") return next(forbidden());
  next();
}

export const isAdmin = (req: Request) => req.user?.role === "admin";
