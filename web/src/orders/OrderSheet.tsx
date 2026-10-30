import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Icon } from "../lib/icons";
import { usePanels } from "../lib/panels";
import { useMechanics, useOrder } from "../lib/queries";
import { EVENT_LABEL, STEPS, stepClass, stepIndex } from "../lib/steps";
import { dateShort, firstName, FUEL, money, num, otNum, plateTxt, timeHM, waLink, when } from "../lib/format";
import type { OrderDetail, OrderState } from "../lib/types";
import { Empty, ErrorBox, Loading, Modal, ModalHead, Plate, Sheet, StatePill } from "../components/ui";
import { useOrderActions } from "./useOrderActions";
import ItemPicker from "./ItemPicker";
import PayModal, { Receipt } from "./PayModal";

export default function OrderSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [lastId, setLastId] = useState<number | null>(id);
  if (id && id !== lastId) setLastId(id);
  return (
    <Sheet open={!!id} onClose={onClose} label="Detalle de la orden">
      {lastId && <OrderBody id={lastId} onClose={onClose} />}
    </Sheet>
  );
}

function OrderBody({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useOrder(id);
  const { user } = useAuth();
  const admin = user!.role === "admin";
  const o = q.data;
  const { run, busy } = useOrderActions(id);
  const [picker, setPicker] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [waitBox, setWaitBox] = useState(false);
  const [cancelBox, setCancelBox] = useState(false);
  const { openOrder } = usePanels();
  const mechanics = useMechanics().data ?? [];

  if (q.isLoading || !o) return (<>
    <header className="sheet-head"><div className="grow"><h2>Cargando orden…</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button></header>
    <div className="sheet-body">{q.error ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : <Loading rows={4} />}</div>
  </>);

  const closed = o.state === "entregado" || o.state === "cancelado";
  const canEditItems = !closed && (admin || o.state === "revision");
  const idx = stepIndex(o.state);
  const move = (to: OrderState, msg: string) => run(() => api.post(`/orders/${id}/move`, { to }), msg);
  const labor = o.items.filter((x) => x.kind === "servicio").reduce((a, x) => a + x.qty * (x.unitPrice ?? 0), 0);
  const partsT = o.items.filter((x) => x.kind === "repuesto").reduce((a, x) => a + x.qty * (x.unitPrice ?? 0), 0);

  return (
    <>
      <header className="sheet-head grab-zone">
        <div className="grow">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}><Plate plate={o.vehicle.plate} /><span className="mono muted" style={{ fontSize: 12 }}>{otNum(o.number)}</span>{o.state === "cancelado" && <StatePill state="cancelado" />}</div>
          <h2>{o.vehicle.brand} {o.vehicle.model} {o.vehicle.year ?? ""}</h2>
          <div className="sub">{o.client.name}{admin && o.client.phone ? ` · ${o.client.phone}` : ""}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button>
      </header>
      <div className="sheet-body">
        {o.state !== "cancelado" && (
          <div className="steps" aria-label="Avance de la orden">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`stp ${s.cls} ${i < idx ? "done" : i === idx ? "now" : ""}`}><span className="dot">{i < idx ? <Icon n="check" /> : s.n}</span>{s.label}</div>
            ))}
          </div>
        )}

        <NextStep o={o} admin={admin} busy={busy} move={move}
          onPicker={() => setPicker(true)} onPay={() => setPaying(true)} onReceipt={() => setReceipt(true)}
          onWait={() => setWaitBox(true)} onResume={() => run(() => api.post(`/orders/${id}/wait`, { waiting: false }), "Reparación reanudada")} />

        <section className="section"><h3>Trabajos y repuestos</h3>
          <div className="panel">
            <div className="items">
              {o.items.length ? o.items.map((x) => (
                <div key={x.id} className="item">
                  <div className="grow">
                    <div className="t">{x.name}</div>
                    <div className="s">{x.kind === "servicio" ? "Mano de obra" : `Repuesto${admin ? ` · ${money(x.unitPrice)} c/u` : ""}`}{x.toBuy && <> · <span style={{ color: "var(--crit)" }}>hay que comprarlo</span></>}</div>
                  </div>
                  {x.kind === "repuesto" && canEditItems ? (
                    <span className="qty">
                      <button aria-label="Menos" disabled={busy || x.qty <= 1} onClick={() => run(() => api.patch(`/orders/${id}/items/${x.id}`, { qty: x.qty - 1 }))}>−</button>
                      <span>{x.qty}</span>
                      <button aria-label="Más" disabled={busy} onClick={() => run(() => api.patch(`/orders/${id}/items/${x.id}`, { qty: x.qty + 1 }), (r) => (r.toBuy && !x.toBuy ? `No hay más ${x.name} en stock. Queda anotado para comprar.` : undefined))}>+</button>
                    </span>
                  ) : x.qty > 1 ? <span className="muted num">x{x.qty}</span> : null}
                  {admin && <span className="num" style={{ minWidth: 70, textAlign: "right", fontWeight: 600 }}>{money(x.qty * (x.unitPrice ?? 0))}</span>}
                  {canEditItems && <button className="icon-btn" style={{ width: 30, height: 30, background: "none" }} aria-label={`Quitar ${x.name}`} disabled={busy} onClick={() => run(() => api.del(`/orders/${id}/items/${x.id}`), `Quitado: ${x.name}`)}><Icon n="trash" /></button>}
                </div>
              )) : <Empty pad={20}>Todavía no hay trabajos anotados.</Empty>}
            </div>
            {canEditItems && o.state !== "revision" && <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)" }}><button className="btn sm" onClick={() => setPicker(true)}><Icon n="plus" />Agregar trabajo o repuesto</button></div>}
            {admin && o.items.length > 0 && (
              <div className="totals">
                <div><span className="muted">Mano de obra</span><span className="num">{money(labor)}</span></div>
                <div><span className="muted">Repuestos</span><span className="num">{money(partsT)}</span></div>
                <div className="big"><span>Total</span><span>{money(o.total)}</span></div>
              </div>
            )}
          </div>
        </section>

        <section className="section"><h3>Recepción</h3>
          <div className="panel">
            <div className="quote"><span className="muted" style={{ fontSize: 12, display: "block" }}>Lo que dijo el cliente</span><q>{o.reason}</q></div>
            <dl className="facts" style={{ borderTop: "1px solid var(--line)" }}>
              <div><dt>Kilometraje</dt><dd className="num">{num(o.km)} km</dd></div>
              <div><dt>Combustible</dt><dd><span className="fuel">{FUEL.map((_, i) => <i key={i} className={i <= o.fuel ? "on" : ""} />)}</span><span className="muted" style={{ fontSize: 12 }}>{FUEL[o.fuel]}</span></dd></div>
              <div><dt>Objetos dejados</dt><dd>{o.objects.length ? o.objects.join(", ") : "Ninguno"}</dd></div>
              <div><dt>Mecánico</dt><dd>
                {admin && !closed ? (
                  <select aria-label="Mecánico asignado" className="inline-select" value={o.mechanicId ?? ""} disabled={busy}
                    onChange={(e) => run(() => api.patch(`/orders/${id}/mechanic`, { mechanicId: e.target.value ? Number(e.target.value) : null }), "Mecánico asignado")}>
                    <option value="">Sin asignar</option>
                    {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    {o.mechanic && !mechanics.some((m) => m.id === o.mechanic!.id) && <option value={o.mechanic.id}>{o.mechanic.name}</option>}
                  </select>
                ) : (o.mechanic?.name ?? "Sin asignar")}
              </dd></div>
            </dl>
          </div>
        </section>

        <section className="section"><h3>Lo que pasó con esta orden</h3>
          <div className="panel timeline">
            {o.events.map((e, i) => (
              <div key={i} className="tl"><b /><span>{EVENT_LABEL[e.type] ?? e.type}{e.note && e.type !== "entregado" ? <span className="muted"> · {e.note}</span> : null}{e.userName ? <span className="muted"> · {firstName(e.userName)}</span> : null}</span><span className="muted num">{when(e.createdAt)}</span></div>
            ))}
          </div>
        </section>

        <section className="section"><h3>Visitas anteriores de este vehículo</h3>
          <div className="panel list">
            {o.previous.length ? o.previous.map((p) => (
              <button key={p.id} className="list-row row-click plain" onClick={() => openOrder(p.id)}>
                <div className="grow"><div className="t" style={{ fontSize: 13 }}>{p.reason}</div><div className="s">{dateShort(p.createdAt)} · {num(p.km)} km{admin ? ` · ${p.total ? money(p.total) : "sin presupuesto"}` : ""}</div></div>
                <StatePill state={p.state} />
              </button>
            )) : <Empty pad={16}>Es la primera visita.</Empty>}
          </div>
        </section>

        {admin && !closed && <button className="link-btn quiet" style={{ justifySelf: "start", color: "var(--crit)" }} onClick={() => setCancelBox(true)}>Cancelar esta orden</button>}
      </div>

      <ItemPicker open={picker} order={o} onClose={() => setPicker(false)} />
      {admin && <PayModal open={paying} order={o} onClose={() => setPaying(false)} />}
      {admin && o.payment && <Modal open={receipt} onClose={() => setReceipt(false)} label="Nota de venta"><Receipt order={o} onClose={() => setReceipt(false)} /></Modal>}
      <WaitModal open={waitBox} onClose={() => setWaitBox(false)} onSave={(note) => { setWaitBox(false); run(() => api.post(`/orders/${id}/wait`, { waiting: true, note }), "Orden en pausa hasta que llegue el repuesto"); }} />
      <CancelModal open={cancelBox} onClose={() => setCancelBox(false)} onSave={(reason) => { setCancelBox(false); run(() => api.post(`/orders/${id}/cancel`, { reason }), "Orden cancelada. Los repuestos volvieron al stock."); }} />
    </>
  );
}

function NextStep({ o, admin, busy, move, onPicker, onPay, onReceipt, onWait, onResume }: {
  o: OrderDetail; admin: boolean; busy: boolean; move: (to: OrderState, msg: string) => void;
  onPicker: () => void; onPay: () => void; onReceipt: () => void; onWait: () => void; onResume: () => void;
}) {
  const v = o.vehicle, c = o.client;
  const lines = o.items.map((x) => `- ${x.name}${x.qty > 1 ? " x" + x.qty : ""}: ${money(x.qty * (x.unitPrice ?? 0))}`).join("\n");
  const veh = `${v.brand} ${v.model} (${plateTxt(v.plate)})`;
  const wa = (msg: string, label: string) => <a className="btn wa" href={waLink(c.phone, msg)} target="_blank" rel="noopener noreferrer"><Icon n="wa" />{label}</a>;
  const back = admin ? <button className="link-btn quiet back" disabled={busy} onClick={() => move(STEPS[stepIndex(o.state) - 1].id, "Volvió al paso anterior")}>Volver al paso anterior</button> : null;
  const box = (cls: string, eyebrow: string, title: string, text: string, buttons: React.ReactNode, extra?: React.ReactNode) => (
    <section className={`panel next ${stepClass(o.state)} ${cls}`}><span className="eyebrow">{eyebrow}</span><h3>{title}</h3><p>{text}</p>{buttons && <div className="actions">{buttons}</div>}{extra}</section>
  );
  const mechName = o.mechanic ? firstName(o.mechanic.name) : "El mecánico";
  switch (o.state) {
    case "revision":
      return box("", "Paso 1 de 4 · Revisión", "Revisa el vehículo y anota los trabajos",
        o.items.length ? `Hay ${o.items.length} ${o.items.length === 1 ? "trabajo anotado" : "trabajos anotados"}${admin ? ` por ${money(o.total)}` : ""}. Si ya está todo, ${admin ? "arma el presupuesto" : "avisa que la revisión está lista"}.` : "Agrega los servicios del tarifario y los repuestos que hacen falta.",
        <>
          <button className={`btn ${o.items.length ? "" : "primary"}`} onClick={onPicker}><Icon n="plus" />Agregar trabajo o repuesto</button>
          {o.items.length > 0 && <button className="btn primary" disabled={busy} onClick={() => move("presupuesto", admin ? "Presupuesto listo para enviar" : "Revisión lista: el dueño enviará el presupuesto")}>{admin ? "Armar presupuesto" : "Revisión lista"}<Icon n="arrow" /></button>}
        </>);
    case "presupuesto":
      if (!admin) return box("", "Paso 2 de 4 · Presupuesto", "Esperando que el cliente acepte", "El dueño envía el presupuesto. Cuando el cliente acepte, la orden pasa a reparación.", null);
      return box("", "Paso 2 de 4 · Presupuesto", `Espera que ${firstName(c.name)} acepte ${money(o.total)}`,
        "Envíale el presupuesto por WhatsApp. Cuando responda que sí, empieza la reparación.",
        <>
          {wa(`Hola ${firstName(c.name)}, le saluda el taller. El presupuesto para su ${veh} es:\n${lines}\nTotal: ${money(o.total)}\n¿Nos confirma para empezar el trabajo?`, "Enviar presupuesto")}
          <button className="btn primary" disabled={busy} onClick={() => move("reparacion", "Reparación en marcha")}><Icon n="check" />El cliente aceptó</button>
        </>, back);
    case "reparacion":
      if (o.waiting) return box("wait", "Paso 3 de 4 · En pausa", "Falta un repuesto", o.waitingNote || "La reparación sigue cuando llegue el repuesto.",
        <button className="btn primary" disabled={busy} onClick={onResume}><Icon n="check" />Ya llegó el repuesto</button>);
      return box("", "Paso 3 de 4 · Reparación", admin ? `${mechName} está trabajando en el vehículo` : "Estás trabajando en este vehículo",
        "Cuando el trabajo esté terminado y probado, márcalo para avisar al cliente.",
        <>
          <button className="btn" disabled={busy} onClick={onWait}><Icon n="pause" />Falta un repuesto</button>
          <button className="btn primary" disabled={busy} onClick={() => move("listo", "Listo para entregar")}><Icon n="check" />Trabajo terminado</button>
        </>, back);
    case "listo":
      if (!admin) return box("", "Paso 4 de 4 · Entrega", "Trabajo terminado", "El dueño avisa al cliente y cobra al entregar.", null);
      return box("", "Paso 4 de 4 · Entrega", `Avisa a ${firstName(c.name)} y cobra ${money(o.total)}`,
        "Mándale el aviso por WhatsApp. Cuando venga a recoger, cobra en efectivo o QR y entrega el vehículo.",
        <>
          {wa(`Hola ${firstName(c.name)}, su ${veh} ya está listo. Total a pagar: ${money(o.total)}. Puede pasar a recogerlo cuando guste.`, "Avisar que está listo")}
          <button className="btn good" disabled={busy} onClick={onPay}><Icon n="cash" />Cobrar y entregar</button>
        </>, back);
    case "entregado":
      return box("done-box", "Terminado", admin && o.payment ? `Entregado y pagado: ${money(o.payment.amount)}` : "Entregado al cliente",
        o.payment ? `Pagó con ${o.payment.method === "qr" ? "QR" : "efectivo"} el ${dateShort(o.payment.createdAt)} a las ${timeHM(o.payment.createdAt)}.` : "",
        admin && o.payment ? <button className="btn" onClick={onReceipt}><Icon n="print" />Ver nota de venta</button> : null);
    default:
      return box("wait", "Cancelada", "Esta orden se canceló", o.events.find((e) => e.type === "cancelado")?.note ?? "", null);
  }
}

function WaitModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Modal open={open} onClose={onClose} label="Falta un repuesto">
      <ModalHead title="Falta un repuesto" onClose={onClose} />
      <form onSubmit={(e) => { e.preventDefault(); onSave(note); setNote(""); }}>
        <div className="card-body">
          <div className="field"><label htmlFor="w-note">¿Qué falta y cuándo llega? (opcional)</label><input id="w-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. El kit de embrague llega mañana" maxLength={200} /></div>
        </div>
        <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit"><Icon n="pause" />Poner en pausa</button></div>
      </form>
    </Modal>
  );
}

function CancelModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal open={open} onClose={onClose} label="Cancelar orden">
      <ModalHead title="Cancelar esta orden" onClose={onClose} />
      <form onSubmit={(e) => { e.preventDefault(); if (reason.trim().length >= 3) { onSave(reason); setReason(""); } }}>
        <div className="card-body">
          <p className="muted">Los repuestos que salieron del almacén vuelven al stock. La orden queda en el historial como cancelada.</p>
          <div className="field"><label htmlFor="c-reason">Motivo</label><input id="c-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. El cliente no aceptó el presupuesto" maxLength={200} /></div>
        </div>
        <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Volver</button><button className="btn danger" type="submit" disabled={reason.trim().length < 3}>Cancelar orden</button></div>
      </form>
    </Modal>
  );
}
