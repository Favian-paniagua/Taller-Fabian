/**
 * Carga datos de ejemplo (clientes, vehículos y ~6 meses de trabajos) para probar o mostrar el sistema.
 * Solo funciona sobre una base sin órdenes, para no mezclar datos inventados con datos reales.
 * Uso: npm run datos-demo
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { count, eq } from "drizzle-orm";
import { hashPassword } from "../auth.js";
import { db, migrateDb } from "./client.js";
import { announceCredentials, seedBase } from "./seed.js";
import { clients, orderEvents, orderItems, orders, parts, payments, services, users, vehicles } from "./schema.js";

const H = 3600e3;
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };

export function seedDemo(now = Date.now()) {
  if (db.select({ n: count() }).from(orders).get()!.n > 0) throw new Error("La base ya tiene órdenes: los datos de ejemplo solo se cargan en una base vacía.");
  const creds = seedBase();
  const R = rng(20261012);
  const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));

  db.transaction((tx) => {
    const mech = (name: string, username: string, specialty: string) =>
      tx.select({ id: users.id }).from(users).where(eq(users.username, username)).get()?.id ??
      tx.insert(users).values({ name, username, specialty, role: "mecanico", passwordHash: hashPassword("taller123"), createdAt: now }).returning({ id: users.id }).get().id;
    const M1 = mech("Jhonny Quispe", "jhonny", "Mecánica general");
    const M2 = mech("Marco Mamani", "marco", "Electricidad y motos");

    // Stock de ejemplo
    const stock: Record<string, number> = { "LUB-001": 9, "LUB-002": 6, "LUB-003": 8, "LUB-004": 12, "LUB-005": 4, "LUB-006": 2, "LUB-007": 4, "FIL-101": 14, "FIL-102": 7, "FIL-103": 3, "FIL-104": 1, "FIL-105": 7, "FIL-106": 10, "ENC-201": 28, "ENC-202": 8, "ENC-203": 18, "ENC-204": 2, "FRE-301": 4, "FRE-302": 0, "FRE-303": 2, "FRE-304": 2, "FRE-305": 6, "TRA-401": 0, "TRA-402": 1, "TRA-403": 1, "TRA-404": 2, "ELE-501": 3, "ELE-502": 2, "ELE-503": 16, "ELE-504": 30, "ELE-505": 6, "ELE-506": 6, "ELE-507": 4, "ELE-508": 2, "ELE-509": 1, "SUS-601": 2, "SUS-602": 4, "SUS-603": 4, "VAR-701": 6, "VAR-702": 9 };
    for (const [code, n] of Object.entries(stock)) tx.update(parts).set({ stock: n }).where(eq(parts.code, code)).run();

    const svcByName = new Map(tx.select().from(services).all().map((s) => [s.name, s]));
    const partByCode = new Map(tx.select().from(parts).all().map((p) => [p.code, p]));
    const S = (name: string) => svcByName.get(name)!;
    const P = (code: string) => partByCode.get(code)!;

    // Clientes y vehículos
    const base: [string, string, string][] = [
      ["Juan Carlos Mamani", "4829173", "71234567"], ["Rosa Quispe Huanca", "5102984", "72045831"], ["Marcelo Gutiérrez Rojas", "3398120", "76598214"],
      ["Daniela Flores Vargas", "6721045", "70128456"], ["Ronald Choque Apaza", "4410786", "73390127"], ["Patricia Limachi", "5893402", "79945612"],
      ["Luis Fernando Arce", "2987431", "67012983"], ["Gabriela Condori", "7034519", "68834521"], ["Wilson Ticona", "3876210", "71567809"],
      ["Carla Mendoza Salinas", "6290118", "72288340"], ["Ever Callisaya", "8012467", "77701456"], ["Silvia Ramos Cruz", "4567302", "60543217"],
      ["Óscar Villca", "3120985", "74412093"], ["Mariela Poma", "7765021", "69901274"], ["Hugo Alanoca", "2654398", "75536821"],
    ];
    const FN = ["Jorge", "María", "Carlos", "Ana", "Freddy", "Lucía", "Ramiro", "Elena", "Víctor", "Sandra", "Édgar", "Noemí", "Rubén", "Ximena", "Álvaro", "Ruth", "Henry", "Paola", "Nelson", "Verónica", "Iván", "Gladys", "Franz", "Teresa", "Boris"];
    const LN = ["Mamani", "Quispe", "Choque", "Flores", "Condori", "Rojas", "Vargas", "Gutiérrez", "Huanca", "Ticona", "Apaza", "Limachi", "Copa", "Laura", "Chura", "Calle", "Aguilar", "Paz", "Torrez", "Yujra"];
    const allClients = [...base, ...FN.map((f) => [`${f} ${LN[ri(0, 19)]} ${LN[ri(0, 19)]}`, String(ri(2000000, 8999999)), String(ri(6, 7)) + String(ri(1000000, 9999999))] as [string, string, string])];
    const clientIds = allClients.map(([name, ci, phone]) => tx.insert(clients).values({ name, ci, phone, createdAt: now - 200 * 86400e3 }).returning({ id: clients.id }).get().id);

    const V: [number, "auto" | "moto", string, string, string, number, string, number][] = [
      [0, "auto", "2847KTR", "Toyota", "Corolla", 2008, "Plata", 214500], [1, "auto", "3190LHB", "Suzuki", "Grand Vitara", 2012, "Blanco", 158200],
      [2, "auto", "4021PZN", "Toyota", "Hilux", 2015, "Gris", 189300], [3, "auto", "3655NBD", "Hyundai", "Accent", 2014, "Rojo", 121040],
      [4, "auto", "1958GXK", "Toyota", "Ipsum", 2002, "Verde", 302110], [5, "auto", "3012KFL", "Nissan", "Sentra", 2011, "Negro", 176400],
      [6, "auto", "5523RTA", "Kia", "Rio", 2019, "Blanco", 64300], [7, "moto", "4410TPS", "Honda", "CG 150", 2020, "Rojo", 28900],
      [8, "auto", "2210HJC", "Toyota", "Noah", 2004, "Plata", 265700], [9, "auto", "3388MKS", "Volkswagen", "Gol", 2013, "Azul", 143200],
      [10, "moto", "3876PLA", "Yamaha", "YBR 125", 2018, "Negro", 41250], [11, "auto", "4307PCR", "Chevrolet", "Spark", 2016, "Amarillo", 98400],
      [12, "auto", "2965KXB", "Mitsubishi", "L200", 2010, "Blanco", 241900], [13, "moto", "5102SDE", "Bajaj", "Pulsar NS200", 2021, "Azul", 18700],
      [14, "auto", "2754KPN", "Toyota", "RAV4", 2009, "Plata", 198760], [0, "moto", "3510NWT", "Suzuki", "GN 125", 2017, "Negro", 36400],
      [2, "auto", "2391JFR", "Toyota", "Land Cruiser Prado", 2007, "Beige", 287300], [4, "auto", "3967NVR", "Suzuki", "Alto", 2015, "Rojo", 112800],
      [6, "moto", "5376STK", "Haojue", "DK150", 2022, "Gris", 12300], [9, "auto", "2869KMD", "Nissan", "X-Trail", 2010, "Gris", 205400],
    ];
    const AUTOS = [["Toyota", "Corolla"], ["Toyota", "Hilux"], ["Toyota", "Yaris"], ["Suzuki", "Swift"], ["Nissan", "Tiida"], ["Hyundai", "Tucson"], ["Kia", "Sportage"], ["Toyota", "Probox"], ["Suzuki", "Vitara"], ["Volkswagen", "Polo"], ["Chevrolet", "Sail"], ["Toyota", "Fortuner"], ["Nissan", "Frontier"], ["Mazda", "3"], ["Toyota", "Rush"]];
    const MOTOS = [["Honda", "XR 150"], ["Yamaha", "FZ 150"], ["Bajaj", "Boxer 150"], ["Suzuki", "GN 125"], ["Haojue", "HJ 125"]];
    const COLORS = ["Blanco", "Plata", "Gris", "Negro", "Rojo", "Azul"], LET = "BCDFGHJKLMNPRSTVWXYZ";
    for (let i = 15; i < allClients.length; i++) {
      const moto = R() < 0.24, [brand, model] = moto ? MOTOS[ri(0, 4)] : AUTOS[ri(0, AUTOS.length - 1)];
      V.push([i, moto ? "moto" : "auto", String(ri(1000, 5999)) + LET[ri(0, 19)] + LET[ri(0, 19)] + LET[ri(0, 19)], brand, model, ri(moto ? 2015 : 2004, 2023), COLORS[ri(0, 5)], moto ? ri(8000, 60000) : ri(40000, 290000)]);
    }
    const veh = V.map(([ci, type, plate, brand, model, year, color, km]) => ({ id: tx.insert(vehicles).values({ clientId: clientIds[ci], type, plate, brand, model, year, color, km, createdAt: now - 200 * 86400e3 }).returning({ id: vehicles.id }).get().id, clientId: clientIds[ci], type, km }));

    type It = { kind: "servicio" | "repuesto"; serviceId?: number; partId?: number; name: string; category: string; qty: number; unitPrice: number; unitCost: number; toBuy?: boolean };
    const s = (n: string, qty = 1): It => { const x = S(n); return { kind: "servicio", serviceId: x.id, name: x.name, category: x.category, qty, unitPrice: x.price, unitCost: 0 }; };
    const p = (c: string, qty = 1, toBuy = false): It => { const x = P(c); return { kind: "repuesto", partId: x.id, name: x.name, category: x.category, qty, unitPrice: x.price, unitCost: x.cost, toBuy }; };
    type T = { w: number; r: string; m: number; h: [number, number]; i: () => It[] };
    const pickW = (arr: T[]) => { const tot = arr.reduce((a, x) => a + x.w, 0); let r = R() * tot; for (const x of arr) if ((r -= x.w) <= 0) return x; return arr[arr.length - 1]; };
    const T_AUTO: T[] = [
      { w: 30, r: "Cambio de aceite", m: M1, h: [1, 3], i: () => [s("Cambio de aceite (mano de obra)"), p(R() < 0.6 ? "LUB-001" : "LUB-002"), p(R() < 0.6 ? "FIL-101" : "FIL-102")] },
      { w: 12, r: "Afinado de motor", m: M1, h: [3, 7], i: () => [s("Afinado de motor"), p("ENC-201", 4), p("FIL-105"), p("FIL-103")] },
      { w: 12, r: "Ruido al frenar", m: M1, h: [2, 6], i: () => [s("Cambio de pastillas de freno (por eje)"), p(["FRE-301", "FRE-303", "FRE-302"][ri(0, 2)]), p("LUB-005")] },
      { w: 4, r: "Patina el embrague", m: M1, h: [20, 50], i: () => [s("Cambio de kit de embrague"), p("TRA-401")] },
      { w: 3, r: "Cambio de distribución", m: M1, h: [6, 26], i: () => [s("Cambio de correa de distribución"), p("TRA-404")] },
      { w: 6, r: "No arranca a la primera", m: M2, h: [3, 24], i: () => [s("Diagnóstico con escáner"), s("Reparación de motor de arranque"), p("ELE-508")] },
      { w: 6, r: "La batería se descarga", m: M2, h: [3, 24], i: () => [s("Diagnóstico con escáner"), s("Reparación de alternador"), p("ELE-507")] },
      { w: 5, r: "Cambio de batería", m: M2, h: [0.5, 1.5], i: () => [s("Cambio e instalación de batería"), p("ELE-501")] },
      { w: 6, r: "Luces delanteras no prenden", m: M2, h: [1, 4], i: () => [s("Revisión del sistema eléctrico"), p("ELE-503", 2), p("ELE-505")] },
      { w: 5, r: "Tironea al acelerar", m: M1, h: [2, 5], i: () => [s("Limpieza de inyectores"), p("VAR-701")] },
      { w: 5, r: "Golpe en la suspensión", m: M1, h: [3, 8], i: () => [s("Revisión de suspensión delantera"), p("SUS-602"), p("SUS-603")] },
      { w: 4, r: "Luz de motor encendida", m: M2, h: [0.5, 2], i: () => [s("Diagnóstico con escáner")] },
    ];
    const T_MOTO: T[] = [
      { w: 12, r: "Mantenimiento general", m: M2, h: [2, 5], i: () => [s("Mantenimiento general de moto"), p("LUB-004"), p("FIL-106"), p("ENC-203")] },
      { w: 8, r: "Afinado, se ahoga", m: M2, h: [1, 3], i: () => [s("Afinado de moto"), p("ENC-203"), p("LUB-004")] },
      { w: 6, r: "La cadena suena", m: M2, h: [1, 3], i: () => [s("Cambio de kit de arrastre"), p(R() < 0.5 ? "TRA-402" : "TRA-403")] },
      { w: 4, r: "Frenos gastados", m: M2, h: [1, 2], i: () => [s("Mantenimiento general de moto"), p("FRE-305")] },
      { w: 3, r: "No carga la batería", m: M2, h: [1, 3], i: () => [s("Revisión del sistema eléctrico"), p("ELE-502")] },
    ];

    // Historial de unos 200 días con un crecimiento suave
    const today0 = dayStart(now);
    const hist: { v: (typeof veh)[number]; t: T; created: number; paidAt: number; d: number }[] = [];
    for (let d = 200; d >= 1; d--) {
      const day = addDays(today0, -d), wd = new Date(day).getDay();
      if (wd === 0) continue;
      const busy = [0, 0.5, 0.2, 0, 0.3, 0.6, 0][wd];
      const n = wd === 6 ? ri(1, 3) : ri(2, 4) + (R() < busy ? 1 : 0) + (R() < 0.12 + ((200 - d) / 200) * 0.3 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const v = veh[ri(0, veh.length - 1)], t = pickW(v.type === "moto" ? T_MOTO : T_AUTO);
        const created = day + (8.5 + R() * 7) * H;
        let paidAt = created + (t.h[0] + R() * (t.h[1] - t.h[0])) * H;
        if (new Date(paidAt).getHours() >= 19) paidAt += 14 * H;
        if (new Date(paidAt).getDay() === 0) paidAt += 24 * H;
        if (paidAt > now - H) continue;
        hist.push({ v, t, created, paidAt, d });
      }
    }
    const open = today0 + 8.5 * H, span = now - open;
    if (span > 0.5 * H) {
      const pairs: [number, T][] = [[6, T_AUTO[0]], [10, T_MOTO[1]], [1, T_AUTO[8]]];
      const nToday = span > 1.6 * H ? Math.min(3, Math.floor(span / (1.6 * H))) : 1;
      for (let k = 0; k < nToday; k++) { const paidAt = open + (span * (k + 1)) / (nToday + 1); hist.push({ v: veh[pairs[k][0]], t: pairs[k][1], created: paidAt - 1.4 * H, paidAt, d: 0 }); }
    }
    hist.sort((a, b) => a.created - b.created);
    let number = 101;
    const paid: { orderId: number; at: number; amount: number; method: "efectivo" | "qr" }[] = [];
    for (const h of hist) {
      const items = h.t.i(), sp = h.paidAt - h.created;
      const mechanicId = R() < 0.82 ? h.t.m : h.t.m === M1 ? M2 : M1;
      const id = tx.insert(orders).values({
        number: number++, vehicleId: h.v.id, clientId: h.v.clientId, mechanicId, state: "entregado", reason: h.t.r,
        km: Math.max(1000, h.v.km - Math.round(h.d * (h.v.type === "moto" ? 25 : 45) + R() * 300)), fuel: ri(1, 3),
        objects: JSON.stringify(R() < 0.5 ? ["Gata", "Llanta de auxilio"] : ["Gata"]), createdAt: h.created, updatedAt: h.paidAt, deliveredAt: h.paidAt,
      }).returning({ id: orders.id }).get().id;
      tx.insert(orderItems).values(items.map((x) => ({ ...x, orderId: id, toBuy: false, createdAt: h.created }))).run();
      tx.insert(orderEvents).values([["creada", 0], ["presupuesto", 0.15], ["aprobado", 0.3], ["listo", 0.9], ["entregado", 1]].map(([type, f]) => ({ orderId: id, type: type as string, userId: type === "listo" ? mechanicId : null, createdAt: Math.round(h.created + sp * (f as number)) }))).run();
      paid.push({ orderId: id, at: h.paidAt, amount: items.reduce((a, x) => a + x.qty * x.unitPrice, 0), method: R() < 0.46 ? "qr" : "efectivo" });
    }
    paid.sort((a, b) => a.at - b.at).forEach((x, i) => tx.insert(payments).values({ orderId: x.orderId, method: x.method, amount: x.amount, received: x.method === "efectivo" ? x.amount : null, receiptNumber: i + 1, createdAt: x.at }).run());

    // Vehículos que están ahora en el taller
    const ORDER4 = ["revision", "presupuesto", "reparacion", "listo"] as const;
    const EV = { revision: "creada", presupuesto: "presupuesto", reparacion: "aprobado", listo: "listo" } as const;
    const mk = (vi: number, state: (typeof ORDER4)[number], mechanicId: number, hoursAgo: number, reason: string, items: It[], extra: { fuel?: number; objects?: string[]; waiting?: string } = {}) => {
      const created = now - hoursAgo * H, path_ = ORDER4.slice(0, ORDER4.indexOf(state) + 1), step = (hoursAgo * H * 0.8) / path_.length;
      const id = tx.insert(orders).values({
        number: number++, vehicleId: veh[vi].id, clientId: veh[vi].clientId, mechanicId, state, reason, km: veh[vi].km, fuel: extra.fuel ?? 2,
        objects: JSON.stringify(extra.objects ?? ["Gata", "Llanta de auxilio"]), waiting: !!extra.waiting, waitingNote: extra.waiting ?? "", createdAt: created, updatedAt: now,
      }).returning({ id: orders.id }).get().id;
      if (items.length) tx.insert(orderItems).values(items.map((x) => ({ ...x, orderId: id, toBuy: !!x.toBuy, createdAt: created }))).run();
      tx.insert(orderEvents).values(path_.map((st, i) => ({ orderId: id, type: EV[st], createdAt: Math.round(created + i * step) }))).run();
      if (extra.waiting) tx.insert(orderEvents).values({ orderId: id, type: "espera", note: extra.waiting, createdAt: Math.round(created + hoursAgo * H * 0.85) }).run();
    };
    mk(0, "reparacion", M1, 30, "Patina el embrague en las subidas", [s("Cambio de kit de embrague"), p("TRA-401", 1, true)], { waiting: "El kit de embrague llega mañana en la mañana." });
    mk(2, "reparacion", M1, 26, "Ruido al frenar y el pedal se siente largo", [s("Cambio de pastillas de freno (por eje)"), p("FRE-302", 1, true), p("LUB-005")], { fuel: 3 });
    mk(3, "listo", M1, 22, "Chilla al frenar, pastillas gastadas", [s("Cambio de pastillas de freno (por eje)"), p("FRE-303")], { fuel: 3 });
    mk(7, "listo", M2, 20, "Mantenimiento, la cadena suena", [s("Mantenimiento general de moto"), s("Cambio de kit de arrastre"), p("TRA-402"), p("LUB-004"), p("ENC-203")], { objects: ["Casco"] });
    mk(5, "presupuesto", M2, 6, "No arranca a la primera y la batería se descarga", [s("Diagnóstico con escáner"), s("Reparación de alternador"), p("ELE-507")], { fuel: 1 });
    mk(8, "reparacion", M1, 5, "Afinado y cambio de aceite", [s("Afinado de motor"), s("Cambio de aceite (mano de obra)"), p("LUB-001"), p("FIL-101"), p("ENC-201", 4), p("FIL-103")]);
    mk(13, "revision", M2, 2, "Se apaga en ralentí", [], { objects: ["Casco"], fuel: 1 });
    mk(11, "revision", M1, 0.5, "Cambio de aceite", [], { objects: ["Radio", "Gata"] });
  });
  return creds;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrateDb();
  try {
    const creds = seedDemo();
    if (creds) announceCredentials(creds);
    console.log("Datos de ejemplo cargados. Mecánicos de prueba: jhonny / taller123 y marco / taller123.");
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }
}
