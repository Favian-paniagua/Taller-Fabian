import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { usePanels } from "../lib/panels";
import { useCashToday } from "../lib/queries";
import { avClass, cap, dateShort, dayLong, firstName, initials, money, nf1, plateTxt, timeHM, waLink } from "../lib/format";
import { CumChart, Donut, HBars, IncomeChart, Spark, Weekdays, WDL, type Bucket } from "../components/charts";
import { ErrorBox, Loading, Modal, ModalHead, Plate, Seg, useToast } from "../components/ui";

type Period = "semana" | "mes" | "trimestre";
type K = { ingresos: number; n: number; ticket: number; hrs: number };
type Dash = {
  range: { start: number; end: number; prevStart: number; prevEnd: number; unit: "day" | "week" };
  current: K; previous: K; buckets: (Bucket & { hrs: number })[];
  cumulative: { current: number[]; previous: number[] };
  totals: { labor: number; parts: number; partsProfit: number };
  categories: { name: string; total: number; n: number }[];
  payments: { efectivo: { total: number; n: number }; qr: { total: number; n: number } };
  topServices: { name: string; n: number; total: number }[];
  topParts: { name: string; n: number; profit: number }[];
  mechanics: { id: number; name: string; n: number; labor: number }[];
  weekdays: number[];
  remind: { id: number; plate: string; brand: string; model: string; clientName: string; phone: string; days: number }[];
};

function labels(p: Period, r: Dash["range"]) {
  if (p === "mes") {
    const m = new Date(r.start).toLocaleDateString("es-BO", { month: "long" }), pm = new Date(r.prevStart).toLocaleDateString("es-BO", { month: "long" });
    return { title: `${cap(m)} ${new Date(r.start).getFullYear()}, día por día`, cmp: `${pm} a la misma fecha`, cur: cap(m), prev: cap(pm) };
  }
  if (p === "trimestre") return { title: "Últimos 3 meses, semana por semana", cmp: "los 3 meses anteriores", cur: "Últimos 3 meses", prev: "3 meses antes" };
  return { title: "Últimos 7 días", cmp: "la semana anterior", cur: "Esta semana", prev: "Semana anterior" };
}

function Delta({ cur, prev, lowerIsBetter, label }: { cur: number; prev: number; lowerIsBetter?: boolean; label: string }) {
  if (!prev) return <span className="delta flat">Sin datos para comparar</span>;
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return <span className="delta flat">Igual que {label}</span>;
  const good = lowerIsBetter ? p < 0 : p > 0;
  return <span className={`delta ${good ? "up" : "down"}`}><Icon n={p > 0 ? "up" : "down"} />{p > 0 ? "+" : "−"}{Math.abs(p)} %<em>vs. {label}</em></span>;
}
const dur = (h: number) => (h < 24 ? `${nf1.format(h)} h` : `${nf1.format(h / 24)} días`);

export default function Resumen() {
  const [period, setPeriod] = useState<Period>("mes");
  const [table, setTable] = useState(false);
  const [entered] = useState(() => Date.now());
  const q = useQuery({ queryKey: ["dashboard", period], queryFn: () => api.get<Dash>(`/dashboard?period=${period}`), placeholderData: (prev) => prev });
  const cash = useCashToday();
  const d = q.data;
  return (
    <>
      <div className="page-head">
        <div><h1>Resumen</h1><p>{d ? labels(period, d.range).title : "Cómo va el taller"}</p></div>
        <Seg value={period} onChange={(v) => { setPeriod(v); setTable(false); }} options={[["semana", "Semana"], ["mes", "Mes"], ["trimestre", "3 meses"]]} label="Periodo" />
      </div>
      {q.isLoading ? <Loading rows={6} /> : q.error ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : d && (
        <div className={`dash-grid ${Date.now() - entered < 1500 ? "stagger enter-anim" : ""}`} style={{ opacity: q.isFetching && q.isPlaceholderData ? 0.6 : 1, transition: "opacity 160ms ease" }}>
          <Body d={d} period={period} table={table} setTable={setTable} cash={cash.data} />
        </div>
      )}
    </>
  );
}

function Body({ d, period, table, setTable, cash }: { d: Dash; period: Period; table: boolean; setTable: (b: boolean) => void; cash: ReturnType<typeof useCashToday>["data"] }) {
  const L = labels(period, d.range);
  const { current: c, previous: p } = d;
  const open = d.buckets.map((b) => (b.closed ? null : b));
  const diff = c.ingresos - p.ingresos;
  const pay = d.payments, efPct = c.ingresos ? Math.round((pay.efectivo.total / c.ingresos) * 100) : 0;
  const best = d.weekdays.indexOf(Math.max(...d.weekdays));
  const unitWord = d.range.unit === "week" ? "semana" : "día";
  const [closing, setClosing] = useState(false);
  const { openOrder } = usePanels();
  return (<>
    <div className="kpis" style={{ margin: 0 }}>
      <div className="panel kpi"><span>Ingresos</span><b>{money(c.ingresos)}</b><Spark values={open.map((b) => (b ? b.mo + b.rp : null))} /><Delta cur={c.ingresos} prev={p.ingresos} label={L.cmp} /></div>
      <div className="panel kpi"><span>Vehículos entregados</span><b>{c.n}</b><Spark values={open.map((b) => (b ? b.n : null))} /><Delta cur={c.n} prev={p.n} label={L.cmp} /></div>
      <div className="panel kpi"><span>Ticket promedio</span><b>{money(Math.round(c.ticket / 100) * 100)}</b><Spark values={open.map((b) => (b && b.n ? (b.mo + b.rp) / b.n : null))} /><Delta cur={c.ticket} prev={p.ticket} label={L.cmp} /></div>
      <div className="panel kpi"><span>Tiempo promedio en el taller</span><b>{dur(c.hrs)}</b><Spark values={open.map((b) => (b && b.n ? b.hrs / b.n : null))} /><Delta cur={c.hrs} prev={p.hrs} lowerIsBetter label={L.cmp} /></div>
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>Ingresos por {unitWord}</h2><span className="sub">Toca una barra para ver el detalle</span></div>
        <div className="legend"><span><i className="sw1" />Mano de obra</span><span><i className="sw2" />Repuestos</span></div></div>
      <IncomeChart buckets={d.buckets} unit={d.range.unit} />
      <div className="chart-foot"><span>Mano de obra <b>{money(d.totals.labor)}</b> · Repuestos <b>{money(d.totals.parts)}</b> · Ganancia en repuestos <b>{money(d.totals.partsProfit)}</b></span>
        <button className="link-btn" onClick={() => setTable(!table)}>{table ? "Ocultar tabla" : "Ver como tabla"}</button></div>
      {table && (
        <div className="table-wrap" style={{ borderTop: "1px solid var(--line)", maxHeight: 320, overflowY: "auto" }}>
          <table><thead><tr><th>{unitWord === "día" ? "Día" : "Semana"}</th><th className="r">Vehículos</th><th className="r">Mano de obra</th><th className="r">Repuestos</th><th className="r">Total</th></tr></thead>
            <tbody>{[...d.buckets].reverse().map((b) => <tr key={b.t0}><td>{d.range.unit === "week" ? `Semana del ${dateShort(b.t0)}` : dayLong(b.t0)}</td><td className="r num">{b.closed ? "Cerrado" : b.n}</td><td className="r num">{money(b.mo)}</td><td className="r num">{money(b.rp)}</td><td className="r num"><b>{money(b.mo + b.rp)}</b></td></tr>)}</tbody></table>
        </div>
      )}
    </section>

    <div className="duo">
      <section className="panel">
        <div className="panel-head"><div><h2>¿Vamos mejor que antes?</h2><span className="sub">Ingresos sumados día a día</span></div>
          <div className="legend"><span><i className="sw1" />{L.cur}</span><span><i className="swp" />{L.prev}</span></div></div>
        {p.ingresos > 0 && <div className={`callout ${diff >= 0 ? "up" : "down"}`}><Icon n={diff >= 0 ? "up" : "down"} /><span>Vas <b>{money(Math.abs(diff))}</b> {diff >= 0 ? "por encima" : "por debajo"} de {L.cmp}</span></div>}
        <CumChart cur={d.cumulative.current} prev={d.cumulative.previous} start={d.range.start} period={period} curLabel={L.cur} prevLabel={L.prev} />
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>¿De dónde vienen los ingresos?</h2><span className="sub">Por tipo de trabajo, con repuestos incluidos</span></div></div>
        <Donut items={d.categories} total={c.ingresos} />
      </section>
    </div>

    <div className="duo">
      <section className="panel"><div className="panel-head"><div><h2>Trabajos más pedidos</h2><span className="sub">Veces realizadas · lo que se cobró</span></div></div>
        <HBars rows={d.topServices.map((s) => ({ key: s.name, name: s.name, val: <><b>{s.n}</b> · {money(s.total)}</>, bar: s.n }))} empty="Sin trabajos en este periodo" /></section>
      <section className="panel"><div className="panel-head"><div><h2>¿Qué días llega más trabajo?</h2><span className="sub">Vehículos que llegan, promedio por día</span></div></div>
        <Weekdays values={d.weekdays} />
        <p className="chart-note">{d.weekdays[best] > 0 ? <>El <b>{WDL[best]}</b> es el día con más trabajo: llegan {nf1.format(d.weekdays[best])} vehículos en promedio.</> : "Todavía no hay llegadas en este periodo."}</p></section>
    </div>

    <div className="duo">
      <div style={{ display: "grid", gap: 16 }}>
        <section className="panel"><div className="panel-head"><h2>Cómo pagan los clientes</h2></div>
          <div className="panel-body">
            <div className="split" role="img" aria-label={`Efectivo ${efPct} %, QR ${c.ingresos ? 100 - efPct : 0} %`}>
              {c.ingresos ? (<>{pay.efectivo.total > 0 && <i className="sw1" style={{ width: `${efPct}%` }} />}{pay.qr.total > 0 && <i className="sw2" style={{ width: `${100 - efPct}%` }} />}</>) : <i style={{ width: "100%", background: "var(--surface-2)", borderRadius: 4 }} />}
            </div>
            <div className="split-legend">
              <div><i className="sw1" /><span>Efectivo</span><span className="v">{money(pay.efectivo.total)}<small>{efPct} % · {pay.efectivo.n} {pay.efectivo.n === 1 ? "cobro" : "cobros"}</small></span></div>
              <div><i className="sw2" /><span>QR</span><span className="v">{money(pay.qr.total)}<small>{c.ingresos ? 100 - efPct : 0} % · {pay.qr.n} {pay.qr.n === 1 ? "cobro" : "cobros"}</small></span></div>
            </div>
          </div></section>
        <section className="panel"><div className="panel-head"><div><h2>Mecánicos</h2><span className="sub">Vehículos entregados · mano de obra</span></div></div>
          <HBars rows={d.mechanics.map((m) => ({ key: m.id, name: <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className={`av ${avClass(m.id)}`}>{initials(m.name)}</span>{m.name}</span>, val: <><b>{m.n}</b> · {money(m.labor)}</>, bar: m.n }))} empty="Todavía no hay mecánicos registrados" /></section>
      </div>
      <section className="panel"><div className="panel-head"><div><h2>Repuestos que más ganancia dejan</h2><span className="sub">Ganancia · unidades vendidas</span></div></div>
        <HBars rows={d.topParts.map((x) => ({ key: x.name, name: x.name, val: <><b>{money(x.profit)}</b> · {x.n} u.</>, bar: x.profit }))} empty="Sin repuestos vendidos" /></section>
    </div>

    <div className="duo">
      <section className="panel"><div className="panel-head"><div><h2>Clientes para recordar</h2><span className="sub">Más de 45 días sin venir al taller</span></div></div>
        <div className="list">{d.remind.length ? d.remind.map((x) => (
          <div key={x.id} className="list-row"><Plate plate={x.plate} /><div className="grow"><div className="t" style={{ fontSize: 13 }}>{x.clientName}</div><div className="s">{x.brand} {x.model} · hace {x.days} días</div></div>
            {x.phone && <a className="btn sm wa" href={waLink(x.phone, `Hola ${firstName(x.clientName)}, le saluda el taller. Su ${x.brand} ${x.model} (${plateTxt(x.plate)}) tuvo su último servicio hace ${x.days} días. ¿Le esperamos esta semana para el cambio de aceite y una revisión general?`)} target="_blank" rel="noopener noreferrer" aria-label={`Recordar por WhatsApp a ${x.clientName}`}><Icon n="wa" /><span className="hide-sm">Recordar</span></a>}
          </div>)) : <div className="empty">Todos los clientes vinieron en los últimos 45 días</div>}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Caja de hoy</h2><span className="sub">{cash?.closing ? `Cerrada a las ${timeHM(cash.closing.createdAt)}` : "Abierta"} · {cash?.list.length ?? 0} {cash?.list.length === 1 ? "cobro" : "cobros"}</span></div>
        <button className={`btn sm ${cash?.closing ? "" : "primary"}`} disabled={!cash || !!cash.closing} onClick={() => setClosing(true)}>{cash?.closing ? "Caja cerrada" : "Cerrar caja"}</button></div>
        <div className="stat-row"><div><span>Efectivo</span><b>{money(cash?.cash)}</b></div><div><span>QR</span><b>{money(cash?.qr)}</b></div><div><span>Total del día</span><b style={{ color: "var(--good)" }}>{money((cash?.cash ?? 0) + (cash?.qr ?? 0))}</b></div></div>
        {!!cash?.list.length && <div className="list" style={{ borderTop: "1px solid var(--line)" }}>{cash.list.map((x) => (
          <button key={x.orderId} className="list-row row-click plain" onClick={() => openOrder(x.orderId)}><span className="num muted" style={{ fontSize: 13 }}>{timeHM(x.createdAt)}</span><div className="grow"><div className="t" style={{ fontSize: 13 }}>{x.clientName}</div><div className="s">{plateTxt(x.plate)} · {x.method === "qr" ? "QR" : "Efectivo"}</div></div><span className="num" style={{ fontWeight: 600 }}>{money(x.amount)}</span></button>
        ))}</div>}
      </section>
    </div>
    {cash && <CloseCash open={closing} onClose={() => setClosing(false)} expected={cash.cash} qr={cash.qr} />}
  </>);
}

function CloseCash({ open, onClose, expected, qr }: { open: boolean; onClose: () => void; expected: number; qr: number }) {
  const [counted, setCounted] = useState(String(expected / 100));
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const c = Math.round(parseFloat(counted.replace(",", ".")) * 100) || 0, diff = c - expected;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/cash/close", { counted: c / 100 }); qc.invalidateQueries({ queryKey: ["cash"] }); toast("Caja cerrada"); onClose(); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo cerrar la caja", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} label="Cerrar caja">
      <ModalHead title="Cerrar caja" onClose={onClose} />
      <form onSubmit={save} style={{ display: "contents" }}>
        <div className="card-body">
          <dl className="facts panel"><div><dt>Efectivo que debería haber</dt><dd className="num">{money(expected)}</dd></div><div><dt>Cobrado por QR</dt><dd className="num">{money(qr)}</dd></div></dl>
          <div className="field"><label htmlFor="cj-count">Efectivo contado en caja (Bs)</label><input id="cj-count" type="number" inputMode="decimal" min={0} step="0.5" value={counted} onChange={(e) => setCounted(e.target.value)} />
            <span className="hint" style={{ color: Math.abs(diff) < 1 ? undefined : "var(--crit)" }}>{Math.abs(diff) < 1 ? "Cuadra exacto." : diff > 0 ? `Sobran ${money(diff)}.` : `Faltan ${money(-diff)}.`}</span></div>
        </div>
        <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy}>Cerrar caja</button></div>
      </form>
    </Modal>
  );
}
