import { Router } from "express";
import { desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { db } from "../db/client.js";
import { clients, orders, payments, vehicles } from "../db/schema.js";
import { ah, idParam, notFound, parse } from "../http.js";
import { ACTIVE_STATES, normPlate } from "../services/orders.js";

export const clientsRouter = Router();
clientsRouter.use(requireAdmin);

const clientBody = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del cliente."),
  phone: z.string().trim().transform((s) => s.replace(/\D/g, "")).refine((s) => s === "" || s.length === 8, "El celular debe tener 8 dígitos."),
  ci: z.string().trim().max(20).default(""),
  notes: z.string().trim().max(500).default(""),
});
const vehicleBody = z.object({
  type: z.enum(["auto", "moto"]),
  plate: z.string().transform(normPlate).refine((s) => s.length >= 5 && s.length <= 8, "Revisa la placa."),
  brand: z.string().trim().min(1, "Escribe la marca."),
  model: z.string().trim().min(1, "Escribe el modelo."),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  color: z.string().trim().max(30).default(""),
  km: z.number().int().min(0).default(0),
});

clientsRouter.get("/clients", ah((req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const qd = q.replace(/[\s-]/g, "").toUpperCase();
  const base = db.select().from(clients);
  const list = (q
    ? base.where(or(
        like(sql`lower(${clients.name})`, `%${q}%`), like(clients.ci, `%${q}%`), like(clients.phone, `%${q}%`),
        inArray(clients.id, db.select({ id: vehicles.clientId }).from(vehicles).where(like(vehicles.plate, `%${qd}%`))),
      ))
    : base).all();
  const vs = db.select({ id: vehicles.id, clientId: vehicles.clientId, plate: vehicles.plate, brand: vehicles.brand, model: vehicles.model, type: vehicles.type }).from(vehicles).all();
  const last = db.select({ clientId: orders.clientId, last: sql<number>`max(${orders.createdAt})`, visits: sql<number>`count(*)` }).from(orders).groupBy(orders.clientId).all();
  res.json(list.map((c) => {
    const l = last.find((x) => x.clientId === c.id);
    return { ...c, vehicles: vs.filter((v) => v.clientId === c.id), lastVisit: l?.last ?? null, visits: l?.visits ?? 0 };
  }).sort((a, b) => (b.lastVisit ?? 0) - (a.lastVisit ?? 0)));
}));

clientsRouter.get("/clients/:id", ah((req, res) => {
  const id = idParam(req);
  const c = db.select().from(clients).where(eq(clients.id, id)).get();
  if (!c) throw notFound("El cliente");
  const vs = db.select().from(vehicles).where(eq(vehicles.clientId, id)).all();
  const spent = db.select({ t: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(eq(orders.clientId, id)).get()!.t;
  res.json({ ...c, vehicles: vs, spent });
}));

clientsRouter.post("/clients", ah((req, res) => {
  const b = parse(clientBody, req.body);
  const row = db.insert(clients).values({ ...b, createdAt: Date.now() }).returning().get();
  res.status(201).json(row);
}));

clientsRouter.patch("/clients/:id", ah((req, res) => {
  const id = idParam(req);
  const b = parse(clientBody.partial(), req.body);
  if (!db.select({ id: clients.id }).from(clients).where(eq(clients.id, id)).get()) throw notFound("El cliente");
  res.json(db.update(clients).set(b).where(eq(clients.id, id)).returning().get());
}));

clientsRouter.post("/clients/:id/vehicles", ah((req, res) => {
  const clientId = idParam(req);
  if (!db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).get()) throw notFound("El cliente");
  const b = parse(vehicleBody, req.body);
  res.status(201).json(db.insert(vehicles).values({ ...b, year: b.year ?? null, clientId, createdAt: Date.now() }).returning().get());
}));

clientsRouter.patch("/vehicles/:id", ah((req, res) => {
  const id = idParam(req);
  const b = parse(vehicleBody.partial().extend({ clientId: z.number().int().positive().optional() }), req.body);
  if (!db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).get()) throw notFound("El vehículo");
  res.json(db.update(vehicles).set(b).where(eq(vehicles.id, id)).returning().get());
}));

/** Búsqueda de vehículos para abrir una orden. Sin texto, devuelve los clientes recientes que no están en el taller. */
clientsRouter.get("/vehicles/search", ah((req, res) => {
  const q = String(req.query.q ?? "").trim();
  const busy = new Set(db.select({ v: orders.vehicleId }).from(orders).where(inArray(orders.state, ACTIVE_STATES)).all().map((x) => x.v));
  const cols = { id: vehicles.id, plate: vehicles.plate, brand: vehicles.brand, model: vehicles.model, year: vehicles.year, type: vehicles.type, km: vehicles.km, clientId: clients.id, clientName: clients.name };
  let rows;
  if (q) {
    const ql = `%${q.toLowerCase()}%`, qp = `%${normPlate(q)}%`;
    rows = db.select(cols).from(vehicles).innerJoin(clients, eq(clients.id, vehicles.clientId))
      .where(or(like(vehicles.plate, qp), like(sql`lower(${clients.name})`, ql), like(sql`lower(${vehicles.brand} || ' ' || ${vehicles.model})`, ql)))
      .limit(10).all();
  } else {
    const recent = db.select({ v: orders.vehicleId, t: sql<number>`max(${orders.createdAt})` }).from(orders).groupBy(orders.vehicleId).orderBy(desc(sql`max(${orders.createdAt})`)).limit(20).all()
      .filter((r) => !busy.has(r.v)).slice(0, 6).map((r) => r.v);
    rows = recent.length ? db.select(cols).from(vehicles).innerJoin(clients, eq(clients.id, vehicles.clientId)).where(inArray(vehicles.id, recent)).all()
      .sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id)) : [];
  }
  res.json(rows.map((r) => ({ ...r, inShop: busy.has(r.id) })));
}));

