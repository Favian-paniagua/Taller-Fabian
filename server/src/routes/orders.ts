import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { ORDER_STATES } from "../db/schema.js";
import { ah, idParam, parse } from "../http.js";
import * as svc from "../services/orders.js";

export const ordersRouter = Router();

const fuel = z.number().int().min(0).max(4);
const objects = z.array(z.string().trim().min(1).max(40)).max(20);

ordersRouter.get("/orders", ah((req, res) => {
  const q = req.query;
  const scope = q.scope === "entregadas" || q.scope === "todas" ? q.scope : "activas";
  res.json(svc.listOrders({
    scope, q: typeof q.q === "string" ? q.q : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    mechanicId: q.mechanicId ? Number(q.mechanicId) : undefined,
    vehicleId: q.vehicleId ? Number(q.vehicleId) : undefined,
    clientId: q.clientId ? Number(q.clientId) : undefined,
  }, req.user!));
}));

ordersRouter.get("/orders/:id", ah((req, res) => res.json(svc.getOrder(idParam(req), req.user!))));

ordersRouter.post("/orders", requireAdmin, ah((req, res) => {
  const b = parse(z.object({
    vehicleId: z.number().int().positive().optional(),
    newVehicle: z.object({
      type: z.enum(["auto", "moto"]),
      plate: z.string().refine((s) => svc.normPlate(s).length >= 5, "Revisa la placa."),
      brand: z.string().trim().min(1, "Escribe la marca."),
      model: z.string().trim().min(1, "Escribe el modelo."),
      year: z.number().int().min(1950).max(2100).nullable().optional(),
      color: z.string().optional(),
      clientId: z.number().int().positive().optional(),
      newClient: z.object({
        name: z.string().trim().min(2, "Escribe el nombre del cliente."),
        phone: z.string().refine((s) => s.replace(/\D/g, "").length === 8, "El celular debe tener 8 dígitos."),
        ci: z.string().optional(),
      }).optional(),
    }).optional(),
    reason: z.string().trim().min(2, "Escribe lo que dice el cliente."),
    km: z.number().int().min(0).nullable().optional(),
    fuel: fuel.default(2),
    objects: objects.default([]),
    mechanicId: z.number().int().positive().nullable().optional(),
  }), req.body);
  const id = svc.createOrder(b, req.user!);
  res.status(201).json(svc.getOrder(id, req.user!));
}));

ordersRouter.post("/orders/:id/items", ah((req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ kind: z.enum(["servicio", "repuesto"]), refId: z.number().int().positive(), qty: z.number().int().min(1).max(999).optional() }), req.body);
  const r = svc.addItem(id, b, req.user!);
  res.json({ ...svc.getOrder(id, req.user!), toBuy: r.toBuy });
}));

ordersRouter.patch("/orders/:id/items/:itemId", ah((req, res) => {
  const id = idParam(req);
  const { qty } = parse(z.object({ qty: z.number().int().min(1).max(999) }), req.body);
  const r = svc.setItemQty(id, idParam(req, "itemId"), qty, req.user!);
  res.json({ ...svc.getOrder(id, req.user!), toBuy: r.toBuy });
}));

ordersRouter.delete("/orders/:id/items/:itemId", ah((req, res) => {
  const id = idParam(req);
  svc.removeItem(id, idParam(req, "itemId"), req.user!);
  res.json(svc.getOrder(id, req.user!));
}));

ordersRouter.post("/orders/:id/move", ah((req, res) => {
  const id = idParam(req);
  const { to } = parse(z.object({ to: z.enum(ORDER_STATES) }), req.body);
  svc.moveOrder(id, to, req.user!);
  res.json(svc.getOrder(id, req.user!));
}));

ordersRouter.post("/orders/:id/wait", ah((req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ waiting: z.boolean(), note: z.string().max(200).default("") }), req.body);
  svc.setWaiting(id, b.waiting, b.note, req.user!);
  res.json(svc.getOrder(id, req.user!));
}));

ordersRouter.patch("/orders/:id/mechanic", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const { mechanicId } = parse(z.object({ mechanicId: z.number().int().positive().nullable() }), req.body);
  svc.assignMechanic(id, mechanicId, req.user!);
  res.json(svc.getOrder(id, req.user!));
}));

ordersRouter.patch("/orders/:id/reception", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ reason: z.string().trim().min(2).optional(), km: z.number().int().min(0).optional(), fuel: fuel.optional(), objects: objects.optional() }), req.body);
  svc.updateReception(id, b, req.user!);
  res.json(svc.getOrder(id, req.user!));
}));

ordersRouter.post("/orders/:id/cancel", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, "Escribe por qué se cancela la orden.") }), req.body);
  svc.cancelOrder(id, reason, req.user!);
  res.json(svc.getOrder(id, req.user!));
}));

ordersRouter.post("/orders/:id/pay", requireAdmin, ah((req, res) => {
  const id = idParam(req);
  const b = parse(z.object({
    method: z.enum(["efectivo", "qr"]),
    received: z.number().min(0).nullable().optional().transform((n) => (n == null ? n : Math.round(n * 100))),
    reference: z.string().max(60).optional(),
  }), req.body);
  svc.payOrder(id, b, req.user!);
  res.json(svc.getOrder(id, req.user!));
}));
