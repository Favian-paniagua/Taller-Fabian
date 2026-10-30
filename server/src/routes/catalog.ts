import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { isAdmin, requireAdmin } from "../auth.js";
import { db } from "../db/client.js";
import { PART_CATEGORIES, SERVICE_CATEGORIES } from "../db/catalog.js";
import { parts, services, stockMovements, users } from "../db/schema.js";
import { ah, HttpError, idParam, notFound, parse } from "../http.js";

export const catalogRouter = Router();

/** Bs con hasta 2 decimales → centavos. */
const money = z.number({ invalid_type_error: "Escribe un monto válido." }).min(0, "El monto no puede ser negativo.").max(1e8).transform((n) => Math.round(n * 100));

catalogRouter.get("/categories", ah((_req, res) => res.json({ services: SERVICE_CATEGORIES, parts: PART_CATEGORIES })));

/* ---------- Tarifario ---------- */

catalogRouter.get("/services", ah((req, res) => {
  const list = db.select().from(services).orderBy(asc(services.category), asc(services.name)).all()
    .filter((s) => s.active || (isAdmin(req) && req.query.all === "1"));
  res.json(isAdmin(req) ? list : list.map(({ price: _p, ...s }) => s));
}));

const serviceBody = z.object({
  name: z.string().trim().min(3, "Escribe el nombre del servicio."),
  category: z.enum(SERVICE_CATEGORIES as [string, ...string[]], { errorMap: () => ({ message: "Elige una categoría." }) }),
  price: money,
});

catalogRouter.post("/services", requireAdmin, ah((req, res) => {
  res.status(201).json(db.insert(services).values(parse(serviceBody, req.body)).returning().get());
}));

catalogRouter.patch("/services/:id", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const b = parse(serviceBody.partial().extend({ active: z.boolean().optional() }), req.body);
  const row = db.update(services).set(b).where(eq(services.id, id)).returning().get();
  if (!row) throw notFound("El servicio");
  res.json(row);
}));

/* ---------- Repuestos ---------- */

catalogRouter.get("/parts", ah((req, res) => {
  const list = db.select().from(parts).orderBy(asc(parts.code)).all().filter((p) => p.active || (isAdmin(req) && req.query.all === "1"));
  res.json(isAdmin(req) ? list : list.map(({ cost: _c, price: _p, ...p }) => p));
}));

const partBody = z.object({
  code: z.string().trim().toUpperCase().min(2, "Escribe el código.").max(30),
  name: z.string().trim().min(2, "Escribe el nombre del repuesto."),
  category: z.enum(PART_CATEGORIES as [string, ...string[]], { errorMap: () => ({ message: "Elige una categoría." }) }),
  cost: money,
  price: money,
  minStock: z.number().int().min(0).default(0),
  location: z.string().trim().max(20).default(""),
});

catalogRouter.post("/parts", requireAdmin, ah((req, res) => {
  const b = parse(partBody.extend({ stock: z.number().int().min(0).default(0) }), req.body);
  const now = Date.now();
  const row = db.transaction((tx) => {
    const p = tx.insert(parts).values({ ...b, createdAt: now }).returning().get();
    if (b.stock > 0) tx.insert(stockMovements).values({ partId: p.id, type: "ingreso", qty: b.stock, unitCost: b.cost, userId: req.user!.id, note: "Stock inicial", createdAt: now }).run();
    return p;
  });
  res.status(201).json(row);
}));

catalogRouter.patch("/parts/:id", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const b = parse(partBody.partial().extend({ active: z.boolean().optional() }), req.body);
  const row = db.update(parts).set(b).where(eq(parts.id, id)).returning().get();
  if (!row) throw notFound("El repuesto");
  res.json(row);
}));

/** Ingreso de mercadería: suma stock y actualiza costo y precio si se indican. */
catalogRouter.post("/parts/:id/ingreso", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ qty: z.number().int().min(1, "La cantidad debe ser mayor a cero."), cost: money.optional(), price: money.optional(), note: z.string().trim().max(200).default("") }), req.body);
  const row = db.transaction((tx) => {
    const p = tx.select().from(parts).where(eq(parts.id, id)).get();
    if (!p) throw notFound("El repuesto");
    const cost = b.cost ?? p.cost;
    tx.insert(stockMovements).values({ partId: id, type: "ingreso", qty: b.qty, unitCost: cost, userId: req.user!.id, note: b.note, createdAt: Date.now() }).run();
    return tx.update(parts).set({ stock: p.stock + b.qty, cost, price: b.price ?? p.price }).where(eq(parts.id, id)).returning().get();
  });
  res.json(row);
}));

/** Ajuste por conteo físico: deja el stock en el número contado y registra la diferencia. */
catalogRouter.post("/parts/:id/ajuste", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ stock: z.number().int().min(0), note: z.string().trim().min(3, "Escribe el motivo del ajuste.").max(200) }), req.body);
  const row = db.transaction((tx) => {
    const p = tx.select().from(parts).where(eq(parts.id, id)).get();
    if (!p) throw notFound("El repuesto");
    if (p.stock === b.stock) throw new HttpError(400, "El stock contado es igual al registrado.");
    tx.insert(stockMovements).values({ partId: id, type: "ajuste", qty: b.stock - p.stock, unitCost: p.cost, userId: req.user!.id, note: b.note, createdAt: Date.now() }).run();
    return tx.update(parts).set({ stock: b.stock }).where(eq(parts.id, id)).returning().get();
  });
  res.json(row);
}));

catalogRouter.get("/parts/:id/movements", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  res.json(db.select({ id: stockMovements.id, type: stockMovements.type, qty: stockMovements.qty, unitCost: stockMovements.unitCost, orderId: stockMovements.orderId, note: stockMovements.note, createdAt: stockMovements.createdAt, userName: users.name })
    .from(stockMovements).leftJoin(users, eq(users.id, stockMovements.userId))
    .where(eq(stockMovements.partId, id)).orderBy(desc(stockMovements.id)).limit(50).all());
}));
