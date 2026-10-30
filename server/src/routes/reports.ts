import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { db } from "../db/client.js";
import { cashClosings } from "../db/schema.js";
import { ah, HttpError, parse } from "../http.js";
import { dashboard, todayCash, type Period } from "../services/dashboard.js";

export const reportsRouter = Router();
reportsRouter.use(requireAdmin);

reportsRouter.get("/dashboard", ah((req, res) => {
  const p = String(req.query.period ?? "mes");
  const period: Period = p === "semana" || p === "trimestre" ? p : "mes";
  res.json(dashboard(period));
}));

reportsRouter.get("/cash/today", ah((_req, res) => {
  const t = todayCash();
  const closing = db.select().from(cashClosings).where(eq(cashClosings.day, t.day)).get() ?? null;
  res.json({ ...t, closing });
}));

reportsRouter.post("/cash/close", ah((req, res) => {
  const { counted } = parse(z.object({ counted: z.number({ invalid_type_error: "Escribe el efectivo contado." }).min(0) }), req.body);
  const t = todayCash();
  if (db.select().from(cashClosings).where(eq(cashClosings.day, t.day)).get()) throw new HttpError(409, "La caja de hoy ya está cerrada.");
  const row = db.insert(cashClosings).values({ day: t.day, expectedCash: t.cash, countedCash: Math.round(counted * 100), qrTotal: t.qr, userId: req.user!.id, createdAt: Date.now() }).returning().get();
  res.status(201).json(row);
}));
