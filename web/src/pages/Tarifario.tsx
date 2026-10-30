import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { toBs } from "../lib/format";
import type { Service } from "../lib/types";
import { ErrorBox, Loading, Modal, ModalHead, useToast } from "../components/ui";

const CATS = ["Mecánica", "Electricidad", "Motos"];

export default function Tarifario() {
  const list = useQuery({ queryKey: ["services", "all"], queryFn: () => api.get<Service[]>("/services?all=1") });
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["services"] }); };
  const update = async (s: Service, body: Partial<{ price: number; active: boolean; name: string }>, msg: string) => {
    try { await api.patch(`/services/${s.id}`, body); refresh(); toast(msg); }
    catch (e) { toast(e instanceof Error ? e.message : "No se pudo guardar", "error"); }
  };
  return (
    <>
      <div className="page-head">
        <div><h1>Tarifario de servicios</h1><p>Precio fijo de mano de obra por servicio. Los repuestos se cobran aparte.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" />Nuevo servicio</button>
      </div>
      <section className="panel" style={{ maxWidth: 820 }}>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : CATS.map((cat) => {
          const rows = (list.data ?? []).filter((s) => s.category === cat);
          if (!rows.length) return null;
          return (
            <div key={cat} className="svc-group"><h3>{cat}</h3>
              <div className="list">{rows.map((s) => (
                <div key={s.id} className="list-row" style={{ opacity: s.active ? 1 : 0.55 }}>
                  <div className="grow"><label className="t" htmlFor={`pr-${s.id}`}>{s.name}</label>{!s.active && <div className="s">Oculto: no aparece al anotar trabajos</div>}</div>
                  <span className="muted" style={{ fontSize: 13 }}>Bs</span>
                  <input className="price-input" id={`pr-${s.id}`} type="number" min={0} step={5} inputMode="decimal" defaultValue={toBs(s.price ?? 0)} key={`${s.id}-${s.price}`}
                    onBlur={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && Math.round(v * 100) !== s.price) update(s, { price: v }, `Precio actualizado: ${s.name}`); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                  <button className="icon-btn" style={{ background: "none" }} title={s.active ? "Ocultar servicio" : "Mostrar servicio"} aria-label={s.active ? `Ocultar ${s.name}` : `Mostrar ${s.name}`}
                    onClick={() => update(s, { active: !s.active }, s.active ? "Servicio oculto" : "Servicio visible otra vez")}><Icon n={s.active ? "ban" : "check"} /></button>
                </div>
              ))}</div>
            </div>
          );
        })}
      </section>
      <NewService open={adding} onClose={() => setAdding(false)} onDone={() => { refresh(); setAdding(false); }} />
    </>
  );
}

function NewService({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Mecánica");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/services", { name, category, price: parseFloat(price) || 0 }); toast("Servicio agregado al tarifario"); setName(""); setPrice(""); onDone(); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo guardar", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} label="Nuevo servicio">
      <ModalHead title="Nuevo servicio" onClose={onClose} />
      <form onSubmit={save} style={{ display: "contents" }}>
        <div className="card-body">
          <div className="field"><label htmlFor="sv-name">Nombre del servicio</label><input id="sv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Cambio de bomba de agua" /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="sv-cat">Categoría</label><select id="sv-cat" value={category} onChange={(e) => setCategory(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label htmlFor="sv-price">Precio de mano de obra (Bs)</label><input id="sv-price" type="number" inputMode="decimal" min={0} step={5} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          </div>
        </div>
        <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || name.trim().length < 3 || !price}>Agregar</button></div>
      </form>
    </Modal>
  );
}
