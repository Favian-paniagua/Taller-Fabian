import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { SessionUser } from "../auth.js";
import { db } from "../db/client.js";
import { clients, orderEvents, orderItems, orders, parts, payments, services, stockMovements, users, vehicles, type OrderState } from "../db/schema.js";
import { forbidden, HttpError, notFound } from "../http.js";

export const ACTIVE_STATES: OrderState[] = ["revision", "presupuesto", "reparacion", "listo"];
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const isAdmin = (u: SessionUser) => u.role === "admin";

function nextOrderNumber(tx: Tx) {
  const r = tx.select({ n: sql<number>`coalesce(max(${orders.number}), 0)` }).from(orders).get();
  return Math.max(100, r?.n ?? 0) + 1;
}
function nextReceiptNumber(tx: Tx) {
  const r = tx.select({ n: sql<number>`coalesce(max(${payments.receiptNumber}), 0)` }).from(payments).get();
  return (r?.n ?? 0) + 1;
}
function logEvent(tx: Tx, orderId: number, type: string, user: SessionUser | null, note = "") {
  tx.insert(orderEvents).values({ orderId, type, userId: user?.id ?? null, note, createdAt: Date.now() }).run();
}
function touch(tx: Tx, orderId: number, extra: Partial<typeof orders.$inferInsert> = {}) {
  tx.update(orders).set({ updatedAt: Date.now(), ...extra }).where(eq(orders.id, orderId)).run();
}

function getOrderRow(id: number, tx: Tx | typeof db = db) {
  const o = tx.select().from(orders).where(eq(orders.id, id)).get();
  if (!o) throw notFound("La orden");
  return o;
}

/** Un mecánico solo puede tocar las órdenes asignadas a él. */
function assertCanSee(o: { mechanicId: number | null }, user: SessionUser) {
  if (!isAdmin(user) && o.mechanicId !== user.id) throw forbidden();
}
function assertOpen(o: { state: OrderState }) {
  if (o.state === "entregado" || o.state === "cancelado") throw new HttpError(409, "Esta orden ya está cerrada y no se puede cambiar.");
}

/* ---------------- Listados ---------------- */

const totalsSub = db
  .select({
    orderId: orderItems.orderId,
    total: sql<number>`sum(${orderItems.qty} * ${orderItems.unitPrice})`.as("total"),
    itemsCount: sql<number>`count(*)`.as("items_count"),
  })
  .from(orderItems)
  .groupBy(orderItems.orderId)
  .as("t");

export type ListFilter = { scope?: "activas" | "entregadas" | "todas"; q?: string; mechanicId?: number; limit?: number; vehicleId?: number; clientId?: number };

export function listOrders(f: ListFilter, user: SessionUser) {
  const conds: SQL[] = [];
  if (f.scope === "activas" || !f.scope) conds.push(inArray(orders.state, ACTIVE_STATES));
  if (f.scope === "entregadas") conds.push(eq(orders.state, "entregado"));
  if (!isAdmin(user)) conds.push(eq(orders.mechanicId, user.id));
  else if (f.mechanicId) conds.push(eq(orders.mechanicId, f.mechanicId));
  if (f.vehicleId) conds.push(eq(orders.vehicleId, f.vehicleId));
  if (f.clientId) conds.push(eq(orders.clientId, f.clientId));
  if (f.q?.trim()) {
    const q = `%${f.q.trim().toLowerCase()}%`;
    const qPlate = `%${f.q.replace(/[\s-]/g, "").toUpperCase()}%`;
    const asNum = Number(f.q.replace(/\D/g, ""));
    const or_ = [like(sql`lower(${clients.name})`, q), like(vehicles.plate, qPlate), like(sql`lower(${vehicles.brand} || ' ' || ${vehicles.model})`, q), like(sql`lower(${orders.reason})`, q)];
    if (asNum) or_.push(eq(orders.number, asNum));
    conds.push(or(...or_)!);
  }
  const rows = db
    .select({
      id: orders.id, number: orders.number, state: orders.state, waiting: orders.waiting, reason: orders.reason,
      createdAt: orders.createdAt, deliveredAt: orders.deliveredAt, km: orders.km,
      total: totalsSub.total, itemsCount: totalsSub.itemsCount,
      vehicle: { id: vehicles.id, plate: vehicles.plate, brand: vehicles.brand, model: vehicles.model, year: vehicles.year, type: vehicles.type },
      client: { id: clients.id, name: clients.name, phone: clients.phone },
      mechanicId: orders.mechanicId, mechanicName: users.name,
      paidMethod: payments.method, paidAt: payments.createdAt, paidAmount: payments.amount,
    })
    .from(orders)
    .innerJoin(vehicles, eq(vehicles.id, orders.vehicleId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .leftJoin(users, eq(users.id, orders.mechanicId))
    .leftJoin(totalsSub, eq(totalsSub.orderId, orders.id))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(orders.number))
    .limit(Math.min(f.limit ?? 200, 1000))
    .all();
  return rows.map((r) => {
    const out = {
      id: r.id, number: r.number, state: r.state, waiting: r.waiting, reason: r.reason, createdAt: r.createdAt, deliveredAt: r.deliveredAt, km: r.km,
      total: r.total ?? 0, itemsCount: r.itemsCount ?? 0, vehicle: r.vehicle, client: r.client as { id: number; name: string; phone?: string },
      mechanic: r.mechanicId ? { id: r.mechanicId, name: r.mechanicName ?? "" } : null,
      payment: r.paidMethod ? { method: r.paidMethod, createdAt: r.paidAt, amount: r.paidAmount } : null,
    };
    return isAdmin(user) ? out : stripMoney(out);
  });
}

function stripMoney<T extends { total?: number; payment?: unknown; client?: { phone?: string } }>(o: T) {
  const c = { ...o } as Record<string, unknown>;
  delete c.total;
  delete c.payment;
  if (o.client) c.client = { ...o.client, phone: undefined };
  return c as T;
}

/* ---------------- Detalle ---------------- */

export function getOrder(id: number, user: SessionUser) {
  const o = getOrderRow(id);
  assertCanSee(o, user);
  const vehicle = db.select().from(vehicles).where(eq(vehicles.id, o.vehicleId)).get()!;
  const client = db.select().from(clients).where(eq(clients.id, o.clientId)).get()!;
  const mechanic = o.mechanicId ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, o.mechanicId)).get() ?? null : null;
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.id).all();
  const events = db
    .select({ type: orderEvents.type, note: orderEvents.note, createdAt: orderEvents.createdAt, userName: users.name })
    .from(orderEvents).leftJoin(users, eq(users.id, orderEvents.userId))
    .where(eq(orderEvents.orderId, id)).orderBy(orderEvents.id).all();
  const payment = db.select().from(payments).where(eq(payments.orderId, id)).get() ?? null;
  const previous = db
    .select({ id: orders.id, number: orders.number, state: orders.state, reason: orders.reason, createdAt: orders.createdAt, km: orders.km, total: totalsSub.total })
    .from(orders).leftJoin(totalsSub, eq(totalsSub.orderId, orders.id))
    .where(and(eq(orders.vehicleId, o.vehicleId), sql`${orders.id} <> ${id}`))
    .orderBy(desc(orders.createdAt)).limit(8).all();
  const total = items.reduce((a, x) => a + x.qty * x.unitPrice, 0);
  const full = {
    ...o, objects: safeJson(o.objects), vehicle, client, mechanic, events, payment, total,
    items: items.map((x) => ({ id: x.id, kind: x.kind, serviceId: x.serviceId, partId: x.partId, name: x.name, category: x.category, qty: x.qty, unitPrice: x.unitPrice, toBuy: x.toBuy })),
    previous: previous.map((p) => ({ ...p, total: p.total ?? 0 })),
  };
  if (isAdmin(user)) return full;
  return {
    ...full, total: undefined, payment: payment ? { method: payment.method, createdAt: payment.createdAt } : null,
    client: { id: client.id, name: client.name },
    items: full.items.map((x) => ({ ...x, unitPrice: undefined })),
    previous: full.previous.map((p) => ({ ...p, total: undefined })),
  };
}
const safeJson = (s: string): string[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };

/* ---------------- Crear ---------------- */

export type NewOrderInput = {
  vehicleId?: number;
  newVehicle?: { type: "auto" | "moto"; plate: string; brand: string; model: string; year?: number | null; color?: string; clientId?: number; newClient?: { name: string; phone: string; ci?: string } };
  reason: string; km?: number | null; fuel: number; objects: string[]; mechanicId?: number | null;
};

export const normPlate = (p: string) => p.toUpperCase().replace(/[^0-9A-Z]/g, "");

export function createOrder(input: NewOrderInput, user: SessionUser) {
  const now = Date.now();
  return db.transaction((tx) => {
    let vehicleId = input.vehicleId;
    if (!vehicleId) {
      const nv = input.newVehicle;
      if (!nv) throw new HttpError(400, "Elige un vehículo o registra uno nuevo.");
      let clientId = nv.clientId;
      if (!clientId) {
        if (!nv.newClient) throw new HttpError(400, "Falta el cliente del vehículo.");
        clientId = tx.insert(clients).values({ name: nv.newClient.name.trim(), phone: nv.newClient.phone.replace(/\D/g, ""), ci: nv.newClient.ci?.trim() || "", createdAt: now }).returning({ id: clients.id }).get().id;
      } else if (!tx.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).get()) throw notFound("El cliente");
      const plate = normPlate(nv.plate);
      if (tx.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.plate, plate)).get()) throw new HttpError(409, `La placa ${plate} ya está registrada. Búscala en la lista.`);
      vehicleId = tx.insert(vehicles).values({ clientId, type: nv.type, plate, brand: nv.brand.trim(), model: nv.model.trim(), year: nv.year ?? null, color: nv.color?.trim() || "", km: input.km ?? 0, createdAt: now }).returning({ id: vehicles.id }).get().id;
    }
    const v = tx.select().from(vehicles).where(eq(vehicles.id, vehicleId)).get();
    if (!v) throw notFound("El vehículo");
    const busy = tx.select({ n: orders.number }).from(orders).where(and(eq(orders.vehicleId, v.id), inArray(orders.state, ACTIVE_STATES))).get();
    if (busy) throw new HttpError(409, `Este vehículo ya está en el taller con la orden N° ${busy.n}.`);
    if (input.km && input.km > v.km) tx.update(vehicles).set({ km: input.km }).where(eq(vehicles.id, v.id)).run();
    if (input.mechanicId) assertMechanic(tx, input.mechanicId);
    const number = nextOrderNumber(tx);
    const id = tx.insert(orders).values({
      number, vehicleId: v.id, clientId: v.clientId, mechanicId: input.mechanicId ?? null, state: "revision",
      reason: input.reason.trim(), km: input.km || v.km, fuel: input.fuel, objects: JSON.stringify(input.objects ?? []),
      createdAt: now, updatedAt: now,
    }).returning({ id: orders.id }).get().id;
    logEvent(tx, id, "creada", user);
    return id;
  });
}

function assertMechanic(tx: Tx, id: number) {
  const m = tx.select({ id: users.id, active: users.active }).from(users).where(eq(users.id, id)).get();
  if (!m || !m.active) throw new HttpError(400, "El mecánico elegido no existe o está desactivado.");
}

/* ---------------- Trabajos y repuestos ---------------- */

function assertCanEditItems(o: typeof orders.$inferSelect, user: SessionUser) {
  assertCanSee(o, user);
  assertOpen(o);
  if (!isAdmin(user) && o.state !== "revision") throw new HttpError(403, "Solo puedes anotar trabajos mientras la orden está en revisión.");
}

export function addItem(orderId: number, input: { kind: "servicio" | "repuesto"; refId: number; qty?: number }, user: SessionUser) {
  return db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertCanEditItems(o, user);
    const qty = Math.max(1, input.qty ?? 1);
    let toBuy = false;
    if (input.kind === "servicio") {
      const s = tx.select().from(services).where(eq(services.id, input.refId)).get();
      if (!s || !s.active) throw notFound("El servicio");
      const ex = tx.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.serviceId, s.id))).get();
      if (ex) tx.update(orderItems).set({ qty: ex.qty + qty }).where(eq(orderItems.id, ex.id)).run();
      else tx.insert(orderItems).values({ orderId, kind: "servicio", serviceId: s.id, name: s.name, category: s.category, qty, unitPrice: s.price, createdAt: Date.now() }).run();
    } else {
      const p = tx.select().from(parts).where(eq(parts.id, input.refId)).get();
      if (!p || !p.active) throw notFound("El repuesto");
      const fromStock = Math.min(p.stock, qty);
      toBuy = fromStock < qty;
      if (fromStock > 0) {
        tx.update(parts).set({ stock: p.stock - fromStock }).where(eq(parts.id, p.id)).run();
        tx.insert(stockMovements).values({ partId: p.id, type: "salida", qty: -fromStock, unitCost: p.cost, orderId, userId: user.id, createdAt: Date.now() }).run();
      }
      const ex = tx.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.partId, p.id))).get();
      if (ex) tx.update(orderItems).set({ qty: ex.qty + qty, toBuy: ex.toBuy || toBuy }).where(eq(orderItems.id, ex.id)).run();
      else tx.insert(orderItems).values({ orderId, kind: "repuesto", partId: p.id, name: p.name, category: p.category, qty, unitPrice: p.price, unitCost: p.cost, toBuy, createdAt: Date.now() }).run();
    }
    touch(tx, orderId);
    return { toBuy };
  });
}

/** Cambia la cantidad de un repuesto o servicio; devuelve al stock lo que se quita. */
export function setItemQty(orderId: number, itemId: number, qty: number, user: SessionUser) {
  return db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertCanEditItems(o, user);
    const it = tx.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).get();
    if (!it) throw notFound("El ítem");
    if (qty < 1) throw new HttpError(400, "La cantidad mínima es 1.");
    const d = qty - it.qty;
    let toBuy = it.toBuy;
    if (it.kind === "repuesto" && it.partId && d !== 0) {
      const p = tx.select().from(parts).where(eq(parts.id, it.partId)).get()!;
      if (d > 0) {
        const take = Math.min(p.stock, d);
        if (take < d) toBuy = true;
        if (take > 0) {
          tx.update(parts).set({ stock: p.stock - take }).where(eq(parts.id, p.id)).run();
          tx.insert(stockMovements).values({ partId: p.id, type: "salida", qty: -take, unitCost: p.cost, orderId, userId: user.id, createdAt: Date.now() }).run();
        }
      } else if (!it.toBuy) {
        tx.update(parts).set({ stock: p.stock - d }).where(eq(parts.id, p.id)).run();
        tx.insert(stockMovements).values({ partId: p.id, type: "devolucion", qty: -d, unitCost: p.cost, orderId, userId: user.id, createdAt: Date.now() }).run();
      }
    }
    tx.update(orderItems).set({ qty, toBuy }).where(eq(orderItems.id, itemId)).run();
    touch(tx, orderId);
    return { toBuy };
  });
}

export function removeItem(orderId: number, itemId: number, user: SessionUser) {
  db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertCanEditItems(o, user);
    const it = tx.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).get();
    if (!it) throw notFound("El ítem");
    if (it.kind === "repuesto" && it.partId) returnPartToStock(tx, it, orderId, user);
    tx.delete(orderItems).where(eq(orderItems.id, itemId)).run();
    touch(tx, orderId);
  });
}

/** Devuelve al almacén lo que salió del stock para este ítem (lo marcado "para comprar" nunca salió). */
function returnPartToStock(tx: Tx, it: typeof orderItems.$inferSelect, orderId: number, user: SessionUser) {
  const out = tx.select({ n: sql<number>`coalesce(-sum(${stockMovements.qty}), 0)` }).from(stockMovements)
    .where(and(eq(stockMovements.orderId, orderId), eq(stockMovements.partId, it.partId!))).get()!.n;
  if (out > 0) {
    tx.update(parts).set({ stock: sql`${parts.stock} + ${out}` }).where(eq(parts.id, it.partId!)).run();
    tx.insert(stockMovements).values({ partId: it.partId!, type: "devolucion", qty: out, unitCost: it.unitCost, orderId, userId: user.id, createdAt: Date.now() }).run();
  }
}

/* ---------------- Flujo de 4 pasos ---------------- */

type Move = { from: OrderState; to: OrderState; event: string; mechanic: boolean };
const MOVES: Move[] = [
  { from: "revision", to: "presupuesto", event: "presupuesto", mechanic: true },
  { from: "presupuesto", to: "reparacion", event: "aprobado", mechanic: false },
  { from: "reparacion", to: "listo", event: "listo", mechanic: true },
  { from: "presupuesto", to: "revision", event: "vuelve", mechanic: false },
  { from: "reparacion", to: "presupuesto", event: "vuelve", mechanic: false },
  { from: "listo", to: "reparacion", event: "vuelve", mechanic: false },
];

export function moveOrder(orderId: number, to: OrderState, user: SessionUser) {
  db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertCanSee(o, user);
    assertOpen(o);
    const m = MOVES.find((x) => x.from === o.state && x.to === to);
    if (!m) throw new HttpError(409, "Ese cambio de paso no está permitido.");
    if (!isAdmin(user) && !m.mechanic) throw forbidden();
    if (to === "presupuesto" && m.event === "presupuesto") {
      const n = tx.select({ n: sql<number>`count(*)` }).from(orderItems).where(eq(orderItems.orderId, orderId)).get()!.n;
      if (!n) throw new HttpError(409, "Agrega al menos un trabajo antes de armar el presupuesto.");
    }
    touch(tx, orderId, { state: to, waiting: false, waitingNote: "" });
    logEvent(tx, orderId, m.event, user);
  });
}

export function setWaiting(orderId: number, waiting: boolean, note: string, user: SessionUser) {
  db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertCanSee(o, user);
    if (o.state !== "reparacion") throw new HttpError(409, "Solo se puede pausar una orden en reparación.");
    touch(tx, orderId, { waiting, waitingNote: waiting ? note.trim() : "" });
    logEvent(tx, orderId, waiting ? "espera" : "reanuda", user, note.trim());
  });
}

export function assignMechanic(orderId: number, mechanicId: number | null, user: SessionUser) {
  db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertOpen(o);
    if (mechanicId) assertMechanic(tx, mechanicId);
    touch(tx, orderId, { mechanicId });
    const name = mechanicId ? tx.select({ name: users.name }).from(users).where(eq(users.id, mechanicId)).get()?.name ?? "" : "sin asignar";
    logEvent(tx, orderId, "mecanico", user, name);
  });
}

export function updateReception(orderId: number, input: { reason?: string; km?: number; fuel?: number; objects?: string[] }, user: SessionUser) {
  db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertOpen(o);
    touch(tx, orderId, {
      ...(input.reason !== undefined ? { reason: input.reason.trim() } : {}),
      ...(input.km !== undefined ? { km: input.km } : {}),
      ...(input.fuel !== undefined ? { fuel: input.fuel } : {}),
      ...(input.objects !== undefined ? { objects: JSON.stringify(input.objects) } : {}),
    });
    if (input.km) tx.update(vehicles).set({ km: sql`max(${vehicles.km}, ${input.km})` }).where(eq(vehicles.id, o.vehicleId)).run();
    logEvent(tx, orderId, "recepcion", user);
  });
}

export function cancelOrder(orderId: number, reason: string, user: SessionUser) {
  db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertOpen(o);
    const items = tx.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.kind, "repuesto"))).all();
    for (const it of items) returnPartToStock(tx, it, orderId, user);
    touch(tx, orderId, { state: "cancelado", waiting: false });
    logEvent(tx, orderId, "cancelado", user, reason.trim());
  });
}

/* ---------------- Cobro y entrega ---------------- */

export function payOrder(orderId: number, input: { method: "efectivo" | "qr"; received?: number | null; reference?: string }, user: SessionUser) {
  return db.transaction((tx) => {
    const o = getOrderRow(orderId, tx);
    assertOpen(o);
    if (o.state !== "listo") throw new HttpError(409, "La orden tiene que estar lista para entregar antes de cobrarla.");
    const total = tx.select({ t: sql<number>`coalesce(sum(${orderItems.qty} * ${orderItems.unitPrice}), 0)` }).from(orderItems).where(eq(orderItems.orderId, orderId)).get()!.t;
    if (total <= 0) throw new HttpError(409, "La orden no tiene nada que cobrar.");
    if (input.method === "efectivo" && input.received != null && input.received < total) throw new HttpError(400, "El monto recibido es menor al total.");
    const now = Date.now();
    const receiptNumber = nextReceiptNumber(tx);
    tx.insert(payments).values({ orderId, method: input.method, amount: total, received: input.method === "efectivo" ? input.received ?? total : null, reference: input.reference?.trim() || "", receiptNumber, userId: user.id, createdAt: now }).run();
    touch(tx, orderId, { state: "entregado", deliveredAt: now, waiting: false });
    logEvent(tx, orderId, "entregado", user, input.method);
    return { receiptNumber, amount: total };
  });
}
