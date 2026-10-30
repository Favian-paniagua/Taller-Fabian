import { createContext, useContext } from "react";

/** Abre los paneles globales (detalle de orden, cliente, nueva orden) desde cualquier pantalla. */
export type Panels = {
  openOrder: (id: number) => void;
  openClient: (id: number) => void;
  newOrder: () => void;
};
export const PanelsCtx = createContext<Panels>(null!);
export const usePanels = () => useContext(PanelsCtx);
