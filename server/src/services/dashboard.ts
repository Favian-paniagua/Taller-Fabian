import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { SERVICE_CATEGORIES } from "../db/catalog.js";
import { clients, orderItems, orders, payments, users, vehicles } from "../db/schema.js";
import { ACTIVE_STATES } from "./orders.js";

export type Period = "semana" | "mes" | "trimestre";
const D = 86400e3;
const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };

/** Tres periodos que no se pisan: semana (por día), mes calendario (por día) y 3 meses (por semana). */
export function periodRange(p: Period, now = Date.now()) {
  const t0 = dayStart(now);
  if (p === "mes") {
    const d = new Date(t0);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    return { start, end: now, prevStart, prevEnd: Math.min(start, prevStart + (now - start)), unit: "day" as const };
  }
  if (p === "trimestre") {
    const wd = (new Date(t0).getDay() + 6) % 7;
    const start = addDays(t0, -wd - 12 * 7);
    const prevStart = addDays(start, -91);
    return { start, end: now, prevStart, prevEnd: prevStart + (now - start), unit: "week" as const };
  }
  const start = addDays(t0, -6), prevStart = addDays(start, -7);
  return { start, end: now, prevStart, prevEnd: prevStart + (now - start), unit: "day" as const };
}

type PaidOrder = { id: number; createdAt: number; paidAt: number; amount: number; method: "efectivo" | "qr"; mechanicId: number | null; items: { kind: string; name: string; category: string; qty: number; unitPrice: number; unitCost: number; serviceId: number | null; partId: number | null }[] };

function paidOrders(from: number, to: number): PaidOrder[] {
  const rows = db.select({ id: orders.id, createdAt: orders.createdAt, mechanicId: orders.mechanicId, paidAt: payments.createdAt, amount: payments.amount, method: payments.method })
    .from(payments).innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(gte(payments.createdAt, from), lt(payments.createdAt, to))).all();
  if (!rows.length) return [];
  const items = db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.id))).all();
  const by = new Map<number, PaidOrder["items"]>();
  for (const it of items) { const a = by.get(it.orderId) ?? []; a.push(it); by.set(it.orderId, a); }
  return rows.map((r) => ({ ...r, items: by.get(r.id) ?? [] }));
}

function kpis(os: PaidOrder[]) {
  const ingresos = os.reduce((a, o) => a + o.amount, 0), n = os.length;
  const hrs = n ? os.reduce((a, o) => a + (o.paidAt - o.createdAt) / 3600e3, 0) / n : 0;
  return { ingresos, n, ticket: n ? Math.round(ingresos / n) : 0, hrs };
}

export function dashboard(period: Period, now = Date.now()) {
  const r = periodRange(period, now);
  const all = paidOrders(Math.min(r.prevStart, r.start), r.end);
  const cur = all.filter((o) => o.paidAt >= r.start && o.paidAt < r.end);
  const prev = all.filter((o) => o.paidAt >= r.prevStart && o.paidAt < r.prevEnd);

  // Columnas por día o por semana
  const step = r.unit === "week" ? 7 : 1;
  const buckets: { t0: number; mo: number; rp: number; n: number; hrs: number; closed: boolean }[] = [];
  for (let t0 = r.start; t0 <= r.end; t0 = addDays(t0, step)) {
    const t1 = addDays(t0, step);
    let mo = 0, rp = 0, n = 0, hrs = 0;
    for (const o of cur) if (o.paidAt >= t0 && o.paidAt < t1) {
      n++; hrs += (o.paidAt - o.createdAt) / 3600e3;
      for (const x of o.items) x.kind === "servicio" ? (mo += x.qty * x.unitPrice) : (rp += x.qty * x.unitPrice);
    }
    buckets.push({ t0, mo, rp, n, hrs, closed: step === 1 && new Date(t0).getDay() === 0 && !n });
  }

  // Ingresos acumulados día a día, este periodo contra el anterior a la misma altura
  const days = Math.max(1, Math.round((dayStart(r.end) - r.start) / D) + 1);
  const cum = (list: PaidOrder[], from: number, limit: number) => {
    const out: number[] = []; let acc = 0;
    for (let i = 0; i < days; i++) {
      const t0 = addDays(from, i), t1 = Math.min(addDays(from, i + 1), limit);
      for (const o of list) if (o.paidAt >= t0 && o.paidAt < t1) acc += o.amount;
      out.push(acc);
    }
    return out;
  };

  // Trabajos, repuestos, tipos de trabajo, pagos y mecánicos
  const svc = new Map<string, { name: string; n: number; total: number }>();
  const prt = new Map<string, { name: string; n: number; profit: number }>();
  const cats = SERVICE_CATEGORIES.map((name) => ({ name, total: 0, n: 0 }));
  let mo = 0, rp = 0, rpCost = 0;
  const pay = { efectivo: { total: 0, n: 0 }, qr: { total: 0, n: 0 } };
  const mech = new Map<number, { n: number; labor: number }>();
  for (const o of cur) {
    pay[o.method].total += o.amount; pay[o.method].n++;
    const firstSvc = o.items.find((x) => x.kind === "servicio");
    const c = cats.find((k) => k.name === firstSvc?.category) ?? cats[0];
    c.total += o.amount; c.n++;
    let labor = 0;
    for (const x of o.items) {
      if (x.kind === "servicio") {
        mo += x.qty * x.unitPrice; labor += x.qty * x.unitPrice;
        const k = String(x.serviceId ?? x.name), e = svc.get(k) ?? { name: x.name, n: 0, total: 0 };
        e.n += x.qty; e.total += x.qty * x.unitPrice; svc.set(k, e);
      } else {
        rp += x.qty * x.unitPrice; rpCost += x.qty * x.unitCost;
        const k = String(x.partId ?? x.name), e = prt.get(k) ?? { name: x.name, n: 0, profit: 0 };
        e.n += x.qty; e.profit += x.qty * (x.unitPrice - x.unitCost); prt.set(k, e);
      }
    }
    if (o.mechanicId) { const m = mech.get(o.mechanicId) ?? { n: 0, labor: 0 }; m.n++; m.labor += labor; mech.set(o.mechanicId, m); }
  }
  const mechanics = db.select({ id: users.id, name: users.name, role: users.role, active: users.active }).from(users).all()
    .filter((u) => (u.role === "mecanico" && u.active) || mech.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, ...(mech.get(u.id) ?? { n: 0, labor: 0 }) }))
    .sort((a, b) => b.n - a.n);

  // Qué días llega más trabajo (lunes a sábado)
  const created = db.select({ createdAt: orders.createdAt }).from(orders).where(and(gte(orders.createdAt, r.start), lt(orders.createdAt, r.end))).all();
  const wdN = [0, 0, 0, 0, 0, 0], wdDays = [0, 0, 0, 0, 0, 0];
  for (let t = r.start; t <= r.end; t = addDays(t, 1)) { const w = (new Date(t).getDay() + 6) % 7; if (w < 6) wdDays[w]++; }
  for (const o of created) { const w = (new Date(o.createdAt).getDay() + 6) % 7; if (w < 6) wdN[w]++; }

  return {
    period, range: r,
    current: kpis(cur), previous: kpis(prev),
    buckets,
    cumulative: { current: cum(cur, r.start, r.end), previous: cum(prev, r.prevStart, r.prevEnd) },
    totals: { labor: mo, parts: rp, partsProfit: rp - rpCost },
    categories: cats,
    payments: pay,
    topServices: [...svc.values()].sort((a, b) => b.n - a.n).slice(0, 6),
    topParts: [...prt.values()].sort((a, b) => b.profit - a.profit).slice(0, 6),
    mechanics,
    weekdays: wdN.map((n, i) => (wdDays[i] ? n / wdDays[i] : 0)),
    remind: remindList(now),
  };
}

/** Vehículos que no vienen hace más de 45 días (y no están ahora en el taller). */
export function remindList(now = Date.now(), days = 45, limit = 6) {
  const busy = new Set(db.select({ v: orders.vehicleId }).from(orders).where(inArray(orders.state, ACTIVE_STATES)).all().map((x) => x.v));
  const rows = db.select({ vehicleId: orders.vehicleId, last: sql<number>`max(${payments.createdAt})` })
    .from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).groupBy(orders.vehicleId).all();
  const due = rows.filter((x) => !busy.has(x.vehicleId) && now - x.last >= days * D).sort((a, b) => a.last - b.last).slice(0, limit);
  if (!due.length) return [];
  const vs = db.select({ id: vehicles.id, plate: vehicles.plate, brand: vehicles.brand, model: vehicles.model, clientName: clients.name, phone: clients.phone })
    .from(vehicles).innerJoin(clients, eq(clients.id, vehicles.clientId)).where(inArray(vehicles.id, due.map((d) => d.vehicleId))).all();
  return due.map((d) => ({ ...vs.find((v) => v.id === d.vehicleId)!, days: Math.floor((now - d.last) / D) }));
}

/** Caja del día: cobros de hoy y si ya se cerró. */
export function todayCash(now = Date.now()) {
  const t0 = dayStart(now);
  const list = db.select({ orderId: orders.id, number: orders.number, method: payments.method, amount: payments.amount, createdAt: payments.createdAt, receiptNumber: payments.receiptNumber, plate: vehicles.plate, clientName: clients.name })
    .from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).innerJoin(vehicles, eq(vehicles.id, orders.vehicleId)).innerJoin(clients, eq(clients.id, orders.clientId))
    .where(and(gte(payments.createdAt, t0), lt(payments.createdAt, addDays(t0, 1)))).orderBy(sql`${payments.createdAt} desc`).all();
  const cash = list.filter((x) => x.method === "efectivo").reduce((a, x) => a + x.amount, 0);
  const qr = list.filter((x) => x.method === "qr").reduce((a, x) => a + x.amount, 0);
  return { day: dayKey(now), cash, qr, list };
}
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
