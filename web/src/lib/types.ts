export type Role = "admin" | "mecanico";
export type User = { id: number; name: string; username: string; role: Role; specialty: string };
export type OrderState = "revision" | "presupuesto" | "reparacion" | "listo" | "entregado" | "cancelado";

export type VehicleLite = { id: number; plate: string; brand: string; model: string; year: number | null; type: "auto" | "moto" };
export type OrderSummary = {
  id: number; number: number; state: OrderState; waiting: boolean; reason: string; createdAt: number; deliveredAt: number | null; km: number;
  total?: number; itemsCount: number; vehicle: VehicleLite; client: { id: number; name: string; phone?: string };
  mechanic: { id: number; name: string } | null; payment?: { method: "efectivo" | "qr"; createdAt: number; amount: number } | null;
};
export type OrderItem = { id: number; kind: "servicio" | "repuesto"; serviceId: number | null; partId: number | null; name: string; category: string; qty: number; unitPrice?: number; toBuy: boolean };
export type OrderEvent = { type: string; note: string; createdAt: number; userName: string | null };
export type Payment = { id: number; method: "efectivo" | "qr"; amount: number; received: number | null; reference: string; receiptNumber: number; createdAt: number };
export type OrderDetail = {
  id: number; number: number; state: OrderState; waiting: boolean; waitingNote: string; reason: string; km: number; fuel: number; objects: string[];
  createdAt: number; updatedAt: number; deliveredAt: number | null; mechanicId: number | null;
  vehicle: VehicleLite & { color: string; km: number; clientId: number }; client: { id: number; name: string; phone?: string; ci?: string };
  mechanic: { id: number; name: string } | null; items: OrderItem[]; events: OrderEvent[]; payment: Payment | null; total?: number;
  previous: { id: number; number: number; state: OrderState; reason: string; createdAt: number; km: number; total?: number }[];
  toBuy?: boolean;
};
export type Service = { id: number; name: string; category: string; price?: number; active: boolean };
export type Part = { id: number; code: string; name: string; category: string; cost?: number; price?: number; stock: number; minStock: number; location: string; active: boolean };
export type Mechanic = { id: number; name: string; specialty: string };
export type Settings = { businessName: string; tagline: string; phone: string; address: string; receiptNote: string };
