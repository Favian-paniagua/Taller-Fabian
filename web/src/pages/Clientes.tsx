import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { usePanels } from "../lib/panels";
import { ago, initials } from "../lib/format";
import { Empty, ErrorBox, Loading, Plate } from "../components/ui";

type Row = { id: number; name: string; ci: string; phone: string; vehicles: { id: number; plate: string }[]; lastVisit: number | null; visits: number };

export default function Clientes() {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q.trim());
  const { openClient } = usePanels();
  const list = useQuery({ queryKey: ["clients", dq], queryFn: () => api.get<Row[]>(`/clients${dq ? `?q=${encodeURIComponent(dq)}` : ""}`), placeholderData: (p) => p });
  const rows = list.data ?? [];
  return (
    <>
      <div className="page-head"><div><h1>Clientes y vehículos</h1><p>{list.data ? `${rows.length} ${dq ? "encontrados" : "clientes"}` : "Cargando…"} · los clientes nuevos se registran al abrir una orden</p></div></div>
      <div className="toolbar"><label className="search"><Icon n="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CI, celular o placa" autoComplete="off" aria-label="Buscar" /></label></div>
      <section className="panel">
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : !rows.length ? <Empty>No hay clientes que coincidan.</Empty> : (
          <div className="list">{rows.map((c) => (
            <button key={c.id} className="list-row row-click plain" onClick={() => openClient(c.id)}>
              <span className="av lg">{initials(c.name)}</span>
              <div className="grow"><div className="t">{c.name}</div><div className="s">{c.ci ? `CI ${c.ci} · ` : ""}{c.phone || "sin celular"}</div></div>
              <div className="hide-sm" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>{c.vehicles.map((v) => <Plate key={v.id} plate={v.plate} />)}</div>
              <div style={{ textAlign: "right", minWidth: 86 }}><div className="s">{c.lastVisit ? "Última visita" : "Sin visitas"}</div><div className="t" style={{ fontSize: 13 }}>{c.lastVisit ? ago(c.lastVisit) : ""}</div></div>
            </button>
          ))}</div>
        )}
      </section>
    </>
  );
}
