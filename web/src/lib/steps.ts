import type { OrderState } from "./types";

/** El flujo de 4 pasos. `cls` es la clase de color del paso (turquesa, ámbar, azul, verde). */
export const STEPS: { id: OrderState; n: number; label: string; col: string; cls: string }[] = [
  { id: "revision", n: 1, label: "Revisión", col: "Revisar y anotar los trabajos", cls: "s-revision" },
  { id: "presupuesto", n: 2, label: "Presupuesto", col: "Esperando que el cliente acepte", cls: "s-aprobacion" },
  { id: "reparacion", n: 3, label: "Reparación", col: "Trabajo en curso", cls: "s-reparacion" },
  { id: "listo", n: 4, label: "Entrega", col: "Listo: avisar y cobrar", cls: "s-listo" },
];
export const stepIndex = (s: OrderState) => (s === "entregado" ? 4 : STEPS.findIndex((x) => x.id === s));
export const stepClass = (s: OrderState) => (s === "entregado" ? "s-entregado" : s === "cancelado" ? "" : STEPS.find((x) => x.id === s)?.cls ?? "");

export const EVENT_LABEL: Record<string, string> = {
  creada: "Recibido en el taller",
  presupuesto: "Presupuesto listo",
  aprobado: "Cliente aceptó, empieza la reparación",
  espera: "En pausa: falta un repuesto",
  reanuda: "Llegó el repuesto",
  listo: "Trabajo terminado",
  entregado: "Cobrado y entregado",
  vuelve: "Volvió al paso anterior",
  mecanico: "Mecánico asignado",
  recepcion: "Datos de recepción corregidos",
  cancelado: "Orden cancelada",
};
