import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useToast } from "../components/ui";
import type { OrderDetail } from "../lib/types";

/** Ejecuta una acción sobre una orden, actualiza la caché y avisa el resultado. */
export function useOrderActions(id: number | null) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<OrderDetail>, ok?: string | ((o: OrderDetail) => string | undefined)) => {
    if (busy) return null;
    setBusy(true);
    try {
      const o = await fn();
      qc.setQueryData(["order", id], o);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["parts"] });
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      const msg = typeof ok === "function" ? ok(o) : ok;
      if (msg) toast(msg);
      return o;
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo completar.", "error");
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, id, qc, toast]);
  return { run, busy };
}
