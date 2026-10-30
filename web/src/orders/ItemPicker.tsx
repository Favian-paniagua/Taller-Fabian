import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useIsAdmin } from "../lib/auth";
import { Icon } from "../lib/icons";
import { useParts, useServices } from "../lib/queries";
import { money, plateTxt } from "../lib/format";
import type { OrderDetail, Part } from "../lib/types";
import { Empty, Loading, Modal, ModalHead, Seg } from "../components/ui";
import { useOrderActions } from "./useOrderActions";

export default function ItemPicker({ open, order, onClose }: { open: boolean; order: OrderDetail; onClose: () => void }) {
  const admin = useIsAdmin();
  const [tab, setTab] = useState<"servicio" | "repuesto">("servicio");
  const [q, setQ] = useState("");
  const services = useServices();
  const parts = useParts();
  const { run } = useOrderActions(order.id);
  const [flash, setFlash] = useState<string | null>(null);
  const moto = order.vehicle.type === "moto";
  const inOrder = new Set(order.items.map((x) => `${x.kind}-${x.serviceId ?? x.partId}`));

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (tab === "servicio") {
      return (services.data ?? []).filter((s) => !ql || (s.name + " " + s.category).toLowerCase().includes(ql))
        .sort((a, b) => (moto ? Number(b.category === "Motos") - Number(a.category === "Motos") : Number(a.category === "Motos") - Number(b.category === "Motos")));
    }
    return (parts.data ?? []).filter((p) => !ql || (p.name + " " + p.code + " " + p.category).toLowerCase().includes(ql));
  }, [tab, q, services.data, parts.data, moto]);

  const add = async (refId: number, name: string) => {
    const key = `${tab}-${refId}`;
    const r = await run(() => api.post(`/orders/${order.id}/items`, { kind: tab, refId }), (o) => (o.toBuy ? `No hay ${name} en stock. Queda anotado para comprar.` : undefined));
    if (r) { setFlash(key); setTimeout(() => setFlash((f) => (f === key ? null : f)), 900); }
  };

  const loading = tab === "servicio" ? services.isLoading : parts.isLoading;
  return (
    <Modal open={open} onClose={onClose} label="Agregar a la orden">
      <ModalHead title="Agregar a la orden" kicker={`${plateTxt(order.vehicle.plate)} · ${order.vehicle.brand} ${order.vehicle.model}`} onClose={onClose} />
      <div className="card-body">
        <Seg full value={tab} onChange={(v) => { setTab(v); setQ(""); }} options={[["servicio", "Trabajos"], ["repuesto", "Repuestos"]]} label="Tipo" />
        <label className="search" style={{ maxWidth: "none" }}><Icon n="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" autoComplete="off" aria-label="Buscar" /></label>
        <div className="pick-list">
          {loading ? <Loading /> : list.length ? list.map((it) => {
            const key = `${tab}-${it.id}`;
            const stock = tab === "repuesto" ? (it as Part).stock : null;
            return (
              <button key={key} type="button" className={`pick ${inOrder.has(key) || flash === key ? "sel" : ""}`} onClick={() => add(it.id, it.name)}>
                <span className="grow">
                  <span className="t">{it.name}</span>
                  <span className="s">{stock != null ? (stock > 0 ? `Quedan ${stock}` : <span style={{ color: "var(--crit)" }}>Agotado, hay que comprarlo</span>) : it.category}</span>
                </span>
                {admin && <span className="num" style={{ fontWeight: 600 }}>{money(it.price)}</span>}
                <span className="ok"><Icon n="check" /></span>
              </button>
            );
          }) : <Empty>Sin resultados</Empty>}
        </div>
      </div>
      <div className="card-foot">
        <span className="note">{order.items.length ? `${order.items.length} en la orden${admin ? ` · ${money(order.total)}` : ""}` : "Toca para agregar"}</span>
        <button className="btn primary" onClick={onClose}>Listo</button>
      </div>
    </Modal>
  );
}
