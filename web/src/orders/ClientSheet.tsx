import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { usePanels } from "../lib/panels";
import { dateShort, firstName, money, num, waLink } from "../lib/format";
import type { OrderSummary } from "../lib/types";
import { Empty, ErrorBox, Loading, Modal, ModalHead, Plate, Sheet, StatePill, useToast } from "../components/ui";

type ClientDetail = { id: number; name: string; ci: string; phone: string; notes: string; spent: number; vehicles: { id: number; plate: string; brand: string; model: string; year: number | null; type: "auto" | "moto"; color: string; km: number }[] };

export default function ClientSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [lastId, setLastId] = useState<number | null>(id);
  if (id && id !== lastId) setLastId(id);
  return <Sheet open={!!id} onClose={onClose} label="Cliente">{lastId && <ClientBody id={lastId} onClose={onClose} />}</Sheet>;
}

function ClientBody({ id, onClose }: { id: number; onClose: () => void }) {
  const c = useQuery({ queryKey: ["client", id], queryFn: () => api.get<ClientDetail>(`/clients/${id}`) });
  const orders = useQuery({ queryKey: ["orders", "client", id], queryFn: () => api.get<OrderSummary[]>(`/orders?scope=todas&clientId=${id}&limit=50`) });
  const { openOrder } = usePanels();
  const [editing, setEditing] = useState(false);
  const d = c.data;
  return (<>
    <header className="sheet-head grab-zone">
      <div className="grow"><h2>{d?.name ?? "Cliente"}</h2>{d && <div className="sub">{d.ci ? `CI ${d.ci} · ` : ""}{d.phone || "sin celular"}</div>}</div>
      {d && <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Editar cliente"><Icon n="edit" /></button>}
      <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button>
    </header>
    <div className="sheet-body">
      {c.isLoading ? <Loading /> : c.error ? <ErrorBox error={c.error} retry={() => c.refetch()} /> : d && (<>
        {d.phone && <div className="actions"><a className="btn wa" href={waLink(d.phone, `Hola ${firstName(d.name)}, le saluda el taller.`)} target="_blank" rel="noopener noreferrer"><Icon n="wa" />Escribir por WhatsApp</a></div>}
        <div className="kpis" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", margin: 0 }}>
          <div className="panel kpi"><span>Visitas</span><b>{orders.data?.length ?? "…"}</b></div>
          <div className="panel kpi"><span>Total pagado</span><b>{money(d.spent)}</b></div>
        </div>
        {d.notes && <div className="panel" style={{ padding: 14, fontSize: 14 }}>{d.notes}</div>}
        <section className="section"><h3>Vehículos</h3>
          <div className="panel list">{d.vehicles.map((v) => (
            <div key={v.id} className="list-row"><Plate plate={v.plate} /><div className="grow"><div className="t">{v.brand} {v.model} {v.year ?? ""}</div><div className="s">{v.type === "moto" ? "Moto" : "Auto"}{v.color ? ` · ${v.color}` : ""} · {num(v.km)} km</div></div></div>
          ))}</div>
        </section>
        <section className="section"><h3>Historial de servicios</h3>
          <div className="panel list">{orders.isLoading ? <Loading /> : orders.data?.length ? orders.data.map((o) => (
            <button key={o.id} className="list-row row-click plain" onClick={() => openOrder(o.id)}>
              <div className="grow"><div className="t" style={{ fontSize: 13 }}>{o.reason}</div><div className="s">{o.vehicle.plate} · {dateShort(o.createdAt)} · {o.total ? money(o.total) : "sin presupuesto"}</div></div>
              <StatePill state={o.state} />
            </button>
          )) : <Empty>Sin visitas registradas.</Empty>}</div>
        </section>
      </>)}
    </div>
    {d && <EditClient open={editing} client={d} onClose={() => setEditing(false)} />}
  </>);
}

function EditClient({ open, client, onClose }: { open: boolean; client: ClientDetail; onClose: () => void }) {
  const [f, setF] = useState({ name: client.name, phone: client.phone, ci: client.ci, notes: client.notes });
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => { if (open) setF({ name: client.name, phone: client.phone, ci: client.ci, notes: client.notes }); }, [open, client]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/clients/${client.id}`, f);
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast("Datos del cliente guardados");
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo guardar", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} label="Editar cliente">
      <ModalHead title="Editar cliente" onClose={onClose} />
      <form onSubmit={save} style={{ display: "contents" }}>
        <div className="card-body">
          <div className="field"><label htmlFor="ec-name">Nombre</label><input id="ec-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="ec-phone">Celular</label><input id="ec-phone" inputMode="tel" maxLength={8} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="field"><label htmlFor="ec-ci">CI</label><input id="ec-ci" value={f.ci} onChange={(e) => setF({ ...f, ci: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="ec-notes">Notas</label><textarea id="ec-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ej. Prefiere que le llamen en la tarde" /></div>
        </div>
        <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy}>Guardar</button></div>
      </form>
    </Modal>
  );
}
