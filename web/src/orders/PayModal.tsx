import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { useSettings } from "../lib/queries";
import { money, num, otNum, plateTxt, timeHM, toBs, waLink } from "../lib/format";
import type { OrderDetail } from "../lib/types";
import { Modal, ModalHead, Seg } from "../components/ui";
import { useOrderActions } from "./useOrderActions";

export default function PayModal({ open, order, onClose }: { open: boolean; order: OrderDetail; onClose: () => void }) {
  const total = order.total ?? 0;
  const [method, setMethod] = useState<"efectivo" | "qr">("efectivo");
  const [received, setReceived] = useState(String(toBs(total)));
  const [ref, setRef] = useState("");
  const [done, setDone] = useState<OrderDetail | null>(null);
  const [fade, setFade] = useState(false);
  const { run, busy } = useOrderActions(order.id);

  useEffect(() => { if (open) { setMethod("efectivo"); setReceived(String(toBs(total))); setRef(""); setDone(null); setFade(false); } }, [open, total]);

  const rec = Math.round(parseFloat(received.replace(",", ".")) * 100);
  const change = (Number.isFinite(rec) ? rec : 0) - total;

  const confirm = async () => {
    if (method === "efectivo" && !(rec >= total)) return;
    const r = await run(() => api.post(`/orders/${order.id}/pay`, { method, received: method === "efectivo" ? rec / 100 : null, reference: ref }), `Pago registrado · ${money(total)}`);
    if (r) { setFade(true); setTimeout(() => setDone(r), 180); }
  };

  return (
    <Modal open={open} onClose={onClose} label="Cobrar y entregar">
      {done ? <Receipt order={done} onClose={onClose} /> : (<>
        <ModalHead title="Cobrar y entregar" kicker={`${otNum(order.number)} · ${plateTxt(order.vehicle.plate)}`} onClose={onClose} />
        <div className={`card-body swap ${fade ? "out" : ""}`}>
          <div className="pay-total"><span>Total a cobrar</span><b>{money(total)}</b></div>
          <div style={{ display: "flex", justifyContent: "center" }}><Seg value={method} onChange={setMethod} options={[["efectivo", "Efectivo"], ["qr", "QR"]]} label="Medio de pago" /></div>
          {method === "efectivo" ? (<>
            <div className="field"><label htmlFor="pay-rec">¿Cuánto te entregó? (Bs)</label><input id="pay-rec" type="number" inputMode="decimal" min={0} step="0.5" value={received} onChange={(e) => setReceived(e.target.value)} /></div>
            <div className={`change ${change < 0 ? "neg" : ""}`}><span>{change < 0 ? "Falta" : "Cambio a devolver"}</span><span className="num">{money(Math.abs(change))}</span></div>
          </>) : (<>
            <div className="qr-note"><Icon n="info" /><span>Muestra al cliente el QR del banco del taller. Cuando veas el pago confirmado en tu banca, anota el número de transacción.</span></div>
            <div className="field"><label htmlFor="pay-ref">N° de transacción (opcional)</label><input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ej. 784512396" maxLength={60} /></div>
          </>)}
        </div>
        <div className="card-foot">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn good" disabled={busy || (method === "efectivo" && change < 0)} onClick={confirm}><Icon n="check" />Confirmar pago</button>
        </div>
      </>)}
    </Modal>
  );
}

/** Nota de venta: se puede imprimir o enviar por WhatsApp. */
export function Receipt({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const s = useSettings().data;
  const p = order.payment!;
  const n = String(p.receiptNumber).padStart(6, "0");
  const v = order.vehicle;
  const msg = `${s?.businessName ?? "Taller"}\nNota de venta N° ${n}\n${v.brand} ${v.model} (${plateTxt(v.plate)})\n${order.items.map((x) => `- ${x.name}${x.qty > 1 ? " x" + x.qty : ""}: ${money(x.qty * (x.unitPrice ?? 0))}`).join("\n")}\nTotal pagado: ${money(p.amount)} (${p.method === "qr" ? "QR" : "efectivo"})\nGracias por su confianza.`;
  return (<>
    <ModalHead title="Nota de venta" onClose={onClose} />
    <div className="card-body">
      <div className="receipt printable">
        <div className="rhead"><span className="logo-chip"><img src="/logo.png" alt="" /></span><div><b>{s?.businessName}</b><div className="muted">{s?.tagline}</div>{(s?.phone || s?.address) && <div className="muted">{[s?.address, s?.phone && `Cel. ${s.phone}`].filter(Boolean).join(" · ")}</div>}</div></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span className="mono">N° {n}</span><span className="muted">{new Date(p.createdAt).toLocaleDateString("es-BO")} {timeHM(p.createdAt)}</span></div>
        <div><b>{order.client.name}</b><div className="muted">{v.brand} {v.model} · {plateTxt(v.plate)} · {num(order.km)} km · {otNum(order.number)}</div></div>
        <table><thead><tr><th>Detalle</th><th className="r">Cant.</th><th className="r">Importe</th></tr></thead>
          <tbody>{order.items.map((x) => <tr key={x.id}><td>{x.name}</td><td className="r num">{x.qty}</td><td className="r num">{money(x.qty * (x.unitPrice ?? 0))}</td></tr>)}</tbody></table>
        <div className="rtotal"><span>Total pagado</span><span>{money(p.amount)}</span></div>
        <div className="muted">Pago con {p.method === "qr" ? `QR${p.reference ? ` (transacción ${p.reference})` : ""}` : `efectivo${p.received && p.received > p.amount ? ` · recibido ${money(p.received)}, cambio ${money(p.received - p.amount)}` : ""}`}.</div>
        {s?.receiptNote && <div className="muted">{s.receiptNote}</div>}
      </div>
    </div>
    <div className="card-foot">
      <button className="btn" onClick={() => window.print()}><Icon n="print" />Imprimir</button>
      <a className="btn wa" href={waLink(order.client.phone, msg)} target="_blank" rel="noopener noreferrer"><Icon n="wa" />Enviar por WhatsApp</a>
      <button className="btn primary" onClick={onClose}>Listo</button>
    </div>
  </>);
}
