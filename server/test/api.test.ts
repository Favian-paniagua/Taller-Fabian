import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

process.env.NODE_ENV = "test";
process.env.DB_FILE = ":memory:";

let server: Server;
let base = "";

before(async () => {
  const { migrateDb } = await import("../src/db/client.js");
  const { seedBase } = await import("../src/db/seed.js");
  const { createApp } = await import("../src/app.js");
  migrateDb();
  seedBase({ adminPassword: "admin123" });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server?.close());

/** Cliente HTTP mínimo que guarda la cookie de sesión. */
function client() {
  let cookie = "";
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(base + path, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = r.headers.get("content-type")?.includes("json") ? await r.json() : null;
    return { status: r.status, data: data as any };
  };
  return {
    get: (p: string) => call("GET", p), post: (p: string, b?: unknown) => call("POST", p, b ?? {}),
    patch: (p: string, b: unknown) => call("PATCH", p, b), del: (p: string) => call("DELETE", p),
  };
}

const admin = client();
const mech = client();
let mechId = 0, orderId = 0, partId = 0, serviceId = 0, emptyPartId = 0;

test("sin sesión no se puede usar la API", async () => {
  const r = await client().get("/orders");
  assert.equal(r.status, 401);
});

test("login rechaza la contraseña equivocada y acepta la correcta", async () => {
  assert.equal((await admin.post("/auth/login", { username: "fabian", password: "mala" })).status, 401);
  const r = await admin.post("/auth/login", { username: "FABIAN", password: "admin123" });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, "admin");
});

test("el dueño crea un mecánico y el mecánico puede entrar", async () => {
  const r = await admin.post("/users", { name: "Jhonny Quispe", username: "jhonny", password: "clave123", role: "mecanico", specialty: "Mecánica general" });
  assert.equal(r.status, 201);
  mechId = r.data.id;
  assert.equal((await admin.post("/users", { name: "Otro", username: "jhonny", password: "clave123" })).status, 409);
  assert.equal((await mech.post("/auth/login", { username: "jhonny", password: "clave123" })).status, 200);
  assert.equal((await mech.get("/users")).status, 403);
});

test("el mecánico no ve costos ni precios del catálogo", async () => {
  const parts = (await mech.get("/parts")).data;
  assert.equal(parts[0].price, undefined);
  assert.equal(parts[0].cost, undefined);
  const services = (await admin.get("/services")).data;
  serviceId = services.find((s: any) => s.name.startsWith("Cambio de aceite")).id;
  assert.equal(services.find((s: any) => s.id === serviceId).price, 10000);
  const all = (await admin.get("/parts")).data;
  partId = all.find((p: any) => p.code === "LUB-001").id;
  emptyPartId = all.find((p: any) => p.code === "FIL-101").id;
});

test("registrar ingreso suma stock y deja el movimiento", async () => {
  const r = await admin.post(`/parts/${partId}/ingreso`, { qty: 5, cost: 120, price: 160 });
  assert.equal(r.status, 200);
  assert.equal(r.data.stock, 5);
  const mv = (await admin.get(`/parts/${partId}/movements`)).data;
  assert.equal(mv[0].type, "ingreso");
  assert.equal(mv[0].qty, 5);
});

test("abrir una orden con vehículo y cliente nuevos", async () => {
  const r = await admin.post("/orders", {
    newVehicle: { type: "auto", plate: "2847-ktr", brand: "Toyota", model: "Corolla", year: 2008, newClient: { name: "Juan Carlos Mamani", phone: "71234567" } },
    reason: "Cambio de aceite", km: 214500, fuel: 2, objects: ["Gata"], mechanicId: mechId,
  });
  assert.equal(r.status, 201);
  orderId = r.data.id;
  assert.equal(r.data.state, "revision");
  assert.equal(r.data.vehicle.plate, "2847KTR");
  assert.equal(r.data.number, 101);
  const again = await admin.post("/orders", { vehicleId: r.data.vehicle.id, reason: "Otra cosa", fuel: 2 });
  assert.equal(again.status, 409, "un vehículo no puede tener dos órdenes abiertas");
});

test("el mecánico anota trabajos en revisión; el repuesto sale del stock o queda para comprar", async () => {
  assert.equal((await mech.post(`/orders/${orderId}/items`, { kind: "servicio", refId: serviceId })).status, 200);
  const r1 = await mech.post(`/orders/${orderId}/items`, { kind: "repuesto", refId: partId, qty: 1 });
  assert.equal(r1.data.toBuy, false);
  const r2 = await mech.post(`/orders/${orderId}/items`, { kind: "repuesto", refId: emptyPartId });
  assert.equal(r2.data.toBuy, true, "sin stock queda anotado para comprar");
  assert.equal(r2.data.total, undefined, "el mecánico no ve el total");
  assert.equal(r2.data.items[0].unitPrice, undefined);
  const p = (await admin.get("/parts")).data.find((x: any) => x.id === partId);
  assert.equal(p.stock, 4);
});

test("cambiar la cantidad y quitar un repuesto devuelve el stock", async () => {
  const o = (await admin.get(`/orders/${orderId}`)).data;
  const item = o.items.find((x: any) => x.partId === partId);
  await admin.patch(`/orders/${orderId}/items/${item.id}`, { qty: 3 });
  assert.equal((await admin.get("/parts")).data.find((x: any) => x.id === partId).stock, 2);
  await admin.patch(`/orders/${orderId}/items/${item.id}`, { qty: 1 });
  assert.equal((await admin.get("/parts")).data.find((x: any) => x.id === partId).stock, 4);
  const toBuy = o.items.find((x: any) => x.partId === emptyPartId);
  assert.equal((await admin.del(`/orders/${orderId}/items/${toBuy.id}`)).status, 200);
  assert.equal((await admin.get("/parts")).data.find((x: any) => x.id === emptyPartId).stock, 0, "lo que estaba para comprar no toca el stock");
});

test("flujo de 4 pasos con permisos por rol", async () => {
  assert.equal((await mech.post(`/orders/${orderId}/move`, { to: "presupuesto" })).status, 200);
  assert.equal((await mech.post(`/orders/${orderId}/items`, { kind: "servicio", refId: serviceId })).status, 403, "fuera de revisión el mecánico no edita");
  assert.equal((await mech.post(`/orders/${orderId}/move`, { to: "reparacion" })).status, 403, "solo el dueño marca que el cliente aceptó");
  assert.equal((await admin.post(`/orders/${orderId}/move`, { to: "listo" })).status, 409, "no se puede saltar pasos");
  assert.equal((await admin.post(`/orders/${orderId}/move`, { to: "reparacion" })).status, 200);
  assert.equal((await mech.post(`/orders/${orderId}/wait`, { waiting: true, note: "Falta el filtro" })).data.waiting, true);
  assert.equal((await mech.post(`/orders/${orderId}/wait`, { waiting: false })).data.waiting, false);
  const r = await mech.post(`/orders/${orderId}/move`, { to: "listo" });
  assert.equal(r.data.state, "listo");
  assert.deepEqual(r.data.events.map((e: any) => e.type), ["creada", "presupuesto", "aprobado", "espera", "reanuda", "listo"]);
});

test("cobrar: el mecánico no puede, el monto se valida y la orden se cierra", async () => {
  assert.equal((await mech.post(`/orders/${orderId}/pay`, { method: "efectivo" })).status, 403);
  assert.equal((await admin.post(`/orders/${orderId}/pay`, { method: "efectivo", received: 100 })).status, 400);
  const r = await admin.post(`/orders/${orderId}/pay`, { method: "efectivo", received: 300 });
  assert.equal(r.status, 200);
  assert.equal(r.data.state, "entregado");
  assert.equal(r.data.payment.amount, 26000, "Bs 100 de mano de obra + Bs 160 de aceite");
  assert.equal(r.data.payment.receiptNumber, 1);
  assert.equal((await admin.post(`/orders/${orderId}/items`, { kind: "servicio", refId: serviceId })).status, 409);
});

test("el mecánico solo ve sus órdenes", async () => {
  const v = (await admin.get("/vehicles/search?q=2847")).data[0];
  const other = await admin.post("/orders", { vehicleId: v.id, reason: "Revisión de frenos", fuel: 3 });
  assert.equal(other.status, 201);
  assert.equal((await mech.get(`/orders/${other.data.id}`)).status, 403);
  const list = (await mech.get("/orders?scope=todas")).data;
  assert.ok(list.every((o: any) => o.mechanic?.id === mechId));
  assert.equal((await admin.post(`/orders/${other.data.id}/cancel`, { reason: "El cliente se lo llevó" })).data.state, "cancelado");
});

test("resumen y caja del día", async () => {
  const d = (await admin.get("/dashboard?period=semana")).data;
  assert.equal(d.current.ingresos, 26000);
  assert.equal(d.current.n, 1);
  assert.equal(d.payments.efectivo.total, 26000);
  assert.equal(d.cumulative.current.at(-1), 26000);
  assert.equal((await mech.get("/dashboard")).status, 403);
  const cash = (await admin.get("/cash/today")).data;
  assert.equal(cash.cash, 26000);
  assert.equal((await admin.post("/cash/close", { counted: 260 })).status, 201);
  assert.equal((await admin.post("/cash/close", { counted: 260 })).status, 409);
});

test("cambiar la propia contraseña", async () => {
  assert.equal((await mech.post("/auth/password", { current: "mala", next: "nueva123" })).status, 400);
  assert.equal((await mech.post("/auth/password", { current: "clave123", next: "nueva123" })).status, 200);
  assert.equal((await mech.get("/auth/me")).status, 200, "la sesión actual sigue activa");
  assert.equal((await client().post("/auth/login", { username: "jhonny", password: "nueva123" })).status, 200);
});
