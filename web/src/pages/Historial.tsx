import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { usePanels } from "../lib/panels";
import { ago, dateShort, money, otNum } from "../lib/format";
import type { OrderSummary } from "../lib/types";
import { Empty, ErrorBox, Loading, Plate, Seg, StatePill } from "../components/ui";

export default function Historial() {
  const [scope, setScope] = useState<"activas" | "entregadas" | "todas">("todas");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q.trim());
  const { openOrder, newOrder } = usePanels();
  const list = useQuery({ queryKey: ["orders", "hist", scope, dq], queryFn: () => api.get<OrderSummary[]>(`/orders?scope=${scope}&limit=100${dq ? `&q=${encodeURIComponent(dq)}` : ""}`), placeholderData: (p) => p });
  const rows = list.data ?? [];
  return (
    <>
      <div className="page-head">
        <div><h1>Historial de órdenes</h1><p>Busca cualquier trabajo por placa, cliente, vehículo o número de orden</p></div>
        <button className="btn primary hide-sm" onClick={newOrder}><Icon n="plus" />Nueva orden</button>
      </div>
      <div className="toolbar">
        <label className="search"><Icon n="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por placa, cliente o vehículo" autoComplete="off" aria-label="Buscar" /></label>
        <Seg value={scope} onChange={setScope} options={[["activas", "En el taller"], ["entregadas", "Entregados"], ["todas", "Todas"]]} label="Filtro" />
      </div>
      <section className="panel table-wrap">
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : !rows.length ? <Empty>No hay órdenes que coincidan.</Empty> : (<>
          <table>
            <thead><tr><th>Orden</th><th>Vehículo</th><th className="hide-sm">Cliente</th><th>Estado</th><th className="hide-sm">Fecha</th><th className="r">Total</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id} className="row-click" onClick={() => openOrder(o.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openOrder(o.id)}>
                <td className="mono" style={{ fontSize: 13 }}>{otNum(o.number)}</td>
                <td><div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><Plate plate={o.vehicle.plate} /><span>{o.vehicle.brand} {o.vehicle.model}</span></div></td>
                <td className="hide-sm">{o.client.name}</td>
                <td><StatePill state={o.state} /></td>
                <td className="hide-sm muted" style={{ fontSize: 13 }}>{o.payment ? dateShort(o.payment.createdAt) : o.state === "cancelado" ? dateShort(o.createdAt) : ago(o.createdAt)}</td>
                <td className="r num">{o.total ? money(o.total) : <span className="muted">—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
          {rows.length >= 100 && <Empty pad={14}>Se muestran las 100 más recientes. Usa el buscador para encontrar otras.</Empty>}
        </>)}
      </section>
    </>
  );
}
