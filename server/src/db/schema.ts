import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/*
 * Convenciones:
 * - Montos de dinero en centavos (enteros) para no perder precisión: Bs 100,50 = 10050.
 * - Fechas en milisegundos desde 1970 (Date.now()).
 * - Booleanos como 0/1.
 */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "mecanico"] }).notNull(),
  specialty: text("specialty").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
}, (t) => [uniqueIndex("users_username_idx").on(t.username)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // hash SHA-256 del token de la cookie
  userId: integer("user_id").notNull().references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ci: text("ci").notNull().default(""),
  phone: text("phone").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("clients_name_idx").on(t.name)]);

export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  type: text("type", { enum: ["auto", "moto"] }).notNull(),
  plate: text("plate").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  year: integer("year"),
  color: text("color").notNull().default(""),
  km: integer("km").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (t) => [uniqueIndex("vehicles_plate_idx").on(t.plate), index("vehicles_client_idx").on(t.clientId)]);

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const parts = sqliteTable("parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  cost: integer("cost").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  location: text("location").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
}, (t) => [uniqueIndex("parts_code_idx").on(t.code)]);

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partId: integer("part_id").notNull().references(() => parts.id),
  type: text("type", { enum: ["ingreso", "salida", "devolucion", "ajuste"] }).notNull(),
  qty: integer("qty").notNull(), // positivo entra, negativo sale
  unitCost: integer("unit_cost").notNull().default(0),
  orderId: integer("order_id"),
  userId: integer("user_id").references(() => users.id),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("movements_part_idx").on(t.partId)]);

export const ORDER_STATES = ["revision", "presupuesto", "reparacion", "listo", "entregado", "cancelado"] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: integer("number").notNull(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  clientId: integer("client_id").notNull().references(() => clients.id),
  mechanicId: integer("mechanic_id").references(() => users.id),
  state: text("state", { enum: ORDER_STATES }).notNull(),
  waiting: integer("waiting", { mode: "boolean" }).notNull().default(false),
  waitingNote: text("waiting_note").notNull().default(""),
  reason: text("reason").notNull(),
  km: integer("km").notNull().default(0),
  fuel: integer("fuel").notNull().default(2), // 0 reserva … 4 lleno
  objects: text("objects").notNull().default("[]"), // JSON con la lista de objetos dejados
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deliveredAt: integer("delivered_at"),
}, (t) => [
  uniqueIndex("orders_number_idx").on(t.number),
  index("orders_state_idx").on(t.state),
  index("orders_vehicle_idx").on(t.vehicleId),
  index("orders_mechanic_idx").on(t.mechanicId),
]);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["servicio", "repuesto"] }).notNull(),
  serviceId: integer("service_id").references(() => services.id),
  partId: integer("part_id").references(() => parts.id),
  name: text("name").notNull(),
  category: text("category").notNull().default(""),
  qty: integer("qty").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
  unitCost: integer("unit_cost").notNull().default(0),
  toBuy: integer("to_buy", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("items_order_idx").on(t.orderId)]);

export const orderEvents = sqliteTable("order_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  userId: integer("user_id").references(() => users.id),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("events_order_idx").on(t.orderId)]);

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  method: text("method", { enum: ["efectivo", "qr"] }).notNull(),
  amount: integer("amount").notNull(),
  received: integer("received"),
  reference: text("reference").notNull().default(""),
  receiptNumber: integer("receipt_number").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  uniqueIndex("payments_order_idx").on(t.orderId),
  uniqueIndex("payments_receipt_idx").on(t.receiptNumber),
  index("payments_created_idx").on(t.createdAt),
]);

export const cashClosings = sqliteTable("cash_closings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: text("day").notNull(), // AAAA-MM-DD
  expectedCash: integer("expected_cash").notNull(),
  countedCash: integer("counted_cash").notNull(),
  qrTotal: integer("qr_total").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at").notNull(),
}, (t) => [uniqueIndex("cash_day_idx").on(t.day)]);
